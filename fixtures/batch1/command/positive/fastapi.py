from fastapi import FastAPI
import subprocess

app = FastAPI()

@app.get("/lookup")
def lookup(host: str):
    return subprocess.run("nslookup " + host, shell=True, check=False)
