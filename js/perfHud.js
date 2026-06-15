// ================== PERFORMANCE HUD ==================
import { QUALITY } from './qualitySettings.js';

export function createPerfHUD(renderer, scene) {
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
    } else if (e.code === 'KeyO') {
      printTriangleBreakdown(scene);
    }
  });

  // Counts triangles of a single geometry (indexed or not).
  function geoTris(geo) {
    if (!geo || !geo.attributes || !geo.attributes.position) return 0;
    return geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
  }

  // Walks the scene and prints a table sorted by TOTAL triangles drawn,
  // accounting for InstancedMesh instance counts. Groups identical meshes by
  // a label so trees/grass don't flood the list with thousands of rows.
  function printTriangleBreakdown(root) {
    if (!root) { console.warn('[perf] no scene given to perfHUD'); return; }
    const agg = new Map();   // label -> { tris, count, draws }

    root.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) return;
      const tris = geoTris(o.geometry);
      if (tris === 0) return;
      const instances = o.isInstancedMesh ? (o.count || 0) : 1;
      const total = tris * instances;
      // build a readable label: prefer the object/material name, else geometry type
      const matName = Array.isArray(o.material)
        ? o.material.map(m => m && m.name).filter(Boolean).join('+')
        : (o.material && o.material.name);
      const label = (o.name || matName || o.geometry.type || 'mesh')
        + (o.isInstancedMesh ? ' [instanced]' : '');
      const prev = agg.get(label) || { tris: 0, count: 0, draws: 0 };
      prev.tris  += total;
      prev.count += instances;
      prev.draws += 1;
      agg.set(label, prev);
    });

    const rows = [...agg.entries()]
      .map(([label, v]) => ({
        label,
        triangles: Math.round(v.tris),
        instances: v.count,
        drawObjects: v.draws,
      }))
      .sort((a, b) => b.triangles - a.triangles);

    const grand = rows.reduce((s, r) => s + r.triangles, 0);
    console.log(`%c[perf] triangle breakdown — total ${grand.toLocaleString()} tris across ${rows.length} groups`,
      'color:#9effa0;font-weight:bold');
    console.table(rows.slice(0, 25));   // top 25 heaviest
  }

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