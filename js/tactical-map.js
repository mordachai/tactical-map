// tactical-map.js with reduced notifications
import { switchTokenArt } from './token-art-switcher.js';
import { debugLog } from './logger-tcmap.js';
import { isV13OrLater } from './compatibility.js';

// Improved toggleTacticalMap function with minimal notifications
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
        ui.notifications.warn("No Tactical Map configured for this scene. Configure it in Scene Settings.");
        if (toggleButton) toggleButton.disabled = false;
        return;
      }
    }
    
    // Log initial state (debug only, no UI notification)
    debugLog(`Initial token positions on ${currentMap}:`);
    scene.tokens.contents.forEach(token => {
      debugLog(`Token ${token.name} at x: ${token.x}, y: ${token.y}, rotation: ${token.rotation}`);
    });

    // Perform the toggle operation
    if (isTacticalMapActive) {
      // Main Map: Store current positions first, then restore the original map
      await storeTokenPositions(scene, "tacticalTokenPositions");
      const restored = await restoreOriginalMap(scene);
      if (!restored) {
        if (toggleButton) toggleButton.disabled = false;
        return; // Error already shown by the function
      }
      debugLog("Toggled to Main Map.");
      await restoreTokenPositions(scene, "originalTokenPositions");
      await switchTokenArt(scene, "deactivate");
    } else {
      // Tactical Map: Store current positions first, then activate tactical map
      await storeTokenPositions(scene, "originalTokenPositions");
      const activated = await activateTacticalMap(scene);
      if (!activated) {
        if (toggleButton) toggleButton.disabled = false;
        return; // Error already shown by the function
      }
      debugLog("Toggled to Tactical Map.");
      await restoreTokenPositions(scene, "tacticalTokenPositions");
      await switchTokenArt(scene, "activate");
    }
    
    // Only show one success notification at the end
    //ui.notifications.info(`Switched to ${isTacticalMapActive ? "Main Map" : "Tactical Map"}`);
    
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

// Improved activateTacticalMap with minimal notifications
async function activateTacticalMap(scene) {
  try {
    const tacticalMapImage = scene.getFlag("tactical-map", "image");
    // Double-check (should have been caught earlier, but just in case)
    if (!tacticalMapImage) {
      ui.notifications.warn("No Tactical Map image set for this scene.");
      return false;
    }

    // Store original map settings
    const currentImg = scene.background?.src;
    
    // Store simple values, not complex objects with potential circular references
    await scene.setFlag("tactical-map", "originalSettings", {
      image: currentImg,
      width: scene.width,
      height: scene.height,
      gridType: scene.grid.type,
      gridSize: scene.grid.size,
      // Store primitive values, not objects
      panX: canvas.stage.pivot.x,
      panY: canvas.stage.pivot.y,
      zoom: canvas.stage.scale.x  // Just store the x scale as a number
    });

    debugLog("Original settings stored:", scene.getFlag("tactical-map", "originalSettings"));
    
    try {
      // Load image dimensions first
      const imgDimensions = await loadImagePromise(tacticalMapImage);
      
      // Update scene with new settings
      const updates = {
        "background.src": tacticalMapImage,
        width: imgDimensions.width,
        height: imgDimensions.height,
        "grid.type": scene.getFlag("tactical-map", "gridType") || 1, // Default to square if not set
        "grid.size": scene.getFlag("tactical-map", "gridSize") || 100 // Default to 100px if not set
      };

      await scene.update(updates);
      
      // Set tactical map as active
      await scene.setFlag("tactical-map", "isActive", true);
      
      // Adjust canvas position after map is fully loaded
      Hooks.once("canvasReady", () => {
        centerCanvasOnTacticalMap(scene, imgDimensions.width, imgDimensions.height);
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

// Improved restoreOriginalMap with minimal notifications
async function restoreOriginalMap(scene) {
  try {
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
    
    // Wait for canvas to refresh before restoring view
    Hooks.once("canvasReady", () => {
      canvas.pan({
        x: originalSettings.panX,
        y: originalSettings.panY,
        scale: originalSettings.zoom
      });
    });
    
    await scene.unsetFlag("tactical-map", "isActive");
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

// Function to center canvas on tactical map
async function centerCanvasOnTacticalMap(scene, width, height) {
  const viewRect = canvas.dimensions.sceneRect;
  const scale = Math.min(viewRect.width / width, viewRect.height / height) * 0.4;
  const x = width / 2;
  const y = height / 2;
  canvas.pan({ x, y, scale });
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
  centerCanvasOnTacticalMap
};