from flask import Flask, redirect

app = Flask(__name__)

@app.get("/home")
def home():
    return redirect("/dashboard")
