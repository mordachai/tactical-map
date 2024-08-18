// token-art-switcher.js

import { debugLog } from './logger-tcmap.js';

Hooks.once('ready', () => {
  debugLog("token-art-switcher.js loaded");
});

export async function switchTokenArt(scene, action) {
  debugLog(`Switching token art due to Tactical Map ${action}`);

  const tokens = scene.tokens.contents;
  const useAlternativeTokenArt = game.settings.get("tactical-map", "useAlternativeTokenArt");
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

  const suffix = mapType === "top-down" ? "_tdv" : "_isv";

  for (let token of tokens) {
    const texture = token.texture?.src || token.data?.texture?.src || token.document?.texture?.src;

    if (!texture) {
      debugLog(`Token '${token.name}' does not have a valid texture property. Token data:`, token);
      continue;
    }

    if (action === "activate") {
      if (!token.getFlag("tactical-map", "originalImage")) {
        await token.setFlag("tactical-map", "originalImage", texture);
        debugLog(`[${action}] Registered Original Image for '${token.name}': ${texture}`);
      }
      const originalImg = token.getFlag("tactical-map", "originalImage");
      const fileName = originalImg.split("/").pop().split(".")[0];
      const fileExtension = originalImg.split(".").pop();

      const newFileName = `${fileName}${suffix}.${fileExtension}`;
      const newImgPath = originalImg.replace(`${fileName}.${fileExtension}`, newFileName);

      // Check if the alternative image exists before applying it
      const fileExists = await doesFileExist(newImgPath);
      if (fileExists) {
        debugLog(`[${action}] Applying alternative token image for '${token.name}': ${newImgPath}`);
        await applyImageUpdate(token, newImgPath);
      } else {
        debugLog(`[${action}] Alternative token image not found for '${token.name}'. Using original image.`);
      }
    } else if (action === "deactivate") {
      debugLog(`[${action}] Deactivation triggered for token '${token.name}'`);

      const originalImage = token.getFlag("tactical-map", "originalImage");
      debugLog(`[${action}] Image to be restored for '${token.name}':`, originalImage);

      if (originalImage) {
        await applyImageUpdate(token, originalImage);
        debugLog(`[${action}] Restored original image for '${token.name}': ${originalImage}`);
      } else {
        debugLog(`[${action}] No original image found for '${token.name}', keeping the current image.`);
      }
    }

    const finalImg = token.texture?.src || token.data?.texture?.src || token.document?.texture?.src;
    debugLog(`[${action}] Final Token Image for '${token.name}':`, finalImg);
  }
}

async function applyImageUpdate(token, imagePath) {
  try {
    await token.update({ "texture.src": imagePath }, { animate: false });  // Disable animation
    const updatedImg = token.texture?.src || token.data?.texture?.src || token.document?.texture?.src;
    debugLog(`applyImageUpdate: Successfully updated token '${token.name}' to image: ${updatedImg}`);
  } catch (error) {
    console.error(`applyImageUpdate: Error updating token '${token.name}' to image '${imagePath}':`, error);
  }
}

// Utility function to check if the file exists
async function doesFileExist(filePath) {
  try {
    const response = await FilePicker.browse("data", filePath);
    return response.files.length > 0;
  } catch (error) {
    return false; // If the file doesn't exist or there's an error, return false
  }
}
