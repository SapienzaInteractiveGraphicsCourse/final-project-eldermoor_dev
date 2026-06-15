import * as THREE from 'three';
import { QUALITY } from './qualitySettings.js';
import { getTerrainHeight } from './terrainHeight.js';

// ================== PROCEDURAL MOUNTAIN ARC ==================
// A single procedural mountain range forming a semicircle around the walls,

// Arc geometry 
const ARC_DEG_START = -95;
const ARC_DEG_END   =  95;
const ARC_SEGS_U    = 480;
const ARC_SEGS_V    = 90;
const RING_DEPTH    = 200;
const MARGIN        = 15;

// Height and character 
const MAX_HEIGHT    = 70;
const MIN_HEIGHT    = 0;
const PEAK_FLATTEN  = 0.80;
const NOISE_SCALE   = 0.014;
const SEED          = 4242;
const Y_OFFSET      = 0;

// Geometric rocky detail 
const ROCK_AMPLITUDE   = 11;
const ROCK_FREQ_BIG    = 4.0;
const ROCK_FREQ_SMALL  = 14.0;
const ROCK_MASK_START  = 0.05;
const ROCK_MASK_FULL   = 0.22;

//textures 
const TEXTURE_PATH    = './trees_and_rocks/Icelandic_Jagged_Slate_Rock_shfsaida_2K_';
const TEXTURE_TILE    = 35;    // world units per repeat (lower = more "zoomed" texture)
const NORMAL_STRENGTH = 1.3;   // normal map strength

// Wall radius as a function of angle (mirrors walls.js)
function getWallRadius(deg) {
  const WALL_R = 110;
  const NE_DEG = 45;
  const neDist = Math.abs(deg - NE_DEG);
  const neWeight = Math.max(0, 1 - neDist / 70);
  const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
  return WALL_R + neWeight * 50 - westWeight * 40;
}

// ================== NOISE ==================

function hash2(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 0.137) * 43758.5453;
  return s - Math.floor(s);
}

// Bilinearly-interpolated value noise
function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const a = hash2(xi,     yi,     seed);
  const b = hash2(xi + 1, yi,     seed);
  const c = hash2(xi,     yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}

// Ridged multi-octave noise -> sharp mountain ridges
function softRidge(x, y, seed, octaves = 5) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let maxSum = 0;
  for (let i = 0; i < octaves; i++) {
    let n = valueNoise(x * frequency, y * frequency, seed + i * 17);
    n = 1 - Math.abs(2 * n - 1);
    sum    += n * amplitude;
    maxSum += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return sum / maxSum;
}

// Standard fractal Brownian motion -> smooth rolling shape
function fbm(x, y, seed, octaves = 4) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let maxSum = 0;
  for (let i = 0; i < octaves; i++) {
    sum    += valueNoise(x * frequency, y * frequency, seed + i * 31) * amplitude;
    maxSum += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return sum / maxSum;
}

// ================== MAIN ==================

export async function createMountains(scene) {
  // load PBR textures in parallel 
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
    loadTex('BaseColor.jpg'),
    loadTex('Normal.jpg'),
    loadTex('Roughness.jpg'),
  ]);

  // Textures must tile across the whole range
  [colorMap, normalMap, roughnessMap].forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = QUALITY.anisotropy;       // sharper at grazing angles
  });
  // BaseColor is a color map -> sRGB; the others stay linear
  colorMap.colorSpace = THREE.SRGBColorSpace;

  // geometry
  // Start from a flat plane and warp each vertex into an arc whose height comes
  // from the noise functions above
  const geo = new THREE.PlaneGeometry(1, 1, ARC_SEGS_U, ARC_SEGS_V);
  geo.rotateX(-Math.PI / 2);

  const pos    = geo.attributes.position;
  const uv     = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);

    const uFrac = lx + 0.5;
    const vFrac = lz + 0.5;

    // u -> angle along the arc, v -> radial distance outward from the walls
    const angleDeg = ARC_DEG_START + (ARC_DEG_END - ARC_DEG_START) * uFrac;
    const angleRad = THREE.MathUtils.degToRad(angleDeg);

    const wallR    = getWallRadius(angleDeg);
    const nearDist = wallR + MARGIN;
    const radial   = nearDist + vFrac * RING_DEPTH;

    const wx = Math.sin(angleRad) * radial;
    const wz = -Math.cos(angleRad) * radial;

    const nx = wx * NOISE_SCALE;
    const nz = wz * NOISE_SCALE;

    // base shape 
    const ridges = softRidge(nx, nz, SEED, 5);
    const smooth = fbm(nx, nz, SEED + 100, 5);
    const macro  = fbm(nx * 0.45, nz * 0.45, SEED + 500, 3);

    let hSample = (ridges * 0.60 + smooth * 0.40) * (0.55 + macro * 0.55);
    hSample = Math.max(0, Math.min(1, hSample));
    hSample = Math.pow(hSample, PEAK_FLATTEN);

    // geometric rocky detail 
    const rockBig = softRidge(
      nx * ROCK_FREQ_BIG, nz * ROCK_FREQ_BIG, SEED + 700, 3
    );
    const rockSmall = (
      valueNoise(nx * ROCK_FREQ_SMALL, nz * ROCK_FREQ_SMALL, SEED + 900) - 0.5
    );
    let rockDetail = rockBig * 0.75 + rockSmall * 0.45;
    rockDetail = Math.max(0, rockDetail);
    const rockMask = smoothstep(ROCK_MASK_START, ROCK_MASK_FULL, hSample);

    // edge fades 
    const arcEndsFade = smoothEdgeFade(uFrac, 0.07);
    const farFade     = smoothstep(1.0, 0.90, vFrac);
    const nearFade    = smoothstep(0.0, 0.28, vFrac);
    const fade = arcEndsFade * farFade * nearFade;

    // final height 
    const baseHeight = (MAX_HEIGHT - MIN_HEIGHT) * hSample * fade;
    const rockHeight = ROCK_AMPLITUDE * rockDetail * rockMask * fade;
    const height = MIN_HEIGHT + baseHeight + rockHeight;

    const terrainY = getTerrainHeight(wx, wz);
    const wy = terrainY + height + Y_OFFSET;

    pos.setXYZ(i, wx, wy, wz);

    // world-space UVs: the texture tiles uniformly across the ring 
    uv.setXY(i, wx / TEXTURE_TILE, wz / TEXTURE_TILE);

    // per-zone tint: MULTIPLIED with the texture 
    // Values near 1 -> nearly pure texture
    // Values > 1   -> brighten the texture (useful for snow)
    // Colored tints -> elevation shades (green at base, brown at the foot, etc.)
    const totalMax  = MAX_HEIGHT + ROCK_AMPLITUDE;
    const altT      = height / totalMax;
    const rockiness = Math.min(1, rockHeight / (ROCK_AMPLITUDE * 0.8));

    if (altT > 0.82) {
      // snow -> strongly brightens the texture (bluish white)
      const snowT = (altT - 0.82) / 0.18;
      colors[i * 3]     = 1.45 + snowT * 0.35;
      colors[i * 3 + 1] = 1.50 + snowT * 0.30;
      colors[i * 3 + 2] = 1.55 + snowT * 0.25;
    } else if (altT > 0.55 || rockiness > 0.55) {
      // exposed rock -> nearly pure texture
      colors[i * 3]     = 1.05;
      colors[i * 3 + 1] = 1.05;
      colors[i * 3 + 2] = 1.08;
    } else if (altT > 0.28 || rockiness > 0.25) {
      // mid elevation -> slightly muted texture
      colors[i * 3]     = 0.92;
      colors[i * 3 + 1] = 0.90;
      colors[i * 3 + 2] = 0.86;
    } else if (altT > 0.08) {
      // lower slopes -> warm earthy tint over the rock
      colors[i * 3]     = 0.90;
      colors[i * 3 + 1] = 0.72;
      colors[i * 3 + 2] = 0.50;
    } else {
      // base -> mossy green tint
      colors[i * 3]     = 0.55;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.40;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  uv.needsUpdate  = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map:           colorMap,
    normalMap:     normalMap,
    roughnessMap:  roughnessMap,
    normalScale:   new THREE.Vector2(NORMAL_STRENGTH, NORMAL_STRENGTH),
    vertexColors:  true,        // multiplies the per-zone tints
    roughness:     1.0,         // multiplied with the roughnessMap
    metalness:     0.0,
    flatShading:   false,
    side:          THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Fades to 0 near both ends of [0,1].
function smoothEdgeFade(t, margin) {
  if (t < margin)     return smoothstep(0, margin, t);
  if (t > 1 - margin) return smoothstep(1, 1 - margin, t);
  return 1;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}