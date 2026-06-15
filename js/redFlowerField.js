import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { getSoilTextures } from './soilTextures.js';

// ================== RED FLOWER FIELD ==================
// Rows of clumps with red flowers (stylized poppies/tulips), like the lavender
// but red. Green stems + red corolla. Instanced sways in the wind


export function createRedFlowerField(scene, cx, cz, width = 18, depth = 35, rotationY = 0) {
  const group = new THREE.Group();

  let seed = 54321;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // === SOIL ===
  const repU = width / 8, repV = depth / 8;
  const { diff: soilDiff, norm: soilNorm, rough: soilRough } = getSoilTextures(repU, repV);
  const soilMat = new THREE.MeshStandardMaterial({
    map: soilDiff, normalMap: soilNorm, roughnessMap: soilRough,
    normalScale: new THREE.Vector2(1, 1), roughness: 1.0, metalness: 0.0, color: 0xa8906f,
  });
  const soil = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), soilMat);
  soil.position.y = 0.15; soil.receiveShadow = true;
  group.add(soil);

  // === MATERIALS ===
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x5c8a44, roughness: 0.95, flatShading: true });
  const flowerPalette = [0xe02020, 0xd11414, 0xf03030, 0xc81818, 0xff3b3b];
  const flowerMats = flowerPalette.map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.0,
      emissive: new THREE.Color(c).multiplyScalar(0.12), side: THREE.DoubleSide }));

  // geometry: stem + corolla (cup of red petals)
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.022, 0.8, 4);
  stemGeo.translate(0, 0.4, 0);
  // corolla: open half-sphere like a cup of petals
  const flowerGeo = new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2.2);
  flowerGeo.translate(0, 0.8, 0);
  // low foliage tuft
  const foliageGeo = new THREE.SphereGeometry(0.22, 6, 5, 0, Math.PI*2, 0, Math.PI/2);
  foliageGeo.scale(1, 0.5, 1);

  // === ROWS ===
  const rowSpacing = 1.4;
  const plantSpacingZ = 1.0;
  const halfW = width / 2 - 1.2, halfD = depth / 2 - 1.2;
  const numRows = Math.max(1, Math.floor((halfW * 2) / rowSpacing));
  const numZ = Math.max(1, Math.floor((halfD * 2) / plantSpacingZ));
  const total = numRows * numZ;

  const stems = new THREE.InstancedMesh(stemGeo, stemMat, total);
  const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, total);
  const flowerMeshes = flowerMats.map(m =>
    new THREE.InstancedMesh(flowerGeo, m, Math.ceil(total / flowerMats.length) + 1));
  const fCounters = new Array(flowerMats.length).fill(0);
  stems.castShadow = true; foliage.castShadow = true;
  flowerMeshes.forEach(fm => fm.castShadow = true);

  const dummy = new THREE.Object3D();
  const baseMatrices = [];
  const phases = [], sways = [], flowerSlot = [];
  let idx = 0;

  for (let rx = 0; rx < numRows; rx++) {
    const x = -halfW + rx * rowSpacing + (rand() - 0.5) * 0.2;
    for (let rz = 0; rz < numZ; rz++) {
      const z = -halfD + rz * plantSpacingZ + (rand() - 0.5) * 0.3;
      const s = 0.8 + rand() * 0.5;
      dummy.position.set(x, 0.3, z);
      dummy.rotation.set((rand()-0.5)*0.1, rand()*Math.PI*2, (rand()-0.5)*0.1);
      dummy.scale.set(s, s + rand()*0.2, s);
      dummy.updateMatrix();

      baseMatrices.push(dummy.matrix.clone());
      phases.push(rand() * Math.PI * 2);
      sways.push(0.04 + rand() * 0.06);

      stems.setMatrixAt(idx, dummy.matrix);
      foliage.setMatrixAt(idx, dummy.matrix);
      const slot = idx % flowerMats.length;
      flowerSlot.push(slot);
      flowerMeshes[slot].setMatrixAt(fCounters[slot], dummy.matrix);
      fCounters[slot]++;
      idx++;
    }
  }
  flowerMeshes.forEach((fm, k) => { fm.count = fCounters[k]; fm.instanceMatrix.needsUpdate = true; });
  stems.instanceMatrix.needsUpdate = true;
  foliage.instanceMatrix.needsUpdate = true;

  group.add(stems); group.add(foliage);
  flowerMeshes.forEach(fm => group.add(fm));

  // === WIND ===
  const tiltAxis = new THREE.Vector3(0, 0, 1);
  const tmp = new THREE.Object3D();
  const fCursor = new Array(flowerMats.length).fill(0);
  group.userData.update = function (time) {
    fCursor.fill(0);
    for (let i = 0; i < baseMatrices.length; i++) {
      tmp.matrix.copy(baseMatrices[i]);
      tmp.matrix.decompose(tmp.position, tmp.quaternion, tmp.scale);
      const wind = Math.sin(time * 1.7 + tmp.position.x * 0.3 + phases[i]) * sways[i];
      tmp.rotateOnAxis(tiltAxis, wind);
      tmp.updateMatrix();
      stems.setMatrixAt(i, tmp.matrix);
      foliage.setMatrixAt(i, tmp.matrix);
      const slot = flowerSlot[i];
      flowerMeshes[slot].setMatrixAt(fCursor[slot], tmp.matrix);
      fCursor[slot]++;
    }
    stems.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    flowerMeshes.forEach(fm => fm.instanceMatrix.needsUpdate = true);
  };

  const y = getTerrainHeight(cx, cz);
  group.position.set(cx, y, cz);
  group.rotation.y = rotationY;
  scene.add(group);
  return group;
}
