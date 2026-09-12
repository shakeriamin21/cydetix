import os

from flask import Flask

app = Flask(__name__)

@app.post("/account/email")
@require_company_auth
def update_email():
    os.remove("pending-account-change")
    return {"updated": True}
