import * as THREE from 'three';

// ================== INSTANCING HELPER ==================
// Turns a set of "prefabs" (Groups containing one or more Meshes) plus a list
// of placements (position + scale + Y rotation) into a few THREE.InstancedMesh,
// one per sub-mesh of each prefab
//
// Why: placing hundreds/thousands of trees/grass as cloned Groups added one by
// one generates that many draw calls. With instancing each sub-mesh becomes a
// SINGLE draw call for all its copies
//
// A prefab may contain several meshes (e.g. trunk + canopy with different
// materials): each sub-mesh gets its own InstancedMesh and all instances of
// the same prefab share the same matrix index

// Flattens a prefab into its list of meshes: for each, stores geometry,
// material and the local matrix (relative to the prefab root), including the
// normalization scale/rotation/offset
function flattenPrefab(prefab) {
  const out = [];
  prefab.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(prefab.matrixWorld).invert();
  prefab.traverse((obj) => {
    if (!obj.isMesh) return;
    // mesh matrix relative to the prefab root
    const local = new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
    out.push({
      geometry: obj.geometry,
      material: obj.material,
      localMatrix: local,
      castShadow: obj.castShadow,
      receiveShadow: obj.receiveShadow,
    });
  });
  return out;
}

// placements: array of { prefabIndex, position:{x,y,z}, scale:number, rotationY:number }
// prefabs: array of Groups
export function buildInstancedFromPrefabs(prefabs, placements) {
  const group = new THREE.Group();
  if (!prefabs || prefabs.length === 0 || placements.length === 0) return group;

  // Flatten each prefab once
  const flats = prefabs.map(flattenPrefab);

  // Count how many instances per prefab
  const counts = new Array(prefabs.length).fill(0);
  for (const p of placements) counts[p.prefabIndex]++;

  // For each prefab, create one InstancedMesh per sub-mesh
  // imeshes[prefabIndex] = array of InstancedMesh (one per sub-mesh)
  const imeshes = prefabs.map((_, pi) => {
    if (counts[pi] === 0) return [];
    return flats[pi].map((f) => {
      const im = new THREE.InstancedMesh(f.geometry, f.material, counts[pi]);
      im.castShadow = f.castShadow;
      im.receiveShadow = f.receiveShadow;
      im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      im._localMatrix = f.localMatrix;   // sub-mesh local matrix
      im._cursor = 0;                    // next slot to fill
      group.add(im);
      return im;
    });
  });

  const m = new THREE.Matrix4();
  const t = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tmp = new THREE.Matrix4();

  for (const pl of placements) {
    e.set(0, pl.rotationY, 0);
    q.setFromEuler(e);
    s.setScalar(pl.scale);
    pos.set(pl.position.x, pl.position.y, pl.position.z);
    // world transform of the instance (as the cloned Group would have had)
    t.compose(pos, q, s);

    const list = imeshes[pl.prefabIndex];
    for (let k = 0; k < list.length; k++) {
      const im = list[k];
      // final matrix = instance_world * submesh_local_matrix
      m.multiplyMatrices(t, im._localMatrix);
      im.setMatrixAt(im._cursor, m);
      im._cursor++;
    }
  }

  for (const list of imeshes) {
    for (const im of list) {
      im.count = im._cursor;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }

  return group;
}
