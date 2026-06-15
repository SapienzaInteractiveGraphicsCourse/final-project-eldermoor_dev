import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { getSoilTextures } from './soilTextures.js';

// ================== LAVENDER FIELD ==================
// createLavenderField(scene, cx, cz, width, depth, rotationY)
//   cx, cz    = field center
//   width     = width (local X axis)
//   depth     = depth (local Z axis)
//   rotationY = field orientation
//
// Lavender is grown in ROWS: clumps aligned along Z, with soil corridors
// between rows. Each clump is made of green stems with a purple flower spike on
// top. Animate with field.userData.update(time)


export function createLavenderField(scene, cx, cz, width = 40, depth = 40, rotationY = 0) {
  const group = new THREE.Group();

  // === deterministic PRNG ===
  let seed = 98765;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  // === SOIL (earth with texture) ===
  const repU = width / 8, repV = depth / 8;
  const { diff: soilDiff, norm: soilNorm, rough: soilRough } = getSoilTextures(repU, repV);

  const soilMat = new THREE.MeshStandardMaterial({
    map: soilDiff,
    normalMap: soilNorm,
    roughnessMap: soilRough,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 1.0,
    metalness: 0.0,
    color: 0xa8906f,
  });

  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.3, depth), soilMat
  );
  soil.position.y = 0.15;
  soil.receiveShadow = true;
  group.add(soil);

  // === LAVENDER MATERIALS ===
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x6f7d4a, roughness: 0.9, metalness: 0.0   // sage gray-green
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x7c8a5a, roughness: 0.95, metalness: 0.0, flatShading: true
  });
  // purple/lilac palette for the flower spikes
  const flowerPalette = [
    0x7b5cc4, 0x8e6fd6, 0x6a4bb0, 0x9d7be0, 0x5f3fa6,
  ];
  const flowerMats = flowerPalette.map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.0, flatShading: true })
  );

  // === GEOMETRY OF A FLOWERING STEM ===
  // thin green stem + flower spike (stacked purple beads) on top
  function buildStemGeometry() {
    const stemH = 0.85;
    const stem = new THREE.CylinderGeometry(0.012, 0.02, stemH, 4);
    stem.translate(0, stemH / 2, 0);
    return stem;
  }
  function buildSpikeGeometry() {
    // spike = stack of small ellipsoids, shrinking toward the tip
    const parts = [];
    const base = 0.85;
    const spikeLen = 0.45;
    const beads = 7;
    for (let b = 0; b < beads; b++) {
      const tb = b / (beads - 1);
      const by = base + tb * spikeLen;
      const r = 0.055 * (1 - tb * 0.6);
      const bead = new THREE.SphereGeometry(r, 5, 4);
      bead.scale(1.0, 1.3, 1.0);
      bead.translate(0, by, 0);
      parts.push(bead);
    }
    return mergeGeometries(parts);
  }

  const stemGeo  = buildStemGeometry();
  const spikeGeo = buildSpikeGeometry();

  // === ROW LAYOUT ===
  const rowSpacing = 1.6;                       // distance between rows (corridor)
  const numRows = Math.max(1, Math.floor((width - 2) / rowSpacing));
  const rowStartX = -((numRows - 1) * rowSpacing) / 2;
  const stemsPerBush = 9;                        // stems per clump
  const bushSpacingZ = 1.1;                      // distance between clumps along the row
  const numBushZ = Math.max(1, Math.floor((depth - 2) / bushSpacingZ));
  const bushStartZ = -((numBushZ - 1) * bushSpacingZ) / 2;

  const totalStems = numRows * numBushZ * stemsPerBush;

  // foliage layer (low domes) for each clump
  const numBushes = numRows * numBushZ;
  const foliageGeo = new THREE.SphereGeometry(0.45, 6, 4);
  foliageGeo.scale(1.0, 0.5, 0.7);
  const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, numBushes);
  foliage.receiveShadow = true;
  foliage.castShadow = true;

  const stems  = new THREE.InstancedMesh(stemGeo, stemMat, totalStems);
  const spikeMeshes = flowerMats.map(m =>
    new THREE.InstancedMesh(spikeGeo, m, Math.ceil(totalStems / flowerMats.length) + 1)
  );
  const spikeCounters = new Array(flowerMats.length).fill(0);

  stems.castShadow = true;
  spikeMeshes.forEach(sm => { sm.castShadow = true; });

  // sway data
  const baseMatrices = [];
  const phases = [];
  const sways  = [];
  const spikeSlot = [];

  const dummy = new THREE.Object3D();
  let stemIndex = 0;
  let bushIndex = 0;

  for (let rx = 0; rx < numRows; rx++) {
    const bx = rowStartX + rx * rowSpacing + (rand() - 0.5) * 0.15;
    for (let rz = 0; rz < numBushZ; rz++) {
      const bz = bushStartZ + rz * bushSpacingZ + (rand() - 0.5) * 0.2;

      // clump's foliage dome
      dummy.position.set(bx, 0.32, bz);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      const fs = 0.9 + rand() * 0.4;
      dummy.scale.set(fs, fs, fs);
      dummy.updateMatrix();
      foliage.setMatrixAt(bushIndex, dummy.matrix);
      bushIndex++;

      // clump stems
      for (let s = 0; s < stemsPerBush; s++) {
        const ox = (rand() - 0.5) * 0.7;
        const oz = (rand() - 0.5) * 0.5;
        const sc = 0.8 + rand() * 0.5;
        const lean = (rand() - 0.5) * 0.25;
        const leanDir = rand() * Math.PI * 2;

        dummy.position.set(bx + ox, 0.3, bz + oz);
        dummy.rotation.set(0, leanDir, 0);
        dummy.scale.set(sc, sc + rand() * 0.3, sc);
        dummy.updateMatrix();
        // apply an extra lean by rotating around Z after the yaw
        const lm = new THREE.Matrix4().makeRotationZ(lean);
        dummy.matrix.multiply(lm);

        baseMatrices.push(dummy.matrix.clone());
        phases.push(rand() * Math.PI * 2);
        sways.push(0.06 + rand() * 0.08);

        stems.setMatrixAt(stemIndex, dummy.matrix);

        const slot = stemIndex % flowerMats.length;
        spikeSlot.push(slot);
        spikeMeshes[slot].setMatrixAt(spikeCounters[slot], dummy.matrix);
        spikeCounters[slot]++;

        stemIndex++;
      }
    }
  }

  spikeMeshes.forEach((sm, k) => { sm.count = spikeCounters[k]; });

  foliage.instanceMatrix.needsUpdate = true;
  stems.instanceMatrix.needsUpdate = true;
  spikeMeshes.forEach(sm => sm.instanceMatrix.needsUpdate = true);

  group.add(foliage);
  group.add(stems);
  spikeMeshes.forEach(sm => group.add(sm));

  // === WIND ANIMATION ===
  const tiltAxis = new THREE.Vector3(0, 0, 1); // Axis the stems bend around (Z)
  const tmp = new THREE.Object3D();// Reusable temp object to avoid per-frame allocations
  const spikeCursor = new Array(flowerMats.length).fill(0); // Per-slot write index for spike instances

  group.userData.update = function (time) {
    spikeCursor.fill(0); // Reset write cursors at the start of each frame
    for (let i = 0; i < baseMatrices.length; i++) {
      // Start from the flower's rest pose and split it into position/rotation/scale
      tmp.matrix.copy(baseMatrices[i]);
      tmp.matrix.decompose(tmp.position, tmp.quaternion, tmp.scale);
      // Slow gust wave travelling across the field (oscillates 0.2–1.0), driven by Z position
      const gust = 0.6 + 0.4 * Math.sin(time * 0.45 + tmp.position.z * 0.12);
      // Faster sway, de-synced per flower via X position and a random phase,
      // scaled by each flower's amplitude (sways[i]) and the current gust strength
      const wind = Math.sin(time * 1.7 + tmp.position.x * 0.3 + phases[i]) * sways[i] * gust;
      tmp.rotateOnAxis(tiltAxis, wind); // Tilt the flower around the Z axis and rebuild its matrix
      tmp.updateMatrix();

      stems.setMatrixAt(i, tmp.matrix); // Write the animated matrix to the stem instance and to the matching spike mesh, advancing that slot's cursor
      const slot = spikeSlot[i];
      spikeMeshes[slot].setMatrixAt(spikeCursor[slot], tmp.matrix);
      spikeCursor[slot]++;
    }
    stems.instanceMatrix.needsUpdate = true;
    spikeMeshes.forEach(sm => { sm.instanceMatrix.needsUpdate = true; });
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
