// ================== PERF TOGGLES (diagnostic) ==================
// Runtime switches to find what limits the framerate. Watch FPS (key 'P')
// while toggling each one:
//   T - cheap water (removes transmission/clearcoat refraction pass)
//   L - shadows on/off (renderer.shadowMap.enabled)
//   K - force pixelRatio 1 (tests fill-rate / resolution cost)
//   J - hide the pond entirely (tests the whole pond cost)
//
// A big FPS jump when toggling one of these = that's your bottleneck.
// This is a TEMPORARY diagnostic helper; remove it once you've decided.

export function createPerfToggles(renderer, scene, getRefs) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed; bottom:8px; left:8px; z-index:9999;
    font-family:monospace; font-size:12px; line-height:1.5;
    color:#ffd479; background:rgba(0,0,0,.75); padding:6px 10px;
    border-radius:8px; border:1px solid #5a4a2a; white-space:pre; pointer-events:none;`;
  document.body.appendChild(banner);

  const state = { cheapWater: false, shadows: true, lowRes: false, hidePond: false };

  function refresh() {
    banner.textContent =
      `[T] cheap water: ${state.cheapWater ? 'ON' : 'off'}\n` +
      `[L] shadows:     ${state.shadows ? 'ON' : 'off'}\n` +
      `[K] pixelRatio1: ${state.lowRes ? 'ON' : 'off'}\n` +
      `[J] hide pond:   ${state.hidePond ? 'ON' : 'off'}`;
  }
  refresh();

  window.addEventListener('keydown', (e) => {
    const { pond } = getRefs ? getRefs() : {};
    if (e.code === 'KeyT') {
      state.cheapWater = !state.cheapWater;
      if (pond && pond.userData.setCheapWater) pond.userData.setCheapWater(state.cheapWater);
      refresh();
    } else if (e.code === 'KeyL') {
      state.shadows = !state.shadows;
      renderer.shadowMap.enabled = state.shadows;
      // force materials to recompile so the change takes effect
      scene.traverse(o => { if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { m.needsUpdate = true; });
      }});
      refresh();
    } else if (e.code === 'KeyK') {
      state.lowRes = !state.lowRes;
      renderer.setPixelRatio(state.lowRes ? 1 : Math.min(devicePixelRatio, 2));
      refresh();
    } else if (e.code === 'KeyJ') {
      state.hidePond = !state.hidePond;
      if (pond) pond.visible = !state.hidePond;
      refresh();
    }
  });

  return { state };
}
