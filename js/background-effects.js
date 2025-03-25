// background-effects.js
import { debugLog } from './logger-tcmap.js';
import { isV13OrLater } from './compatibility.js';

/**
 * Applies or removes a blur effect on the scene background when no tactical map is set
 * @param {Scene} scene - The current scene
 * @returns {boolean} - Whether the blur state was changed
 */
export async function toggleBackgroundBlur(scene) {
  if (!canvas || !canvas.ready || !scene) {
    console.error("Canvas or scene not ready");
    return false;
  }
  
  // Determine if we should be showing blur
  const isTacticalMapActive = game.user.isGM 
    ? scene.getFlag("tactical-map", "isActive")
    : game.user.getFlag("tactical-map", `isActive_${scene.id}`);
  const hasTacticalMapImage = scene.getFlag("tactical-map", "image") || false;
  
  // Blur should be active if tactical map is active AND there's no image
  const shouldBlurBeActive = isTacticalMapActive && !hasTacticalMapImage;
  
  // Get current blur state from client-side storage
  const isBlurActive = game.user.getFlag("tactical-map", `blurActive_${scene.id}`) || false;
  
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
  let target = null;
  if (canvas.primary?.background) target = canvas.primary.background;
  else if (canvas.scene?.background) target = canvas.scene.background;
  else if (canvas.tiles?.background) target = canvas.tiles.background;
  else if (canvas.environment) target = canvas.environment;
  else if (canvas.stage) target = canvas.stage;
  
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
  
  // Get the blur amount from client-side storage
  const blurAmount = game.user.getFlag("tactical-map", `blurAmount_${scene.id}`) || 10;
  
  // Use modern filter with appropriate fallback
  const BlurFilterClass = PIXI.filters.BlurFilterDeprecated || PIXI.filters.BlurFilter;
  
  // If we need to activate blur
  if (shouldBlurBeActive && !isBlurActive) {
    console.log("Activating blur effect");
    // ENABLE: Add blur filter with animation
    const blurFilter = new BlurFilterClass();
    // Start with no blur
    blurFilter.blur = 0;
    blurFilter.quality = 3;
    
    target.filters = target.filters || [];
    
    // Remove any existing blur filters first to avoid duplicates
    if (target.filters) {
      target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
    }
    
    // Add the new blur filter
    target.filters.push(blurFilter);
    
    // Set the flag in client-side storage
    try {
      await game.user.setFlag("tactical-map", `blurActive_${scene.id}`, true);
      console.log("Successfully set blur active flag");
    } catch (error) {
      console.error("Error setting blur active flag:", error);
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
      
      // Update flag in client-side storage
      try {
        await game.user.setFlag("tactical-map", `blurActive_${scene.id}`, false);
        console.log("Successfully set blur inactive flag");
      } catch (error) {
        console.error("Error setting blur inactive flag:", error);
      }
      
      debugLog("Background blur disabled with animation");
      return true;
    }
  }
  
  return false;
}

/**
 * Animates a blur filter from one value to another
 * @param {PIXI.filters.BlurFilter} filter - The blur filter to animate
 * @param {number} startValue - Starting blur amount
 * @param {number} endValue - Target blur amount
 * @param {number} duration - Duration in milliseconds
 * @param {Function} callback - Optional callback to run after animation completes
 */
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

/**
 * Updates blur amount if blur is currently active
 * @param {Scene} scene - The current scene
 * @param {number} newAmount - The new blur amount
 */
export function updateBlurAmount(scene, newAmount) {
  if (!canvas || !canvas.ready || !scene) return;
  
  // Check if tactical map is active without an image
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive") || false;
  const hasTacticalMap = scene.getFlag("tactical-map", "image");
  
  // Only update if tactical map is active without an image
  if (!(isTacticalMapActive && !hasTacticalMap)) return;
  
  // Find target
  let target = null;
  if (canvas.primary?.background) target = canvas.primary.background;
  else if (canvas.scene?.background) target = canvas.scene.background;
  else if (canvas.tiles?.background) target = canvas.tiles.background;
  else if (canvas.environment) target = canvas.environment;
  else if (canvas.stage) target = canvas.stage;
  
  if (!target || !target.filters) return;
  
  // Update the blur amount if the filter exists
  const BlurFilterClass = PIXI.filters.BlurFilterDeprecated || PIXI.filters.BlurFilter;
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

// Function to force apply blur effect
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
    // Find appropriate target for blur effect
    let target = null;
    if (canvas.primary?.background) target = canvas.primary.background;
    else if (canvas.scene?.background) target = canvas.scene.background;
    else if (canvas.tiles?.background) target = canvas.tiles.background;
    else if (canvas.environment) target = canvas.environment;
    else if (canvas.stage) target = canvas.stage;
    
    if (!target) {
      console.error("Could not find a valid background layer for blur application");
      return false;
    }

    // Get the blur amount from client-side storage
    const blurAmount = game.user.getFlag("tactical-map", `blurAmount_${scene.id}`) || 10;
    
    // Use modern filter with appropriate fallback
    const BlurFilterClass = PIXI.filters.BlurFilterDeprecated || PIXI.filters.BlurFilter;
    
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
    
    // Set the flag in client-side storage for both GM and players
    try {
      await game.user.setFlag("tactical-map", `blurActive_${scene.id}`, true);
      console.log("Successfully set blur active flag");
    } catch (error) {
      console.error("Error setting blur active flag:", error);
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

// Function to force remove blur effect
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
    // Find appropriate target for blur effect
    let target = null;
    if (canvas.primary?.background) target = canvas.primary.background;
    else if (canvas.scene?.background) target = canvas.scene.background;
    else if (canvas.tiles?.background) target = canvas.tiles.background;
    else if (canvas.environment) target = canvas.environment;
    else if (canvas.stage) target = canvas.stage;
    
    if (!target || !target.filters) {
      console.log("No valid target or filters found for blur removal");
      return false;
    }

    // Use modern filter with appropriate fallback
    const BlurFilterClass = PIXI.filters.BlurFilterDeprecated || PIXI.filters.BlurFilter;
    
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
    
    // Update flag in client-side storage for both GM and players
    try {
      await game.user.setFlag("tactical-map", `blurActive_${scene.id}`, false);
      console.log("Successfully set blur inactive flag");
    } catch (error) {
      console.error("Error setting blur inactive flag:", error);
    }
    
    debugLog("Background blur FORCED removal");
    return true;
  } catch (error) {
    console.error("Error removing blur effect:", error);
    return false;
  }
}

// Add hook to handle blur effect initialization
Hooks.on("canvasReady", async (canvas) => {
  // Wait a short moment to ensure canvas is fully initialized
  setTimeout(async () => {
    const scene = canvas.scene;
    if (!scene) return;
    
    // Check if tactical map is active
    const isTacticalMapActive = game.user.isGM 
      ? scene.getFlag("tactical-map", "isActive")
      : game.user.getFlag("tactical-map", `isActive_${scene.id}`);
    
    const hasTacticalMapImage = scene.getFlag("tactical-map", "image");
    
    // If tactical map is active without an image, apply blur
    if (isTacticalMapActive && !hasTacticalMapImage) {
      console.log("Scene ready, applying blur effect");
      try {
        // Ensure canvas is fully ready
        if (!canvas.ready) {
          console.log("Waiting for canvas to be fully ready...");
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
        
        // Double check we have a valid target
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
        await toggleBackgroundBlur(scene);
      } catch (error) {
        console.error("Error applying blur effect on scene ready:", error);
      }
    }
  }, 100); // Wait 100ms before attempting to apply blur
});