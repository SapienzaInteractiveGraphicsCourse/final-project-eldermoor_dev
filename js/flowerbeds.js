import * as THREE from 'three';
import { QUALITY } from './qualitySettings.js';
import { getTerrainHeight } from './terrainHeight.js';
import { brickBaseColor, brickRoughness, brickNormal } from './textures.js';

// ================== CIRCULAR FLOWERBEDS ==================
// grass texture (reused, dark/emerald) for the "underside" of the beds
const _texLoader = new THREE.TextureLoader();
const GRASS_TEX_PATH = './soil_textures/Poliigon_GrassPatchyGround_4585_';
const grassBaseColor = _texLoader.load(GRASS_TEX_PATH + 'BaseColor.png');
const grassRoughness = _texLoader.load(GRASS_TEX_PATH + 'Roughness.png');
const grassNormal    = _texLoader.load(GRASS_TEX_PATH + 'Normal.png');
for (const t of [grassBaseColor, grassRoughness, grassNormal]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = QUALITY.anisotropy;
  t.repeat.set(2, 2);
}
grassBaseColor.colorSpace = THREE.SRGBColorSpace;

let _seed = 24681;
const rand = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

// patchy palette, bright saturated colors
const PALETTE = [
  0x0047ab, // cobalt
  0x8a2be2, // vivid purple
  0xff1f1f, // bright red
  0xff7400, // bright orange
  0xffffff, // pure white
  0xff2d95, // magenta/bright pink
];

function jitterColor(hex, dH = 0.04, dS = 0.12, dL = 0.10) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  hsl.h = (hsl.h + (rand() - 0.5) * dH + 1) % 1;
  hsl.s = Math.min(1, Math.max(0, hsl.s + (rand() - 0.5) * dS));
  hsl.l = Math.min(1, Math.max(0, hsl.l + (rand() - 0.5) * dL));
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

// teardrop petal with a neutral gradient (dark base -> light tip) so the
// per-instance color multiplies it while keeping the gradient
function makePetalGeo() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.06, 0.05, 0.06, 0.16, 0, 0.22);
  shape.bezierCurveTo(-0.06, 0.16, -0.06, 0.05, 0, 0);
  const geo = new THREE.ShapeGeometry(shape, 6);
  geo.scale(1.5, 1.5, 1.5);
  // neutral gradient on vertex color: 0.7 base -> 1.1 tip (multiplier)
  const pos = geo.attributes.position;
  let maxY = 0; for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = maxY > 0 ? pos.getY(i) / maxY : 0;
    const m = 0.78 + t * 0.32;     // shadow at the base, light at the tip
    colors[i*3] = m; colors[i*3+1] = m; colors[i*3+2] = m;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function createFlowerbeds(scene, centers = [], options = {}) {
  const {
    radius = 4.5,
    wallH = 0.7,
    wallT = 0.5,
    soilColor = 0x1f8a5a,   // emerald green
    density = 1.0,
  } = options;

  // shared materials 
  const brickMat = new THREE.MeshStandardMaterial({
    map: brickBaseColor, roughnessMap: brickRoughness, normalMap: brickNormal,
    roughness: 1.0, metalness: 0.0,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    map: grassBaseColor, roughnessMap: grassRoughness, normalMap: grassNormal,
    color: soilColor, roughness: 1.0, metalness: 0.0,
  });
  const bladeMat  = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
  const petalMat  = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  const heartMat  = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  const baseMat   = new THREE.MeshStandardMaterial({ roughness: 0.95 });

  // shared base geometries 
  const bladeGeo = new THREE.ConeGeometry(0.035, 1, 4);   // height 1, scaled per instance
  const petalGeo = makePetalGeo();
  const heartGeo = new THREE.SphereGeometry(0.07, 6, 5);
  const domeGeo  = new THREE.SphereGeometry(0.34, 8, 5, 0, Math.PI*2, 0, Math.PI/2);

  const root = new THREE.Group();

  // first pass: generate all transforms and colors (per instance) 
  const blades = [];  // {matrix, color}
  const petals = [];
  const hearts = [];
  const domes  = [];

  const m4 = new THREE.Matrix4();
  const q  = new THREE.Quaternion();
  const e  = new THREE.Euler();
  const v  = new THREE.Vector3();
  const ONE = new THREE.Vector3(1,1,1);

  for (const c of centers) {
    const baseY = getTerrainHeight(c.x, c.z);
    const cx = c.x, cz = c.z;

    // color zones (patches)
    const nZones = 4 + Math.floor(rand() * 2);
    const zoneColors = [];
    for (let i = 0; i < nZones; i++) zoneColors.push(PALETTE[Math.floor(rand() * PALETTE.length)]);
    const colorAt = (lx, lz) => {
      const ang = Math.atan2(lz, lx) + Math.PI;
      return zoneColors[Math.floor((ang/(Math.PI*2))*nZones) % nZones];
    };

    const topY = wallH * 0.5 + 0.12;
    const step = 0.62 / density;
    const inner = radius - 0.3;

    for (let gx = -inner; gx <= inner; gx += step) {
      for (let gz = -inner; gz <= inner; gz += step) {
        const lx = gx + (rand()-0.5)*step*0.7;
        const lz = gz + (rand()-0.5)*step*0.7;
        if (Math.hypot(lx, lz) > inner) continue;

        const wx = cx + lx, wz = cz + lz;          // world position of the clump
        const clumpScale = 0.7 + rand()*0.5;
        const petalColor = colorAt(lx, lz);

        // base/dome
        {
          const col = jitterColor(0x2f5e26, 0.04, 0.10, 0.06);
          e.set(0, rand()*Math.PI*2, 0); q.setFromEuler(e);
          v.set(clumpScale, clumpScale*0.35, clumpScale);
          m4.compose(new THREE.Vector3(wx, baseY+topY, wz), q, v);
          domes.push({ m: m4.clone(), c: col });
        }

        // grass blades
        const nBlades = 10 + Math.floor(rand()*6);
        for (let i = 0; i < nBlades; i++) {
          const h = (0.35 + rand()*0.45) * clumpScale;
          const col = jitterColor(0x4d8a35, 0.06, 0.16, 0.14);
          const a = rand()*Math.PI*2, rr = rand()*0.28*clumpScale;
          const tilt = 0.15 + rand()*0.35;
          e.set(Math.cos(a)*tilt, rand()*Math.PI, Math.sin(a)*tilt); q.setFromEuler(e);
          v.set(1, h, 1);
          m4.compose(new THREE.Vector3(wx+Math.cos(a)*rr, baseY+topY+h*0.4, wz+Math.sin(a)*rr), q, v);
          blades.push({ m: m4.clone(), c: col });
        }

        // flowers (petal corolla + heart)
        const nF = 3 + Math.floor(rand()*3);
        for (let f = 0; f < nF; f++) {
          const fa = rand()*Math.PI*2, fr = rand()*0.3*clumpScale;
          const fx = wx + Math.cos(fa)*fr, fz = wz + Math.sin(fa)*fr;
          const fy = baseY + topY + (0.3 + rand()*0.2)*clumpScale;
          const fScale = (1.0 + rand()*0.6) * clumpScale;
          const base = jitterColor(petalColor, 0.03, 0.06, 0.06);
          const nPetals = 5 + Math.floor(rand()*2);
          for (let p = 0; p < nPetals; p++) {
            const a = (p/nPetals)*Math.PI*2 + rand()*0.1;
            e.set(-Math.PI/2 + 0.5, 0, a); q.setFromEuler(e);
            v.set(fScale, fScale, fScale);
            m4.compose(new THREE.Vector3(fx, fy, fz), q, v);
            petals.push({ m: m4.clone(), c: base });
          }
          // heart
          const hc = jitterColor(0xffc63f, 0.05, 0.15, 0.12);
          e.set(0,0,0); q.setFromEuler(e);
          v.set(fScale, fScale*0.7, fScale);
          m4.compose(new THREE.Vector3(fx, fy+0.04*fScale, fz), q, v);
          hearts.push({ m: m4.clone(), c: hc });
        }
      }
    }

    // soil + brick rim (regular meshes, few of them)
    const bed = new THREE.Group();
    bed.position.set(cx, baseY, cz);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.25, 28), soilMat);
    soil.position.y = wallH*0.5; soil.receiveShadow = true; bed.add(soil);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius+wallT, radius+wallT, wallH, 28, 1, true), brickMat);
    ring.position.y = wallH/2 + 0.05; ring.castShadow = true; ring.receiveShadow = true; bed.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius+wallT*0.7, wallT*0.5, 8, 28), brickMat);
    rim.rotation.x = Math.PI/2; rim.position.y = wallH+0.05; bed.add(rim);
    root.add(bed);
  }

  //build the InstancedMeshes 
  function buildInstanced(geo, mat, list, castShadow) {
    if (list.length === 0) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    for (let i = 0; i < list.length; i++) {
      im.setMatrixAt(i, list[i].m);
      im.setColorAt(i, list[i].c);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = castShadow;
    im.receiveShadow = true;
    root.add(im);
  }

  buildInstanced(domeGeo,  baseMat,  domes,  false);
  buildInstanced(bladeGeo, bladeMat, blades, true);
  buildInstanced(petalGeo, petalMat, petals, true);
  buildInstanced(heartGeo, heartMat, hearts, false);

  scene.add(root);
  return root;
}