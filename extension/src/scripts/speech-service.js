/**
 * Speech-to-Text Service using OpenAI Whisper API
 * Handles audio recording with automatic silence detection (Siri-style)
 */

class SpeechService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.silenceTimer = null;
    this.audioContext = null;
    this.analyser = null;
    this.silenceThreshold = 0.01; // Adjust based on testing
    this.silenceDuration = 2000; // 2 seconds of silence to auto-stop
    this.isRecording = false;
    this.onTranscriptionCallback = null;
    this.onStateChangeCallback = null;
  }

  /**
   * Start recording audio with silence detection
   */
  async startRecording() {
    // Prevent multiple simultaneous recordings
    if (this.isRecording) {
      return { success: false, error: 'Recording already in progress' };
    }

    try {
      // Request microphone access (or reuse existing stream)
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
      
      this.audioChunks = [];
      this.isRecording = true;
      this.updateState('recording', 'Listening...');

      // Setup audio context for silence detection
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      // Create source and analyser (create new analyser each time for clean state)
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256; // Match waveform visualizer for consistency
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
      
      // Store source reference for cleanup (though we recreate it each time)
      this.audioSource = source;

      // Setup media recorder
      this.mediaRecorder = new MediaRecorder(this.stream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Don't stop stream tracks here - let them be managed separately
        // The stream is shared with waveform visualizer
        // Only process audio if we have chunks
        if (this.audioChunks.length > 0) {
          await this.processAudio();
        }
      };

      this.mediaRecorder.start();
      
      // Start silence detection
      this.detectSilence();

      return { success: true };
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      this.updateState('error', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Detect silence and auto-stop recording (Siri-style)
   */
  detectSilence() {
    if (!this.isRecording || !this.analyser) return;

    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkVolume = () => {
      if (!this.isRecording) return;

      this.analyser.getByteTimeDomainData(dataArray);
      
      // Calculate average volume (RMS)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);

      // Check if volume is below silence threshold
      if (rms < this.silenceThreshold) {
        if (!this.silenceTimer) {
          // Start silence timer
          this.silenceTimer = setTimeout(() => {
            this.stopRecording();
          }, this.silenceDuration);
        }
      } else {
        // Cancel silence timer if sound detected
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      }

      // Continue checking
      requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  /**
   * Manually stop recording
   */
  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Get the audio stream (for sharing with waveform visualizer)
   */
  getStream() {
    return this.stream;
  }

  /**
   * Get the analyser node (for sharing with waveform visualizer)
   */
  getAnalyser() {
    return this.analyser;
  }

  /**
   * Process recorded audio and send to Whisper API
   */
  async processAudio() {
    this.updateState('processing', 'Processing your speech...');

    try {
      // Create audio blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      
      // Check if audio is too short
      if (audioBlob.size < 1000) {
        throw new Error('Recording too short. Please speak longer.');
      }

      // Convert to File format
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

      // Send to Flask server (which proxies to Whisper API)
      const transcription = await this.transcribeAudio(audioFile);
      
      // Store transcription
      await this.storeTranscription(transcription);
      
      this.updateState('completed', transcription.text);
      
      if (this.onTranscriptionCallback) {
        this.onTranscriptionCallback(transcription);
      }

      fetch("http://127.0.0.1:5000/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: transcription.text })
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          console.log("✅ Instructions created successfully!");
        } else {
          console.error("❌ Python reported failure:", data.message);
        }
      })
      .catch(err => console.error("🌐 Could not reach server:", err));

      return transcription;
    } catch (error) {
      this.updateState('error', error.message);
      throw error;
    }
  }

  /**
   * Send audio to Flask server (which proxies to Whisper API)
   * API key is kept secure on the server side
   */
  async transcribeAudio(audioFile) {
    const formData = new FormData();
    formData.append('file', audioFile);

    const response = await fetch('http://127.0.0.1:5000/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Transcription failed');
    }

    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(result.message || 'Transcription failed');
    }

    return {
      text: result.text
    };
  }

  /**
   * Store transcription in Chrome storage
   */
  async storeTranscription(transcription) {
    // Only store if chrome.storage is available (not in page context)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        // Get existing transcriptions
        const { transcriptions = [] } = await chrome.storage.local.get('transcriptions');
        
        // Add just the text to array
        transcriptions.push(transcription.text);
        
        // Save back to storage (keeps entire conversation history)
        await chrome.storage.local.set({ 
          transcriptions: transcriptions,
          lastTranscription: transcription.text
        });
      } catch (error) {
        // Continue even if storage fails
      }
    }
  }

  /**
   * Update state and notify listeners
   */
  updateState(state, message = null) {
    const stateData = { state, message, timestamp: Date.now() };
    
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(stateData);
    }

    // Broadcast state change to all extension components (only if chrome.runtime is available)
    // Note: chrome.runtime is not available in page context, only in extension contexts
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SPEECH_STATE_CHANGE',
        payload: stateData
      }).catch(() => {
        // Ignore errors if no listeners
      });
    }
  }

  /**
   * Set callback for transcription completion
   */
  onTranscription(callback) {
    this.onTranscriptionCallback = callback;
  }

  /**
   * Set callback for state changes
   */
  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }
}

// Export singleton instance
const speechService = new SpeechService();
