import * as THREE from 'three';

// ================== GESTURE LIBRARY ==================
// Code-driven animated gestures (no imported clips) for NPCs while they talk.
// Each gesture is a function of time that sets the rotations of a few bones as
// OFFSETS relative to their rest pose. They're called by name from the dialogue
// data: { gesture: 'annuisce' }
//
// Designed for the skeleton (L_Upperarm, R_Forearm, Head, Spine01...)
// If a bone is missing, the gesture skips that part without errors
//
// One-shot gestures (annuisce, scuote, saluta, ride) finish and then return to
// idle automatically; pose gestures (incrocia, mentoSulMento, spiega) stay
// until another one is requested


// AMPLITUDES / SIGNS 
const G = {
  // arm rest pose 
  // head
  nodAmp:   0.28,   // nod amplitude (head up/down)
  shakeAmp: 0.35,   // shake amplitude (head left/right)
  // arms
  waveLiftZ:  1.15, // how high the arm lifts to wave (upperarm z axis)
  waveSwing:  0.5,  // hand oscillation in the wave
  pointLift:  1.0,  // arm lift to point
  crossArm:   0.9,  // how far the arms tuck in to cross them
  chinLift:   1.3,  // arm up toward the chin (thinking)
  spreadZ:    0.7,  // lateral arm spread ("what do you want?")
  explainAmp: 0.55, // gesturing while explaining (alternating)
  explainElbow: 0.6,// elbow bend while gesturing
  laughAmp:   0.06, // torso shake in the laugh
  talkBob:    0.04, // micro-sway during the talking idle
};

// bones the gestures may touch
const BONES = [
  'Head','NeckTwist01','Spine01','Spine02','Waist',
  'L_Upperarm','R_Upperarm','L_Forearm','R_Forearm','L_Hand','R_Hand',
  'L_Thigh','R_Thigh','L_Calf','R_Calf',   // legs: used by the 'cammina' (walk) gesture
];

export function createGestureController(model, options = {}) {
  // noArms: for models whose mesh already has a fixed arm pose (e.g. crossed
  // arms or hands on hips). For these we NEVER move the arms/hands: gestures
  // that would use them fall back to head/torso only
  const noArms = !!options.noArms;
  // forwardOnly: arms can only move FORWARD, never backward
  const forwardOnly = !!options.forwardOnly;
  // armPose: name of an arm-only pose gesture (e.g. 'manoSulFianco') applied
  // ALWAYS after every gesture. The NPC keeps that arm pose whatever it says
  // (head/torso/legs remain animatable by the gestures)
  const armPose = options.armPose || null;
  // map bones + save each one's rest rotation (quaternion)
  const bone = {};
  model.traverse(o => { if (o.isBone) bone[o.name] = o; });
  const restQ = {};
  for (const n of BONES) if (bone[n]) restQ[n] = bone[n].quaternion.clone();

  // arm/hand bones: with noArms they're never moved (stay at rest)
  const ARM_BONES = new Set([
    'L_Upperarm','R_Upperarm','L_Forearm','R_Forearm','L_Hand','R_Hand',
  ]);

  const UPPERARMS = new Set(['L_Upperarm','R_Upperarm']);

  const _e = new THREE.Euler();
  const _dq = new THREE.Quaternion();
  // sets a bone to rest. Always restarts from rest
  function set(name, rx = 0, ry = 0, rz = 0) {
    const b = bone[name]; if (!b || !restQ[name]) return;
    if (noArms && ARM_BONES.has(name)) return;   // fixed arm pose: don't touch them
    // arms forward only: block the "backward" component (positive X)
    if (forwardOnly && UPPERARMS.has(name) && rx > 0) rx = 0;
    _e.set(rx, ry, rz);
    _dq.setFromEuler(_e);
    b.quaternion.copy(restQ[name]).multiply(_dq);
  }
  // resets all managed bones to the rest pose
  function reset() {
    for (const n of BONES) if (bone[n] && restQ[n]) bone[n].quaternion.copy(restQ[n]);
  }

  // gesture definitions 
  // each gesture: { loop: bool, dur: seconds (for one-shots), fn(local_t) }
  // local_t = time since the gesture started (s)
  const GESTURES = {

    // talking idle: very light head and torso sway
    idle: { loop: true, fn: (t) => {
      set('Spine01', Math.sin(t * 1.4) * 0.02, 0, 0);
      set('Head', Math.sin(t * 1.1 + 0.5) * 0.03, Math.sin(t * 0.7) * 0.04, 0);
    }},

    // nods (yes): head goes down and up a couple of times, then back to idle
    annuisce: { loop: false, dur: 1.2, fn: (t) => {
      const k = Math.sin(t * Math.PI * 3); // ~1.5 cycles
      set('Head', G.nodAmp * Math.abs(k) , 0, 0);
    }},

    // shakes the head (no): left/right rotation
    scuote: { loop: false, dur: 1.2, fn: (t) => {
      set('Head', 0, G.shakeAmp * Math.sin(t * Math.PI * 3.2), 0);
    }},

    // waves / raises an arm (right) and waves it
    saluta: { loop: false, dur: 1.6, fn: (t) => {
      const up = Math.min(1, t * 3);                 // lift quickly
      const wave = Math.sin(t * Math.PI * 4) * G.waveSwing * (t > 0.3 ? 1 : 0);
      set('R_Upperarm', 0, 0, -G.waveLiftZ * up);    // up (sign for the right side)
      set('R_Forearm', 0.3, wave, 0);
    }},

    // points (at the player): right arm extended forward
    indica: { loop: true, fn: (t) => {
      set('R_Upperarm', -G.pointLift, 0, -0.2);
      set('R_Forearm', 0.1, 0, 0);
      set('Head', 0.05, 0, 0);
    }},

    // crosses the arms (skeptical/stern): both tuck onto the chest
    incrocia: { loop: true, fn: () => {
      set('L_Upperarm', -0.55, 0,  G.crossArm);
      set('R_Upperarm', -0.55, 0, -G.crossArm);
      set('L_Forearm', 1.3, 0, 0);
      set('R_Forearm', 1.4, 0, 0);
    }},

    // hand to chin (thinking): right arm up toward the face
    rifletteMento: { loop: true, fn: (t) => {
      set('R_Upperarm', -0.6, 0, -0.5);
      set('R_Forearm', 1.9, 0, 0);
      set('Head', 0.06, Math.sin(t * 0.8) * 0.05, 0); // pensive gaze
    }},

    // spreads the arms (emphatic, "what do you want?")
    allarga: { loop: false, dur: 1.4, fn: (t) => {
      const k = Math.min(1, t * 2.5) * (t > 1.0 ? Math.max(0, 1 - (t - 1.0) * 3) : 1);
      set('L_Upperarm', -0.2, 0,  G.spreadZ * k);
      set('R_Upperarm', -0.2, 0, -G.spreadZ * k);
      set('L_Forearm', 0.3, 0, 0);
      set('R_Forearm', 0.3, 0, 0);
    }},

    // gestures while explaining: arms move alternately, elbows bent, with a
    // slight head accompaniment. Loops (lasts as long as the line)
    spiega: { loop: true, fn: (t) => {
      const p = t * 3.2;                       // gesturing cadence
      const a = Math.sin(p);
      const b = Math.sin(p + Math.PI);         // opposite arm in counter-phase
      // raise both arms midway and move them alternately
      set('L_Upperarm', -0.7 + a * G.explainAmp, 0,  0.25);
      set('R_Upperarm', -0.7 + b * G.explainAmp, 0, -0.25);
      // bent elbows "punctuating" the speech
      set('L_Forearm', G.explainElbow + Math.max(0, a) * 0.4, 0, 0);
      set('R_Forearm', G.explainElbow + Math.max(0, b) * 0.4, 0, 0);
      // head slightly following along
      set('Head', Math.sin(p * 0.5) * 0.04, Math.sin(p * 0.33) * 0.05, 0);
    }},

    // laughs: rhythmic torso shake + head back, then returns
    ride: { loop: false, dur: 1.8, fn: (t) => {
      const sh = Math.sin(t * Math.PI * 8) * G.laughAmp;
      set('Spine01', -0.06 + sh, 0, 0);
      set('Head', -0.12, 0, sh * 2);
    }},

    // hand on hip (one, right): calm static pose
    // The upperarm opens a little and the elbow bends bringing the hand to the hip
    manoSulFianco: { loop: true, fn: (t) => {
      set('R_Upperarm', 0.15, 0, -0.35);   // arm slightly open/forward
      set('R_Forearm', 1.5, 0.3, 0);       // elbow bent, hand toward the hip
      set('Head', Math.sin(t * 0.8) * 0.04, Math.sin(t * 0.5) * 0.05, 0);
    }},

    // walk: step cycle (legs in opposition + arms in counter-phase)
    // Used by NPCs that wander the village. Loops
    cammina: { loop: true, fn: (t) => {
      const p = t * 6.0;                 // step cadence
      const sw = 0.55;                   // leg swing amplitude
      set('L_Thigh',  Math.sin(p) * sw, 0, 0);
      set('R_Thigh', -Math.sin(p) * sw, 0, 0);
      set('L_Calf', -Math.max(0,  Math.sin(p)) * 0.7, 0, 0);
      set('R_Calf', -Math.max(0, -Math.sin(p)) * 0.7, 0, 0);
      // arms in counter-phase
      set('L_Upperarm', -Math.sin(p) * 0.35, 0, 0);
      set('R_Upperarm',  Math.sin(p) * 0.35, 0, 0);
      set('Waist', 0, Math.sin(p) * 0.06, 0);
    }},

  };

  let currentName = 'idle';
  let startT = 0;
  let started = false;

  return {
    // start a gesture by name. One-shots return to idle when their duration ends
    play(name, t) {
      if (!GESTURES[name]) { name = 'idle'; }
      currentName = name;
      startT = (t != null ? t : startT);
      started = false; // will be initialized on the first update with real t
    },
    update(t) {
      if (!started) { startT = t; started = true; }
      const g = GESTURES[currentName] || GESTURES.idle;
      const local = t - startT;
      reset();                       // restart from the rest pose each frame
      g.fn(local);
      // fixed arm pose (e.g. Granny Edda's hand on hip): overrides the arms
      // after the gesture, leaving head/torso/legs intact
      if (armPose && GESTURES[armPose]) GESTURES[armPose].fn(local);
      // finished one-shots return to idle automatically
      if (!g.loop && local >= (g.dur || 1.0)) {
        currentName = 'idle';
        startT = t;
      }
    },
    // debug
    has: (name) => !!GESTURES[name],
    list: () => Object.keys(GESTURES),
  };
}
