// js/ui-management.js
import { toggleTacticalMap } from './tactical-map.js';
import { debugLog } from './logger-tcmap.js';
import { TacticalMapBulkConfig } from './bulk-config-app.js';

// Register Scenes Directory button hook
Hooks.on("renderSceneDirectory", (app, html, data) => {
  // Convert HTMLElement to jQuery if needed
  const $html = html instanceof HTMLElement ? $(html) : html;

  // Check if button already exists
  if ($html.find(".tactical-map-bulk-config-button").length) return;

  // Create button
  const button = $(`
    <button class="tactical-map-bulk-config-button"
            title="Configure Tactical Maps for All Scenes">
      <i class="fa-solid fa-map-marked-alt"></i>
      Tactical Map Config
    </button>
  `);

  // Insert below the header buttons, above the search bar
  const headerActions = $html.find(".directory-header .header-actions");

  if (headerActions.length) {
    // Create a new row for our button below header-actions
    const buttonRow = $('<div class="tactical-map-button-row"></div>');
    buttonRow.append(button);
    headerActions.after(buttonRow);
  } else {
    // Fallback: insert at top of directory list
    $html.find(".directory-list").before('<div class="tactical-map-button-row"></div>');
    $html.find(".tactical-map-button-row").append(button);
  }

  // Click handler
  button.on("click", () => {
    new TacticalMapBulkConfig().render(true);
  });

  debugLog("Tactical Map bulk config button added to Scenes Directory");
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
