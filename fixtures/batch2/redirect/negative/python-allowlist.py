from flask import Flask, redirect, request
from urllib.parse import urlparse

app = Flask(__name__)
allowed_redirect_hosts = {"accounts.example", "docs.example"}

@app.get("/continue")
def continue_route():
    target = request.args.get("next")
    parsed = urlparse(target)
    if parsed.scheme != "https": return redirect("/")
    if parsed.hostname not in allowed_redirect_hosts: return redirect("/")
    return redirect(parsed.geturl())
