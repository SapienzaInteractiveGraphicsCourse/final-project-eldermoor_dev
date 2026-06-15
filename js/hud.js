// ================== HUD (portrait + health bar) ==================
// A top-left heads-up display in medieval style: a circular portrait of the
// hero inside an ornate decorated frame, with a green health bar
// beside it

// The health bar starts full and green. setHealth(frac) animates the fill and
// shifts its color from green toward red as it drops.

export function createHUD(cfg = {}) {
  const {
    portrait = './hud_portrait.jpg',
    name = '',
    maxHealth = 100,
  } = cfg;

  // fonts: reuse the same medieval serif the menu uses
  const FONT = "'Cinzel', Georgia, 'Times New Roman', serif";

  // one-time stylesheet with the ornate frame + bar styling 
  if (!document.getElementById('hud-style')) {
    const st = document.createElement('style');
    st.id = 'hud-style';
    st.textContent = `
      #hud {
        position: fixed; top: 18px; left: 18px; z-index: 55;
        display: flex; align-items: center; gap: 14px;
        font-family: ${FONT}; user-select: none; pointer-events: none;
      }
      /* --- circular portrait + decorated frame --- */
      #hud-portrait-wrap {
        position: relative; width: 96px; height: 96px; flex: 0 0 auto;
        filter: drop-shadow(0 4px 10px rgba(0,0,0,.6));
      }
      #hud-portrait {
        position: absolute; left: 50%; top: 50%;
        width: 70px; height: 70px; transform: translate(-50%, -50%);
        border-radius: 50%; object-fit: cover; object-position: 50% 28%;
        box-shadow: inset 0 0 8px rgba(0,0,0,.7);
      }
      #hud-frame { position: absolute; inset: 0; width: 100%; height: 100%; }
      /* --- health bar --- */
      #hud-health { display: flex; flex-direction: column; gap: 5px; }
      #hud-name {
        font-size: 14px; letter-spacing: .12em; text-transform: uppercase;
        color: #f3e7c8; text-shadow: 0 2px 6px rgba(0,0,0,.85);
      }
      #hud-bar {
        position: relative; width: 220px; height: 20px; border-radius: 11px;
        background: linear-gradient(180deg, rgba(20,14,8,.95), rgba(36,26,14,.95));
        border: 2px solid #b8945f;
        box-shadow: 0 3px 10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,235,190,.18);
        overflow: hidden;
      }
      #hud-bar-fill {
        position: absolute; left: 0; top: 0; height: 100%; width: 100%;
        background: linear-gradient(180deg, #7be07b 0%, #3fae47 55%, #2e8e38 100%);
        box-shadow: 0 0 12px rgba(120,230,120,.5), inset 0 1px 0 rgba(255,255,255,.35);
        border-radius: 9px;
        transition: width .35s ease, background .35s ease;
      }
      /* subtle moving sheen on the bar */
      #hud-bar-fill::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.22) 50%, transparent 100%);
        mix-blend-mode: screen;
      }
      #hud-bar-label {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        font-size: 12px; letter-spacing: .08em; color: #0e2a12; font-weight: bold;
        text-shadow: 0 1px 0 rgba(255,255,255,.35);
      }
    `;
    document.head.appendChild(st);
  }

  // decorative medieval frame drawn as SVG (gilded ring + flourishes) 
  // The flourishes are mirrored four ways (N/S/E/W) around the ring so the
  // ornament reads as a heraldic medallion rather than a plain circle
  const frameSVG = `
    <svg id="hud-frame" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hudGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0"  stop-color="#f6e3a8"/>
          <stop offset=".5" stop-color="#c8a262"/>
          <stop offset="1"  stop-color="#7a5a2e"/>
        </linearGradient>
        <radialGradient id="hudInner" cx="50%" cy="38%" r="65%">
          <stop offset="0"  stop-color="#2a1d10"/>
          <stop offset="1"  stop-color="#120c06"/>
        </radialGradient>
      </defs>

      <!-- backing disc behind the portrait -->
      <circle cx="50" cy="50" r="40" fill="url(#hudInner)"/>

      <!-- outer gilded rings -->
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#hudGold)" stroke-width="4"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#6b4f28" stroke-width="1.4"/>
      <circle cx="50" cy="50" r="37.5" fill="none" stroke="#e7cf94" stroke-width=".7" opacity=".7"/>

      <!-- four corner flourishes (scrollwork), rotated around the center -->
      <g fill="none" stroke="url(#hudGold)" stroke-width="2.2" stroke-linecap="round">
        <g>
          <path d="M50 6 q-7 4 -7 11 q0 5 4 7 M50 6 q7 4 7 11 q0 5 -4 7"/>
          <circle cx="50" cy="5" r="2.4" fill="url(#hudGold)" stroke="none"/>
        </g>
        <g transform="rotate(90 50 50)">
          <path d="M50 6 q-7 4 -7 11 q0 5 4 7 M50 6 q7 4 7 11 q0 5 -4 7"/>
          <circle cx="50" cy="5" r="2.4" fill="url(#hudGold)" stroke="none"/>
        </g>
        <g transform="rotate(180 50 50)">
          <path d="M50 6 q-7 4 -7 11 q0 5 4 7 M50 6 q7 4 7 11 q0 5 -4 7"/>
          <circle cx="50" cy="5" r="2.4" fill="url(#hudGold)" stroke="none"/>
        </g>
        <g transform="rotate(270 50 50)">
          <path d="M50 6 q-7 4 -7 11 q0 5 4 7 M50 6 q7 4 7 11 q0 5 -4 7"/>
          <circle cx="50" cy="5" r="2.4" fill="url(#hudGold)" stroke="none"/>
        </g>
      </g>

      <!-- small diagonal studs between the flourishes -->
      <g fill="#e7cf94">
        <circle cx="50" cy="50" r="0" />
      </g>
      <g fill="url(#hudGold)">
        <g transform="rotate(45 50 50)"><circle cx="50" cy="7" r="1.6"/></g>
        <g transform="rotate(135 50 50)"><circle cx="50" cy="7" r="1.6"/></g>
        <g transform="rotate(225 50 50)"><circle cx="50" cy="7" r="1.6"/></g>
        <g transform="rotate(315 50 50)"><circle cx="50" cy="7" r="1.6"/></g>
      </g>
    </svg>`;

  // build the HUD DOM
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div id="hud-portrait-wrap">
      ${frameSVG}
      <img id="hud-portrait" src="${portrait}" alt="portrait">
    </div>
    <div id="hud-health">
      ${name ? `<div id="hud-name">${name}</div>` : ''}
      <div id="hud-bar">
        <div id="hud-bar-fill"></div>
        <div id="hud-bar-label"></div>
      </div>
    </div>`;
  document.body.appendChild(hud);

  const fillEl  = hud.querySelector('#hud-bar-fill');
  const labelEl = hud.querySelector('#hud-bar-label');

  let current = maxHealth;   // starts full

  function paint() {
    const frac = Math.max(0, Math.min(1, current / maxHealth));
    fillEl.style.width = (frac * 100) + '%';
    // color shifts green -> amber -> red as health drops
    let bg;
    if (frac > 0.5) {
      bg = 'linear-gradient(180deg, #7be07b 0%, #3fae47 55%, #2e8e38 100%)';
    } else if (frac > 0.25) {
      bg = 'linear-gradient(180deg, #f0d86a 0%, #d8a832 55%, #b6841f 100%)';
    } else {
      bg = 'linear-gradient(180deg, #f08a6a 0%, #d04632 55%, #a72a1f 100%)';
    }
    fillEl.style.background = bg;
    labelEl.textContent = Math.round(current) + ' / ' + maxHealth;
  }
  paint();   // full + green on creation

  return {
    el: hud,
    // set health as a fraction 0..1
    setHealth(frac) { current = Math.max(0, Math.min(1, frac)) * maxHealth; paint(); },
    // set health as an absolute value
    setHealthValue(v) { current = Math.max(0, Math.min(maxHealth, v)); paint(); },
    damage(v) { current = Math.max(0, current - v); paint(); },
    heal(v) { current = Math.min(maxHealth, current + v); paint(); },
    get health() { return current; },
    show() { hud.style.display = 'flex'; },
    hide() { hud.style.display = 'none'; },
  };
}
