import hashlib
import jwt
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
app.config["SESSION_COOKIE_HTTPONLY"] = False
SESSION_COOKIE_SECURE = False
CLIENT_SECRET = "fixture-only-not-a-real-client-secret-000000"

CORS(app, supports_credentials=True, origins="*")


@app.post("/login")
def login():
    password = "fixture input"
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    claims = jwt.decode(
        "fixture-token",
        options={"verify_signature": False},
    )
    if claims["role"] != "admin":
        return {"error": "forbidden"}, 403
    return {"hash": password_hash, "claims": claims, "configured": bool(CLIENT_SECRET)}
