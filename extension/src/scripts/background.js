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
