from flask import Flask, Response, request

app = Flask(__name__)

@app.get("/hello")
def hello():
    name = request.args.get("name")
    return Response(f"<p>Hello {name}</p>", mimetype="text/html")
