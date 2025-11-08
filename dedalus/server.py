from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
from make_instructions import make_instructions

app = Flask(__name__)
CORS(app)

# Create or reuse a running event loop (important for reliability)
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)


@app.post("/parse")
def run_instructions():
    """
    Runs the async make_instructions() when the Chrome extension calls /parse
    """
    # Run the async task synchronously in Flask
    result = loop.run_until_complete(make_instructions())

    # If make_instructions() returns something, return it
    if result:
        return jsonify({"status": "success", "result": "successfully wrote instructions"}), 200
    else:
        return jsonify({"status": "error", "message": "failed to write instructions"}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
