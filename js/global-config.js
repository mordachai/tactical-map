// global-config.js

import { debugLog } from './logger-tcmap.js';


Hooks.once('init', () => {
  // Register position settings FIRST before any other code
  const positionFlags = ["mainMapPosition", "tacticalMapPosition", "lastGoodPosition"];
  
  // Register main settings
  for (const baseFlag of positionFlags) {
    game.settings.register("tactical-map", baseFlag, {
      name: `${baseFlag} Storage`,
      hint: "System use only - stores canvas positions",
      scope: "world",
      config: false,
      type: Object,
      default: {}
    });
  }
  
  // Add a function to handle dynamically creating scene-specific settings
  game.tacticalMap = game.tacticalMap || {};
  game.tacticalMap.registerSceneSetting = (baseFlag, sceneId) => {
    const key = `${baseFlag}_${sceneId}`;
    if (!game.settings.settings.get(`tactical-map.${key}`)) {
      try {
        game.settings.register("tactical-map", key, {
          name: `${baseFlag} for Scene ${sceneId}`,
          scope: "world",
          config: false,
          type: Object,
          default: {}
        });
        return true;
      } catch (error) {
        console.warn(`Could not register setting: ${key}`, error);
        return false;
      }
    }
    return true; // Already registered
  };
  
  // Register other existing settings
  game.settings.register("tactical-map", "useAlternativeTokenArt", {
    name: "Use alternative token art when available",
    hint: "If enabled, tokens will automatically switch to an alternative art if a corresponding image file is found in the same directory with a suffix like _tdv for top-down view or _isv for isometric view.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
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