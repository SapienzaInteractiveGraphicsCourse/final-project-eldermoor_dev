// ================== DIALOGUE & QUEST DATA ==================
// Contents (what each NPC says and how they gesture), separate from the engine
// (dialogueSystem.js), id = GLB file name 
//
// Per node:
//   text    -> the line spoken
//   gesture -> a gesture from the library (gestures.js): idle, annuisce, scuote,
//              saluta, indica, incrocia, rifletteMento, allarga, spiega, ride
//   choices -> [{ text, next, action?, show? }]
//
// action: { type:'startQuest'|'completeQuest'|'setFlag', quest/flag }
// show:   (questSystem) => bool  (show this choice only when true)


const bye = { text: 'I must go. Farewell.', next: null };
const back = { text: 'Let’s go back.', next: 'root' };

export const NPC_DIALOGUES = {

  // ===== WIZARD — gives the herbs quest =====
  wizard: {
    id: 'wizard', name: 'Alaric the Wizard',
    start: 'root',
    nodes: {
      root: {
        text: 'I feel the old magic stirring around you, young one. What do you seek in my village?',
        gesture: 'idle',
        choices: [
          { text: 'Who are you?', next: 'chi' },
          { text: 'Do you have a task for me?', next: 'quest_offer', show: (q)=>q.status('erbe')==='inactive' },
          { text: 'I’m looking for the herbs.', next: 'quest_progress', show: (q)=>q.status('erbe')==='active' },
          { text: 'I’ve gathered the three herbs.', next: 'quest_done', show: (q)=>q.status('erbe')==='active' && q.flag('erbe_raccolte') },
          bye,
        ],
      },
      chi: { text: 'I am Alaric, keeper of the arcane arts of this village. I have studied the stars since before you were born.', gesture: 'spiega', choices: [back] },
      quest_offer: { text: 'I need three moon herbs that grow by the pond to the east. Would you bring them to me?', gesture: 'spiega',
        choices: [
          { text: 'I accept.', next: 'quest_accept', action: { type:'startQuest', quest:'erbe' } },
          { text: 'Maybe later.', next: 'root' },
        ] },
      quest_accept: { text: 'Search among the reeds, where the water is calmest. They glow a pale green.', gesture: 'indica', choices: [ { text:'I’m on my way.', next:null } ] },
      quest_progress: { text: 'The moon herbs, by the pond to the east. Take your time.', gesture: 'indica', choices: [ { text:'I’m going there.', next:null } ] },
      quest_done: { text: 'You can feel them humming, can’t you? Well done. Take this healing potion in return — may it serve you well.', gesture: 'annuisce',
        choices: [ { text:'Thank you, Alaric.', next:null, action:{ type:'completeQuest', quest:'erbe' } } ] },
    },
  },

  // ===== DWARF SMITH =====
  fantasy_dwarf: {
    id: 'fantasy_dwarf', name: 'Durin Ironhammer',
    start: 'root',
    nodes: {
      root: { text: 'Hmph! Mind your step, the floor’s full of sparks. What do you want?', gesture: 'incrocia',
        choices: [ { text:'What do you forge?', next:'forgia' }, { text:'I need your help.', next:'aiuto' }, bye ] },
      forgia: { text: 'Anything that cuts, protects, or holds a gate shut. My family has hammered iron for nine generations.', gesture: 'spiega', choices: [back] },
      aiuto: { text: 'If you want to make yourself useful, talk to Alaric. He always knows what the village needs.', gesture: 'indica', choices: [ {text:'I will.', next:null} ] },
    },
  },

  // ===== KNIGHT =====
  medieval_knight: {
    id: 'medieval_knight', name: 'Ser Gerald',
    start: 'root',
    nodes: {
      root: { text: 'Greetings, traveler. The walls are secure, but vigilance never rests.', gesture: 'saluta',
        choices: [ {text:'What do you do here?', next:'ruolo'}, {text:'Any dangers about?', next:'pericoli'}, bye ] },
      ruolo: { text: 'I command the village guard. I protect these people from bandits and beasts of the forest.', gesture: 'spiega', choices:[back] },
      pericoli: { text: 'There are tales, at night, beyond the pond. Keep your eyes open if you venture east.', gesture:'indica', choices:[ {text:'I’ll be careful.', next:null} ] },
    },
  },

  // ===== ARMORED ELF =====
  elf_armored: {
    id: 'elf_armored', name: 'Faelar the Sentinel',
    start: 'root',
    nodes: {
      root: { text: 'Another child of the forest. Rare, these days. What brings you here?', gesture:'idle',
        choices: [ {text:'I come in peace.', next:'pace'}, {text:'Just passing through.', next:null} ] },
      pace: { text: 'I see it in your eyes. Then be welcome within these walls.', gesture:'annuisce', choices:[back] },
    },
  },

  // ===== WARRIOR =====
  fantasy_warrior: {
    id: 'fantasy_warrior', name: 'Bjorn the Strong',
    start: 'root',
    nodes: {
      root: { text: 'Ha! A new face. Have you the makings of a fighter, or are you one of those who run?', gesture:'allarga',
        choices: [ {text:'I can fight.', next:'battersi'}, {text:'I prefer peace.', next:'pace'}, bye ] },
      battersi: { text: 'Ha ha! I like you. If ever you need an extra blade, you know where to find me.', gesture:'ride', choices:[back] },
      pace: { text: 'Wise. Peace has its own courage.', gesture:'annuisce', choices:[back] },
    },
  },

  // ===== BAKER =====
  medieval_baker: {
    id: 'medieval_baker', name: 'Tobias the Baker',
    start: 'root',
    nodes: {
      root: { text: 'Welcome! Smell that? Fresh bread, straight from the oven.', gesture:'saluta',
        choices: [ {text:'What do you sell?', next:'vende'}, bye ] },
      vende: { text: 'Loaves, flatbreads, honey cakes on feast days. All made with grain from our own fields.', gesture:'spiega', choices:[back] },
    },
  },

  // ===== CRAFTSMEN / WORKERS =====
  medieval_craftsman: {
    id: 'medieval_craftsman', name: 'Aldric the Craftsman',
    start: 'root',
    nodes: { root: { text: 'I’ve worked wood all my life. Every beam in this village has passed through my hands.', gesture:'spiega', choices:[ {text:'Fine work.', next:null} ] } },
  },
  medieval_craftsman2: {
    id: 'medieval_craftsman2', name: 'Edmund the Tanner',
    start: 'root',
    nodes: { root: { text: 'Leather and hides, that’s my trade. Belts, bags, harnesses: things that last.', gesture:'spiega', choices:[ {text:'Interesting.', next:null} ] } },
  },
  medieval_worker: {
    id: 'medieval_worker', name: 'Hodge the Laborer',
    start: 'root',
    nodes: { root: { text: 'Long day, friend. There’s always something to build or repair around here.', gesture:'idle', choices:[ {text:'Good work.', next:null} ] } },
  },
  medieval_female_artisan: {
    id: 'medieval_female_artisan', name: 'Mirela the Weaver',
    start: 'root',
    nodes: { root: { text: 'I weave wool and linen all day long. The colors? All from the plants of our woods.', gesture:'spiega', choices:[ {text:'Beautiful.', next:null} ] } },
  },

  // ===== VILLAGE WOMEN =====
  medieval_woman1: { id:'medieval_woman1', name:'Greta',
    start:'root', nodes:{ root:{ text:'Oh, hello! I’ve never seen you around these parts.', gesture:'saluta', choices:[ {text:'I’m new here.', next:'nuovo'}, bye ] },
      nuovo:{ text:'Then welcome! The folk here are kind, you’ll see.', gesture:'annuisce', choices:[back] } } },
  medieval_woman2: { id:'medieval_woman2', name:'Isolde',
    start:'root', nodes:{ root:{ text:'Have you heard? They say this year’s harvest will be plentiful.', gesture:'spiega', choices:[ {text:'Good news.', next:null} ] } } },
  medieval_woman3: { id:'medieval_woman3', name:'Rowena',
    start:'root', nodes:{ root:{ text:'Sorry, I’m in a hurry: the children won’t mind themselves!', gesture:'idle', choices:[ {text:'Off you go.', next:null} ] } } },
  medieval_female: { id:'medieval_female', name:'Beatrix',
    start:'root', nodes:{ root:{ text:'Looking for someone? I know everyone here, I can point the way.', gesture:'indica', choices:[ {text:'Thanks, maybe later.', next:null} ] } } },
  elderly_woman: { id:'elderly_woman', name:'Granny Edda',
    start:'root', nodes:{ root:{ text:'Come, come, sit a moment with an old woman. I’ve seen my share of seasons.', gesture:'rifletteMento',
      choices:[ {text:'Tell me.', next:'racconto'}, bye ] },
      racconto:{ text:'This village was once just three houses and a well. Look at it now. Time builds, if you let it.', gesture:'spiega', choices:[back] } } },

  // ===== GENERIC FIGURES =====
  medieval_character_1: { id:'medieval_character_1', name:'Cedric',
    start:'root', nodes:{ root:{ text:'A quiet day, thankfully. Can I help you with anything?', gesture:'idle', choices:[ {text:'No, thank you.', next:null} ] } } },
  medieval_character_2: { id:'medieval_character_2', name:'Osric',
    start:'root', nodes:{ root:{ text:'Hm? Oh, hello. I was lost in thought.', gesture:'idle', choices:[ {text:'No worries.', next:null} ] } } },
  fantasy_character_1: { id:'fantasy_character_1', name:'The Wanderer',
    start:'root', nodes:{ root:{ text:'I come from distant lands. This village is more welcoming than I expected.', gesture:'spiega', choices:[ {text:'Safe travels.', next:null} ] } } },
  medieval_robed_figure: { id:'medieval_robed_figure', name:'Brother Anselm',
    start:'root', nodes:{ root:{ text:'Peace be with you, traveler. Do you seek comfort, or just a moment of quiet?', gesture:'annuisce', choices:[ {text:'Just passing through.', next:null} ] } } },

  // ===== HOODED FIGURE (static NPC, no skeleton: no gestures) =====
  medieval_hooded_figure: { id:'medieval_hooded_figure', name:'The Stranger',
    start:'root', nodes:{ root:{ text:'...not everyone here is what they seem. Keep your eyes open.', gesture:'idle',
      choices:[ {text:'Who are you?', next:'chi'}, bye ] },
      chi:{ text:'A name would do you no good. Let’s just say I watch.', gesture:'idle', choices:[back] } } },

  // ===== FISHMONGER =====
  fishmonger: { id:'fishmonger', name:'Garrett the Fishmonger',
    start:'root', nodes:{
      root:{ text:'Fresh fish, caught this morning at the pond! Trout, pike, eel. What do you need?', gesture:'idle',
        choices:[ {text:'What’s good today?', next:'merce'}, {text:'Just looking.', next:null} ] },
      merce:{ text:'The trout are the best of the season. Come at dawn and grab the catch before it’s gone.', gesture:'spiega', choices:[back] } } },

};

// ================== QUESTS ==================
export const QUESTS = {
  erbe: {
    id: 'erbe',
    title: 'The Moon Herbs',
    description: 'Alaric needs three moon herbs that grow by the pond to the east.',
    objective: 'Gather 3 moon herbs at the pond and bring them back to Alaric.',
    reward: {
      name: 'Healing Potion',
      desc: 'Alaric gives you a small healing potion in thanks. Its glass is warm to the touch and the liquid inside swirls with a faint blue light.',
    },
  },
};