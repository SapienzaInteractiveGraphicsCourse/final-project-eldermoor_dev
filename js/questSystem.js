import { QUESTS } from './dialogueData.js';

// ================== QUEST SYSTEM ==================
// Manages quest state and a small "objectives" overlay panel
// Quest states: 'inactive' (not started) -> 'active' (in progress) -> 'done'
// The "flags" are free-form booleans used by dialogue/world to track progress
// (e.g. 'erbe_raccolte' = true when the player has picked the herbs)

export function createQuestSystem() {
  const states = {};   // questId -> 'inactive' | 'active' | 'done'
  const flags  = {};   // flagName -> bool
  const readyIds = {}; // questId -> bool  (objective fulfilled, awaiting turn-in)
  for (const id in QUESTS) states[id] = 'inactive';

  // glow animation for a completed objective 
  if (!document.getElementById('quest-glow-style')) {
    const st = document.createElement('style');
    st.id = 'quest-glow-style';
    st.textContent = `
      @keyframes questReadyGlow {
        0%, 100% { box-shadow: 0 0 6px rgba(246,233,198,.35), inset 0 0 4px rgba(246,233,198,.15); border-color:#d8b66e; }
        50%      { box-shadow: 0 0 18px rgba(246,233,198,.85), inset 0 0 8px rgba(246,233,198,.35); border-color:#f6e9c6; }
      }
      .quest-ready {
        border:1px solid #d8b66e; border-radius:6px; padding:8px 10px; margin:-2px -4px 8px;
        animation: questReadyGlow 1.6s ease-in-out infinite;
        background:linear-gradient(180deg, rgba(90,70,30,.35), rgba(60,46,20,.25));
      }
      .quest-ready .quest-ready-tag {
        font-size:11px; letter-spacing:.08em; text-transform:uppercase;
        color:#f6e9c6; margin-top:4px; font-style:italic;
      }`;
    document.head.appendChild(st);
  }

  // objectives panel (HTML overlay) 
  const panel = document.createElement('div');
  panel.id = 'quest-panel';
  panel.style.cssText = `
    position:fixed; top:16px; right:16px; max-width:280px; z-index:50;
    font-family: Georgia, 'Times New Roman', serif; color:#f3e7c8;
    background:linear-gradient(180deg, rgba(40,28,16,.92), rgba(28,18,10,.92));
    border:1px solid #b8945f; border-radius:8px; padding:12px 14px;
    box-shadow:0 6px 20px rgba(0,0,0,.5); display:none;`;
  document.body.appendChild(panel);

  // REWARD micro-card (appears when a quest is turned in)
  const rewardCard = document.createElement('div');
  rewardCard.style.cssText = `
    position:fixed; left:50%; bottom:28%; transform:translateX(-50%); z-index:70;
    font-family: Georgia, serif; color:#eef0ff; display:none; width:280px;
    background:linear-gradient(180deg, rgba(30,26,52,.96), rgba(18,16,34,.96));
    border:1px solid #9a8fe0; border-radius:10px; padding:14px 16px;
    box-shadow:0 8px 26px rgba(0,0,0,.6);`;
  document.body.appendChild(rewardCard);
  let rewardTimer = null;

  function showReward(reward) {
    if (!reward) return;
    rewardCard.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="flex:0 0 auto; width:46px; height:46px; position:relative;">
          <!-- potion vial drawn in CSS -->
          <div style="position:absolute; left:50%; bottom:0; transform:translateX(-50%);
                      width:26px; height:30px; border-radius:0 0 13px 13px;
                      background:linear-gradient(180deg, #6fa8ff, #3a5fd0);
                      box-shadow:0 0 12px #7aa0ff;"></div>
          <div style="position:absolute; left:50%; top:2px; transform:translateX(-50%);
                      width:10px; height:12px; background:#cdd6ff; border-radius:2px;"></div>
        </div>
        <div>
          <div style="font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:#b8aef0;">Item received</div>
          <div style="font-size:16px; font-weight:bold; color:#dfe2ff;">${reward.name}</div>
          <div style="font-size:12px; line-height:1.35; color:#b9b6d8;">${reward.desc}</div>
        </div>
      </div>`;
    rewardCard.style.display = 'block';
    if (rewardTimer) clearTimeout(rewardTimer);
    rewardTimer = setTimeout(() => { rewardCard.style.display = 'none'; }, 6000);
  }

  function render() {
    const active = Object.values(QUESTS).filter(q => states[q.id] === 'active');
    const done   = Object.values(QUESTS).filter(q => states[q.id] === 'done');
    if (active.length === 0 && done.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    let html = `<div style="font-size:13px; letter-spacing:.08em; text-transform:uppercase;
                 color:#d8b66e; border-bottom:1px solid #6b5230; padding-bottom:6px; margin-bottom:8px;">Quests</div>`;
    for (const q of active) {
      const isReady = !!readyIds[q.id];
      html += `<div class="${isReady ? 'quest-ready' : ''}" style="margin-bottom:10px;">
        <div style="font-weight:bold; color:#f6e9c6;">${q.title}</div>
        <div style="font-size:13px; line-height:1.35; color:#cdbf9c;">${q.objective}</div>
        ${isReady ? `<div class="quest-ready-tag">✦ Objective complete — return to Alaric</div>` : ''}
      </div>`;
    }
    for (const q of done) {
      html += `<div style="margin-bottom:8px; opacity:.75;">
        <div style="text-decoration:line-through; color:#9fd89f;">✓ ${q.title}</div>
        ${q.reward ? `<div style="font-size:12px; line-height:1.35; color:#cdbf9c; margin-top:2px;">Reward: Alaric gives you a ${q.reward.name}.</div>` : ''}
      </div>`;
    }
    panel.innerHTML = html;
  }

  return {
    status: (id) => states[id] ?? 'inactive',
    flag: (name) => !!flags[name],
    setFlag(name, val = true) { flags[name] = val; },
    start(id) {
      if (states[id] === 'inactive') { states[id] = 'active'; render(); }
    },
    complete(id) {
      if (states[id] === 'active') {
        states[id] = 'done';
        readyIds[id] = false;   // stop the glow once turned in
        if (QUESTS[id] && QUESTS[id].reward) showReward(QUESTS[id].reward);
        render();
      }
    },
    // updates the displayed objective text (e.g. progress 1/3, 2/3...)
    // Pass ready=true to make the quest box glow (objective fulfilled, awaiting turn-in)
    setObjective(id, text, ready = false) {
      if (QUESTS[id]) { QUESTS[id].objective = text; readyIds[id] = !!ready; render(); }
    },
    render,
  };
}