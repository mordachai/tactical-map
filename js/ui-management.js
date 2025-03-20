// js/ui-management.js
import { toggleTacticalMap } from './tactical-map.js';
import { debugLog } from './logger-tcmap.js';

/**
 * Adds a Tactical Map tab to the Scene Configuration window
 */
function addTacticalMapTabToSceneConfig() {
  Hooks.on("renderSceneConfig", (app, html, data) => {
    try {
      // Get the main tabs navigation
      const mainTabs = html.find('nav.sheet-tabs[data-group="main"]');
      
      // Check if our tab already exists (prevents duplicates)
      if (mainTabs.find('a[data-tab="tacticalMap"]').length === 0) {
        // Add new tab button to main tabs
        mainTabs.append('<a class="item" data-tab="tacticalMap"><i class="fas fa-map-marked-alt"></i> Tactical Map</a>');
        
        // Create our tab content
        const tabContent = createTacticalMapTabHtml(app);
        
        // Add the tab content after other main tabs
        const mainTabsContent = html.find('form > div.tab[data-group="main"]').last();
        tabContent.insertAfter(mainTabsContent);
        
        // Re-initialize the tabs
        app._tabs[0].bind(html[0]);
        
        // Add event listener for image path changes
        html.find("input[name='tacticalMapImage']").on('change', function() {
          updateImagePreview(html, $(this).val());
        });
        
        // Initialize file picker
        html.find("button.tacticalmap-filepicker").click(ev => {
          const button = ev.currentTarget;
          const target = button.dataset.target;
          const input = html.find(target);
          
          const picker = new FilePicker({
            type: "image",
            current: input.val(),
            callback: path => {
              input.val(path);
              updateImagePreview(html, path);
            }
          });
          picker.browse();
        });
        
        debugLog("Tactical Map tab added to Scene Config");
      }
      
      // Remove any duplicate tabs in ambience section (if they exist)
      html.find('nav.secondary-tabs a[data-tab="tacticalMap"]').remove();
      
    } catch (error) {
      console.error("Error adding Tactical Map tab:", error);
    }
  });

  // Save settings when the form is closed
  Hooks.on("closeSceneConfig", async (app, html) => {
    try {
      const flagData = {
        image: html.find("input[name='tacticalMapImage']").val(),
        mapType: html.find("select[name='tacticalMapType']").val(),
        gridType: parseInt(html.find("select[name='tacticalMapGridType']").val()) || 1,
        gridSize: parseInt(html.find("input[name='tacticalMapGridSize']").val()) || 100,
        addTokensToEncounter: html.find("input[name='addTokensToEncounter']").is(":checked")
      };

      for (let key in flagData) {
        await app.object.setFlag("tactical-map", key, flagData[key]);
      }
      
      debugLog("Tactical Map settings saved:", flagData);
    } catch (error) {
      console.error("Error saving Tactical Map settings:", error);
      ui.notifications.error("Failed to save Tactical Map settings.");
    }
  });
}

/**
 * Creates the HTML content for the Tactical Map tab
 */
function createTacticalMapTabHtml(app) {
  // Get current values
  const scene = app.object;
  const tacticalMapImage = scene.getFlag("tactical-map", "image") || "";
  const tacticalMapType = scene.getFlag("tactical-map", "mapType") || "top-down";
  const tacticalGridType = scene.getFlag("tactical-map", "gridType") || 1;
  const tacticalGridSize = scene.getFlag("tactical-map", "gridSize") || scene.grid.size;
  const addTokensToEncounter = scene.getFlag("tactical-map", "addTokensToEncounter") || false;
  
  // Grid settings - if tactical grid settings exist, use them, otherwise use main grid settings
  const tacticalGridScale = scene.getFlag("tactical-map", "gridScale") || { distance: scene.grid.distance, units: scene.grid.units };
  const tacticalGridStyle = scene.getFlag("tactical-map", "gridStyle") || scene.grid.style;
  const tacticalGridThickness = scene.getFlag("tactical-map", "gridThickness") || scene.grid.thickness;
  const tacticalGridColor = scene.getFlag("tactical-map", "gridColor") || scene.grid.color;
  const tacticalGridAlpha = scene.getFlag("tactical-map", "gridAlpha") || scene.grid.alpha;
  
  // Is the tactical map image set? This determines which UI controls are enabled
  const hasTacticalMap = !!tacticalMapImage;
  
  // Create grid type options
  const gridTypeOptions = [
    { value: 0, text: "Gridless" },
    { value: 1, text: "Square" },
    { value: 2, text: "Hexagonal Rows - Odd" },
    { value: 3, text: "Hexagonal Rows - Even" },
    { value: 4, text: "Hexagonal Columns - Odd" },
    { value: 5, text: "Hexagonal Columns - Even" }
  ].map(option => 
    `<option value="${option.value}" ${tacticalGridType === option.value ? "selected" : ""}>${option.text}</option>`
  ).join('');
  
  // Grid style options
  const gridStyleOptions = [
    { value: "solidLines", text: "Solid Lines" },
    { value: "dashedLines", text: "Dashed Lines" },
    { value: "dottedLines", text: "Dotted Lines" },
    { value: "squarePoints", text: "Square Points" },
    { value: "diamondPoints", text: "Diamond Points" },
    { value: "roundPoints", text: "Round Points" }
  ].map(option => 
    `<option value="${option.value}" ${tacticalGridStyle === option.value ? "selected" : ""}>${option.text}</option>`
  ).join('');
  
  // Create HTML for tab content
  return $(`
    <div class="tab" data-group="main" data-tab="tacticalMap">
      <div class="form-group">
        <label>Tactical Map Image</label>
        <div class="form-fields">
          <input type="text" name="tacticalMapImage" value="${tacticalMapImage}" placeholder="path/to/tactical/map/image">
          <button type="button" class="tacticalmap-filepicker file-picker" data-type="image" data-target="input[name='tacticalMapImage']" title="Browse Files">
            <i class="fas fa-file-import"></i>
          </button>
        </div>
        <p class="notes">An optional image to be used during tactical combat or similar scenarios.</p>
      </div>

      <div class="form-group">
        <label>Tactical Map Type</label>
        <div class="form-fields">
          <select name="tacticalMapType">
            <option value="top-down" ${tacticalMapType === "top-down" ? "selected" : ""}>Top-down</option>
            <option value="isometric" ${tacticalMapType === "isometric" ? "selected" : ""}>Isometric View</option>
          </select>
        </div>
        <p class="notes">The view type affects token art switching if enabled in module settings.</p>
      </div>

      <hr>
      <h3>Grid Settings</h3>

      <div class="form-group">
        <label>Grid Type</label>
        <div class="form-fields">
          <select name="tacticalMapGridType">
            ${gridTypeOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Grid Size <span class="units">(Pixels)</span></label>
        <div class="form-fields">
          <input type="number" name="tacticalMapGridSize" value="${tacticalGridSize}" min="20" step="1" placeholder="Pixels" ${!hasTacticalMap ? 'disabled' : ''}>
        </div>
        <p class="notes">${!hasTacticalMap ? 'Grid size is locked to match the main scene when no tactical map image is set.' : 'The pixel size of a single grid space.'}</p>
      </div>

      <div class="form-group">
        <label>Grid Scale</label>
        <div class="form-fields">
          <label class="grid-label">Distance</label>
          <input type="number" name="tacticalMapGridScale.distance" value="${tacticalGridScale.distance}" step="any" placeholder="1" ${!hasTacticalMap ? 'disabled' : ''}>
          <label class="grid-label">Units</label>
          <input type="text" name="tacticalMapGridScale.units" placeholder="None" value="${tacticalGridScale.units}" ${!hasTacticalMap ? 'disabled' : ''}>
        </div>
        <p class="notes">${!hasTacticalMap ? 'Grid scale settings are shared with the main scene when no tactical map image is set.' : 'The distance and unit settings for the tactical map grid.'}</p>
      </div>

      <div class="form-group">
        <label>Grid Style</label>
        <div class="form-fields">
          <select name="tacticalMapGridStyle" ${!hasTacticalMap ? 'disabled' : ''}>
            ${gridStyleOptions}
          </select>
        </div>
        <p class="notes">${!hasTacticalMap ? 'Grid style is shared with the main scene when no tactical map image is set.' : 'The visual style of the grid lines or points.'}</p>
      </div>

      <div class="form-group">
        <label>Grid Thickness</label>
        <div class="form-fields">
          <input type="number" name="tacticalMapGridThickness" value="${tacticalGridThickness}" step="any" placeholder="1" ${!hasTacticalMap ? 'disabled' : ''}>
        </div>
        <p class="notes">${!hasTacticalMap ? 'Grid thickness is shared with the main scene when no tactical map image is set.' : 'The thickness of the grid lines or points.'}</p>
      </div>

      <div class="form-group">
        <label>Grid Color</label>
        <div class="form-fields">
          <input type="text" name="tacticalMapGridColor" value="${tacticalGridColor}" placeholder="#000000" ${!hasTacticalMap ? 'disabled' : ''}>
          <input type="color" value="${tacticalGridColor}" data-edit="tacticalMapGridColor" ${!hasTacticalMap ? 'disabled' : ''}>
        </div>
        <p class="notes">${!hasTacticalMap ? 'Grid color is shared with the main scene when no tactical map image is set.' : 'The color of the grid lines or points.'}</p>
      </div>

      <div class="form-group">
        <label>Grid Opacity</label>
        <div class="form-fields">
          <input type="range" name="tacticalMapGridAlpha" value="${tacticalGridAlpha}" min="0" max="1" step="0.05" ${!hasTacticalMap ? 'disabled' : ''}>
          <span class="range-value">${tacticalGridAlpha}</span>
        </div>
        <p class="notes">${!hasTacticalMap ? 'Grid opacity is shared with the main scene when no tactical map image is set.' : 'The opacity/transparency of the grid.'}</p>
      </div>

      <hr>

      <div class="form-group">
        <label>Add Tokens to Encounter</label>
        <div class="form-fields">
          <input type="checkbox" name="addTokensToEncounter" ${addTokensToEncounter ? "checked" : ""}>
        </div>
        <p class="notes">Automatically add all tokens to a combat encounter when switching to the tactical map.</p>
      </div>
      
      ${tacticalMapImage ? `
      <div class="form-group">
        <label>Preview</label>
        <div class="preview-image">
          <img src="${tacticalMapImage}" style="max-width: 300px; max-height: 200px; object-fit: contain;">
        </div>
      </div>
      ` : ''}
    </div>
  `);
}

/**
 * Adds the Tactical Map toggle button to the token controls
 */
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

/**
 * Updates the state of grid controls based on whether a tactical map image is set
 * @param {jQuery} html - The form HTML
 * @param {string} imagePath - The tactical map image path
 */
function updateGridControlsState(html, imagePath) {
  const hasTacticalMap = !!imagePath;
  
  // Fields to disable/enable based on image presence
  const fields = [
    "tacticalMapGridSize",
    "tacticalMapGridScale.distance",
    "tacticalMapGridScale.units",
    "tacticalMapGridStyle",
    "tacticalMapGridThickness",
    "tacticalMapGridColor",
    "tacticalMapGridAlpha"
  ];
  
  // Enable or disable fields
  fields.forEach(field => {
    const element = html.find(`[name="${field}"]`);
    if (hasTacticalMap) {
      element.prop('disabled', false);
    } else {
      element.prop('disabled', true);
    }
  });
  
  // Also handle the color picker
  const colorPicker = html.find('input[type="color"][data-edit="tacticalMapGridColor"]');
  if (hasTacticalMap) {
    colorPicker.prop('disabled', false);
  } else {
    colorPicker.prop('disabled', true);
  }
  
  // Update notes text
  const notes = html.find('.form-group:has([name="tacticalMapGridSize"]) .notes');
  notes.text(hasTacticalMap ? 
    'The pixel size of a single grid space.' : 
    'Grid size is locked to match the main scene when no tactical map image is set.');
  
  // Update other notes
  const scaleNotes = html.find('.form-group:has([name="tacticalMapGridScale.distance"]) .notes');
  scaleNotes.text(hasTacticalMap ? 
    'The distance and unit settings for the tactical map grid.' : 
    'Grid scale settings are shared with the main scene when no tactical map image is set.');
  
  const styleNotes = html.find('.form-group:has([name="tacticalMapGridStyle"]) .notes');
  styleNotes.text(hasTacticalMap ? 
    'The visual style of the grid lines or points.' : 
    'Grid style is shared with the main scene when no tactical map image is set.');
  
  const thicknessNotes = html.find('.form-group:has([name="tacticalMapGridThickness"]) .notes');
  thicknessNotes.text(hasTacticalMap ? 
    'The thickness of the grid lines or points.' : 
    'Grid thickness is shared with the main scene when no tactical map image is set.');
  
  const colorNotes = html.find('.form-group:has([name="tacticalMapGridColor"]) .notes');
  colorNotes.text(hasTacticalMap ? 
    'The color of the grid lines or points.' : 
    'Grid color is shared with the main scene when no tactical map image is set.');
  
  const alphaNotes = html.find('.form-group:has([name="tacticalMapGridAlpha"]) .notes');
  alphaNotes.text(hasTacticalMap ? 
    'The opacity/transparency of the grid.' : 
    'Grid opacity is shared with the main scene when no tactical map image is set.');
}

/**
 * Updates the image preview when the image path changes
 * @param {jQuery} html - The form HTML
 * @param {string} imagePath - The new image path
 */
function updateImagePreview(html, imagePath) {
  const previewContainer = html.find('.tab[data-tab="tacticalMap"] .preview-image');
  
  if (!imagePath) {
    // If there's no image path, remove the entire preview section
    html.find('.tab[data-tab="tacticalMap"] .form-group:last-child').remove();
    return;
  }
  
  // Create preview HTML
  const previewHtml = `<img src="${imagePath}" style="max-width: 300px; max-height: 200px; object-fit: contain;">`;
  
  if (previewContainer.length) {
    // Update existing preview
    previewContainer.html(previewHtml);
  } else {
    // Add new preview section
    const previewSection = `
      <div class="form-group">
        <label>Preview</label>
        <div class="preview-image">
          ${previewHtml}
        </div>
      </div>
    `;
    html.find('.tab[data-tab="tacticalMap"]').append(previewSection);
  }
}

Hooks.once('init', () => {
  addTacticalMapTabToSceneConfig();
  addTacticalMapButtonToTokenControls();
});