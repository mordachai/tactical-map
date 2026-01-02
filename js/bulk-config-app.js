// bulk-config-app.js - Application V2 bulk configuration dialog for Tactical Map

import { debugLog } from './logger-tcmap.js';
import { toggleTacticalMap } from './tactical-map.js';

/**
 * Application V2 dialog for bulk configuring tactical maps across all scenes
 * Displays scenes organized by folders with inline configuration editing
 */
export class TacticalMapBulkConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {

  static DEFAULT_OPTIONS = {
    id: "tactical-map-bulk-config",
    classes: ["tactical-map-bulk-config"],
    tag: "div",
    window: {
      title: "Tactical Map Bulk Configuration",
      icon: "fa-solid fa-map-marked-alt",
      resizable: true
    },
    position: {
      width: 900,
      height: 700
    },
    actions: {
      toggleFolder: this.prototype.toggleFolder,
      toggleScene: this.prototype.toggleScene,
      updateSetting: this.prototype.updateSetting,
      pickFile: this.prototype.pickFile,
      popoutImage: this.prototype.popoutImage,
      toggleInScene: this.prototype.toggleInScene,
      removeImage: this.prototype.removeImage
    }
  };

  static PARTS = {
    form: {
      template: "modules/tactical-map/templates/bulk-config.hbs"
    }
  };

  /**
   * Configure action listeners for form inputs
   * @override
   */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    // Attach change listeners for form inputs
    htmlElement.querySelectorAll('[data-action="updateSetting"]').forEach(input => {
      input.addEventListener('change', (event) => {
        this.updateSetting(event, event.target);
      });

      // For text/number inputs, also listen to input events (but debounced)
      if (input.type === 'text' || input.type === 'number') {
        input.addEventListener('input', (event) => {
          this.updateSetting(event, event.target);
        });
      }
    });
  }

  constructor(options = {}) {
    super(options);

    // Track which folders and scenes are expanded
    this.expandedFolders = new Set();
    this.expandedScenes = new Set();

    // Debounce timers for auto-save
    this._saveTimers = {};
  }

  /**
   * Prepare context data for rendering
   * @param {object} options - Render options
   * @returns {Promise<object>} Context data
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Organize scenes by folder
    context.folders = this._organizeScenesIntoFolders();

    return context;
  }

  /**
   * Organize all scenes into their folders
   * @returns {Array<object>} Array of folder objects with scenes
   * @private
   */
  _organizeScenesIntoFolders() {
    const folders = [];
    const folderMap = new Map();

    // Create folder structure from game folders
    game.folders.filter(f => f.type === "Scene").forEach(folder => {
      const folderData = {
        id: folder.id,
        name: folder.name,
        scenes: [],
        expanded: this.expandedFolders.has(folder.id)
      };
      folders.push(folderData);
      folderMap.set(folder.id, folderData);
    });

    // Organize scenes into their folders
    const unfolderedScenes = [];
    game.scenes.forEach(scene => {
      const sceneData = this._prepareSceneData(scene);

      if (scene.folder) {
        const folder = folderMap.get(scene.folder.id);
        if (folder) {
          folder.scenes.push(sceneData);
        } else {
          // Folder not found, add to unfoldered list
          unfolderedScenes.push(sceneData);
        }
      } else {
        unfolderedScenes.push(sceneData);
      }
    });

    // Remove empty folders
    const foldersWithScenes = folders.filter(f => f.scenes.length > 0);

    // Only add "No Folder" section if there are actual folders
    // Otherwise, scenes are listed directly without a folder wrapper
    if (foldersWithScenes.length > 0 && unfolderedScenes.length > 0) {
      foldersWithScenes.push({
        id: "null",
        name: "No Folder",
        scenes: unfolderedScenes,
        expanded: this.expandedFolders.has("null")
      });
    } else if (foldersWithScenes.length === 0) {
      // No folders at all, just list scenes
      foldersWithScenes.push({
        id: "root",
        name: "Scenes",
        scenes: unfolderedScenes,
        expanded: true
      });
    }

    return foldersWithScenes;
  }

  /**
   * Prepare data for a single scene
   * @param {Scene} scene - The scene document
   * @returns {object} Scene data for template
   * @private
   */
  _prepareSceneData(scene) {
    const flags = scene.flags["tactical-map"] || {};

    return {
      id: scene.id,
      name: scene.name,
      // Always use scene.thumb which is the original thumbnail, not the current background
      thumbnail: scene.thumb,
      expanded: this.expandedScenes.has(scene.id),

      // Current settings
      image: flags.image || "",
      mapType: flags.mapType || "top-down",
      gridType: flags.gridType ?? 1,
      gridSize: flags.gridSize || 100,
      isMainMapHexcrawl: flags.isMainMapHexcrawl || false,
      addTokensToEncounter: flags.addTokensToEncounter || false,
      blurAmount: flags.blurAmount || 10,
      isActive: flags.isActive || false,

      // Grid styling (only if image exists)
      hasImage: !!flags.image,
      gridScale: flags.gridScale || { distance: 5, units: "ft" },
      gridStyle: flags.gridStyle || "solidLines",
      gridThickness: flags.gridThickness || 1,
      gridColor: flags.gridColor || "#000000",
      gridAlpha: flags.gridAlpha ?? 0.5,

      // Display helpers
      mapTypeLabel: this._getMapTypeLabel(flags.mapType),
      gridTypeLabel: this._getGridTypeLabel(flags.gridType ?? 1)
    };
  }

  /**
   * Get human-readable label for map type
   * @param {string} mapType - Map type value
   * @returns {string} Display label
   * @private
   */
  _getMapTypeLabel(mapType) {
    const labels = {
      "top-down": "Top-down",
      "isometric": "Isometric",
      "hexcrawl": "Hexcrawl"
    };
    return labels[mapType] || "Top-down";
  }

  /**
   * Get human-readable label for grid type
   * @param {number} gridType - Grid type value (0-5)
   * @returns {string} Display label
   * @private
   */
  _getGridTypeLabel(gridType) {
    const labels = {
      0: "Gridless",
      1: "Square",
      2: "Hex Rows-Odd",
      3: "Hex Rows-Even",
      4: "Hex Cols-Odd",
      5: "Hex Cols-Even"
    };
    return labels[gridType] || "Square";
  }

  /**
   * Handle toggling folder expansion
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  async toggleFolder(event, target) {
    const folderId = target.dataset.folderId;

    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }

    this.render();
  }

  /**
   * Handle toggling scene expansion
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  async toggleScene(event, target) {
    const sceneId = target.dataset.sceneId;

    if (this.expandedScenes.has(sceneId)) {
      this.expandedScenes.delete(sceneId);
    } else {
      this.expandedScenes.add(sceneId);
    }

    this.render();
  }

  /**
   * Handle updating a setting with debounced auto-save
   * @param {Event} event - Change event
   * @param {HTMLElement} target - Target input element
   */
  async updateSetting(event, target) {
    const sceneId = target.closest("[data-scene-id]").dataset.sceneId;
    const scene = game.scenes.get(sceneId);
    if (!scene) {
      debugLog("updateSetting: Scene not found", sceneId);
      return;
    }

    const field = target.dataset.field;
    debugLog(`updateSetting called: field=${field}, sceneId=${sceneId}`);
    let value;

    // Parse value based on input type
    if (target.type === "checkbox") {
      value = target.checked;
    } else if (target.type === "number" || target.type === "range") {
      value = parseFloat(target.value);
    } else if (target.type === "radio") {
      value = target.value;
    } else {
      value = target.value;
    }

    // Handle nested fields like gridScale.distance
    const fieldParts = field.split('.');

    // Debounced save
    clearTimeout(this._saveTimers?.[`${sceneId}-${field}`]);
    this._saveTimers = this._saveTimers || {};

    this._saveTimers[`${sceneId}-${field}`] = setTimeout(async () => {
      try {
        // Handle nested fields
        if (fieldParts.length > 1) {
          const mainField = fieldParts[0];
          const subField = fieldParts[1];

          // Get current value
          const currentValue = scene.getFlag("tactical-map", mainField) || {};

          // Update nested property
          const newValue = foundry.utils.deepClone(currentValue);
          newValue[subField] = value;

          await scene.setFlag("tactical-map", mainField, newValue);
        } else {
          // Simple field
          await scene.setFlag("tactical-map", field, value);
        }

        // Show save indicator
        this._showSaveIndicator(sceneId, field);

        // Re-render if image field changed (to show/hide grid settings)
        if (field === "image") {
          this.render();
        }

        // Update range value display
        if (target.type === "range") {
          const valueDisplay = target.closest('.form-group')?.querySelector('.range-value');
          if (valueDisplay) {
            valueDisplay.textContent = value;
          }
        }

        debugLog(`Saved ${field} = ${value} for scene ${scene.name}`);
      } catch (error) {
        console.error(`Error saving ${field}:`, error);
        ui.notifications.error(`Failed to save ${field}`);
      }
    }, 500);
  }

  /**
   * Show visual save indicator
   * @param {string} sceneId - Scene ID
   * @param {string} field - Field name
   * @private
   */
  _showSaveIndicator(sceneId, field) {
    const row = this.element?.querySelector(`[data-scene-id="${sceneId}"]`);
    if (!row) return;

    const indicator = row.querySelector(".save-indicator");
    if (indicator) {
      indicator.classList.add("visible");
      setTimeout(() => indicator.classList.remove("visible"), 1000);
    }
  }

  /**
   * Handle file picker for tactical map image
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target button
   */
  async pickFile(event, target) {
    const sceneId = target.closest("[data-scene-id]").dataset.sceneId;
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    const current = scene.getFlag("tactical-map", "image") || "";

    const fp = new FilePicker({
      type: "image",
      current: current,
      callback: async (path) => {
        await scene.setFlag("tactical-map", "image", path);

        // Update input value
        const input = target.previousElementSibling;
        if (input) input.value = path;

        // Re-render to show grid settings and preview
        this.render();
      }
    });

    fp.render(true);
  }

  /**
   * Handle opening image popout for full-size preview
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target button
   */
  async popoutImage(event, target) {
    const sceneId = target.closest("[data-scene-id]").dataset.sceneId;
    const scene = game.scenes.get(sceneId);
    const image = scene?.getFlag("tactical-map", "image");

    if (!image) {
      ui.notifications.warn("No tactical map image set");
      return;
    }

    new ImagePopout(image, {
      title: `${scene.name} - Tactical Map`,
      shareable: true
    }).render(true);
  }

  /**
   * Handle toggling tactical map in the current scene for preview
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target button
   */
  async toggleInScene(event, target) {
    const sceneId = target.closest("[data-scene-id]").dataset.sceneId;
    const scene = game.scenes.get(sceneId);

    if (!scene) {
      ui.notifications.error("Scene not found");
      return;
    }

    // Check if this scene is the currently viewed scene
    if (game.scenes.current?.id !== sceneId) {
      ui.notifications.warn(`Please activate scene "${scene.name}" first to preview the tactical map`);
      return;
    }

    // Toggle the tactical map for this scene
    await toggleTacticalMap();

    // Re-render to update button state
    this.render();
  }

  /**
   * Handle removing tactical map image
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target button
   */
  async removeImage(event, target) {
    const sceneId = target.closest("[data-scene-id]").dataset.sceneId;
    const scene = game.scenes.get(sceneId);

    if (!scene) {
      ui.notifications.error("Scene not found");
      return;
    }

    // Clear the tactical map image
    await scene.setFlag("tactical-map", "image", "");

    ui.notifications.info(`Tactical map image removed from "${scene.name}"`);
    debugLog(`Removed tactical map image from scene ${scene.name}`);

    // Re-render to hide grid settings and preview
    this.render();
  }
}

// Register the Application globally
window.TacticalMapBulkConfig = TacticalMapBulkConfig;
