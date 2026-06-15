import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrainHeight.js';

// ================== ELF WARRIOR (main character) ==================
// Loads elf_warrior.glb (a skinned mesh, 41 bones, NO imported clips) and
// animates it ENTIRELY in code:
//   - rest pose with soft arms along the sides (corrected from the bind T-pose)
//   - procedural walk cycle (legs + arms in counter-phase + bob)
//   - jump with arc and landing
//   - body turning toward the direction of travel
// Controls: WASD to move, SPACE to jump.
// Camera: third-person, follows behind, orbitable with the mouse.

// NOTE: this controller takes over the camera, so do NOT also use OrbitControls
// on the same camera

const MODEL_PATH = './characters/elf_warrior.glb';

// Desired real height of the character in world units. The model comes out
// 1.0 tall (pivot at the feet, y 0->1), so scale = ELF_HEIGHT
const ELF_HEIGHT = 3.4;

// Movement parameters 
const WALK_SPEED   = 12;     // units/second
const RUN_SPEED    = 20;     // with Shift
const TURN_LERP    = 12;     // how fast the body orients (higher = snappier)
const GRAVITY      = -55;    // fall acceleration
const JUMP_SPEED   = 20;     // initial vertical jump speed

// Model orientation offset: This offset aligns the character's front with the
// motion WITHOUT touching movement or camera
const MODEL_YAW_OFFSET = -Math.PI / 2;

// Third-person camera 
const CAM_DIST   = 14;       // distance behind the character
const CAM_HEIGHT = 7;        // camera height above the feet
const CAM_LOOK_H = 3.2;      // height it looks at (about the chest)
const CAM_LERP   = 6;        // follow smoothing

// Pose amplitudes (radians). These are additive OFFSETS relative to each
// bone's rest rotation
const POSE = {
  // the arms are already modeled along the sides in
  // the rest pose. So we leave them at rest and
  // only apply the swing during the walk
  armDownL: 0,
  armDownR: 0,
  // slight forward/back rotation so the arms don't stick to the torso
  armTuckL: 0.12,
  armTuckR: 0.12,
  // elbow flex at rest (arms never fully straight)
  elbowRest: 0.28,
  // arm swing during the walk (around the lowered pose)
  armSwing: 0.5,
  // leg (hip) swing during the walk
  legSwing: 0.7,
  // knee bend during the step's recovery phase
  kneeBend: 0.9,
  // vertical body bob each step
  bob: 0.06,
};

function makeRng() { let s = 1337; return () => (s = (s*1664525+1013904223)>>>0)/4294967296; }

export async function createElfWarrior(scene, camera, domElement) {
  // LOADING 
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) =>
    loader.load(MODEL_PATH, res, undefined, rej));

  const model = gltf.scene;
  model.scale.setScalar(ELF_HEIGHT);
  model.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // skinned: the static bounding box fools culling
    }
  });

  // Container: the root we move/rotate in the world. The mesh lives inside it so
  // rotating the character doesn't touch the bone hierarchy
  const root = new THREE.Group();
  root.add(model);
  scene.add(root);

  // BONE MAP 
  const bone = {};
  model.traverse(o => { if (o.isBone) bone[o.name] = o; });

  // Save each animated bone's rest (bind) rotation as the starting quaternion we
  // apply the pose offsets onto
  const restQ = {};
  const animatedBones = [
    'L_Upperarm','R_Upperarm','L_Forearm','R_Forearm',
    'L_Thigh','R_Thigh','L_Calf','R_Calf','Spine01','Spine02','Waist',
  ];
  for (const n of animatedBones) {
    if (bone[n]) restQ[n] = bone[n].quaternion.clone();
  }

  // Helper: set a bone to rest * a delta given as local angles (x,y,z). ALWAYS
  // restarts from rest, so poses don't accumulate between frames
  const _e = new THREE.Euler();
  const _dq = new THREE.Quaternion();
  function setBone(name, rx = 0, ry = 0, rz = 0) {
    const b = bone[name]; if (!b || !restQ[name]) return;
    _e.set(rx, ry, rz);
    _dq.setFromEuler(_e);
    b.quaternion.copy(restQ[name]).multiply(_dq);
  }

  // STATE 
  const state = {
    pos: new THREE.Vector3(0, getTerrainHeight(0, 0), 8), // initial position
    heading: Math.PI,        // facing direction (rad), 0 = +Z
    velY: 0,                  // vertical velocity (jump/fall)
    grounded: true,
    moving: false,
    speed: 0,
    walkPhase: 0,             // walk cycle phase
    inputEnabled: true,       // false during dialogues: the character stays put
    collide: null,            // collision resolver: (x,z,prevX,prevZ)=>{x,z}
  };
  root.position.copy(state.pos);
  root.rotation.y = state.heading + MODEL_YAW_OFFSET;

  // INPUT (WASD + Space + Shift) 
  const keys = Object.create(null);
  const onKey = (e, down) => {
    const k = e.code;
    if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight',
         'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)) {
      keys[k] = down;
      if (k === 'Space') e.preventDefault();
    }
  };
  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup',   e => onKey(e, false));

  // CAMERA ORBIT (mouse)
  // The mouse rotates the camera AROUND the character (yaw/pitch); the camera
  // then follows from that angle. The camera rotation also defines the "forward"
  // direction of movement 
  let camYaw = state.heading;   // camera horizontal angle
  let camPitch = 0.32;          // camera vertical angle (rad)
  let dragging = false, lastX = 0, lastY = 0;

  domElement.addEventListener('mousedown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    camYaw   -= dx * 0.005;
    camPitch += dy * 0.005;
    camPitch = THREE.MathUtils.clamp(camPitch, -0.2, 1.1);
  });
  // wheel zoom
  let camDist = CAM_DIST;
  domElement.addEventListener('wheel', e => {
    camDist = THREE.MathUtils.clamp(camDist + Math.sign(e.deltaY) * 1.5, 6, 30);
    e.preventDefault();
  }, { passive: false });

  // REST POSE (soft arms along the sides) 
  function applyRestPose() {
    setBone('L_Upperarm', 0, 0, POSE.armDownL);
    setBone('R_Upperarm', 0, 0, POSE.armDownR);
    setBone('L_Forearm', POSE.elbowRest, 0, 0);
    setBone('R_Forearm', POSE.elbowRest, 0, 0);
  }
  applyRestPose();

  // WORK VECTORS 
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();

  //UPDATE (called every frame)
  function update(dt) {
    dt = Math.min(dt, 0.05); // clamp to avoid jumps after a freeze

    // input direction relative to the camera 
    // If input is disabled (e.g. dialogue open), the character stays put: we
    // ignore movement and jump keys, but camera and idle keep going
    const inputOn = state.inputEnabled;
    const f = inputOn ? ((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0)) : 0;
    const s = inputOn ? ((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)) : 0;

    // forward/right on the XZ plane, derived from the camera yaw
    // right uses (yaw - 90°) so A=left and D=right relative to the view
    fwd.set(Math.sin(camYaw), 0, Math.cos(camYaw));
    right.set(Math.sin(camYaw - Math.PI / 2), 0, Math.cos(camYaw - Math.PI / 2));

    move.set(0, 0, 0);
    state.moving = (f !== 0 || s !== 0) && state.grounded || (f !== 0 || s !== 0);
    if (f !== 0 || s !== 0) {
      move.addScaledVector(fwd, f).addScaledVector(right, s);
      if (move.lengthSq() > 0) move.normalize();
      state.moving = true;
      const running = keys.ShiftLeft || keys.ShiftRight;
      state.speed = running ? RUN_SPEED : WALK_SPEED;

      // turn the body toward the travel direction (interpolated)
      const targetHeading = Math.atan2(move.x, move.z);
      let dH = targetHeading - state.heading;
      dH = Math.atan2(Math.sin(dH), Math.cos(dH)); // normalize to [-pi,pi]
      state.heading += dH * Math.min(1, TURN_LERP * dt);

      // advance
      const prevX = state.pos.x, prevZ = state.pos.z;
      state.pos.addScaledVector(move, state.speed * dt);

      // collisions: if a resolver is set, correct the XZ position so we don't
      // penetrate obstacles (walls, buildings, trees, NPCs, ...)
      if (state.collide) {
        const corrected = state.collide(state.pos.x, state.pos.z, prevX, prevZ);
        state.pos.x = corrected.x;
        state.pos.z = corrected.z;
      }
    } else {
      state.moving = false;
      state.speed = 0;
    }

    // jump / gravity 
    if (inputOn && keys.Space && state.grounded) {
      state.velY = JUMP_SPEED;
      state.grounded = false;
    }
    const groundY = getTerrainHeight(state.pos.x, state.pos.z);
    if (!state.grounded) {
      state.velY += GRAVITY * dt;
      state.pos.y += state.velY * dt;
      if (state.pos.y <= groundY) {
        state.pos.y = groundY;
        state.velY = 0;
        state.grounded = true;
      }
    } else {
      state.pos.y = groundY;
    }

    // apply position/rotation to the root 
    root.position.copy(state.pos);
    root.rotation.y = state.heading + MODEL_YAW_OFFSET;

    // PROCEDURAL ANIMATION 
    applyRestPose(); // always restart from the arms-down pose

    if (!state.grounded) {
      // jump pose: legs tucked, arms a touch open
      const up = state.velY > 0;
      setBone('L_Thigh', up ? -0.5 : 0.3, 0, 0);
      setBone('R_Thigh', up ? -0.4 : 0.2, 0, 0);
      setBone('L_Calf',  up ? -0.9 : -0.2, 0, 0);
      setBone('R_Calf',  up ? -0.7 : -0.15, 0, 0);
      setBone('L_Upperarm', 0, 0, POSE.armDownL + 0.5);
      setBone('R_Upperarm', 0, 0, POSE.armDownR - 0.5);
    } else if (state.moving) {
      // walk cycle: advance the phase based on speed
      const cadence = state.speed * 0.9;
      state.walkPhase += cadence * dt;
      const p = state.walkPhase;
      const sw = POSE.legSwing * (state.speed > WALK_SPEED ? 1.25 : 1);

      // legs in phase opposition
      setBone('L_Thigh',  Math.sin(p) * sw, 0, 0);
      setBone('R_Thigh', -Math.sin(p) * sw, 0, 0);
      // knees: flex backward (negative sign) during the step's recovery, in
      // phase with the swing of the respective thigh
      setBone('L_Calf', -Math.max(0,  Math.sin(p)) * POSE.kneeBend, 0, 0);
      setBone('R_Calf', -Math.max(0, -Math.sin(p)) * POSE.kneeBend, 0, 0);

      // arms in counter-phase to the legs (around the lowered pose)
      setBone('L_Upperarm', -Math.sin(p) * POSE.armSwing, 0, POSE.armDownL);
      setBone('R_Upperarm',  Math.sin(p) * POSE.armSwing, 0, POSE.armDownR);
      setBone('L_Forearm', POSE.elbowRest + Math.max(0, -Math.sin(p)) * 0.3, 0, 0);
      setBone('R_Forearm', POSE.elbowRest + Math.max(0,  Math.sin(p)) * 0.3, 0, 0);

      // slight torso twist and vertical bob
      setBone('Waist', 0, Math.sin(p) * 0.08, 0);
      model.position.y = Math.abs(Math.sin(p)) * POSE.bob;
    } else {
      // idle: slow breathing, soft arms at rest
      const t = performance.now() * 0.001;
      const breathe = Math.sin(t * 1.5) * 0.5 + 0.5;
      setBone('Spine01', breathe * 0.02, 0, 0);
      setBone('L_Upperarm', breathe * 0.03, 0, POSE.armDownL);
      setBone('R_Upperarm', breathe * 0.03, 0, POSE.armDownR);
      model.position.y = 0;
    }

    // THIRD-PERSON CAMERA 
    // desired position: behind the character per the camera yaw/pitch
    const horiz = Math.cos(camPitch) * camDist;
    desiredCam.set(
      state.pos.x - Math.sin(camYaw) * horiz,
      state.pos.y + CAM_HEIGHT + Math.sin(camPitch) * camDist,
      state.pos.z - Math.cos(camYaw) * horiz
    );
    camPos.copy(camera.position).lerp(desiredCam, Math.min(1, CAM_LERP * dt));
    camera.position.copy(camPos);

    lookAt.set(state.pos.x, state.pos.y + CAM_LOOK_H, state.pos.z);
    camera.lookAt(lookAt);
  }

  return {
    root,
    model,
    bones: bone,
    update,
    // useful for debugging/tuning the poses from the console
    POSE,
    get position() { return state.pos; },
    setInputEnabled(v) { state.inputEnabled = !!v; },
    setCollider(fn) { state.collide = fn; },
  };
}
