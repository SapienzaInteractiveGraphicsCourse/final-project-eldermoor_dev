import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import {
  brickBaseColor, brickRoughness, brickNormal,
  roofTileMat, fixConeUVs
} from './textures.js';

// ================== CITY WALLS ==================
// Builds a ring of wall segments with merlons and towers following getWallRadius, plus a gate between
// the two gate towers with an iron portcullis
export function createCityWalls(scene) {
  const WALL_H = 10;
  const WALL_THICK = 1.5;
  const MERLON_H = 2;
  const MERLON_W = 1.2;
  const MERLON_GAP = 1.5;

  const wallMat = new THREE.MeshStandardMaterial({
    map: brickBaseColor,
    roughnessMap: brickRoughness,
    normalMap: brickNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0xa3a8ac,          // dark gray: darkens and desaturates the brick texture
    roughness: 0.85,
    metalness: 0.0
  });

  const merlonMat = new THREE.MeshStandardMaterial({
    map: brickBaseColor,
    roughnessMap: brickRoughness,
    normalMap: brickNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0xa3a8ac,          // same dark gray as the walls
    roughness: 0.85,
    metalness: 0.0
  });

  const R = 110;
  const wallPoints = [];
  const startDeg = -170, endDeg = 170, steps = 50;

  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + (endDeg - startDeg) * (i / steps);
    const rad = deg * Math.PI / 180;
    const baseX = Math.sin(rad);
    const baseZ = -Math.cos(rad);
    const neDeg = 45;
    const neDist = Math.abs(deg - neDeg);
    const neWeight = Math.max(0, 1 - neDist / 70);
    // narrowing to the west (around -90°): the village tightens
    const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
    const localR = R + neWeight * 50 - westWeight * 40;
    const x = baseX * localR;
    const z = baseZ * localR;
    wallPoints.push({ x, z });
  }

  for (let i = 0; i < wallPoints.length - 1; i++) {
    const p1 = wallPoints[i], p2 = wallPoints[i + 1];
    const mx = (p1.x + p2.x) / 2, mz = (p1.z + p2.z) / 2;
    const dx = p2.x - p1.x, dz = p2.z - p1.z;
    const segLen = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    const groundH = getTerrainHeight(mx, mz);

    const wallGeo = new THREE.BoxGeometry(WALL_THICK, WALL_H, segLen + 0.1);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(mx, groundH + WALL_H / 2, mz);
    wall.rotation.y = angle;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    const numMerlons = Math.floor(segLen / (MERLON_W + MERLON_GAP));
    for (let m = 0; m < numMerlons; m++) {
      const t = (m + 0.5) / numMerlons - 0.5;
      const merlonGeo = new THREE.BoxGeometry(WALL_THICK + 0.3, MERLON_H, MERLON_W);
      const merlon = new THREE.Mesh(merlonGeo, merlonMat);
      const localZ = t * segLen;
      const merlonX = mx + Math.sin(angle) * localZ;
      const merlonZ = mz + Math.cos(angle) * localZ;
      const merlonGroundH = getTerrainHeight(merlonX, merlonZ);
      merlon.position.set(merlonX, merlonGroundH + WALL_H + MERLON_H / 2, merlonZ);
      merlon.rotation.y = angle;
      merlon.castShadow = true;
      scene.add(merlon);
    }

    // a tower every 5 segments
    if (i % 5 === 0) {
      const towerR = 2.5, towerH = WALL_H + 4;
      const towerGeo = new THREE.CylinderGeometry(towerR, towerR + 0.3, towerH, 8);
      const tower = new THREE.Mesh(towerGeo, wallMat);
      tower.position.set(p1.x, groundH + towerH / 2, p1.z);
      tower.castShadow = true;
      tower.receiveShadow = true;
      scene.add(tower);

      const roofGeo = new THREE.ConeGeometry(towerR + 0.5, 3, 24, 4);
      fixConeUVs(roofGeo, 4, 2);
      const roof = new THREE.Mesh(roofGeo, roofTileMat);
      roof.position.set(p1.x, groundH + towerH + 1.5, p1.z);
      roof.castShadow = true;
      scene.add(roof);
    }
  }

  // last tower
  const lastP = wallPoints[wallPoints.length - 1];
  const lastH = getTerrainHeight(lastP.x, lastP.z);
  const towerH = WALL_H + 4;

  const tGeo = new THREE.CylinderGeometry(2.5, 2.8, towerH, 8);
  const t2 = new THREE.Mesh(tGeo, wallMat);
  t2.position.set(lastP.x, lastH + towerH / 2, lastP.z);
  t2.castShadow = true;
  scene.add(t2);

  const rGeo = new THREE.ConeGeometry(3, 3, 24, 4);
  fixConeUVs(rGeo, 4, 2);
  const r2 = new THREE.Mesh(rGeo, roofTileMat);
  r2.position.set(lastP.x, lastH + towerH + 1.5, lastP.z);
  r2.castShadow = true;
  scene.add(r2);

  // gate towers
  for (const p of [wallPoints[0], lastP]) {
    const gateH = WALL_H + 6;
    const gGeo = new THREE.CylinderGeometry(3, 3.3, gateH, 8);
    const gate = new THREE.Mesh(gGeo, wallMat);
    const gh = getTerrainHeight(p.x, p.z);
    gate.position.set(p.x, gh + gateH / 2, p.z);
    gate.castShadow = true;
    scene.add(gate);

    const grGeo = new THREE.ConeGeometry(3.5, 4, 24, 4);
    fixConeUVs(grGeo, 5, 2);
    const gRoof = new THREE.Mesh(grGeo, roofTileMat);
    gRoof.position.set(p.x, gh + gateH + 2, p.z);
    gRoof.castShadow = true;
    scene.add(gRoof);
  }

  // gate between the two gate towers
  buildGateBetweenTowers(scene, wallPoints[0], lastP, WALL_H, WALL_THICK, wallMat, merlonMat);
}

// ================== GATE ==================
function buildGateBetweenTowers(scene, pA, pB, WALL_H, WALL_THICK, wallMat, merlonMat) {
  const gateGroup = new THREE.Group();

  const mx = (pA.x + pB.x) / 2;
  const mz = (pA.z + pB.z) / 2;
  const groundH = getTerrainHeight(mx, mz);

  const dx = pB.x - pA.x;
  const dz = pB.z - pA.z;
  const span = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const OPENING_W = 8;
  const TOWER_R = 3.3;
  const MERLON_H = 2, MERLON_W = 1.2, MERLON_GAP = 1.5;

  // --- Rescaled brick texture ---
  const gBrickColor = brickBaseColor.clone();
  const gBrickRough = brickRoughness.clone();
  const gBrickNorm  = brickNormal.clone();
  for (const tex of [gBrickColor, gBrickRough, gBrickNorm]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.needsUpdate = true;
  }
  gBrickColor.colorSpace = THREE.SRGBColorSpace;

  const gateBrickMat = new THREE.MeshStandardMaterial({
    map: gBrickColor,
    roughnessMap: gBrickRough,
    normalMap: gBrickNorm,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0xa3a8ac,          // same gray as the walls
    roughness: 0.85,
    metalness: 0.0
  });

  // pillars
  const pBrickColor = brickBaseColor.clone();
  const pBrickRough = brickRoughness.clone();
  const pBrickNorm  = brickNormal.clone();
  for (const tex of [pBrickColor, pBrickRough, pBrickNorm]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 3);
    tex.needsUpdate = true;
  }
  pBrickColor.colorSpace = THREE.SRGBColorSpace;

  const pillarBrickMat = new THREE.MeshStandardMaterial({
    map: pBrickColor,
    roughnessMap: pBrickRough,
    normalMap: pBrickNorm,
    normalScale: new THREE.Vector2(1.4, 1.4),
    color: 0xa3a8ac,          // same gray as the walls
    roughness: 0.85,
    metalness: 0.0
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2e2e2e, roughness: 0.35, metalness: 0.8
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, roughness: 0.3, metalness: 0.85
  });

  // === SIDE WALLS ===
  const sideLen = (span - OPENING_W) / 2 - TOWER_R;

  for (const side of [-1, 1]) {
    if (sideLen > 0.5) {
      const wallGeo = new THREE.BoxGeometry(WALL_THICK, WALL_H, sideLen);
      const wall = new THREE.Mesh(wallGeo, gateBrickMat);
      wall.position.set(0, WALL_H / 2, side * ((span / 2 - TOWER_R) - sideLen / 2));
      wall.castShadow = true;
      wall.receiveShadow = true;
      gateGroup.add(wall);

      const numM = Math.floor(sideLen / (MERLON_W + MERLON_GAP));
      for (let m = 0; m < numM; m++) {
        const t = (m + 0.5) / numM - 0.5;
        const mGeo = new THREE.BoxGeometry(WALL_THICK + 0.3, MERLON_H, MERLON_W);
        const merlon = new THREE.Mesh(mGeo, gateBrickMat);
        merlon.position.set(0, WALL_H + MERLON_H / 2,
          side * ((span / 2 - TOWER_R) - sideLen / 2) + t * sideLen);
        merlon.castShadow = true;
        gateGroup.add(merlon);
      }
    }
  }

  // === PILLARS ===
  const pillarW = 1.2;
  const pillarH = WALL_H + 2;
  for (const side of [-1, 1]) {
    const pillarGeo = new THREE.BoxGeometry(WALL_THICK + 0.4, pillarH, pillarW);
    const pillar = new THREE.Mesh(pillarGeo, pillarBrickMat);
    pillar.position.set(0, pillarH / 2, side * (OPENING_W / 2 + pillarW / 2));
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    gateGroup.add(pillar);
  }

  // === LINTEL ===
  const lintelH = 1.5;
  const lintelSpan = OPENING_W + pillarW * 2 + 0.4;

  const lintelColor = brickBaseColor.clone();
  const lintelRough = brickRoughness.clone();
  const lintelNorm  = brickNormal.clone();
  for (const tex of [lintelColor, lintelRough, lintelNorm]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(lintelSpan / 3, 1.5);
    tex.needsUpdate = true;
  }
  lintelColor.colorSpace = THREE.SRGBColorSpace;

  const lintelMat = new THREE.MeshStandardMaterial({
    map: lintelColor, roughnessMap: lintelRough, normalMap: lintelNorm,
    normalScale: new THREE.Vector2(1.2, 1.2), color: 0xa3a8ac, roughness: 0.85, metalness: 0.0
  });

  const lintelGeo = new THREE.BoxGeometry(WALL_THICK + 0.2, lintelH, lintelSpan);
  const lintel = new THREE.Mesh(lintelGeo, lintelMat);
  lintel.position.set(0, WALL_H + lintelH / 2, 0);
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  gateGroup.add(lintel);

  // === IRON GRID (portcullis) ===
  const GRID_H = WALL_H;
  const BAR_R = 0.1;
  const V_SPACING = 0.65;
  const H_SPACING = 1.2;
  const FRAME_THICK = 0.25;

  // frame
  for (const side of [-1, 1]) {
    const frameBarGeo = new THREE.BoxGeometry(FRAME_THICK, GRID_H, FRAME_THICK);
    const frameBar = new THREE.Mesh(frameBarGeo, frameMat);
    frameBar.position.set(0, GRID_H / 2, side * OPENING_W / 2);
    frameBar.castShadow = true;
    gateGroup.add(frameBar);
  }

  const topFrameGeo = new THREE.BoxGeometry(FRAME_THICK, FRAME_THICK, OPENING_W);
  const topFrame = new THREE.Mesh(topFrameGeo, frameMat);
  topFrame.position.set(0, GRID_H, 0);
  topFrame.castShadow = true;
  gateGroup.add(topFrame);

  const botFrameGeo = new THREE.BoxGeometry(FRAME_THICK, FRAME_THICK, OPENING_W);
  const botFrame = new THREE.Mesh(botFrameGeo, frameMat);
  botFrame.position.set(0, FRAME_THICK / 2, 0);
  gateGroup.add(botFrame);

  // vertical bars
  const numVBars = Math.floor(OPENING_W / V_SPACING);
  for (let i = 0; i < numVBars; i++) {
    const bz = -OPENING_W / 2 + V_SPACING / 2 + i * V_SPACING;
    const barGeo = new THREE.CylinderGeometry(BAR_R, BAR_R, GRID_H, 6);
    const bar = new THREE.Mesh(barGeo, ironMat);
    bar.position.set(0, GRID_H / 2, bz);
    bar.castShadow = true;
    gateGroup.add(bar);
  }

  // horizontal bars
  const numHBars = Math.floor(GRID_H / H_SPACING);
  for (let i = 0; i <= numHBars; i++) {
    const by = H_SPACING / 2 + i * H_SPACING;
    if (by > GRID_H) break;
    const crossGeo = new THREE.CylinderGeometry(BAR_R * 0.8, BAR_R * 0.8, OPENING_W, 6);
    const cross = new THREE.Mesh(crossGeo, ironMat);
    cross.position.set(0, by, 0);
    cross.rotation.x = Math.PI / 2;
    cross.castShadow = true;
    gateGroup.add(cross);
  }

  // decorative spikes
  for (let i = 0; i < numVBars; i++) {
    const bz = -OPENING_W / 2 + V_SPACING / 2 + i * V_SPACING;
    const spikeGeo = new THREE.ConeGeometry(BAR_R * 2.2, 0.6, 4);
    const spike = new THREE.Mesh(spikeGeo, ironMat);
    spike.position.set(0, GRID_H + 0.3, bz);
    spike.castShadow = true;
    gateGroup.add(spike);
  }

  gateGroup.position.set(mx, groundH, mz);
  gateGroup.rotation.y = angle;
  scene.add(gateGroup);
}
