/**
 * Text-to-Speech Service using ElevenLabs API
 * Handles converting text to speech and playing audio
 */

class TTSService {
  constructor() {
    this.isPlaying = false;
    this.currentAudio = null;
    this.apiUrl = 'http://127.0.0.1:5001/text-to-speech';
  }

  /**
   * Convert text to speech and play it
   * @param {string} text - The text to convert to speech
   * @param {Object} options - Optional settings
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    try {
      // Stop any currently playing audio
      this.stop();

      // Skip if text is empty
      if (!text || text.trim() === '') {
        console.log('[TTS] Skipping empty text');
        return;
      }

      console.log('[TTS] Converting text to speech:', text.substring(0, 50) + '...');

      // Call Flask server to get audio
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          voice_id: options.voiceId || 'afRmqWOpJ0FcqKoo6gOf' // Default: Custom voice
          // Other options:
          // 'EXAVITQu4vr4xnSDxMaL' - Rachel (calm, clear, female)
          // '21m00Tcm4TlvDq8ikWAM' - Antoni (clear, warm, male)
          // 'AZnzlk1XvdvUeBnXmlld' - Domi (warm, friendly, female)
          // 'pNInz6obpgDQGcFmaJgB' - Adam (clear, deep, male)
          // 'TX3LPaxmHKxFdv7VOQHJ' - Elli (soft, gentle, female)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TTS] Server error:', response.status, errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[TTS] Error details:', errorJson.message);
        } catch (e) {
          // Not JSON, that's fine
        }
        return;
      }

      const result = await response.json();
      
      if (result.status !== 'success' || !result.audio) {
        console.error('[TTS] Failed: No audio returned', result);
        return;
      }

      // Validate base64 string
      if (typeof result.audio !== 'string' || result.audio.length === 0) {
        console.error('[TTS] Invalid audio data received');
        return;
      }

      console.log('[TTS] Received audio data, size:', result.audio.length, 'chars');

      // Use data URL instead of blob URL to bypass CSP restrictions
      // Data URLs are inline and not blocked by Content Security Policy
      const audioDataUrl = `data:audio/mpeg;base64,${result.audio}`;
      console.log('[TTS] Created data URL, length:', audioDataUrl.length);
      
      this.currentAudio = new Audio(audioDataUrl);
      this.isPlaying = true;

      // Clean up when audio finishes
      this.currentAudio.onended = () => {
        this.isPlaying = false;
        this.currentAudio = null;
        console.log('[TTS] Audio playback completed');
      };

      // Handle audio errors
      this.currentAudio.onerror = (e) => {
        console.error('[TTS] Audio playback error:', e);
        this.isPlaying = false;
        this.currentAudio = null;
      };

      // Play the audio
      await this.currentAudio.play();
      console.log('[TTS] Audio started playing');

    } catch (error) {
      console.error('[TTS] Exception:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Stop currently playing audio
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }


  /**
   * Check if TTS is currently speaking
   * @returns {boolean}
   */
  isSpeaking() {
    return this.isPlaying;
  }
}

// Create singleton instance
const ttsService = new TTSService();

// Make it available globally
if (typeof window !== 'undefined') {
  window.ttsService = ttsService;
}

