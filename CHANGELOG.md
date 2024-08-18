# Changelog

## [2.0.0] - 2024-08-18
- **Tactical Map Types**: Now you can have alternate tokens when toggling the maps.
- **Alternative Tokens**: Use alternative tokens automatically for each map type by placing them in the same folder with a suffix in their names. Top-down view: {token image}_tdv.ext Isometric view: {token image}_isv.ext
- **Global Config**: you can disable the token switching in the game configuration options for the module.

## [1.1.0] - 2024-08-16

- **Token Position Management**: Improved the management of token positions to store them separately for the main map and the Tactical Map. Tokens now retain their correct positions on each map when toggling.
- **Animation Disabled**: Disabled the sliding animation for token movement when restoring positions. Tokens now instantly snap to their saved positions without any animation.
- **User Notification**: Added a warning notification that alerts the user when they attempt to toggle the Tactical Map on a non-active scene.

## [1.0.1] - 2024-08-15

- **UI Improvement**: Better placement of grid type and setup

## [1.0.0] - 2024-08-15

- **Core Functionality**: Implemented the ability to toggle between the main map and a Tactical Map within a scene. The Tactical Map can be customized with its own image and grid settings.
