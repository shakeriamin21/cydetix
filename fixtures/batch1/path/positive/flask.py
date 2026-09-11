from flask import Flask, request

app = Flask(__name__)

@app.get("/files")
def files():
    requested = request.args["path"]
    return open("uploads/" + requested, encoding="utf8").read()
