function createFormGroup(label, inputHtml) {
  return `
    <div class="form-group">
      <label>${label}</label>
      <div class="form-fields">
        ${inputHtml}
      </div>
    </div>
  `;
}

function addTacticalMapToSceneConfig() {
  Hooks.on("renderSceneConfig", (app, html, data) => {
    try {
      const fgImgLabel = html.find('label:contains("Foreground Image")');
      if (!fgImgLabel.length) return;

      const fgImgGroup = fgImgLabel.closest('.form-group');
      if (!fgImgGroup.length) return;

      const tacticalMapHtml = `
        ${createFormGroup("Tactical Map Image", `
          <input type="text" name="tacticalMapImage" value="${app.object.getFlag("tactical-map", "image") || ""}" placeholder="path/to/tactical/map/image">
          <button type="button" class="file-picker" data-type="image" data-target="input[name='tacticalMapImage']" title="Browse Files">
            <i class="fas fa-file-import"></i>
          </button>
        `)}
        <p class="notes">An optional image to be used during tactical combat or similar scenarios.</p>

        <div class="form-group">
          <label>Tactical Map Grid Type / Size</label>
          <div class="form-fields">
            <select name="tacticalMapGridType" style="flex: 1.0;">
              ${[
                { value: 0, text: "Gridless" },
                { value: 1, text: "Square" },
                { value: 2, text: "Hexagonal Rows - Odd" },
                { value: 3, text: "Hexagonal Rows - Even" },
                { value: 4, text: "Hexagonal Columns - Odd" },
                { value: 5, text: "Hexagonal Columns - Even" }
              ].map(option => `<option value="${option.value}" ${app.object.getFlag("tactical-map", "gridType") === option.value ? "selected" : ""}>${option.text}</option>`).join('')}
            </select> / 
            <input type="number" name="tacticalMapGridSize" value="${app.object.getFlag("tactical-map", "gridSize") || 100}" style="flex: 0.5;">
          </div>
        </div>

        ${createFormGroup("Add Tokens to Encounter", `
          <input type="checkbox" name="addTokensToEncounter" ${app.object.getFlag("tactical-map", "addTokensToEncounter") ? "checked" : ""}>
        `)}
      `;

      $(tacticalMapHtml).insertAfter(fgImgGroup);

      html.find("button.file-picker").last().click(ev => openFilePicker(app, html));
    } catch (error) {
      console.error("Error during SceneConfig rendering:", error);
    }
  });

  Hooks.on("closeSceneConfig", async (app, html) => {
    try {
      const flagData = {
        image: html.find("input[name='tacticalMapImage']").val(),
        gridType: parseInt(html.find("select[name='tacticalMapGridType']").val()),
        gridSize: parseInt(html.find("input[name='tacticalMapGridSize']").val()),
        addTokensToEncounter: html.find("input[name='addTokensToEncounter']").is(":checked")
      };

      for (let key in flagData) {
        await app.object.setFlag("tactical-map", key, flagData[key]);
      }
    } catch (error) {
      console.error("Error saving Tactical Map settings:", error);
      ui.notifications.error("Failed to save Tactical Map settings. Please check the console for more details.");
    }
  });
}

function openFilePicker(app, html) {
  const picker = new FilePicker({
    type: "image",
    current: app.object.getFlag("tactical-map", "image") || "",
    callback: path => html.find("input[name='tacticalMapImage']").val(path)
  });
  picker.browse();
}

function addTacticalMapButtonToTokenControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.find(control => control.name === "token");

    if (tokenControls) {
      tokenControls.tools.push({
        name: "toggleTacticalMap",
        title: "Toggle Tactical Map",
        icon: "fas fa-map-marked-alt",
        visible: game.user.isGM,
        onClick: toggleTacticalMap,
        button: true
      });
    }
  });
}

async function toggleTacticalMap() {
  const scene = game.scenes.active;

  // Check if the scene is active
  if (!scene || !scene.isView) {
    return ui.notifications.warn("You can only toggle the Tactical Map on the active scene.");
  }

  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");
  if (isTacticalMapActive) {
    await storeTokenPositions(scene, "tacticalTokenPositions");
    await restoreOriginalMap(scene);
  } else {
    await storeTokenPositions(scene, "originalTokenPositions");
    await activateTacticalMap(scene);
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
    };
  } catch (error) {
    console.error("Error activating Tactical Map:", error);
    ui.notifications.error("Failed to activate the Tactical Map.");
  }
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

async function storeTokenPositions(scene, flag) {
  const tokenPositions = {};
  scene.tokens.contents.forEach(token => {
    tokenPositions[token.id] = { x: token.x, y: token.y };
  });
  await scene.setFlag("tactical-map", flag, tokenPositions);
}

async function restoreTokenPositions(scene, flag) {
  const tokenPositions = scene.getFlag("tactical-map", flag);
  if (!tokenPositions) return;

  for (let tokenId in tokenPositions) {
    const token = scene.tokens.get(tokenId);
    if (token) {
      await token.update(tokenPositions[tokenId], { animate: false });
    }
  }
}

// Hook to handle new tokens being added to the scene
Hooks.on("createToken", async (scene, tokenData) => {
  const isTacticalMapActive = scene.getFlag("tactical-map", "isActive");
  
  if (isTacticalMapActive) {
    // If the Tactical Map is active, set initial position on the main map
    await positionTokenOnInactiveMap(scene, tokenData, "originalTokenPositions");
  } else {
    // If the main map is active, set initial position on the Tactical Map
    await positionTokenOnInactiveMap(scene, tokenData, "tacticalTokenPositions");
  }
});

// Function to position a token near the center of the inactive map
async function positionTokenOnInactiveMap(scene, tokenData, flag) {
  const tokenId = tokenData._id;
  const tokenPositions = scene.getFlag("tactical-map", flag) || {};
  const centerX = scene.width / 2;
  const centerY = scene.height / 2;

  // Check if token is already positioned in the inactive map; if not, position it near the center
  if (!tokenPositions[tokenId]) {
    tokenPositions[tokenId] = { x: centerX, y: centerY };
    await scene.setFlag("tactical-map", flag, tokenPositions);
  }
}

Hooks.once('init', () => {
  addTacticalMapToSceneConfig();
  addTacticalMapButtonToTokenControls();
});
