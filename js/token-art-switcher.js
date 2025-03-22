// token-art-switcher.js

import { debugLog } from './logger-tcmap.js';
import { getTokenTexture, updateTokenCompatible, browseFiles } from './compatibility.js';


Hooks.once('ready', () => {
  debugLog("token-art-switcher.js loaded");
});

// Improved token art switcher with caching and better error handling
export async function switchTokenArt(scene, action) {
  debugLog(`Switching token art due to Tactical Map ${action}`);

  // Check if setting is registered first
  let useAlternativeTokenArt = false;
  try {
    useAlternativeTokenArt = game.settings.get("tactical-map", "useAlternativeTokenArt");
  } catch (error) {
    debugLog("useAlternativeTokenArt setting not registered yet");
    return; // Exit if setting isn't available
  }
  
  debugLog("Use Alternative Token Art Setting:", useAlternativeTokenArt);
  
  if (!useAlternativeTokenArt) {
    debugLog("Alternative token art setting is disabled.");
    return;
  }

  const mapType = scene.getFlag("tactical-map", "mapType");
  debugLog("Tactical Map Type:", mapType);

  if (!mapType) {
    debugLog("No Tactical Map Type set.");
    return;
  }

  // Get appropriate suffix based on map type
  const suffix = mapType === "top-down" ? "_tdv" : "_isv";
  
  // Get all tokens in the scene
  const tokens = scene.tokens.contents;
  
  // Initialize a cache for file existence checks
  const fileExistsCache = {};
  
  // Process tokens in batches to avoid overloading
  const BATCH_SIZE = 5;
  const batches = Math.ceil(tokens.length / BATCH_SIZE);
  
  for (let i = 0; i < batches; i++) {
    const batchTokens = tokens.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const tokenUpdates = [];
    
    // Process each token in the current batch
    for (let token of batchTokens) {
      try {
        const texture = getTokenTexture(token);
        
        if (!texture) {
          debugLog(`Token '${token.name}' does not have a valid texture property.`);
          continue;
        }
        
        if (action === "activate") {
          // Store original image if not already stored
          if (!token.getFlag("tactical-map", "originalImage")) {
            await token.setFlag("tactical-map", "originalImage", texture);
            debugLog(`[${action}] Registered Original Image for '${token.name}': ${texture}`);
          }
          
          const originalImg = token.getFlag("tactical-map", "originalImage");
          const pathInfo = parseImagePath(originalImg);
          
          // Create the new image path
          const newImgPath = createAlternativeImagePath(pathInfo, suffix);
          
          // Check if alternative image exists (using cache to reduce checks)
          let fileExists = fileExistsCache[newImgPath];
          if (fileExists === undefined) {
            fileExists = await doesFileExist(newImgPath);
            fileExistsCache[newImgPath] = fileExists;
          }
          
          if (fileExists) {
            debugLog(`[${action}] Applying alternative image to '${token.name}': ${newImgPath}`);
            tokenUpdates.push({ _id: token.id, "texture.src": newImgPath });
          } else {
            debugLog(`[${action}] Alternative image not found for '${token.name}': ${newImgPath}`);
          }
        } else if (action === "deactivate") {
          // Restore the original image
          const originalImage = token.getFlag("tactical-map", "originalImage");
          
          if (originalImage) {
            debugLog(`[${action}] Restoring original image for '${token.name}': ${originalImage}`);
            tokenUpdates.push({ _id: token.id, "texture.src": originalImage });
          }
        }
      } catch (error) {
        console.error(`Error processing token '${token.name}':`, error);
      }
    }
    
    // Apply batch updates if there are any
    if (tokenUpdates.length > 0) {
      try {
        await scene.updateEmbeddedDocuments("Token", tokenUpdates);
        debugLog(`Updated ${tokenUpdates.length} tokens in batch ${i+1}/${batches}`);
      } catch (error) {
        console.error(`Error updating tokens in batch ${i+1}:`, error);
      }
    }
    
    // Small delay between batches to avoid UI freezing
    if (i < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  debugLog(`Token art switching complete for ${action} action`);
}

// Helper function to parse image path
function parseImagePath(imagePath) {
  // Handle URLs with query parameters
  const urlParts = imagePath.split('?');
  const path = urlParts[0];
  const query = urlParts.length > 1 ? `?${urlParts[1]}` : '';
  
  // Split the path to get directory, filename, and extension
  const lastSlashIndex = path.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? path.substring(0, lastSlashIndex + 1) : '';
  const filenameWithExt = lastSlashIndex >= 0 ? path.substring(lastSlashIndex + 1) : path;
  
  const lastDotIndex = filenameWithExt.lastIndexOf('.');
  const filename = lastDotIndex >= 0 ? filenameWithExt.substring(0, lastDotIndex) : filenameWithExt;
  const extension = lastDotIndex >= 0 ? filenameWithExt.substring(lastDotIndex) : '';
  
  return { directory, filename, extension, query };
}

// Helper function to create alternative image path
function createAlternativeImagePath(pathInfo, suffix) {
  const { directory, filename, extension, query } = pathInfo;
  
  // Check if filename already has a suffix we need to replace
  let baseFilename = filename;
  if (baseFilename.endsWith('_tdv') || baseFilename.endsWith('_isv')) {
    baseFilename = baseFilename.substring(0, baseFilename.length - 4);
  }
  
  return `${directory}${baseFilename}${suffix}${extension}${query}`;
}

// Improved file existence check
async function doesFileExist(filePath) {
  // For direct URLs, return true as we can't easily check
  if (filePath.startsWith('http') && !filePath.includes(window.location.hostname)) {
    return true;
  }
  
  try {
    // Extract the core path for FilePicker (remove query params)
    const corePath = filePath.split('?')[0];
    
    // Determine source and path for FilePicker
    let source = "data";
    let path = corePath;
    
    // Handle s3, forge URLs etc.
    if (corePath.includes(':')) {
      const parts = corePath.split(':');
      source = parts[0];
      path = parts.slice(1).join(':');
    }
    
    // Remove leading slash for FilePicker paths
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // Get directory and filename
    const lastSlash = path.lastIndexOf('/');
    const directory = lastSlash >= 0 ? path.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
    
    // Browse the directory and check if the file exists
    const browseResult = await browseFiles(source, directory);
    return browseResult.files.some(f => f.endsWith(filename));
  } catch (error) {
    console.error(`File existence check failed for ${filePath}:`, error);
    return false;
  }
}