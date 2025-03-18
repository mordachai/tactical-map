// ui-enhancements.js - Add to your module

// Add a loading overlay during map transitions
function showLoadingOverlay(message = "Loading...") {
  // Create overlay if it doesn't exist
  let overlay = document.getElementById('tactical-map-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tactical-map-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.flexDirection = 'column';
    document.body.appendChild(overlay);
  }
  
  // Create or update message
  let messageElem = overlay.querySelector('.message');
  if (!messageElem) {
    messageElem = document.createElement('div');
    messageElem.className = 'message';
    messageElem.style.color = 'white';
    messageElem.style.fontSize = '20px';
    messageElem.style.marginBottom = '20px';
    overlay.appendChild(messageElem);
  }
  messageElem.textContent = message;
  
  // Create spinner if it doesn't exist
  if (!overlay.querySelector('.spinner')) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.border = '5px solid #f3f3f3';
    spinner.style.borderTop = '5px solid #3498db';
    spinner.style.borderRadius = '50%';
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.animation = 'spin 2s linear infinite';
    overlay.appendChild(spinner);
    
    // Add keyframes for spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Show the overlay
  overlay.style.display = 'flex';
  
  return overlay;
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('tactical-map-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Add transition effects for map switching
function addMapTransitionEffect(effect = 'fade') {
  const sceneElement = document.getElementById('board');
  
  switch (effect) {
    case 'fade':
      // Add fade-out effect
      sceneElement.style.transition = 'opacity 0.5s ease-in-out';
      sceneElement.style.opacity = '0';
      
      // After timeout, restore opacity
      setTimeout(() => {
        sceneElement.style.opacity = '1';
      }, 500); // Match with transition duration
      break;
      
    case 'zoom':
      // Add zoom effect
      sceneElement.style.transition = 'transform 0.5s ease-in-out';
      sceneElement.style.transform = 'scale(0.95)';
      
      // After timeout, restore transform
      setTimeout(() => {
        sceneElement.style.transform = 'scale(1)';
      }, 500); // Match with transition duration
      break;
      
    // Add more effects as needed
  }
}

// Enhanced Scene Config with Preview
function enhanceSceneConfig() {
  Hooks.on("renderSceneConfig", (app, html, data) => {
    // Find the tactical map image input field
    const tacticalMapInput = html.find("input[name='tacticalMapImage']");
    if (!tacticalMapInput.length) return;
    
    // Add preview button
    const previewButton = $(`<button type="button" class="tactical-map-preview" title="Preview Image">
      <i class="fas fa-eye"></i>
    </button>`);
    
    previewButton.insertAfter(tacticalMapInput.next('.file-picker'));
    
    // Add preview functionality
    previewButton.click(async () => {
      const imagePath = tacticalMapInput.val();
      if (!imagePath) {
        ui.notifications.warn("No image path specified");
        return;
      }
      
      // Create preview dialog
      const dialog = new Dialog({
        title: "Tactical Map Preview",
        content: `
          <div style="text-align: center;">
            <img src="${imagePath}" style="max-width: 100%; max-height: 500px;">
          </div>
        `,
        buttons: {
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: "Close"
          }
        },
        default: "close"
      });
      
      dialog.render(true);
    });
    
    // Add a status indicator for tactics map
    const sceneId = app.object.id;
    const scene = game.scenes.get(sceneId);
    
    if (scene && scene.getFlag("tactical-map", "image")) {
      const statusIndicator = $(`
        <div class="form-group tactical-map-status">
          <label>Tactical Map Status</label>
          <div class="form-fields">
            <span class="status-indicator" style="
              display: inline-block;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background-color: #4CAF50;
              margin-right: 8px;
            "></span>
            <span>Tactical Map Available</span>
          </div>
        </div>
      `);
      
      // Insert status indicator at the top of the tactical map section
      const formGroups = html.find('.form-group');
      const tacticalGroup = formGroups.filter((i, el) => $(el).find('input[name="tacticalMapImage"]').length > 0);
      statusIndicator.insertBefore(tacticalGroup);
    }
    
    // Enhanced map type selector with icons
    const mapTypeSelect = html.find('select[name="tacticalMapType"]');
    if (mapTypeSelect.length) {
      // Replace standard select with custom styled one
      const currentValue = mapTypeSelect.val();
      const enhancedSelect = $(`
        <div class="tactical-map-type-selector" style="display: flex; gap: 10px;">
          <div class="map-type-option ${currentValue === 'top-down' ? 'selected' : ''}" data-value="top-down" style="
            padding: 10px;
            border: 1px solid #7a7971;
            border-radius: 5px;
            text-align: center;
            cursor: pointer;
            flex: 1;
            background: ${currentValue === 'top-down' ? '#4b4a44' : ''};
          ">
            <i class="fas fa-chess-board" style="font-size: 24px; margin-bottom: 8px;"></i>
            <div>Top-down</div>
          </div>
          <div class="map-type-option ${currentValue === 'isometric' ? 'selected' : ''}" data-value="isometric" style="
            padding: 10px;
            border: 1px solid #7a7971;
            border-radius: 5px;
            text-align: center;
            cursor: pointer;
            flex: 1;
            background: ${currentValue === 'isometric' ? '#4b4a44' : ''};
          ">
            <i class="fas fa-cube" style="font-size: 24px; margin-bottom: 8px;"></i>
            <div>Isometric</div>
          </div>
        </div>
      `);
      
      // Hide the original select but keep it for form submission
      mapTypeSelect.css('display', 'none');
      
      // Insert the enhanced selector
      enhancedSelect.insertAfter(mapTypeSelect);
      
      // Add click event to options
      enhancedSelect.find('.map-type-option').click(function() {
        const value = $(this).data('value');
        
        // Update original select
        mapTypeSelect.val(value);
        
        // Update visuals
        enhancedSelect.find('.map-type-option').css('background', '');
        $(this).css('background', '#4b4a44');
      });
    }
  });
}

// Add settings to customize transitions
Hooks.once('init', () => {
  game.settings.register("tactical-map", "transitionEffect", {
    name: "Map Transition Effect",
    hint: "Choose the visual effect when toggling between maps",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "none": "None",
      "fade": "Fade",
      "zoom": "Zoom"
    },
    default: "fade"
  });
  
  // Initialize UI enhancements
  enhanceSceneConfig();
});

// Integrate transition effects with toggle function
export function integrateUiEnhancements() {
  // Modify the toggleTacticalMap function to use these enhancements
  const originalToggleFunction = window.toggleTacticalMap;
  
  window.toggleTacticalMap = async function() {
    // Show loading overlay
    const overlay = showLoadingOverlay("Switching maps...");
    
    // Apply transition effect
    const effect = game.settings.get("tactical-map", "transitionEffect");
    if (effect !== "none") {
      addMapTransitionEffect(effect);
    }
    
    try {
      // Call the original toggle function
      await originalToggleFunction();
    } finally {
      // Hide overlay when done
      setTimeout(() => {
        hideLoadingOverlay();
      }, 800); // Slightly longer than transition to ensure it completes
    }
  };
}

// Initialize enhancement integration when the game is ready
Hooks.once('ready', () => {
  integrateUiEnhancements();
});
