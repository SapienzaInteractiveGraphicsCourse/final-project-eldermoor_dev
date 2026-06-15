import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { getTerrainHeight } from './terrainHeight.js';

// ================== BUILDINGS ==================
// Loads OBJ+MTL building modules described in buildings.json, fixes up their
// material/texture paths and places them in the world

const TEXTURE_PATHS = {
  'Standard': './Medieval Village MegaKit[Standard]/Textures/',
  'Source':   './Medieval Village MegaKit[Source]/Textures/'
};

// Asset paths 
function fixAssetPath(rawPath) {
  if (rawPath.startsWith('/')) return '.' + rawPath;
  return rawPath;
}

// Pick the texture folder based on which kit the MTL references
function detectTexturePath(mtlText) {
  if (mtlText.includes('[Standard]')) return TEXTURE_PATHS['Standard'];
  return TEXTURE_PATHS['Source'];
}

const modelCache = new Map();

async function loadOBJWithMTL(objPath, mtlPath) {
  const cacheKey = objPath;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey).clone();

  let mtlText = '';
  try {
    const res = await fetch(mtlPath);
    if (res.ok) mtlText = await res.text();
  } catch (e) {}

  let object;

  if (mtlText) {
    const texturePath = detectTexturePath(mtlText);

    // Drop alpha maps (map_d) and rewrite .bmp -> .png
    mtlText = mtlText.replace(/^map_d\s+.+$/gm, '');
    mtlText = mtlText.replace(/\.bmp/gi, '.png');

    // Rewrite every map line so its filename points at the right texture folder
    // (preserving any leading options like "-bm 0.5")
    mtlText = mtlText.replace(/(?:map_Kd|map_Ks|map_Ns|map_Bump|bump|norm)\s+.+/g, (line) => {
      const keyword = line.match(/^\S+/)[0];
      const rest = line.slice(keyword.length).trim();

      let params = '';
      let pathPart = rest;
      const paramMatch = rest.match(/^(-\w+\s+[\d.]+)\s+(.+)$/);

      if (paramMatch) {
        params = paramMatch[1] + ' ';
        pathPart = paramMatch[2];
      }

      const fileName = pathPart.replace(/\\/g, '/').split('/').pop();
      return keyword + ' ' + params + texturePath + fileName;
    });

    const mtlLoader = new MTLLoader();
    const materials = mtlLoader.parse(mtlText, '');
    materials.preload();

    for (const name in materials.materials) {
      const mat = materials.materials[name];
      mat.transparent = false;
      mat.opacity = 1.0;
    }

    object = await new Promise((resolve, reject) => {
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load(objPath, resolve, undefined, reject);
    });
  } else {
    object = await new Promise((resolve, reject) => {
      const objLoader = new OBJLoader();
      objLoader.load(objPath, resolve, undefined, reject);
    });
  }

  // Convert loaded materials into MeshStandardMaterial (glass becomes physical
  // transparent) and enable shadows
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];

        const newMats = mats.map((mat) => {
          const matName = (mat.name || '').toLowerCase();
          console.log('material:', mat.name, '-> matName:', matName);
          const isGlass = matName.includes('glass') || matName.includes('window');
          if (isGlass) {
            mat.dispose();
            return new THREE.MeshPhysicalMaterial({
              color: 0xaaddff,
              transparent: true,
              opacity: 0.55,
              roughness: 0.05,
              metalness: 0.0,
              transmission: 0.5,
              thickness: 0.5,
              side: THREE.DoubleSide,
            });
          }
          const stdMat = new THREE.MeshStandardMaterial({
            map: mat.map || null,
            normalMap: mat.normalMap || mat.bumpMap || null,
            color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
            roughness: 0.55,
            metalness: 0.0,
            side: mat.side,
            transparent: mat.transparent,
            opacity: mat.opacity,
          });

          if (mat.bumpMap && !mat.normalMap) {
            stdMat.bumpMap = mat.bumpMap;
            stdMat.bumpScale = 0.5;
            stdMat.normalMap = null;
          }

          mat.dispose();
          return stdMat;
        });

        child.material = newMats.length === 1 ? newMats[0] : newMats;
      }
    }
  });

  // Center the model on X and Z, align the bottom to Y=0
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const offsetX = center.x;
  const offsetY = box.min.y;
  const offsetZ = center.z;
  object.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.translate(-offsetX, -offsetY, -offsetZ);
    }
  });

  modelCache.set(cacheKey, object);
  return object.clone();
}

export async function createBuildings(scene, buildings, setStatus) {
  if (!buildings || !buildings.length) {
    console.warn('No building found');
    return;
  }

  let loaded = 0;
  const total = buildings.length;

  for (const building of buildings) {
    const bx = building.mapPosition.x;
    const bz = building.mapPosition.z || building.mapPosition.y || 0;
    const by = getTerrainHeight(bx, bz);

    const group = new THREE.Group();
    group.position.set(bx, by, bz);

    if (building.world && building.world.rotation) {
      group.rotation.y = building.world.rotation;
    }

    // Each building is made of several module parts (OBJ files)
    for (const part of building.modules) {
      const objPath = fixAssetPath(part.model);
      const mtlPath = part.material ? fixAssetPath(part.material) : objPath.replace('.obj', '.mtl');

      try {
        const object = await loadOBJWithMTL(objPath, mtlPath);

        object.position.set(...part.position);
        object.rotation.set(...part.rotation);
        object.scale.set(...part.scale);
        console.log('scale applied:', part.scale, '-> object.scale:', object.scale);

        // optional per-building brightness / emissive overrides
        const brightness = building.brightness || 1.0;
        const emissiveStr = building.emissive || '#000000';
        const emissiveIntensity = building.emissiveIntensity || 0.0;

        if (brightness !== 1.0 || emissiveIntensity > 0) {
          object.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of mats) {
                if (brightness !== 1.0) {
                  mat.color.multiplyScalar(brightness);
                }
                if (emissiveIntensity > 0) {
                  mat.emissive = new THREE.Color(emissiveStr);
                  mat.emissiveIntensity = emissiveIntensity;
                }
              }
            }
          });
        }

        group.add(object);
      } catch (err) {
        console.error(`Error loading module ${part.id}:`, err);
        console.warn(`Module ${part.id} not loaded, using placeholder`);

        // visible red wireframe box so missing modules are obvious
        const placeholder = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0xff6666, wireframe: true })
        );
        placeholder.position.set(...part.position);
        group.add(placeholder);
      }
    }

    // Tag this group as a building and compute a collision circle from its
    // XZ bounding box, so the player collider can pick it up automatically
    // (no dependency on buildings.json at collision time)
    {
      const bb = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bb.getSize(size);
      bb.getCenter(center);
      // radius = half of the larger XZ footprint side, slightly reduced so
      // narrow alleys between buildings stay walkable
      const r = Math.max(size.x, size.z) * 0.42;
      group.userData.isBuilding = true;
      group.userData.collide = { x: center.x, z: center.z, r };
    }

    scene.add(group);
    loaded++;
    if (setStatus) setStatus(`Buildings: ${loaded}/${total}`);
  }
}