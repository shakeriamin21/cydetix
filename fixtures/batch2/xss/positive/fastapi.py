from fastapi import FastAPI
from starlette.responses import HTMLResponse

app = FastAPI()

@app.get("/hello")
def hello(name: str):
    return HTMLResponse(f"<p>Hello {name}</p>")
