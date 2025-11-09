# old_people

WebExtension for Chrome.  
Digital literacy for senior citizens.

## Extension features

* xxxxxx

## Development & Build

### Prerequisites

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the Flask server (required for speech-to-text functionality):
```bash
cd dedalus && python server.py
```

The server will run on `http://127.0.0.1:5000` and handles:
- Audio transcription via OpenAI Whisper API (`/transcribe` endpoint)
- Instruction generation via Dedalus API (`/parse` endpoint)

### Extension Setup

*Ubuntu*
```
# Install build requirements
sudo apt install nodejs npm
sudo npm install -g terser

# Build package
./tools/build.sh chrome

# Temporary installation / debugging
Chrome: https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked
```

### Configuration

1. Create a `.env` file in the project root with your API keys:
```
DEDALUS_API_KEY=your_dedalus_api_key
DEDALUS_TEST_API_KEY=your_dedalus_test_api_key
OPENAI_API_KEY=your_openai_api_key
```

2. The `.env` file is already in `.gitignore` to keep your keys secure.