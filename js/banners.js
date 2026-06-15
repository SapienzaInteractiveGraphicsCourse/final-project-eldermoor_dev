import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';

// ================== BANNERS ==================
// Two tall banners: a wooden pole with a gold knob and a purple drape with gold
// decoration that waves in the wind 
// Placed in the area south toward the gate, one on each side of the road
// The gold decorations are drawn on a canvas: no external textures

// drape: purple texture with gold motifs
function makeBannerTexture() {
  const w = 256, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');

  // purple background with a slight vertical gradient
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#5b2a86');
  g.addColorStop(0.5, '#46206b');
  g.addColorStop(1, '#36184f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const gold = '#d9b44a';
  const goldLight = '#f0d77a';

  // gold border
  ctx.strokeStyle = gold;
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.lineWidth = 3;
  ctx.strokeStyle = goldLight;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // central emblem: a stylized gold star/lily
  ctx.save();
  ctx.translate(w / 2, h * 0.32);
  ctx.fillStyle = gold;
  ctx.strokeStyle = goldLight;
  ctx.lineWidth = 2;
  // 8-pointed star
  const R = 60, r = 26, spikes = 8;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = (i % 2 === 0) ? R : r;
    const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // central circle
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#46206b';
  ctx.fill();
  ctx.strokeStyle = goldLight;
  ctx.stroke();
  ctx.restore();

  // decorative motif in the lower half: gold diamonds
  ctx.fillStyle = gold;
  for (let row = 0; row < 4; row++) {
    const cy = h * 0.58 + row * 46;
    for (let col = 0; col < 3; col++) {
      const cx = w / 2 + (col - 1) * 56;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
    }
  }

  // bottom V cut of the drape: left to the geometry, not the texture
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.0;
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Builds a single banner at (x,z). Returns { group, drappo, wpos, base }.
function makeOneBanner(x, z, bannerTex) {
  const g = new THREE.Group();

  const POLE_H = 14;       // pole height 
  const FLAG_W = 2.8;      // drape width
  const FLAG_H = 7.0;      // drape height
  const FLAG_TOP = POLE_H - 0.8;

  // pole 
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8, metalness: 0.05 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, POLE_H, 10), poleMat);
  pole.position.y = POLE_H / 2;
  pole.castShadow = true;
  g.add(pole);

  // gold knob on top 
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 0.3, metalness: 0.9 });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), goldMat);
  knob.position.y = POLE_H + 0.15;
  knob.castShadow = true;
  g.add(knob);

  // horizontal arm the drape hangs from 
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, FLAG_W + 0.3, 8), goldMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(FLAG_W / 2, FLAG_TOP + 0.1, 0);
  g.add(arm);

  // drape
  const SEGX = 12, SEGY = 20;
  const flagGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, SEGX, SEGY);

  flagGeo.translate(FLAG_W / 2, -FLAG_H / 2, 0);
  const flagMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
    emissive: 0x2a1240,
    emissiveIntensity: 0.15,
  });
  const drappo = new THREE.Mesh(flagGeo, flagMat);
  drappo.position.set(0, FLAG_TOP, 0);
  drappo.castShadow = true;
  g.add(drappo);

  // base vertex positions of the drape for the animation
  const wpos = flagGeo.attributes.position;
  const baseX = new Float32Array(wpos.count);
  const baseY = new Float32Array(wpos.count);
  for (let i = 0; i < wpos.count; i++) {
    baseX[i] = wpos.getX(i);
    baseY[i] = wpos.getY(i);
  }

  const y = getTerrainHeight(x, z);
  g.position.set(x, y, z);

  return { group: g, drappo, wpos, baseX, baseY, flagGeo, FLAG_W };
}

export function createBanners(scene, options = {}) {
  // Two pairs of banners in the area south toward the gate, on each side of the
  // south road (x=0). The drapes face SOUTH (+z) so someone looking from the
  // gate sees the design. Each pair is mirrored about the x=0 axis
  const {
    // pair 1 innermost and pair 2 closest to the gate
    pair1 = { left: { x: -14, z: 84 }, right: { x: 14, z: 84 } },
    pair2 = { left: { x: -12, z: 100 }, right: { x: 12, z: 100 } },
  } = options;

  const bannerTex = makeBannerTexture();
  const root = new THREE.Group();
  const banners = [];

  // creates a mirrored pair at a given z. The drapes face +z 
  const addPair = (pair) => {
    const L = makeOneBanner(pair.left.x,  pair.left.z,  bannerTex);
    const R = makeOneBanner(pair.right.x, pair.right.z, bannerTex);
    // Drape face toward SOUTH (+z): rotation 0 leaves the normal toward +z.
    // Mirror about x=0: flip the right one with scale.x = -1, so the pole and
    // the free edge end up mirrored relative to the left one
    L.group.rotation.y = 0;
    R.group.rotation.y = 0;
    R.group.scale.x = -1;
    root.add(L.group, R.group);
    banners.push(L, R);
  };

  addPair(pair1);
  addPair(pair2);
  scene.add(root);

  // wind animation: a wave that grows toward the drape's free edge
  root.userData.update = function (time) {
    for (const b of banners) {
      const { wpos, baseX, baseY, FLAG_W, flagGeo } = b;
      for (let i = 0; i < wpos.count; i++) {
        const bx = baseX[i], by = baseY[i];
        const free = bx / FLAG_W;   // 0 at the pole -> 1 at the free edge
        const wave = Math.sin(time * 3.0 - bx * 2.2 + by * 0.6) * 0.45
                   + Math.sin(time * 5.0 - bx * 3.5) * 0.18;
        const z = wave * free;
        const sag = Math.sin(time * 2.0 + bx * 1.5) * 0.12 * free;
        wpos.setXYZ(i, bx, by + sag, z);
      }
      wpos.needsUpdate = true;
      flagGeo.computeVertexNormals();
    }
  };

  return root;
}
