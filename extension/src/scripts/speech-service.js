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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioChunks = [];
      this.isRecording = true;
      this.updateState('recording', 'Listening...');

      // Setup audio context for silence detection
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      // Setup media recorder
      this.mediaRecorder = new MediaRecorder(stream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (this.audioContext) {
          this.audioContext.close();
        }
        
        if (this.audioChunks.length > 0) {
          await this.processAudio();
        }
      };

      this.mediaRecorder.start();
      
      // Start silence detection
      this.detectSilence();

      return { success: true };
    } catch (error) {
      console.error('Error starting recording:', error);
      this.updateState('error', error.message);
      return { success: false, error: error.message };
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
            console.log('Silence detected, auto-stopping...');
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

      // Get API key from storage
      const { apiKey } = await chrome.storage.local.get('apiKey');
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set it in Options.');
      }

      // Convert to WAV format for better compatibility
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

      // Send to Whisper API
      const transcription = await this.transcribeAudio(audioFile, apiKey);
      
      // Store transcription
      await this.storeTranscription(transcription);
      
      this.updateState('completed', transcription.text);
      
      if (this.onTranscriptionCallback) {
        this.onTranscriptionCallback(transcription);
      }

      fetch("http://127.0.0.1:5000/parse", {
        method: "POST"
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          console.log("✅ Instructions created successfully!");
        } else {
          console.error("❌ Python reported failure:", data.message);
        }
      });

      return transcription;
    } catch (error) {
      console.error('Error processing audio:', error);
      this.updateState('error', error.message);
      throw error;
    }
  }

  /**
   * Send audio to Whisper API
   */
  async transcribeAudio(audioFile, apiKey) {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Transcription failed');
    }

    const result = await response.json();
    return {
      text: result.text
    };
  }

  /**
   * Store transcription in Chrome storage
   */
  async storeTranscription(transcription) {
    // Get existing transcriptions
    const { transcriptions = [] } = await chrome.storage.local.get('transcriptions');
    
    // Add just the text to array
    transcriptions.push(transcription.text);
    
    // Save back to storage (keeps entire conversation history)
    await chrome.storage.local.set({ 
      transcriptions: transcriptions,
      lastTranscription: transcription.text
    });
  }

  /**
   * Update state and notify listeners
   */
  updateState(state, message = null) {
    const stateData = { state, message, timestamp: Date.now() };
    
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(stateData);
    }

    // Broadcast state change to all extension components
    chrome.runtime.sendMessage({
      type: 'SPEECH_STATE_CHANGE',
      payload: stateData
    }).catch(() => {
      // Ignore errors if no listeners
    });
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
