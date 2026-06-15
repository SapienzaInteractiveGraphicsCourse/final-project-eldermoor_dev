// ================== TERRAIN HEIGHT ==================
// The inner hill removed. Left for compatibility

export const HILL_CX = 75, HILL_CZ = -60;
export const HILL_RX = 55, HILL_RZ = 55;
export const HILL_H  = 15;
export const PLATEAU_R = 0.6;

// Terrain is completely flat: always returns 0
export function getTerrainHeight(x, z) {
  return 0;
}
