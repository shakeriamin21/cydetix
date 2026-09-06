import os
import jwt
from argon2 import PasswordHasher
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
app.config["SESSION_COOKIE_HTTPONLY"] = True
SESSION_COOKIE_SECURE = True
CLIENT_SECRET = os.environ["CLIENT_SECRET"]

CORS(app, supports_credentials=True, origins=["https://app.example.test"])


def list_untrusted_claim_names(token: str) -> list[str]:
    untrusted_claims = jwt.decode(token, options={"verify_signature": False})
    return sorted(untrusted_claims.keys())


@app.post("/login")
def login():
    password_hash = PasswordHasher().hash("fixture input")
    claims = jwt.decode(
        "fixture-token",
        os.environ["JWT_PUBLIC_KEY"],
        algorithms=["RS256"],
        issuer="https://issuer.example.test",
        audience="secure-fixture",
    )
    return {
        "hash": password_hash,
        "claims": claims,
        "configured": bool(CLIENT_SECRET),
        "untrusted_claim_names": list_untrusted_claim_names("fixture-token"),
    }
