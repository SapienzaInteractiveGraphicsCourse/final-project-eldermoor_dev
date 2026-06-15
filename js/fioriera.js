import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';

// ================== WOOD TEXTURE ==================
// The texture is an atlas: light wood on top, dark wood below, then stones and
// a gray strip
const textureLoader = new THREE.TextureLoader();
const TEX_WOOD = './Medieval Village MegaKit[Source]/Textures/T_WoodTrim_BaseColor_Mat_D.png';

// crops a variant of the wood texture to a vertical band
function woodTex(offsetY, repeatY, repeatX) {
  const t = textureLoader.load(TEX_WOOD);
  t.wrapS = THREE.RepeatWrapping;   // horizontal tiling (grain)
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.offset.set(0, offsetY);
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ================== WOODEN FLOWER PLANTER ==================
// createFioriera(scene, cx, cz, rotationY)
// Returns the Group (with userData.flowers for the sway animations)

export function createFioriera(scene, cx, cz, rotationY = 0) {
  const group = new THREE.Group();

  // === WOOD MATERIALS ===
  // light wood for the walls, dark wood for edges/posts
  const woodLightMat = new THREE.MeshStandardMaterial({
    map: woodTex(0.70, 0.28, 2.0),
    roughness: 0.8, metalness: 0.0,
  });
  const woodDarkMat = new THREE.MeshStandardMaterial({
    map: woodTex(0.40, 0.25, 1.0),
    roughness: 0.85, metalness: 0.0,
  });

  // === SOIL / VEGETATION MATERIALS ===
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x3a2718, roughness: 1.0, metalness: 0.0
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3d6e2c, roughness: 0.85, metalness: 0.0, flatShading: true
  });
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x35591f, roughness: 0.9, metalness: 0.0
  });

  // flower palette (petal color, center color)
  const flowerPalettes = [
    { petal: 0xd23b3b, center: 0xf2c200 }, // red/yellow
    { petal: 0xe8c23a, center: 0x8a5a1a }, // yellow/brown
    { petal: 0xf2f2f2, center: 0xf2c200 }, // white/yellow
    { petal: 0x9b59b6, center: 0xf2e34a }, // purple/yellow
    { petal: 0xe67e22, center: 0x7a3d12 }, // orange/brown
    { petal: 0xe05a8a, center: 0xfff0c0 }, // pink/cream
    { petal: 0x5d8bd6, center: 0xf2e34a }, // light blue/yellow
  ];

  // === DIMENSIONS ===
  const L = 4.0;     // length
  const W = 1.7;     // depth
  const H = 1.2;     // wall height
  const T = 0.28;    // wall thickness

  // === BOTTOM ===
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(L, T, W), woodDarkMat);
  bottom.position.set(0, T / 2, 0);
  bottom.castShadow = true; bottom.receiveShadow = true;
  group.add(bottom);

  // === 4 WALLS (box) ===
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(L, H, T), woodLightMat);
    wall.position.set(0, H / 2, side * (W / 2 - T / 2));
    wall.castShadow = true; wall.receiveShadow = true;
    group.add(wall);
  }
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(T, H, W - 2 * T), woodLightMat);
    wall.position.set(side * (L / 2 - T / 2), H / 2, 0);
    wall.castShadow = true; wall.receiveShadow = true;
    group.add(wall);
  }

  // === VERTICAL BATTENS on the long walls ===
  const battenW = 0.12, battenD = 0.06;
  const numBattens = 7;
  for (const side of [-1, 1]) {
    for (let i = 1; i < numBattens; i++) {
      const bx = -L / 2 + (L / numBattens) * i;
      const batten = new THREE.Mesh(
        new THREE.BoxGeometry(battenW, H - 0.1, battenD), woodDarkMat
      );
      batten.position.set(bx, H / 2, side * (W / 2 + battenD / 2 - 0.01));
      batten.castShadow = true;
      group.add(batten);
    }
  }

  // === TOP RIM (frame) ===
  const rimH = 0.16, rimOver = 0.12;
  for (const side of [-1, 1]) {
    const rimLong = new THREE.Mesh(
      new THREE.BoxGeometry(L + rimOver * 2, rimH, T + rimOver), woodDarkMat
    );
    rimLong.position.set(0, H + rimH / 2, side * (W / 2 - T / 2));
    rimLong.castShadow = true; rimLong.receiveShadow = true;
    group.add(rimLong);
  }
  for (const side of [-1, 1]) {
    const rimShort = new THREE.Mesh(
      new THREE.BoxGeometry(T + rimOver, rimH, W + rimOver * 2), woodDarkMat
    );
    rimShort.position.set(side * (L / 2 - T / 2), H + rimH / 2, 0);
    rimShort.castShadow = true; rimShort.receiveShadow = true;
    group.add(rimShort);
  }

  // === CORNER POSTS with pyramid caps ===
  const postH = H + 0.45;
  const postS = T + 0.18;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * (L / 2 - postS / 2);
      const pz = sz * (W / 2 - postS / 2);

      const post = new THREE.Mesh(new THREE.BoxGeometry(postS, postH, postS), woodDarkMat);
      post.position.set(px, postH / 2, pz);
      post.castShadow = true; post.receiveShadow = true;
      group.add(post);

      // pyramid cap (4-sided cone)
      const capGeo = new THREE.ConeGeometry(postS * 0.78, 0.28, 4);
      capGeo.rotateY(Math.PI / 4);
      const cap = new THREE.Mesh(capGeo, woodLightMat);
      cap.position.set(px, postH + 0.14, pz);
      cap.castShadow = true;
      group.add(cap);
    }
  }

  // === SOIL ===
  const soilTopY = H - 0.18;
  const soilH = soilTopY - T;
  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(L - 2 * T, soilH, W - 2 * T), soilMat
  );
  soil.position.set(0, T + soilH / 2, 0);
  soil.receiveShadow = true;
  group.add(soil);

  // === VEGETATION ===
  const flowers = [];
  const innerX = L / 2 - T - 0.3;
  const innerZ = W / 2 - T - 0.22;

  // low-poly leaf clumps (squashed icosahedrons)
  for (let i = 0; i < 6; i++) {
    const bx = rand(-innerX, innerX);
    const bz = rand(-innerZ, innerZ);
    const clump = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(0.22, 0.34), 0), leafMat
    );
    clump.scale.y = 0.5;
    clump.rotation.y = rand(0, Math.PI);
    clump.position.set(bx, soilTopY + 0.08, bz);
    clump.castShadow = true;
    group.add(clump);
  }

  // multi-petal flowers
  for (let i = 0; i < 8; i++) {
    const fx = rand(-innerX, innerX);
    const fz = rand(-innerZ, innerZ);
    const palette = flowerPalettes[Math.floor(Math.random() * flowerPalettes.length)];
    const tulip = Math.random() < 0.4;

    const flower = buildFlower(palette, stemMat, leafMat, tulip);
    flower.position.set(fx, soilTopY, fz);
    flower.rotation.z = rand(-0.1, 0.1);
    flower.rotation.x = rand(-0.1, 0.1);

    group.add(flower);
    flowers.push({ mesh: flower, baseRotX: flower.rotation.x, phase: rand(0, Math.PI * 2) });
  }

  // === PLACEMENT ===
  const y = getTerrainHeight(cx, cz);
  group.position.set(cx, y, cz);
  group.rotation.y = rotationY;
  group.userData.flowers = flowers;
  scene.add(group);

  return group;
}

// FLOWER BUILD 
// Returns a Group with its origin at the base of the stem
function buildFlower(palette, stemMat, leafMat, tulip) {
  const flower = new THREE.Group();

  const petalMat = new THREE.MeshStandardMaterial({
    color: palette.petal, roughness: 0.65, metalness: 0.0,
    side: THREE.DoubleSide, flatShading: false
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: palette.center, roughness: 0.6, metalness: 0.0
  });

  const stemH = rand(0.55, 0.95);

  // stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.04, stemH, 6), stemMat
  );
  stem.position.y = stemH / 2;
  stem.castShadow = true;
  flower.add(stem);

  // 1-2 leaves along the stem
  const numLeaves = Math.random() < 0.6 ? 2 : 1;
  for (let l = 0; l < numLeaves; l++) {
    const leafGeo = new THREE.SphereGeometry(0.5, 8, 6);
    leafGeo.scale(0.10, 0.02, 0.22);
    leafGeo.translate(0, 0, 0.16);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const la = (l / numLeaves) * Math.PI * 2 + rand(0, 1);
    const pivot = new THREE.Group();
    leaf.rotation.x = 0.5; // leaf tilted slightly upward
    pivot.add(leaf);
    pivot.position.y = stemH * rand(0.3, 0.55);
    pivot.rotation.y = la;
    flower.add(pivot);
  }

  // flower head
  const head = new THREE.Group();
  head.position.y = stemH;

  // center
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), centerMat);
  center.scale.y = 0.6;
  center.castShadow = true;
  head.add(center);

  // petals
  const petalCount = tulip ? 5 : (Math.random() < 0.5 ? 6 : 8);
  const petalLen = tulip ? rand(0.26, 0.32) : rand(0.20, 0.26);
  const petalWide = tulip ? 0.09 : 0.11;
  const tilt = tulip ? 0.35 : rand(0.7, 0.95); // tulip more closed, daisy more open

  for (let p = 0; p < petalCount; p++) {
    const angle = (p / petalCount) * Math.PI * 2;

    // petal = thin elongated ellipsoid
    const petalGeo = new THREE.SphereGeometry(0.5, 8, 6);
    petalGeo.scale(petalWide, 0.03, petalLen);
    petalGeo.translate(0, 0, petalLen * 0.55); // base toward the center
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.castShadow = true;
    petal.rotation.x = -tilt; // raise the petal tip

    const pivot = new THREE.Group();
    pivot.add(petal);
    pivot.rotation.y = angle;
    head.add(pivot);
  }

  // second, rotated petal layer (fuller) for daisies
  if (!tulip) {
    for (let p = 0; p < petalCount; p++) {
      const angle = (p / petalCount) * Math.PI * 2 + Math.PI / petalCount;
      const petalGeo = new THREE.SphereGeometry(0.5, 8, 6);
      petalGeo.scale(petalWide * 0.85, 0.03, petalLen * 0.8);
      petalGeo.translate(0, 0, petalLen * 0.45);
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.castShadow = true;
      petal.rotation.x = -tilt * 1.15;

      const pivot = new THREE.Group();
      pivot.add(petal);
      pivot.rotation.y = angle;
      head.add(pivot);
    }
  }

  flower.add(head);
  return flower;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
