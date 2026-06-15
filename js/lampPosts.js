import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrainHeight.js';

// ================== LAMP POSTS + DAY/NIGHT CYCLE ==================
const LAMP_MODEL = 'lamp/lamp_post_light.glb';

function loadGLB(loader, path) {
  return new Promise((resolve) => {
    loader.load(path, (g) => resolve(g.scene), undefined,
      () => { console.warn('Lamps: model not loaded:', path); resolve(null); });
  });
}

export async function createLampPosts(scene, positions = [], options = {}) {
  const {
    targetH = 5.0,          // lamp height in world units
    lightColor = 0xffe9a8,  // warm light yellow
    lightIntensity = 40,    // lamp intensity at night (stronger halo)
    lightDistance = 42,     // PointLight reach (wider halo)
    dayLengthSec = 120,     // duration of a full day+night cycle (seconds)
  } = options;

  const loader = new GLTFLoader();
  const proto = await loadGLB(loader, LAMP_MODEL);

  const group = new THREE.Group();
  const lamps = [];     // { light, emissives: [mat...] , bulbY }

  // normalize the prototype height
  let factor = 1, bulbLocalY = targetH * 0.9;
  if (proto) {
    const box = new THREE.Box3().setFromObject(proto);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0.001) factor = targetH / size.y;
    bulbLocalY = targetH * 0.92;   // the bulb sits near the top
  }

  for (const p of positions) {
    const lamp = new THREE.Group();

    if (proto) {
      const model = proto.clone(true);
      model.scale.setScalar(factor);
      // rest on the ground
      const b = new THREE.Box3().setFromObject(model);
      model.position.y = -b.min.y;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      lamp.add(model);

      // collect "bulb/glass" materials to make them glow at night:
      // heuristic -> bright or already-emissive materials near the top.
      const emissives = [];
      model.traverse(o => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (m.emissive !== undefined) {
              m.emissive = new THREE.Color(lightColor);
              m.emissiveIntensity = 0;     // off during the day
              emissives.push(m);
            }
          });
        }
      });
      lamp.userData.emissives = emissives;
    } else {
      // fallback: a simple pole if the model fails to load
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, targetH, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.7, metalness: 0.5 }));
      pole.position.y = targetH / 2; pole.castShadow = true;
      lamp.add(pole);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: new THREE.Color(lightColor), emissiveIntensity: 0 }));
      bulb.position.y = targetH * 0.95;
      lamp.add(bulb);
      lamp.userData.emissives = [bulb.material];
    }

    // lamp PointLight (off during the day)
    const light = new THREE.PointLight(lightColor, 0, lightDistance, 2);
    light.position.set(0, bulbLocalY, 0);
    light.castShadow = false;        // no shadows from lamps 
    lamp.add(light);

    const y = getTerrainHeight(p.x, p.z);
    lamp.position.set(p.x, y, p.z);
    lamp.rotation.y = p.rotation || 0;
    if (p.scale) lamp.scale.setScalar(p.scale);

    group.add(lamp);
    lamps.push({ light, emissives: lamp.userData.emissives });
  }

  scene.add(group);

  // sky colors for the various phases
  const skyDay   = new THREE.Color(0xa0c4ff);
  const skyDusk  = new THREE.Color(0xdd8a5a);
  const skyNight = new THREE.Color(0x0b1530);

  // sun: reference colors and intensity (during the day)
  const sunDayColor  = new THREE.Color(0xfff1d0);
  const sunDuskColor = new THREE.Color(0xff9a4a);

  const obj = {
    group,
    // time = elapsed seconds; lights = return of setupLights
    update(time, luci) {
      // day phase 0..1 (0 = midnight, 0.5 = noon)
      const phase = (time % dayLengthSec) / dayLengthSec;
      // sun height: a sine that goes above/below the horizon
      const sun = Math.sin(phase * Math.PI * 2 - Math.PI / 2); // -1 night, +1 day
      const dayF = THREE.MathUtils.clamp((sun + 0.2) / 1.2, 0, 1); // 1 day, 0 night
      const nightF = 1 - dayF;

      // lamps: on at night 
      for (const lp of lamps) {
        lp.light.intensity = lightIntensity * nightF;
        for (const m of lp.emissives) m.emissiveIntensity = 2.2 * nightF;  // bright bulb
      }

      // global lights and sky 
      if (luci) {
        if (luci.dirLight) {
          luci.dirLight.intensity = 2.0 * dayF + 0.005;   // practically off at night
          const dusk = 1 - Math.abs(dayF - 0.5) * 2;
          luci.dirLight.color.copy(sunDayColor).lerp(sunDuskColor, dusk * 0.8);
        }
        // very low ambient at night -> dark scene, lamps stand out
        if (luci.hemiLight) luci.hemiLight.intensity = 0.9 * dayF ;
        if (luci.topLight)  luci.topLight.intensity = 0.35 * dayF;
      }

      // sky background 
      if (scene.background && scene.background.isColor) {
        // day -> blue; transition -> orange; night -> dark blue
        const dusk = 1 - Math.abs(dayF - 0.5) * 2;
        const c = skyNight.clone().lerp(skyDay, dayF);
        c.lerp(skyDusk, dusk * 0.5);
        scene.background.copy(c);
      }
    },
  };

  return obj;
}
