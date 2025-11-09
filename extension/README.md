# Digital Literacy Helper

A Chrome extension framework for teaching digital literacy to senior citizens.

## Setup

### Prerequisites

1. **Start the Flask server** (required for speech-to-text functionality):
```bash
cd ../dedalus && python server.py
```

The server must be running on `http://127.0.0.1:5000` for the extension to work properly.

2. **Configure API keys**:
   - Create a `.env` file in the project root (not in the extension folder)
   - Add your API keys (see main README.md for details)
   - The `.env` file is already in `.gitignore` to keep your keys secure

### Extension Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select this `extension` folder
5. The extension should now be loaded and ready to use

**Note**: The extension requires the Flask server to be running for voice transcription to work.

## Structure

- `src/popup/` - Extension popup UI (toggle switch and options button)
- `src/ui/` - Options page (settings and configuration)
- `src/scripts/background.js` - Background service worker
- `manifest.json` - Extension configuration

## Development

This is a clean framework ready for building digital literacy features. All YouTube/BlockTube references have been removed.

