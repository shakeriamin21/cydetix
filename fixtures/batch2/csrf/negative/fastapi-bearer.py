from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPBearer
import jwt

app = FastAPI()
auth = HTTPBearer()

@app.post("/jobs/run")
def run_job(authorization: str):
    jwt.decode(authorization, "public-key", algorithms=["RS256"])
    return {"started": True}
