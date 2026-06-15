import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';

// ================== MARKET STALLS ==================
// Procedural stall: wooden counter, striped awning on 4 poles, goods
// No external models

let _seed = 73313;
const rand = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

// shared materials
const woodMat   = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
const woodDark  = new THREE.MeshStandardMaterial({ color: 0x4f3720, roughness: 0.9 });
const metalMat  = new THREE.MeshStandardMaterial({ color: 0xc0c4c8, roughness: 0.35, metalness: 0.85 });
const metalDark = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.5, metalness: 0.7 });
const goldMat   = new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 0.4, metalness: 0.8 });
const leatherMat= new THREE.MeshStandardMaterial({ color: 0x6e4326, roughness: 0.8 });

// striped awning 
function makeAwningTexture(c1, c2) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
  const ctx = cv.getContext('2d');
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = (i % 2 === 0) ? c1 : c2;
    ctx.fillRect((i / stripes) * 64, 0, 64 / stripes, 32);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a vertical, standing sword (blade + hilt)
function makeSword() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.012), metalMat);
  blade.position.y = 0.45;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), goldMat);
  guard.position.y = 0.0;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), leatherMat);
  grip.position.y = -0.11;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), goldMat);
  pommel.position.y = -0.2;
  g.add(blade, guard, grip, pommel);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// an all-SILVER sword 
function makeSwordSilver() {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xd5d9dd, roughness: 0.25, metalness: 0.9 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.014), silver);
  blade.position.y = 0.48;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), silver);
  guard.position.y = 0.0;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 6), leatherMat);
  grip.position.y = -0.12;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), silver);
  pommel.position.y = -0.22;
  g.add(blade, guard, grip, pommel);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// a spear 
function makeSpear() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.6, 6), woodMat);
  shaft.position.y = 0.8;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), metalMat);
  tip.position.y = 1.7;
  g.add(shaft, tip);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

//  a round or teardrop shield
function makeShield(color, silver = false) {
  const g = new THREE.Group();
  const silverMat = new THREE.MeshStandardMaterial({ color: 0xd5d9dd, roughness: 0.25, metalness: 0.9 });
  const rimMat   = silver ? silverMat : metalDark;
  const bossMat  = silver ? silverMat : metalMat;
  const crossMat = silver ? silverMat : goldMat;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16),
    new THREE.MeshStandardMaterial({ color, roughness: silver ? 0.35 : 0.6, metalness: silver ? 0.7 : 0.0 }));
  body.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 8, 20), rimMat);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bossMat);
  boss.position.z = 0.05;
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), crossMat);
  const barH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.02), crossMat);
  barV.position.z = barH.position.z = 0.035;
  g.add(body, rim, boss, barV, barH);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

//a hanging garment/drape (colored plane) 
function makeGarment(color) {
  const geo = new THREE.PlaneGeometry(0.5, 0.9, 1, 6);
  geo.translate(0, -0.45, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return { mesh: m, geo };
}

//  food goods on the counter (bread / fish / vegetables) 
function addFoodGoods(stall, type, W, D, topY, rand) {
  // wooden crates as containers
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.9 });
  const makeCrate = (w, d) => {
    const c = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), crateMat);
    c.add(floor);
    for (const sz of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.05), crateMat);
      s.position.set(0, 0.09, sz * (d/2 - 0.025)); c.add(s);
    }
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, d), crateMat);
      s.position.set(sx * (w/2 - 0.025), 0.09, 0); c.add(s);
    }
    c.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return c;
  };

  const placeCrate = (ox, w, d) => {
    const c = makeCrate(w, d);
    c.position.set(ox, topY + 0.025, 0);
    stall.add(c);
    return c;
  };

  if (type === 'bread') {
    // loaves (golden ellipsoids) in 3 crates
    const breadMats = [0xc8923f, 0xd8a456, 0xb87a2e].map(c =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    for (let k = 0; k < 3; k++) {
      const ox = -W/2 + 1.2 + k * (W - 2.4) / 2;
      placeCrate(ox, 1.4, 1.3);
      for (let i = 0; i < 7; i++) {
        const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), breadMats[i % breadMats.length]);
        loaf.scale.set(1.5, 0.8, 1.0);
        loaf.position.set(ox + (rand()-0.5)*1.0, topY + 0.22, (rand()-0.5)*0.9);
        loaf.rotation.y = rand() * Math.PI;
        loaf.castShadow = true;
        stall.add(loaf);
      }
    }
  } else if (type === 'fish') {
    // fish (silvery ellipsoids) laid out on ice (light crates)
    const fishMat = new THREE.MeshStandardMaterial({ color: 0xb9c4cc, roughness: 0.35, metalness: 0.5 });
    const iceMat  = new THREE.MeshStandardMaterial({ color: 0xcfe3ea, roughness: 0.4 });
    for (let k = 0; k < 3; k++) {
      const ox = -W/2 + 1.2 + k * (W - 2.4) / 2;
      const crate = placeCrate(ox, 1.4, 1.3);
      const ice = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 1.2), iceMat);
      ice.position.set(ox, topY + 0.16, 0); stall.add(ice);
      for (let i = 0; i < 5; i++) {
        const fish = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), fishMat);
        fish.scale.set(2.2, 0.7, 0.9);   // elongated fish shape
        fish.position.set(ox + (rand()-0.5)*0.9, topY + 0.21, -0.35 + (i%3)*0.35);
        fish.rotation.y = (rand()-0.5)*0.5;
        fish.castShadow = true;
        stall.add(fish);
      }
    }
  } else if (type === 'vegetables') {
    // vegetables: colored spheres (red tomatoes, green cabbages, orange carrots) in crates
    const vegSets = [
      [0xcf3b2e, 0xe04a3a],  // tomatoes
      [0x4f9a3a, 0x5fb04a],  // cabbages/savoy
      [0xe07a1f, 0xf08a2f],  // squash/carrots
    ];
    for (let k = 0; k < 3; k++) {
      const ox = -W/2 + 1.2 + k * (W - 2.4) / 2;
      placeCrate(ox, 1.4, 1.3);
      const pair = vegSets[k % vegSets.length];
      const mats = pair.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
      for (let i = 0; i < 9; i++) {
        const r = 0.11 + rand()*0.05;
        const veg = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), mats[i % mats.length]);
        veg.position.set(ox + (rand()-0.5)*1.0, topY + 0.2 + (rand()*0.06), (rand()-0.5)*0.9);
        veg.castShadow = true;
        stall.add(veg);
      }
    }
  }
}

function makeStall(type, awningOverride) {
  const stall = new THREE.Group();
  const W = 6.0, D = 1.9, legH = 1.25;

  //  4 legs 
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, legH, 6), woodDark);
    leg.position.set(sx * (W/2 - 0.1), legH/2, sz * (D/2 - 0.1));
    leg.castShadow = true;
    stall.add(leg);
  }

  // counter (top) 
  const counter = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), woodMat);
  counter.position.y = legH;
  counter.castShadow = true; counter.receiveShadow = true;
  stall.add(counter);
  // front board
  const front = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, 0.08), woodDark);
  front.position.set(0, legH - 0.3, D/2);
  stall.add(front);

  // tall rear poles for the awning 
  const backH = 4.0;
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, backH, 6), woodDark);
    pole.position.set(sx * (W/2 - 0.1), backH/2, -D/2 + 0.1);
    pole.castShadow = true;
    stall.add(pole);
  }

  //  striped, tilted awning 
  const awnColors = awningOverride || ({
    weapons: ['#8a2b2b', '#e0d2b0'],
    shields: ['#2b4a8a', '#e0d2b0'],
    clothes: ['#6a2b8a', '#e0d2b0'],
    mixed:   ['#7a1f6a', '#e0d2b0'],
    bread:      ['#e0d2b0', '#ffffff'],
    fish:       ['#2b6ab0', '#ffffff'],
    vegetables: ['#3a9a3a', '#ffffff'],
  }[type] || ['#7a1f6a', '#e0d2b0']);
  const awnTex = makeAwningTexture(awnColors[0], awnColors[1]);
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.7),
    new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.9, side: THREE.DoubleSide }));
  awning.position.set(0, backH - 0.15, -0.1);
  awning.rotation.x = -Math.PI / 2 + 0.45;   // tilted forward
  awning.castShadow = true;
  stall.add(awning);

  // GOODS on the counter, depending on the type
  const garments = [];   // for animation
  const topY = legH + 0.06;

  const placeOnCounter = (obj, ox, oz) => {
    obj.position.set(ox, topY, oz);
    stall.add(obj);
  };

  if (type === 'weapons' || type === 'mixed') {
    // swords standing against the back + spears
    for (let i = 0; i < 3; i++) {
      const sw = makeSword();
      sw.position.set(-W/2 + 0.4 + i * 0.4, topY, -D/2 + 0.3);
      sw.rotation.z = 0.15 * (rand() - 0.5);
      stall.add(sw);
    }
    for (let i = 0; i < 2; i++) {
      const sp = makeSpear();
      sp.position.set(W/2 - 0.3 - i * 0.25, topY, -D/2 + 0.2);
      sp.rotation.z = 0.08 * (i ? 1 : -1);
      stall.add(sp);
    }
  }

  // HORIZONTAL DISPLAY: SILVER swords and shields (military stalls only)
  if (type === 'weapons' || type === 'shields' || type === 'mixed') {
    // silver swords laid out on the LEFT half of the counter
    const nSwords = 3;
    for (let i = 0; i < nSwords; i++) {
      const sw = makeSwordSilver();
      const ox = -W/2 + 0.9 + i * 0.85;       // left half
      sw.position.set(ox, topY + 0.04, -0.1);
      sw.rotation.x = Math.PI / 2;            // lying flat
      sw.rotation.z = (rand() - 0.5) * 0.12;
      stall.add(sw);
    }
    // silver shields laid flat on the RIGHT half of the counter
    const nShields = 2;
    for (let i = 0; i < nShields; i++) {
      const sh = makeShield(0xc8ccd0, true);  // silver
      const ox = 0.6 + i * 0.95;              // right half
      sh.position.set(ox, topY + 0.06, 0.0);
      sh.rotation.x = Math.PI / 2;            // face up
      sh.rotation.z = (rand() - 0.5) * 0.2;
      stall.add(sh);
    }
  }

  // FOOD GOODS on the counter 
  if (type === 'bread' || type === 'fish' || type === 'vegetables') {
    addFoodGoods(stall, type, W, D, topY, rand);
  }

  if (type === 'shields' || type === 'mixed') {
    // shields hung on the rear pole and resting on the counter
    const shieldColors = [0xb23a3a, 0x3a6ab2, 0x3aa05a, 0xb2952f];
    for (let i = 0; i < 3; i++) {
      const sh = makeShield(shieldColors[i % shieldColors.length]);
      sh.position.set(-W/2 + 0.55 + i * 0.8, backH - 0.6, -D/2 + 0.18);
      stall.add(sh);
    }
  }

  if (type === 'clothes' || type === 'mixed') {
    // garments/drapes hung on a horizontal bar under the awning
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W - 0.2, 6), woodDark);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, backH - 0.5, -D/2 + 0.35);
    stall.add(bar);
    const clothColors = [0x9b3fb0, 0x3f7ab0, 0xb04f3f, 0x4fb07a, 0xd9b44a, 0xb03f7a];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const g = makeGarment(clothColors[i % clothColors.length]);
      g.mesh.position.set(-W/2 + 0.4 + i * ((W - 0.8) / (n - 1)), backH - 0.5, -D/2 + 0.35);
      stall.add(g.mesh);
      garments.push(g);
    }
  }

  stall.userData.garments = garments;
  return stall;
}

export function createStalls(scene, specs = []) {
  const root = new THREE.Group();
  const all = [];
  for (const s of specs) {
    const stall = makeStall(s.type || 'mixed', s.awning);
    const sc = s.scale || 1.35;          // overall scale-up (goods included)
    stall.scale.setScalar(sc);
    const y = getTerrainHeight(s.x, s.z);
    stall.position.set(s.x, y, s.z);
    stall.rotation.y = s.rotation || 0;
    root.add(stall);
    all.push(stall);
  }
  scene.add(root);

  // static: no-op update for animation-loop compatibility
  root.userData.update = function () {};

  return root;
}
