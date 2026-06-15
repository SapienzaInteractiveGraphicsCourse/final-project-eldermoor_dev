import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { detectQuality, QUALITY, shadowMapTypeFor } from './js/qualitySettings.js';
import { createPerfHUD } from './js/perfHud.js';
import { createPerfToggles } from './js/perfToggle.js';
import { setupLights }      from './js/lights.js';
import { createLampPosts }  from './js/lampPosts.js';
import { createGround }     from './js/ground.js';
import { createCityWalls }  from './js/walls.js';
import { createBuildings }  from './js/buildings.js';
import { createRoads }      from './js/roads.js';
import { createMountains } from './js/mountains.js';
import { createFioriera }   from './js/fioriera.js';
import { createWindmill }   from './js/windmill.js';
import { createWheatField } from './js/wheatField.js';
import { createLavenderField } from './js/lavenderField.js';
import { createPumpkinField } from './js/pumpkinField.js';
import { createRedFlowerField } from './js/redFlowerField.js';
import { createWindmillTrees, fillTreeArea, addNoTreeRect } from './js/windmillTrees.js';
import { createPond }       from './js/pond.js';
import { createWell }       from './js/well.js';
import { createBanners }    from './js/banners.js';
import { createStalls }     from './js/stalls.js';
import { createFlowerbeds } from './js/flowerbeds.js';
import { scatterVegetation } from './js/scatter.js';
import { createElfWarrior } from './js/elfWarrior.js';
import { createPlayerCollision } from './js/playerCollision.js';
import { createNPCManager } from './js/npcManager.js';
import { createQuestSystem } from './js/questSystem.js';
import { createDialogueSystem } from './js/dialogueSystem.js';
import { createCollectibles } from './js/collectibles.js';
import { createHUD } from './js/hud.js';
import { createInventory } from './js/inventory.js';

// ================== STATUS HELPER ==================
const statusEl = document.getElementById('status');
function setStatus(msg) { statusEl.textContent = msg; }
// updates the menu's loading bar (frac 0..1 + phase label)
function setProgress(frac, label) {
  if (typeof window.onLoadProgress === 'function') window.onLoadProgress(frac, label);
}

// ================== SETUP ==================
const canvas   = document.getElementById('c');
const scene    = new THREE.Scene();
scene.background = new THREE.Color(0xa0c4ff);

const camera   = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 80, 120);

detectQuality(null);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.antialias });
detectQuality(renderer);
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.pixelRatioCap));
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = shadowMapTypeFor(THREE);

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = QUALITY.toneMappingExposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Performance overlay (toggle with the 'P' key): FPS, draw calls, triangles.
const perf = createPerfHUD(renderer, scene);
// DEBUG: runtime toggles to find the bottleneck (keys T/L/K/J). Reads `laghetto`
// lazily so it works even though the pond is created later during loadData.
createPerfToggles(renderer, scene, () => ({ pond: laghetto, scatter: scatterGroup }));

// Procedural environment (no external HDRI files): gives the PBR materials
// something to reflect. This is what makes the lake water's reflections
// "light up" (clearcoat + envMapIntensity in the pond material).
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // the environment also lights the materials: I keep its brightness
  // contribution low so it adds reflections without lightening the scene too much.
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.5;
}

// ================== LIGHTS ==================
const luci = setupLights(scene);

// ================== CONTROLS ==================
// The third-person camera is handled by the character controller
// (elfWarrior.js), which makes it follow behind the elf and lets it orbit with
// the mouse. For this reason we do NOT use OrbitControls on the same camera.
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;

// ================== ANIMATION ==================
const clock = new THREE.Clock();
let tempo = 0;   // accumulated time (s) for animations based on getElapsedTime
const fioriere = [];
let mulino = null;
let fontana = null;
let campoGrano = null;
let campoLavanda = null;
let campoZucche = null;
let campoFioriRossi = null;
let laghetto = null;
let pozzo = null;
let stendardi = null;
let bancarelle = null;
let lampioni = null;
let elf = null;
let npcManager = null;
let questSystem = null;
let dialogue = null;
let erbe = null;
let scatterGroup = null;
let hud = null;
let inventory = null;
let sceneReady = false;   // true once loadData finishes; loop skips work until then

// ================== UTILS ==================
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unable to load ${url}: ${res.status}`);
  return res.json();
}

// ================== LOAD DATA ==================
async function loadData() {
  try {
    setStatus('Loading...');
    setProgress(0.05, 'Preparing the world');

    const buildingsData = await loadJSON('./buildings.json');

    createGround(scene);
    createMountains(scene);
    fontana = createRoads(scene);
    setProgress(0.15, 'Laying the ground');

    createCityWalls(scene);
    setProgress(0.22, 'Raising the walls');
    setProgress(0.38, 'Planting the forest');
    await createBuildings(scene, buildingsData.buildings, setStatus);
    setProgress(0.58, 'Building the village');

    // Planters on the four sides of the fountain 
    const FX = 0, FZ = 30, D = 10.5;
    fioriere.push(createFioriera(scene, FX,     FZ - D, 0));            // north
    fioriere.push(createFioriera(scene, FX,     FZ + D, 0));            // south
    fioriere.push(createFioriera(scene, FX + D, FZ,     Math.PI / 2)); // east
    fioriere.push(createFioriera(scene, FX - D, FZ,     Math.PI / 2)); // west

    // Windmill
    mulino = createWindmill(scene, 20, -80, 0); 

    // Wheat/pumpkin field: half wheat (left) + half pumpkins (right)
    campoGrano = createWheatField(scene, 43.75, -80, 22.5, 35, 0);
    campoZucche = createPumpkinField(scene, 66.25, -80, 22.5, 35, 0);

    // Lavender/red flower field: half lavender (left) + half red (right) 
    campoLavanda = createLavenderField(scene, 90, -80, 20, 35, 0);
    campoFioriRossi = createRedFlowerField(scene, 110, -80, 20, 35, 0);

    // Pond
    laghetto = await createPond(scene, 88, -34, 16, 18);

    // Well toward the windmill 
    pozzo = createWell(scene, 45, -55, 0.6);

    // Two purple/gold banners on the sides of the gate road 
    stendardi = createBanners(scene);

    // Lamp posts with day/night cycle (they light up in the evening)
    // distributed along the roadside across all the inner paving
    lampioni = await createLampPosts(scene, [
      { x: -22, z: -24 }, { x: 8, z: -24 }, { x: -64, z: -18 }, { x: -34, z: -12 },
      { x: 8, z: 0 }, { x: -46, z: 12 }, { x: -10, z: 18 }, { x: 56, z: 18 },
      { x: 74, z: 18 }, { x: 8, z: 30 }, { x: -52, z: 36 }, { x: -4, z: 36 },
      { x: -10, z: 48 }, { x: 8, z: 48 }, { x: -46, z: 54 }, { x: 38, z: 54 },
      { x: 50, z: 60 }, { x: 62, z: 72 }, { x: -46, z: 78 }, { x: 20, z: 78 },
      { x: -22, z: 84 }, { x: 56, z: 84 }, { x: 44, z: 90 }, { x: 32, z: 96 },
    ]);

    // Two stalls (weapons, shields, garments) east of the banners 
    bancarelle = createStalls(scene, [
      { x: 28, z: 86,  rotation: -Math.PI / 2, type: 'mixed' },
      { x: 28, z: 98,  rotation: -Math.PI / 2, type: 'mixed' },
      // food stalls in a mirrored HORSESHOE shape (opening facing west)
      { x: 72.0, z: 62.0, rotation: -1.57, type: 'bread',      awning: ['#3a9a3a', '#ffffff'] }, // bread: green-white (back, east)
      { x: 66.2, z: 52.9, rotation: -0.44, type: 'vegetables', awning: ['#e0c020', '#ffffff'] }, // vegetables: yellow-white (south side)
      { x: 66.2, z: 71.1, rotation: -2.71, type: 'fish',       awning: ['#2b6ab0', '#ffffff'] }, // fish: blue-white (north side)
    ]);
    // Two circular flowerbeds, one per side, between the banner pairs 
    createFlowerbeds(scene, [
      { x: -13, z: 92 },   // left side, between the two left banners
      { x:  13, z: 92 },   // right side, between the two right banners
    ]);

    // Main character: elf warrior in third person 
    // Takes control of the camera (follows behind, orbitable with the mouse)
    // WASD to move, SPACE to jump, Shift to run
    elf = await createElfWarrior(scene, camera, renderer.domElement);
    setProgress(0.72, 'Summoning the hero');

    // HUD: top-left portrait (medieval frame) + green health bar (full) 
    hud = createHUD({ portrait: './hud_portrait.jpg', name: 'Elarion' });

    // Game systems: quests, dialogue, NPCs
    questSystem = createQuestSystem();
    dialogue = createDialogueSystem(questSystem, {
      onOpen:  () => { if (elf.setInputEnabled) elf.setInputEnabled(false); },  // stops the character
      onClose: () => { if (elf.setInputEnabled) elf.setInputEnabled(true); },
      // makes the NPC you're talking to gesture (npcManager already exists at runtime)
      onGesture: (id, gesture) => { if (npcManager) npcManager.playGesture(id, gesture); },
    });

    // NPCs in the village. id = GLB file name (in characters/)
    setProgress(0.78, 'Gathering the villagers');
    npcManager = await createNPCManager(scene, [
      //  GATE GUARDS 
      { id: 'medieval_knight',         path: './characters/medieval_knight.glb',         x: -14, z: 76, rotationY: Math.PI, forwardOnly: true },
      { id: 'fantasy_warrior',         path: './characters/fantasy_warrior.glb',         x: 24,  z: 90, rotationY: 0.0, forwardOnly: true, wander: true, wanderRadius: 3 },

      // central square 
      { id: 'wizard',                  path: './characters/wizard.glb',                  x: -16, z: 40, rotationY: 0.5, noArms: true },
      { id: 'fantasy_dwarf',           path: './characters/fantasy_dwarf.glb',           x: 33, z: 86, rotationY: 1.57, scale: 2.7, noArms: true },
      { id: 'medieval_baker',          path: './characters/medieval_baker.glb',          x: 75,  z: 60, rotationY: -1.57, noArms: true },
      { id: 'fishmonger',              path: './characters/fishmonger.glb',              x: 68,  z: 73, rotationY: -2.71, noArms: true },
      { id: 'elf_armored',             path: './characters/elf_armored.glb',             x: 14,  z: 76, rotationY: Math.PI, forwardOnly: true },

      // east stalls
      { id: 'medieval_craftsman',      path: './characters/medieval_craftsman.glb',      x: 32,  z: 96, rotationY: 0.2, forwardOnly: true, wander: true, wanderRadius: 3 },
      { id: 'medieval_craftsman2',     path: './characters/medieval_craftsman2.glb',     x: 69,  z: 51, rotationY: -0.44, noArms: true },
      { id: 'medieval_female_artisan', path: './characters/medieval_female_artisan.glb', x: 58,  z: 62, rotationY: 1.57, wander: true, wanderRadius: 6, noArms: true },

      // townsfolk who WANDER in the gate/south square area 
      { id: 'medieval_woman1',         path: './characters/medieval_woman1.glb',         x: 16,  z: 42, rotationY: -2.2, wander: true, wanderRadius: 4, noArms: true },
      { id: 'medieval_woman2',         path: './characters/medieval_woman2.glb',         x: -16, z: 24, rotationY: 1.4,  wander: true, wanderRadius: 4, noArms: true },
      { id: 'medieval_woman3',         path: './characters/medieval_woman3.glb',         x: 14,  z: 16, rotationY: 2.8,  wander: true, wanderRadius: 4, noArms: true },

      // inner western streets
      { id: 'medieval_female',         path: './characters/medieval_female.glb',         x: -20, z: -15, rotationY: 1.0, wander: true, wanderRadius: 5, noArms: true },
      { id: 'elderly_woman',           path: './characters/elderly_woman.glb',           x: 50,  z: -52, rotationY: -2.4, armPose: 'manoSulFianco' },
      { id: 'medieval_worker',         path: './characters/medieval_worker.glb',         x: -38, z: -20, rotationY: 2.6, wander: true, wanderRadius: 4, noArms: true },
      { id: 'medieval_robed_figure',   path: './characters/medieval_robed_figure.glb',   x: -40, z: 16, rotationY: 0.6, noArms: true },

      // north area 
      { id: 'medieval_character_1',    path: './characters/medieval_character_1.glb',    x: 2,   z: -60, rotationY: 0.3, wander: true, wanderRadius: 6, noArms: true },
      { id: 'medieval_character_2',    path: './characters/medieval_character_2.glb',    x: 16,  z: -18, rotationY: -2.0, noArms: true },
      { id: 'fantasy_character_1',     path: './characters/fantasy_character_1.glb',     x: -40, z: 30, rotationY: 1.0, wander: true, wanderRadius: 6, noArms: true },

      //  hooded figure: static NPC, off to the side 
      { id: 'medieval_hooded_figure',  path: './characters/medieval_hooded_figure.glb',  x: 78,  z: 66, rotationY: -Math.PI / 2, noArms: true, fixedRotation: true },
    ], {
      onInteract: (id) => { if (!dialogue.isOpen) dialogue.open(id); },
    });

    //Collisions for the MAIN CHARACTER ONLY 
    // Blocks the elf against buildings (auto-detected from the scene), the city
    // walls, the windmill/well/fountain/stalls/
    // planters and every NPC (read live, so it works for wandering ones too)
    {
      const playerCollision = createPlayerCollision(scene, {
        player: { radius: 1.2 },
        npcManager,
      });
      if (elf.setCollider) elf.setCollider(playerCollision.resolve);
    }

    //  Herb gathering for the "The Moon Herbs" quest: 3 herbs on the edge of the
    //  pond (88,-34). They appear only when the quest is active; F to gather
    erbe = createCollectibles(scene, questSystem, {
      questId: 'erbe', flag: 'erbe_raccolte', total: 3,
      item: {
        name: 'Moon Herb',
        desc: 'A pale, faintly glowing herb that grows by calm water. Alaric needs three of these.',
      },
      spots: [
        { x: 106.4, z: -17.3 },
        { x: 65.4,  z: -25.1 },
        { x: 92.2,  z: -59.6 },
      ],
    });
    setProgress(0.9, 'Scattering the woods');

    // Inventory (toggle with I): starts with sword + shield; shows the moon
    // herbs while held, then swaps them for the healing potion once handed
    // to Alaric. Reads live quest state, so it stays in sync by itself
    inventory = createInventory(questSystem, {
      collectibles: erbe,
      canOpen: () => !dialogue || !dialogue.isOpen,   // don't open over a dialogue
      onOpen:  () => { if (elf.setInputEnabled) elf.setInputEnabled(false); },
      onClose: () => { if (elf.setInputEnabled && (!dialogue || !dialogue.isOpen)) elf.setInputEnabled(true); },
    });

    // Trees: in a dedicated try, so that any problem with the models
    //     does not block the loading of the rest of the scene
    try {
      // Register the fields as no-tree zones 
      addNoTreeRect(55,  -80, 45, 35, 3);  // wheat
      addNoTreeRect(100, -80, 40, 35, 3);  // lavender
      addNoTreeRect(88,  -34, 58, 62, 4);  // pond (wide margin: trees kept away from the pond)
      addNoTreeRect(60,  -8,  8,  8,  2);  // well
      addNoTreeRect(20,  -66, 32, 28, 2);  // clearing in front of the windmill (toward the south)
      // inside of the big curve NO (town-center side): no trees here,
      // so they only remain in the outer band toward the walls
      addNoTreeRect(-12, -50, 56, 26, 0); // inside the curve, northern stretch

      // Trees around the windmill 
      await createWindmillTrees(scene, 20, -80, {
        count: 18,
        innerR: 11,
        outerR: 24,
        avoidDeg: 90,   // in front of the blades (toward +Z / south)
        avoidSpan: 80,
      });

      // Trees ONLY behind the windmill and fields, up to the walls
      // Automatically discards roads, fields and anything spilling outside the walls
      await fillTreeArea(scene, 6, 135, -165, -100, {
        spacing: 6,
        jitter: 2.5,
        minDist: 4,
      });

      // Trees around the lake, east side
      // The ring avoids the lake and well (registered as no-tree zones above)
      await createWindmillTrees(scene, 88, -34, {
        count: 14,
        innerR: 22,
        outerR: 30,
        avoidDeg: 270,   // leaves the west side more open (toward the village)
        avoidSpan: 70,
      });

      // Many trees to the EAST of the lake: dense grove up to the walls
      // fillTreeArea avoids roads, lake, well and anything spilling outside the walls
      await fillTreeArea(scene, 106, 132, -58, 26, {
        spacing: 4.5,    // dense
        jitter: 2.0,
        minDist: 3.2,
      });

      // Tree filling in the NORTH band: from z=-62 up to the northern walls
      // insideWalls + isFreeSpot exclude walls, roads, fields, windmill, lake
      await fillTreeArea(scene, -135, 135, -165, -62, {
        spacing: 6,
        jitter: 2.5,
        minDist: 4,
      });

      // Trees in the band between the big north-west curve and the walls
      await fillTreeArea(scene, -60, 12, -95, -40, {
        spacing: 5,
        jitter: 2.2,
        minDist: 3.5,
      });

      // Trees in the band to the NORTH of the east road, from the MIDDLE of the road 
      // toward the east
      await fillTreeArea(scene, 55, 110, 1, 22, {
        spacing: 4,      // denser = more trees
        jitter: 2.0,
        minDist: 3,
      });

      // Grass and bushes denser on the grass of the NORTH-EAST quadrant
      // (windmill and lake area). Avoids roads, paving, walls and the areas below
      scatterGroup = await scatterVegetation(scene, {
        grassSpacing: 4.5,   // denser
        flowerChance: 0.22,  // more bushes/flowers
        avoidRects: [
          { cx: 55,  cz: -80, w: 45, d: 35 },  // wheat
          { cx: 100, cz: -80, w: 40, d: 35 },  // lavender
          { cx: 88,  cz: -34, w: 50, d: 54 },  // lake
          { cx: 20,  cz: -66, w: 32, d: 28 },  // in front of the windmill
        ],
      });
    } catch (treeErr) {
      console.error('Error placing trees (scene loaded anyway):', treeErr);
    }

    setStatus('Scene ready');
    statusEl.style.display = 'none';
    setProgress(1.0, 'Ready');
    sceneReady = true;
    // signals to the menu/loading that the scene is fully loaded
    if (typeof window.onSceneReady === 'function') window.onSceneReady();

  } catch (err) {
    console.error(err);
    setStatus('Error: ' + err.message);
    if (typeof window.onSceneError === 'function') window.onSceneError(err);
  }
}

// ================== LOOP ==================
let frameCount = 0;
let lastFrameTime = 0;

function animate(now) {
  requestAnimationFrame(animate);

  // frame rate cap. NOTE: a naive "if (now - last < 1000/cap) return" beats
  // against the monitor's vsync (a 60Hz frame often misses the threshold by a
  // hair and gets skipped, collapsing the rate to ~44). We subtract a small
  // tolerance (half a frame at 60Hz) so frames are never dropped by a hair.
  if (QUALITY.fpsCap > 0) {
    const minDelta = 1000 / QUALITY.fpsCap - 4;   // ~4ms tolerance
    if (now - lastFrameTime < minDelta) return;
    lastFrameTime = now;
  }
  frameCount++;

  // Until the scene has finished loading there is nothing to animate or draw:
  // skip the whole frame to keep the GPU idle in the menu.
  if (!sceneReady) return;

  // dt BEFORE elapsed: getElapsedTime() internally calls getDelta(), so
  // calling both would distort the values. I only use getDelta() and accumulate t
  const dt = clock.getDelta();
  tempo += dt;
  const t = tempo;

  // vegetation wind is only updated every N frames on weaker GPUs
  const animateVeg = (frameCount % QUALITY.vegetationAnimEvery) === 0;

  for (const f of fioriere) {
    for (const fl of f.userData.flowers) {
      fl.mesh.rotation.x = fl.baseRotX + Math.sin(t * 2 + fl.phase) * 0.12;
      fl.mesh.rotation.z = Math.cos(t * 1.5 + fl.phase) * 0.08;
    }
  }

  // rotation of the windmill blades
  if (mulino) mulino.userData.blades.rotation.z += 0.01;

  // swaying of the wheat in the wind
  if (campoGrano && animateVeg) campoGrano.userData.update(t);

  // swaying of the lavender in the wind
  if (campoLavanda && animateVeg) campoLavanda.userData.update(t);

  // pumpkins (static) and red flowers in the wind
  if (campoZucche && animateVeg) campoZucche.userData.update(t);
  if (campoFioriRossi && animateVeg) campoFioriRossi.userData.update(t);

  // pond ripples and well bucket
  if (laghetto) laghetto.userData.update(t);
  if (pozzo) pozzo.userData.update(t);

  // fountain water and spouts
  if (fontana && fontana.userData.update) fontana.userData.update(t);

  // banners in the wind
  if (stendardi) stendardi.userData.update(t);
  if (bancarelle) bancarelle.userData.update(t);

  // day/night cycle: evening falls, the lamp posts light up
  if (lampioni) lampioni.update(t, luci);

  // main character: input, movement, animation and third-person camera
  if (elf) elf.update(dt);

  // NPCs: wander, idle, proximity and interaction prompt
  if (npcManager && elf) npcManager.update(t, dt, elf.position, dialogue ? dialogue.isOpen : false);

  // herb gathering for the quest (banner + micro-card near the lake)
  if (erbe && elf) erbe.update(t, elf.position);

  // inventory: keeps item counts live while the panel is open
  if (inventory) inventory.update();

  renderer.render(scene, camera);
  perf.update();
}

animate(0);
// The scene construction no starts on its own: the menu starts it when
// the user presses PLAY
window.startGame = loadData;

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});