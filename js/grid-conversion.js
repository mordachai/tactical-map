// grid-conversion.js - A module for handling grid type conversion and token positioning

// Constants for grid types
const GRID_TYPES = {
  GRIDLESS: 0,
  SQUARE: 1,
  HEX_ROW_ODD: 2,
  HEX_ROW_EVEN: 3,
  HEX_COL_ODD: 4,
  HEX_COL_EVEN: 5
};

/**
 * Converts token positions between different grid types
 * @param {Scene} scene - The scene object
 * @param {number} sourceGridType - The source grid type
 * @param {number} targetGridType - The target grid type
 * @param {number} sourceGridSize - The source grid size
 * @param {number} targetGridSize - The target grid size
 * @param {Array} tokens - Array of token data to convert
 * @returns {Array} Converted token positions
 */
export function convertTokenPositions(scene, sourceGridType, targetGridType, sourceGridSize, targetGridSize, tokens) {
  // If grid types are the same and sizes are proportional, use simple scaling
  if (sourceGridType === targetGridType) {
    return scaleTokenPositions(tokens, sourceGridSize, targetGridSize);
  }
  
  // For conversion between different grid types
  const convertedTokens = [];
  
  for (const token of tokens) {
    // Clone the token data so we don't modify the original
    const convertedToken = {...token};
    
    // Get grid coordinates in the source grid
    const sourceGridCoords = pixelToGridCoordinates(
      token.x, 
      token.y, 
      sourceGridType, 
      sourceGridSize
    );
    
    // Convert grid coordinates to pixels in the target grid
    const targetPixelCoords = gridCoordinatesToPixel(
      sourceGridCoords.gridX,
      sourceGridCoords.gridY,
      targetGridType,
      targetGridSize
    );
    
    // Update token position
    convertedToken.x = targetPixelCoords.pixelX;
    convertedToken.y = targetPixelCoords.pixelY;
    
    // Handle token rotation if needed (especially important for hex to square conversions)
    if ((sourceGridType >= GRID_TYPES.HEX_ROW_ODD && targetGridType === GRID_TYPES.SQUARE) ||
        (sourceGridType === GRID_TYPES.SQUARE && targetGridType >= GRID_TYPES.HEX_ROW_ODD)) {
      // Adjust rotation for hex <-> square conversion if needed
      // This is a placeholder - you may need specific rotation logic based on your use case
    }
    
    convertedTokens.push(convertedToken);
  }
  
  return convertedTokens;
}

/**
 * Simple scaling of token positions for the same grid type but different sizes
 * @param {Array} tokens - Array of token data to scale
 * @param {number} sourceGridSize - The source grid size
 * @param {number} targetGridSize - The target grid size
 * @returns {Array} Scaled token positions
 */
function scaleTokenPositions(tokens, sourceGridSize, targetGridSize) {
  const scale = targetGridSize / sourceGridSize;
  
  return tokens.map(token => {
    // Deep clone the token data
    const scaledToken = {...token};
    
    // Scale the position
    scaledToken.x = token.x * scale;
    scaledToken.y = token.y * scale;
    
    return scaledToken;
  });
}

/**
 * Convert pixel coordinates to grid coordinates
 * @param {number} pixelX - X coordinate in pixels
 * @param {number} pixelY - Y coordinate in pixels
 * @param {number} gridType - The grid type
 * @param {number} gridSize - The grid size
 * @returns {Object} Grid coordinates {gridX, gridY}
 */
function pixelToGridCoordinates(pixelX, pixelY, gridType, gridSize) {
  // Implement conversion logic for different grid types
  switch (gridType) {
    case GRID_TYPES.SQUARE:
      return {
        gridX: Math.floor(pixelX / gridSize),
        gridY: Math.floor(pixelY / gridSize)
      };
      
    case GRID_TYPES.HEX_ROW_ODD:
    case GRID_TYPES.HEX_ROW_EVEN:
      // For hex rows, the width is different from height
      const hexWidth = gridSize * 3/4;
      let gridX = Math.floor(pixelX / hexWidth);
      let gridY = Math.floor(pixelY / gridSize);
      
      // Adjust for odd/even offset
      const isOddRow = gridY % 2 === 1;
      const isOddRowGrid = gridType === GRID_TYPES.HEX_ROW_ODD;
      
      if ((isOddRow && isOddRowGrid) || (!isOddRow && !isOddRowGrid)) {
        // Offset is applied to this row
        const xOffset = hexWidth / 2;
        gridX = Math.floor((pixelX - xOffset) / hexWidth);
      }
      
      return { gridX, gridY };
      
    case GRID_TYPES.HEX_COL_ODD:
    case GRID_TYPES.HEX_COL_EVEN:
      // For hex columns, the height is different from width
      const hexHeight = gridSize * 3/4;
      gridX = Math.floor(pixelX / gridSize);
      gridY = Math.floor(pixelY / hexHeight);
      
      // Adjust for odd/even offset
      const isOddCol = gridX % 2 === 1;
      const isOddColGrid = gridType === GRID_TYPES.HEX_COL_ODD;
      
      if ((isOddCol && isOddColGrid) || (!isOddCol && !isOddColGrid)) {
        // Offset is applied to this column
        const yOffset = hexHeight / 2;
        gridY = Math.floor((pixelY - yOffset) / hexHeight);
      }
      
      return { gridX, gridY };
      
    case GRID_TYPES.GRIDLESS:
    default:
      // For gridless, just divide by grid size to get a relative position
      return {
        gridX: pixelX / gridSize,
        gridY: pixelY / gridSize
      };
  }
}

/**
 * Convert grid coordinates to pixel coordinates
 * @param {number} gridX - X coordinate in grid cells
 * @param {number} gridY - Y coordinate in grid cells
 * @param {number} gridType - The grid type
 * @param {number} gridSize - The grid size
 * @returns {Object} Pixel coordinates {pixelX, pixelY}
 */
function gridCoordinatesToPixel(gridX, gridY, gridType, gridSize) {
  // Calculate center of the grid cell
  switch (gridType) {
    case GRID_TYPES.SQUARE:
      return {
        pixelX: (gridX + 0.5) * gridSize,
        pixelY: (gridY + 0.5) * gridSize
      };
      
    case GRID_TYPES.HEX_ROW_ODD:
    case GRID_TYPES.HEX_ROW_EVEN:
      // For hex rows
      const hexWidth = gridSize * 3/4;
      let pixelX = (gridX + 0.5) * hexWidth;
      const pixelY = (gridY + 0.5) * gridSize;
      
      // Adjust for odd/even offset
      const isOddRow = gridY % 2 === 1;
      const isOddRowGrid = gridType === GRID_TYPES.HEX_ROW_ODD;
      
      if ((isOddRow && isOddRowGrid) || (!isOddRow && !isOddRowGrid)) {
        // Add offset for this row
        pixelX += hexWidth / 2;
      }
      
      return { pixelX, pixelY };
      
    case GRID_TYPES.HEX_COL_ODD:
    case GRID_TYPES.HEX_COL_EVEN:
      // For hex columns
      const hexHeight = gridSize * 3/4;
      const pixelX = (gridX + 0.5) * gridSize;
      let pixelY = (gridY + 0.5) * hexHeight;
      
      // Adjust for odd/even offset
      const isOddCol = gridX % 2 === 1;
      const isOddColGrid = gridType === GRID_TYPES.HEX_COL_ODD;
      
      if ((isOddCol && isOddColGrid) || (!isOddCol && !isOddColGrid)) {
        // Add offset for this column
        pixelY += hexHeight / 2;
      }
      
      return { pixelX, pixelY };
      
    case GRID_TYPES.GRIDLESS:
    default:
      // For gridless, just multiply by grid size
      return {
        pixelX: gridX * gridSize,
        pixelY: gridY * gridSize
      };
  }
}

/**
 * Adjust token positions when switching between map types
 * @param {Scene} scene - The scene
 * @param {string} action - 'activate' or 'deactivate'
 */
export async function adjustTokenPositionsForGridChange(scene, action) {
  // Get grid types and sizes
  let sourceGridType, targetGridType, sourceGridSize, targetGridSize;
  
  if (action === 'activate') {
    // Switching from original map to tactical map
    sourceGridType = scene.getFlag("tactical-map", "originalGridType") || scene.grid.type;
    targetGridType = scene.getFlag("tactical-map", "gridType");
    sourceGridSize = scene.getFlag("tactical-map", "originalGridSize") || scene.grid.size;
    targetGridSize = scene.getFlag("tactical-map", "gridSize");
  } else {
    // Switching from tactical map to original map
    sourceGridType = scene.getFlag("tactical-map", "gridType");
    targetGridType = scene.getFlag("tactical-map", "originalGridType") || scene.grid.type;
    sourceGridSize = scene.getFlag("tactical-map", "gridSize");
    targetGridSize = scene.getFlag("tactical-map", "originalGridSize") || scene.grid.size;
  }
  
  // Skip if grid types and sizes are the same
  if (sourceGridType === targetGridType && sourceGridSize === targetGridSize) {
    return;
  }
  
  // Get token data to convert
  const tokenData = {};
  scene.tokens.contents.forEach(token => {
    tokenData[token.id] = {
      x: token.x,
      y: token.y,
      rotation: token.rotation
    };
  });
  
  // Convert positions
  const convertedTokens = convertTokenPositions(
    scene,
    sourceGridType,
    targetGridType,
    sourceGridSize,
    targetGridSize,
    Object.values(tokenData)
  );
  
  // Update token positions in the appropriate flag
  const tokenIds = Object.keys(tokenData);
  const flagName = action === 'activate' ? "tacticalTokenPositions" : "originalTokenPositions";
  
  const updatedTokenData = {};
  for (let i = 0; i < tokenIds.length; i++) {
    updatedTokenData[tokenIds[i]] = {
      x: convertedTokens[i].x,
      y: convertedTokens[i].y,
      rotation: convertedTokens[i].rotation
    };
  }
  
  await scene.setFlag("tactical-map", flagName, updatedTokenData);
}

// Hook into the toggle process to adjust positions
Hooks.on("toggleTacticalMap", (scene, action) => {
  adjustTokenPositionsForGridChange(scene, action);
});
