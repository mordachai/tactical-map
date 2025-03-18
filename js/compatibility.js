// compatibility.js
import { debugLog } from './logger-tcmap.js';

/**
 * Check if the current Foundry VTT version is v13 or later
 * @returns {boolean} True if v13 or later
 */
export function isV13OrLater() {
  return game.version && isNewerVersion(game.version, '13.0');
}

/**
 * Update a token with compatibility for v12 and v13
 * @param {Token} token - The token to update
 * @param {Object} updateData - The data to update
 * @param {Object} options - Update options
 * @returns {Promise} Update promise
 */
export async function updateTokenCompatible(token, updateData, options = {}) {
  if (isV13OrLater()) {
    // V13 syntax - token.document is the source of truth
    return token.document.update(updateData, options);
  } else {
    // V12 syntax
    return token.update(updateData, options);
  }
}

/**
 * Get token texture source with compatibility for v12 and v13
 * @param {Token} token - The token
 * @returns {string} Texture source path
 */
export function getTokenTexture(token) {
  if (isV13OrLater()) {
    // V13 syntax
    return token.document.texture?.src;
  } else {
    // V12 syntax - check multiple possible locations
    return token.texture?.src || token.data?.texture?.src;
  }
}

/**
 * Set token image with compatibility for v12 and v13
 * @param {Token} token - The token
 * @param {string} imagePath - Path to the image
 * @returns {Promise} Update promise
 */
export async function setTokenImage(token, imagePath) {
  try {
    if (isV13OrLater()) {
      // V13 syntax
      await token.document.update({ "texture.src": imagePath }, { animate: false });
    } else {
      // V12 syntax
      await token.update({ "texture.src": imagePath }, { animate: false });
    }
    
    debugLog(`Successfully updated token '${token.name}' to image: ${imagePath}`);
  } catch (error) {
    console.error(`Error updating token '${token.name}' image:`, error);
  }
}

/**
 * Get scene tokens with compatibility for v12 and v13
 * @param {Scene} scene - The scene
 * @returns {Array} Array of tokens
 */
export function getSceneTokens(scene) {
  if (isV13OrLater()) {
    // V13 syntax - tokens are accessed differently in v13
    return scene.tokens.contents;
  } else {
    // V12 syntax
    return scene.tokens.contents;
  }
}

/**
 * Browse files with FilePicker with compatibility for v12 and v13
 * @param {string} source - The source
 * @param {string} target - The target path
 * @returns {Promise<Object>} FilePicker browse result
 */
export async function browseFiles(source, target) {
  try {
    // In v13, FilePicker.browse returns a Promise
    if (isV13OrLater()) {
      return await FilePicker.browse(source, target);
    } else {
      // In v12, we need to use a callback-based approach or older Promise format
      return new Promise((resolve, reject) => {
        FilePicker.browse(source, target).then(resolve).catch(reject);
      });
    }
  } catch (error) {
    console.error("Error browsing files:", error);
    return { files: [] };
  }
}