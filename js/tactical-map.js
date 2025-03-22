// tactical-map.js
import { switchTokenArt } from './token-art-switcher.js';
import { debugLog } from './logger-tcmap.js';
import { isV13OrLater } from './compatibility.js';
import { toggleBackgroundBlur, forceApplyBlur, forceRemoveBlur } from './background-effects.js';


// Revised canvas position management functions for tactical-map.js

/**
 * Get scene-specific position key
 * @param {Scene} scene - The scene
 * @param {string} baseFlag - Base flag name (mainMapPosition or tacticalMapPosition)
 * @returns {string} Scene-specific flag key
 */
function getScenePositionKey(scene, baseFlag) {
  return `${baseFlag}_${scene.id}`;
}

/**
 * Ensures a scene-specific setting is registered
 * @param {Scene} scene - The scene
 * @param {string} baseFlag - Base flag name (mainMapPosition or tacticalMapPosition)
 */
function ensureSceneSettingExists(scene, baseFlag) {
  if (!game.tacticalMap) return false;
  return game.tacticalMap.registerSceneSetting(baseFlag, scene.id);
}

async function storeCanvasPosition(scene, baseFlag, forceUpdate = false) {
  try {
    // Simple position data that captures the essentials
    const positionData = {
      panX: canvas.stage.pivot.x,
      panY: canvas.stage.pivot.y,
      zoom: canvas.stage.scale.x,
      timestamp: Date.now(),
      // Store relative coordinates as backup
      relX: canvas.stage.pivot.x / scene.width,
      relY: canvas.stage.pivot.y / scene.height
    };
    
    debugLog(`Storing position for ${baseFlag}:`, {
      x: positionData.panX.toFixed(2),
      y: positionData.panY.toFixed(2),
      zoom: positionData.zoom.toFixed(2)
    });
    
    // Try to use scene flags directly for simplicity
    await scene.setFlag("tactical-map", baseFlag, positionData);
    
    return true;
  } catch (error) {
    console.error(`Error storing canvas position for ${baseFlag}:`, error);
    return false;
  }
}

// Simple position getter with debug output
function getStoredPosition(scene, baseFlag) {
  try {
    const position = getStoredPosition(scene, baseFlag);
    if (position) {
      debugLog(`Got position for ${baseFlag}:`, {
        x: position.panX.toFixed(2),
        y: position.panY.toFixed(2),
        zoom: position.zoom.toFixed(2)
      });
    } else {
      debugLog(`No stored position for ${baseFlag}`);
    }
    return position;
  } catch (error) {
    console.error(`Error getting position for ${baseFlag}:`, error);
    return null;
  }
}

/**
 * Restores a saved canvas position for a specific scene
 * @param {Scene} scene - The scene
 * @param {string} baseFlag - Base flag name (mainMapPosition or tacticalMapPosition)
 * @param {boolean} preferCentering - Whether to prefer centering the map if no position exists
 */
async function restoreCanvasPosition(scene, baseFlag, preferCentering = false) {
  try {
    // Try settings first
    const useSceneFlags = !ensureSceneSettingExists(scene, baseFlag);
    let storedPosition;
    
    if (useSceneFlags) {
      // Get from scene flags as fallback
      storedPosition = getStoredPosition(scene, baseFlag);
      debugLog(`Retrieved position from scene flag: ${baseFlag}`);
    } else {
      // Get from settings (preferred method)
      const flagKey = getScenePositionKey(scene, baseFlag);
      storedPosition = game.settings.get("tactical-map", flagKey);
      debugLog(`Retrieved position from setting: ${flagKey}`);
    }
    
    if (storedPosition && !preferCentering) {
      // Use stored position if it exists and we're not preferring centering
      const targetX = storedPosition.panX || (storedPosition.relX * scene.width);
      const targetY = storedPosition.panY || (storedPosition.relY * scene.height);
      
      // For zoom, prioritize the absolute zoom value if available
      let targetZoom;
      if (typeof storedPosition.zoom === 'number') {
        targetZoom = storedPosition.zoom;
      } else if (typeof storedPosition.zoomAbsolute === 'number') {
        targetZoom = storedPosition.zoomAbsolute;
      } else if (typeof storedPosition.relX === 'number') {
        // Calculate zoom from relative positions as last resort
        // Default to a reasonable zoom based on scene size
        const sceneRatio = scene.width / scene.height;
        const viewportRatio = canvas.screenWidth / canvas.screenHeight;
        
        if (sceneRatio > viewportRatio) {
          // Scene is wider relative to viewport
          targetZoom = canvas.screenWidth / scene.width * 0.9;
        } else {
          // Scene is taller relative to viewport
          targetZoom = canvas.screenHeight / scene.height * 0.9;
        }
      } else {
        // Complete fallback if nothing else works
        targetZoom = 1;
      }
      
      debugLog(`Restoring to x:${targetX}, y:${targetY}, zoom:${targetZoom}`);
      
      // Use direct pan to ensure all properties are applied correctly
      // Avoid animation to ensure the exact values are set
      canvas.pan({
        x: targetX,
        y: targetY,
        scale: targetZoom
      });
      
      return true;
    }
  } catch (error) {
    console.error(`Error restoring canvas position from ${baseFlag}:`, error);
    
    // Try to use scene flag as fallback
    try {
      const flagPosition = getStoredPosition(scene, baseFlag);
      if (flagPosition) {
        canvas.pan({
          x: flagPosition.panX,
          y: flagPosition.panY,
          scale: flagPosition.zoom
        });
        return true;
      }
    } catch (flagError) {
      console.error("Failed to restore position from scene flag:", flagError);
    }
    
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
  
  // Get the viewport dimensions
  const viewportWidth = canvas.dimensions.width;
  const viewportHeight = canvas.dimensions.height;
  
  // Calculate appropriate scale based on scene and viewport dimensions
  const sceneRatio = width / height;
  const viewportRatio = viewportWidth / viewportHeight;
  
  let scale;
  if (sceneRatio > viewportRatio) {
    // Scene is wider relative to viewport - fit to width
    scale = viewportWidth / width * 0.9;
  } else {
    // Scene is taller relative to viewport - fit to height
    scale = viewportHeight / height * 0.9;
  }
  
  // Ensure we don't zoom in too far for very small maps
  scale = Math.min(scale, 1.0);
  
  // Center and apply with smooth animation
  canvas.animatePan({
    x: width / 2,
    y: height / 2,
    scale: scale,
    duration: 500
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
    
    // Important: Store current view position BEFORE any other changes
    // Store with forceUpdate=true to ensure we capture the exact current view
    await storeCanvasPosition(scene, isTacticalMapActive ? "tacticalMapPosition" : "mainMapPosition", true);
    debugLog(`Stored current ${currentMap} position before toggle`);
    
    // Check for tactical map image
    const tacticalMapImage = scene.getFlag("tactical-map", "image");
    const tacticalGridType = scene.getFlag("tactical-map", "gridType") || 1;
    
    // If no tactical map is configured
    if (!tacticalMapImage) {
      if (isTacticalMapActive) {
        // Deactivating - restore original grid and turn off blur
        debugLog("Deactivating tactical map with no image - restoring original settings");
        
        // Store token positions before changing anything
        await storeTokenPositions(scene, "tacticalTokenPositions");
        
        // Get original settings
        const originalSettings = scene.getFlag("tactical-map", "originalSettings");
        
        // Make sure we have the original grid type and restore it
        if (originalSettings && originalSettings.gridType !== undefined) {
          debugLog(`Restoring original grid type: ${originalSettings.gridType}`);
          
          // Update only the grid type
          await scene.update({
            "grid.type": originalSettings.gridType
          });
        } else {
          console.error("Original grid type not found in settings!");
        }
        
        // Set flag that tactical map is inactive BEFORE turning off blur
        await scene.unsetFlag("tactical-map", "isActive");
        
        // Restore tokens
        await restoreTokenPositions(scene, "originalTokenPositions");
        
        // Manually remove blur filter
        await forceRemoveBlur(scene);
        
        // Restore the main map view position AFTER all other changes
        await restoreCanvasPosition(scene, "mainMapPosition", false);
      } else {
        // Activating without image - store positions, update grid type and add blur
        debugLog("Activating tactical map with no image - applying grid type and blur");
        
        // Store the original grid type BEFORE changing it
        const originalGridType = scene.grid.type;
        debugLog(`Storing original grid type: ${originalGridType}`);
        
        await scene.setFlag("tactical-map", "originalSettings", {
          gridType: originalGridType
        });
        
        await storeTokenPositions(scene, "originalTokenPositions");
        
        // Update just the grid type
        await scene.update({
          "grid.type": tacticalGridType
        });
        
        // Set flag that tactical map is active BEFORE adding blur
        await scene.setFlag("tactical-map", "isActive", true);
        
        // Restore tokens
        await restoreTokenPositions(scene, "tacticalTokenPositions");
        
        // Manually apply blur
        await forceApplyBlur(scene);
        
        // Add tokens to combat if enabled
        if (scene.getFlag("tactical-map", "addTokensToEncounter")) {
          await ensureCombatEncounter(scene);
        }
        
        // Restore tactical map position AFTER all other changes
        // Only if a position has been saved previously
        const hasSavedPosition = scene.getFlag("tactical-map", "tacticalMapPosition");
        if (hasSavedPosition) {
          await restoreCanvasPosition(scene, "tacticalMapPosition", false);
        }
      }
    } else {
      // Normal flow with tactical map image
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
    }
    
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
      gridSize: scene.grid.size,
      gridColor: scene.grid.color,
      gridAlpha: scene.grid.alpha,
      gridStyle: scene.grid.style,
      gridThickness: scene.grid.thickness
    });

    debugLog("Original settings stored");
    
    try {
      // Load image dimensions first
      const imgDimensions = await loadImagePromise(tacticalMapImage);
      
      // Get tactical map grid settings
      const gridType = scene.getFlag("tactical-map", "gridType") || 1;
      const gridSize = scene.getFlag("tactical-map", "gridSize") || 100;
      
      // Get grid styling settings if they exist
      const gridColor = scene.getFlag("tactical-map", "gridColor");
      const gridAlpha = scene.getFlag("tactical-map", "gridAlpha");
      const gridStyle = scene.getFlag("tactical-map", "gridStyle");
      const gridThickness = scene.getFlag("tactical-map", "gridThickness");
      
      // Prepare updates object
      const updates = {
        "background.src": tacticalMapImage,
        width: imgDimensions.width,
        height: imgDimensions.height,
        "grid.type": gridType,
        "grid.size": gridSize
      };
      
      // Add optional grid styling if they exist
      if (gridColor) updates["grid.color"] = gridColor;
      if (gridAlpha !== undefined) updates["grid.alpha"] = gridAlpha;
      if (gridStyle) updates["grid.style"] = gridStyle;
      if (gridThickness !== undefined) updates["grid.thickness"] = gridThickness;
      
      // Save scale settings if they exist
      const gridScale = scene.getFlag("tactical-map", "gridScale");
      if (gridScale) {
        if (gridScale.distance) updates["grid.distance"] = gridScale.distance;
        if (gridScale.units) updates["grid.units"] = gridScale.units;
      }

      await scene.update(updates);
      await scene.setFlag("tactical-map", "isActive", true);
      
      // Add tokens to combat if the setting is enabled
      if (scene.getFlag("tactical-map", "addTokensToEncounter")) {
        await ensureCombatEncounter(scene);
      }
      
      Hooks.once("canvasReady", () => {
        try {
          // Try both setting and flag to ensure we can find the position
          let previousPosition = null;
          
          // First try setting
          if (game.tacticalMap && game.tacticalMap.registerSceneSetting) {
            game.tacticalMap.registerSceneSetting("tacticalMapPosition", scene.id);
            const settingKey = `tacticalMapPosition_${scene.id}`;
            previousPosition = game.settings.get("tactical-map", settingKey);
          }
          
          // If not found in setting, try scene flag
          if (!previousPosition) {
            previousPosition = scene.getFlag("tactical-map", "tacticalMapPosition");
          }
          
          if (previousPosition) {
            // Restore previous tactical map position if it exists
            debugLog("Restoring previous tactical map position", previousPosition);
            
            const targetX = previousPosition.panX || (previousPosition.relX * scene.width);
            const targetY = previousPosition.panY || (previousPosition.relY * scene.height);
            
            // Get the zoom value - prioritize absolute zoom
            let targetZoom;
            if (typeof previousPosition.zoom === 'number') {
              targetZoom = previousPosition.zoom;
            } else if (typeof previousPosition.zoomAbsolute === 'number') {
              targetZoom = previousPosition.zoomAbsolute;
            } else {
              targetZoom = 1; // Fallback
            }
            
            debugLog(`Applying position x:${targetX}, y:${targetY}, zoom:${targetZoom}`);
            
            // Use direct pan with no animation for exact positioning
            canvas.pan({
              x: targetX,
              y: targetY,
              scale: targetZoom
            });
          } else {
            // First time using this tactical map, center it
            debugLog("No previous tactical map position found - centering");
            centerMap(scene);
          }
        } catch (error) {
          console.error("Error in canvasReady hook:", error);
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
      "grid.size": originalSettings.gridSize,
      "grid.color": originalSettings.gridColor,
      "grid.alpha": originalSettings.gridAlpha,
      "grid.style": originalSettings.gridStyle,
      "grid.thickness": originalSettings.gridThickness
    };

    await scene.update(updates);
    await scene.unsetFlag("tactical-map", "isActive");
    
    // After canvas is ready, restore original map position
    Hooks.once("canvasReady", () => {
      try {
        // Try both setting and flag to ensure we can find the position
        let previousPosition = null;
        
        // First try setting
        if (game.tacticalMap && game.tacticalMap.registerSceneSetting) {
          game.tacticalMap.registerSceneSetting("mainMapPosition", scene.id);
          const settingKey = `mainMapPosition_${scene.id}`;
          previousPosition = game.settings.get("tactical-map", settingKey);
        }
        
        // If not found in setting, try scene flag
        if (!previousPosition) {
          previousPosition = scene.getFlag("tactical-map", "mainMapPosition");
        }
        
        if (previousPosition) {
          // Restore previous main map position if it exists
          debugLog("Restoring previous main map position", previousPosition);
          
          const targetX = previousPosition.panX || (previousPosition.relX * scene.width);
          const targetY = previousPosition.panY || (previousPosition.relY * scene.height);
          
          // Get the zoom value - prioritize absolute zoom
          let targetZoom;
          if (typeof previousPosition.zoom === 'number') {
            targetZoom = previousPosition.zoom;
          } else if (typeof previousPosition.zoomAbsolute === 'number') {
            targetZoom = previousPosition.zoomAbsolute;
          } else {
            targetZoom = 1; // Fallback
          }
          
          debugLog(`Applying position x:${targetX}, y:${targetY}, zoom:${targetZoom}`);
          
          // Use direct pan with no animation for exact positioning
          canvas.pan({
            x: targetX,
            y: targetY,
            scale: targetZoom
          });
        } else {
          // First time restoring this scene, center it
          debugLog("No previous main map position found - centering");
          centerMap(scene);
        }
      } catch (error) {
        console.error("Error in canvasReady hook:", error);
        centerMap(scene);
      }
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

// Save positions when canvas becomes ready
Hooks.on("canvasReady", (canvas) => {
  const scene = canvas.scene;
  if (!scene) return;
  
  // Check if we're tracking this scene
  if (scene.getFlag("tactical-map", "isActive") !== undefined) {
    const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");
    
    // Store position for the current view
    const positionFlag = isTacticalMapActive ? "tacticalMapPosition" : "mainMapPosition";
    debugLog(`Scene ${scene.name} ready, storing current position as ${positionFlag}`);
    
    // Wait a moment for canvas to fully initialize
    setTimeout(() => {
      storeCanvasPosition(scene, positionFlag, true);
    }, 500);
  }
});

// Add debugging tools
Hooks.once("ready", () => {
  // Register debug console command
  if (game.settings.get("tactical-map", "debugMode")) {
    console.log("Registering tactical-map position debug commands");
    
    game.tacticalMap = game.tacticalMap || {};
    game.tacticalMap.logPositions = () => {
      const scene = game.scenes.active;
      if (!scene) {
        console.log("No active scene");
        return;
      }
      
      const flagKeyMain = getScenePositionKey(scene, "mainMapPosition");
      const flagKeyTactical = getScenePositionKey(scene, "tacticalMapPosition");
      
      const mainPos = game.settings.get("tactical-map", flagKeyMain);
      const tacticalPos = game.settings.get("tactical-map", flagKeyTactical);
      
      console.log("Current Canvas Position:", {
        x: canvas.stage.pivot.x,
        y: canvas.stage.pivot.y,
        zoom: canvas.stage.scale.x
      });
      
      console.log("Stored Positions:", {
        main: mainPos,
        tactical: tacticalPos
      });
    };
    
    console.log("Debug commands registered. Use game.tacticalMap.logPositions() to view position data");
  }
});

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