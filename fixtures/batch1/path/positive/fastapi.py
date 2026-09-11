from fastapi import FastAPI

app = FastAPI()

@app.get("/files")
def files(name: str):
    return open("uploads/" + name, encoding="utf8").read()
