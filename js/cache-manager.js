// Add this cache module to your project
// cache-manager.js

/**
 * Simple caching system for the Tactical Map module
 * Handles caching token positions, file existence checks, and image dimensions
 */
class TacticalMapCache {
  constructor() {
    this.fileCache = {};         // Cache for file existence
    this.imageDimensionCache = {}; // Cache for image dimensions
    this.cacheTimeout = 3600000; // 1 hour cache timeout
    
    // Initialize and clear expired items
    this._initialize();
  }
  
  /**
   * Initialize the cache
   * @private
   */
  _initialize() {
    // Clear expired cache items periodically
    setInterval(() => this._clearExpiredItems(), 300000); // Every 5 minutes
    
    // Clear cache when a new scene is loaded
    Hooks.on("canvasReady", () => {
      this.clearCache("fileCache");
    });
  }
  
  /**
   * Clear expired cache items
   * @private
   */
  _clearExpiredItems() {
    const now = Date.now();
    
    // Clear expired file cache
    Object.keys(this.fileCache).forEach(key => {
      if (this.fileCache[key].timestamp + this.cacheTimeout < now) {
        delete this.fileCache[key];
      }
    });
    
    // Clear expired image dimension cache
    Object.keys(this.imageDimensionCache).forEach(key => {
      if (this.imageDimensionCache[key].timestamp + this.cacheTimeout < now) {
        delete this.imageDimensionCache[key];
      }
    });
  }
  
  /**
   * Set a file existence value in the cache
   * @param {string} path - File path
   * @param {boolean} exists - Whether the file exists
   */
  setFileExists(path, exists) {
    this.fileCache[path] = {
      value: exists,
      timestamp: Date.now()
    };
  }
  
  /**
   * Get a file existence value from the cache
   * @param {string} path - File path
   * @returns {boolean|undefined} Cached result or undefined if not cached
   */
  getFileExists(path) {
    return this.fileCache[path]?.value;
  }
  
  /**
   * Set image dimensions in the cache
   * @param {string} path - Image path
   * @param {Object} dimensions - Image dimensions {width, height}
   */
  setImageDimensions(path, dimensions) {
    this.imageDimensionCache[path] = {
      value: dimensions,
      timestamp: Date.now()
    };
  }
  
  /**
   * Get image dimensions from the cache
   * @param {string} path - Image path
   * @returns {Object|undefined} Cached dimensions or undefined if not cached
   */
  getImageDimensions(path) {
    return this.imageDimensionCache[path]?.value;
  }
  
  /**
   * Clear a specific cache type
   * @param {string} cacheType - Type of cache to clear ("fileCache" or "imageDimensionCache")
   */
  clearCache(cacheType) {
    if (cacheType === "fileCache") {
      this.fileCache = {};
    } else if (cacheType === "imageDimensionCache") {
      this.imageDimensionCache = {};
    } else if (cacheType === "all") {
      this.fileCache = {};
      this.imageDimensionCache = {};
    }
  }
}

// Export a singleton instance
export const tacticalMapCache = new TacticalMapCache();

// Updated image loading function with caching
export async function loadImageWithCache(src) {
  // Try to get dimensions from cache first
  const cachedDimensions = tacticalMapCache.getImageDimensions(src);
  if (cachedDimensions) {
    debugLog(`Using cached dimensions for ${src}`, cachedDimensions);
    return cachedDimensions;
  }
  
  // Load image if not cached
  try {
    const dimensions = await loadImagePromise(src);
    // Cache the result
    tacticalMapCache.setImageDimensions(src, dimensions);
    return dimensions;
  } catch (error) {
    console.error(`Failed to load image: ${src}`, error);
    throw error;
  }
}

// Updated file existence check with caching
export async function doesFileExistWithCache(filePath) {
  // Try to get existence from cache first
  const cachedResult = tacticalMapCache.getFileExists(filePath);
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  
  // Check existence if not cached
  const exists = await doesFileExist(filePath);
  // Cache the result
  tacticalMapCache.setFileExists(filePath, exists);
  return exists;
}

// Updated token position restoration with performance optimizations
async function restoreTokenPositionsOptimized(scene, flag) {
  const tokenData = scene.getFlag("tactical-map", "tokenData")?.[flag];
  if (!tokenData) return;

  const currentMap = scene.getFlag("tactical-map", "isActive") ? "Tactical Map" : "Main Map";
  
  // Set up a bulk update
  const bulkUpdates = [];
  
  // Create update objects for each token
  for (let tokenId in tokenData) {
    const token = scene.tokens.get(tokenId);
    if (token) {
      let { x, y, rotation, scale, elevation, hidden } = tokenData[tokenId];

      // Round to nearest pixel for precision
      x = Math.round(x);
      y = Math.round(y);
      
      bulkUpdates.push({
        _id: tokenId,
        x, y, rotation,
        ...(scale !== undefined && { scale }),
        ...(elevation !== undefined && { elevation }),
        ...(hidden !== undefined && { hidden })
      });
    }
  }
  
  // Only perform update if we have tokens to update
  if (bulkUpdates.length > 0) {
    // Temporarily pause canvas rendering for performance
    canvas.freeze();
    
    try {
      await scene.updateEmbeddedDocuments("Token", bulkUpdates, { animate: false });
      debugLog(`Bulk updated ${bulkUpdates.length} tokens on ${currentMap}`);
    } catch (error) {
      console.error("Error updating token positions:", error);
    } finally {
      // Resume canvas rendering
      canvas.thaw();
    }
  }
}

// Helper function to minimize canvas refreshes during updates
async function batchCanvasOperations(callback) {
  // Pause canvas refreshes
  canvas.freeze();
  
  try {
    // Execute the callback
    await callback();
  } finally {
    // Resume canvas refreshes
    canvas.thaw();
  }
}
