from flask import Flask, render_template, request

app = Flask(__name__)

@app.get("/profile")
def profile():
    return render_template("profile.html", biography=request.args.get("biography"))
