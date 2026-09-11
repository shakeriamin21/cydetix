from flask import Flask, request
import sqlite3

app = Flask(__name__)

@app.get("/users")
def users():
    identifier = request.args["id"]
    connection = sqlite3.connect("app.db")
    return connection.execute("SELECT * FROM users WHERE id = " + identifier).fetchall()
