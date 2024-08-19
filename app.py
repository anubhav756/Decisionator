from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from script import make_decision

app = FastAPI()

origins = [
    "http://localhost:3000",
    "https://anubhavdhawan-playground.uc.r.appspot.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Query(BaseModel):
    query: str


@app.post("/ask")
async def ask_question(query: Query):
    print("GOT QUERY!!!", query)
    return StreamingResponse(
        make_decision(query),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no"},
    )


app.mount("/", StaticFiles(directory="client/out", html=True), name="static")
