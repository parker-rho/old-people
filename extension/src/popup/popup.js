/**
 * Main Popup Controller
 * Manages UI state and coordinates voice recognition and visualization
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

class PopupController {
  constructor() {
    this.currentState = STATES.IDLE;
    this.speechService = null;
    this.waveformVisualizer = null;
    this.conversationHistory = [];
    
    this.init();
  }

  async init() {
    // Initialize components
    // Note: speechService is a singleton from speech-service.js
    this.speechService = speechService;
    this.waveformVisualizer = new WaveformVisualizer('waveform-canvas');
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Setup speech service callbacks
    this.speechService.onTranscription((transcription) => {
      // Add user message to chat and process it
      // Note: We're already in THINKING state from the 'processing' state change
      this.addChatMessage(transcription.text, 'user');
      // Process the message to get agent response
      // processUserMessage will be called automatically via handleStateChange when we transition to THINKING
      // But since we're already in THINKING, we need to call it directly
      this.processUserMessage();
    });
    
    this.speechService.onStateChange((stateData) => {
      switch (stateData.state) {
        case 'recording':
          // Recording started - show listening state
          this.setState(STATES.LISTENING);
          break;
        case 'processing':
          // Processing audio - show thinking state
          // Stop waveform visualization since we're done recording
          this.waveformVisualizer.stop();
          this.setState(STATES.THINKING);
          break;
        case 'completed':
          // Transcription completed - handled by onTranscription callback
          // State will transition to RESPONDING when agent response is received
          break;
        case 'error':
          // Error occurred
          alert(stateData.message || 'An error occurred during speech recognition.');
          this.setState(STATES.IDLE);
          this.waveformVisualizer.stop();
          break;
      }
    });
  }

  setupEventHandlers() {
    const voiceButton = document.getElementById('voice-button');
    if (!voiceButton) {
      return;
    }
    
    
    voiceButton.addEventListener('click', () => {
      this.handleVoiceButtonClick();
    });
    
    // Realign bubbles on window resize (instant, no animation)
    window.addEventListener('resize', () => {
      this.realignAllBubbles(voiceButton, false); // Instant positioning on resize
    });
    
    // Track button position to detect when it shifts and realigns
    // This handles the case where layout shifts cause button to move temporarily
    this.lastButtonPosition = null;
    this.positionCheckInterval = null;
    this.positionStableCount = 0; // Count of consecutive checks where position is stable
    this.pendingRealignTimeout = null;
    
    // Start monitoring button position
    this.startButtonPositionMonitoring(voiceButton);
  }

  startButtonPositionMonitoring(voiceButton) {
    // Stop any existing monitoring
    if (this.positionCheckInterval) {
      clearInterval(this.positionCheckInterval);
    }
    if (this.pendingRealignTimeout) {
      clearTimeout(this.pendingRealignTimeout);
    }
    
    // Check initial button position immediately
    const initialRect = voiceButton.getBoundingClientRect();
    const widgetContainer = document.getElementById('digital-literacy-widget');
    const containerRect = widgetContainer ? widgetContainer.getBoundingClientRect() : null;
    
    
    // Wait for initial layout to settle before starting monitoring
    // This prevents false positives from initial CSS loading and layout shifts
    setTimeout(() => {
      // Initialize last known position after layout has settled
      // Store ACTUAL button position from getBoundingClientRect (not calculated)
      // This prevents false positives from scrollbar appearance/disappearance
      const buttonRect = voiceButton.getBoundingClientRect();
      this.lastButtonPosition = {
        left: buttonRect.left, // Store actual pixel values (not rounded)
        right: buttonRect.right,
        bottom: buttonRect.bottom,
        // Also store window dimensions to detect scrollbar changes
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        documentWidth: document.documentElement.clientWidth
      };
      this.positionStableCount = 0;
      
      this._startPositionMonitoringLoop(voiceButton);
    }, 500); // Wait 500ms for initial layout to fully settle
  }

  _startPositionMonitoringLoop(voiceButton) {
    let checkCount = 0;
    
    // Check button position periodically and realign if it changes and then stabilizes
    // This catches cases where layout shifts cause the button to move and then snap back
    this.positionCheckInterval = setInterval(() => {
      checkCount++;
      
      try {
        // Check if lastButtonPosition is properly initialized FIRST
        // This must be checked before we try to access any properties
        if (!this.lastButtonPosition || 
            this.lastButtonPosition.left === undefined || 
            this.lastButtonPosition.right === undefined ||
            this.lastButtonPosition.bottom === undefined) {
          // Not initialized yet, skip this check (but don't log every time to avoid spam)
          if (checkCount === 1 || checkCount % 100 === 0) {
          }
          return;
        }
        
        const buttonRect = voiceButton.getBoundingClientRect();
        
        // Store ACTUAL button position (from getBoundingClientRect)
        // This is more reliable than calculating from window.innerWidth
        const currentButtonPosition = {
          left: buttonRect.left,
          right: buttonRect.right,
          bottom: buttonRect.bottom
        };
        
        // Also track window dimensions to detect scrollbar changes
        const currentWindowSize = {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          documentWidth: document.documentElement.clientWidth
        };
        
        // Check if ACTUAL button position has changed (not calculated position)
        // Use a small tolerance (0.5px) to ignore subpixel differences
        const tolerance = 0.5;
        const actualPositionChanged = 
          Math.abs(currentButtonPosition.left - this.lastButtonPosition.left) > tolerance ||
          Math.abs(currentButtonPosition.right - this.lastButtonPosition.right) > tolerance ||
          Math.abs(currentButtonPosition.bottom - this.lastButtonPosition.bottom) > tolerance;
        
        // Check if scrollbar appeared/disappeared (this can cause false positives)
        // Safely check windowWidth property exists
        const scrollbarChanged = 
          this.lastButtonPosition.documentWidth !== undefined &&
          this.lastButtonPosition.windowWidth !== undefined &&
          (currentWindowSize.documentWidth !== this.lastButtonPosition.documentWidth ||
           Math.abs(currentWindowSize.innerWidth - this.lastButtonPosition.windowWidth) > 1);
        
        // Only report position change if ACTUAL button position changed
        // Ignore changes that are just due to scrollbar
        const hasChanged = actualPositionChanged;
        
        if (hasChanged) {
          // Position changed - reset stability counter and cancel any pending realignment
          this.positionStableCount = 0;
          if (this.pendingRealignTimeout) {
            clearTimeout(this.pendingRealignTimeout);
            this.pendingRealignTimeout = null;
          }
          
          const delta = {
            left: currentButtonPosition.left - this.lastButtonPosition.left,
            right: currentButtonPosition.right - this.lastButtonPosition.right,
            bottom: currentButtonPosition.bottom - this.lastButtonPosition.bottom
          };
          
          // Check if scrollbar appeared/disappeared
          const scrollbarWidth = currentWindowSize.innerWidth - currentWindowSize.documentWidth;
          const hasHorizontalScrollbar = document.documentElement.scrollWidth > currentWindowSize.innerWidth;
          
          // Calculate what the "right" value would be (for display purposes)
          const calculatedRight = Math.round(currentWindowSize.innerWidth - currentButtonPosition.right);
          const previousCalculatedRight = this.lastButtonPosition.windowWidth 
            ? Math.round(this.lastButtonPosition.windowWidth - this.lastButtonPosition.right)
            : null;
          
          
          if (scrollbarChanged && Math.abs(delta.right) < 20 && Math.abs(delta.left) < 1 && Math.abs(delta.bottom) < 1) {
            // Don't update position - it's just a scrollbar change, not actual movement
            return;
          }
          
          // Update last known position (store actual button position, not calculated)
          this.lastButtonPosition = {
            left: currentButtonPosition.left,
            right: currentButtonPosition.right,
            bottom: currentButtonPosition.bottom,
            windowWidth: currentWindowSize.innerWidth,
            windowHeight: currentWindowSize.innerHeight,
            documentWidth: currentWindowSize.documentWidth
          };
          
          // Schedule a realignment check after the button should have settled
          // We'll verify the position is stable before actually realigning
          this.pendingRealignTimeout = setTimeout(() => {
            // Check if position has been stable
            const settledRect = voiceButton.getBoundingClientRect();
            const settledPosition = {
              left: settledRect.left,
              right: settledRect.right,
              bottom: settledRect.bottom
            };
            
            // Verify position matches what we recorded (button has stabilized)
            // Use tolerance to account for subpixel differences
            const tolerance = 0.5;
            const isStable = 
              Math.abs(settledPosition.left - this.lastButtonPosition.left) <= tolerance &&
              Math.abs(settledPosition.right - this.lastButtonPosition.right) <= tolerance &&
              Math.abs(settledPosition.bottom - this.lastButtonPosition.bottom) <= tolerance;
            
            if (isStable) {
              this.realignAllBubbles(voiceButton, false); // No animation - instant positioning
            }
            this.pendingRealignTimeout = null;
          }, 300); // Wait 300ms for button to settle
        } else {
          // Position is stable - increment counter
          this.positionStableCount++;
          
        }
      } catch (error) {
        // Error in position monitoring loop
      }
    }, 50); // Check every 50ms for more responsive detection
    
        // Also use ResizeObserver to detect layout changes more efficiently
        // But only observe the button itself, not document.body (to avoid false positives on page load)
        if (window.ResizeObserver) {
          let resizeDebounceTimeout;
          let resizeCount = 0;
          this.buttonResizeObserver = new ResizeObserver((entries) => {
            resizeCount++;
            const buttonRect = voiceButton.getBoundingClientRect();
            
            // Debounce rapid resize events (especially on initial page load)
            clearTimeout(resizeDebounceTimeout);
            resizeDebounceTimeout = setTimeout(() => {
              // Only realign if we have bubbles
              const hasBubbles = document.querySelectorAll('.chat-message-bubble').length > 0;
              if (hasBubbles) {
                // Realign immediately without animation when layout changes
                this.realignAllBubbles(voiceButton, false);
                // Update last known position (store actual position, not calculated)
                const updatedButtonRect = voiceButton.getBoundingClientRect();
                this.lastButtonPosition = {
                  left: updatedButtonRect.left,
                  right: updatedButtonRect.right,
                  bottom: updatedButtonRect.bottom,
                  windowWidth: window.innerWidth,
                  windowHeight: window.innerHeight,
                  documentWidth: document.documentElement.clientWidth
                };
              }
            }, 100);
          });
          
          // Only observe the button itself, not document.body
          // This prevents false positives from page load layout changes
          this.buttonResizeObserver.observe(voiceButton);
        }
  }

  stopButtonPositionMonitoring() {
    if (this.positionCheckInterval) {
      clearInterval(this.positionCheckInterval);
      this.positionCheckInterval = null;
    }
    if (this.pendingRealignTimeout) {
      clearTimeout(this.pendingRealignTimeout);
      this.pendingRealignTimeout = null;
    }
    if (this.buttonResizeObserver) {
      this.buttonResizeObserver.disconnect();
      this.buttonResizeObserver = null;
    }
    if (this.buttonResizeTimeout) {
      clearTimeout(this.buttonResizeTimeout);
    }
  }

  handleVoiceButtonClick() {
    switch (this.currentState) {
      case STATES.IDLE:
        // Start voice recognition
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
    if (!this.speechService) {
      alert('Speech service not initialized. Please reload the page.');
      return;
    }
    
    try {
      // Start speech recording FIRST (SpeechService will request mic permission)
      const result = await this.speechService.startRecording();
      
      if (!result.success) {
        this.setState(STATES.IDLE);
        if (result.error) {
          alert(result.error);
        }
        return;
      }
      
      // Get the analyser from SpeechService and share it with waveform visualizer
      // This avoids requesting microphone access twice
      const analyser = this.speechService.getAnalyser();
      if (analyser) {
        const waveformStarted = await this.waveformVisualizer.start(analyser);
        if (!waveformStarted) {
          // Waveform failed but recording continues
        }
      }
      
      // State will be updated via onStateChange callback
    } catch (error) {
      this.waveformVisualizer.stop();
      this.setState(STATES.IDLE);
      const errorMessage = error.message || error.toString() || 'Failed to start recording.';
      alert(errorMessage);
    }
  }

  stopListening() {
    if (this.speechService) {
      this.speechService.stopRecording();
    }
    if (this.waveformVisualizer) {
      this.waveformVisualizer.stop();
    }
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
        // Waveform is stopped in onStateChange callback when processing starts
        // No need to stop here
        break;
    }
    
    // Initialize new state
    // Note: 
    // - LISTENING state initialization is handled in startListening()
    // - THINKING state processing is handled in onTranscription callback
    // - No initialization needed here
  }

  updateUI() {
    const voiceButton = document.getElementById('voice-button');
    const voiceButtonText = document.getElementById('voice-button-text');
    const botIcon = document.getElementById('bot-icon');
    const waveformCanvas = document.getElementById('waveform-canvas');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    if (!voiceButton || !voiceButtonText) return;
    
    // Update button text
    voiceButtonText.textContent = STATE_TEXTS[this.currentState];
    
    // Update button classes for styling
    voiceButton.className = `voice-button state-${this.currentState}`;
    
    // Update icon visibility
    if (botIcon && waveformCanvas && loadingSpinner) {
      switch (this.currentState) {
        case STATES.IDLE:
          botIcon.style.display = 'block';
          waveformCanvas.style.display = 'none';
          loadingSpinner.style.display = 'none';
          break;
        case STATES.LISTENING:
          botIcon.style.display = 'none';
          waveformCanvas.style.display = 'block';
          loadingSpinner.style.display = 'none';
          break;
        case STATES.THINKING:
          botIcon.style.display = 'none';
          waveformCanvas.style.display = 'none';
          loadingSpinner.style.display = 'block';
          break;
        case STATES.RESPONDING:
          botIcon.style.display = 'none';
          waveformCanvas.style.display = 'none';
          loadingSpinner.style.display = 'block';
          break;
      }
    }
  }

  handleUserMessage(transcript) {
    // This method is kept for backward compatibility but is no longer used
    // SpeechService callbacks handle the flow directly
  }

  async processUserMessage() {
    // Prevent multiple simultaneous processing calls
    if (this._isProcessing) {
      return;
    }
    
    this._isProcessing = true;
    
    try {
      // Find the LAST USER message in the conversation history
      // This ensures we don't accidentally process a bot response as a user message
      let lastUserMessage = null;
      for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
        if (this.conversationHistory[i].sender === 'user') {
          lastUserMessage = this.conversationHistory[i];
          break;
        }
      }
      
      if (!lastUserMessage) {
        this.setState(STATES.IDLE);
        this._isProcessing = false;
        return;
      }
      
      // Check if we've already processed this user message
      // Look for a bot response that comes after this user message
      const userMessageIndex = this.conversationHistory.indexOf(lastUserMessage);
      const hasResponse = this.conversationHistory
        .slice(userMessageIndex + 1)
        .some(msg => msg.sender === 'bot');
      
      if (hasResponse) {
        this.setState(STATES.IDLE);
        this._isProcessing = false;
        return;
      }
      
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
    } catch (error) {
      this.setState(STATES.IDLE);
    } finally {
      this._isProcessing = false;
    }
  }

  async getAgentResponse(userMessage) {
    // TODO: Replace with actual agent API call
    // For now, return a mock response
    return `I understand you said: "${userMessage}". This is a placeholder response. Integrate your agent API here.`;
  }

  addChatMessage(text, sender) {
    // IMPORTANT: Add to conversation history IMMEDIATELY (synchronously)
    // This ensures the message is in history before processUserMessage runs
    // We'll add the element reference later in _addBubbleToPosition
    const messageEntry = { text, sender, timestamp: Date.now(), element: null };
    this.conversationHistory.push(messageEntry);
    
    // Temporarily pause position monitoring to avoid false positives during bubble addition
    // We'll resume it after the bubble is positioned
    this._positionMonitoringWasPaused = false;
    if (this.positionCheckInterval) {
      clearInterval(this.positionCheckInterval);
      this.positionCheckInterval = null;
      this._positionMonitoringWasPaused = true;
    }
    
    // Find the button to position relative to it
    const voiceButton = document.getElementById('voice-button');
    
    if (!voiceButton) {
      return;
    }
    
    // Get all existing bubbles
    const existingBubbles = Array.from(document.querySelectorAll('.chat-message-bubble'));
    const MAX_BUBBLES = 3;
    
    // Remove oldest bubbles if we exceed the limit
    // When we have MAX_BUBBLES or more, we need to remove the oldest before adding new one
    if (existingBubbles.length >= MAX_BUBBLES) {
      // Sort bubbles by bottom position (highest = oldest/furthest from button)
      // Newest bubbles are closest to button (lowest bottom value)
      existingBubbles.sort((a, b) => {
        const aBottom = parseFloat(a.style.bottom) || 0;
        const bBottom = parseFloat(b.style.bottom) || 0;
        return bBottom - aBottom; // Highest first (oldest, should be removed)
      });
      
      // Calculate how many to remove: if we have 3 and add 1, we need to remove 1
      // Keep only (MAX_BUBBLES - 1) bubbles to make room for the new one
      const bubblesToKeep = MAX_BUBBLES - 1;
      const bubblesToRemove = existingBubbles.slice(0, existingBubbles.length - bubblesToKeep);
      
      
      bubblesToRemove.forEach(bubble => {
        bubble.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        bubble.style.opacity = '0';
        bubble.style.transform = 'translateY(-10px) scale(0.95)';
        setTimeout(() => {
          if (bubble.parentNode) {
            bubble.remove();
          }
        }, 300);
      });
    }
    
    // Wait a bit for removals to complete, then get updated list
    // Pass the messageEntry so we can update the element reference
    setTimeout(() => {
      this._addBubbleToPosition(text, sender, voiceButton, messageEntry);
    }, existingBubbles.length >= MAX_BUBBLES ? 350 : 50);
  }

  _addBubbleToPosition(text, sender, voiceButton, messageEntry) {
    // Get updated list of remaining bubbles after removals
    // Filter out bubbles that are being removed (opacity 0 or about to be removed)
    const allBubbles = Array.from(document.querySelectorAll('.chat-message-bubble'));
    const remainingBubbles = allBubbles.filter(bubble => {
      const opacity = window.getComputedStyle(bubble).opacity;
      return parseFloat(opacity) > 0.5; // Exclude bubbles that are fading out
    });    // Create new floating message bubble
    const messageBubble = document.createElement('div');
    messageBubble.className = `chat-message-bubble chat-message-bubble-${sender}`;
    messageBubble.textContent = text;
    
    // Set initial styles (but don't position yet)
    messageBubble.style.position = 'fixed';
    messageBubble.style.maxWidth = '280px';
    messageBubble.style.zIndex = '2147483647';
    messageBubble.style.opacity = '0';
    messageBubble.style.visibility = 'hidden'; // Hidden but in DOM so we can measure
    messageBubble.style.transform = 'none';
    
    // Add to document body FIRST so it can affect layout
    // This is crucial - the bubble needs to be in DOM before we read button position
    document.body.appendChild(messageBubble);
    
    // Force multiple reflows to ensure layout has fully settled
    // This is important for long messages that cause text wrapping
    messageBubble.offsetHeight; // Force reflow 1
    messageBubble.offsetWidth; // Force reflow 2
    
    // NOW read button position AFTER bubble is in DOM and layout has settled
    // This ensures we get the correct button position even if layout shifted
    const buttonRect = voiceButton.getBoundingClientRect();
    const buttonBottom = window.innerHeight - buttonRect.bottom; // Distance from bottom
    const buttonRight = window.innerWidth - buttonRect.right; // Distance from right
    const buttonLeft = buttonRect.left; // Left edge of button
    
    // Calculate positions: newest at bottom (closest to button), oldest at top
    const baseBottom = buttonBottom + buttonRect.height + 12; // 12px above button top
    const bubbleGap = 16; // Gap between bubbles
    
    // Measure actual height after layout has settled
    const newBubbleHeight = messageBubble.offsetHeight || 50;    // Set alignment based on sender
    // User bubbles (black): right-aligned to button's right edge
    // Bot bubbles (white/grey): left-aligned to button's left edge
    if (sender === 'user') {
      messageBubble.style.right = `${Math.round(buttonRight)}px`;
      messageBubble.style.left = 'auto';
    } else {
      messageBubble.style.left = `${Math.round(buttonLeft)}px`;
      messageBubble.style.right = 'auto';
    }
    
    // Sort remaining bubbles by bottom position (lowest = closest to button = newest)
    remainingBubbles.sort((a, b) => {
      const aBottom = parseFloat(a.style.bottom) || Infinity;
      const bBottom = parseFloat(b.style.bottom) || Infinity;
      return aBottom - bBottom; // Lowest first (newest, closest to button)
    });    // New bubble is always at the bottom (closest to button)
    messageBubble.style.bottom = `${Math.round(baseBottom)}px`;
    messageBubble.style.visibility = 'visible';
    
    // Re-position all existing bubbles - move them up above the new bubble
    // Stack them from bottom to top: new bubble (bottom) -> existing bubbles (above)
    // No transition - instant positioning
    remainingBubbles.forEach((bubble, index) => {
      // Determine sender type from class name to maintain correct alignment
      const isUser = bubble.classList.contains('chat-message-bubble-user');
      
      // Remove any transitions for instant positioning
      bubble.style.transition = 'none';
      bubble.style.transform = 'none';
      
      // Set correct horizontal alignment
      if (isUser) {
        // User bubbles: right-aligned to button's right edge
        bubble.style.right = `${Math.round(buttonRight)}px`;
        bubble.style.left = 'auto';
      } else {
        // Bot bubbles: left-aligned to button's left edge
        bubble.style.left = `${Math.round(buttonLeft)}px`;
        bubble.style.right = 'auto';
      }
      
      // Calculate vertical position: new bubble + gap + all bubbles below this one
      let accumulatedHeight = newBubbleHeight + bubbleGap;
      
      // Add height of all bubbles that should be positioned below this one
      for (let i = 0; i < index; i++) {
        const height = remainingBubbles[i].offsetHeight || 50;
        accumulatedHeight += height + bubbleGap;
      }
      
      const newBottom = baseBottom + accumulatedHeight;
      bubble.style.bottom = `${Math.round(newBottom)}px`;
    });
    
    // Show bubble with simple fade-in (no position animation)
    messageBubble.style.transition = 'opacity 0.15s ease-out';
    messageBubble.style.opacity = '1';
    
    // No setTimeout realignment needed - everything is positioned correctly from the start!
    // Note: Scrolling is handled via CSS touch-action property, no JavaScript needed
    
    // Update the message entry in history with the element reference
    // The message was already added to history in addChatMessage, we just need to add the element
    if (messageEntry) {
      messageEntry.element = messageBubble;    } else {
      // Fallback: if messageEntry wasn't passed, add to history (shouldn't happen)      this.conversationHistory.push({ text, sender, timestamp: Date.now(), element: messageBubble });
    }
    
    
    // Resume position monitoring after a delay to allow layout to settle
    // Only if we paused it earlier
    if (this._positionMonitoringWasPaused) {
      setTimeout(() => {        const currentButton = document.getElementById('voice-button');
        if (currentButton) {
          // Wait for layout to fully settle before getting position
          // Use requestAnimationFrame to ensure we get the position after all layout is complete
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Update last known position before resuming (use actual button position, not calculated)
              const buttonRect = currentButton.getBoundingClientRect();
              const windowWidth = window.innerWidth;
              const windowHeight = window.innerHeight;
              const documentWidth = document.documentElement.clientWidth;
              
              this.lastButtonPosition = {
                left: buttonRect.left, // Store actual pixel values (not rounded)
                right: buttonRect.right,
                bottom: buttonRect.bottom,
                windowWidth: windowWidth,
                windowHeight: windowHeight,
                documentWidth: documentWidth
              };
              
              const calculatedRight = Math.round(windowWidth - buttonRect.right);
              
              // Restart monitoring loop
              this._startPositionMonitoringLoop(currentButton);
            });
          });
        }
        this._positionMonitoringWasPaused = false;
      }, 600); // Wait 600ms for layout to fully settle (including scrollbar appearance)
    }
  }

  realignAllBubbles(voiceButton, animate = false) {
    if (!voiceButton) {
      voiceButton = document.getElementById('voice-button');
      if (!voiceButton) {        return;
      }
    }
    
    // Get button position immediately (no animation frame delays)
    const buttonRect = voiceButton.getBoundingClientRect();
    const buttonBottom = window.innerHeight - buttonRect.bottom;
    const buttonRight = window.innerWidth - buttonRect.right;
    const buttonLeft = buttonRect.left;
    
    // Get all visible bubbles
    const allBubbles = Array.from(document.querySelectorAll('.chat-message-bubble'));
    const visibleBubbles = allBubbles.filter(bubble => {
      const opacity = window.getComputedStyle(bubble).opacity;
      return parseFloat(opacity) > 0.5;
    });
    
    if (visibleBubbles.length === 0) {
      // Update last known position even if no bubbles
      this.lastButtonPosition = {
        left: Math.round(buttonRect.left),
        right: Math.round(buttonRight),
        bottom: Math.round(buttonBottom)
      };
      return;
    }
    
    // Sort bubbles by bottom position (newest at bottom, closest to button)
    visibleBubbles.sort((a, b) => {
      const aBottom = parseFloat(a.style.bottom) || Infinity;
      const bBottom = parseFloat(b.style.bottom) || Infinity;
      return aBottom - bBottom; // Lower bottom value = closer to button = newer
    });
    
    const baseBottom = buttonBottom + buttonRect.height + 12;
    const bubbleGap = 16;
    
    // Realign all bubbles with correct horizontal alignment and vertical spacing
    visibleBubbles.forEach((bubble, index) => {
      const isUser = bubble.classList.contains('chat-message-bubble-user');
      
      // Remove any transform that might interfere with positioning
      bubble.style.transform = 'none';
      
      // Set transition based on animate parameter
      if (animate) {
        bubble.style.transition = 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1), right 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      } else {
        bubble.style.transition = 'none'; // Instant positioning
      }
      
      // Set correct horizontal alignment based on sender
      // Use Math.round to avoid subpixel positioning that can cause shifts
      if (isUser) {
        // User bubbles: right-aligned to button's right edge
        bubble.style.right = `${Math.round(buttonRight)}px`;
        bubble.style.left = 'auto';
      } else {
        // Bot bubbles: left-aligned to button's left edge
        bubble.style.left = `${Math.round(buttonLeft)}px`;
        bubble.style.right = 'auto';
      }
      
      // Calculate vertical position: stack from bottom up
      // Use actual measured heights (important for long messages that wrap)
      let accumulatedHeight = 0;
      for (let i = 0; i < index; i++) {
        const height = visibleBubbles[i].offsetHeight || 50;
        accumulatedHeight += height + bubbleGap;
      }
      
      const newBottom = baseBottom + accumulatedHeight;
      bubble.style.bottom = `${Math.round(newBottom)}px`;
    });
    
    // Update last known button position after realignment
    this.lastButtonPosition = {
      left: Math.round(buttonRect.left),
      right: Math.round(buttonRight),
      bottom: Math.round(buttonBottom)
    };
  }
}

// Initialize when DOM is ready or if already loaded
function initPopupController() {
  
  // Check if voice button exists and controller not already initialized
  const voiceButton = document.getElementById('voice-button');
  const widgetContainer = document.getElementById('digital-literacy-widget');  if (voiceButton && !window.popupController) {
    try {      const controller = new PopupController();
      // Make controller globally available for debugging
      window.popupController = controller;      // Set up test function in page context for easy debugging
      window.testChatBubble = function(message) {        if (controller && controller.addChatMessage) {
          controller.addChatMessage(message || 'This is a test message!', 'user');
          setTimeout(() => {
            controller.addChatMessage('I received your test message! This is a bot response.', 'bot');
          }, 1000);
        }
      };
    } catch (error) {
      // Error initializing popup controller
    }
  } else {
    if (!voiceButton) {
      // Voice button not found
    }
    if (window.popupController) {
      // Controller already exists
    }
  }
}

// Try to initialize immediately if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initPopupController();
  });
} else {
  // DOM already ready - but scripts might load after button is created
  // So we'll also check after a short delay
  initPopupController();
  // Also try after a delay in case scripts load asynchronously
  setTimeout(() => {
    initPopupController();
  }, 200);
}
