from flask import Flask, Markup, request
from markupsafe import escape

app = Flask(__name__)

@app.get("/hello")
def hello():
    name = request.args.get("name")
    return Markup(escape(name))
