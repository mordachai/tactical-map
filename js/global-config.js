// global-config.js

import { debugLog } from './logger-tcmap.js';

Hooks.once('init', () => {
  game.settings.register("tactical-map", "useAlternativeTokenArt", {
    name: "Use alternative token art when available",
    hint: "If enabled, tokens will automatically switch to an alternative art if a corresponding image file is found in the same directory with a suffix like _tdv for top-down view or _isv for isometric view.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Setting for enabling/disabling console debugging
  game.settings.register("tactical-map", "debugMode", {
    name: "Activate Console Debugging",
    hint: "Enable or disable detailed console logging for debugging purposes.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => {
      if (value) {
        debugLog("Console Debugging Activated.");
      } else {
        debugLog("Console Debugging Deactivated.");
      }
    }
  });
  
  debugLog("global-config.js loaded");
});
