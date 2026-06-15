import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrainHeight.js';
import { createGestureController } from './gestures.js';

// ================== NPC MANAGER ==================
// Loads the NPC GLB models, places them in the village, gives them a light
// procedural idle animation (breathing) and handles proximity detection with
// the player: when the character enters an NPC's radius, it shows a
// "Press E to talk" prompt. Pressing E calls onInteract(id).
//
// The animations are procedural (written in JS): no imported clips
//


const INTERACT_RADIUS = 6;     // distance within which you can interact
const MODEL_YAW_OFFSET = -Math.PI / 2; // like the elf

export async function createNPCManager(scene, configs, callbacks = {}) {
  const { onInteract, staticCollide } = callbacks;
  // staticCollide(x,z)->{x,z}: optional, keeps wanderers from passing through
  // walls/buildings/trees. Set by main2 after building the collisions
  let collide = staticCollide || null;
  const loader = new GLTFLoader();
  const npcs = [];

  // interaction prompt (HTML overlay)
  const prompt = document.createElement('div');
  prompt.id = 'interact-prompt';
  prompt.style.cssText = `
    position:fixed; left:50%; bottom:14%; transform:translateX(-50%); z-index:40;
    font-family: Georgia, serif; color:#f3e7c8; display:none;
    background:rgba(24,16,9,.85); border:1px solid #b8945f; border-radius:20px;
    padding:8px 18px; font-size:15px; box-shadow:0 4px 14px rgba(0,0,0,.5);`;
  document.body.appendChild(prompt);

  // load and place each NPC 
  for (const cfg of configs) {
    try {
      const gltf = await new Promise((res, rej) =>
        loader.load(cfg.path, res, undefined, rej));
      const model = gltf.scene;

      // The models (like the elf) come out normalized ~1.0 tall with the pivot
      // at the feet, so we scale by the direct factor, identical to the player
      // (ELF_HEIGHT = 3.4)
      const scale = cfg.scale ?? 3.4;   // default = same scale as the warrior
      model.scale.setScalar(scale);

      model.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow = true; o.receiveShadow = true;
          o.frustumCulled = false;
        }
      });

      const root = new THREE.Group();
      root.add(model);
      root.position.set(cfg.x, getTerrainHeight(cfg.x, cfg.z), cfg.z);
      root.rotation.y = (cfg.rotationY ?? 0) + MODEL_YAW_OFFSET;
      scene.add(root);

      // gesture controller (procedural animation in code)
      //   noArms      -> mesh with a fixed arm pose: never move them
      //   forwardOnly -> arms can only move forward
      //   armPose     -> fixed arm pose (e.g. 'manoSulFianco')
      const gestures = createGestureController(model, {
        noArms: !!cfg.noArms,
        forwardOnly: !!cfg.forwardOnly,
        armPose: cfg.armPose || null,
      });

      npcs.push({
        id: cfg.id, root, model, gestures,
        // wander: some NPCs roam within a radius from their "home" 
        wander: !!cfg.wander,
        homeX: cfg.x, homeZ: cfg.z,              // center of the wander area
        wanderRadius: cfg.wanderRadius ?? 8,     // how far from home they go
        speed: cfg.wanderSpeed ?? 2.2,           // walking speed
        baseYaw: (cfg.rotationY ?? 0),           // "at rest" orientation
        targetX: cfg.x, targetZ: cfg.z,          // current goal
        waitT: Math.random() * 3,                // pause between moves
        moving: false,
        talking: false,
        currentGesture: 'idle',
        // fixedRotation: the NPC NEVER turns toward the player (stays in its
        // starting pose). Useful for seated models / on a chair, where rotating
        // the character would also rotate the chair
        fixedRotation: !!cfg.fixedRotation,
      });
    } catch (err) {
      console.warn('NPC not loaded:', cfg.path, err);
    }
  }

  let nearest = null;       // NPC currently within the interaction radius
  let talkingId = null;     // NPC being talked to (stays still + dialogue gestures)

  // E key handling
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && nearest && onInteract) {
      onInteract(nearest.id);
    }
  });

  const _v = new THREE.Vector3();

  function update(t, dt, playerPos, dialogueOpen) {
    dt = Math.min(dt || 0, 0.05);

    // who is "frozen" (not wandering): whoever talks or has the player near 
    // nearest is computed below, but we use last frame's value to decide this
    //  frame's movement: the 1-frame latency is invisible
    for (const npc of npcs) {
      const isTalking = (npc.id === talkingId);
      const isNear = (npc === nearest);
      const frozen = isTalking || isNear || dialogueOpen;

      if (npc.wander && !frozen) {
        // wander: if no goal or arrived, pick a new point after a pause
        const dx = npc.targetX - npc.root.position.x;
        const dz = npc.targetZ - npc.root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          npc.moving = false;
          npc.waitT -= dt;
          if (npc.waitT <= 0) {
            // new random goal within the radius from "home"
            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * npc.wanderRadius;
            npc.targetX = npc.homeX + Math.cos(ang) * r;
            npc.targetZ = npc.homeZ + Math.sin(ang) * r;
            npc.waitT = 1.5 + Math.random() * 3;   // next pause
          }
        } else {
          // move toward the goal and orient the body
          const ux = dx / dist, uz = dz / dist;
          let nx = npc.root.position.x + ux * npc.speed * dt;
          let nz = npc.root.position.z + uz * npc.speed * dt;
          // avoid walls/buildings/trees (static obstacles)
          if (collide) { const c = collide(nx, nz); nx = c.x; nz = c.z; }
          npc.root.position.x = nx;
          npc.root.position.z = nz;
          npc.root.position.y = getTerrainHeight(nx, nz);
          npc.root.rotation.y = Math.atan2(ux, uz) + MODEL_YAW_OFFSET;
          npc.moving = true;
        }
        // gesture consistent with the movement (only if not talking)
        const want = npc.moving ? 'cammina' : 'idle';
        if (npc.currentGesture !== want) { npc.gestures.play(want, t); npc.currentGesture = want; }
      } else if (npc.wander && frozen && npc.moving) {
        // just stopped (player near or dialogue): back to idle
        npc.moving = false;
        if (npc.currentGesture !== 'idle' && !isTalking) {
          npc.gestures.play('idle', t); npc.currentGesture = 'idle';
        }
      }

      // update the animation (current gesture / dialogue / walk / idle)
      npc.gestures.update(t);
    }

    // proximity: find the nearest NPC within the radius 
    if (dialogueOpen) { prompt.style.display = 'none'; nearest = null; return; }
    let best = null, bestD2 = INTERACT_RADIUS * INTERACT_RADIUS;
    for (const npc of npcs) {
      const dx = npc.root.position.x - playerPos.x;
      const dz = npc.root.position.z - playerPos.z;
      const d2 = dx*dx + dz*dz;
      if (d2 < bestD2) { bestD2 = d2; best = npc; }
    }
    nearest = best;
    if (best) {
      prompt.style.display = 'block';
      prompt.textContent = 'Press  E  to talk';
      // the nearby NPC turns toward the player, unless it's "fixed"
      // (e.g. seated on a chair: rotating it would also turn the chair)
      if (!best.fixedRotation) {
        const ang = Math.atan2(playerPos.x - best.root.position.x,
                               playerPos.z - best.root.position.z);
        best.root.rotation.y = ang + MODEL_YAW_OFFSET;
      }
    } else {
      prompt.style.display = 'none';
    }
  }

  return {
    update,
    npcs,
    getNPC: (id) => npcs.find(n => n.id === id) || null,
    // set (after creation) the resolver that makes wanderers avoid obstacles
    setStaticCollider(fn) { collide = fn; },
    // makes an NPC perform a gesture (called by the dialogue system)
    // Marks/unmarks the NPC as "talking" so the wander doesn't move it and
    // doesn't overwrite the dialogue gestures
    playGesture(id, name, t) {
      const npc = npcs.find(n => n.id === id);
      if (!npc) return;
      talkingId = (name === 'idle') ? null : id;  // idle (closing) = free
      npc.currentGesture = name;
      npc.gestures.play(name, t);
    },
  };
}
