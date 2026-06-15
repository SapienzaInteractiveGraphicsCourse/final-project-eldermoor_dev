import * as THREE from 'three';

// ================== PLAYER COLLISION ==================
// Builds a collision resolver only for the main character (the elf the player
// controls). NPCs are not affected: they keep using their own (lighter) static
// collider in npcManager. The resolver here is passed to elf.setCollider(fn)
//
// Design: everything is modelled as a circle on the XZ plane (center + radius)
//   - static obstacles: buildings (auto-detected from the scene), plus the
//     hand-placed structures (windmill, well, fountain, stalls, planters)
//   - the city wall: kept as a "stay inside" ring with a gap for the south gate
//   - NPCs: read LIVE every frame (so it also works for the ones that wander)
//
// The lake/pond DOES block the player
//


export function createPlayerCollision(scene, opts = {}) {
  const PLAYER_R = opts.player?.radius ?? 1.2;     // body radius of the elf
  const npcManager = opts.npcManager || null;
  const NPC_R = opts.npcRadius ?? 1.1;             // body radius of each NPC

  // ELLIPTICAL obstacles (the lake is an ellipse) 
  // Each: { x, z, rx, rz }. Coordinates mirror main2.js: createPond(88,-34,16,18)
  const ellipses = [
    { x: 88, z: -34, rx: 16, rz: 18 },   // lake / pond
  ];
  if (Array.isArray(opts.extraEllipses)) {
    for (const e of opts.extraEllipses) ellipses.push(e);
  }

  // ORIENTED RECTANGLE obstacles 
  // Each: { x, z, w, d, rot }. rot = group.rotation.y used in main2.js
  // w runs along the stall's local X, d along its local Z (matches makeStall)
  const STALL_W = 6.0, STALL_D = 1.9;
  const rects = [
    { x: 28,   z: 86,   w: STALL_W, d: STALL_D, rot: -Math.PI / 2 },
    { x: 28,   z: 98,   w: STALL_W, d: STALL_D, rot: -Math.PI / 2 },
    { x: 72.0, z: 62.0, w: STALL_W, d: STALL_D, rot: -1.57 },
    { x: 66.2, z: 52.9, w: STALL_W, d: STALL_D, rot: -0.44 },
    { x: 66.2, z: 71.1, w: STALL_W, d: STALL_D, rot: -2.71 },
    // gate side walls + central opening: three rectangles that together make
    // the whole gate solid 
    // Local box is WALL_THICK along local X, length along local Z, rotated by
    // the gate angle (PI/2)
    { x: -9.9, z: 108.33, w: 1.5, d: 11.8, rot: Math.PI / 2 },
    { x: 9.9,  z: 108.33, w: 1.5, d: 11.8, rot: Math.PI / 2 },
    { x: 0, z: 108.33, w: 1.5, d: 8.0, rot: Math.PI / 2 },
  ];
  if (Array.isArray(opts.extraRects)) {
    for (const r of opts.extraRects) rects.push(r);
  }

  // STATIC obstacle circles 
  const staticCircles = [
    // fountain (center of the square)            x=0,  z=30
    { x: 0,   z: 30,  r: 5.0 },
    // the four planters around the fountain (x=0, z=30, D=10.5)
    { x: 0,   z: 19.5, r: 1.6 },
    { x: 0,   z: 40.5, r: 1.6 },
    { x: 10.5, z: 30,  r: 1.6 },
    { x: -10.5, z: 30, r: 1.6 },
    // windmill                                   x=20, z=-80
    { x: 20,  z: -80, r: 6.0 },
    // well                                       x=45, z=-55
    { x: 45,  z: -55, r: 2.2 },
    // (stalls are handled as oriented rectangles below, not circles)
    // round flowerbeds near the banners (radius 4.5 + brick rim)
    { x: -13, z: 92, r: 4.9 },
    { x: 13,  z: 92, r: 4.9 },
    // gate towers (the two big cylinders flanking the gate), r=3.3
    { x: -19.1, z: 108.33, r: 3.6 },
    { x: 19.1,  z: 108.33, r: 3.6 },
  ];

  // Auto-detect BUILDINGS from the scene: createBuildings tags each building
  // group with userData.isBuilding + userData.collide ({x,z,r}) computed from
  // its XZ bounding box. We just collect those circles
  scene.traverse((o) => {
    if (o.userData && o.userData.isBuilding && o.userData.collide) {
      staticCircles.push(o.userData.collide);
    }
  });

  // any extra manual circles
  if (Array.isArray(opts.extraObstacles)) {
    for (const c of opts.extraObstacles) staticCircles.push(c);
  }

  // CITY WALL ring (keep the player inside)
  // Recreates the same variable-radius ring used in walls.js so the boundary
  // matches the actual walls. The player is pushed back in if it goes past it
  const WALL_BASE_R = 110;
  const WALL_MARGIN = 2.0;   // keep a little clearance from the wall thickness
  function wallRadiusAtDeg(deg) {
    const neDeg = 45;
    const neWeight = Math.max(0, 1 - Math.abs(deg - neDeg) / 70);
    const westWeight = Math.max(0, 1 - Math.abs(deg - (-90)) / 60);
    return WALL_BASE_R + neWeight * 50 - westWeight * 40;
  }

  // there is no open gap to walk through
  function isGateDirection(deg) {
    return false;   // gate sealed: no perimeter opening
  }

  // resolver: called by the elf each frame as (x, z, prevX, prevZ)
  function resolve(x, z, prevX, prevZ) {
    let nx = x, nz = z;

    // keep inside the walls 
    {
      const r = Math.hypot(nx, nz);
      // bearing in the same convention as walls.js: x=sin(rad), z=-cos(rad)
      const deg = Math.atan2(nx, -nz) * 180 / Math.PI;
      if (!isGateDirection(deg)) {
        const limit = wallRadiusAtDeg(deg) - WALL_MARGIN - PLAYER_R;
        if (r > limit && r > 0.0001) {
          const k = limit / r;
          nx *= k; nz *= k;
        }
      }
    }

    //push out of every static circle
    for (const c of staticCircles) {
      const dx = nx - c.x, dz = nz - c.z;
      const minD = c.r + PLAYER_R;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2);
        if (d < 0.0001) {
          // exactly at center: pick the previous-position direction, else +Z
          let bx = (prevX ?? nx) - c.x, bz = (prevZ ?? nz) - c.z;
          const bl = Math.hypot(bx, bz);
          if (bl < 0.0001) { bx = 0; bz = 1; }
          else { bx /= bl; bz /= bl; }
          nx = c.x + bx * minD;
          nz = c.z + bz * minD;
        } else {
          const k = minD / d;
          nx = c.x + dx * k;
          nz = c.z + dz * k;
        }
      }
    }

    // push out of oriented rectangles (stalls)
    for (const rc of rects) {
      // transform point into the rectangle's local frame
      const cos = Math.cos(-rc.rot), sin = Math.sin(-rc.rot);
      const px = nx - rc.x, pz = nz - rc.z;
      const lx = px * cos - pz * sin;
      const lz = px * sin + pz * cos;
      // half extents expanded by the player radius
      const hx = rc.w / 2 + PLAYER_R;
      const hz = rc.d / 2 + PLAYER_R;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
        // inside: push out along the axis of least penetration
        const ox = hx - Math.abs(lx);
        const oz = hz - Math.abs(lz);
        let nlx = lx, nlz = lz;
        if (ox < oz) nlx = (lx < 0 ? -hx : hx);
        else         nlz = (lz < 0 ? -hz : hz);
        // back to world space (inverse rotation)
        const icos = Math.cos(rc.rot), isin = Math.sin(rc.rot);
        nx = rc.x + (nlx * icos - nlz * isin);
        nz = rc.z + (nlx * isin + nlz * icos);
      }
    }

    // push out of elliptical obstacles (the lake)
    for (const e of ellipses) {
      // expand the ellipse by the player radius (approximate, good enough)
      const erx = e.rx + PLAYER_R;
      const erz = e.rz + PLAYER_R;
      const dx = nx - e.x, dz = nz - e.z;
      const nrm = (dx * dx) / (erx * erx) + (dz * dz) / (erz * erz);
      if (nrm < 1 && nrm > 0.0001) {
        // push the point out to the ellipse edge along the same direction
        const k = 1 / Math.sqrt(nrm);
        nx = e.x + dx * k;
        nz = e.z + dz * k;
      }
    }

    // push out of NPC circles (read live)
    if (npcManager && npcManager.npcs) {
      for (const npc of npcManager.npcs) {
        const p = npc.root.position;
        const dx = nx - p.x, dz = nz - p.z;
        const minD = NPC_R + PLAYER_R;
        const d2 = dx * dx + dz * dz;
        if (d2 < minD * minD) {
          const d = Math.sqrt(d2) || 0.0001;
          const k = minD / d;
          nx = p.x + dx * k;
          nz = p.z + dz * k;
        }
      }
    }

    return { x: nx, z: nz };
  }

  return {
    resolve,
    staticCircles,                       // exposed for debugging
    addObstacle: (c) => staticCircles.push(c),
  };
}