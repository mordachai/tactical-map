# Tactical Map Switcher

**Tactical Map** is a Foundry VTT module that allows GMs to toggle between a normal scene and a tactical map on the active scene. It provides a seamless transition between the two.

It's a quality of life module, especially if you are running a Theather of the Mind game, but want to solve combats more tactically.

Check it out in action: https://www.youtube.com/watch?v=oQfRU0lHkbE

## Features

- Add a Tactical Map image to any scene via the Scene Configuration menu.
- Fast switch between the original scene and the tactical map, preserving zoom and position.
- Use alternative token images for each type of map: top-down and isometric
- Automatically adds tokens to a combat encounter when switching to the tactical map.
- Preserve tokens positions and rotations independently.
- Supports different grid types and sizes for both maps, sharing the same color, line type, and opacity configuration.

## Installation

To install this module, follow these steps:

1. In Foundry VTT, go to the **Add-on Modules** tab
2. Click **Install Module**
3. Paste the following manifest URL into the bottom **Manifest URL** field: 
https://raw.githubusercontent.com/mordachai/tactical-map/main/module.json

OR

Search in the top bar for "tactical map"

4. Click **Install**
5. Enable the module in your **Game Settings** under **Manage Modules**

## Usage and Settings

The following settings are available for configuration in the Scene Configuration menu:

- **Tactical Map Image**: The image path for the Tactical Map
- **Tactical Map Grid Type**: The type of grid to be used on the Tactical Map (Gridless, Square, 2x Hexagonal)
- **Tactical Map Grid Size**: The size of the grid on the Tactical Map
- **Tactical Map Type:** Top-down View and Isometric View. It is only important if you want to use alternative token images for each view. 
- **Add Tokens to Encounter**: Automatically adds all scene tokens to a combat encounter when the Tactical Map is activated

### Adding a Tactical Map

1. Open the **Scene Configuration** for any scene.

![image](https://github.com/user-attachments/assets/ef2d42d2-69a1-4b71-9592-40559256ca19)

2. In the **Basics** tab locate the **Tactical Map** settings
3. Provide the path to your Tactical Map image in the **Tactical Map Image** field
4. Configure the grid type and size as needed, they can be different from the main scene, but will use the same color and line configuration
5. Optionally, check **Add Tokens to Encounter** if you want all scene tokens to be added to a combat encounter when the tactical map is activated
6. Save your scene

### Alternative token images

Put in the same folder of your token image one or two variants to be used with the tactical maps:

#### Top-down view: {token image}_tdv.ext
#### Isometric view: {token image}_isv.ext

If you don't have images for that map type don't worry, the main one will be used.

![image](https://github.com/user-attachments/assets/af073b58-4ea2-4809-8c2f-28fbd4b43fc5)

### Switching to the Tactical Map

#### 1. Once the Tactical Map is configured, a new button called **Toggle Tactical Map** will appear in the Token Controls toolbar

![image](https://github.com/user-attachments/assets/67ddc0b4-1104-481d-adad-33c0c73d008a)

#### 2. Click this button to switch to the Tactical Map. The scene will automatically zoom and center to display the Tactical Map.

### SWITCHING MAPS CAN ONLY BE DONE ON THE **ACTIVE SCENE**

![image](https://github.com/user-attachments/assets/b2589eec-8645-4213-b0cc-bb3c968ccada)

![image](https://github.com/user-attachments/assets/f584fe67-79c7-463c-9e9a-69ac65b03c16)
   
#### 3. Click the button again to return to the original scene settings. The tokens will keep their positions on each map and if you add any new token to the scene they will initially be positioned at the margins of the other scene in case they fall out of range due to scene sizes. 

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue on GitHub.

## License
GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007



