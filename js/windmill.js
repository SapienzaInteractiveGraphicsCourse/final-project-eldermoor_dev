import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { brickBaseColor, brickRoughness, brickNormal, roofTileMat } from './textures.js';

// ================== WINDMILL ==================
export function createWindmill(scene, cx, cz, rotationY = 0) {
  const group = new THREE.Group();

  // === MATERIALS ===
  // Tower stone
  const stoneColor = brickBaseColor.clone();
  const stoneRough = brickRoughness.clone();
  const stoneNorm  = brickNormal.clone();
  for (const tex of [stoneColor, stoneRough, stoneNorm]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 4);
    tex.needsUpdate = true;
  }
  stoneColor.colorSpace = THREE.SRGBColorSpace;

  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneColor,
    roughnessMap: stoneRough,
    normalMap: stoneNorm,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.9,
    metalness: 0.0,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a2b, roughness: 0.85, metalness: 0.0
  });
  const woodDarkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3320, roughness: 0.9, metalness: 0.0
  });
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xeae3d2, roughness: 0.8, metalness: 0.0,
    side: THREE.DoubleSide
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x2e2e2e, roughness: 0.4, metalness: 0.8
  });

  // === DIMENSIONS ===
  const baseR = 4.0;   // radius at the tower base
  const topR  = 2.6;   // radius at the top (tapered tower)
  const towerH = 14;   // tower height

  // === TOWER (truncated cone) ===
  const towerGeo = new THREE.CylinderGeometry(topR, baseR, towerH, 16);
  const tower = new THREE.Mesh(towerGeo, stoneMat);
  tower.position.y = towerH / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // === STONE BAND at mid-tower ===
  const bandGeo = new THREE.CylinderGeometry(topR + 1.0, baseR - 0.5, 0.6, 16);
  const band = new THREE.Mesh(bandGeo, woodDarkMat);
  band.position.y = towerH * 0.42;
  band.castShadow = true;
  group.add(band);

  // === GALLERY (wooden balcony around the tower) ===
  const galleryY = towerH * 0.62;
  const galleryR = topR + 1.2;
  const galleryGeo = new THREE.CylinderGeometry(galleryR, galleryR, 0.25, 16);
  const gallery = new THREE.Mesh(galleryGeo, woodMat);
  gallery.position.y = galleryY;
  gallery.castShadow = true;
  gallery.receiveShadow = true;
  group.add(gallery);

  // gallery railing (posts)
  const numPosts = 16;
  for (let i = 0; i < numPosts; i++) {
    const a = (i / numPosts) * Math.PI * 2;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.7, 0.12), woodDarkMat
    );
    post.position.set(
      Math.cos(a) * galleryR,
      galleryY + 0.45,
      Math.sin(a) * galleryR
    );
    post.castShadow = true;
    group.add(post);
  }
  // handrail (torus)
  const railGeo = new THREE.TorusGeometry(galleryR, 0.06, 6, 24);
  railGeo.rotateX(Math.PI / 2);
  const rail = new THREE.Mesh(railGeo, woodDarkMat);
  rail.position.y = galleryY + 0.8;
  group.add(rail);

  // === DOOR ===
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.6, 0.3), woodDarkMat
  );
  door.position.set(0, 1.3, baseR - 0.25);
  door.castShadow = true;
  group.add(door);

  // === SMALL WINDOWS ===
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, roughness: 0.3, metalness: 0.2
  });
  for (const wy of [5.5, 9.0]) {
    for (const ang of [Math.PI * 0.35, -Math.PI * 0.35, Math.PI]) {
      // radius interpolated at height wy
      const tH = wy / towerH;
      const rAt = baseR + (topR - baseR) * tH;
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.1, 0.2), winMat
      );
      win.position.set(
        Math.sin(ang) * (rAt - 0.05),
        wy,
        Math.cos(ang) * (rAt - 0.05)
      );
      win.rotation.y = ang;
      group.add(win);
    }
  }

  // === CONICAL ROOF ===
  const roofGeo = new THREE.ConeGeometry(topR + 0.8, 4.5, 16);
  const roof = new THREE.Mesh(roofGeo, roofTileMat);
  roof.position.y = towerH + 2.25;
  roof.castShadow = true;
  group.add(roof);

  // finial + sphere
  const finial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.12, 0.8, 8), ironMat
  );
  finial.position.y = towerH + 4.5;
  finial.castShadow = true;
  group.add(finial);

  // === HUB + SAILS (rotating group) ===
  // The sails turn in the XY plane (front face = +Z)
  const blades = new THREE.Group();
  const hubY = towerH + 1.0;            // hub height
  const hubZ = topR + 1.4;              // overhang in front of the tower
  blades.position.set(0, hubY, hubZ);

  // hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.8, 12), ironMat
  );
  hub.rotation.x = Math.PI / 2;         // hub axis along Z
  hub.castShadow = true;
  blades.add(hub);

  // 4 cross sails
  const NUM_BLADES = 4;
  const bladeLen = 9.0;
  const armW = 0.18;
  for (let i = 0; i < NUM_BLADES; i++) {
    const a = (i / NUM_BLADES) * Math.PI * 2;

    const arm = new THREE.Group();
    arm.rotation.z = a;
    blades.add(arm);

    // wooden sail spar
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(armW, bladeLen, armW), woodMat
    );
    beam.position.y = bladeLen / 2;
    beam.castShadow = true;
    arm.add(beam);

    // sail frame + canvas (on one side of the spar)
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, bladeLen * 0.82), sailMat
    );
    sail.position.set(0.85, bladeLen * 0.52, 0);
    sail.castShadow = true;
    arm.add(sail);

    // sail frame slats
    const numSlats = 5;
    for (let s = 1; s < numSlats; s++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.05, 0.05), woodDarkMat
      );
      slat.position.set(0.85, (bladeLen * 0.82) * (s / numSlats) + bladeLen * 0.11, 0.02);
      arm.add(slat);
    }
  }

  group.add(blades);

  // === PLACEMENT ===
  const y = getTerrainHeight(cx, cz);
  group.position.set(cx, y, cz);
  group.rotation.y = rotationY;
  group.userData.blades = blades;
  scene.add(group);

  return group;
}
