# Tactical Map Switcher

**Tactical Map** is a Foundry VTT module that allows GMs to toggle between a normal scene and a tactical map on the active scene. It provides a seamless transition between the two.

It's a quality of life module, especially if you are running a _Theater of the Mind_ game, but want to solve combats more tactically.

Check it out in action, click the image to open the video:

[![YouTube video](https://raw.githubusercontent.com/mordachai/tactical-map/dev/TacticalMapUpdate_snapshot.png 'Tactical Map Update')](https://youtu.be/uN3BWyXhWwU?si=1Ow4EEkvnG0Vhi63)

## Features

- Add a Tactical Map image to any scene via the Scene Configuration menu.
- No tactical map image? Blur the background and start your combat right there!
- Fast switch between the original scene and the tactical map, preserving zoom and position.
- Use alternative token images for each type of map: top-down and isometric
- Automatically adds tokens to a combat encounter when switching to the tactical map.
- Preserve tokens positions and rotations independently.
- Supports different grid types and grid settings for both maps.

## Installation

In Foundry VTT, go to the Add-on Modules tab and click Install Module. Then:

- Search in the top bar for "mist hud" and click on the Install button of the module
OR
- Paste the following manifest URL into the bottom Manifest URL field: ```https://raw.githubusercontent.com/mordachai/tactical-map/main/module.json```

After the installation enable the module in your Game Settings, under Manage Modules. 

## Scene Configuration
![image](https://raw.githubusercontent.com/mordachai/tactical-map/main/TacticalMapUpdate_panel.png)

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



