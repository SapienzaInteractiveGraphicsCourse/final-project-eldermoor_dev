import * as THREE from 'three';
import { QUALITY } from './qualitySettings.js';

// ================== SOIL TEXTURE CACHE ==================
// The four fields (wheat, lavender, pumpkins, red flowers) all use the SAME
// soil texture

const TEX_PATH = './soil_textures/';
const loader = new THREE.TextureLoader();

let _base = null;   // source textures, loaded only once

function loadBase() {
  if (_base) return _base;
  const diff  = loader.load(TEX_PATH + 'Forest_Path_ugsnfawlw_2K_BaseColor.jpg');
  const norm  = loader.load(TEX_PATH + 'Forest_Path_ugsnfawlw_2K_Normal.jpg');
  const rough = loader.load(TEX_PATH + 'Forest_Path_ugsnfawlw_2K_Roughness.jpg');
  for (const t of [diff, norm, rough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = QUALITY.anisotropy;
  }
  diff.colorSpace = THREE.SRGBColorSpace;
  _base = { diff, norm, rough };
  return _base;
}

// Returns {diff, norm, rough} clones with the requested repeat
export function getSoilTextures(repU, repV) {
  const base = loadBase();
  const out = {};
  for (const key of ['diff', 'norm', 'rough']) {
    const c = base[key].clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(repU, repV);
    c.needsUpdate = true;
    out[key] = c;
  }
  return out;
}