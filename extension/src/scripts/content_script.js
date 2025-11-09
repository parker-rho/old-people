/**
 * Content Script - Injects popup widget into web pages as floating widget
 * This script simply loads the popup HTML/CSS/JS files into the page context
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (document.getElementById('digital-literacy-widget')) {
    return;
  }

  // Wait for body to exist
  function injectWhenReady() {
    if (!document.body) {
      setTimeout(injectWhenReady, 50);
      return;
    }

    // Create container for the floating widget - ONLY the button
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'digital-literacy-widget';

    // Inject ONLY the voice button (matches popup.html structure)
    widgetContainer.innerHTML = `
      <!-- Voice Interaction Button - Only this exists initially -->
      <button class="voice-button" id="voice-button" aria-label="Tap to ask">
        <span class="voice-button-text" id="voice-button-text">Tap to ask</span>
        <div class="bot-icon-container" id="bot-icon-container">
          <svg class="bot-icon" id="bot-icon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <!-- Bot face (shown in IDLE state) -->
            <circle class="bot-face" cx="20" cy="20" r="18" fill="#5DA9E9" stroke="#4A8BC5" stroke-width="2"/>
            <circle class="bot-eye bot-eye-left" cx="14" cy="18" r="2" fill="#000"/>
            <circle class="bot-eye bot-eye-right" cx="26" cy="18" r="2" fill="#000"/>
            <path class="bot-mouth" d="M 14 24 Q 20 28 26 24" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round"/>
            <circle class="bot-antenna" cx="20" cy="6" r="3" fill="#5DA9E9" stroke="#4A8BC5" stroke-width="1"/>
          </svg>
          
          <!-- Waveform Canvas (shown in LISTENING state) -->
          <canvas class="waveform-canvas" id="waveform-canvas" width="40" height="40"></canvas>
          
          <!-- Loading Spinner (shown in THINKING state) -->
          <svg class="loading-spinner" id="loading-spinner" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display: none;">
            <circle cx="20" cy="20" r="18" fill="none" stroke="#5DA9E9" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="28">
              <animate attributeName="stroke-dasharray" dur="1.5s" values="0,113;56.5,56.5;0,113;0,113" repeatCount="indefinite"/>
              <animate attributeName="stroke-dashoffset" dur="1.5s" values="0;-56.5;-113;-113" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
      </button>
    `;

    // Inject popup CSS
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('src/popup/popup.css');
    document.head.appendChild(styleLink);

    // Inject widget into page
    document.body.appendChild(widgetContainer);

    // Load popup scripts into page context (must be in page context for getUserMedia to work)
    // We need to inject scripts that run in page context, not content script context
    // Note: speech-service.js needs chrome APIs, so we need to load it in content script context
    // and bridge the communication, OR load it in page context but bridge chrome API calls
    // For now, we'll load it in content script context and inject a bridge
    const scripts = [
      chrome.runtime.getURL('src/scripts/speech-service.js'),
      chrome.runtime.getURL('src/popup/waveform.js'),
      chrome.runtime.getURL('src/popup/popup.js')
    ];

    // Function to load a script in page context using a message event
    // This avoids CSP violations from inline scripts
    function injectScriptIntoPage(src) {
      return new Promise((resolve, reject) => {
        // Check if script already loaded
        if (document.querySelector(`script[data-extension-script="${src}"]`)) {
          resolve();
          return;
        }

        // Create script element with src (not inline) to avoid CSP violation
        const script = document.createElement('script');
        script.src = src;
        script.setAttribute('data-extension-script', src);
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

        // Append to page (runs in page context, not content script context)
        (document.head || document.documentElement).appendChild(script);
      });
    }

    // Load scripts sequentially to ensure proper order
    async function loadScripts() {
      try {
        for (const src of scripts) {
          await injectScriptIntoPage(src);
        }
        // popup.js will auto-initialize when it loads
        // It has its own DOMContentLoaded listener that checks for voice-button

        // Note: Test function will be set up by popup.js in page context
        // Users can also call: window.popupController.addChatMessage("test", "user")
      } catch (error) {
      }
    }

    // Load scripts when DOM is ready
    // Note: Scripts run in page context, so they'll have access to the button we just created
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadScripts);
    } else {
      loadScripts();
    }
  }

  injectWhenReady();

})();
