from flask import Flask, session

app = Flask(__name__)

@app.delete("/account")
def delete_account():
    user_id = session.get("user_id")
    session.pop("user_id")
    return {"deleted": user_id}
