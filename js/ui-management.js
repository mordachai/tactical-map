import { toggleTacticalMap } from './tactical-map.js';  // Import the toggle function

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

        ${createFormGroup("Tactical Map Type", `
          <select name="tacticalMapType" style="flex: 1.0;">
            <option value="top-down" ${app.object.getFlag("tactical-map", "mapType") === "top-down" ? "selected" : ""}>Top-down</option>
            <option value="isometric" ${app.object.getFlag("tactical-map", "mapType") === "isometric" ? "selected" : ""}>Isometric View</option>
          </select>
        `)}

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
        mapType: html.find("select[name='tacticalMapType']").val(), // Save Tactical Map Type
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

Hooks.once('init', () => {
  addTacticalMapToSceneConfig();
  addTacticalMapButtonToTokenControls();
});

