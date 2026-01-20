// tactical-map.js
import { switchTokenArt } from './token-art-switcher.js';
import { debugLog } from './logger-tcmap.js';
import { toggleBackgroundBlur, forceApplyBlur, forceRemoveBlur } from './background-effects.js';

function getScenePositionKey(scene, baseFlag) {
  return baseFlag + '_' + scene.id;
}

async function storeCanvasPosition(scene, baseFlag) {
  try {
    // Capture full position data with fallbacks
    const positionData = {
      panX: canvas.stage.pivot.x,
      panY: canvas.stage.pivot.y,
      zoom: canvas.stage.scale.x,
      timestamp: Date.now(),
      // Store scene dimensions for scaling calculations
      sceneWidth: scene.width,
      sceneHeight: scene.height
    };
    
    debugLog(`Storing position for ${baseFlag}:`, {
      x: positionData.panX.toFixed(2),
      y: positionData.panY.toFixed(2),
      zoom: positionData.zoom.toFixed(2)
    });
    
    // If user is GM, store in scene flags, otherwise store in user settings
    if (game.user.isGM) {
      await scene.setFlag("tactical-map", baseFlag, positionData);
      // Verify the flag was stored
      const storedData = scene.getFlag("tactical-map", baseFlag);
      debugLog(`Verified stored position for ${baseFlag}:`, storedData ? "success" : "failed");
    } else {
      // Store in user settings with scene-specific key
      const userKey = `${baseFlag}_${scene.id}`;
      await game.user.setFlag("tactical-map", userKey, positionData);
      // Verify the flag was stored
      const storedData = game.user.getFlag("tactical-map", userKey);
      debugLog(`Verified stored user position for ${userKey}:`, storedData ? "success" : "failed");
    }
    return true;
  } catch (error) {
    console.error(`Error storing canvas position for ${baseFlag}:`, error);
    return false;
  }
}

async function restoreCanvasPosition(scene, baseFlag) {
  try {
    let position;
    // If user is GM, get from scene flags, otherwise get from user settings
    if (game.user.isGM) {
      position = scene.getFlag("tactical-map", baseFlag);
    } else {
      const userKey = `${baseFlag}_${scene.id}`;
      position = game.user.getFlag("tactical-map", userKey);
    }
    
    if (position) {
      debugLog(`Restoring position for ${baseFlag}:`, {
        x: position.panX.toFixed(2), 
        y: position.panY.toFixed(2),
        zoom: position.zoom.toFixed(2)
      });
      
      // Apply position with no animation for precision
      canvas.pan({
        x: position.panX,
        y: position.panY,
        scale: position.zoom
      });
      return true;
    } else {
      debugLog(`No saved position for ${baseFlag}, centering map`);
      centerMap(scene);
      return false;
    }
  } catch (error) {
    console.error(`Error restoring position for ${baseFlag}:`, error);
    centerMap(scene);
    return false;
  }
}

function centerMap(scene) {
  const width = scene.width;
  const height = scene.height;
  
  // Calculate appropriate zoom based on scene dimensions
  const viewportWidth = canvas.dimensions.width;
  const viewportHeight = canvas.dimensions.height;
  
  const sceneRatio = width / height;
  const viewportRatio = viewportWidth / viewportHeight;
  
  let scale;
  if (sceneRatio > viewportRatio) {
    // Scene is wider - fit to width
    scale = viewportWidth / width * 0.9;
  } else {
    // Scene is taller - fit to height
    scale = viewportHeight / height * 0.9;
  }
  
  // Ensure zoom isn't too extreme
  scale = Math.min(Math.max(scale, 0.1), 2.0);
  
  debugLog(`Centering map at ${width/2}, ${height/2} with scale ${scale}`);
  
  // Apply with animation
  canvas.animatePan({
    x: width / 2,
    y: height / 2,
    scale: scale,
    duration: 500
  });
}

// Add a flag to track if blur is being applied
let isApplyingBlur = false;

// Add a flag to track if we're in the middle of a toggle
let isTogglingMap = false;

export async function toggleTacticalMap() {
  const scene = game.scenes.active;

  if (!scene || !scene.isView) {
    return ui.notifications.warn("You can only toggle the Tactical Map on the active scene.");
  }

  // Disable button during processing
  const toggleButton = document.querySelector('[data-tool="toggleTacticalMap"]');
  if (toggleButton) toggleButton.disabled = true;
  
  try {
    isTogglingMap = true;  // Set the flag at the start of the toggle
    
    // Get active state from appropriate source based on user role
    const isTacticalMapActive = game.user.isGM 
      ? scene.getFlag("tactical-map", "isActive")
      : game.user.getFlag("tactical-map", `isActive_${scene.id}`);

    const isMainMapHexcrawl = scene.getFlag("tactical-map", "isMainMapHexcrawl") || false;
    
    const currentMap = isTacticalMapActive ? "Tactical Map" : "Main Map";
    const currentFlag = isTacticalMapActive ? "tacticalMapPosition" : "mainMapPosition";
    const targetFlag = isTacticalMapActive ? "mainMapPosition" : "tacticalMapPosition";
    
    debugLog(`Toggling from ${currentMap} to ${isTacticalMapActive ? "Main Map" : "Tactical Map"}`);
    debugLog(`Is Main Map Hexcrawl: ${isMainMapHexcrawl}`);
    
    // IMPORTANT: First store current view position
    await storeCanvasPosition(scene, currentFlag);
    debugLog(`Stored current ${currentMap} position`);
    
    // Check for saved target position
    const targetPosition = scene.getFlag("tactical-map", targetFlag);
    debugLog(`Pre-toggle: Target position for ${targetFlag}:`, targetPosition);
    
    // Check for tactical map image
    const tacticalMapImage = scene.getFlag("tactical-map", "image");
    
    if (!tacticalMapImage) {
      // No image tactical map toggle
      if (isTacticalMapActive) {
        // Only handle grid and token operations for GMs
        if (game.user.isGM) {
          // Store token positions
          await storeTokenPositions(scene, "tacticalTokenPositions");
          
          // Get and apply original settings
          const originalSettings = scene.getFlag("tactical-map", "originalSettings");
          if (originalSettings && originalSettings.gridType !== undefined) {
            await scene.update({ "grid.type": originalSettings.gridType });
          }
          
          // Set inactive flag
          await scene.unsetFlag("tactical-map", "isActive");
          
          // Restore tokens
          await restoreTokenPositions(scene, "originalTokenPositions");
          
          // If the main map is hexcrawl, apply the hexcrawl token art
          if (isMainMapHexcrawl) {
            // IMPORTANT: Use "deactivate" here for hexcrawl main map
            await switchTokenArt(scene, "deactivate");
          } else {
            // For non-hexcrawl main map, also use "deactivate" to restore original tokens
            await switchTokenArt(scene, "deactivate");
          }
        } else {
          // For players, just update their local state
          await game.user.setFlag("tactical-map", `isActive_${scene.id}`, false);
        }
        
        // Remove blur filter - with improved error handling
        try {
          debugLog("Attempting to remove blur effect");
          const blurRemoved = await forceRemoveBlur(scene);
          debugLog(`Blur removal ${blurRemoved ? "succeeded" : "failed"}`);
        } catch (error) {
          console.error("Error during blur removal:", error);
          // Continue with other operations even if blur removal fails
        }
        
        // AFTER all changes, restore previous view position
        await restoreCanvasPosition(scene, targetFlag);
      } else {
        // Activating without image
        if (game.user.isGM) {
          // Store original grid type
          const originalGridType = scene.grid.type;
          await scene.setFlag("tactical-map", "originalSettings", {
            gridType: originalGridType
          });
          
          // Store token positions
          await storeTokenPositions(scene, "originalTokenPositions");
          
          // Update grid type
          const tacticalGridType = scene.getFlag("tactical-map", "gridType");
          const gridTypeToApply = tacticalGridType !== undefined && tacticalGridType !== null ? 
                                 tacticalGridType : 1;
          await scene.update({ "grid.type": gridTypeToApply });
          
          // Set active flag
          await scene.setFlag("tactical-map", "isActive", true);
          
          // Restore tokens 
          await restoreTokenPositions(scene, "tacticalTokenPositions");
          
          // Apply token art switch for tactical map (IMPORTANT: Use "activate" here)
          await switchTokenArt(scene, "activate");
        } else {
          // For players, just update their local state
          await game.user.setFlag("tactical-map", `isActive_${scene.id}`, true);
        }
        
        // Apply blur - with improved error handling
        try {
          if (!isApplyingBlur) {
            isApplyingBlur = true;
            debugLog("Attempting to apply blur effect");
            
            // Ensure canvas is ready before applying blur
            if (!canvas.ready) {
              await new Promise(resolve => {
                const checkCanvas = () => {
                  if (canvas.ready) {
                    resolve();
                  } else {
                    setTimeout(checkCanvas, 100);
                  }
                };
                checkCanvas();
              });
            }
            
            // Find appropriate target for blur effect
            let target = null;
            if (canvas.primary?.background) target = canvas.primary.background;
            else if (canvas.scene?.background) target = canvas.scene.background;
            else if (canvas.tiles?.background) target = canvas.tiles.background;
            else if (canvas.environment) target = canvas.environment;
            else if (canvas.stage) target = canvas.stage;
            
            if (!target) {
              console.error("Could not find a valid background layer for blur application");
              return;
            }
            
            // Now apply the blur
            const blurApplied = await forceApplyBlur(scene);
            debugLog(`Blur application ${blurApplied ? "succeeded" : "failed"}`);
            isApplyingBlur = false;
          }
        } catch (error) {
          console.error("Error during blur application:", error);
          isApplyingBlur = false;
          // Continue with other operations even if blur application fails
        }
        
        // Add tokens to combat if enabled (GM only)
        if (game.user.isGM && scene.getFlag("tactical-map", "addTokensToEncounter")) {
          await ensureCombatEncounter(scene);
        }
        
        // AFTER all changes, restore previous view position
        await restoreCanvasPosition(scene, targetFlag);
      }
    } else {
      // With tactical map image
      if (isTacticalMapActive) {
        // Store token positions (GM only)
        if (game.user.isGM) {
          await storeTokenPositions(scene, "tacticalTokenPositions");
        }
        
        // Restore original map
        const restored = await restoreOriginalMap(scene, targetFlag);
        if (!restored) {
          if (toggleButton) toggleButton.disabled = false;
          return;
        }
        
        // Restore tokens and art (GM only)
        if (game.user.isGM) {
          await restoreTokenPositions(scene, "originalTokenPositions");
          
          // Handle token art switching with consideration for hexcrawl main maps
          if (isMainMapHexcrawl) {
            // Apply hexcrawl token art to main map
            await switchTokenArt(scene, "deactivate");
          } else {
            // Standard token art restoration
            await switchTokenArt(scene, "deactivate");
          }
        } else {
          // For players, just update their local state
          await game.user.setFlag("tactical-map", `isActive_${scene.id}`, false);
        }
      } else {
        // Store token positions (GM only)
        if (game.user.isGM) {
          await storeTokenPositions(scene, "originalTokenPositions");
        }
        
        // Activate tactical map
        const activated = await activateTacticalMap(scene, targetFlag);
        if (!activated) {
          if (toggleButton) toggleButton.disabled = false;
          return;
        }
        
        // Restore tokens and art (GM only)
        if (game.user.isGM) {
          await restoreTokenPositions(scene, "tacticalTokenPositions");
          // IMPORTANT: Always use "activate" when switching to tactical map
          await switchTokenArt(scene, "activate");
        } else {
          // For players, just update their local state
          await game.user.setFlag("tactical-map", `isActive_${scene.id}`, true);
        }
      }
    }
    
    // Emit hook for other modules
    Hooks.callAll("toggleTacticalMap", scene, isTacticalMapActive ? "deactivate" : "activate");
    
  } catch (error) {
    console.error("Error toggling tactical map:", error);
    ui.notifications.error("Failed to toggle map. Check console for details.");
  } finally {
    // Re-enable button and reset flags
    if (toggleButton) toggleButton.disabled = false;
    isTogglingMap = false;
    isApplyingBlur = false;
  }
}

async function activateTacticalMap(scene, targetPositionFlag) {
  try {
    // Check for saved position
    const originalPosition = scene.getFlag("tactical-map", targetPositionFlag);
    debugLog(`Pre-activation: Saved position for ${targetPositionFlag}:`, originalPosition);
    
    const tacticalMapImage = scene.getFlag("tactical-map", "image");
    if (!tacticalMapImage) {
      ui.notifications.warn("No Tactical Map image set for this scene.");
      return false;
    }

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
    
    // Load image dimensions
    const imgDimensions = await loadImagePromise(tacticalMapImage);
    
    // Get tactical map grid settings - FIX: Ensure gridType properly handles 0 (gridless)
    const gridType = scene.getFlag("tactical-map", "gridType");
    const gridSize = scene.getFlag("tactical-map", "gridSize") || 100;
    
    // Get grid styling settings
    const gridColor = scene.getFlag("tactical-map", "gridColor");
    const gridAlpha = scene.getFlag("tactical-map", "gridAlpha");
    const gridStyle = scene.getFlag("tactical-map", "gridStyle");
    const gridThickness = scene.getFlag("tactical-map", "gridThickness");
    
    // Prepare updates
    const updates = {
      "background.src": tacticalMapImage,
      width: imgDimensions.width,
      height: imgDimensions.height,
      "grid.size": gridSize
    };
    
    // Only set grid type if it exists and is a number (including 0 for gridless)
    if (gridType !== undefined && gridType !== null) {
      updates["grid.type"] = gridType;
    }
    
    // Add optional grid styling
    if (gridColor) updates["grid.color"] = gridColor;
    if (gridAlpha !== undefined) updates["grid.alpha"] = gridAlpha;
    if (gridStyle) updates["grid.style"] = gridStyle;
    if (gridThickness !== undefined) updates["grid.thickness"] = gridThickness;
    
    // Save scale settings
    const gridScale = scene.getFlag("tactical-map", "gridScale");
    if (gridScale) {
      if (gridScale.distance) updates["grid.distance"] = gridScale.distance;
      if (gridScale.units) updates["grid.units"] = gridScale.units;
    }

    await scene.update(updates);
    await scene.setFlag("tactical-map", "isActive", true);
    
    // Add tokens to combat if enabled
    if (scene.getFlag("tactical-map", "addTokensToEncounter")) {
      await ensureCombatEncounter(scene);
    }
    
    // Set up a hook to restore position after canvas is ready
    debugLog(`Set hook to restore position ${targetPositionFlag} after canvas ready`);
    Hooks.once("canvasReady", () => {
      debugLog(`Canvas ready hook fired, restoring position ${targetPositionFlag}`);
      restoreCanvasPosition(scene, targetPositionFlag);
    });
    
    return true;
  } catch (error) {
    console.error("Error activating Tactical Map:", error);
    ui.notifications.error("Failed to activate Tactical Map.");
    return false;
  }
}

async function restoreOriginalMap(scene, targetPositionFlag) {
  try {
    // Check for saved position
    const originalPosition = scene.getFlag("tactical-map", targetPositionFlag);
    debugLog(`Pre-restoration: Saved position for ${targetPositionFlag}:`, originalPosition);
    
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
    
    // Add grid styling if available
    if (originalSettings.gridColor) updates["grid.color"] = originalSettings.gridColor;
    if (originalSettings.gridAlpha !== undefined) updates["grid.alpha"] = originalSettings.gridAlpha;
    if (originalSettings.gridStyle) updates["grid.style"] = originalSettings.gridStyle;
    if (originalSettings.gridThickness !== undefined) updates["grid.thickness"] = originalSettings.gridThickness;

    await scene.update(updates);
    await scene.unsetFlag("tactical-map", "isActive");
    
    // Set up a hook to restore position after canvas is ready
    debugLog(`Set hook to restore position ${targetPositionFlag} after canvas ready`);
    Hooks.once("canvasReady", () => {
      debugLog(`Canvas ready hook fired, restoring position ${targetPositionFlag}`);
      restoreCanvasPosition(scene, targetPositionFlag);
    });
    
    return true;
  } catch (error) {
    console.error("Error restoring original map:", error);
    ui.notifications.error("Failed to restore original map.");
    return false;
  }
}

// Add a function to monitor canvas changes and save positions periodically
function setupCanvasPositionMonitoring() {
  Hooks.on("canvasReady", (canvas) => {
    const scene = canvas.scene;
    if (!scene) return;
    
    // If tactical map flag is set, store position after canvas stabilizes
    setTimeout(() => {
      const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");
      if (isTacticalMapActive !== undefined) {
        const positionFlag = isTacticalMapActive ? "tacticalMapPosition" : "mainMapPosition";
        storeCanvasPosition(scene, positionFlag);
        debugLog(`Canvas ready: stored position for ${positionFlag}`);
      }
      
      // Check if we need to apply hexcrawl tokens on the main map
      const isMainMapHexcrawl = scene.getFlag("tactical-map", "isMainMapHexcrawl") || false;
      if (isMainMapHexcrawl && !isTacticalMapActive && game.user.isGM) {
        // Only import and use if needed
        import('./token-art-switcher.js').then(module => {
          module.switchTokenArt(scene, "deactivate");
        });
      }
    }, 1000); // Increased from 500 to 1000ms for better reliability
  });
}

// Call this during module initialization
setupCanvasPositionMonitoring();

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
  // Only GM should handle token position storage and art switching
  if (!game.user.isGM) return;

  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");

  if (isTacticalMapActive) {
    debugLog(`Adding Token ${tokenData.name} in Tactical Map at x: ${tokenData.x}, y: ${tokenData.y}`);
    await positionTokenOnInactiveMap(scene, tokenData, "originalTokenPositions");
  } else {
    await positionTokenOnInactiveMap(scene, tokenData, "tacticalTokenPositions");
  }
  
  // Apply appropriate token art for new token if settings require it
  const isMainMapHexcrawl = scene.getFlag("tactical-map", "isMainMapHexcrawl") || false;
  let useAlternativeTokenArt = false;
  try {
    useAlternativeTokenArt = game.settings.get("tactical-map", "useAlternativeTokenArt");
  } catch (error) {
    debugLog("useAlternativeTokenArt setting not registered yet");
  }
  
  if (useAlternativeTokenArt) {
    if (isTacticalMapActive) {
      // If tactical map is active, apply the appropriate art for tactical map type
      import('./token-art-switcher.js').then(module => {
        module.switchTokenArt(scene, "activate");
      });
    } else if (isMainMapHexcrawl) {
      // If main map is hexcrawl and we're on main map, apply hexcrawl art
      import('./token-art-switcher.js').then(module => {
        module.switchTokenArt(scene, "deactivate");
      });
    }
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
    
    // Only store position if we're not in the middle of a toggle
    if (!isApplyingBlur && !isTogglingMap) {
      // Store position for the current view
      const positionFlag = isTacticalMapActive ? "tacticalMapPosition" : "mainMapPosition";
      debugLog(`Scene ${scene.name} ready, storing current position as ${positionFlag}`);
      
      // Wait a moment for canvas to fully initialize
      setTimeout(() => {
        storeCanvasPosition(scene, positionFlag);
      }, 1000); // Increased from 500 to 1000ms
    }
  }
});

// Add a hook to handle scene activation for hexcrawl main maps
Hooks.on("canvasInit", async (canvas) => {
  const scene = canvas.scene;
  if (!scene) return;
  
  // Check if this is a hexcrawl main map and tactical map is not active
  const isMainMapHexcrawl = scene.getFlag("tactical-map", "isMainMapHexcrawl") || false;
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive") || false;
  
  if (isMainMapHexcrawl && !isTacticalMapActive && game.user.isGM) {
    debugLog("Hexcrawl main map activated, applying hexcrawl token art");
    
    // Wait for canvas to be ready
    if (!canvas.ready) {
      await new Promise(resolve => {
        const checkCanvasReady = () => {
          if (canvas.ready) {
            resolve();
          } else {
            setTimeout(checkCanvasReady, 100);
          }
        };
        checkCanvasReady();
      });
    }
    
    // Apply hexcrawl token art - IMPORTANT: Use "deactivate" for applying hexcrawl art on main map
    import('./token-art-switcher.js').then(module => {
      module.switchTokenArt(scene, "deactivate");
    });
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
      
      const mainPos = scene.getFlag("tactical-map", "mainMapPosition");
      const tacticalPos = scene.getFlag("tactical-map", "tacticalMapPosition");
      
      console.log("Current Canvas Position:", {
        x: canvas.stage.pivot.x,
        y: canvas.stage.pivot.y,
        zoom: canvas.stage.scale.x
      });
      
      console.log("Stored Positions:", {
        main: mainPos,
        tactical: tacticalPos
      });
      
      // Add hexcrawl debug info
      const isMainMapHexcrawl = scene.getFlag("tactical-map", "isMainMapHexcrawl") || false;
      const mapType = scene.getFlag("tactical-map", "mapType") || "unknown";
      
      console.log("Hexcrawl Debug Info:", {
        isMainMapHexcrawl,
        tacticalMapType: mapType,
        isActive: scene.getFlag("tactical-map", "isActive") || false
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
  centerMap,
  setupCanvasPositionMonitoring
};