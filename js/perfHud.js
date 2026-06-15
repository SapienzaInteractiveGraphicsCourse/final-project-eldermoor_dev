// ================== PERFORMANCE HUD ==================
// Lightweight on-screen diagnostics: FPS, draw calls, triangles, geometries,
// textures and the active quality tier. Toggle with the 'P' key.
//
// USAGE (in main2.js):
//   import { createPerfHUD } from './js/perfHud.js';
//   const perf = createPerfHUD(renderer, QUALITY);   // after renderer exists
//   ...in the loop, once per frame:  perf.update();
//
// It reads renderer.info, which three.js already tracks, so the cost is just
// updating a small DOM element a few times per second (not every frame).

import { QUALITY } from './qualitySettings.js';

export function createPerfHUD(renderer) {
  const el = document.createElement('div');
  el.id = 'perf-hud';
  el.style.cssText = `
    position:fixed; top:8px; left:8px; z-index:9999;
    font-family: monospace; font-size:12px; line-height:1.5;
    color:#9effa0; background:rgba(0,0,0,.72);
    padding:8px 12px; border-radius:8px; border:1px solid #2a5a2a;
    white-space:pre; pointer-events:none; display:none;`;
  document.body.appendChild(el);

  let visible = false;
  let frames = 0;
  let lastSample = performance.now();
  let fps = 0;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') {
      visible = !visible;
      el.style.display = visible ? 'block' : 'none';
    }
  });

  return {
    el,
    // call once per rendered frame
    update() {
      frames++;
      const now = performance.now();
      const dt = now - lastSample;
      // refresh the readout ~4 times per second (cheap)
      if (dt >= 250) {
        fps = Math.round((frames * 1000) / dt);
        frames = 0;
        lastSample = now;
        if (visible) {
          const info = renderer.info;
          el.textContent =
            `FPS:        ${fps}\n` +
            `tier:       ${QUALITY.tier}\n` +
            `draw calls: ${info.render.calls}\n` +
            `triangles:  ${info.render.triangles.toLocaleString()}\n` +
            `geometries: ${info.memory.geometries}\n` +
            `textures:   ${info.memory.textures}\n` +
            `fps cap:    ${QUALITY.fpsCap || 'off'}`;
        }
      }
    },
  };
}
