from flask import Flask

app = Flask(__name__)
app.config["SESSION_COOKIE_HTTPONLY"] = False
app.config["SESSION_COOKIE_SECURE"] = True

# This unrelated behavior must remain byte-for-byte unchanged by the safe fix.
HEALTH_RESPONSE = {"status": "ok"}
