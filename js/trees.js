import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrainHeight.js';
import { buildInstancedFromPrefabs } from './instanceUtils.js';

// ================== TREES AROUND CITY WALLS ==================

// OPTIMIZATION: it gathers the placements and renders them as a few
// InstancedMeshes 

const MODEL_PATHS = [
  './trees_and_rocks/more_realistic_trees_free.glb',
  './trees_and_rocks/pine_tree_trio_free_download.glb',
  './trees_and_rocks/low_poly_trees_free.glb',
];

const TREES_SEED = 7777;
function makeRng(seed) {
  let s = seed >>> 0;
  return function() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(TREES_SEED);

const GROUND_HALF   = 150;
const GROUND_MARGIN = 4;
const NO_TREE_ZONE_DEG = 100;
const GATE_CORRIDOR_DEG = 25;
const NUM_TREES        = 500;
const INNER_OFFSET     = 4;
const MIN_TREE_SPACING = 2.6;
const TARGET_TREE_HEIGHT = 7.5;
const SCALE_MIN          = 0.65;
const SCALE_MAX          = 1.35;

// Wall radius as a function of angle
function getWallRadius(deg) {
  const WALL_R = 110;
  const NE_DEG = 45;
  const neDist = Math.abs(deg - NE_DEG);
  const neWeight = Math.max(0, 1 - neDist / 70);
  const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
  return WALL_R + neWeight * 50 - westWeight * 40;
}

// Max radius before hitting the square ground edge, for a given angle
function getMaxRadius(deg) {
  const rad = deg * Math.PI / 180;
  const sx  = Math.abs(Math.sin(rad));
  const sz  = Math.abs(Math.cos(rad));
  const lim = GROUND_HALF - GROUND_MARGIN;
  const rX  = sx > 0.001 ? lim / sx : Infinity;
  const rZ  = sz > 0.001 ? lim / sz : Infinity;
  return Math.min(rX, rZ);
}

// Random angle on the flanks/front, leaving a clear corridor at the gate
function randomValidAngle() {
  const halfCorridor = GATE_CORRIDOR_DEG / 2;
  const angleMin = NO_TREE_ZONE_DEG;
  const angleMax = 180 - halfCorridor;
  const span = angleMax - angleMin;
  const baseAngle = angleMin + rng() * span;
  return rng() < 0.5 ? baseAngle : -baseAngle;
}

export async function createTrees(scene) {
  const loader = new GLTFLoader();
  const loadGLB = (path) => new Promise((resolve, reject) => {
    loader.load(path, (gltf) => resolve(gltf.scene), undefined,
      () => reject(new Error('Missing model: ' + path)));
  });

  const rawModels = await Promise.all(MODEL_PATHS.map(loadGLB));

  // Normalize each model to a target height and rest it on the ground
  const treePrefabs = rawModels.map(model => {
    model.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow    = true;
        obj.receiveShadow = true;
      }
    });

    const box  = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const factor = size.y > 0.001 ? TARGET_TREE_HEIGHT / size.y : 1;

    const prefab = new THREE.Group();
    model.scale.setScalar(factor);
    model.position.y = -box.min.y * factor;
    prefab.add(model);

    return prefab;
  });

  const placements = [];
  const placedPositions = [];
  let placed = 0;
  let attempts = 0;
  const MAX_ATTEMPTS = NUM_TREES * 25;

  // Rejection sampling: keep trying angle/radius pairs that respect spacing
  while (placed < NUM_TREES && attempts < MAX_ATTEMPTS) {
    attempts++;

    const deg = randomValidAngle();
    const rad = deg * Math.PI / 180;

    const wallR = getWallRadius(deg);
    const maxR  = getMaxRadius(deg);
    const rMin  = wallR + INNER_OFFSET;
    const rMax  = maxR;

    if (rMax <= rMin + 1) continue;

    // sqrt distribution -> uniform area density between rMin and rMax
    const r = Math.sqrt(rMin * rMin + rng() * (rMax * rMax - rMin * rMin));
    const x = Math.sin(rad) * r;
    const z = -Math.cos(rad) * r;

    let tooClose = false;
    for (const p of placedPositions) {
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz < MIN_TREE_SPACING * MIN_TREE_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const y = getTerrainHeight(x, z);
    const prefabIndex = Math.floor(rng() * treePrefabs.length);
    const scale = SCALE_MIN + rng() * (SCALE_MAX - SCALE_MIN);

    placements.push({
      prefabIndex,
      position: { x, y, z },
      scale,
      rotationY: rng() * Math.PI * 2,
    });

    placedPositions.push({ x, z });
    placed++;
  }

  const instanced = buildInstancedFromPrefabs(treePrefabs, placements);
  scene.add(instanced);
}
