from flask import Flask, request, jsonify
from flask_cors import CORS
import asyncio
import os
import requests
from dotenv import load_dotenv
from make_instructions import make_instructions

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Create or reuse a running event loop (important for reliability)
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)


@app.post("/transcribe")
def transcribe_audio():
    """
    Proxies audio transcription requests to OpenAI Whisper API
    Keeps the API key secure on the server side
    """
    try:
        # Get API key from environment
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return jsonify({"status": "error", "message": "OpenAI API key not configured"}), 500

        # Get audio file from request
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "No audio file provided"}), 400

        audio_file = request.files['file']
        if audio_file.filename == '':
            return jsonify({"status": "error", "message": "No audio file selected"}), 400

        # Ensure we read from the beginning of the file
        audio_file.seek(0)
        
        # Get content type, default to audio/webm if not provided
        content_type = audio_file.content_type or 'audio/webm'
        
        # Prepare form data for OpenAI API
        files = {
            'file': (audio_file.filename, audio_file, content_type)
        }
        data = {
            'model': 'whisper-1',
            'response_format': 'json'
        }
        headers = {
            'Authorization': f'Bearer {api_key}'
        }

        # Forward request to OpenAI Whisper API
        response = requests.post(
            'https://api.openai.com/v1/audio/transcriptions',
            headers=headers,
            files=files,
            data=data
        )

        if response.status_code != 200:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            error_message = error_data.get('error', {}).get('message', 'Transcription failed')
            return jsonify({"status": "error", "message": error_message}), response.status_code

        result = response.json()
        return jsonify({"status": "success", "text": result.get('text', '')}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


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
