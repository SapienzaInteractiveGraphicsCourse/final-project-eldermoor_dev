import * as THREE from 'three';

// ================== TEXTURE LOADER ==================
export const textureLoader = new THREE.TextureLoader();

const TEX_PATH = './Medieval Village MegaKit[Source]/Textures/';

// ================== BRICK TEXTURES ==================
export const brickBaseColor = textureLoader.load(TEX_PATH + 'T_Brick_BaseColor.png');
export const brickRoughness = textureLoader.load(TEX_PATH + 'T_Brick_Roughness.png');
export const brickNormal    = textureLoader.load(TEX_PATH + 'T_Brick_Normal.png');

for (const tex of [brickBaseColor, brickRoughness, brickNormal]) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
}
brickBaseColor.colorSpace = THREE.SRGBColorSpace;

// ================== ROOF TILE TEXTURES ==================
const roofBaseColor = textureLoader.load(TEX_PATH + 'T_FlatTiles_BaseColor.png');
const roofRoughness = textureLoader.load(TEX_PATH + 'T_FlatTiles_Roughness.png');
const roofNormal    = textureLoader.load(TEX_PATH + 'T_FlatTiles_Normal.png');

for (const tex of [roofBaseColor, roofRoughness, roofNormal]) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
}
roofBaseColor.colorSpace = THREE.SRGBColorSpace;

export const roofTileMat = new THREE.MeshStandardMaterial({
  map: roofBaseColor,
  roughnessMap: roofRoughness,
  normalMap: roofNormal,
  normalScale: new THREE.Vector2(1.5, 1.5),
  roughness: 0.82,
  metalness: 0.0
});

// ================== UV FIX FOR CONES ==================
// Re-projects cone UVs cylindrically so tile textures wrap cleanly around it
export function fixConeUVs(coneGeo, tilesU, tilesV) {
  const pos = coneGeo.attributes.position;
  const uv  = coneGeo.attributes.uv;
  const cnt = pos.count;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < cnt; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const h = maxY - minY;
  for (let i = 0; i < cnt; i++) {
    const ang = Math.atan2(pos.getZ(i), pos.getX(i));
    uv.setXY(i,
      (ang / (2 * Math.PI) + 0.5) * tilesU,
      ((pos.getY(i) - minY) / h) * tilesV
    );
  }
  uv.needsUpdate = true;
}
