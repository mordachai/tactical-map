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

  // Setting for blur amount when no tactical map is set
  game.settings.register("tactical-map", "blurAmount", {
    name: "Background Blur Amount",
    hint: "The amount of blur to apply to the scene background when no tactical map is set (5-30).",
    scope: "world",
    config: true,
    type: Number,
    default: 20,
    range: {
      min: 5,
      max: 30,
      step: 1
    },
    onChange: value => {
      if (canvas.scene) {
        // Import dynamically to avoid circular imports
        import('./background-effects.js').then(module => {
          module.updateBlurAmount(canvas.scene, value);
        });
      }
    }
  });
  
  debugLog("global-config.js loaded");
});
