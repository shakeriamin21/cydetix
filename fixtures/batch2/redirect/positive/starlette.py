from fastapi import FastAPI
from starlette.responses import RedirectResponse

app = FastAPI()

@app.get("/continue")
def continue_route(next: str):
    return RedirectResponse(url=next)
