# Digital Literacy Helper

WebExtension for Chrome.  
Improving digital literacy for senior citizens.

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

3. Configure API keys:
   - Create a `.env` file in the project root (not in the extension folder)
   - Add your API keys (see main README.md for details)
   - The `.env` file is already in `.gitignore` to keep your keys secure

The server will run on `http://127.0.0.1:5000` and handles:
- Audio transcription via OpenAI Whisper API (`/transcribe` endpoint)
- Instruction generation via Dedalus API (`/parse` endpoint)

### Extension Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select this `extension` folder
5. The extension should now be loaded and ready to use

**Note**: The extension requires the Flask server to be running for voice transcription to work.

### Configuration

1. Create a `.env` file in the project root with your API keys:
```
DEDALUS_API_KEY=your_dedalus_api_key
OPENAI_API_KEY=your_openai_api_key
```

2. The `.env` file is already in `.gitignore` to keep your keys secure.