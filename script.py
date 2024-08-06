import asyncio
import time
import uuid

import asyncpg
import pandas as pd
from google.cloud import aiplatform
from google.cloud.sql.connector import Connector
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_vertexai import VertexAIEmbeddings

PROJECT_ID = "anubhavdhawan-playground"
DB_PASSWORD = "asdasd"
REGION = "us-central1"
INSTANCE_NAME = "my-primary"
DB_NAME = "decisionator"
DB_USER = "thanos"
DATASET_URI = (
    "https://raw.githubusercontent.com/anubhav756/Decisionator/main/quotes.csv"
)

aiplatform.init(project=f"{PROJECT_ID}", location=f"{REGION}")
embeddings_service = VertexAIEmbeddings(
    model_name="textembedding-gecko@001"
)  # Text embedding model


def read_data():
    df = pd.read_csv(DATASET_URI)
    df = df.loc[:, ["quote", "character", "movie", "reference", "tag"]]
    df = df.dropna()
    df["id"] = df.apply(lambda _: uuid.uuid4(), axis=1)
    return df


async def get_conn(connector):
    # create connection to Cloud SQL database
    return await connector.connect_async(
        f"{PROJECT_ID}:{REGION}:{INSTANCE_NAME}",
        "asyncpg",
        user=f"{DB_USER}",
        password=f"{DB_PASSWORD}",
        db=f"{DB_NAME}",
    )


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


async def main():
    # get current running event loop to be used with Connector
    loop = asyncio.get_running_loop()
    # initialize Connector object as async context manager
    async with Connector(loop=loop) as connector:
        conn = await get_conn(connector)
        await ping_db(conn)

        await conn.execute("DROP TABLE IF EXISTS quotes CASCADE")
        # Create the `products` table.
        await conn.execute(
            """CREATE TABLE quotes(
                                id UUID PRIMARY KEY,
                                quote TEXT,
                                character TEXT,
                                movie TEXT,
                                reference TEXT,
                                tag TEXT)"""
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
            content = row["quote"] + " - " + row["reference"]
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
        print(quote_embeddings.head())

        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())  # Start the event loop to run async code
