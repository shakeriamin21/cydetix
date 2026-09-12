from flask import Flask, redirect, request

app = Flask(__name__)

@app.get("/continue")
def continue_route():
    target = request.args.get("next")
    return redirect(target)
