// tactical-map.js
import { switchTokenArt } from './token-art-switcher.js';
import { debugLog } from './logger-tcmap.js';
import { isV13OrLater } from './compatibility.js';
import { toggleBackgroundBlur } from './background-effects.js';

/**
 * Stores the current canvas view position and zoom
 * @param {Scene} scene - The scene
 * @param {string} flag - Flag name to store the position under
 */
async function storeCanvasPosition(scene, flag) {
  try {
    // Store the current canvas position and zoom
    const viewPosition = {
      panX: canvas.stage.pivot.x,
      panY: canvas.stage.pivot.y,
      zoom: canvas.stage.scale.x,
      timestamp: Date.now() // Store timestamp for tracking recency
    };
    
    await scene.setFlag("tactical-map", flag, viewPosition);
    console.log(`Stored canvas position for ${flag}:`, viewPosition);
    return true;
  } catch (error) {
    console.error(`Error storing canvas position for ${flag}:`, error);
    return false;
  }
}

/**
 * Restores a saved canvas position or defaults to centering the map
 * @param {Scene} scene - The scene
 * @param {string} flag - Flag name where the position is stored
 * @param {boolean} preferCentering - Whether to prefer centering the map if no position exists
 */
async function restoreCanvasPosition(scene, flag, preferCentering = false) {
  try {
    // Get the stored position
    const storedPosition = scene.getFlag("tactical-map", flag);
    
    if (storedPosition && !preferCentering) {
      // Use stored position if it exists and we're not preferring centering
      console.log(`Restoring canvas position from ${flag}:`, storedPosition);
      canvas.pan({
        x: storedPosition.panX,
        y: storedPosition.panY,
        scale: storedPosition.zoom
      });
      return true;
    } else {
      // Center the map if no stored position or we prefer centering
      console.log(`Centering map (no stored position in ${flag} or centering preferred)`);
      centerMap(scene);
      return true;
    }
  } catch (error) {
    console.error(`Error restoring canvas position from ${flag}:`, error);
    // Fallback to centering if there's an error
    centerMap(scene);
    return false;
  }
}

/**
 * Centers the current map in view
 * @param {Scene} scene - The scene to center
 */
function centerMap(scene) {
  const width = scene.width;
  const height = scene.height;
  const viewRect = canvas.dimensions.sceneRect;
  
  // Calculate a scale that shows the whole map with some margins
  const scale = Math.min(
    viewRect.width / width, 
    viewRect.height / height
  ) * 0.9; // 90% of fitting scale for some margin
  
  // Center on the middle of the map
  canvas.pan({
    x: width / 2,
    y: height / 2,
    scale: scale
  });
}

export async function toggleTacticalMap() {
  const scene = game.scenes.active;

  if (!scene || !scene.isView) {
    return ui.notifications.warn("You can only toggle the Tactical Map on the active scene.");
  }

  // Disable the button to prevent multiple clicks
  const toggleButton = document.querySelector('[data-tool="toggleTacticalMap"]');
  if (toggleButton) toggleButton.disabled = true;
  
  try {
    const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");
    const currentMap = isTacticalMapActive ? "Tactical Map" : "Main Map";
    debugLog(`Toggling from ${currentMap} to ${isTacticalMapActive ? "Main Map" : "Tactical Map"}`);
    
    // Check if tactical map image exists before proceeding (when activating)
    if (!isTacticalMapActive) {
      const tacticalMapImage = scene.getFlag("tactical-map", "image");
      if (!tacticalMapImage) {
        // If no tactical map is configured, toggle background blur instead
        await toggleBackgroundBlur(scene);
        if (toggleButton) toggleButton.disabled = false;
        return;
      }
    }
    
    // Perform the toggle operation
    if (isTacticalMapActive) {
      // Switching from Tactical Map to Main Map
      await storeTokenPositions(scene, "tacticalTokenPositions");
      const restored = await restoreOriginalMap(scene);
      if (!restored) {
        if (toggleButton) toggleButton.disabled = false;
        return;
      }
      await restoreTokenPositions(scene, "originalTokenPositions");
      await switchTokenArt(scene, "deactivate");
    } else {
      // Switching from Main Map to Tactical Map
      await storeTokenPositions(scene, "originalTokenPositions");
      const activated = await activateTacticalMap(scene);
      if (!activated) {
        if (toggleButton) toggleButton.disabled = false;
        return;
      }
      await restoreTokenPositions(scene, "tacticalTokenPositions");
      await switchTokenArt(scene, "activate");
    }
    
    // Only show one success notification at the end
    // ui.notifications.info(`Switched to ${isTacticalMapActive ? "Main Map" : "Tactical Map"}`);
    
    // Emit hook for other modules
    Hooks.callAll("toggleTacticalMap", scene, isTacticalMapActive ? "deactivate" : "activate");
    
  } catch (error) {
    console.error("Error toggling tactical map:", error);
    ui.notifications.error("Failed to toggle map. Check console for details.");
  } finally {
    // Re-enable the button regardless of success or failure
    if (toggleButton) toggleButton.disabled = false;
  }
}

// Improved activateTacticalMap with proper error handling
async function activateTacticalMap(scene) {
  try {
    const tacticalMapImage = scene.getFlag("tactical-map", "image");
    if (!tacticalMapImage) {
      ui.notifications.warn("No Tactical Map image set for this scene.");
      return false;
    }

    // Store current position for the main map before switching
    await storeCanvasPosition(scene, "mainMapPosition");
    
    // Store original map settings
    const currentImg = scene.background?.src;
    await scene.setFlag("tactical-map", "originalSettings", {
      image: currentImg,
      width: scene.width,
      height: scene.height,
      gridType: scene.grid.type,
      gridSize: scene.grid.size
    });

    debugLog("Original settings stored");
    
    try {
      // Load image dimensions first
      const imgDimensions = await loadImagePromise(tacticalMapImage);
      
      // Update scene with new settings
      const updates = {
        "background.src": tacticalMapImage,
        width: imgDimensions.width,
        height: imgDimensions.height,
        "grid.type": scene.getFlag("tactical-map", "gridType") || 1,
        "grid.size": scene.getFlag("tactical-map", "gridSize") || 100
      };

      await scene.update(updates);
      await scene.setFlag("tactical-map", "isActive", true);
      
      // Add tokens to combat if the setting is enabled
      if (scene.getFlag("tactical-map", "addTokensToEncounter")) {
        await ensureCombatEncounter(scene);
      }
      
      // After canvas is ready, restore tactical map position or center the view
      Hooks.once("canvasReady", () => {
        const previousTacticalPosition = scene.getFlag("tactical-map", "tacticalMapPosition");
        if (previousTacticalPosition) {
          // Restore previous tactical map position if it exists
          restoreCanvasPosition(scene, "tacticalMapPosition", false);
        } else {
          // First time using this tactical map, center it
          centerMap(scene);
        }
      });
      
      return true;
    } catch (imgError) {
      console.error("Error loading tactical map image:", imgError);
      ui.notifications.error("Failed to load map image. Check file path.");
      return false;
    }
  } catch (error) {
    console.error("Error activating Tactical Map:", error);
    ui.notifications.error("Failed to activate Tactical Map.");
    return false;
  }
}

// Helper function to load image as a Promise
function loadImagePromise(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
    
    // Add a timeout to prevent hanging
    setTimeout(() => {
      if (!img.complete) {
        reject(new Error(`Image load timed out: ${src}`));
      }
    }, 10000); // 10-second timeout
  });
}

// Improved restoreOriginalMap with better error handling
async function restoreOriginalMap(scene) {
  try {
    // Store the current tactical map position before switching back
    await storeCanvasPosition(scene, "tacticalMapPosition");
    
    const originalSettings = scene.getFlag("tactical-map", "originalSettings");
    if (!originalSettings) {
      ui.notifications.warn("Original scene settings not found.");
      return false;
    }

    const updates = {
      "background.src": originalSettings.image,
      width: originalSettings.width,
      height: originalSettings.height,
      "grid.type": originalSettings.gridType,
      "grid.size": originalSettings.gridSize
    };

    await scene.update(updates);
    await scene.unsetFlag("tactical-map", "isActive");
    
    // After canvas is ready, restore original map position
    Hooks.once("canvasReady", () => {
      restoreCanvasPosition(scene, "mainMapPosition", false);
    });
    
    return true;
  } catch (error) {
    console.error("Error restoring original map:", error);
    ui.notifications.error("Failed to restore original map.");
    return false;
  }
}

// Enhanced token position storage
async function storeTokenPositions(scene, flag) {
  const tokenData = {};
  scene.tokens.contents.forEach(token => {
    tokenData[token.id] = {
      x: Math.round(token.x),   // Round to nearest pixel
      y: Math.round(token.y),   // Round to nearest pixel
      rotation: token.rotation,
      scale: token.scale || 1,  // Store scale if available
      elevation: token.elevation || 0, // Store elevation for 3D awareness
      hidden: token.hidden
    };
  });
  await scene.setFlag("tactical-map", flag, tokenData);
}

// Enhanced token position restoration
async function restoreTokenPositions(scene, flag) {
  const tokenData = scene.getFlag("tactical-map", flag);
  if (!tokenData) return;

  const currentMap = scene.getFlag("tactical-map", "isActive") ? "Tactical Map" : "Main Map";
  
  // Set up for batch operation
  const updates = [];
  
  for (let tokenId in tokenData) {
    const token = scene.tokens.get(tokenId);
    if (token) {
      // Extract stored position data
      let { x, y, rotation, scale, elevation, hidden } = tokenData[tokenId];

      // Round to nearest pixel
      x = Math.round(x);  
      y = Math.round(y);
      
      // Create update object
      const update = { 
        _id: tokenId, 
        x, 
        y, 
        rotation 
      };
      
      // Only add optional properties if they exist
      if (scale !== undefined) update.scale = scale;
      if (elevation !== undefined) update.elevation = elevation;
      if (hidden !== undefined) update.hidden = hidden;
      
      updates.push(update);
      
      debugLog(`Token ${token.name} position on ${currentMap}: x: ${x}, y: ${y}, rotation: ${rotation}, scale: ${scale}`);
    }
  }
  
  // Batch update all tokens at once if any updates exist
  if (updates.length > 0) {
    await scene.updateEmbeddedDocuments("Token", updates, { animate: false });
  }
}


/**
 * Ensures a combat encounter exists and adds tokens to it if needed
 * @param {Scene} scene - The current scene
 * @returns {Promise<boolean>} Success or failure
 */
async function ensureCombatEncounter(scene) {
  try {
    // Check if the setting is enabled
    const addTokensToEncounter = scene.getFlag("tactical-map", "addTokensToEncounter");
    if (!addTokensToEncounter) {
      console.log("Add Tokens to Encounter setting is disabled");
      return false;
    }
    
    // Get or create a combat encounter for this scene
    let combat = game.combats.find(c => c.scene?.id === scene.id);
    
    // If no combat exists for this scene, create one
    if (!combat) {
      console.log("Creating new combat encounter for scene");
      combat = await Combat.create({ scene: scene.id });
    }
    
    // Get all tokens on the scene that belong to actors
    const tokens = scene.tokens.contents.filter(t => t.actor);
    
    // Identify tokens that aren't already in the combat
    const tokensToAdd = [];
    for (const token of tokens) {
      // Skip if token is already in the combat
      const isInCombat = combat.combatants.some(c => c.tokenId === token.id);
      if (!isInCombat) {
        tokensToAdd.push({
          tokenId: token.id,
          sceneId: scene.id,
          actorId: token.actor.id,
          hidden: token.hidden
        });
      }
    }
    
    // Add tokens to combat if any need to be added
    if (tokensToAdd.length > 0) {
      console.log(`Adding ${tokensToAdd.length} tokens to combat`);
      await combat.createEmbeddedDocuments("Combatant", tokensToAdd);
      // Optional: Automatically show the combat tracker
      ui.combat.render(true);
    }
    
    return true;
  } catch (error) {
    console.error("Error setting up combat encounter:", error);
    return false;
  }
}


// Handle token creation when tactical map is active/inactive
Hooks.on("createToken", async (scene, tokenData) => {
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");

  if (isTacticalMapActive) {
    debugLog(`Adding Token ${tokenData.name} in Tactical Map at x: ${tokenData.x}, y: ${tokenData.y}`);
    await positionTokenOnInactiveMap(scene, tokenData, "originalTokenPositions");
  } else {
    await positionTokenOnInactiveMap(scene, tokenData, "tacticalTokenPositions");
  }
});

async function positionTokenOnInactiveMap(scene, tokenData, flag) {
  const tokenId = tokenData._id;
  const tokenPositions = scene.getFlag("tactical-map", flag) || {};
  const mapWidth = scene.width;
  const mapHeight = scene.height;
  const paddingPercentage = 0.05; // 5% padding

  const minX = mapWidth * paddingPercentage;
  const minY = mapHeight * paddingPercentage;
  const maxX = mapWidth * (1 - paddingPercentage);
  const maxY = mapHeight * (1 - paddingPercentage);

  let x = tokenData.x || mapWidth / 2;
  let y = tokenData.y || mapHeight / 2;

  // Adjust position to be within valid bounds
  x = Math.max(minX, Math.min(x, maxX));
  y = Math.max(minY, Math.min(y, maxY));

  // Only update the position if it's out of bounds or not set
  if (!tokenPositions[tokenId]) {
    tokenPositions[tokenId] = { 
      x, 
      y, 
      rotation: tokenData.rotation || 0,
      scale: tokenData.scale || 1,
      elevation: tokenData.elevation || 0,
      hidden: tokenData.hidden || false
    };
    await scene.setFlag("tactical-map", flag, tokenPositions);
  }
}

// Export necessary functions
export {
  activateTacticalMap,
  restoreOriginalMap,
  storeTokenPositions,
  restoreTokenPositions,
  storeCanvasPosition,
  restoreCanvasPosition,
  centerMap
};