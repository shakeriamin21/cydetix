from flask import Flask, request
import os

app = Flask(__name__)

@app.get("/lookup")
def lookup():
    host = request.args["host"]
    return os.system("nslookup " + host)
