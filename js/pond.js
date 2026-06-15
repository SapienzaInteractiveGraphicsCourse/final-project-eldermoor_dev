import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrainHeight.js';
import { QUALITY } from './qualitySettings.js';

// ================== POND ==================

const textureLoader = new THREE.TextureLoader();
const TEX_PATH = './soil_textures/';
const ROCK_PATH = './trees_and_rocks/';   // rocks
const GRASS_PATH = './grass_and_flowers/'; // grass (on the shore)

const ROCK_MODEL = 'rock_small_01.glb';
// grass near the shore
const GRASS_MODELS = [
  'game_ready_grass.glb',
  'realistic_grass_pack_for_games_free.glb',
];
// flowering bushes, outermost ring 
const BUSH_MODELS = [
  './grass_and_flowers/pink_flower/phlox candystrip cluster glb.glb',
  './grass_and_flowers/red_flower/glb red flowering.glb',
];


// tolerant GLB loading (null if missing). fullPath = full path
function loadGLB(loader, fullPath) {
  return new Promise((resolve) => {
    loader.load(fullPath,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => { console.warn('Model not loaded (skipping):', fullPath); resolve(null); }
    );
  });
}

// try several candidate paths: returns the first that loads (or null).
async function loadGLBFirst(loader, candidates) {
  for (const path of candidates) {
    const scene = await new Promise((resolve) => {
      loader.load(path, (gltf) => resolve(gltf.scene), undefined, () => resolve(null));
    });
    if (scene) return scene;
  }
  console.warn('Ground cover not found in any candidate path.');
  return null;
}

// normalize a model to a target height, centered and resting on the ground
function makePrefab(scene, targetH) {
  scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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

export async function createPond(scene, cx, cz, rx = 12, rz = 9) {
  const group = new THREE.Group();

  // deterministic PRNG
  let seed = 55221;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  //load rocks, grass (shore) and flowering bushes (outside)
  const loader = new GLTFLoader();
  const rockScene  = await loadGLB(loader, ROCK_PATH + ROCK_MODEL);
  const grassScenes = await Promise.all(GRASS_MODELS.map(f => loadGLB(loader, GRASS_PATH + f)));
  const bushScenes  = await Promise.all(BUSH_MODELS.map(p => loadGLB(loader, p)));

  const rockPrefab = rockScene ? makePrefab(rockScene, 0.8) : null;
  const grassPrefabs = grassScenes.filter(Boolean)
    .map(s => makePrefab(s, 1.0)).filter(Boolean);
  const bushPrefabs = bushScenes.filter(Boolean)
    .map(s => makePrefab(s, 1.2)).filter(Boolean);

  // === SHORE SHAPE (irregular polygon) ===
  const SEGS = 40;
  const shorePts = [];
  const wobbleRaw = [];
  for (let i = 0; i < SEGS; i++) wobbleRaw.push(0.82 + rand() * 0.3);
  const smooth = wobbleRaw.map((w, i) => {
    const a = wobbleRaw[(i - 1 + SEGS) % SEGS];
    const b = wobbleRaw[(i + 1) % SEGS];
    return (a + w * 2 + b) / 4;
  });
  for (let i = 0; i < SEGS; i++) {
    const a = (i / SEGS) * Math.PI * 2;
    shorePts.push({ x: Math.cos(a) * rx * smooth[i], z: Math.sin(a) * rz * smooth[i] });
  }

  // === SURROUNDING SOIL (same texture/color as the fields) ===
  const BED_SCALE = 1.5;   // how far the soil extends beyond the shore
  const bedShape = new THREE.Shape();
  bedShape.moveTo(shorePts[0].x * BED_SCALE, shorePts[0].z * BED_SCALE);
  for (let i = 1; i < SEGS; i++) bedShape.lineTo(shorePts[i].x * BED_SCALE, shorePts[i].z * BED_SCALE);
  bedShape.closePath();
  const bedGeo = new THREE.ShapeGeometry(bedShape, 24);
  bedGeo.rotateX(-Math.PI / 2);
  // world-space UVs so tiling matches the fields
  const bp = bedGeo.attributes.position;
  const buv = bedGeo.attributes.uv;
  for (let i = 0; i < bp.count; i++) {
    buv.setXY(i, bp.getX(i) / 8, bp.getZ(i) / 8);
  }
  buv.needsUpdate = true;

  // Per-vertex attribute: normalized elliptical distance from the center
  // (0 = center, 1 = outer edge). Used in the shader to fade the alpha toward
  // the edge
  const edgeDist = new Float32Array(bp.count);
  for (let i = 0; i < bp.count; i++) {
    const vx = bp.getX(i), vz = bp.getZ(i);
    const dn = Math.sqrt((vx / (rx * BED_SCALE)) ** 2 + (vz / (rz * BED_SCALE)) ** 2);
    edgeDist[i] = Math.min(1, dn);
  }
  bedGeo.setAttribute('aEdge', new THREE.BufferAttribute(edgeDist, 1));

  const soilDiff  = textureLoader.load(TEX_PATH + 'Forest_Path_ugsnfawlw_2K_BaseColor.jpg');
  const soilNorm  = textureLoader.load(TEX_PATH + 'Forest_Path_ugsnfawlw_2K_Normal.jpg');
  const soilRough = textureLoader.load(TEX_PATH + 'Forest_Path_ugsnfawlw_2K_Roughness.jpg');
  for (const t of [soilDiff, soilNorm, soilRough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = QUALITY.anisotropy;
  }
  soilDiff.colorSpace = THREE.SRGBColorSpace;

  const bedMat = new THREE.MeshStandardMaterial({
    map: soilDiff, normalMap: soilNorm, roughnessMap: soilRough,
    normalScale: new THREE.Vector2(1.0, 1.0),
    color: 0xb89a78,   // same color as the field soil
    roughness: 1.0, metalness: 0.0,
    transparent: true,
    depthWrite: false,
  });

  // Shader fade: alpha stays full up to FADE_START then goes to 0 toward the
  // edge, so the soil dissolves gradually into the grass.
  bedMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEdge;\nvarying float vEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vEdge = aEdge;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEdge;')
      .replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n float fadeStart = 0.75;\n float a = 1.0 - smoothstep(fadeStart, 1.0, vEdge);\n gl_FragColor.a *= a;');
  };

  const bed = new THREE.Mesh(bedGeo, bedMat);
  bed.position.y = 0.04;
  bed.receiveShadow = true;
  bed.renderOrder = 0;
  group.add(bed);

  // === RING OF ROCKS (rock_small_01.glb) around the shore ===
  if (rockPrefab) {
    const numStones = Math.floor(SEGS * 0.7);
    for (let i = 0; i < numStones; i++) {
      const t = i / numStones;
      const a = t * Math.PI * 2;
      const idx = Math.floor(t * SEGS) % SEGS;
      const er = 1.06 + rand() * 0.1;
      const sx = Math.cos(a) * rx * smooth[idx] * er;
      const sz = Math.sin(a) * rz * smooth[idx] * er;
      const stone = rockPrefab.clone(true);
      const s = 0.5 + rand() * 0.8;
      stone.scale.setScalar(s);
      stone.position.set(sx, getTerrainHeight(cx + sx, cz + sz) - getTerrainHeight(cx, cz) + 0.05, sz);
      stone.rotation.y = rand() * Math.PI * 2;
      group.add(stone);
    }
  }

  // === WATER SURFACE (dense grid for smooth waves) ===
  // Use a subdivided plane and discard vertices outside the shore shape, so we
  // have lots of interior vertices to animate 
  const GRIDN = QUALITY.tier === 'high' ? 48 : (QUALITY.tier === 'medium' ? 32 : 24);
  const waterGeo = new THREE.PlaneGeometry(rx * 2.2, rz * 2.2, GRIDN, GRIDN);
  waterGeo.rotateX(-Math.PI / 2);
  const wpos = waterGeo.attributes.position;

  // function: is the point inside the shore polygon? (ray casting)
  const insideShore = (px, pz) => {
    let inside = false;
    for (let i = 0, j = SEGS - 1; i < SEGS; j = i++) {
      const xi = shorePts[i].x, zi = shorePts[i].z;
      const xj = shorePts[j].x, zj = shorePts[j].z;
      const hit = ((zi > pz) !== (zj > pz)) &&
        (px < (xj - xi) * (pz - zi) / (zj - zi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  };

  // push vertices outside the shore onto the edge (water = lake shape)
  const baseY = new Float32Array(wpos.count);
  const edgeFade = new Float32Array(wpos.count);   // 1 at center, 0 at the edge
  for (let i = 0; i < wpos.count; i++) {
    const x = wpos.getX(i), z = wpos.getZ(i);
    baseY[i] = 0;
    const dn = Math.sqrt((x / rx) * (x / rx) + (z / rz) * (z / rz));
    edgeFade[i] = Math.max(0, 1 - dn);

    if (!insideShore(x, z)) {
      // project the vertex onto the nearest shore point (along the radial dir)
      const ang = Math.atan2(z, x);
      let best = null, bestD = Infinity;
      for (const sp of shorePts) {
        const d = (sp.x - x) * (sp.x - x) + (sp.z - z) * (sp.z - z);
        if (d < bestD) { bestD = d; best = sp; }
      }
      if (best) { wpos.setX(i, best.x * 0.98); wpos.setZ(i, best.z * 0.98); }
      edgeFade[i] = 0;   // no waves at the edge
    }
  }
  wpos.needsUpdate = true;

  // Realistic water: deep green-blue color, crisp reflections, fresnel (lighter
  // and more reflective at the edges) and slight transparency
  const useTransmission = QUALITY.tier === 'high';
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x2e6d78,           // lake green-blue
    roughness: 0.04,           // smoother surface -> sharper reflections
    metalness: 0.0,
    transmission: useTransmission ? 0.5 : 0.0,
    thickness: 2.5,
    ior: 1.333,                // real refractive index of water
    transparent: true,
    opacity: useTransmission ? 0.9 : 0.96,
    clearcoat: useTransmission ? 1.0 : 0.4,
    clearcoatRoughness: 0.04,
    reflectivity: 0.6,
    envMapIntensity: 1.4,      // makes better use of the environment for reflections
    side: THREE.DoubleSide,
  });

 
  const shallowColor = new THREE.Color(0x6fc5c8);
  const deepColor    = new THREE.Color(0x1c4f5e);
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uShallow = { value: shallowColor };
    shader.uniforms.uDeep    = { value: deepColor };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vViewDir;')
      .replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n vec4 wp = modelMatrix * vec4(transformed,1.0);\n vWorldPos = wp.xyz;\n vViewDir = normalize(cameraPosition - wp.xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vViewDir;\nuniform vec3 uShallow;\nuniform vec3 uDeep;')
      .replace('#include <color_fragment>',
        '#include <color_fragment>\n float fres = pow(1.0 - max(dot(normalize(vViewDir), vec3(0.0,1.0,0.0)), 0.0), 3.0);\n vec3 depthCol = mix(uDeep, uShallow, clamp(fres*1.5, 0.0, 1.0));\n diffuseColor.rgb = mix(diffuseColor.rgb, depthCol, 0.55);');
  };

  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0.24;
  water.receiveShadow = true;
  group.add(water);

  // --- DEBUG: expose a quick toggle for the costly transmission/clearcoat,
  // so we can measure its FPS impact at runtime (see perfToggle.js, key 'T').
  group.userData.setCheapWater = function (cheap) {
    if (cheap) {
      waterMat.transmission = 0.0;
      waterMat.clearcoat = 0.0;
      waterMat.roughness = 0.25;
      waterMat.opacity = 0.85;
    } else {
      waterMat.transmission = 0.5;
      waterMat.clearcoat = 1.0;
      waterMat.roughness = 0.04;
      waterMat.opacity = 0.9;
    }
    waterMat.needsUpdate = true;
  };
  group.userData.waterMat = waterMat;

  // array for the sway animation (filled by grass and bushes)
  const grasses = [];

  // === GRASS around the lake (near the shore) ===
  if (grassPrefabs.length > 0) {
    const numGrass = 26;
    for (let i = 0; i < numGrass; i++) {
      const a = rand() * Math.PI * 2;
      const idx = Math.floor((a / (Math.PI * 2)) * SEGS) % SEGS;
      const rr = 1.12 + rand() * 0.22;   // just beyond the shore
      const gx = Math.cos(a) * rx * smooth[idx] * rr;
      const gz = Math.sin(a) * rz * smooth[idx] * rr;
      const prefab = grassPrefabs[Math.floor(rand() * grassPrefabs.length)];
      const grass = prefab.clone(true);
      const s = 0.7 + rand() * 0.8;
      grass.scale.setScalar(s);
      grass.position.set(gx, 0.05, gz);
      grass.rotation.y = rand() * Math.PI * 2;
      group.add(grass);
      grasses.push({ mesh: grass, phase: rand() * Math.PI * 2 });
    }
  }

  // === FLOWERING BUSHES in an OUTER ring ===
  if (bushPrefabs.length > 0) {
    const numBush = 14;
    for (let i = 0; i < numBush; i++) {
      const a = rand() * Math.PI * 2;
      const idx = Math.floor((a / (Math.PI * 2)) * SEGS) % SEGS;
      const rr = 1.55 + rand() * 0.4;    // well clear of the shore
      const bx = Math.cos(a) * rx * smooth[idx] * rr;
      const bz = Math.sin(a) * rz * smooth[idx] * rr;
      const prefab = bushPrefabs[Math.floor(rand() * bushPrefabs.length)];
      const bush = prefab.clone(true);
      const s = 0.6 + rand() * 0.6;
      bush.scale.setScalar(s);
      bush.position.set(bx, 0.05, bz);
      bush.rotation.y = rand() * Math.PI * 2;
      group.add(bush);
      grasses.push({ mesh: bush, phase: rand() * Math.PI * 2 });
    }
  }

  // === ANIMATION: waves + swaying grass ===
  // The wave update (and especially computeVertexNormals) is the heaviest part,
  // so on weaker GPUs we run it only every N frames. We keep a private frame
  // counter so the loop signature stays unchanged.
  let _pondFrame = 0;
  group.userData.update = function (time) {
    _pondFrame++;
    if ((_pondFrame % QUALITY.vegetationAnimEvery) !== 0) return;

    for (let i = 0; i < wpos.count; i++) {
      const x = wpos.getX(i), z = wpos.getZ(i);
      // Superpose several wave trains with different directions, wavelengths and
      // speeds -> a less regular, more natural surface.
      const w1 = Math.sin(time * 1.1 + x * 0.45 + z * 0.20) * 0.10;
      const w2 = Math.cos(time * 0.8 + z * 0.55 - x * 0.18) * 0.07;
      const w3 = Math.sin(time * 1.7 + x * 0.85 - z * 0.65) * 0.045;
      // short, fast, high-frequency ripple
      const ripple = Math.sin(time * 3.2 + (x * 1.6 + z * 1.3)) * 0.018;
      const chop   = Math.cos(time * 2.4 - (x * 1.1 - z * 1.9)) * 0.015;
      // damp the waves toward the shore (calmer at the edge)
      const amp = edgeFade[i];
      wpos.setY(i, baseY[i] + (w1 + w2 + w3 + ripple + chop) * amp);
    }
    wpos.needsUpdate = true;
    waterGeo.computeVertexNormals();   // recompute normals -> dancing reflections

    for (const g of grasses) {
      g.mesh.rotation.z = Math.sin(time * 1.4 + g.phase) * 0.06;
    }
  };

  // === PLACEMENT ===
  const y = getTerrainHeight(cx, cz);
  group.position.set(cx, y, cz);
  scene.add(group);

  return group;
}