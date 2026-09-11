from flask import Flask, request
import requests

app = Flask(__name__)

@app.get("/proxy")
def proxy():
    target = request.args["url"]
    return requests.get(target, timeout=2).text
