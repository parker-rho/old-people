'use strict';

let enabled = true;

chrome.storage.local.get(['enabled'], (data) => {
  if (Object.hasOwn(data, 'enabled')) {
    enabled = data.enabled;
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (Object.hasOwn(changes, 'enabled')) {
    enabled = changes.enabled.newValue;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
});

// Handling PROCESS_USER_MESSAGE after transcription is complete
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_USER_MESSAGE') {
    (async () => {
      try {
        const transcription = request.payload.text;

        const annotatedHtml = await getAnnotatedHtml(sender.tab.id);
        const annotatedHtmlString = JSON.stringify(annotatedHtml, null, 2);

        // Take transcription and annotated HTML, and call the agent
        const agentResponses = await getAgentResponses(transcription, annotatedHtmlString);
        sendResponse({ status: 'success', payload: agentResponses });
      } catch (error) {
        sendResponse({ status: 'error', payload: error.message });
      }
    })();
    return true;
  }
});

async function getAnnotatedHtml(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['src/scripts/annotator.js'],
  });

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      return DOMAnnotator.createAnnotatedHtml(document);
    },
  });

  if (results && results[0] && results[0].result) {
    return results[0].result;
  } else {
    throw new Error("Failed to get annotated payload from the page.");
  }
}

async function getAgentResponses(transcription, annotatedHtml) {
  alert(JSON.stringify({ message: transcription, context: annotatedHtml }))

  const response = await fetch("http://127.0.0.1:5000/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: transcription, context: annotatedHtml }),
  });


  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Agent API request failed with no error details.' }));
    throw new Error(errorData.message || `Agent API request failed with status: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "success") {
    throw new Error(data.message || "Agent API returned a failure status.");
  }

  return data.result;
}
