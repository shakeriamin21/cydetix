from flask import Flask

app = Flask(__name__)
app.config["SESSION_COOKIE_HTTPONLY"] = False
app.config["SESSION_COOKIE_SECURE"] = True
