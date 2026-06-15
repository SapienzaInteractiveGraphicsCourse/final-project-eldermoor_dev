import * as THREE from 'three';
import { QUALITY } from './qualitySettings.js';

// ================== UNREAL-STYLE LIGHTING ==================
export function setupLights(scene) {
  // Soft ambient/sky light (kept low so shadows stay deep)
  const hemiLight = new THREE.HemisphereLight(
    0xddeeff, // bright sky
    0x6b5a45, // warm bounce from the ground
    0.15
  );
  scene.add(hemiLight);

  // Main sun from SOUTH toward NORTH: strong and direct, for marked shadows
  const dirLight = new THREE.DirectionalLight(0xfff1d0, 2.4);
  dirLight.position.set(0, 120, 180);
  dirLight.target.position.set(0, 0, -40);
  scene.add(dirLight);
  scene.add(dirLight.target);

  dirLight.castShadow = QUALITY.shadows;

  const shadowRes = QUALITY.shadowMapSize || 2048;
  const biasScale = 2048 / shadowRes;   // smaller map -> larger texel -> more bias
  dirLight.shadow.mapSize.set(shadowRes, shadowRes);
  dirLight.shadow.camera.left   = -160;
  dirLight.shadow.camera.right  =  160;
  dirLight.shadow.camera.top    =  160;
  dirLight.shadow.camera.bottom = -160;
  dirLight.shadow.camera.near   =  1;
  dirLight.shadow.camera.far    =  400;
  dirLight.shadow.bias       = -0.00015 * biasScale;
  dirLight.shadow.normalBias =  0.04 * biasScale;
  dirLight.shadow.radius     =  1.5;   // crisp shadow edges
  dirLight.shadow.intensity  =  1.0;   // full shadows (three r150+)

  // Very light top fill light 
  const topLight = new THREE.DirectionalLight(0xffffff, 0.15);
  topLight.position.set(0, 160, 0);
  topLight.target.position.set(0, 0, 0);
  scene.add(topLight);
  scene.add(topLight.target);

  return { hemiLight, dirLight, topLight };
}