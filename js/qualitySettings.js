// ================== QUALITY SETTINGS ==================
// Auto-detects the GPU tier and exposes a single shared settings object that
// the rest of the code reads to scale rendering, shadows and vegetation
//
// Three tiers: 'high' (RTX 4080/4090/5090 class & up), 'medium' (mid-range
// discrete GPUs), 'low' (integrated graphics / old GPUs / mobile)


export const QUALITY = {
  tier: 'high',          // 'high' | 'medium' | 'low'
  // renderer 
  pixelRatioCap: 2,      // Math.min(devicePixelRatio, cap)
  antialias: true,
  toneMappingExposure: 0.85,
  // shadows 
  shadows: true,
  shadowMapSize: 2048,
  shadowType: 'pcfsoft', // 'pcfsoft' | 'pcf' | 'basic'
  //  vegetation multipliers (1.0 = full, lower = fewer instances) 
  treeCount: 1.0,        // multiplies NUM_TREES and fillTreeArea density
  fieldDensity: 1.0,     // multiplies wheat/pumpkin/flower field counts
  scatterDensity: 1.0,   // multiplies grass/flower scatter
  // whether small instanced vegetation casts shadows
  vegetationShadows: true,
};

// Reads the unmasked GPU renderer string via WEBGL_debug_renderer_info.
function getGPUString(renderer) {
  try {
    const gl = renderer ? renderer.getContext()
                        : document.createElement('canvas').getContext('webgl2')
                        || document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return '';
    return (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toString();
  } catch (e) {
    return '';
  }
}

// Classifies the GPU string into a tier. Heuristic but deliberately
// conservative: anything we can't confidently call "high" falls to medium,
// and known weak/integrated parts fall to low
function classify(gpu) {
  const g = gpu.toLowerCase();

  // Integrated / mobile / clearly weak -> low
  const lowHints = [
    'intel', 'uhd', 'iris', 'hd graphics', 'apple gpu', 'mali',
    'adreno', 'powervr', 'swiftshader', 'llvmpipe', 'microsoft basic',
    'gile', // misc software renderers
  ];
  // Strong discrete -> high
  const highHints = [
    'rtx 30', 'rtx 40', 'rtx 50',          // RTX 3000/4000/5000
    'rtx 4070', 'rtx 4080', 'rtx 4090', 'rtx 5070', 'rtx 5080', 'rtx 5090',
    'rtx 3080', 'rtx 3090',
    'rx 6800', 'rx 6900', 'rx 7700', 'rx 7800', 'rx 7900',
    'rx 9070',
    'apple m3', 'apple m4', 'apple m2 max', 'apple m2 ultra', 'apple m1 max', 'apple m1 ultra',
    'a100', 'h100',
  ];

  if (highHints.some(h => g.includes(h))) return 'high';
  if (lowHints.some(h => g.includes(h))) return 'low';

  // Mid-range discrete NVIDIA/AMD (GTX, RTX 2000/3050/3060, older RX) -> medium
  if (g.includes('nvidia') || g.includes('geforce') || g.includes('rtx') ||
      g.includes('gtx') || g.includes('radeon') || g.includes(' rx ') ||
      g.includes('apple m')) {
    return 'medium';
  }

  // Unknown -> play it safe with medium
  return 'medium';
}

// Applies a tier's parameters to the QUALITY singleton.
function applyTier(tier) {
  QUALITY.tier = tier;
  if (tier === 'high') {
    QUALITY.pixelRatioCap = 2;
    QUALITY.antialias = true;
    QUALITY.shadows = true;
    QUALITY.shadowMapSize = 2048;
    QUALITY.shadowType = 'pcfsoft';
    QUALITY.treeCount = 1.0;
    QUALITY.fieldDensity = 1.0;
    QUALITY.scatterDensity = 1.0;
    QUALITY.vegetationShadows = true;
  } else if (tier === 'medium') {
    QUALITY.pixelRatioCap = 1.5;
    QUALITY.antialias = true;
    QUALITY.shadows = true;
    QUALITY.shadowMapSize = 1024;
    QUALITY.shadowType = 'pcf';
    QUALITY.treeCount = 0.6;
    QUALITY.fieldDensity = 0.5;
    QUALITY.scatterDensity = 0.5;
    QUALITY.vegetationShadows = false;  // biggest single win on mid GPUs
  } else { // low
    QUALITY.pixelRatioCap = 1;
    QUALITY.antialias = false;
    QUALITY.shadows = false;            // disable shadow map entirely
    QUALITY.shadowMapSize = 512;
    QUALITY.shadowType = 'basic';
    QUALITY.treeCount = 0.3;
    QUALITY.fieldDensity = 0.3;
    QUALITY.scatterDensity = 0.25;
    QUALITY.vegetationShadows = false;
  }
}

// Main entry point
// Returns the resolved tier string
export function detectQuality(renderer) {
  // allow a manual override via ?quality=low|medium|high in the URL
  try {
    const param = new URLSearchParams(location.search).get('quality');
    if (param && ['low', 'medium', 'high'].includes(param)) {
      applyTier(param);
      console.info(`[quality] forced via URL: ${param}`);
      return param;
    }
  } catch (e) { /* no location (e.g. workers) */ }

  const gpu = getGPUString(renderer);
  let tier = classify(gpu);

  // Extra safety nets that don't depend on the GPU string:
  // very low logical core count or tiny screens -> step down
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');
  if (isMobile) tier = 'low';
  else if (cores <= 4 && tier === 'high') tier = 'medium';
  else if (cores <= 2) tier = 'low';

  applyTier(tier);
  console.info(`[quality] GPU="${gpu || 'unknown'}" cores=${cores} -> tier=${tier}`);
  return tier;
}

// Maps the shadowType string to the THREE.* constant. Pass THREE in to avoid
// importing it here (keeps this module dependency-free)
export function shadowMapTypeFor(THREE) {
  switch (QUALITY.shadowType) {
    case 'basic':   return THREE.BasicShadowMap;
    case 'pcf':     return THREE.PCFShadowMap;
    case 'pcfsoft':
    default:        return THREE.PCFSoftShadowMap;
  }
}
