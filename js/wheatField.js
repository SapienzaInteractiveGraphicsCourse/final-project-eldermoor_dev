import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { getSoilTextures } from './soilTextures.js';
import { QUALITY } from './qualitySettings.js';

// ================== WHEAT FIELD ==================
// Soil with a earth texture 
// Low-poly instanced ears (curved stalk + grains + awns) that sway in the wind

export function createWheatField(scene, cx, cz, width = 40, depth = 40, rotationY = 0) {
  const group = new THREE.Group();

  // === deterministic PRNG ===
  let seed = 12345;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  // === SOIL (plowed earth with PBR texture) ===
  const repU = width / 8, repV = depth / 8;   // proportional tiling
  const { diff: soilDiff, norm: soilNorm, rough: soilRough } = getSoilTextures(repU, repV);

  const soilMat = new THREE.MeshStandardMaterial({
    map: soilDiff,
    normalMap: soilNorm,
    roughnessMap: soilRough,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 1.0,
    metalness: 0.0,
    color: 0xb89a78,   // lightens the soil a touch
  });

  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.3, depth), soilMat
  );
  soil.position.y = 0.15;
  soil.receiveShadow = true;
  group.add(soil);

  // plow furrows: darker strips that undulate the surface
  const furrowMat = new THREE.MeshStandardMaterial({
    map: soilDiff, normalMap: soilNorm, roughnessMap: soilRough,
    color: 0x6b563c, roughness: 1.0, metalness: 0.0,
  });
  const numFurrows = Math.floor(depth / 2.2);
  for (let i = 0; i < numFurrows; i++) {
    const fz = -depth / 2 + (i + 0.5) * (depth / numFurrows);
    const furrow = new THREE.Mesh(
      new THREE.BoxGeometry(width - 1, 0.1, 0.18), furrowMat
    );
    furrow.position.set(0, 0.33, fz);
    furrow.receiveShadow = true;
    group.add(furrow);
  }

  // === WHEAT MATERIALS ===
  const stalkMat = new THREE.MeshStandardMaterial({
    color: 0xb89a4e, roughness: 0.92, metalness: 0.0
  });
  const grainPalette = [
    0xe8c75a, 0xdcb849, 0xe6cf72, 0xcfa83e, 0xf0d98a,
  ];
  const grainMats = grainPalette.map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.0, flatShading: true })
  );
  const aristaMat = new THREE.MeshStandardMaterial({
    color: 0xd8c98a, roughness: 0.85, metalness: 0.0
  });

  // === GEOMETRY OF A WHEAT EAR (curved, with grains and awns) ===
  function buildEarGeometry() {
    const parts = [];

    // curved stalk
    const stalkH = 1.5;
    const stalk = new THREE.CylinderGeometry(0.018, 0.03, stalkH, 5, 6, true);
    const sp = stalk.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i);
      const t = (y + stalkH / 2) / stalkH;       // 0 base -> 1 top
      sp.setX(i, sp.getX(i) + t * t * 0.18);     // curve toward +X
    }
    stalk.translate(0, stalkH / 2, 0);
    stalk.computeVertexNormals();
    parts.push({ geo: stalk, mat: 'stalk' });

    // head: pairs of grains (ellipsoids) along the apex
    const headBase = stalkH;
    const headLen = 0.42;
    const tipX = 0.18;
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const tr = r / (rows - 1);
      const gy = headBase + tr * headLen;
      const gx = tipX * (tr * 0.6 + 0.4);
      const taper = 0.85 - tr * 0.45;
      for (const sideAng of [0.5, -0.5, 1.7, -1.7]) {
        const grain = new THREE.SphereGeometry(0.05 * taper, 5, 4);
        grain.scale(1.0, 1.6, 0.8);
        grain.rotateZ(sideAng * 0.5);
        grain.translate(
          gx + Math.cos(sideAng) * 0.045 * taper,
          gy,
          Math.sin(sideAng) * 0.045 * taper
        );
        parts.push({ geo: grain, mat: 'grain' });
      }
    }

    // awns (whiskers) from the tip
    for (let a = 0; a < 6; a++) {
      const arista = new THREE.CylinderGeometry(0.004, 0.002, 0.35, 3);
      arista.translate(0, 0.35 / 2, 0);
      const ang = (a / 6) * Math.PI * 2;
      arista.rotateX(0.25);
      arista.rotateY(ang);
      arista.translate(tipX, headBase + headLen, 0);
      parts.push({ geo: arista, mat: 'arista' });
    }

    return parts;
  }

  const proto = buildEarGeometry();
  function mergeByMat(matKey) {
    const geos = proto.filter(p => p.mat === matKey).map(p => p.geo);
    return mergeGeometries(geos);
  }
  const stalkGeoMerged  = mergeByMat('stalk');
  const grainGeoMerged  = mergeByMat('grain');
  const aristaGeoMerged = mergeByMat('arista');

  // === QUANTITY ===
  const density = 7.0 * QUALITY.fieldDensity;
  const count = Math.floor(width * depth * density / 4);

  const stalks  = new THREE.InstancedMesh(stalkGeoMerged, stalkMat, count);
  const aristas = new THREE.InstancedMesh(aristaGeoMerged, aristaMat, count);
  const grainMeshes = grainMats.map(m =>
    new THREE.InstancedMesh(grainGeoMerged, m, Math.ceil(count / grainMats.length) + 1)
  );
  const grainCounters = new Array(grainMats.length).fill(0);

  stalks.castShadow = QUALITY.vegetationShadows;
  aristas.castShadow = QUALITY.vegetationShadows;
  grainMeshes.forEach(gm => { gm.castShadow = QUALITY.vegetationShadows; });

  const baseMatrices = [];
  const phases = [];
  const sways  = [];
  const grainSlot = [];

  const dummy = new THREE.Object3D();
  const halfW = width / 2 - 1.5;
  const halfD = depth / 2 - 1.5;

  for (let i = 0; i < count; i++) {
    const x = (rand() * 2 - 1) * halfW;
    const z = (rand() * 2 - 1) * halfD;
    const s = 0.85 + rand() * 0.6;
    const rotY = rand() * Math.PI * 2;
    const lean = (rand() - 0.5) * 0.12;

    dummy.position.set(x, 0.3, z);
    dummy.rotation.set(lean, rotY, lean);
    dummy.scale.set(s, s + rand() * 0.2, s);
    dummy.updateMatrix();

    baseMatrices.push(dummy.matrix.clone());
    phases.push(rand() * Math.PI * 2);
    sways.push(0.05 + rand() * 0.07);

    stalks.setMatrixAt(i, dummy.matrix);
    aristas.setMatrixAt(i, dummy.matrix);

    const slot = i % grainMats.length;
    grainSlot.push(slot);
    grainMeshes[slot].setMatrixAt(grainCounters[slot], dummy.matrix);
    grainCounters[slot]++;
  }
  grainMeshes.forEach((gm, k) => { gm.count = grainCounters[k]; });

  stalks.instanceMatrix.needsUpdate = true;
  aristas.instanceMatrix.needsUpdate = true;
  grainMeshes.forEach(gm => { gm.instanceMatrix.needsUpdate = true; });

  group.add(stalks);
  group.add(aristas);
  grainMeshes.forEach(gm => group.add(gm));

  // === WIND ANIMATION ===
  const tiltAxis = new THREE.Vector3(0, 0, 1);
  const tmp = new THREE.Object3D();
  const grainCursor = new Array(grainMats.length).fill(0);

  group.userData.update = function (time) {
    grainCursor.fill(0);
    for (let i = 0; i < count; i++) {
      tmp.matrix.copy(baseMatrices[i]);
      tmp.matrix.decompose(tmp.position, tmp.quaternion, tmp.scale);
      const gust = 0.6 + 0.4 * Math.sin(time * 0.5 + tmp.position.z * 0.1);
      const wind = Math.sin(time * 1.8 + tmp.position.x * 0.3 + phases[i]) * sways[i] * gust;
      tmp.rotateOnAxis(tiltAxis, wind);
      tmp.updateMatrix();

      stalks.setMatrixAt(i, tmp.matrix);
      aristas.setMatrixAt(i, tmp.matrix);
      const slot = grainSlot[i];
      grainMeshes[slot].setMatrixAt(grainCursor[slot], tmp.matrix);
      grainCursor[slot]++;
    }
    stalks.instanceMatrix.needsUpdate = true;
    aristas.instanceMatrix.needsUpdate = true;
    grainMeshes.forEach(gm => { gm.instanceMatrix.needsUpdate = true; });
  };

  // === PLACEMENT ===
  const y = getTerrainHeight(cx, cz);
  group.position.set(cx, y, cz);
  group.rotation.y = rotationY;
  scene.add(group);

  return group;
}

// BufferGeometry merge 
function mergeGeometries(geometries) {
  const merged = new THREE.BufferGeometry();
  const nonIndexed = geometries.map(g => g.index ? g.toNonIndexed() : g);

  let total = 0;
  for (const g of nonIndexed) total += g.attributes.position.count;

  const positions = new Float32Array(total * 3);
  const normals   = new Float32Array(total * 3);

  let offset = 0;
  for (const g of nonIndexed) {
    const p = g.attributes.position.array;
    positions.set(p, offset * 3);
    if (g.attributes.normal) {
      normals.set(g.attributes.normal.array, offset * 3);
    }
    offset += g.attributes.position.count;
  }

  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  merged.computeVertexNormals();
  return merged;
}