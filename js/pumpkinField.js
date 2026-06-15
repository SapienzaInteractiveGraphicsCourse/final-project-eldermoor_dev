import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { getSoilTextures } from './soilTextures.js';

// ================== PUMPKIN FIELD ==================
// Soil (same texture as the other fields) with instanced low-poly pumpkins,
// scattered green leaves and a few tendrils. Static (pumpkins don't sway), but
// exposes a no-op userData.update(time) for loop compatibility


export function createPumpkinField(scene, cx, cz, width = 22, depth = 35, rotationY = 0) {
  const group = new THREE.Group();

  let seed = 4242;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // === SOIL ===
  const repU = width / 8, repV = depth / 8;
  const { diff: soilDiff, norm: soilNorm, rough: soilRough } = getSoilTextures(repU, repV);
  const soilMat = new THREE.MeshStandardMaterial({
    map: soilDiff, normalMap: soilNorm, roughnessMap: soilRough,
    normalScale: new THREE.Vector2(1, 1), roughness: 1.0, metalness: 0.0, color: 0xb89a78,
  });
  const soil = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), soilMat);
  soil.position.y = 0.15; soil.receiveShadow = true;
  group.add(soil);

  // furrows, as in the wheat field
  const furrowMat = new THREE.MeshStandardMaterial({
    map: soilDiff, normalMap: soilNorm, roughnessMap: soilRough,
    color: 0x6b563c, roughness: 1.0, metalness: 0.0,
  });
  const numFurrows = Math.floor(depth / 2.2);
  for (let i = 0; i < numFurrows; i++) {
    const fz = -depth / 2 + (i + 0.5) * (depth / numFurrows);
    const furrow = new THREE.Mesh(new THREE.BoxGeometry(width - 1, 0.1, 0.18), furrowMat);
    furrow.position.set(0, 0.33, fz); furrow.receiveShadow = true;
    group.add(furrow);
  }

  // === PUMPKIN GEOMETRY (squashed sphere with ribs) ===
  const pumpkinGeo = new THREE.SphereGeometry(0.55, 12, 10);
  pumpkinGeo.scale(1.0, 0.72, 1.0);   // squashed
  // rib undulation
  const pp = pumpkinGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
    const ang = Math.atan2(z, x);
    const rib = 1 + Math.sin(ang * 8) * 0.05;
    pp.setX(i, x * rib); pp.setZ(i, z * rib);
  }
  pumpkinGeo.computeVertexNormals();

  const pumpkinPalette = [0xe8731c, 0xf0822a, 0xd9661a, 0xf59331];
  const pumpkinMats = pumpkinPalette.map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.0, flatShading: false }));
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5b6b32, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a32, roughness: 0.9, side: THREE.DoubleSide });

  const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5);
  const leafGeo = new THREE.CircleGeometry(0.45, 6);

  // === QUANTITY ===
  const count = Math.max(6, Math.floor(width * depth * 0.04));
  const pumpkinMeshes = pumpkinMats.map(m =>
    new THREE.InstancedMesh(pumpkinGeo, m, Math.ceil(count / pumpkinMats.length) + 1));
  const counters = new Array(pumpkinMats.length).fill(0);
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, count);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count * 3);
  pumpkinMeshes.forEach(pm => pm.castShadow = true);
  stems.castShadow = true; leaves.castShadow = true; leaves.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const halfW = width / 2 - 1.5, halfD = depth / 2 - 1.5;
  let leafIdx = 0;

  for (let i = 0; i < count; i++) {
    const x = (rand() * 2 - 1) * halfW;
    const z = (rand() * 2 - 1) * halfD;
    const s = 0.7 + rand() * 0.7;

    // pumpkin
    dummy.position.set(x, 0.3 + 0.55 * 0.72 * s, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    const slot = i % pumpkinMats.length;
    pumpkinMeshes[slot].setMatrixAt(counters[slot], dummy.matrix);
    counters[slot]++;

    // stalk
    dummy.position.set(x, 0.3 + 0.55 * 0.72 * s + 0.55 * 0.72 * s, z);
    dummy.rotation.set(0.2, rand() * Math.PI, 0.1);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);

    // 2-3 leaves around it on the ground
    const nLeaves = 2 + Math.floor(rand() * 2);
    for (let l = 0; l < nLeaves && leafIdx < leaves.count; l++) {
      const la = rand() * Math.PI * 2, lr = 0.5 + rand() * 0.5;
      dummy.position.set(x + Math.cos(la) * lr, 0.33, z + Math.sin(la) * lr);
      dummy.rotation.set(-Math.PI / 2, 0, rand() * Math.PI * 2);
      dummy.scale.setScalar(0.7 + rand() * 0.5);
      dummy.updateMatrix();
      leaves.setMatrixAt(leafIdx++, dummy.matrix);
    }
  }
  pumpkinMeshes.forEach((pm, k) => { pm.count = counters[k]; pm.instanceMatrix.needsUpdate = true; });
  stems.instanceMatrix.needsUpdate = true;
  leaves.count = leafIdx; leaves.instanceMatrix.needsUpdate = true;

  pumpkinMeshes.forEach(pm => group.add(pm));
  group.add(stems); group.add(leaves);

  // static: no-op update for loop compatibility
  group.userData.update = function () {};

  const y = getTerrainHeight(cx, cz);
  group.position.set(cx, y, cz);
  group.rotation.y = rotationY;
  scene.add(group);
  return group;
}
