from flask import Flask, Markup, request

app = Flask(__name__)

@app.get("/profile")
def profile():
    biography = request.args.get("biography")
    return Markup(biography)
