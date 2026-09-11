from fastapi import FastAPI
import sqlite3

app = FastAPI()

@app.get("/users")
def users(identifier: str):
    connection = sqlite3.connect("app.db")
    return connection.execute("SELECT * FROM users WHERE id = " + identifier).fetchall()
