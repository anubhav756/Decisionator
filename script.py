import asyncio

import asyncpg
import pandas as pd
from google.cloud.sql.connector import Connector
from langchain.text_splitter import RecursiveCharacterTextSplitter

PROJECT_ID = "anubhavdhawan-playground"
DB_PASSWORD = "asdasd"
REGION = "us-central1"
INSTANCE_NAME = "my-primary"
DB_NAME = "decisionator"
DB_USER = "thanos"
DATASET_URI = (
    "https://raw.githubusercontent.com/anubhav756/Decisionator/main/quotes.csv"
)


def read_data():
    df = pd.read_csv(DATASET_URI)
    df = df.loc[:, ["quote", "character", "movie", "reference", "tag"]]
    df = df.dropna()
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
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        await conn.close()


# Test connection with `asyncio`
if __name__ == "__main__":
    asyncio.run(main())  # Start the event loop to run async code
