// logger-tcmap.js

export function debugLog(...args) {
    if (game && game.settings) {
      const debugMode = game.settings.get("tactical-map", "debugMode");
      if (debugMode) {
        console.log(...args);
      }
    } else {
      console.warn("debugLog called before game is ready.", ...args);
    }
  }
  