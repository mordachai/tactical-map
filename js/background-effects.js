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
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive") || false;
  const hasTacticalMapImage = scene.getFlag("tactical-map", "image") || false;
  
  // Blur should be active if tactical map is active AND there's no image
  const shouldBlurBeActive = isTacticalMapActive && !hasTacticalMapImage;
  
  // Get current blur state
  const isBlurActive = scene.getFlag("tactical-map", "blurActive") || false;
  
  // If no change needed, exit
  if (shouldBlurBeActive === isBlurActive) {
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
  
  // Get the blur amount from scene flags
  const blurAmount = scene.getFlag("tactical-map", "blurAmount") || 10;
  
  // Use modern filter with appropriate fallback
  const BlurFilterClass = PIXI.filters.BlurFilterDeprecated || PIXI.filters.BlurFilter;
  
  // If we need to activate blur
  if (shouldBlurBeActive && !isBlurActive) {
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
    
    // Set the flag to remember blur is active
    await scene.setFlag("tactical-map", "blurActive", true);
    
    // Animate the blur from 0 to the target amount
    animateBlur(blurFilter, 0, blurAmount, 500);
    
    debugLog(`Background blur enabled with animated amount: ${blurAmount}`);
    return true;
  } 
  // If we need to deactivate blur
  else if (!shouldBlurBeActive && isBlurActive) {
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
      
      // Update flag
      await scene.setFlag("tactical-map", "blurActive", false);
      
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
    
    debugLog(`Animated blur amount from ${currentAmount} to: ${newAmount}`);
  }
}

// Function to force apply blur effect
export async function forceApplyBlur(scene) {
  if (!canvas || !canvas.ready || !scene) {
    console.error("Canvas or scene not ready");
    return new Promise((resolve) => {
      // Wait for canvas to be ready
      const checkCanvas = () => {
        if (canvas && canvas.ready && scene) {
          // Canvas is ready, apply blur and resolve
          forceApplyBlur(scene).then(resolve);
        } else if (game.canvas) {
          // Try again in 100ms
          setTimeout(checkCanvas, 100);
        } else {
          // Give up after too many attempts
          console.error("Could not apply blur - canvas never ready");
          resolve(false);
        }
      };
      setTimeout(checkCanvas, 100);
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
    console.error("Could not find a valid background layer");
    return false;
  }
  
  // Get the blur amount from scene flags
  const blurAmount = scene.getFlag("tactical-map", "blurAmount") || 10;
  
  // Use modern filter with appropriate fallback
  const BlurFilterClass = PIXI.filters.BlurFilterDeprecated || PIXI.filters.BlurFilter;
  
  // Initialize filters array if it doesn't exist
  target.filters = target.filters || [];
  
  // Remove any existing blur filters first to avoid duplicates
  target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
  
  // Create new blur filter
  const blurFilter = new BlurFilterClass();
  blurFilter.blur = 0;
  blurFilter.quality = 3;
  
  // Add the new blur filter
  target.filters.push(blurFilter);
  
  // Set the flag to remember blur is active
  await scene.setFlag("tactical-map", "blurActive", true);
  
  // Animate the blur from 0 to the target amount
  animateBlur(blurFilter, 0, blurAmount, 500);
  
  debugLog(`Background blur FORCED with animated amount: ${blurAmount}`);
  return true;
}

// Function to force remove blur effect
export async function forceRemoveBlur(scene) {
  if (!canvas || !canvas.ready || !scene) {
    console.error("Canvas or scene not ready");
    return new Promise((resolve) => {
      // Wait for canvas to be ready
      const checkCanvas = () => {
        if (canvas && canvas.ready && scene) {
          // Canvas is ready, apply blur and resolve
          forceRemoveBlur(scene).then(resolve);
        } else if (game.canvas) {
          // Try again in 100ms
          setTimeout(checkCanvas, 100);
        } else {
          // Give up after too many attempts
          console.error("Could not apply blur - canvas never ready");
          resolve(false);
        }
      };
      setTimeout(checkCanvas, 100);
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
    console.error("Could not find a valid background layer");
    return false;
  }
  
  // Use modern filter with appropriate fallback
  const BlurFilterClass = PIXI.filters.BlurFilterDeprecated || PIXI.filters.BlurFilter;
  
  // Check if target has filters
  if (target.filters) {
    // Find blur filter
    const blurFilter = target.filters.find(f => f instanceof BlurFilterClass);
    
    if (blurFilter) {
      // Get current blur amount
      const currentBlur = blurFilter.blur;
      
      // Animate blur to 0
      animateBlur(blurFilter, currentBlur, 0, 500, () => {
        // After animation completes, remove the filter
        if (target.filters) {
          target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
          
          if (target.filters.length === 0) {
            target.filters = null;
          }
        }
      });
    } else {
      // No blur filter found, just clean up
      target.filters = target.filters.filter(f => !(f instanceof BlurFilterClass));
      
      if (target.filters.length === 0) {
        target.filters = null;
      }
    }
  }
  
  // Update flag
  await scene.setFlag("tactical-map", "blurActive", false);
  
  debugLog("Background blur FORCED to disable with animation");
  return true;
}