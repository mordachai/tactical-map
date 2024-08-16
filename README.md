# Tactical Map Switcher

**Tactical Map** is a Foundry VTT module that allows GMs to toggle between a normal scene and a tactical map on the active scene. It provides a seamless transition between the two.

It's a quality of life module, especially if you are running a Theather of the Mind game, but want to solve combats more tactically.

## Features

- Add a Tactical Map image to any scene via the Scene Configuration menu.
- Automatically switch between the original scene and the tactical map, preserving zoom and position.
- Automatically adds tokens to a combat encounter when switching to the tactical map.

## Installation

To install this module, follow these steps:



1. In Foundry VTT, go to the **Add-on Modules** tab
2. Click **Install Module**
3. Paste the following manifest URL into the bottom **Manifest URL** field:
4. 
https://raw.githubusercontent.com/mordachai/tactical-map/main/module.json

OR

Search in the top bar for "tactical map"

6. Click **Install**
7. Enable the module in your **Game Settings** under **Manage Modules**

## Usage and Settings

The following settings are available for configuration in the Scene Configuration menu:

- **Tactical Map Image**: The image path for the Tactical Map
- **Tactical Map Grid Type**: The type of grid to be used on the Tactical Map (Gridless, Square, 2x Hexagonal)
- **Tactical Map Grid Size**: The size of the grid on the Tactical Map
- **Add Tokens to Encounter**: Automatically adds all scene tokens to a combat encounter when the Tactical Map is activated

### Adding a Tactical Map

1. Open the **Scene Configuration** for any scene.

 ![image](https://github.com/user-attachments/assets/7dd07bc6-89e1-4096-9dc0-bb61c3916868)

2. Scroll to the bottom and locate the **Tactical Map** settings
3. Provide the path to your Tactical Map image in the **Tactical Map Image** field
4. Configure the grid type and size as needed, they can be different from the main scene, but will use the same color and line configuration
5. Optionally, check **Add Tokens to Encounter** if you want all scene tokens to be added to a combat encounter when the tactical map is activated
6. Save your scene

### Switching to the Tactical Map

1. Once the Tactical Map is configured, a new button called **Toggle Tactical Map** will appear in the Token Controls toolbar

![image](https://github.com/user-attachments/assets/d6c65a6a-3c91-4c15-9eba-73f35976235e)

2. Click this button to switch to the Tactical Map. The scene will automatically zoom and center to display the entire Tactical Map.

   SWITCHING WILL ONLY BE DONE ON THE **ACTIVE SCENE**

![image](https://github.com/user-attachments/assets/c7811391-1fa8-486f-90bf-c9eaca180eda)
   
3. Click the button again to return to the original scene settings, restoring the previous zoom and position

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue on GitHub.

## License
GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007



