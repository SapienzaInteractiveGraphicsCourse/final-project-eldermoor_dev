import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { QUALITY } from './qualitySettings.js';

// ================== WHITEWASHED BRICK TEXTURES ==================
const textureLoader = new THREE.TextureLoader();
const TEX_FONT = './soil_textures/';

function loadBrickTex(name, repeatU, repeatV) {
  const diff  = textureLoader.load(TEX_FONT + 'whitewashed_brick_diff_2k.png');
  const norm  = textureLoader.load(TEX_FONT + 'whitewashed_brick_nor_gl_2k.png');
  const rough = textureLoader.load(TEX_FONT + 'whitewashed_brick_rough_2k.png');
  const ao    = textureLoader.load(TEX_FONT + 'whitewashed_brick_ao_2k.png');
  for (const tex of [diff, norm, rough, ao]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatU, repeatV);
  }
  diff.colorSpace = THREE.SRGBColorSpace;
  return { diff, norm, rough, ao };
}

// ================== MONUMENTAL FOUNTAIN ==================
// Three stacked basins on pillars, decorative columns, and animated water jets
export function createFountain(scene, cx, cz) {
  const y = getTerrainHeight(cx, cz) + 0.1;
  const fountain = new THREE.Group();
 
  // === MATERIALS ===
  const brickA = loadBrickTex('main', 3, 2);
  const stoneMat = new THREE.MeshStandardMaterial({
    map: brickA.diff,
    normalMap: brickA.norm,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: brickA.rough,
    aoMap: brickA.ao,
    roughness: 0.8,
    metalness: 0.05,
  });
 
  const brickB = loadBrickTex('light', 2, 1.5);
  const stoneLight = new THREE.MeshStandardMaterial({
    map: brickB.diff,
    normalMap: brickB.norm,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: brickB.rough,
    aoMap: brickB.ao,
    color: 0xddccbb,
    roughness: 0.75,
    metalness: 0.05,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4fb8e6,           
    roughness: 0.4,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
 
  // collect the jet droplet meshes
  const jetParticles  = [];   // { mesh, x0, z0, baseY, topY, speed, phase }
 
  // helper: flat circular celeste water surface 
  function makeWaterDisc(radius, yLevel, segs = 20) {
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      if (d > radius) {           // outside the circle -> pull onto the edge
        const k = radius / d;
        pos.setX(i, x * k); pos.setZ(i, z * k);
      }
    }
    pos.needsUpdate = true;
    const mesh = new THREE.Mesh(geo, waterMat);
    mesh.position.set(0, yLevel, 0);
    mesh.receiveShadow = true;
    return mesh;
  }
 
  // === LEVEL 1 — Large octagonal basin (base) ===
  const base1R = 5.0, base1H = 1.2;
  // Outer rim (torus)
  const rim1Geo = new THREE.TorusGeometry(base1R, 0.5, 10, 8);
  rim1Geo.rotateX(Math.PI / 2);
  const rim1 = new THREE.Mesh(rim1Geo, stoneMat);
  rim1.position.set(0, base1H, 0);
  rim1.castShadow = true; rim1.receiveShadow = true;
  fountain.add(rim1);
 
  // Lower basin wall
  const wall1Geo = new THREE.CylinderGeometry(base1R - 0.2, base1R + 0.3, base1H, 8);
  const wall1 = new THREE.Mesh(wall1Geo, stoneMat);
  wall1.position.set(0, base1H / 2, 0);
  wall1.castShadow = true; wall1.receiveShadow = true;
  fountain.add(wall1);
 
  // Level 1 water — widened to reach the basin wall
  const water1 = makeWaterDisc(base1R - 0.15, base1H - 0.05, 24);
  fountain.add(water1);
 
  // Base steps (3 concentric rings)
  for (let s = 0; s < 3; s++) {
    const stepR = base1R + 1.0 + s * 0.8;
    const stepH = 0.25;
    const stepY = (2 - s) * stepH;
    const stepGeo = new THREE.CylinderGeometry(stepR, stepR + 0.15, stepH, 8);
    const step = new THREE.Mesh(stepGeo, stoneLight);
    step.position.set(0, stepY + stepH / 2, 0);
    step.receiveShadow = true;
    fountain.add(step);
  }
 
  // === FIRST-LEVEL PILLAR ===
  const p1H = 2.5;
  const p1Geo = new THREE.CylinderGeometry(0.5, 0.6, p1H, 8);
  const p1 = new THREE.Mesh(p1Geo, stoneLight);
  p1.position.set(0, base1H + p1H / 2, 0);
  p1.castShadow = true;
  fountain.add(p1);
 
  // === LEVEL 2 — Medium basin ===
  const base2R = 3.0, base2H = 0.8;
  const base2Y = base1H + p1H;
 
  const rim2Geo = new THREE.TorusGeometry(base2R, 0.35, 8, 8);
  rim2Geo.rotateX(Math.PI / 2);
  const rim2 = new THREE.Mesh(rim2Geo, stoneMat);
  rim2.position.set(0, base2Y + base2H, 0);
  rim2.castShadow = true;
  fountain.add(rim2);
 
  const wall2Geo = new THREE.CylinderGeometry(base2R - 0.15, base2R + 0.1, base2H, 8);
  const wall2 = new THREE.Mesh(wall2Geo, stoneMat);
  wall2.position.set(0, base2Y + base2H / 2, 0);
  wall2.castShadow = true; wall2.receiveShadow = true;
  fountain.add(wall2);
 
  // Level 2 water — widened to the wall
  const water2 = makeWaterDisc(base2R - 0.12, base2Y + base2H - 0.04, 20);
  fountain.add(water2);
 
  // === SECOND-LEVEL PILLAR ===
  const p2H = 2.0;
  const p2Geo = new THREE.CylinderGeometry(0.35, 0.45, p2H, 8);
  const p2 = new THREE.Mesh(p2Geo, stoneLight);
  p2.position.set(0, base2Y + base2H + p2H / 2, 0);
  p2.castShadow = true;
  fountain.add(p2);
 
  // === LEVEL 3 — Small basin (top) ===
  const base3R = 1.5, base3H = 0.5;
  const base3Y = base2Y + base2H + p2H;
 
  const rim3Geo = new THREE.TorusGeometry(base3R, 0.25, 8, 12);
  rim3Geo.rotateX(Math.PI / 2);
  const rim3 = new THREE.Mesh(rim3Geo, stoneMat);
  rim3.position.set(0, base3Y + base3H, 0);
  rim3.castShadow = true;
  fountain.add(rim3);
 
  const wall3Geo = new THREE.CylinderGeometry(base3R - 0.1, base3R + 0.05, base3H, 12);
  const wall3 = new THREE.Mesh(wall3Geo, stoneMat);
  wall3.position.set(0, base3Y + base3H / 2, 0);
  wall3.castShadow = true;
  fountain.add(wall3);
 
  // Level 3 water — widened to the wall
  const water3 = makeWaterDisc(base3R - 0.08, base3Y + base3H - 0.03, 16);
  fountain.add(water3);
 
  // === TOP FINIAL ===
  const pinH = 1.8;
  const pinGeo = new THREE.CylinderGeometry(0.08, 0.25, pinH, 8);
  const pin = new THREE.Mesh(pinGeo, stoneLight);
  pin.position.set(0, base3Y + base3H + pinH / 2, 0);
  pin.castShadow = true;
  fountain.add(pin);
 
  // Decorative sphere on top
  const sphereGeo = new THREE.SphereGeometry(0.25, 12, 12);
  const sphere = new THREE.Mesh(sphereGeo, stoneMat);
  sphere.position.set(0, base3Y + base3H + pinH + 0.25, 0);
  sphere.castShadow = true;
  fountain.add(sphere);
 
  // === DECORATIVE COLUMNS around the base basin ===
  const numCols = 8;
  for (let i = 0; i < numCols; i++) {
    const a = (i / numCols) * Math.PI * 2;
    const colR = base1R + 0.3;
    const colX = Math.cos(a) * colR;
    const colZ = Math.sin(a) * colR;
    const colH = 1.8;
 
    // Column
    const colGeo = new THREE.CylinderGeometry(0.15, 0.18, colH, 6);
    const col = new THREE.Mesh(colGeo, stoneLight);
    col.position.set(colX, base1H + colH / 2, colZ);
    col.castShadow = true;
    fountain.add(col);
 
    // Ball on top
    const capGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const cap = new THREE.Mesh(capGeo, stoneMat);
    cap.position.set(colX, base1H + colH + 0.15, colZ);
    cap.castShadow = true;
    fountain.add(cap);
  }
 
  // === WATER JETS ===
  // Droplet material: bright bluish white
  const dropMat = new THREE.MeshStandardMaterial({
    color: 0xcdeefb, roughness: 0.2, metalness: 0.0,
    transparent: true, opacity: 0.85,
    emissive: 0x6fb6d8, emissiveIntensity: 0.25,
  });
 
  // top where the central jet starts: just above the top sphere
  const topY = base3Y + base3H + pinH + 0.6;
 
  // Central column: vertical jet from the top falling into basin 3
  // Simulated with a column of droplets + spray
  function makeJet(x0, z0, baseLevel, height, nDrops, spread) {
    for (let i = 0; i < nDrops; i++) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 6, 5), dropMat
      );
      drop.castShadow = false;
      fountain.add(drop);
      jetParticles.push({
        mesh: drop,
        x0, z0,
        baseY: baseLevel,
        topY: baseLevel + height,
        speed: 0.6 + Math.random() * 0.6,
        phase: Math.random(),               // 0..1 starting position in the cycle
        spread,                              // horizontal spread at fall
        ang: Math.random() * Math.PI * 2,    // fall direction
      });
    }
  }
 
  // Tall central jet (from the top toward the medium basin)
  makeJet(0, 0, base2Y + base2H, (topY - (base2Y + base2H)) * 0.9, 18, 0.6);
 
  // Crown of jets rising from the medium basin and falling into the large one
  const ringJets = 6;
  for (let j = 0; j < ringJets; j++) {
    const a = (j / ringJets) * Math.PI * 2;
    const rr = base2R * 0.5;
    makeJet(Math.cos(a) * rr, Math.sin(a) * rr, base2Y + base2H, 1.6, 7, 1.0);
  }
 
  // Outer jets from the large basin rim aimed inward
  const outerJets = 8;
  for (let j = 0; j < outerJets; j++) {
    const a = (j / outerJets) * Math.PI * 2;
    const rr = base1R - 1.0;
    makeJet(Math.cos(a) * rr, Math.sin(a) * rr, base1H - 0.1, 1.3, 6, 0.8);
  }
 
  // === ANIMATION ===
  let _fountainFrame = 0;
  fountain.userData.update = function (time) {
    _fountainFrame++;
    if ((_fountainFrame % QUALITY.vegetationAnimEvery) !== 0) return;
    // jet droplets: parabolic up/down cycle
    for (const jp of jetParticles) {
      let t = (time * jp.speed + jp.phase) % 1;   // 0..1
      // parabolic height: 0 at t=0 and t=1, max at t=0.5
      const h = 4 * t * (1 - t);
      const y = jp.baseY + (jp.topY - jp.baseY) * h;
      // horizontal spread increasing toward the fall
      const spreadT = jp.spread * t;
      const x = jp.x0 + Math.cos(jp.ang) * spreadT;
      const z = jp.z0 + Math.sin(jp.ang) * spreadT;
      jp.mesh.position.set(x, y, z);
      // droplets shrink at the top (spray effect)
      const sc = 0.7 + 0.5 * (1 - h);
      jp.mesh.scale.setScalar(sc);
    }
  };
 
  fountain.position.set(cx, y, cz);
  scene.add(fountain);
 
  return fountain;
}