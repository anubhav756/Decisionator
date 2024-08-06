import asyncio

import asyncpg
from google.cloud.sql.connector import Connector

project_id = "anubhavdhawan-playground"
database_password = "asdasd"
region = "us-central1"
instance_name = "my-primary"
database_name = "decisionator"
database_user = "thanos"


async def main():
    # get current running event loop to be used with Connector
    loop = asyncio.get_running_loop()
    # initialize Connector object as async context manager
    async with Connector(loop=loop) as connector:
        # create connection to Cloud SQL database
        conn = await connector.connect_async(
            f"{project_id}:{region}:{instance_name}",
            "asyncpg",
            user=f"{database_user}",
            password=f"{database_password}",
            db=f"{database_name}",
        )

        # query Cloud SQL database
        results = await conn.fetch("SELECT version()")
        print(results[0]["version"])

        # close asyncpg connection
        await conn.close()


# Test connection with `asyncio`
if __name__ == "__main__":
    asyncio.run(main())  # Start the event loop to run async code
