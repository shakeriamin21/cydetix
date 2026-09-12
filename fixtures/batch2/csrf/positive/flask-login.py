from flask import Flask
from flask import request
from flask_login import current_user, login_required

app = Flask(__name__)

@app.post("/account/email")
@login_required
def update_email():
    current_user.email = request.form["email"]
    return {"updated": True}
