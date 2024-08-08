import asyncio

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()


@app.post("/ask")
async def ask_question(question: str):
    async def stream_response():
        response_words = []
        async for word in chain.astream(question):
            response_words.append(word)
            yield word
        final_response = "".join(response_words)

    return StreamingResponse(stream_response(), media_type="text/event-stream")
