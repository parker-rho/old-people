/**
 * Waveform Visualization Module
 * Creates audio waveform visualization using Web Audio API
 */
class WaveformVisualizer {
  constructor(canvasId) {
    // Handle both popup and content script contexts
    this.canvasId = canvasId;
    this.canvas = null;
    this.ctx = null;
    this.initCanvas();
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    this.animationFrame = null;
    this.isVisualizing = false;
    this.usingExternalAnalyser = false; // Track if we're using an external analyser
    
    this.init();
  }

  initCanvas() {
    this.canvas = document.getElementById(this.canvasId);
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    } else {
      // Retry if canvas not ready yet
      setTimeout(() => this.initCanvas(), 100);
    }
  }

  async init() {
    // Don't request microphone access immediately
    // Will be requested when user clicks the button
    this.stream = null;
    this.initialized = false;
  }

  async requestMicrophoneAccess() {
    if (this.initialized && this.stream) {
      return true;
    }

    try {
      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        throw new Error('Microphone access requires a secure context (HTTPS). Please use HTTPS or localhost.');
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Try to polyfill for older browsers
        if (navigator.getUserMedia) {
          navigator.mediaDevices = navigator.mediaDevices || {};
          navigator.mediaDevices.getUserMedia = (constraints) => {
            return new Promise((resolve, reject) => {
              navigator.getUserMedia(constraints, resolve, reject);
            });
          };
        } else {
          throw new Error('getUserMedia is not supported in this browser. Please use a modern browser like Chrome or Edge.');
        }
      }

      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      
      // Configure analyser
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      // Connect microphone to analyser
      this.microphone.connect(this.analyser);
      
      this.initialized = true;
      return true;
    } catch (error) {
      // Provide more helpful error messages
      let errorMessage = 'Microphone access is required for voice features.';
      
      // Get error name and message for better debugging
      const errorName = error?.name || 'UnknownError';
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings and try again.';
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application. Please close other applications using the microphone.';
      } else if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Microphone constraints could not be satisfied. Please try again.';
      } else if (errorName === 'SecurityError') {
        errorMessage = 'Microphone access is blocked. Please check your browser settings and ensure you are on a secure (HTTPS) page.';
      } else {
        // For unknown errors, include the actual error message
        errorMessage = `Microphone access error: ${errorMsg}`;
      }
      
      // Only show alert if we're in a context where alerts are appropriate
      if (typeof alert !== 'undefined') {
        alert(errorMessage);
      }
      
      return false;
    }
  }

  async start(externalAnalyser = null) {
    if (this.isVisualizing) return true;
    
    // If an external analyser is provided (from SpeechService), use it
    // This avoids requesting microphone access twice
    if (externalAnalyser) {
      this.analyser = externalAnalyser;
      this.usingExternalAnalyser = true; // Mark that we're using external analyser
      // Create data array for frequency data
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.initialized = true;
      this.isVisualizing = true;
      this.draw();
      return true;
    }
    
    // Otherwise, request microphone access ourselves (fallback for standalone use)
    this.usingExternalAnalyser = false;
    const hasAccess = await this.requestMicrophoneAccess();
    if (!hasAccess || !this.analyser) {
      return false; // Return false to indicate failure
    }
    
    this.isVisualizing = true;
    this.draw();
    return true; // Return true to indicate success
  }

  stop() {
    this.isVisualizing = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.clear();
  }

  draw() {
    if (!this.isVisualizing || !this.analyser || !this.ctx || !this.canvas) return;
    
    // Ensure canvas context is still valid
    if (!this.ctx) {
      this.initCanvas();
      if (!this.ctx) return;
    }

    this.animationFrame = requestAnimationFrame(() => this.draw());

    this.analyser.getByteFrequencyData(this.dataArray);

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw waveform
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = 18;
    const barCount = 32;
    const angleStep = (Math.PI * 2) / barCount;

    this.ctx.strokeStyle = '#5DA9E9';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';

    for (let i = 0; i < barCount; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const dataIndex = Math.floor((i / barCount) * this.dataArray.length);
      const dataValue = this.dataArray[dataIndex];
      const normalizedValue = dataValue / 255;
      
      // Bar length based on audio amplitude
      const barLength = radius * 0.3 + (radius * 0.7 * normalizedValue);
      
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barLength);
      const y2 = centerY + Math.sin(angle) * (radius + barLength);

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    // Optional: Draw inner glow effect
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#5DA9E9';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  clear() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  cleanup() {
    this.stop();
    
    // Only cleanup our own resources if we're not using an external analyser
    if (!this.usingExternalAnalyser) {
      if (this.microphone) {
        this.microphone.disconnect();
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      this.stream = null;
      this.analyser = null;
    } else {
      // If using external analyser, just clear our reference
      // Don't stop the stream or disconnect - that's managed by SpeechService
      this.analyser = null;
      this.usingExternalAnalyser = false;
    }
    
    this.initialized = false;
  }
}

