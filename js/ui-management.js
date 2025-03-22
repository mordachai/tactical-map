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
        
        // Initial state setup
        updateGridControlsState(html, html.find("input[name='tacticalMapImage']").val());
        
        // Handle range slider display
        html.find("input[type=range][name='tacticalMapGridAlpha'], input[type=range][name='blurAmount']").on('input', function() {
          $(this).siblings('.range-value').text(this.value);
          
          // Update blur in real-time if this is the blur slider and tactical map is active
          if ($(this).attr('name') === 'blurAmount' && scene.getFlag("tactical-map", "isActive") && 
              !scene.getFlag("tactical-map", "image")) {
            const newValue = parseInt(this.value);
            import('./background-effects.js').then(module => {
              module.updateBlurAmount(scene, newValue);
            });
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

  // Save settings when the form is closed
  Hooks.on("closeSceneConfig", async (app, html) => {
    try {
      const flagData = {
        image: html.find("input[name='tacticalMapImage']").val(),
        mapType: html.find("select[name='tacticalMapType']").val(),
        gridType: parseInt(html.find("select[name='tacticalMapGridType']").val()) || 1,
        gridSize: parseInt(html.find("input[name='tacticalMapGridSize']").val()) || 100,
        addTokensToEncounter: html.find("input[name='addTokensToEncounter']").is(":checked"),
        blurAmount: parseInt(html.find("input[name='blurAmount']").val()) || 10
      };
      
      // Save grid settings if tactical map is used
      if (flagData.image) {
        flagData.gridScale = {
          distance: parseFloat(html.find("input[name='tacticalMapGridScale.distance']").val()),
          units: html.find("input[name='tacticalMapGridScale.units']").val()
        };
        flagData.gridStyle = html.find("select[name='tacticalMapGridStyle']").val();
        flagData.gridThickness = parseFloat(html.find("input[name='tacticalMapGridThickness']").val());
        flagData.gridColor = html.find("input[name='tacticalMapGridColor']").val();
        flagData.gridAlpha = parseFloat(html.find("input[name='tacticalMapGridAlpha']").val());
      }

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
 * Creates the Tactical Map tab using the Handlebars template
 * @param {Application} app - Scene Config application
 * @returns {Promise<string>} The rendered HTML
 */
async function createTacticalMapTabFromTemplate(app) {
  // Get current values
  const scene = app.object;
  const tacticalMapImage = scene.getFlag("tactical-map", "image") || "";
  const tacticalMapType = scene.getFlag("tactical-map", "mapType") || "top-down";
  const tacticalGridType = scene.getFlag("tactical-map", "gridType") || 1;
  const tacticalGridSize = scene.getFlag("tactical-map", "gridSize") || scene.grid.size;
  const addTokensToEncounter = scene.getFlag("tactical-map", "addTokensToEncounter") || false;
  
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
    tacticalGridType,
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