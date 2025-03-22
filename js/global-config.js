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
  
  // Set default blur amount for scenes that don't have it configured yet
  Hooks.on("ready", async () => {
    for (const scene of game.scenes) {
      if (scene.getFlag("tactical-map", "isActive") !== undefined && 
          scene.getFlag("tactical-map", "blurAmount") === undefined) {
        await scene.setFlag("tactical-map", "blurAmount", 10);
      }
    }
    
    // Import background-effects module to update any active scenes that have blur
    if (canvas.ready && canvas.scene) {
      import('./background-effects.js').then(module => {
        if (canvas.scene.getFlag("tactical-map", "isActive") && 
            !canvas.scene.getFlag("tactical-map", "image")) {
          module.updateBlurAmount(canvas.scene, canvas.scene.getFlag("tactical-map", "blurAmount") || 10);
        }
      });
    }
  });
  
  debugLog("global-config.js loaded");
});