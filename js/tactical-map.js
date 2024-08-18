import { switchTokenArt } from './token-art-switcher.js';
import { debugLog } from './logger-tcmap.js';

export async function toggleTacticalMap() {
  const scene = game.scenes.active;

  if (!scene || !scene.isView) {
    return ui.notifications.warn("You can only toggle the Tactical Map on the active scene.");
  }

  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");
  const currentMap = isTacticalMapActive ? "Tactical Map" : "Main Map";
  console.log(`Toggling from ${currentMap} to ${isTacticalMapActive ? "Main Map" : "Tactical Map"}`);
  
  scene.tokens.contents.forEach(token => {
    console.log(`Initial Position on ${currentMap}: Token ${token.name} at x: ${token.x}, y: ${token.y}, rotation: ${token.rotation}`);
  });

  if (isTacticalMapActive) {
    await storeTokenPositions(scene, "tacticalTokenPositions");
    await restoreOriginalMap(scene);
    console.log("Toggled to Main Map.");
    await restoreTokenPositions(scene, "originalTokenPositions");
    await switchTokenArt(scene, "deactivate"); // Ensure this is called
  } else {
    await storeTokenPositions(scene, "originalTokenPositions");
    await activateTacticalMap(scene);
    console.log("Toggled to Tactical Map.");
    await restoreTokenPositions(scene, "tacticalTokenPositions");
    await switchTokenArt(scene, "activate"); // Ensure this is called
  }
}

async function restoreOriginalMap(scene) {
  try {
    const originalImg = scene.getFlag("tactical-map", "originalImage");
    if (!originalImg) return ui.notifications.error("Original scene settings not found.");

    const updates = {
      "background.src": originalImg,
      width: scene.getFlag("tactical-map", "originalWidth"),
      height: scene.getFlag("tactical-map", "originalHeight"),
      "grid.type": scene.getFlag("tactical-map", "originalGridType"),
      "grid.size": scene.getFlag("tactical-map", "originalGridSize")
    };

    await scene.update(updates);
    await restoreCanvasPosition(scene);
    await restoreTokenPositions(scene, "originalTokenPositions");
    await scene.unsetFlag("tactical-map", "isActive");

    console.log("Token positions after toggling back to Main Map:");
    scene.tokens.contents.forEach(token => {
      console.log(`Token ${token.name} at x: ${token.x}, y: ${token.y}, rotation: ${token.rotation}`);
    });
  } catch (error) {
    console.error("Error restoring original map:", error);
    ui.notifications.error("Failed to restore the original map.");
  }
}

async function activateTacticalMap(scene) {
  try {
    const tacticalMapImage = scene.getFlag("tactical-map", "image");
    if (!tacticalMapImage) return ui.notifications.error("No Tactical Map image set for this scene.");

    const currentImg = scene.background?.src;
    await scene.setFlag("tactical-map", "originalImage", currentImg);
    await scene.setFlag("tactical-map", "originalWidth", scene.width);
    await scene.setFlag("tactical-map", "originalHeight", scene.height);
    await scene.setFlag("tactical-map", "originalGridType", scene.grid.type);
    await scene.setFlag("tactical-map", "originalGridSize", scene.grid.size);
    await storeCanvasPosition(scene);

    const img = new Image();
    img.src = tacticalMapImage;
    img.onload = async function () {
      const updates = {
        "background.src": tacticalMapImage,
        width: img.width,
        height: img.height,
        "grid.type": scene.getFlag("tactical-map", "gridType"),
        "grid.size": scene.getFlag("tactical-map", "gridSize")
      };

      await scene.update(updates);
      await centerCanvasOnTacticalMap(scene, img.width, img.height);
      await scene.setFlag("tactical-map", "isActive", true);
      await restoreTokenPositions(scene, "tacticalTokenPositions");
      await ensureCombatEncounter(scene);

      console.log("Token positions after toggling to Tactical Map:");
      scene.tokens.contents.forEach(token => {
        console.log(`Token ${token.name} at x: ${token.x}, y: ${token.y}, rotation: ${token.rotation}`);
      });
    };
  } catch (error) {
    console.error("Error activating Tactical Map:", error);
    ui.notifications.error("Failed to activate the Tactical Map.");
  }
}

async function restoreTokenPositions(scene, flag) {
  const tokenData = scene.getFlag("tactical-map", flag);
  if (!tokenData) return;

  const currentMap = scene.getFlag("tactical-map", "isActive") ? "Tactical Map" : "Main Map";

  for (let tokenId in tokenData) {
    const token = scene.tokens.get(tokenId);
    if (token) {
      let { x, y, rotation } = tokenData[tokenId];

      x = Math.round(x);  // Round to nearest pixel
      y = Math.round(y);  // Round to nearest pixel

      await token.update({ x, y, rotation }, { animate: false });

      console.log(`Token ${token.name} position on ${currentMap}: x: ${x}, y: ${y}, rotation: ${rotation}`);
    }
  }
}

async function storeTokenPositions(scene, flag) {
  const tokenData = {};
  scene.tokens.contents.forEach(token => {
    tokenData[token.id] = {
      x: Math.round(token.x),   // Round to nearest pixel
      y: Math.round(token.y),   // Round to nearest pixel
      rotation: token.rotation
    };
  });
  await scene.setFlag("tactical-map", flag, tokenData);
}

async function storeCanvasPosition(scene) {
  const pan = canvas.stage.pivot;
  const scale = canvas.stage.scale;
  await scene.setFlag("tactical-map", "originalPan", { x: pan.x, y: pan.y });
  await scene.setFlag("tactical-map", "originalZoom", scale.x);
}

async function restoreCanvasPosition(scene) {
  const pan = scene.getFlag("tactical-map", "originalPan");
  const zoom = scene.getFlag("tactical-map", "originalZoom");
  if (pan && zoom) {
    canvas.pan({ x: pan.x, y: pan.y, scale: zoom });
  }
}

async function centerCanvasOnTacticalMap(scene, width, height) {
  const viewRect = canvas.dimensions.sceneRect;
  const scale = Math.min(viewRect.width / width, viewRect.height / height) * 0.4;
  const x = width / 2;
  const y = height / 2;
  canvas.pan({ x, y, scale });
}

async function ensureCombatEncounter(scene) {
  let combat = game.combats.active;
  if (!combat) {
    combat = await Combat.create({ scene: scene.id, active: true });
  }

  if (scene.getFlag("tactical-map", "addTokensToEncounter")) {
    const tokens = scene.tokens.contents;
    for (const token of tokens) {
      const existingCombatant = combat.combatants.find(c => c.tokenId === token.id);
      if (!existingCombatant) {
        await combat.createEmbeddedDocuments("Combatant", [{
          tokenId: token.id,
          sceneId: scene.id,
          actorId: token.actor?.id
        }]);
      }
    }
  }
}

Hooks.on("createToken", async (scene, tokenData) => {
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");

  if (isTacticalMapActive) {
    console.log(`Adding Token ${tokenData.name} in Tactical Map at x: ${tokenData.x}, y: ${tokenData.y}`);
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
    tokenPositions[tokenId] = { x, y };
    await scene.setFlag("tactical-map", flag, tokenPositions);
  }
}
