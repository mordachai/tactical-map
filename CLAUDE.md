# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tactical Map is a Foundry VTT v13 module that allows GMs to toggle between a normal scene and a tactical map. It's designed for Theater of the Mind gameplay with optional tactical combat resolution. The module supports:
- Seamless switching between scene backgrounds
- Application V2 bulk configuration dialog for managing all scenes
- Alternative token artwork for different map types (top-down, isometric, hexcrawl)
- Blur effects when no tactical map image is set
- Independent token positioning and camera views for each map
- Automatic combat encounter management

**Version:** 3.0+ (Pure Foundry VTT v13 - no backward compatibility)

## Module Architecture

### Core Module System

This is a **client-side ES module** for Foundry VTT v13. All JavaScript files are loaded as ES modules via `module.json`:

```javascript
"esmodules": [
  "js/global-config.js",      // Settings registration
  "js/logger-tcmap.js",       // Debug logging utilities
  "js/background-effects.js", // Blur effects and animations
  "js/ui-management.js",      // Directory button and toolbar button
  "js/tactical-map.js",       // Core toggle logic
  "js/token-art-switcher.js", // Alternative token artwork
  "js/cache-manager.js",      // Caching utilities
  "js/grid-conversion.js",    // Grid type conversions
  "js/bulk-config-app.js"     // Application V2 bulk configuration dialog
]
```

Load order matters: config must load before other modules.

### State Management

The module uses **Foundry VTT's flag system** for state persistence:

**Scene Flags (GM only):**
- `tactical-map.isActive` - Whether tactical map is currently active
- `tactical-map.image` - Path to tactical map background image
- `tactical-map.mapType` - Type: "top-down", "isometric", or "hexcrawl"
- `tactical-map.isMainMapHexcrawl` - Whether the main map is a hexcrawl
- `tactical-map.gridType` - Grid type for tactical map (0-5)
- `tactical-map.gridSize` - Grid size in pixels
- `tactical-map.originalSettings` - Stored original scene settings
- `tactical-map.mainMapPosition` - Saved camera position for main map
- `tactical-map.tacticalMapPosition` - Saved camera position for tactical map
- `tactical-map.originalTokenPositions` - Token positions on main map
- `tactical-map.tacticalTokenPositions` - Token positions on tactical map
- `tactical-map.blurActive` - Whether blur effect is currently active
- `tactical-map.blurAmount` - Blur strength (0-20)
- `tactical-map.addTokensToEncounter` - Auto-add tokens to combat

**User Flags (for players):**
- `tactical-map.isActive_{sceneId}` - Per-scene tactical map state
- `tactical-map.{positionFlag}_{sceneId}` - Per-scene camera positions

**Token Flags:**
- `tactical-map.originalImage` - Original token artwork path

### Key Data Flow

**Map Toggle Sequence:**
1. Store current canvas position
2. Store current token positions (GM only)
3. Update scene background/grid/dimensions
4. Toggle `isActive` flag
5. Restore target token positions (GM only)
6. Switch token artwork if enabled
7. Restore target canvas position (after canvas ready)
8. Apply/remove blur effects if needed

**Token Art Switching:**
The module looks for alternative token images with suffixes:
- `_tdv` for top-down tactical maps
- `_isv` for isometric tactical maps
- `_hxv` for hexcrawl maps

Example: `token.png` → `token_tdv.png` or `token_isv.png`

### Module Components

**tactical-map.js** - Core Logic
- `toggleTacticalMap()` - Main toggle function
- `activateTacticalMap()` - Switch to tactical map
- `restoreOriginalMap()` - Switch back to main map
- `storeCanvasPosition()` / `restoreCanvasPosition()` - Camera persistence
- `storeTokenPositions()` / `restoreTokenPositions()` - Token position management
- `ensureCombatEncounter()` - Auto-add tokens to combat tracker

**ui-management.js** - UI Integration
- Adds bulk configuration button to Scenes Directory
- Adds toggle button to Token Controls toolbar
- Minimal file - most UI logic moved to bulk-config-app.js

**token-art-switcher.js** - Token Artwork Management
- `switchTokenArt(scene, action)` - Switches token images
  - `action: "activate"` - Apply tactical map token art
  - `action: "deactivate"` - Restore original or hexcrawl art
- Batched updates (5 tokens at a time) to prevent UI freezing
- File existence caching to reduce filesystem checks

**background-effects.js** - Visual Effects
- `toggleBackgroundBlur()` - Enable/disable blur effect
- `forceApplyBlur()` / `forceRemoveBlur()` - Direct blur control
- `animateBlur()` - Smooth blur transitions
- Syncs blur state across all clients via scene flags

**bulk-config-app.js** - Application V2 Bulk Configuration Dialog
- `TacticalMapBulkConfig` - Extends foundry.applications.api.ApplicationV2
- `_prepareContext()` - Organizes scenes by folder with all settings
- `_onToggleFolder()` / `_onToggleScene()` - Accordion expand/collapse
- `_onUpdateSetting()` - Debounced auto-save (500ms)
- `_onPickFile()` - FilePicker integration for images
- `_onPopoutImage()` - Opens ImagePopout for full-size preview
- Compact 6-line inline editing for all 13 settings per scene

**global-config.js** - Module Settings
- Registers module settings during `init` hook
- `useAlternativeTokenArt` - Global toggle for token art switching
- `debugMode` - Enable console logging
- Dynamic scene-specific setting registration

**logger-tcmap.js** - Debug Utilities
- `debugLog()` - Conditional logging based on debug mode

## Important Patterns

### Foundry VTT API Usage

**Application V2 Pattern:**
```javascript
// IMPORTANT: Use HandlebarsApplicationMixin for template rendering
class TacticalMapBulkConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "tactical-map-bulk-config",
    window: { title: "...", resizable: true },
    position: { width: 900, height: 700 },
    actions: { /* event handlers */ }
  };

  static PARTS = {
    form: { template: "modules/tactical-map/templates/bulk-config.hbs" }
  };

  async _prepareContext(options) {
    // Organize data for template
  }
}
```

**V13 Token Access:**
```javascript
// CORRECT - v13
const texture = token.document.texture.src;
await token.document.update({ "texture.src": newPath });

// WRONG - v12 (deprecated)
const texture = token.texture.src;
await token.update({ "texture.src": newPath });
```

**CSS is automatically built** - Don't compile or read CSS files. The module uses `styles/tactical-map.css` and `styles/bulk-config.css` which are loaded automatically via `module.json`.

### Hooks Architecture

The module extensively uses Foundry's Hook system:

```javascript
Hooks.once('init', () => { /* Settings registration, UI initialization */ });
Hooks.once('ready', () => { /* Module initialization */ });
Hooks.on('renderSceneDirectory', (app, html, data) => { /* Add bulk config button */ });
Hooks.on('getSceneControlButtons', (controls) => { /* Add toolbar button */ });
Hooks.on('canvasReady', (canvas) => { /* Apply effects, restore positions */ });
Hooks.on('createToken', (scene, tokenData) => { /* Handle new tokens */ });
Hooks.on('updateScene', (scene, changes, options, userId) => { /* Sync state */ });
```

### Canvas Position Restoration

Canvas positions must be restored **after** `canvasReady` fires:

```javascript
Hooks.once("canvasReady", () => {
  restoreCanvasPosition(scene, targetPositionFlag);
});
```

Never try to restore positions before the canvas is ready.

### Blur Effect Synchronization

Blur effects are managed via **scene flags** to sync across clients:
- GM sets `blurActive` flag on scene
- Other clients listen for `updateScene` hook
- Non-GM clients apply blur locally without modifying flags

### Token Art Switching Logic

**CRITICAL:** The suffix logic depends on both action and map state:

```javascript
if (action === "activate" || isTacticalMapActive) {
  // Use tactical map type suffix (_tdv, _isv, _hxv)
  suffix = mapType === "top-down" ? "_tdv" :
           (mapType === "isometric" ? "_isv" : "_hxv");
} else {
  // Deactivating: check if main map is hexcrawl
  suffix = isMainMapHexcrawl ? "_hxv" : "";
}
```

When deactivating, if `isMainMapHexcrawl` is true, use `_hxv` suffix. Otherwise restore original (no suffix).

### Scene Controls Button Pattern

Adding buttons to the token controls toolbar:

```javascript
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
```

## Development Commands

This module has **no build process**. Changes to JavaScript files take effect immediately after refreshing Foundry VTT.

### Testing in Foundry VTT

1. Make code changes
2. Refresh the browser (`F5`)
3. Test in a world with the module enabled

### Debugging

Enable debug mode in module settings to see detailed console logs:
```javascript
game.settings.set("tactical-map", "debugMode", true);
```

Access debug commands:
```javascript
game.tacticalMap.logPositions(); // View saved positions
```

### Common Issues

**Blur not syncing for players:**
- Check that `blurActive` is set on scene flags (not user flags)
- Verify `updateScene` hook is firing on client
- Ensure canvas is ready before applying blur

**Token art not switching:**
- Verify `useAlternativeTokenArt` setting is enabled
- Check that alternative images exist with correct suffixes
- Confirm `originalImage` flag is set on tokens

**Positions not restoring:**
- Ensure positions are stored before scene updates
- Verify restoration happens after `canvasReady` hook
- Check that position flags are saved to correct location (scene vs user)

## File Structure

```
tactical-map/
├── js/
│   ├── global-config.js       # Settings registration
│   ├── logger-tcmap.js        # Debug logging
│   ├── background-effects.js  # Blur effects
│   ├── ui-management.js       # Directory button and toolbar
│   ├── tactical-map.js        # Core toggle logic
│   ├── token-art-switcher.js  # Token artwork
│   ├── cache-manager.js       # Caching utilities
│   ├── grid-conversion.js     # Grid conversions
│   └── bulk-config-app.js     # Application V2 bulk config dialog
├── styles/
│   ├── tactical-map.css       # Auto-loaded styles
│   └── bulk-config.css        # Bulk config dialog styles
├── templates/
│   └── bulk-config.hbs        # Bulk config dialog template
├── module.json                # Module manifest
├── README.md                  # User documentation
├── CHANGELOG.md               # Version history
└── CLAUDE.md                  # This file
```

## Foundry VTT Compatibility

- **Minimum:** v13
- **Verified:** v13
- **Maximum:** v13

**Pure v13 implementation** - No backward compatibility with v12. Uses Application V2 and native v13 APIs throughout.
