import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { brickBaseColor, brickRoughness, brickNormal, roofTileMat } from './textures.js';

// ================== STONE WELL ==================

export function createWell(scene, cx, cz, rotationY = 0) {
  const group = new THREE.Group();

  // === MATERIALS ===
  const stoneColor = brickBaseColor.clone();
  const stoneRough = brickRoughness.clone();
  const stoneNorm  = brickNormal.clone();
  for (const tex of [stoneColor, stoneRough, stoneNorm]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.needsUpdate = true;
  }
  stoneColor.colorSpace = THREE.SRGBColorSpace;

  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneColor, roughnessMap: stoneRough, normalMap: stoneNorm,
    normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.9, metalness: 0.0,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a2b, roughness: 0.85, metalness: 0.0
  });
  const woodDarkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3320, roughness: 0.9, metalness: 0.0
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2e2e2e, roughness: 0.4, metalness: 0.8
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2d5a70, roughness: 0.15, metalness: 0.3,
    transparent: true, opacity: 0.85,
  });

  // === CIRCULAR WALL ===
  const wellR = 1.6, wallH = 1.1, wallT = 0.3;
  const wallGeo = new THREE.CylinderGeometry(wellR, wellR, wallH, 20, 1, true);
  const wall = new THREE.Mesh(wallGeo, stoneMat);
  wall.position.y = wallH / 2;
  wall.castShadow = true; wall.receiveShadow = true;
  group.add(wall);
  // inner wall
  const innerGeo = new THREE.CylinderGeometry(wellR - wallT, wellR - wallT, wallH, 20, 1, true);
  const innerMat = stoneMat.clone();
  innerMat.side = THREE.BackSide;
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.y = wallH / 2;
  group.add(inner);

  // top rim (stone ring)
  const rimGeo = new THREE.TorusGeometry(wellR, wallT / 2, 8, 24);
  rimGeo.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, stoneMat);
  rim.position.y = wallH;
  rim.castShadow = true;
  group.add(rim);

  // water at the bottom (down inside the well)
  const waterGeo = new THREE.CircleGeometry(wellR - wallT, 20);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0.25;
  group.add(water);

  // === POSTS + ROOF ===
  const postH = 2.2;
  const postX = wellR + 0.1;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, postH, 0.18), woodMat
    );
    post.position.set(sx * postX, wallH + postH / 2, 0);
    post.castShadow = true;
    group.add(post);
  }

  // gable roof (two sloped planes)
  const roofY = wallH + postH;
  const roofW = (postX + 0.4) * 2;
  const roofLen = 2.4;
  const roofThick = 0.12;
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(
      new THREE.BoxGeometry(roofW / 1.7, roofThick, roofLen), roofTileMat
    );
    slope.position.set(side * roofW * 0.18, roofY + 0.5, 0);
    slope.rotation.z = side * -0.7;
    slope.castShadow = true; slope.receiveShadow = true;
    group.add(slope);
  }
  // ridge
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, roofLen + 0.1), woodDarkMat
  );
  ridge.position.set(0, roofY + 0.95, 0);
  ridge.castShadow = true;
  group.add(ridge);

  // === WINCH (roller + crank) ===
  const rollerY = wallH + 1.0;
  const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, postX * 2 - 0.1, 10);
  rollerGeo.rotateZ(Math.PI / 2);
  const roller = new THREE.Mesh(rollerGeo, woodDarkMat);
  roller.position.set(0, rollerY, 0);
  roller.castShadow = true;
  group.add(roller);

  // side crank
  const crank = new THREE.Group();
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.4, 0.06), ironMat
  );
  crankArm.position.set(0, -0.2, 0);
  crank.add(crankArm);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), woodMat
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.15, -0.4, 0);
  crank.add(handle);
  crank.position.set(postX, rollerY, 0);
  group.add(crank);

  // === ROPE + BUCKET (swinging group) ===
  const swing = new THREE.Group();
  swing.position.set(0, rollerY, 0);

  const ropeLen = 1.3;
  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, ropeLen, 5), woodDarkMat
  );
  rope.position.y = -ropeLen / 2;
  swing.add(rope);

  const bucket = new THREE.Group();
  const pail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.18, 0.35, 12), woodMat
  );
  pail.castShadow = true;
  bucket.add(pail);
  // iron bands on the bucket
  for (const by of [0.13, -0.13]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.02, 6, 16), ironMat
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = by;
    bucket.add(band);
  }
  // handle
  const handleBucket = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.015, 6, 12, Math.PI), ironMat
  );
  handleBucket.position.y = 0.18;
  bucket.add(handleBucket);
  bucket.position.y = -ropeLen - 0.18;
  swing.add(bucket);

  group.add(swing);

  // === ANIMATION: the bucket sways gently ===
  group.userData.update = function (time) {
    swing.rotation.x = Math.sin(time * 1.2) * 0.12;
    swing.rotation.z = Math.cos(time * 0.9) * 0.06;
  };

  // === PLACEMENT ===
  const y = getTerrainHeight(cx, cz);
  group.position.set(cx, y, cz);
  group.rotation.y = rotationY;
  scene.add(group);

  return group;
}
