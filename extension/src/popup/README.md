# Voice Interaction UI Implementation

## Overview

This implementation provides a professional voice interaction interface with:
- **State Machine**: IDLE → LISTENING → THINKING → RESPONDING
- **Voice Recognition**: OpenAI Whisper API (via Flask server) for speech-to-text
- **Waveform Visualization**: Real-time audio waveform visualization
- **Chat Interface**: Message bubbles for conversation history
- **Smooth Animations**: CSS transitions and animations

## Prerequisites

**Important**: The Flask server must be running for this to work:

```bash
cd ../../../dedalus && python server.py
```

The server handles audio transcription via the `/transcribe` endpoint, which proxies requests to the OpenAI Whisper API. API keys are stored securely in the `.env` file on the server side.

## Architecture

### File Structure
```
popup/
├── popup.html          # Main UI structure
├── popup.css           # Styles and animations
├── popup.js            # Main controller & state management
├── voice.js            # Voice recognition module
└── waveform.js         # Audio visualization module
```

### Modules

1. **PopupController** (`popup.js`)
   - Manages UI state machine
   - Coordinates voice recognition and visualization
   - Handles chat messages
   - Integrates with agent API

2. **VoiceRecognition** (`voice.js`)
   - Wraps Web Speech API
   - Handles speech-to-text conversion
   - Provides event callbacks

3. **WaveformVisualizer** (`waveform.js`)
   - Uses Web Audio API for audio analysis
   - Renders real-time waveform on canvas
   - Handles microphone permissions

## Integration Guide

### 1. Agent API Integration

Replace the mock response in `popup.js`:

```javascript
async getAgentResponse(userMessage) {
  // Option 1: Direct API call
  const response = await fetch('https://your-api-endpoint.com/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: userMessage,
      conversationHistory: this.conversationHistory
    })
  });
  
  const data = await response.json();
  return data.response;
  
  // Option 2: Chrome extension message passing
  // const response = await chrome.runtime.sendMessage({
  //   type: 'agent-request',
  //   message: userMessage
  // });
  // return response.text;
}
```

### 2. Customize Button Text

Edit `STATE_TEXTS` in `popup.js`:

```javascript
const STATE_TEXTS = {
  [STATES.IDLE]: 'Tap to ask',        // Your custom text
  [STATES.LISTENING]: 'Listening...',
  [STATES.THINKING]: '',
  [STATES.RESPONDING]: 'Explaining...'
};
```

### 3. Customize Animations

Edit CSS animations in `popup.css`:

- **Pulse effect** (LISTENING state): `@keyframes pulse`
- **Bounce effect** (RESPONDING state): `@keyframes bounce`
- **Waveform appearance**: `@keyframes waveformFadeIn`
- **Loading spinner**: `@keyframes spinnerFadeIn`

### 4. Waveform Customization

Modify waveform rendering in `waveform.js`:

```javascript
// Change bar count
const barCount = 32; // Increase for more bars

// Change colors
this.ctx.strokeStyle = '#5DA9E9'; // Waveform color
this.ctx.shadowColor = '#5DA9E9'; // Glow color

// Change animation style (circular vs linear)
// Current: Circular waveform around bot icon
// Can be changed to: Linear bars, frequency spectrum, etc.
```

## State Flow

1. **IDLE**: User sees "Tap to ask" button with bot icon
2. **LISTENING**: User clicks → microphone activates → waveform appears → "Listening..." text
3. **THINKING**: Speech ends → waveform stops → loading spinner → processing
4. **RESPONDING**: Response received → "Explaining..." → chat bubble appears
5. **IDLE**: Returns to idle state after response

## Browser Compatibility

- **Chrome/Edge**: Full support (Web Speech API + Web Audio API)
- **Firefox**: Limited (may need polyfills)
- **Safari**: Limited (Web Speech API support varies)

## Permissions

The extension requests microphone access when the user clicks the voice button. No special manifest permissions are required - the browser will prompt the user.

## Performance Considerations

- **Waveform rendering**: Uses `requestAnimationFrame` for smooth 60fps animation
- **Audio analysis**: Configured with optimal FFT size and smoothing
- **Memory management**: Properly cleans up audio streams and contexts

## Customization Options

### Bot Icon
- Edit SVG in `popup.html`
- Modify colors, size, animations
- Add different states (thinking, responding)

### Chat Bubbles
- Customize styles in `popup.css`
- Add avatar images
- Implement typing indicators
- Add timestamps

### Voice Recognition
- Change language: `recognition.lang = 'en-US'`
- Enable continuous mode: `recognition.continuous = true`
- Add interim results: `recognition.interimResults = true`

## Troubleshooting

### Microphone not working
- Check browser permissions
- Verify HTTPS (required for getUserMedia)
- Check browser console for errors

### Speech recognition not working
- Ensure Chrome/Edge browser
- Check microphone permissions
- Verify internet connection (some APIs require it)

### Waveform not showing
- Check microphone permissions
- Verify Web Audio API support
- Check browser console for errors

## Next Steps

1. **Integrate your agent API** in `getAgentResponse()`
2. **Customize styling** to match your brand
3. **Add error handling** for API failures
4. **Implement conversation history** persistence
5. **Add user settings** (language, voice, etc.)

