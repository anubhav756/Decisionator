import asyncio
import json
import time
import uuid
from typing import List

import asyncpg
import numpy as np
import pandas as pd
from google.cloud import aiplatform
from google.cloud.sql.connector import Connector
from langchain.output_parsers import PydanticOutputParser
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain_google_vertexai import ChatVertexAI, VertexAIEmbeddings
from pgvector.asyncpg import register_vector

PROJECT_ID = "anubhavdhawan-playground"
DB_PASSWORD = "asdasd"
REGION = "us-central1"
INSTANCE_NAME = "my-primary"
DB_NAME = "decisionator"
DB_USER = "thanos"
DATASET_URI = (
    "https://raw.githubusercontent.com/anubhav756/Decisionator/main/quotes.csv"
)
M = 24
EF_CONSTRUCTION = 100
OPERATOR = "vector_cosine_ops"


aiplatform.init(project=f"{PROJECT_ID}", location=f"{REGION}")
embeddings_service = VertexAIEmbeddings(model_name="textembedding-gecko@001")


async def setup_db(conn):
    await conn.execute("DROP TABLE IF EXISTS quotes CASCADE")
    # Create the `quotes` table.
    await conn.execute(
        """CREATE TABLE quotes(
                            id UUID PRIMARY KEY,
                            line TEXT,
                            character TEXT,
                            movie TEXT,
                            year INTEGER)"""
    )

    df = read_data()
    # Copy the dataframe to the `quotes` table.
    tuples = list(df.itertuples(index=False))
    await conn.copy_records_to_table(
        "quotes", records=tuples, columns=list(df), timeout=10
    )

    # Create vector embeddings
    text_splitter = RecursiveCharacterTextSplitter(
        separators=[".", "\n"],
        chunk_size=500,
        chunk_overlap=0,
        length_function=len,
    )
    chunked = []
    for index, row in df.iterrows():
        id = row["id"]
        content = row["line"]
        splits = text_splitter.create_documents([content])
        for s in splits:
            r = {"id": id, "content": s.page_content}
            chunked.append(r)

    batch_size = 5
    for i in range(0, len(chunked), batch_size):
        request = [x["content"] for x in chunked[i : i + batch_size]]
        response = retry_with_backoff(embeddings_service.embed_documents, request)
        # Store the retrieved vector embeddings for each chunk back.
        for x, e in zip(chunked[i : i + batch_size], response):
            x["embedding"] = e

    # Store the generated embeddings in a pandas dataframe.
    quote_embeddings = pd.DataFrame(chunked)

    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    await conn.execute("DROP TABLE IF EXISTS quote_embeddings")
    await conn.execute(
        """CREATE TABLE quote_embeddings(
                            id UUID NOT NULL REFERENCES quotes(id),
                            content TEXT,
                            embedding vector(768))"""
    )

    await conn.executemany(
        """
        INSERT INTO quote_embeddings (id, content, embedding) 
        VALUES ($1, $2, $3)
        """,
        list(
            zip(
                quote_embeddings["id"].tolist(),
                quote_embeddings["content"].tolist(),
                quote_embeddings["embedding"].apply(np.array).tolist(),
            )
        ),
    )

    # Create an HNSW index on the `quote_embeddings` table.
    await conn.execute(
        f"""CREATE INDEX ON quote_embeddings
            USING hnsw(embedding {OPERATOR})
            WITH (m = {M}, ef_construction = {EF_CONSTRUCTION})
        """
    )


def read_data():
    df = pd.read_csv(DATASET_URI)
    df = df.loc[:, ["line", "character", "movie", "year"]]
    df = df.dropna()
    df["id"] = df.apply(lambda _: uuid.uuid4(), axis=1)
    return df


async def get_conn(connector):
    # create connection to Cloud SQL database
    conn = await connector.connect_async(
        f"{PROJECT_ID}:{REGION}:{INSTANCE_NAME}",
        "asyncpg",
        user=f"{DB_USER}",
        password=f"{DB_PASSWORD}",
        db=f"{DB_NAME}",
    )
    await register_vector(conn)
    return conn


async def ping_db(conn):
    # query Cloud SQL database
    results = await conn.fetch("SELECT version()")
    print(results[0]["version"])


# Helper function to retry failed API requests with exponential backoff.
def retry_with_backoff(func, *args, retry_delay=5, backoff_factor=2, **kwargs):
    max_attempts = 10
    retries = 0
    for i in range(max_attempts):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            print(f"error: {e}")
            retries += 1
            wait = retry_delay * (backoff_factor**retries)
            print(f"Retry after waiting for {wait} seconds...")
            time.sleep(wait)


async def find_options(query, model):
    class Option(BaseModel):
        title: str = Field(
            description="Title of the possible choice for the given question."
        )
        justification: str = Field(description="Justification of the choice.")

    class Query(BaseModel):
        question: str = Field(
            description="Question with potentially more than one options."
        )
        options: List[Option] = Field(
            description="All possible options for the question."
        )

    parser = PydanticOutputParser(pydantic_object=Query)
    prompt = PromptTemplate(
        template="""
            You are tasked with identifying the options present in the query given below, which could be a question or statement.
            The options are the potential choices or actions implied by the query.
            Make sure that at least two options are identified.
            If no explicit options are present, generate the most likely implicit options based on the context.
            Focus on clear, actionable advice.
            Do not include additional commentary or justification.
            {format_instructions}

            **Query:**
            {query}
        """,
        partial_variables={"format_instructions": parser.get_format_instructions()},
        input_variables=["query"],
    )
    chain = prompt | model | parser
    return chain.invoke({"query": query})


async def get_similar_dialog(justification, conn):
    # character = "Iron Man"
    qe = embeddings_service.embed_query(justification)
    similarity_threshold = 0.6
    num_matches = 1

    results = await conn.fetch(
        """
                            WITH vector_matches AS (
                              SELECT id, 1 - (embedding <=> $1) AS similarity
                              FROM quote_embeddings
                              WHERE 1 - (embedding <=> $1) > $2
                              ORDER BY similarity DESC
                              LIMIT $3
                            )
                            SELECT line, character, movie, year, similarity
                            FROM
                            vector_matches
                            LEFT JOIN
                            quotes
                            ON vector_matches.id = quotes.id
                            """,
        # AND character = $4
        qe,
        similarity_threshold,
        num_matches,
        # character,
    )
    if len(results) == 0:
        raise Exception("Did not find any results. Adjust the query parameters.")

    return results[0]


async def get_best_dialog(options, conn):
    max_similarity = 0
    best_dialog = {}
    for option in options:
        option_query = option.title + "; " + option.justification
        print("POSSIBLE OPTION!!! -->", option_query)
        similar_dialog = await get_similar_dialog(option_query, conn)
        print("SIMILAR DIALOG!!! <--", similar_dialog)
        if similar_dialog["similarity"] > max_similarity:
            max_similarity = similar_dialog["similarity"]
            best_dialog = {
                "line": similar_dialog["line"],
                "character": similar_dialog["character"],
                "movie": similar_dialog["movie"],
                "year": similar_dialog["year"],
                "title": option.title,
                "justification": option.justification,
            }

    return best_dialog


async def modify_option(dialog, query, model):
    class Justification(BaseModel):
        modified_sentence_b: str = Field(
            description="The modified version of sentence B"
        )

    parser = PydanticOutputParser(pydantic_object=Justification)
    prompt = PromptTemplate(
        template="""
            Note that three sentences are given below, namely Sentence A, Sentence B and Sentence C.
            The Sentence B is an answer for the question in Sentence A, and Sentence C is a justification for choosing Sentence B.
            You are {character} from the movie {movie} that came out in {year}.
            How would you clearly convey the meaning of Sentence B and optionally Sentence C?
            Answer in one or two sentences only.
            {format_instructions}

            **Sentence A:**
            {query}

            **Sentence B:**
            {title}

            **Sentence C:**
            {justification}
        """,
        partial_variables={"format_instructions": parser.get_format_instructions()},
        input_variables=[
            "character",
            "movie",
            "year",
            "query",
            "title",
            "justification",
        ],
    )

    chain = prompt | model | parser

    response = chain.invoke(
        {
            "character": dialog["character"],
            "movie": dialog["movie"],
            "year": dialog["year"],
            "query": query,
            "title": dialog["title"],
            "justification": dialog["justification"],
        }
    )

    return response.modified_sentence_b


async def merge_dialog_justification(justification, dialog, model):
    class Response(BaseModel):
        merged_sentences: str = Field(description="The final response dialog.")

    parser = PydanticOutputParser(pydantic_object=Response)
    prompt = PromptTemplate(
        template="""
            {format_instructions}
            Note that two sentences are given below, namely Sentence A and Sentence B.
            Sentence B is a movie dialog. Your task is to additionally convey the meaning of Sentence A while minimally modifying Sentence B.
            Make sure that it still sounds like one single dialog.

            **Sentence A:**
            {justification}

            **Sentence B:**
            {dialog}
        """,
        partial_variables={"format_instructions": parser.get_format_instructions()},
        input_variables=["justification", "dialog"],
    )

    chain = prompt | model | parser

    response = chain.invoke(
        {
            "justification": justification,
            "dialog": dialog,
        }
    )

    return response.merged_sentences


async def make_decision(query):
    loop = asyncio.get_running_loop()
    async with Connector(loop=loop) as connector:
        conn = await get_conn(connector)
        # await ping_db(conn)

        model = ChatVertexAI(model_name="gemini-pro")

        response = await find_options(query, model)

        yield json.dumps([option.title for option in response.options])

        best_dialog = await get_best_dialog(response.options, conn)
        print("BEST DIALOG!!! <--", best_dialog)

        modified_best_dialog = await modify_option(best_dialog, query, model)
        print("MODIFIED BEST DIALOG!!! <--", modified_best_dialog)

        final_response = await merge_dialog_justification(
            modified_best_dialog, best_dialog["line"], model
        )
        print("!!!", final_response)
        print(
            "###",
            best_dialog["line"],
            "|",
            best_dialog["character"],
            "|",
            best_dialog["movie"],
            "|",
            best_dialog["year"],
        )

        yield json.dumps(
            {
                "response": final_response,
                "original_quote": best_dialog["line"],
                "character": best_dialog["character"],
                "movie": best_dialog["movie"],
                "year": best_dialog["year"],
                "options": [
                    {
                        "title": option.title,
                        "justification": option.justification,
                        "is_chosen": best_dialog["title"] == option.title,
                    }
                    for option in response.options
                ],
            }
        )

        await conn.close()
