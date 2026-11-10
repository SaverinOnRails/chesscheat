// Chesscheat bridge script.
//
// scripts/main.js runs in the page's main world so it can use chess.com's board
// object, but a main-world script has no chrome.runtime and therefore no way to find
// out this extension's own URL. This script runs in the ordinary isolated world at
// document_start and writes the base URL of the bundled engine files (engine/*, listed
// under web_accessible_resources) onto <html>, where main.js reads it when the engine
// is started. Nothing else crosses between the two worlds.
(() => {
  'use strict';

  const ATTRIBUTE = 'data-chesscheat-engine-base'; // read by scripts/main.js
  const runtime =
    (typeof browser !== 'undefined' && browser.runtime) ||
    (typeof chrome !== 'undefined' && chrome.runtime) ||
    null;
  const root = document.documentElement;
  if (!runtime || typeof runtime.getURL !== 'function' || !root) return;
  root.setAttribute(ATTRIBUTE, runtime.getURL('engine/'));
})();
