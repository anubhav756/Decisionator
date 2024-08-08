from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from script import make_decision

app = FastAPI()


class Query(BaseModel):
    query: str


@app.post("/ask")
async def ask_question(query: Query):
    print("GOT QUERY!!!", query)
    return StreamingResponse(make_decision(query), media_type="text/event-stream")
