from flask import Flask, Response, request

app = Flask(__name__)

@app.get("/preview")
def preview():
    html = sanitize_for_our_templates(request.args.get("html"))
    return Response(html, mimetype="text/html")
