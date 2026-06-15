import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { isOnRoad } from './roads.js';

// ================== SOFT GROUND PATCHES  ==================
// Darkens some random grass areas in the north-east quadrant (windmill + lake)
// with soft tinted veils. Two tints: dark green and brownish. Each patch is a
// semi-transparent disc with a radial alpha (full at center, transparent at the
// edge), so it blends into the grass without hard cuts


// Deterministic PRNG (reproducible scene)
let _seed = 70413;
const rand = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

// wall shape 
function getWallRadius(deg) {
  const WALL_R = 110, NE_DEG = 45;
  const neWeight   = Math.max(0, 1 - Math.abs(deg - NE_DEG) / 70);
  const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
  return WALL_R + neWeight * 50 - westWeight * 40;
}
function insideWalls(x, z, margin = 4) {
  const deg = THREE.MathUtils.radToDeg(Math.atan2(x, -z));
  const r = Math.sqrt(x * x + z * z);
  return r < getWallRadius(deg) - margin;
}

function inAvoidRects(x, z, rects, pad = 1.0) {
  for (const r of rects) {
    const hw = r.w / 2 + pad, hd = r.d / 2 + pad;
    if (x >= r.cx - hw && x <= r.cx + hw && z >= r.cz - hd && z <= r.cz + hd) return true;
  }
  return false;
}

// Radial alphaMap: white (opaque) at center -> black (transparent) at the edge
function makeRadialAlpha(size = 128, hardness = 0.35) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * hardness * 0.5,
                                     size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

export function createTerrainPatches(scene, options = {}) {
  const {
    count       = 30,     // how many patches

    minX = 0, maxX = 135, minZ = -110, maxZ = 0,
    rMin = 5, rMax = 14,  // patch radius (world units)
    yOffset     = 0.06,   // above grass with margin; stays below the roads (0.07)
    colors      = [0x2e4d1f, 0x6b4a2b], // veils: dark green + brownish
    opacity     = 0.45,   // peak intensity at center
    avoidRects  = [],
    avoidRoads  = true,
  } = options;

  const alphaTex = makeRadialAlpha(128, 0.3);

  // One material per color 
  const mats = colors.map((c) => new THREE.MeshBasicMaterial({
    color: c,
    alphaMap: alphaTex,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }));

  const group = new THREE.Group();
  let placed = 0, attempts = 0;
  const maxAttempts = count * 12;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const cx = minX + rand() * (maxX - minX);
    const cz = minZ + rand() * (maxZ - minZ);
    if (!insideWalls(cx, cz, 4)) continue;
    if (avoidRoads && isOnRoad(cx, cz)) continue;
    if (inAvoidRects(cx, cz, avoidRects)) continue;

    const r = rMin + rand() * (rMax - rMin);
    const segs = Math.max(10, Math.round(r * 1.5));  // denser grid: follows the terrain
    const geo = new THREE.PlaneGeometry(r * 2, r * 2, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const baseY = getTerrainHeight(cx, cz);
    for (let i = 0; i < pos.count; i++) {
      const wx = cx + pos.getX(i), wz = cz + pos.getZ(i);
      pos.setY(i, getTerrainHeight(wx, wz) - baseY + yOffset);
    }
    pos.needsUpdate = true;

    const mat = mats[Math.floor(rand() * mats.length)];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, baseY, cz);
    mesh.rotation.y = rand() * Math.PI * 2;  // breaks the alphaMap repetition
    group.add(mesh);
    placed++;
  }

  scene.add(group);
  return placed;
}
