// Only define DOMAnnotator if it doesn't already exist
if (typeof DOMAnnotator === 'undefined') {
  class DOMAnnotator {
    static createAnnotatedHtml(doc = document) {
      const interactiveElements = doc.querySelectorAll(
        'a, button, input, [role="button"], [role="link"], select, textarea, summary'
      );

      const annotated = [];
      let counter = 1;

    interactiveElements.forEach(element => {
      // Gather all possible text descriptions
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

      if (text) {
        text = text.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (!text) {
        text = `[${element.tagName.toLowerCase()}]`;
      }

      // Get additional context
      const type = element.getAttribute('type') || '';
      const role = element.getAttribute('role') || '';
      const ariaLabel = element.getAttribute('aria-label') || '';
      const placeholder = element.getAttribute('placeholder') || '';
      
      // Build description with context
      let description = text.substring(0, 100);
      const contextParts = [];
      if (placeholder && !description.includes(placeholder)) contextParts.push(placeholder);
      if (ariaLabel && !description.includes(ariaLabel)) contextParts.push(ariaLabel);
      if (type) contextParts.push(`type=${type}`);
      
      if (contextParts.length > 0) {
        description += ` (${contextParts.join(', ')})`;
      }

      const id = `id-${counter++}`;
      element.setAttribute('data-id', id);

      annotated.push({
        id: id,
        tag: element.tagName.toLowerCase(),
        text: description.substring(0, 150),
        type: type,
        role: role
      });
    });

      return annotated;
    }

    static findAndHighlight(aiResponseString, doc = document) {
      try {
        const aiResponse = JSON.parse(aiResponseString);

        if (aiResponse && aiResponse.id) {
          // Use the ID to find the *original* element
          const targetElement = doc.querySelector(`[data-id="${aiResponse.id}"]`);

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

  // Make it available globally
  if (typeof window !== 'undefined') {
    window.DOMAnnotator = DOMAnnotator;
  }
}