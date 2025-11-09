/**
 * DOM Annotator
 * Finds interactive elements on a page, annotates them with unique IDs,
 * and creates a simplified payload for AI processing. It can then use
 * the AI's response to find and act on the original DOM element.
 */
class DOMAnnotator {
  /**
   * Finds all interactive elements, annotates them with a `data-ai-id` attribute,
   * and returns a simplified list of these elements for an AI prompt.
   * @param {Document} doc - The document object to scan (e.g., `window.document`).
   * @returns {Array<Object>} A list of simplified element objects.
   */
  static createPayloadForAI(doc = document) {
    const interactiveElements = doc.querySelectorAll(
      'a, button, input, [role="button"], [role="link"], select, textarea, summary'
    );

    const payload = [];
    let counter = 1;

    interactiveElements.forEach(element => {
      // 1. Get relevant text
      let text = (
        element.innerText ||
        element.textContent ||
        element.getAttribute('title') ||
        element.getAttribute('aria-label') ||
        element.getAttribute('placeholder') ||
        element.getAttribute('alt') ||
        element.value ||
        element.name
      )?.trim();

      // If no text, create fallback for icon buttons
      if (!text) {
        text = `[${element.tagName.toLowerCase()}]`;
      }

      // 2. Create unique ID
      const id = `ai-${counter++}`;

      // 3. Annotate DOM element
      element.setAttribute('data-ai-id', id);

      // 4. Add simplified object to our payload
      payload.push({
        id: id,
        tag: element.tagName.toLowerCase(),
        text: text.substring(0, 100),
      });
    });

    return payload;
  }

  /**
   * Finds an element in the DOM based on an AI response and highlights it.
   * @param {string} aiResponseString - The raw JSON string from the AI.
   * @param {Document} doc - The document object where the element exists.
   * @returns {HTMLElement|null} The found element or null.
   */
  static findAndHighlight(aiResponseString, doc = document) {
    try {
      const aiResponse = JSON.parse(aiResponseString);

      if (aiResponse && aiResponse.id) {
        // Use the ID to find the *original* element
        const targetElement = doc.querySelector(`[data-ai-id="${aiResponse.id}"]`);

        if (targetElement) {
          console.log("Found the element:", targetElement);
          // Highlight the element
          targetElement.style.border = "3px solid red";
          targetElement.style.backgroundColor = "yellow";
          targetElement.style.color = "black"; // Ensure text is readable
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return targetElement;
        } else {
          console.error("AI returned an ID, but it was not found in the DOM:", aiResponse.id);
        }
      }
    } catch (error) {
      console.error("Failed to parse AI response:", error);
    }
    return null;
  }
}

// Export for use in other scripts if needed
if (typeof window !== 'undefined') {
  window.DOMAnnotator = DOMAnnotator;
}