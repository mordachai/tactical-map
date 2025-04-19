// js/ui-management.js
import { toggleTacticalMap } from './tactical-map.js';
import { debugLog } from './logger-tcmap.js';
import { isV13OrLater } from './compatibility.js';

/**
 * Adds a Tactical Map tab to the Scene Configuration window
 */
function addTacticalMapTabToSceneConfig() {
  Hooks.on("renderSceneConfig", async (app, html, data) => {
    try {
      // Get the main tabs navigation
      const mainTabs = html.find('nav.sheet-tabs[data-group="main"]');
      
      // Check if our tab already exists (prevents duplicates)
      if (mainTabs.find('a[data-tab="tacticalMap"]').length === 0) {
        // Add new tab button to main tabs
        mainTabs.append('<a class="item" data-tab="tacticalMap"><i class="fas fa-map-marked-alt"></i> Tactical Map</a>');
        
        // Create our tab content using the template
        const tabContent = await createTacticalMapTabFromTemplate(app);
        
        // Add the tab content after other main tabs
        const mainTabsContent = html.find('form > div.tab[data-group="main"]').last();
        $(tabContent).insertAfter(mainTabsContent);
        
        // Re-initialize the tabs
        app._tabs[0].bind(html[0]);
        
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
              updateGridControlsState(html, path);
            }
          });
          picker.browse();
        });
        
        // Add event listener for image path changes
        html.find("input[name='tacticalMapImage']").on('change', function() {
          // Update image preview
          updateImagePreview(html, $(this).val());
          
          // Enable/disable grid controls based on image presence
          updateGridControlsState(html, $(this).val());
        });
        
        // Initial state setup - FIXED: Force this to run with the current image value
        const currentImage = html.find("input[name='tacticalMapImage']").val();
        updateImagePreview(html, currentImage);
        updateGridControlsState(html, currentImage);
        
        // Handle range slider display
        html.find("input[type=range][name='tacticalMapGridAlpha'], input[type=range][name='blurAmount']").on('input', function() {
          $(this).siblings('.range-value').text(this.value);
          
          // Update blur in real-time if this is the blur slider and tactical map is active
          if ($(this).attr('name') === 'blurAmount' && app.object.getFlag("tactical-map", "isActive") && 
              !app.object.getFlag("tactical-map", "image")) {
            const newValue = parseInt(this.value);
            import('./background-effects.js').then(module => {
              module.updateBlurAmount(app.object, newValue);
            });
          }
        });
        
        // Handle map type changes
        html.find("select[name='tacticalMapType']").on('change', function() {
          const mapType = $(this).val();
          // If hexcrawl is selected, show a helpful tooltip
          if (mapType === "hexcrawl") {
            ui.notifications.info("Hexcrawl type selected. Consider checking 'Is Main Map Hexcrawl' if this is for a hexcrawl campaign.");
          }
        });
        
        debugLog("Tactical Map tab added to Scene Config");
      }
      
      // Remove any duplicate tabs in ambience section (if they exist)
      html.find('nav.secondary-tabs a[data-tab="tacticalMap"]').remove();
      
    } catch (error) {
      console.error("Error adding Tactical Map tab:", error);
    }
  });

  // Save settings when the form is submitted
  Hooks.on("renderSceneConfig", async (app, html, data) => {
    // Inject a hidden save button to capture original form submission
    const form = html.find('form');
    form.append('<button type="button" id="save-tactical-map-settings" style="display:none;">Save Tactical Settings</button>');
    
    // Hook into the form's submit event directly
    form.on('submit', function(event) {
      // Don't actually submit yet, just trigger our save
      $('#save-tactical-map-settings').trigger('click');
    });
    
    // Add event handler for our save button
    html.find('#save-tactical-map-settings').on('click', async function() {
      try {
        // Debug log to verify the hook is being triggered
        debugLog("Save tactical map settings triggered");
        
        // Current scene
        const scene = app.object;
        
        // Collect form values directly from form fields
        const formValues = {
          image: html.find("input[name='tacticalMapImage']").val() || "",
          mapType: html.find("select[name='tacticalMapType']").val() || "top-down",
          gridType: parseInt(html.find("select[name='tacticalMapGridType']").val()),
          gridSize: parseInt(html.find("input[name='tacticalMapGridSize']").val()) || 100,
          addTokensToEncounter: html.find("input[name='addTokensToEncounter']").is(":checked"),
          blurAmount: parseInt(html.find("input[name='blurAmount']").val()) || 10,
          isMainMapHexcrawl: html.find("input[name='isMainMapHexcrawl']").is(":checked")
        };
        
        // Debug log the new values from form
        debugLog("New tactical map settings from form:", formValues);
        
        // Add grid settings if tactical map is used
        if (formValues.image) {
          formValues.gridScale = {
            distance: parseFloat(html.find("input[name='tacticalMapGridScale.distance']").val() || "0"),
            units: html.find("input[name='tacticalMapGridScale.units']").val() || ""
          };
          formValues.gridStyle = html.find("select[name='tacticalMapGridStyle']").val() || "solidLines";
          formValues.gridThickness = parseFloat(html.find("input[name='tacticalMapGridThickness']").val() || "1");
          formValues.gridColor = html.find("input[name='tacticalMapGridColor']").val() || "#000000";
          formValues.gridAlpha = parseFloat(html.find("input[name='tacticalMapGridAlpha']").val() || "1");
        }
        
        // Save each flag individually for reliability
        for (const [key, value] of Object.entries(formValues)) {
          try {
            // For objects like gridScale, use setFlag directly
            if (typeof value === 'object' && value !== null) {
              await scene.setFlag("tactical-map", key, foundry.utils.deepClone(value));
            } else {
              await scene.setFlag("tactical-map", key, value);
            }
            debugLog(`Set flag "${key}" to:`, value);
          } catch (err) {
            console.error(`Failed to set flag "${key}":`, err);
          }
        }
        
        // Verify the updates
        const savedHexcrawlFlag = scene.getFlag("tactical-map", "isMainMapHexcrawl");
        debugLog(`Final verification - isMainMapHexcrawl saved as: ${savedHexcrawlFlag}`);
      
      // If the main map is set as hexcrawl, we might need to apply token art immediately
        if (formValues.isMainMapHexcrawl) {
          // Only apply token art if the tactical map is not active (we're on the main map)
          if (!scene.getFlag("tactical-map", "isActive")) {
            debugLog("Main map is hexcrawl, applying hexcrawl token art");
            // Import and apply hexcrawl tokens if not already done
            import('./token-art-switcher.js').then(module => {
              module.switchTokenArt(scene, "deactivate");
            });
          }
        }
        
        // Show notification
        ui.notifications.info("Tactical Map settings saved.");
        
      } catch (error) {
        console.error("Error saving Tactical Map settings:", error);
        ui.notifications.error("Failed to save Tactical Map settings: " + error.message);
      }
    });
  });
}

/**
 * Creates the Tactical Map tab using the Handlebars template
 * @param {Application} app - Scene Config application
 * @returns {Promise<string>} The rendered HTML
 */
async function createTacticalMapTabFromTemplate(app) {
  // Get current values
  const scene = app.object;
  const tacticalMapImage = scene.getFlag("tactical-map", "image") || "";
  const tacticalMapType = scene.getFlag("tactical-map", "mapType") || "top-down";
  const tacticalGridType = scene.getFlag("tactical-map", "gridType");
  // Use a default of 1 only if undefined/null
  const gridTypeValue = tacticalGridType !== undefined && tacticalGridType !== null ? 
                       tacticalGridType : 1;
  const tacticalGridSize = scene.getFlag("tactical-map", "gridSize") || scene.grid.size;
  const addTokensToEncounter = scene.getFlag("tactical-map", "addTokensToEncounter") || false;
  const isMainMapHexcrawl = scene.getFlag("tactical-map", "isMainMapHexcrawl") || false;
  
  // Debug log current values
  debugLog("Creating Tactical Map tab with values:", {
    tacticalMapImage,
    tacticalMapType,
    tacticalGridType,
    tacticalGridSize,
    isMainMapHexcrawl
  });
  
  // Grid settings - if tactical grid settings exist, use them, otherwise use main grid settings
  const tacticalGridScale = scene.getFlag("tactical-map", "gridScale") || { 
    distance: scene.grid.distance, 
    units: scene.grid.units 
  };
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
  ].map(option => ({
    value: option.value,
    text: option.text,
    selected: tacticalGridType === option.value
  }));
  
  // Get blur amount setting
  const blurAmount = scene.getFlag("tactical-map", "blurAmount") || 10;
  
  // Grid style options
  const gridStyleOptions = [
    { value: "solidLines", text: "Solid Lines" },
    { value: "dashedLines", text: "Dashed Lines" },
    { value: "dottedLines", text: "Dotted Lines" },
    { value: "squarePoints", text: "Square Points" },
    { value: "diamondPoints", text: "Diamond Points" },
    { value: "roundPoints", text: "Round Points" }
  ].map(option => ({
    value: option.value,
    text: option.text,
    selected: tacticalGridStyle === option.value
  }));
  
  // Prepare template data
  const templateData = {
    tacticalMapImage,
    isTopDown: tacticalMapType === "top-down",
    isIsometric: tacticalMapType === "isometric",
    isHexcrawl: tacticalMapType === "hexcrawl",
    isMainMapHexcrawl,
    tacticalGridType: gridTypeValue,
    tacticalGridSize,
    addTokensToEncounter,
    tacticalGridScale,
    tacticalGridStyle,
    tacticalGridThickness,
    tacticalGridColor,
    tacticalGridAlpha,
    hasTacticalMap,
    gridTypeOptions,
    gridStyleOptions,
    blurAmount
  };
  
  // Render the template
  const template = "modules/tactical-map/templates/tactical-map-tab.hbs";
  return await renderTemplate(template, templateData);
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
    element.prop('disabled', !hasTacticalMap);
  });
  
  // Also handle the color picker
  const colorPicker = html.find('input[type="color"][data-edit="tacticalMapGridColor"]');
  colorPicker.prop('disabled', !hasTacticalMap);
  
  // Grid Type should ALWAYS be enabled
  html.find(`[name="tacticalMapGridType"]`).prop('disabled', false);
  
  // FIXED: Toggle visibility of the grid settings container
  const gridSettingsContainer = html.find('.grid-settings-container');
  const previewContainer = html.find('.form-group .preview-image').closest('.form-group');
  
  if (hasTacticalMap) {
    // Make sure grid settings are visible even if the template has them hidden
    gridSettingsContainer.show();
    previewContainer.show();
    
    // Hide blur section if tactical map is set
    html.find('.form-group [name="blurAmount"]').closest('.form-group').hide();
  } else {
    // Hide preview if no image is set
    previewContainer.hide();
    
    // Show blur section if no tactical map
    html.find('.form-group [name="blurAmount"]').closest('.form-group').show();
  }
}

/**
 * Updates the image preview when the image path changes
 * @param {jQuery} html - The form HTML
 * @param {string} imagePath - The new image path
 */
function updateImagePreview(html, imagePath) {
  const previewContainer = html.find('.tab[data-tab="tacticalMap"] .preview-image');
  
  if (!imagePath) {
    // If there's no image path, remove preview
    previewContainer.closest('.form-group').hide();
    return;
  }
  
  // Create preview HTML
  const previewHtml = `<img src="${imagePath}" style="max-width: 250px; max-height: 200px; object-fit: contain;">`;
  
  if (previewContainer.length) {
    // Update existing preview
    previewContainer.html(previewHtml);
    previewContainer.closest('.form-group').show();
  }
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

// Initialize
Hooks.once('init', () => {
  addTacticalMapTabToSceneConfig();
  addTacticalMapButtonToTokenControls();
});

// Export components
export {
  addTacticalMapTabToSceneConfig,
  addTacticalMapButtonToTokenControls
};