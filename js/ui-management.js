// js/ui-management.js
import { toggleTacticalMap } from './tactical-map.js';
import { debugLog } from './logger-tcmap.js';
import { TacticalMapBulkConfig } from './bulk-config-app.js';

// Register Scenes Directory button hook
Hooks.on("renderSceneDirectory", (app, html, data) => {
  // Ensure we're working with an HTML element
  const element = html instanceof HTMLElement ? html : html[0];

  // Check if button already exists
  if (element.querySelector(".tactical-map-bulk-config-button")) return;

  // Create button row
  const buttonRow = document.createElement("div");
  buttonRow.className = "tactical-map-button-row";

  // Create button
  const button = document.createElement("button");
  button.className = "tactical-map-bulk-config-button";
  button.title = "Configure Tactical Maps for All Scenes";
  button.innerHTML = `
    <i class="fa-solid fa-map-marked-alt"></i>
    Tactical Map Config
  `;

  // Click handler
  button.addEventListener("click", () => {
    new TacticalMapBulkConfig().render(true);
  });

  buttonRow.appendChild(button);

  // Try multiple insertion strategies for v13 compatibility
  const headerActions = element.querySelector(".header-actions");
  const directoryHeader = element.querySelector(".directory-header");
  const directoryList = element.querySelector(".directory-list");

  if (headerActions) {
    // Insert after header-actions
    headerActions.insertAdjacentElement("afterend", buttonRow);
    debugLog("Tactical Map bulk config button added after header-actions");
  } else if (directoryHeader) {
    // Insert after directory-header
    directoryHeader.insertAdjacentElement("afterend", buttonRow);
    debugLog("Tactical Map bulk config button added after directory-header");
  } else if (directoryList) {
    // Fallback: insert before directory-list
    directoryList.insertAdjacentElement("beforebegin", buttonRow);
    debugLog("Tactical Map bulk config button added before directory-list");
  } else {
    // Last resort: append to the root element
    element.appendChild(buttonRow);
    debugLog("Tactical Map bulk config button added to root (fallback)");
  }
});

// Register scene controls button hook
Hooks.on("getSceneControlButtons", (controls) => {
  // Only show for GMs
  if (!game.user.isGM) return;

  // In v13, controls is an object with control names as keys
  if (controls.tokens) {
    // Ensure tools object exists
    if (!controls.tokens.tools) {
      controls.tokens.tools = {};
    }

    // Add tactical map toggle button to tokens control
    controls.tokens.tools.toggleTacticalMap = {
      name: "toggleTacticalMap",
      title: "Toggle Tactical Map",
      icon: "fas fa-map-marked-alt",
      onChange: () => toggleTacticalMap(),
      toggle: true,
      visible: true
    };

    debugLog("Tactical Map toggle button added to scene controls");
  }
});
