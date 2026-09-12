from flask import Flask, session
from flask_wtf.csrf import CSRFProtect

app = Flask(__name__)
CSRFProtect(app)

@app.post("/account/email")
def update_email():
    return {"updated": session.get("user_id")}
