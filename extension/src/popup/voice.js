/**
 * Voice Recognition Module
 * Handles speech recognition using Web Speech API
 */
class VoiceRecognition {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onStartCallback = null;
    this.onEndCallback = null;
    
    this.init();
  }

  init() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = false;
    this.recognition.interimResults = true; // Enable interim results to see partial transcripts
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStartCallback) this.onStartCallback();
    };

    this.recognition.onresult = (event) => {
      if (event.results.length === 0) {
        return;
      }
      
      // Get the last result (most recent)
      const lastResultIndex = event.results.length - 1;
      const result = event.results[lastResultIndex];
      if (!result || result.length === 0) {
        return;
      }
      
      const transcript = result[0].transcript;
      // Only process final results (not interim)
      if (result.isFinal && transcript && transcript.trim() !== '') {
        if (this.onResultCallback) {
          this.onResultCallback(transcript);
        } else {
          }
      } else {
        }
    };

    this.recognition.onerror = (event) => {
      if (this.onErrorCallback) {
        this.onErrorCallback(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onEndCallback) this.onEndCallback();
    };
  }

  start() {
    if (!this.recognition) {
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      // Already started or other error
      }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  onResult(callback) {
    this.onResultCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }

  onStart(callback) {
    this.onStartCallback = callback;
  }

  onEnd(callback) {
    this.onEndCallback = callback;
  }

  isAvailable() {
    return this.recognition !== null;
  }
}

