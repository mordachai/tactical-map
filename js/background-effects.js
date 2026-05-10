// background-effects.js
import { debugLog } from './logger-tcmap.js';

// v14: canvas.tiles / canvas.scene no longer exist as direct layer references.
// canvas.primary.background is the scene background sprite in both v13 and v14.
function getBlurTarget() {
  if (canvas.primary?.background) return canvas.primary.background;
  if (canvas.stage) return canvas.stage;
  return null;
}

// v14: PIXI.filters.BlurFilterDeprecated is gone; PIXI v7 exposes PIXI.BlurFilter directly.
function getBlurFilterClass() {
  return PIXI.BlurFilter ?? PIXI.filters?.BlurFilter ?? PIXI.filters?.BlurFilterDeprecated ?? null;
}

function animateBlur(filter, startValue, endValue, duration = 500, callback = null) {
  const startTime = Date.now();
  const change = endValue - startValue;
  
  function updateBlur() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function - ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // Calculate current blur value
    const currentBlur = startValue + change * easeProgress;
    
    // Update filter
    filter.blur = currentBlur;
    
    // Continue animation if not complete
    if (progress < 1) {
      requestAnimationFrame(updateBlur);
    } else if (callback) {
      // Run callback when animation completes
      callback();
    }
  }
  
  // Start animation
  updateBlur();
}

export function updateBlurAmount(scene, newAmount) {
  if (!canvas || !canvas.ready || !scene) return;
  
  // Check if tactical map is active without an image
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive") || false;
  const hasTacticalMap = scene.getFlag("tactical-map", "image");
  
  // Only update if tactical map is active without an image
  if (!(isTacticalMapActive && !hasTacticalMap)) return;
  
  // Find target
  const target = getBlurTarget();
  
  if (!target || !target.filters) return;
  
  // Update the blur amount if the filter exists
  const BlurFilterClass = getBlurFilterClass();
  const blurFilter = target.filters.find(f => f instanceof BlurFilterClass);
  
  if (blurFilter) {
    // Get current blur amount
    const currentAmount = blurFilter.blur;
    
    // Animate to new amount
    animateBlur(blurFilter, currentAmount, newAmount, 500);
    
    // Store new amount in client-side storage
    game.user.setFlag("tactical-map", `blurAmount_${scene.id}`, newAmount);
    
    debugLog(`Animated blur amount from ${currentAmount} to: ${newAmount}`);
  }
}

export async function toggleBackgroundBlur(scene) {
  if (!canvas || !canvas.ready || !scene) {
    console.error("Canvas or scene not ready");
    return false;
  }
  
  // Determine if we should be showing blur
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive") || false;
  const hasTacticalMapImage = scene.getFlag("tactical-map", "image") || false;
  
  // Blur should be active if tactical map is active AND there's no image
  const shouldBlurBeActive = isTacticalMapActive && !hasTacticalMapImage;
  
  // Get current blur state from SCENE flags instead of client-side storage
  const isBlurActive = scene.getFlag("tactical-map", "blurActive") || false;
  
  // Debug logging
  console.log("Blur Effect Debug:", {
    isGM: game.user.isGM,
    isTacticalMapActive,
    hasTacticalMapImage,
    shouldBlurBeActive,
    isBlurActive,
    sceneId: scene.id
  });
  
  // If no change needed, exit
  if (shouldBlurBeActive === isBlurActive) {
    console.log("No blur state change needed");
    return false;
  }
  
  debugLog(`Toggle blur: Current=${isBlurActive}, Should be=${shouldBlurBeActive}`);
  
  // Find appropriate target for blur effect
  const target = getBlurTarget();
  
  if (!target) {
    console.error("Could not find a valid background layer");
    return false;
  }
  
  // Debug log target
  console.log("Blur target:", {
    targetType: target.constructor.name,
    hasFilters: !!target.filters,
    currentFilters: target.filters ? target.filters.map(f => f.constructor.name) : []
  });
  
  // Get the blur amount from scene flags
  const blurAmount = scene.getFlag("tactical-map", "blurAmount") || 10;
  
  // Use modern filter with appropriate fallback
  const BlurFilterClass = getBlurFilterClass();
  
  // If we need to activate blur
  if (shouldBlurBeActive && !isBlurActive) {
    console.log("Activating blur effect");
    // ENABLE: Add blur filter with animation
    const blurFilter = new BlurFilterClass();
    // Start with no blur
    blurFilter.blur = 0;
    blurFilter.quality = 2;
    
    target.filters = target.filters || [];
    
    // Remove any existing blur filters first to avoid duplicates
    if (target.filters) {
      target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
    }
    
    // Add the new blur filter
    target.filters.push(blurFilter);
    
    // Set the flag in SCENE flags if GM, else do nothing
    if (game.user.isGM) {
      try {
        await scene.setFlag("tactical-map", "blurActive", true);
        console.log("Successfully set blur active flag on scene");
      } catch (error) {
        console.error("Error setting blur active flag:", error);
      }
    }
    
    // Animate the blur from 0 to the target amount
    animateBlur(blurFilter, 0, blurAmount, 500);
    
    debugLog(`Background blur enabled with animated amount: ${blurAmount}`);
    return true;
  } 
  // If we need to deactivate blur
  else if (!shouldBlurBeActive && isBlurActive) {
    console.log("Deactivating blur effect");
    // DISABLE: Remove blur filter with animation
    if (target.filters) {
      // Find the blur filter
      const blurFilter = target.filters.find(f => f instanceof BlurFilterClass);
      
      if (blurFilter) {
        // Get the current blur amount
        const currentBlur = blurFilter.blur;
        
        // Animate blur to 0 then remove the filter
        animateBlur(blurFilter, currentBlur, 0, 500, () => {
          // After animation completes, remove the filter
          target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
          
          if (target.filters.length === 0) {
            target.filters = null;
          }
        });
      } else {
        // If no blur filter found, just remove all filters of that type
        target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
        
        if (target.filters.length === 0) {
          target.filters = null;
        }
      }
      
      // Update flag in SCENE flags if GM, else do nothing
      if (game.user.isGM) {
        try {
          await scene.setFlag("tactical-map", "blurActive", false);
          console.log("Successfully set blur inactive flag on scene");
        } catch (error) {
          console.error("Error setting blur inactive flag:", error);
        }
      }
      
      debugLog("Background blur disabled with animation");
      return true;
    }
  }
  
  return false;
}

export async function forceApplyBlur(scene) {
  if (!canvas || !canvas.ready || !scene) {
    console.log("Canvas or scene not ready for blur application, initiating wait sequence");
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20; // Limit retry attempts (2 seconds total with 100ms intervals)
      
      const checkCanvas = () => {
        attempts++;
        if (canvas && canvas.ready && scene) {
          console.log("Canvas now ready, proceeding with blur application");
          forceApplyBlur(scene).then(resolve);
        } else if (attempts < maxAttempts) {
          // Try again in 100ms
          setTimeout(checkCanvas, 100);
        } else {
          // Give up after too many attempts
          console.warn("Could not apply blur - canvas never ready after multiple attempts");
          resolve(false);
        }
      };
      
      checkCanvas();
    });
  }

  try {
    const target = getBlurTarget();
    
    if (!target) {
      console.error("Could not find a valid background layer for blur application");
      return false;
    }

    // Get the blur amount from scene flags
    const blurAmount = scene.getFlag("tactical-map", "blurAmount") || 10;
    
    // Use modern filter with appropriate fallback
    const BlurFilterClass = getBlurFilterClass();
    
    // Create and configure blur filter
    const blurFilter = new BlurFilterClass();
    blurFilter.blur = 0;
    blurFilter.quality = 3;
    
    // Remove any existing blur filters
    if (target.filters) {
      target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
    }
    
    // Add the new blur filter
    target.filters = target.filters || [];
    target.filters.push(blurFilter);
    
    // Set the flag in SCENE flags if GM
    if (game.user.isGM) {
      try {
        await scene.setFlag("tactical-map", "blurActive", true);
        console.log("Successfully set blur active flag on scene");
      } catch (error) {
        console.error("Error setting blur active flag:", error);
      }
    }
    
    // Animate the blur from 0 to the target amount
    animateBlur(blurFilter, 0, blurAmount, 500);
    
    debugLog(`Background blur FORCED with animated amount: ${blurAmount}`);
    return true;
  } catch (error) {
    console.error("Error applying blur effect:", error);
    return false;
  }
}

export async function forceRemoveBlur(scene) {
  if (!canvas || !canvas.ready || !scene) {
    console.log("Canvas or scene not ready for blur removal, initiating wait sequence");
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20;
      
      const checkCanvas = () => {
        attempts++;
        if (canvas && canvas.ready && scene) {
          console.log("Canvas now ready, proceeding with blur removal");
          forceRemoveBlur(scene).then(resolve);
        } else if (attempts < maxAttempts) {
          setTimeout(checkCanvas, 100);
        } else {
          console.warn("Could not remove blur - canvas never ready after multiple attempts");
          resolve(false);
        }
      };
      
      checkCanvas();
    });
  }

  try {
    const target = getBlurTarget();
    
    if (!target || !target.filters) {
      console.log("No valid target or filters found for blur removal");
      return false;
    }

    // Use modern filter with appropriate fallback
    const BlurFilterClass = getBlurFilterClass();
    
    // Find the blur filter
    const blurFilter = target.filters.find(f => f instanceof BlurFilterClass);
    
    if (blurFilter) {
      // Get current blur amount
      const currentBlur = blurFilter.blur;
      
      // Animate blur to 0 then remove the filter
      await new Promise(resolve => {
        animateBlur(blurFilter, currentBlur, 0, 500, () => {
          // After animation completes, remove the filter
          target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
          
          if (target.filters.length === 0) {
            target.filters = null;
          }
          resolve();
        });
      });
    } else {
      // If no blur filter found, just remove all filters of that type
      target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
      
      if (target.filters.length === 0) {
        target.filters = null;
      }
    }
    
    // Update flag in SCENE flags if GM
    if (game.user.isGM) {
      try {
        await scene.setFlag("tactical-map", "blurActive", false);
        console.log("Successfully set blur inactive flag on scene");
      } catch (error) {
        console.error("Error setting blur inactive flag:", error);
      }
    }
    
    debugLog("Background blur FORCED removal");
    return true;
  } catch (error) {
    console.error("Error removing blur effect:", error);
    return false;
  }
}

Hooks.on("updateScene", (scene, changes, options, userId) => {
  // Only proceed if tactical map flags have changed
  if (!changes.flags || !changes.flags["tactical-map"]) return;
  
  const tacticalFlags = changes.flags["tactical-map"];
  
  // If blurActive flag changed and it's not from the current user
  if (tacticalFlags.blurActive !== undefined && userId !== game.user.id) {
    console.log("Blur state changed by another user, updating local display");
    
    // Should we apply or remove blur?
    if (tacticalFlags.blurActive) {
      // Apply blur without changing scene flags
      forceApplyBlurLocally(scene);
    } else {
      // Remove blur without changing scene flags
      forceRemoveBlurLocally(scene);
    }
  }
  
  // If the tactical map was activated/deactivated or the image was changed
  if (tacticalFlags.isActive !== undefined || tacticalFlags.image !== undefined) {
    // Check current state
    const isTacticalMapActive = scene.getFlag("tactical-map", "isActive") || false;
    const hasTacticalMapImage = scene.getFlag("tactical-map", "image") || false;
    
    // Determine if blur should be active
    const shouldBlurBeActive = isTacticalMapActive && !hasTacticalMapImage;
    const isBlurActive = scene.getFlag("tactical-map", "blurActive") || false;
    
    // Update local blur state if needed
    if (shouldBlurBeActive !== isBlurActive) {
      if (shouldBlurBeActive) {
        forceApplyBlurLocally(scene);
      } else {
        forceRemoveBlurLocally(scene);
      }
    }
  }
});

async function forceApplyBlurLocally(scene) {
  if (!canvas || !canvas.ready) return false;
  
  try {
    const target = getBlurTarget();
    
    if (!target) return false;

    // Get the blur amount from scene flags
    const blurAmount = scene.getFlag("tactical-map", "blurAmount") || 10;
    
    // Use modern filter with appropriate fallback
    const BlurFilterClass = getBlurFilterClass();
    
    // Create and configure blur filter
    const blurFilter = new BlurFilterClass();
    blurFilter.blur = 0; 
    blurFilter.quality = 3;
    
    // Remove any existing blur filters
    if (target.filters) {
      target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
    }
    
    // Add the new blur filter
    target.filters = target.filters || [];
    target.filters.push(blurFilter);
    
    // Animate the blur from 0 to the target amount
    animateBlur(blurFilter, 0, blurAmount, 500);
    
    return true;
  } catch (error) {
    console.error("Error applying blur effect locally:", error);
    return false;
  }
}

async function forceRemoveBlurLocally(scene) {
  if (!canvas || !canvas.ready) return false;
  
  try {
    const target = getBlurTarget();
    
    if (!target || !target.filters) return false;

    // Use modern filter with appropriate fallback
    const BlurFilterClass = getBlurFilterClass();
    
    // Find the blur filter
    const blurFilter = target.filters.find(f => f instanceof BlurFilterClass);
    
    if (blurFilter) {
      // Get current blur amount
      const currentBlur = blurFilter.blur;
      
      // Animate blur to 0 then remove the filter
      await new Promise(resolve => {
        animateBlur(blurFilter, currentBlur, 0, 500, () => {
          // After animation completes, remove the filter
          target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
          
          if (target.filters.length === 0) {
            target.filters = null;
          }
          resolve();
        });
      });
    } else {
      // If no blur filter found, just remove all filters of that type
      target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
      
      if (target.filters.length === 0) {
        target.filters = null;
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error removing blur effect locally:", error);
    return false;
  }
}

Hooks.on("canvasReady", async (canvas) => {
  // Wait a short moment to ensure canvas is fully initialized
  setTimeout(async () => {
    const scene = canvas.scene;
    if (!scene) return;
    
    // Check if tactical map is active using scene flags
    const isTacticalMapActive = scene.getFlag("tactical-map", "isActive") || false;
    const hasTacticalMapImage = scene.getFlag("tactical-map", "image") || false;
    const isBlurActive = scene.getFlag("tactical-map", "blurActive") || false;
    
    // If tactical map is active without an image, apply blur based on scene flags
    if (isTacticalMapActive && !hasTacticalMapImage) {
      // If blur should be active but isn't showing locally
      if (isBlurActive) {
        console.log("Scene ready, blur should be active, applying locally");
        forceApplyBlurLocally(scene);
      }
    } else if (isBlurActive) {
      // If blur is flagged as active but shouldn't be (scene state changed)
      console.log("Scene ready, blur is flagged as active but shouldn't be");
      if (game.user.isGM) {
        // If GM, update the scene flag
        await scene.setFlag("tactical-map", "blurActive", false);
      } else {
        // If player, just remove locally
        forceRemoveBlurLocally(scene);
      }
    }
  }, 100); // Wait 100ms before attempting to apply blur
});
