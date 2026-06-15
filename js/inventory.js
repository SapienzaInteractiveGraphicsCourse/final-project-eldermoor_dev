import { QUESTS } from './dialogueData.js';

// ================== INVENTORY ==================
// A medieval-style inventory panel toggled with the I key. It does NOT store its
// own item logic: instead it reads the live game state (quest system + the herb
// collectible) every time it opens and rebuilds the slots. This keeps it in
// sync automatically with no extra wiring:
//
//   - Sword + Shield : always present (starting gear)
//   - Moon Herb (xN) : present while the herbs are gathered but NOT yet handed in
//                      (flag 'erbe_raccolte' true AND quest 'erbe' not 'done')
//                      The count reflects how many herbs have been picked
//   - Healing Potion : present once the 'erbe' quest is 'done' (Alaric gave it)
//
// So the herbs vanish the moment you turn them in to Alaric and the potion
// appears at the same time — both driven purely by the quest state


export function createInventory(quests, opts = {}) {
  const collectibles = opts.collectibles || null;   // for the live herb count
  const onOpen  = opts.onOpen  || null;             // e.g. freeze the character
  const onClose = opts.onClose || null;
  const canOpen = opts.canOpen || (() => true);     // e.g. block while a dialogue is open
  const FONT = "'Cinzel', Georgia, 'Times New Roman', serif";

  // icons 
  const ICONS = {
    sword: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <defs><linearGradient id="invBlade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#eef2f6"/><stop offset="1" stop-color="#9aa6b2"/></linearGradient></defs>
        <path d="M32 4 L37 9 L35 40 L32 44 L29 40 L27 9 Z" fill="url(#invBlade)" stroke="#5f6b78" stroke-width="1"/>
        <rect x="20" y="42" width="24" height="5" rx="2" fill="#c8a262" stroke="#7a5a2e"/>
        <rect x="29.5" y="46" width="5" height="11" rx="1.5" fill="#7a5230" stroke="#4a3018"/>
        <circle cx="32" cy="58" r="3.4" fill="#c8a262" stroke="#7a5a2e"/>
      </svg>`,
    shield: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <defs><linearGradient id="invShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8a6c3f"/><stop offset="1" stop-color="#4a3018"/></linearGradient></defs>
        <path d="M32 6 L52 13 V32 C52 46 42 54 32 58 C22 54 12 46 12 32 V13 Z"
              fill="url(#invShield)" stroke="#c8a262" stroke-width="2.4"/>
        <path d="M32 12 V52 M16 19 H48" stroke="#c8a262" stroke-width="1.6" opacity=".55"/>
        <circle cx="32" cy="31" r="5" fill="#e7cf94" stroke="#7a5a2e" stroke-width="1.4"/>
      </svg>`,
    herb: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <defs><radialGradient id="invGlow" cx="50%" cy="40%" r="55%">
          <stop offset="0" stop-color="#cffce4"/><stop offset="1" stop-color="#3fae7a"/></radialGradient></defs>
        <circle cx="32" cy="30" r="14" fill="url(#invGlow)" opacity=".35"/>
        <g fill="none" stroke="#3fae7a" stroke-width="3.4" stroke-linecap="round">
          <path d="M32 54 C32 40 26 30 22 22"/>
          <path d="M32 54 C32 42 36 32 42 24"/>
          <path d="M32 54 C32 44 32 32 32 20"/>
        </g>
        <g fill="#9be8c0" stroke="#3fae7a" stroke-width="1">
          <ellipse cx="22" cy="21" rx="5" ry="3" transform="rotate(-35 22 21)"/>
          <ellipse cx="42" cy="23" rx="5" ry="3" transform="rotate(35 42 23)"/>
          <ellipse cx="32" cy="18" rx="5" ry="3"/>
        </g>
      </svg>`,
    potion: `
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <defs><linearGradient id="invPot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8fc2ff"/><stop offset="1" stop-color="#3a5fd0"/></linearGradient></defs>
        <circle cx="32" cy="40" r="17" fill="#7aa0ff" opacity=".25"/>
        <path d="M27 14 H37 V24 L44 40 C46 50 40 56 32 56 C24 56 18 50 20 40 L27 24 Z"
              fill="url(#invPot)" stroke="#6a86c8" stroke-width="1.6"/>
        <rect x="26" y="9" width="12" height="7" rx="2" fill="#cdd6ff" stroke="#8a93c0"/>
        <ellipse cx="28" cy="34" rx="3" ry="5" fill="#cfe0ff" opacity=".7"/>
      </svg>`,
  };

  // one-time stylesheet 
  if (!document.getElementById('inv-style')) {
    const st = document.createElement('style');
    st.id = 'inv-style';
    st.textContent = `
      #inventory {
        position: fixed; inset: 0; z-index: 80; display: none;
        align-items: center; justify-content: center;
        background: rgba(0,0,0,.55); font-family: ${FONT};
      }
      #inv-panel {
        width: min(560px, 92vw);
        background: linear-gradient(180deg, rgba(40,28,16,.98), rgba(26,17,9,.98));
        border: 3px solid #b8945f; border-radius: 14px; padding: 22px 24px;
        box-shadow: 0 16px 48px rgba(0,0,0,.7), inset 0 0 0 1px rgba(231,207,148,.25);
        color: #f3e7c8;
      }
      #inv-title {
        text-align: center; font-size: 24px; font-weight: 700; letter-spacing: .14em;
        text-transform: uppercase; color: #e8c87e;
        text-shadow: 0 2px 8px rgba(0,0,0,.8); margin-bottom: 4px;
      }
      /* decorative divider with center diamond */
      #inv-rule {
        display: flex; align-items: center; gap: 10px; margin: 6px 0 18px;
        color: #b8945f;
      }
      #inv-rule::before, #inv-rule::after {
        content: ''; flex: 1; height: 1px;
        background: linear-gradient(90deg, transparent, #b8945f, transparent);
      }
      #inv-rule span { font-size: 12px; transform: rotate(45deg); }
      #inv-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
      }
      .inv-slot {
        position: relative; aspect-ratio: 1 / 1; border-radius: 10px;
        background: radial-gradient(circle at 50% 30%, rgba(60,44,24,.9), rgba(30,20,10,.95));
        border: 2px solid #6b5230;
        box-shadow: inset 0 2px 8px rgba(0,0,0,.6);
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
      }
      .inv-slot.filled { border-color: #c8a262; box-shadow: inset 0 0 10px rgba(200,162,98,.3); }
      .inv-icon { width: 62%; height: 62%; margin-bottom: 12px; }
      .inv-count {
        position: absolute; right: 6px; bottom: 18px;
        font-size: 14px; font-weight: 700; color: #f6e9c6;
        text-shadow: 0 1px 3px #000, 0 0 6px rgba(0,0,0,.9);
      }
      .inv-name {
        position: absolute; left: 4px; right: 4px; bottom: 6px; text-align: center;
        font-size: 10px; letter-spacing: .04em; color: #cdbf9c;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #inv-hint {
        text-align: center; margin-top: 18px; font-size: 12px;
        letter-spacing: .1em; text-transform: uppercase; color: #b8945f;
      }
    `;
    document.head.appendChild(st);
  }

  // DOM 
  const root = document.createElement('div');
  root.id = 'inventory';
  root.innerHTML = `
    <div id="inv-panel">
      <div id="inv-title">Inventory</div>
      <div id="inv-rule"><span>◆</span></div>
      <div id="inv-grid"></div>
      <div id="inv-hint">Press  I  to close</div>
    </div>`;
  document.body.appendChild(root);
  const grid = root.querySelector('#inv-grid');

  const SLOTS = 8;   // grid capacity (4 x 2)

  // builds the current item list from live game state
  function currentItems() {
    const items = [
      { icon: 'sword',  name: 'Iron Sword' },
      { icon: 'shield', name: 'Wooden Shield' },
    ];

    const herbsDone = quests.status('erbe') === 'done';
    const herbCount = collectibles ? collectibles.gathered : 0;

    // herbs: shown from the very first one picked, up until handed in
    // The count follows how many have been gathered (1, 2, 3...)
    if (herbCount > 0 && !herbsDone) {
      items.push({ icon: 'herb', name: 'Moon Herb', count: herbCount });
    }

    // potion: shown once the quest is turned in (Alaric's reward)
    if (herbsDone) {
      const rw = (QUESTS.erbe && QUESTS.erbe.reward) || {};
      items.push({ icon: 'potion', name: rw.name || 'Healing Potion' });
    }

    return items;
  }

  function render() {
    const items = currentItems();
    let html = '';
    for (let i = 0; i < SLOTS; i++) {
      const it = items[i];
      if (it) {
        html += `<div class="inv-slot filled">
          <div class="inv-icon">${ICONS[it.icon] || ''}</div>
          ${it.count != null ? `<div class="inv-count">x${it.count}</div>` : ''}
          <div class="inv-name">${it.name}</div>
        </div>`;
      } else {
        html += `<div class="inv-slot"></div>`;
      }
    }
    grid.innerHTML = html;
  }

  let open = false;
  function show() { render(); root.style.display = 'flex'; open = true; if (onOpen) onOpen(); }
  function hide() { root.style.display = 'none'; open = false; if (onClose) onClose(); }
  function toggle() { open ? hide() : show(); }

  // I toggles, Esc closes
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyI') {
      e.preventDefault();
      if (open) hide();
      else if (canOpen()) show();
    }
    else if (e.code === 'Escape' && open) hide();
  });

  return {
    el: root,
    show, hide, toggle,
    get isOpen() { return open; },
    // re-render if open
    update() { if (open) render(); },
  };
}