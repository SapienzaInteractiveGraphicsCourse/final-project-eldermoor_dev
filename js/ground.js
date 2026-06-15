import * as THREE from 'three';
import { getTerrainHeight, HILL_H } from './terrainHeight.js';
import { isOnRoad } from './roads.js';

// textures 
const TEXTURE_PATH     = './soil_textures/Poliigon_GrassPatchyGround_4585_';
const TEXTURE_TILE     = 12;   // world units per repeat (lower = bigger tufts)
const NORMAL_STRENGTH  = 0.8;  // normal map strength (grass is soft -> low value)
const GRASS_BRIGHTNESS = 0.8;  // brightens grass (1.0 = pure texture, 1.5 = very bright)

// ================== GROUND ==================
export async function createGround(scene) {

  // load textures in parallel 
  const texLoader = new THREE.TextureLoader();
  const loadTex = (suffix) => new Promise((resolve, reject) => {
    texLoader.load(
      TEXTURE_PATH + suffix,
      (t) => resolve(t),
      undefined,
      () => reject(new Error('Missing texture: ' + TEXTURE_PATH + suffix))
    );
  });

  const [colorMap, normalMap, roughnessMap] = await Promise.all([
    loadTex('BaseColor.png'),
    loadTex('Normal.png'),
    loadTex('Roughness.png'),
  ]);

  [colorMap, normalMap, roughnessMap].forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
  });
  colorMap.colorSpace = THREE.SRGBColorSpace;

  // geometry 
  // The ground is flat
  const SIZE = 300, SEGS = 96;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);

  const pos    = geo.attributes.position.array;
  const uv     = geo.attributes.uv;
  const colors = new Float32Array(pos.length);

  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], z = pos[i + 2];
    const h = getTerrainHeight(x, z);
    pos[i + 1] = h;

    const vi = i / 3;
    // World-space UVs -> uniform tiling independent of subdivision
    uv.setXY(vi, x / TEXTURE_TILE, z / TEXTURE_TILE);

    // These tints are MULTIPLIERS applied to the grass texture
    // To get "dirt" from grass: raise red, drop green, raise blue slightly
    if (isOnRoad(x, z)) {
      // Road/square: brownish tint, the grass texture becomes packed dirt
      colors[i]     = 1.35;
      colors[i + 1] = 0.60;
      colors[i + 2] = 0.55;
    } else {
      const hR = getTerrainHeight(x + 1, z);
      const hF = getTerrainHeight(x, z + 1);
      const slope = Math.sqrt((h - hR) * (h - hR) + (h - hF) * (h - hF));
      const t = h / HILL_H;

      if (slope > 3.0) {
        // Steep slope -> exposed dirt, less green
        colors[i]     = 1.20;
        colors[i + 1] = 0.75;
        colors[i + 2] = 0.65;
      } else if (t > 0.85) {
        // Hilltop -> slightly darker, more saturated grass
        colors[i]     = 0.85 * GRASS_BRIGHTNESS;
        colors[i + 1] = 1.05 * GRASS_BRIGHTNESS;
        colors[i + 2] = 0.80 * GRASS_BRIGHTNESS;
      } else if (t > 0.05) {
        // Mid-slope grass -> nearly pure texture
        colors[i]     = (0.95 + t * 0.05) * GRASS_BRIGHTNESS;
        colors[i + 1] = 1.00 * GRASS_BRIGHTNESS;
        colors[i + 2] = 0.95 * GRASS_BRIGHTNESS;
      } else {
        // Flat-ground grass -> pure texture, slightly brighter
        colors[i]     = 1.00 * GRASS_BRIGHTNESS;
        colors[i + 1] = 1.05 * GRASS_BRIGHTNESS;
        colors[i + 2] = 0.95 * GRASS_BRIGHTNESS;
      }
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map:          colorMap,
    normalMap:    normalMap,
    roughnessMap: roughnessMap,
    normalScale:  new THREE.Vector2(NORMAL_STRENGTH, NORMAL_STRENGTH),
    vertexColors: true,    // multiplies the per-zone tints
    roughness:    1.0,     // multiplied with the roughnessMap
    metalness:    0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
