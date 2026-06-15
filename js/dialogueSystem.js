import { NPC_DIALOGUES } from './dialogueData.js';

// ================== DIALOGUE ENGINE ==================
// Shows an overlay dialogue box (name + text + choices), walks the
// tree defined in dialogueData.js and runs the actions tied to the choices
// (start/complete quests). While a dialogue is open, it signals the rest of the
// game to block the character's movement

export function createDialogueSystem(quests, callbacks = {}) {
  const { onOpen, onClose, onGesture } = callbacks;

  // build UI 
  const overlay = document.createElement('div');
  overlay.id = 'dialogue-overlay';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:100; display:none;
    align-items:flex-end; justify-content:center; pointer-events:none;`;

  const box = document.createElement('div');
  box.style.cssText = `
    pointer-events:auto; width:min(760px, 92vw); margin-bottom:5vh;
    font-family: Georgia, 'Times New Roman', serif; color:#f3e7c8;
    background:linear-gradient(180deg, rgba(38,26,15,.97), rgba(24,16,9,.97));
    border:2px solid #b8945f; border-radius:12px; padding:18px 20px;
    box-shadow:0 12px 40px rgba(0,0,0,.6);`;

  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; gap:14px; margin-bottom:10px;';

  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-size:20px; font-weight:bold; color:#e8c87e; letter-spacing:.02em;';

  header.appendChild(nameEl);

  const textEl = document.createElement('div');
  textEl.style.cssText = 'font-size:17px; line-height:1.5; margin-bottom:16px; min-height:48px; color:#efe3c4;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display:flex; flex-direction:column; gap:8px;';

  box.appendChild(header);
  box.appendChild(textEl);
  box.appendChild(choicesEl);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let current = null;   // current NPC
  let open = false;

  // Runs the action attached to a choice (quest start/complete, set flag)
  function runAction(action) {
    if (!action) return;
    if (action.type === 'startQuest')    quests.start(action.quest);
    if (action.type === 'completeQuest') quests.complete(action.quest);
    if (action.type === 'setFlag')       quests.setFlag(action.flag, action.value ?? true);
  }

  // Renders a single dialogue node: text + filtered choices
  function showNode(nodeId) {
    if (nodeId == null) { close(); return; }
    const node = current.nodes[nodeId];
    if (!node) { close(); return; }

    // make the NPC gesture: the node's gesture, or 'explain' by default while talking
    if (onGesture) onGesture(current.id, node.gesture || 'idle');

    textEl.textContent = node.text;
    choicesEl.innerHTML = '';

    // filter choices with a show() condition
    const visible = (node.choices || []).filter(c => !c.show || c.show(quests));
    if (visible.length === 0) {
      // no choices -> implicit close button
      visible.push({ text: 'Continue…', next: null });
    }

    for (const choice of visible) {
      const btn = document.createElement('button');
      btn.textContent = choice.text;
      btn.style.cssText = `
        text-align:left; font-family:inherit; font-size:15px; color:#f3e7c8;
        background:rgba(90,64,34,.55); border:1px solid #8a6c3f; border-radius:7px;
        padding:10px 14px; cursor:pointer; transition:background .12s, border-color .12s;`;
      btn.onmouseenter = () => { btn.style.background = 'rgba(140,104,63,.75)'; btn.style.borderColor = '#d8b66e'; };
      btn.onmouseleave = () => { btn.style.background = 'rgba(90,64,34,.55)'; btn.style.borderColor = '#8a6c3f'; };
      btn.onclick = () => {
        runAction(choice.action);
        showNode(choice.next);
      };
      choicesEl.appendChild(btn);
    }
  }

  function openDialogue(npcId) {
    const npc = NPC_DIALOGUES[npcId];
    if (!npc) { console.warn('Dialogue not found:', npcId); return; }
    current = npc;
    nameEl.textContent = npc.name;
    overlay.style.display = 'flex';
    open = true;
    onOpen && onOpen();
    showNode(npc.start);
  }

  function close() {
    if (onGesture && current) onGesture(current.id, 'idle');
    overlay.style.display = 'none';
    open = false;
    current = null;
    onClose && onClose();
  }

  // ESC closes the dialogue
  window.addEventListener('keydown', (e) => {
    if (open && e.code === 'Escape') close();
  });

  return {
    open: openDialogue,
    close,
    get isOpen() { return open; },
  };
}
