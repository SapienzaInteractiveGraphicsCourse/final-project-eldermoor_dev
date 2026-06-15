import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrainHeight.js';
import { isOnRoad } from './roads.js';
import { buildInstancedFromPrefabs } from './instanceUtils.js';

// ================== BOUNDARY TREES (windmill + fields) ==================
const MODEL_PATHS = [
  './trees_and_rocks/quick_treeit_tree.glb',
  './trees_and_rocks/lodbillboard_summer_trees_pack.glb',
  './trees_and_rocks/high_quality_tree_66.glb',
  './trees_and_rocks/fall_grijze_populier_tree_2k.glb',
  './trees_and_rocks/tree_2.glb',
];

const TARGET_H = 9;
let _prefabsPromise = null;

// shared deterministic PRNG
let _seed = 24680;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
}

// FORBIDDEN ZONES (axis-aligned rectangles, world coords)
// Each rect: { minX, maxX, minZ, maxZ, pad }
const _noTreeRects = [];

// Register an area where NO trees should go (e.g. a field). pad = extra margin
export function addNoTreeRect(cx, cz, width, depth, pad = 2) {
  _noTreeRects.push({
    minX: cx - width / 2 - pad,
    maxX: cx + width / 2 + pad,
    minZ: cz - depth / 2 - pad,
    maxZ: cz + depth / 2 + pad,
  });
}

export function clearNoTreeRects() { _noTreeRects.length = 0; }

function inNoTreeRect(x, z) {
  for (const r of _noTreeRects) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
  }
  return false;
}

// A position is valid if NOT on a road and NOT in a field
// roadPad = how far to stay from the road edge (samples around the point)
function isFreeSpot(x, z, roadPad = 2.5) {
  if (inNoTreeRect(x, z)) return false;
  if (isOnRoad(x, z)) return false;
  // sample a small ring to keep clear of the road edge
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    if (isOnRoad(x + Math.cos(ang) * roadPad, z + Math.sin(ang) * roadPad)) return false;
  }
  return true;
}

// recolors an "autumn" tree's foliage to green 
// Tells foliage from trunk: the trunk is brown/dark gray, autumn leaves are
// yellow/orange (high R, low B, warm hue).
function greenifyFoliage(root) {
  const targetGreen = new THREE.Color(0x4f7a2e);   // leaf green
  root.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      const name = (mat.name || '').toLowerCase();
      const isTrunkByName = /trunk|bark|stem|wood|branch|stam|hout/.test(name);
      const isLeafByName  = /leaf|leaves|foliage|blad|canopy|needle/.test(name);

      let isFoliage = isLeafByName;
      if (!isLeafByName && !isTrunkByName && mat.color) {
        // color heuristic: warm (yellow/orange) and not too dark
        const c = mat.color;
        const warm = c.r > 0.35 && c.r >= c.b && (c.r + c.g) > c.b * 1.4;
        const notDarkBrown = (c.r + c.g + c.b) > 0.6;
        if (warm && notDarkBrown) isFoliage = true;
      }

      if (isFoliage && mat.color) {
        if (mat.map) {
          // there's a texture: tint it green (multiplicative)
          mat.color.copy(targetGreen).multiplyScalar(1.6);
        } else {
          mat.color.copy(targetGreen);
        }
        if ('emissive' in mat && mat.emissive) {
          mat.emissive.setRGB(0, 0, 0);
        }
        mat.needsUpdate = true;
      }
    }
  });
}

// load and normalize the models once 
function loadPrefabs(targetH = TARGET_H) {
  if (_prefabsPromise) return _prefabsPromise;

  const loader = new GLTFLoader();
  // tolerant loading: a missing model returns null (doesn't block)
  const loadOne = (path) => new Promise((resolve) => {
    loader.load(path, (gltf) => resolve(gltf.scene), undefined,
      () => { console.warn('Tree not loaded (skipping):', path); resolve(null); });
  });

  _prefabsPromise = Promise.all(MODEL_PATHS.map(loadOne)).then((scenesRaw) => {
    const prefabs = [];
    // keep the scene<->path association to apply targeted fixes
    const entries = scenesRaw
      .map((scene, i) => ({ scene, path: MODEL_PATHS[i] }))
      .filter(e => e.scene);

    if (entries.length === 0) {
      console.error('No tree model loaded: check the files in ./trees_and_rocks/');
      return prefabs;   // empty array: the functions won't place anything
    }

    for (const { scene, path } of entries) {
      // The "fall" poplar has yellow/orange leaves: make it green.
      if (path.includes('fall_grijze_populier')) greenifyFoliage(scene);

      scene.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      const topChildren = scene.children.filter(c => {
        let hasMesh = false;
        c.traverse(o => { if (o.isMesh) hasMesh = true; });
        return hasMesh;
      });

      const candidates = topChildren.length > 1 ? topChildren : [scene];

      for (const cand of candidates) {
        const obj = cand.clone(true);
        const box  = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        if (size.y < 0.001) continue;
        const factor = targetH / size.y;

        const prefab = new THREE.Group();
        obj.scale.setScalar(factor);
        obj.position.set(
          -((box.min.x + box.max.x) / 2) * factor,
          -box.min.y * factor,
          -((box.min.z + box.max.z) / 2) * factor
        );
        prefab.add(obj);
        prefabs.push(prefab);
      }
    }

    return prefabs;
  });

  return _prefabsPromise;
}

// Mirror of the wall radius 
function getWallRadius(deg) {
  const WALL_R = 110, NE_DEG = 45;
  const neDist = Math.abs(deg - NE_DEG);
  const neWeight = Math.max(0, 1 - neDist / 70);
  const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
  return WALL_R + neWeight * 50 - westWeight * 40;
}

// True if the point is INSIDE the walls (with an inner margin)
function insideWalls(x, z, margin = 5) {
  const deg = THREE.MathUtils.radToDeg(Math.atan2(x, -z)); // 0=north, +east
  const r = Math.sqrt(x * x + z * z);
  return r < getWallRadius(deg) - margin;
}

function placeTree(out, prefabs, x, z, scaleMin, scaleMax) {
  if (!prefabs || prefabs.length === 0) return;   // no model available
  const prefabIndex = Math.floor(rand() * prefabs.length);
  const s = scaleMin + rand() * (scaleMax - scaleMin);
  // Collects the placement; instancing happens at the end of the function
  out.push({
    prefabIndex,
    position: { x, y: getTerrainHeight(x, z), z },
    scale: s,
    rotationY: rand() * Math.PI * 2,
  });
}

// ================== RING AROUND A CENTER ==================
export async function createWindmillTrees(scene, cx, cz, options = {}) {
  const {
    count = 8, innerR = 10, outerR = 22,
    avoidDeg = null, avoidSpan = 70,
    scaleMin = 0.8, scaleMax = 1.3, targetH = TARGET_H,
    roadPad = 2.5,
  } = options;

  const prefabs = await loadPrefabs(targetH);
  const placed = [];
  const placements = [];
  let attempts = 0;
  const maxAttempts = count * 60;

  while (placed.length < count && attempts < maxAttempts) {
    attempts++;
    const ang = rand() * Math.PI * 2;
    const deg = THREE.MathUtils.radToDeg(ang);

    if (avoidDeg !== null) {
      let diff = Math.abs(deg - (((avoidDeg % 360) + 360) % 360));
      if (diff > 180) diff = 360 - diff;
      if (diff < avoidSpan / 2) continue;
    }

    const r = innerR + rand() * (outerR - innerR);
    const x = cx + Math.cos(ang) * r;
    const z = cz + Math.sin(ang) * r;

    if (!isFreeSpot(x, z, roadPad)) continue;     // no roads/fields

    let tooClose = false;
    for (const p of placed) {
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz < 16) { tooClose = true; break; }
    }
    if (tooClose) continue;

    placeTree(placements, prefabs, x, z, scaleMin, scaleMax);
    placed.push({ x, z });
  }
  scene.add(buildInstancedFromPrefabs(prefabs, placements));
  return placed.length;
}

// ================== ROW / STRIP OF TREES ==================
export async function createTreeRow(scene, x1, z1, x2, z2, options = {}) {
  const {
    count = 10, rows = 1, rowGap = 4, jitter = 1.5,
    scaleMin = 0.8, scaleMax = 1.35, targetH = TARGET_H,
    roadPad = 2.5,
  } = options;

  const prefabs = await loadPrefabs(targetH);

  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const ux = dx / len, uz = dz / len;
  const nx = -uz, nz = ux;

  const placed = [];
  const placements = [];
  for (let r = 0; r < rows; r++) {
    const offset = r * rowGap;
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const px = x1 + dx * t + nx * offset + (rand() - 0.5) * jitter;
      const pz = z1 + dz * t + nz * offset + (rand() - 0.5) * jitter;

      if (!isFreeSpot(px, pz, roadPad)) continue;   // no roads/fields

      let tooClose = false;
      for (const p of placed) {
        const ddx = px - p.x, ddz = pz - p.z;
        if (ddx * ddx + ddz * ddz < 9) { tooClose = true; break; }
      }
      if (tooClose) continue;

      placeTree(placements, prefabs, px, pz, scaleMin, scaleMax);
      placed.push({ x: px, z: pz });
    }
  }
  scene.add(buildInstancedFromPrefabs(prefabs, placements));
  return placed.length;
}

// ================== FILL AN AREA (forest) ==================
// Scatters trees over a rectangle [minX,maxX] x [minZ,maxZ] with adjustable
// density, discarding roads, fields and anything outside the walls
export async function fillTreeArea(scene, minX, maxX, minZ, maxZ, options = {}) {
  const {
    spacing = 6, jitter = 2.5,
    scaleMin = 0.75, scaleMax = 1.4, targetH = TARGET_H,
    roadPad = 2.5, wallMargin = 5, minDist = 4,
  } = options;

  const prefabs = await loadPrefabs(targetH);
  const placed = [];
  const placements = [];
  const minD2 = minDist * minDist;

  for (let gx = minX; gx <= maxX; gx += spacing) {
    for (let gz = minZ; gz <= maxZ; gz += spacing) {
      const x = gx + (rand() - 0.5) * jitter * 2;
      const z = gz + (rand() - 0.5) * jitter * 2;

      if (!insideWalls(x, z, wallMargin)) continue;  // outside the walls
      if (!isFreeSpot(x, z, roadPad)) continue;       // roads/fields

      let tooClose = false;
      for (const p of placed) {
        const dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < minD2) { tooClose = true; break; }
      }
      if (tooClose) continue;

      placeTree(placements, prefabs, x, z, scaleMin, scaleMax);
      placed.push({ x, z });
    }
  }
  scene.add(buildInstancedFromPrefabs(prefabs, placements));
  return placed.length;
}
