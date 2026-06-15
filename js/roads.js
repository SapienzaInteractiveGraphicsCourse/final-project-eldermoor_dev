import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { createFountain } from './fountain.js';

// ================== COBBLESTONE TEXTURES ==================
const textureLoader = new THREE.TextureLoader();
const TEX_ROAD = './soil_textures/';
const ROAD_TILE_SCALE = 0.07;

const cobbleDiff  = textureLoader.load(TEX_ROAD + 'patterned_cobblestone_diff_2k.png');
const cobbleNorm  = textureLoader.load(TEX_ROAD + 'patterned_cobblestone_nor_gl_2k.png');
const cobbleRough = textureLoader.load(TEX_ROAD + 'patterned_cobblestone_rough_2k.png');
const cobbleAO    = textureLoader.load(TEX_ROAD + 'patterned_cobblestone_ao_2k.png');

for (const tex of [cobbleDiff, cobbleNorm, cobbleRough, cobbleAO]) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
}
cobbleDiff.colorSpace = THREE.SRGBColorSpace;

// Texture for the big plaza 
const floorDiff  = textureLoader.load(TEX_ROAD + 'cobblestone_floor_01_diff_2k.png');
const floorNorm  = textureLoader.load(TEX_ROAD + 'cobblestone_floor_01_nor_gl_2k.png');
const floorRough = textureLoader.load(TEX_ROAD + 'cobblestone_floor_01_rough_2k.png');
const floorAO    = textureLoader.load(TEX_ROAD + 'cobblestone_floor_01_ao_2k.png');

for (const tex of [floorDiff, floorNorm, floorRough, floorAO]) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
}
floorDiff.colorSpace = THREE.SRGBColorSpace;

// ================== ROADS & PIAZZA ==================

// Piazza center
const PIAZZA_CX = 0;
const PIAZZA_CZ = 30;
const PIAZZA_RX = 20;
const PIAZZA_RZ = 20;

// Replica of getWallRadius from walls.js (so the big plaza follows the exact
// wall shape, including the NE bulge)
function getWallRadius(deg) {
  const WALL_R = 110;
  const NE_DEG = 45;
  const neDist = Math.abs(deg - NE_DEG);
  const neWeight = Math.max(0, 1 - neDist / 70);
  const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
  return WALL_R + neWeight * 50 - westWeight * 40;
}

// Road definitions: each road is a path from piazza outward
const ROADS = [
  // South to gate
  { points: [[0, 40], [0, 55], [0, 85], [0, 108] ], width: 9 },
  // Horizontal
  { points: [[-72, 21], [-73, 26], [-55, 30], [-40, 30], [-10, 30]], width: 9 },
  // North toward hill
  { points: [[-2, 20], [0, -20], [0, -50], [0, -62]], width: 9 },
  // West-northwest
  { points: [[-2, -2], [-20, -15], [-38, -20], [-58, -30], [-73, -37], [-73, -29]], width: 15 },
  // Northwest
  { points: [[-2, -2], [-15, -10], [-30, -5], [-40, 10], [-40, 30]], width: 9 },
  // North-northeast (toward hill)
  //{ points: [[0, -2], [8, -18], [15, -35]], width: 15 },
  // Southwest from piazza
  { points: [[-12, 42], [-30, 55], [-50, 70], [-62, 75]], width: 9 },
  // Southeast from piazza
  { points: [[12, 42], [30, 55], [50, 70], [70, 85]], width: 9 },
  // Big curve on the northwest side
{ points: [[-50, 70], [-69, 59], [-68, 9], [-68, -8], [-73, -27], [-44, -45], [-38, -50], [-10, -62], [5, -62]], width: 9 },
  // Long horizontal road toward the right
  { points: [[0, 40], [55, 25], [85, 25], [110, 28]], width: 9 },
  // Lower arc around the piazza
  { points: [[-40, 60], [-20, 70], [0, 74], [20, 70], [40, 60]], width: 9 },
  // Lower central connector, left
  { points: [[-29, 100], [-30, 80], [-20, 70]], width: 5 },
  // Lower central connector, right
  { points: [[40, 102], [30, 60]], width: 5 },
  // Dirt road exiting south-east toward the scene edge
  { points: [[0, 108], [0, 150]], width: 9, dirt: true },
];

// Check if a point is on a road or piazza
export function isOnRoad(x, z) {
  // Check piazza (ellipse)
  const pdx = (x - PIAZZA_CX) / PIAZZA_RX;
  const pdz = (z - PIAZZA_CZ) / PIAZZA_RZ;
  if (pdx * pdx + pdz * pdz <= 1.0) return true;

  // Check roads
  for (const road of ROADS) {
    const pts = road.points;
    const halfW = road.width / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1];
      const bx = pts[i + 1][0], bz = pts[i + 1][1];
      const dist = pointToSegmentDist(x, z, ax, az, bx, bz);
      if (dist <= halfW) return true;
    }
  }
  return false;
}

function pointToSegmentDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az));
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  return Math.sqrt((px - cx) * (px - cx) + (pz - cz) * (pz - cz));
}

export function createRoads(scene) {
  // BIG COBBLESTONE PLAZA 
  createBigPiazza(scene);

  // PAVING covering the inside of the walls 
  createPavedSectors(scene);

  // Create piazza as a flat elliptical disc
  const piazzaSegs = 48;
  const piazzaGeo = new THREE.CircleGeometry(1, piazzaSegs);
  piazzaGeo.rotateX(-Math.PI / 2);

  // Scale to ellipse
  const piazzaPos = piazzaGeo.attributes.position.array;
  for (let i = 0; i < piazzaPos.length; i += 3) {
    piazzaPos[i] *= PIAZZA_RX;
    piazzaPos[i + 2] *= PIAZZA_RZ;
    const wx = piazzaPos[i] + PIAZZA_CX;
    const wz = piazzaPos[i + 2] + PIAZZA_CZ;
    piazzaPos[i + 1] = getTerrainHeight(wx, wz) + 0.08;
  }
  piazzaGeo.computeVertexNormals();

  // Scale piazza UVs for tiling
  const piazzaUV = piazzaGeo.attributes.uv.array;
  const TILE_SCALE = ROAD_TILE_SCALE; // world units → UV (smaller = more tiles)
  for (let i = 0; i < piazzaPos.length; i += 3) {
    const ui = (i / 3) * 2;
    // Use world-space XZ for seamless tiling
    const wx = piazzaPos[i] + PIAZZA_CX;
    const wz = piazzaPos[i + 2] + PIAZZA_CZ;
    piazzaUV[ui]     = wx * TILE_SCALE;
    piazzaUV[ui + 1] = wz * TILE_SCALE;
  }
  piazzaGeo.attributes.uv.needsUpdate = true;

  const roadMat = new THREE.MeshStandardMaterial({
    map: cobbleDiff,
    normalMap: cobbleNorm,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: cobbleRough,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    emissive: 0x333333,
    emissiveIntensity: 0.7,
  });


const dirtRoadDiff  = textureLoader.load(TEX_ROAD + 'Forest_Path_ugsnfawlw_2K_BaseColor.jpg');
const dirtRoadNorm  = textureLoader.load(TEX_ROAD + 'Forest_Path_ugsnfawlw_2K_Normal.jpg');
const dirtRoadRough = textureLoader.load(TEX_ROAD + 'Forest_Path_ugsnfawlw_2K_Roughness.jpg');
const dirtRoadAO    = textureLoader.load(TEX_ROAD + 'Forest_Path_ugsnfawlw_2K_AO.jpg');


for (const tex of [dirtRoadDiff, dirtRoadNorm, dirtRoadRough, dirtRoadAO]) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
}
dirtRoadDiff.colorSpace = THREE.SRGBColorSpace;

const dirtMat = new THREE.MeshStandardMaterial({
  map: dirtRoadDiff,
  normalMap: dirtRoadNorm,
  normalScale: new THREE.Vector2(1.0, 1.0),
  roughnessMap: dirtRoadRough,
  roughness: 0.95,
  metalness: 0.0,
  emissive: 0x222211,
  emissiveIntensity: 0.4,
});

  const piazza = new THREE.Mesh(piazzaGeo, roadMat);
  piazza.position.set(PIAZZA_CX, 0, PIAZZA_CZ);
  piazza.receiveShadow = true;
  scene.add(piazza);

  // Create each road as a series of quads along the path
  for (const road of ROADS) {
    const mat = road.dirt ? dirtMat : roadMat;
    createRoadMesh(scene, road.points, road.width, mat);
  }

  // Decorative: well/fountain in center of piazza
  const fountain = createFountain(scene, PIAZZA_CX, PIAZZA_CZ);
  return fountain;
}

function createRoadMesh(scene, points, width, material) {
  // Subdivide the path for smoother following of terrain
  const subdivided = subdividePath(points, 1.5);
  const halfW = width / 2;

  const vertices = [];
  const uvs = [];
  const indices = [];
  const TILE_SCALE = ROAD_TILE_SCALE;

  let accumDist = 0;

  for (let i = 0; i < subdivided.length; i++) {
    const [px, pz] = subdivided[i];

    // Accumulated distance along path for V coordinate
    if (i > 0) {
      const ddx = subdivided[i][0] - subdivided[i - 1][0];
      const ddz = subdivided[i][1] - subdivided[i - 1][1];
      accumDist += Math.sqrt(ddx * ddx + ddz * ddz);
    }

    // Direction vector
    let dx, dz;
    if (i < subdivided.length - 1) {
      dx = subdivided[i + 1][0] - px;
      dz = subdivided[i + 1][1] - pz;
    } else {
      dx = px - subdivided[i - 1][0];
      dz = pz - subdivided[i - 1][1];
    }
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) continue;
    // Perpendicular
    const nx = -dz / len, nz = dx / len;

    const lx = px + nx * halfW, lz = pz + nz * halfW;
    const rx = px - nx * halfW, rz = pz - nz * halfW;
    const ly = getTerrainHeight(lx, lz) + 0.07;
    const ry = getTerrainHeight(rx, rz) + 0.07;

    vertices.push(lx, ly, lz);
    vertices.push(rx, ry, rz);

    // World-space UVs for seamless tiling
    uvs.push(lx * TILE_SCALE, lz * TILE_SCALE);
    uvs.push(rx * TILE_SCALE, rz * TILE_SCALE);
  }

  const numPairs = vertices.length / 6;
  for (let i = 0; i < numPairs - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ================== BIG COBBLESTONE PLAZA ==================
// Paving covering the entire inside of the walls
// Geometry made of concentric rings that follow the terrain,
// with the outer edge shaped to match the exact wall outline
function createBigPiazza(scene) {
  const NUM_RINGS  = 26;        // radial subdivisions (higher = better terrain following)
  const SEGS       = 96;        // angular subdivisions
  const Y_OFFSET   = 0.05;      // above the terrain (roads sit at +0.07)
  const TILE_SCALE = 0.10;      // stone size (low = big stones)
  const OFFSET_X   = 0;   // horizontal shift (positive = east)
  const OFFSET_Z   = 25;   // forward/back shift (positive = south)

  const vertices = [];
  const uvs      = [];
  const indices  = [];

  // Center vertex
  vertices.push(OFFSET_X, getTerrainHeight(OFFSET_X, OFFSET_Z) + Y_OFFSET, OFFSET_Z);
  uvs.push(OFFSET_X * TILE_SCALE, OFFSET_Z * TILE_SCALE);

   // Vertices on the concentric rings
  for (let ring = 1; ring <= NUM_RINGS; ring++) {
    const ringFrac = ring / NUM_RINGS;
    for (let s = 0; s < SEGS; s++) {
      let degFromNorth = (s / SEGS) * 360;
      if (degFromNorth > 180) degFromNorth -= 360;
      const radFromNorth = degFromNorth * Math.PI / 180;

      const wallR = getWallRadius(degFromNorth);
      const maxR  = 50;
      const r     = ringFrac * maxR;

      const x = Math.sin(radFromNorth) * r + OFFSET_X;
      const z = -Math.cos(radFromNorth) * r + OFFSET_Z;
      const y = getTerrainHeight(x, z) + Y_OFFSET;

      vertices.push(x, y, z);
      uvs.push(x * TILE_SCALE, z * TILE_SCALE);
    }
  }

  // Center → first ring triangles (CCW winding seen from above → faces up)
  for (let s = 0; s < SEGS; s++) {
    const a = 0;
    const b = 1 + s;
    const c = 1 + ((s + 1) % SEGS);
    indices.push(a, c, b);
  }

  // Triangles between successive rings
  for (let ring = 1; ring < NUM_RINGS; ring++) {
    const base     = 1 + (ring - 1) * SEGS;
    const nextBase = 1 + ring * SEGS;
    for (let s = 0; s < SEGS; s++) {
      const a = base + s;
      const b = base + ((s + 1) % SEGS);
      const c = nextBase + s;
      const d = nextBase + ((s + 1) % SEGS);
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv',  new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map:          floorDiff,
    normalMap:    floorNorm,
    roughnessMap: floorRough,
    aoMap:        floorAO,
    aoMapIntensity: 0.8,
    normalScale:  new THREE.Vector2(1.0, 1.0),
    roughness:    1.0,
    metalness:    0.0,
    side:         THREE.DoubleSide,   // safety net: visible from both sides
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ================== SECTOR PAVING (excludes the NE quadrant) ==================
// Covers the inside of the walls like the big plaza, but SKIPS the angular
// wedges of the north-east quadrant (fields, windmill, lake stay on grass).

function createPavedSectors(scene) {
  const NUM_RINGS  = 26;
  const SEGS       = 96;
  const Y_OFFSET   = 0.055;     // just above the big plaza (0.05), below the roads (0.07)
  const TILE_SCALE = 0.10;      // identical to the big plaza
  const WALL_MARGIN = 3;        // stay a hair inside the wall


  const EAST_START = 0;
  const EAST_END   = 106;
  const TRI_START  = -62;   // northwest road
  const TRI_END    = 0;     // central north road
  const INNER_R    = 60;    // fills the triangle "up to the road"

  const vertices = [];
  const uvs      = [];
  const indices  = [];

  // Map (ring,seg) -> vertex index
  const vmap = new Map();
  const key = (ring, s) => ring * 1000 + s;

  const colDeg = (s) => {
    let d = (s / SEGS) * 360;
    if (d > 180) d -= 360;
    return d;
  };

  // outer radius per angular column (consistent across adjacent wedges)
  const outerRForCol = (s) => {
    const d = colDeg(s);
    const wallR = Math.max(10, getWallRadius(d) - WALL_MARGIN);
    if (d > EAST_START && d < EAST_END) return 0;                  // east: no paving
    if (d > TRI_START  && d < TRI_END)  return Math.min(wallR, INNER_R); // NW triangle
    return wallR;
  };

  const pushVert = (ring, s, outerR) => {
    const kk = key(ring, s);
    if (vmap.has(kk)) return vmap.get(kk);
    const d = colDeg(s);
    const rad = d * Math.PI / 180;
    const r = (ring / NUM_RINGS) * outerR;
    const x = Math.sin(rad) * r;
    const z = -Math.cos(rad) * r;
    const y = getTerrainHeight(x, z) + Y_OFFSET;
    const idx = vertices.length / 3;
    vertices.push(x, y, z);
    uvs.push(x * TILE_SCALE, z * TILE_SCALE);
    vmap.set(kk, idx);
    return idx;
  };

  // Center vertex (shared)
  const centerIdx = vertices.length / 3;
  {
    const y = getTerrainHeight(0, 0) + Y_OFFSET;
    vertices.push(0, y, 0);
    uvs.push(0, 0);
  }

  for (let s = 0; s < SEGS; s++) {
    const s2 = (s + 1) % SEGS;
    const outerA = outerRForCol(s);
    const outerB = outerRForCol(s2);

    // skip the wedge if both edges are empty (east sector)
    if (outerA <= 0 && outerB <= 0) continue;

    // center → first ring triangle
    const a0 = centerIdx;
    const b0 = pushVert(1, s,  outerA);
    const c0 = pushVert(1, s2, outerB);
    indices.push(a0, c0, b0);

    // quad between successive rings
    for (let ring = 1; ring < NUM_RINGS; ring++) {
      const a = pushVert(ring,     s,  outerA);
      const b = pushVert(ring,     s2, outerB);
      const c = pushVert(ring + 1, s,  outerA);
      const d = pushVert(ring + 1, s2, outerB);
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv',  new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map:          floorDiff,
    normalMap:    floorNorm,
    roughnessMap: floorRough,
    aoMap:        floorAO,
    aoMapIntensity: 0.8,
    normalScale:  new THREE.Vector2(1.0, 1.0),
    roughness:    1.0,
    metalness:    0.0,
    side:         THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function subdividePath(points, maxSegLen) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax, dz = bz - az;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.ceil(dist / maxSegLen));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      result.push([ax + dx * t, az + dz * t]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}
