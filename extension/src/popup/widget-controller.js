/**
 * Widget Controller - Manages floating widget on web pages
 * Adapted from popup.js for content script context
 */

// UI States
const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  RESPONDING: 'responding'
};

// Button text for each state
const STATE_TEXTS = {
  [STATES.IDLE]: 'Tap to ask',
  [STATES.LISTENING]: 'Listening...',
  [STATES.THINKING]: '',
  [STATES.RESPONDING]: 'Explaining...'
};

class WidgetController {
  constructor() {
    this.currentState = STATES.IDLE;
    this.voiceRecognition = null;
    this.waveformVisualizer = null;
    this.conversationHistory = [];
    
    // Use dl- prefix for all IDs to avoid conflicts
    this.ids = {
      voiceButton: 'dl-voice-button',
      voiceButtonText: 'dl-voice-button-text',
      botIcon: 'dl-bot-icon',
      waveformCanvas: 'dl-waveform-canvas',
      loadingSpinner: 'dl-loading-spinner',
      chatContainer: 'dl-chat-container'
    };
    
    this.init();
  }

  async init() {
    // Wait for DOM elements to be ready
    if (!document.getElementById(this.ids.voiceButton)) {
      setTimeout(() => this.init(), 100);
      return;
    }

    // Initialize components
    this.voiceRecognition = new VoiceRecognition();
    this.waveformVisualizer = new WaveformVisualizer(this.ids.waveformCanvas);
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Setup voice recognition callbacks
    if (this.voiceRecognition.isAvailable()) {
      this.voiceRecognition.onStart(() => {
        this.setState(STATES.LISTENING);
      });
      
      this.voiceRecognition.onResult((transcript) => {
        this.handleUserMessage(transcript);
      });
      
      this.voiceRecognition.onEnd(() => {
        if (this.currentState === STATES.LISTENING) {
          this.setState(STATES.THINKING);
        }
      });
      
      this.voiceRecognition.onError((error) => {
        this.setState(STATES.IDLE);
      });
    } else {
      }
  }

  setupEventHandlers() {
    const voiceButton = document.getElementById(this.ids.voiceButton);
    
    if (voiceButton) {
      voiceButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        this.handleVoiceButtonClick();
      });
    }
  }

  handleVoiceButtonClick() {
    switch (this.currentState) {
      case STATES.IDLE:
        this.startListening();
        break;
      case STATES.LISTENING:
        // Stop listening (optional - could allow stopping)
        // this.stopListening();
        break;
      case STATES.THINKING:
        // Do nothing - can't stop thinking
        break;
      case STATES.RESPONDING:
        // Do nothing - can't stop responding
        break;
    }
  }

  async startListening() {
    // Check if we're on a secure context
    const isSecure = window.isSecureContext || 
                     location.protocol === 'https:' || 
                     location.hostname === 'localhost' || 
                     location.hostname.startsWith('127.0.0.1') ||
                     location.hostname === '[::1]';
    
    if (!isSecure) {
      alert('Microphone access requires a secure connection (HTTPS). Please visit this page over HTTPS or use localhost.');
      return;
    }

    if (!this.voiceRecognition || !this.voiceRecognition.isAvailable()) {
      alert('Speech recognition is not available in this browser. Please use Chrome or another supported browser.');
      return;
    }

    // Set state to LISTENING first (this will update UI)
    this.setState(STATES.LISTENING);
    
    // Start waveform visualization (will request mic permission)
    const started = await this.waveformVisualizer.start();
    if (started) {
      // Start voice recognition
      try {
        this.voiceRecognition.start();
      } catch (error) {
        this.waveformVisualizer.stop();
        this.setState(STATES.IDLE);
      }
    } else {
      // Microphone access was denied or failed
      this.setState(STATES.IDLE);
    }
  }

  stopListening() {
    if (this.voiceRecognition) {
      this.voiceRecognition.stop();
    }
    this.waveformVisualizer.stop();
  }

  setState(newState) {
    if (this.currentState === newState) return;
    
    const oldState = this.currentState;
    this.currentState = newState;
    
    this.updateUI();
    this.handleStateChange(oldState, newState);
  }

  handleStateChange(oldState, newState) {
    // Clean up previous state
    switch (oldState) {
      case STATES.LISTENING:
        this.waveformVisualizer.stop();
        break;
    }
    
    // Initialize new state
    // Note: LISTENING state is handled in startListening(), not here
    // to avoid double-initialization
    switch (newState) {
      case STATES.THINKING:
        // Start processing (simulate API call)
        this.processUserMessage();
        break;
    }
  }

  updateUI() {
    const voiceButton = document.getElementById(this.ids.voiceButton);
    const voiceButtonText = document.getElementById(this.ids.voiceButtonText);
    const botIcon = document.getElementById(this.ids.botIcon);
    const waveformCanvas = document.getElementById(this.ids.waveformCanvas);
    const loadingSpinner = document.getElementById(this.ids.loadingSpinner);
    
    if (!voiceButton || !voiceButtonText) return;
    
    // Update button text
    voiceButtonText.textContent = STATE_TEXTS[this.currentState];
    
    // Update button classes for styling
    voiceButton.className = `dl-voice-button state-${this.currentState}`;
    
    // Update icon visibility
    if (botIcon) {
      botIcon.style.display = this.currentState === STATES.IDLE ? 'block' : 'none';
    }
    
    if (waveformCanvas) {
      waveformCanvas.style.display = this.currentState === STATES.LISTENING ? 'block' : 'none';
    }
    
    if (loadingSpinner) {
      loadingSpinner.style.display = (this.currentState === STATES.THINKING || this.currentState === STATES.RESPONDING) ? 'block' : 'none';
    }
  }

  handleUserMessage(transcript) {
    // Add user message to chat
    this.addChatMessage(transcript, 'user');
    
    // Transition to thinking state
    this.setState(STATES.THINKING);
  }

  async processUserMessage() {
    // Simulate API call to your agent/backend
    // Replace this with actual API call
    const lastUserMessage = this.conversationHistory[this.conversationHistory.length - 1];
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock response (replace with actual agent response)
    const response = await this.getAgentResponse(lastUserMessage.text);
    
    // Add bot response to chat
    this.addChatMessage(response, 'bot');
    
    // Transition to responding state
    this.setState(STATES.RESPONDING);
    
    // After response is complete, return to idle
    setTimeout(() => {
      this.setState(STATES.IDLE);
    }, 2000);
  }

  async getAgentResponse(userMessage) {
    // TODO: Replace with actual agent API call
    // For now, return a mock response
    return `I understand you said: "${userMessage}". This is a placeholder response. Integrate your agent API here.`;
  }

  addChatMessage(text, sender) {
    const chatContainer = document.getElementById(this.ids.chatContainer);
    if (!chatContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `dl-chat-message dl-chat-message-${sender}`;
    messageDiv.textContent = text;
    
    // Add animation
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    
    chatContainer.appendChild(messageDiv);
    
    // Chat container will automatically show via CSS :not(:empty) selector
    // No need to manually set styles - CSS handles it
    
    // Animate in
    setTimeout(() => {
      messageDiv.style.transition = 'all 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    }, 10);
    
    // Scroll to bottom
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
    
    // Save to history
    this.conversationHistory.push({ text, sender, timestamp: Date.now() });
  }
}

// Make class available globally
window.WidgetController = WidgetController;

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dl-voice-button')) {
      window.digitalLiteracyWidget = new WidgetController();
    }
  });
} else {
  // DOM already ready
  if (document.getElementById('dl-voice-button')) {
    window.digitalLiteracyWidget = new WidgetController();
  }
}

