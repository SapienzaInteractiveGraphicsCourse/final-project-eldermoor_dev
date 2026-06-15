import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrainHeight.js';
import { isOnRoad } from './roads.js';
import { buildInstancedFromPrefabs } from './instanceUtils.js';
import { QUALITY } from './qualitySettings.js';

// ================== GRASS + FLOWER SCATTER ==================
// Scatters tufts of game_ready_grass.glb and, more sparsely, the red/pink
// flowers used around the lake, over the free grass of the NORTH-EAST quadrant
// (windmill + lake)
//


const GRASS_PATH = './grass_and_flowers/';

// grass 
const GRASS_MODELS = [
  'game_ready_grass.glb',
  'realistic_grass_pack_for_games_free.glb',
];
// red/pink flowers
const FLOWER_MODELS = [
  './grass_and_flowers/pink_flower/phlox candystrip cluster glb.glb',
  './grass_and_flowers/red_flower/glb red flowering.glb',
];

// Deterministic PRNG (reproducible scene)
let _seed = 990017;
const rand = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

//tolerant GLB loading
function loadGLB(loader, fullPath) {
  return new Promise((resolve) => {
    loader.load(fullPath,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => { console.warn('Scatter: model not loaded (skipping):', fullPath); resolve(null); }
    );
  });
}

// Normalizes a model to a target height, centered and resting on the ground
function makePrefab(scene, targetH) {
  scene.traverse(o => { if (o.isMesh) { o.castShadow = QUALITY.vegetationShadows; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  if (size.y < 0.001) return null;
  const factor = targetH / size.y;
  const prefab = new THREE.Group();
  scene.scale.setScalar(factor);
  scene.position.set(
    -((box.min.x + box.max.x) / 2) * factor,
    -box.min.y * factor,
    -((box.min.z + box.max.z) / 2) * factor
  );
  prefab.add(scene);
  return prefab;
}

// wall shape 
function getWallRadius(deg) {
  const WALL_R = 110;
  const NE_DEG = 45;
  const neDist = Math.abs(deg - NE_DEG);
  const neWeight = Math.max(0, 1 - neDist / 70);
  const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
  return WALL_R + neWeight * 50 - westWeight * 40;
}
function insideWalls(x, z, margin = 5) {
  const deg = THREE.MathUtils.radToDeg(Math.atan2(x, -z));
  const r = Math.sqrt(x * x + z * z);
  return r < getWallRadius(deg) - margin;
}

// Big paved area (large square + wedge) approximated with a disc, centered like
// the large square, with a little margin
const PAVE_CX = 0, PAVE_CZ = 25, PAVE_R = 54;
function onBigPavement(x, z) {
  const dx = x - PAVE_CX, dz = z - PAVE_CZ;
  return (dx * dx + dz * dz) <= PAVE_R * PAVE_R;
}

function inAvoidRects(x, z, rects, pad = 1.5) {
  for (const r of rects) {
    const hw = r.w / 2 + pad, hd = r.d / 2 + pad;
    if (x >= r.cx - hw && x <= r.cx + hw && z >= r.cz - hd && z <= r.cz + hd) return true;
  }
  return false;
}

// Is this a free spot for vegetation?
function isFree(x, z, rects) {
  if (!insideWalls(x, z, 4)) return false;
  if (isOnRoad(x, z)) return false;
  if (onBigPavement(x, z)) return false;
  if (inAvoidRects(x, z, rects)) return false;
  return true;
}

function place(out, prefabIndex, x, z, sMin, sMax) {
  const s = sMin + rand() * (sMax - sMin);
  out.push({
    prefabIndex,
    position: { x, y: getTerrainHeight(x, z), z },
    scale: s,
    rotationY: rand() * Math.PI * 2,
  });
}

export async function scatterVegetation(scene, options = {}) {
  const {
    // default: NORTH-EAST quadrant (windmill + lake)
    minX = 0, maxX = 135, minZ = -110, maxZ = 0,
    grassSpacing = 4,    // grid step (smaller = denser): lots of grass
    grassJitter  = 3.0,  // random offset from the grid node
    flowerChance = 0.22, // fraction of nodes that become a flower instead of grass
    redBias      = 0.75, // probability that a flower is red (vs pink)
    avoidRects   = [],
  } = options;

  const grassSpacingQ = grassSpacing / Math.sqrt(QUALITY.scatterDensity);

  const loader = new GLTFLoader();
  const grassScenes  = await Promise.all(GRASS_MODELS.map(f => loadGLB(loader, GRASS_PATH + f)));
  const flowerScenes = await Promise.all(FLOWER_MODELS.map(p => loadGLB(loader, p)));
  const grassPrefabs  = grassScenes.filter(Boolean).map(s => makePrefab(s, 1.0)).filter(Boolean);
  // keep the color association: index 0 = pink, index 1 = red
  const pinkPrefab = flowerScenes[0] ? makePrefab(flowerScenes[0], 1.2) : null;
  const redPrefab  = flowerScenes[1] ? makePrefab(flowerScenes[1], 1.2) : null;

  if (grassPrefabs.length === 0 && !pinkPrefab && !redPrefab) {
    console.warn('Scatter: no model (grass/flowers) loaded.');
    return 0;
  }

  // Single prefab array for instancing: grass first, then pink and red
  // Save the indices to reference them in the loop
  const allPrefabs = [...grassPrefabs];
  const grassIdx = grassPrefabs.map((_, i) => i);
  const pinkIdx = pinkPrefab ? allPrefabs.push(pinkPrefab) - 1 : -1;
  const redIdx  = redPrefab  ? allPrefabs.push(redPrefab)  - 1 : -1;
  const hasFlowers = pinkIdx >= 0 || redIdx >= 0;

  const placements = [];
  let count = 0;
  for (let gx = minX; gx <= maxX; gx += grassSpacingQ) {
    for (let gz = minZ; gz <= maxZ; gz += grassSpacingQ) {
      const x = gx + (rand() - 0.5) * grassJitter * 2;
      const z = gz + (rand() - 0.5) * grassJitter * 2;
      if (!isFree(x, z, avoidRects)) continue;

      // every so often a flower, otherwise a grass tuft
      // Among flowers, prefer red ones 
      if (hasFlowers && rand() < flowerChance) {
        let fi;
        if (redIdx >= 0 && pinkIdx >= 0) fi = (rand() < redBias) ? redIdx : pinkIdx;
        else fi = (redIdx >= 0) ? redIdx : pinkIdx;
        place(placements, fi, x, z, 0.6, 1.1);
      } else if (grassPrefabs.length > 0) {
        place(placements, grassIdx[Math.floor(rand() * grassIdx.length)], x, z, 0.7, 1.3);
      }
      count++;
    }
  }

  const _scatterGroup = buildInstancedFromPrefabs(allPrefabs, placements);
  scene.add(_scatterGroup);
  _scatterGroup.userData.scatterCount = count;
  return _scatterGroup;
}