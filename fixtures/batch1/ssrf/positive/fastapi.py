from fastapi import FastAPI
import httpx

app = FastAPI()

@app.get("/proxy")
def proxy(target: str):
    return httpx.get(target, timeout=2).text
