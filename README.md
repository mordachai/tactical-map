# Tactical Map Switcher

**Tactical Map** is a Foundry VTT module that allows GMs to toggle between a normal scene and a tactical map. It provides a seamless transition between the two, including storing and restoring the scene's position and zoom levels.

## Features

- Add a Tactical Map image to any scene via the Scene Configuration menu.
- Automatically switch between the original scene and the tactical map, preserving zoom and position.
- Automatically adds tokens to a combat encounter when switching to the tactical map.

## Installation

To install this module, follow these steps:

1. In Foundry VTT, go to the **Add-on Modules** tab in the **Configuration and Setup** menu.
2. Click **Install Module**.
3. Paste the following manifest URL into the **Manifest URL** field:

4. Click **Install**.
5. Enable the module in your **World Configuration** under **Manage Modules**.

## Usage

### Adding a Tactical Map

1. Open the **Scene Configuration** for any scene.
2. Scroll to the bottom and locate the **Tactical Map** settings.
3. Provide the path to your Tactical Map image in the **Tactical Map Image** field.
4. Configure the grid type and size as needed.
5. Optionally, check **Add Tokens to Encounter** if you want all scene tokens to be added to a combat encounter when the tactical map is activated.
6. Save your scene.

### Switching to the Tactical Map

1. Once the Tactical Map is configured, a new button called **Toggle Tactical Map** will appear in the Token Controls toolbar.
2. Click this button to switch to the Tactical Map. The scene will automatically zoom and center to display the entire Tactical Map.
3. Click the button again to return to the original scene settings, restoring the previous zoom and position.

## Settings

The following settings are available for configuration in the Scene Configuration menu:

- **Tactical Map Image**: The image path for the Tactical Map.
- **Tactical Map Grid Type**: The type of grid to be used on the Tactical Map (Gridless, Square, Hexagonal).
- **Tactical Map Grid Size**: The size of the grid on the Tactical Map.
- **Add Tokens to Encounter**: Automatically adds all scene tokens to a combat encounter when the Tactical Map is activated.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue on GitHub.

## License



