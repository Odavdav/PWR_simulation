/* ======== ui/app.js ======== */
/* =====================================================================
   ui/app.js — application : boucle temps réel, commandes, alarmes, missions
   (la physique est dans REP.*, aucun calcul de centrale n'est fait ici)
   ===================================================================== */
(function (root) {
'use strict';
const REP = root.REP, W = root.Widgets, Syn = root.Synoptique, Guide = root.Guide;
const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const TOUT = ['turbine', 'barres', 'autoR', 'bore', 'temps', 'arret', 'groupe', 'pompes', 'pzr', 'is', 'secondaire'];

const App = root.App = {
  sim: null, vitesse: 1, pause: false, fini: false, mission: null, debloque: new Set(TOUT),
  opt: { palier: 900, cycle: 'milieu', son: true, simple: false },
  prog: { missions: {}, incidents: {}, tuto: false },
};

/* ---------------- progression enregistrée dans le navigateur ---------------- */
function charger() { try { const p = JSON.parse(localStorage.getItem('simrep_v2')); if (p) { Object.assign(App.prog, p.prog); Object.assign(App.opt, p.opt); } } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ } }
function sauver() { try { localStorage.setItem('simrep_v2', JSON.stringify({ prog: App.prog, opt: App.opt })); } catch (e) { /* idem */ } }
App.sauver = sauver;

/* ---------------- son (bip d'alarme) ---------------- */
let actx = null;
function bip(freq, duree, n) {
  if (!App.opt.son) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    for (let k = 0; k < (n || 1); k++) {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + k * (duree + 0.07);
      o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + duree);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + duree);
    }
  } catch (e) { /* pas de son */ }
}

function toast(msg, ms) {
  const t = $('toast'); t.innerHTML = msg; t.style.display = 'block';
  clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = 'none', ms || 4200);
}
App.toast = toast;

/* =====================================================================
   NOUVELLE PARTIE
   ===================================================================== */
let cadrans = {}, curseurs = [], courbes = [], hist, syn, tuiles = [];

App.nouvelle = function (o) {
  o = Object.assign({ etat: 'nominal' }, o);
  App.sim = REP.creer({ palier: App.opt.palier, cycle: App.opt.cycle, etat: o.etat });
  App.fini = false; App.pause = false; App.mission = null; App.incidentGuide = null;
  App.regler(1);
  $('fin-partie').style.display = 'none';
  $('sous-titre').textContent = App.sim.K.G.nom + ' · ' + REP.CYCLES[App.opt.cycle].nom.toLowerCase();
  construire();
  document.querySelectorAll('.vu').forEach(el => el.classList.remove('vu'));
  nJournal = 0; $('journal').innerHTML = '';
  majVerrous();
};

function construire() {
  const sim = App.sim, K = sim.K, G = K.G, s = sim.s, u = sim.u;
  // ---- cadrans ----
  const hc = $('cadrans'); hc.innerHTML = ''; cadrans = {};
  const A = '#ffb020', D = '#ff4d4d';
  const defs = [
    { id: 'n', nom: 'Puissance réacteur', unite: '% nominal', min: 0, max: 120, dec: 1, zones: [[102, 109, A], [109, 120, D]], aide: 'Puissance produite par les fissions, en % de la puissance nominale (' + Math.round(G.P_th / 1e6) + ' MW thermiques). Arrêt automatique à 109 %.' },
    { id: 'pe', nom: 'Puissance électrique', unite: 'MWe', min: 0, max: Math.round(G.P_e / 1e6 * 1.15), zones: [], aide: 'Puissance fournie au réseau par l\'alternateur. Environ un tiers de la puissance thermique : le reste part au condenseur.' },
    { id: 'tm', nom: 'T moyenne primaire', unite: '°C', min: Math.round(G.T_e - 26), max: Math.round(K.Tmoy0 + 14), dec: 1, zones: [[K.Tmoy0 + 4, K.Tmoy0 + 14, A]], aide: 'Moyenne des températures de branche chaude et de branche froide. Le petit repère violet est la température de référence, qui dépend de la charge de la turbine : le pilotage consiste à garder l\'aiguille sur le repère.' },
    { id: 'p', nom: 'Pression primaire', unite: 'bar', min: 20, max: 180, dec: 1, zones: [[20, 121, D], [121, 131, A], [162, 165, A], [165, 180, D]], aide: 'Pression dans le circuit primaire, imposée par le pressuriseur (155 bar). Arrêt automatique sous 131 bar ou au-dessus de 165 bar, injection de sécurité sous 121 bar.' },
    { id: 'np', nom: 'Niveau pressuriseur', unite: '%', min: 0, max: 100, zones: [[0, 14, D], [14, 20, A], [85, 100, A]], aide: 'Hauteur d\'eau dans le pressuriseur. Elle monte quand le primaire chauffe (l\'eau se dilate) et baisse quand il refroidit ou quand il fuit.' },
    { id: 'mg', nom: 'Marge à la saturation', unite: '°C', min: 0, max: 80, zones: [[0, 10, D], [10, 20, A]], aide: 'Écart entre la température d\'ébullition à la pression du primaire et la température de l\'eau en sortie du cœur. Si elle tombe à zéro, l\'eau bout dans le cœur.' },
    { id: 'tc', nom: 'T centre combustible', unite: '°C', min: 200, max: 3000, zones: [[2300, 2840, A], [2840, 3000, D]], aide: 'Température au centre de la pastille du crayon le plus chaud. L\'oxyde d\'uranium fond vers 2840 °C.' },
    { id: 'wr', nom: 'Débit primaire', unite: '%', min: 0, max: 110, zones: [[0, 88, A]], aide: 'Débit d\'eau dans le cœur, en % du nominal. Pompes arrêtées, il reste 5 à 6 % par circulation naturelle (thermosiphon). Arrêt automatique sous 88 % en puissance.' },
  ];
  for (const d of defs) cadrans[d.id] = W.cadran(hc, d);

  // ---- curseurs verticaux ----
  const hs = $('curseurs'); hs.innerHTML = ''; curseurs = [];
  const C = REP.COMMUN;
  curseurs.push(W.curseur(hs, { id: 'R', nom: 'Barres R', titre: 'Groupe de régulation R', unite: 'pas extraits', verrou: 'barres', min: () => 0, max: () => C.pas_max, pas: 1,
    get: () => u.R, set: v => { u.R = v; }, reel: () => C.pas_max * (1 - s.xR), auto: () => u.autoR || s.aar,
    aide: 'Position demandée des grappes de commande : 225 = entièrement extraites, 0 = insérées. Les grappes se déplacent à 72 pas par minute au maximum : le trait orange montre leur position réelle. En pilotage automatique, le curseur bouge tout seul.' }));
  curseurs.push(W.curseur(hs, { id: 'bore', nom: 'Bore', titre: 'Concentration en bore', unite: 'ppm', verrou: 'bore', min: () => 0, max: () => 2000, pas: 5,
    get: () => u.bore, set: v => { u.bore = v; }, reel: () => s.bore,
    aide: 'Acide borique dissous dans l\'eau du primaire : il absorbe les neutrons (−10 pcm par ppm). Borication ou dilution lentes (10 ppm par minute). Sert à compenser les effets lents (xénon, usure du combustible) pour garder les barres presque extraites.' }));
  curseurs.push(W.curseur(hs, { id: 'turb', nom: 'Charge turbine', titre: 'Consigne de charge de la turbine', unite: '% Pn', verrou: 'turbine', min: () => 0, max: () => 100, pas: 1,
    get: () => u.turb * 100, set: v => { u.turb = v / 100; }, reel: () => s.charge * 100, auto: () => s.turbine !== 'couplee',
    aide: 'Puissance électrique demandée, en % de la puissance nominale. C\'est la turbine qui commande : quand elle prend moins de vapeur, le primaire se réchauffe, la réactivité baisse et le réacteur réduit sa puissance tout seul.' }));
  curseurs.push(W.curseur(hs, { id: 'gct', nom: 'Consigne GCT', titre: 'Contournement de la turbine (GCT)', unite: 'bar vapeur', verrou: 'secondaire', min: () => 20, max: () => Math.round(G.p2_zero + 8), pas: 1,
    get: () => u.gctConsigne, set: v => { u.gctConsigne = v; }, reel: () => clamp(s.out.Ph || 0, 20, G.p2_zero + 8),
    aide: 'Si la pression vapeur dépasse cette consigne, la vapeur est envoyée directement au condenseur (ou à l\'atmosphère si le condenseur est perdu). Baisser la consigne refroidit le primaire : la température d\'ébullition dans les GV suit la pression (77 bar ↔ 292 °C, 70 bar ↔ 286 °C, 50 bar ↔ 264 °C).' }));
  curseurs.push(W.curseur(hs, { id: 'pzr', nom: 'Consigne P prim.', titre: 'Consigne de pression primaire', unite: 'bar', verrou: 'pzr', min: () => 20, max: () => 160, pas: 1,
    get: () => u.Pconsigne, set: v => { u.Pconsigne = v; }, reel: () => clamp(s.P, 20, 160), auto: () => !u.pzrAuto,
    aide: 'Pression que la régulation du pressuriseur cherche à tenir (chaufferettes si la pression est trop basse, aspersion si elle est trop haute). Normalement 155 bar. On la baisse volontairement lors d\'une rupture de tube de GV, pour annuler la fuite.' }));

  // ---- boutons par boucle ----
  const rangee = (id, cle, aide) => {
    const r = $(id); r.querySelectorAll('.tg').forEach(b => b.remove());
    for (let i = 0; i < K.NB; i++) {
      const b = document.createElement('button'); b.className = 'tg'; b.id = 'b-' + cle + i; b.textContent = (cle === 'pompes' ? 'P' : 'GV') + (i + 1);
      b.dataset.aide = aide(i);
      b.onclick = () => { u[cle][i] = !u[cle][i]; bip(660, 0.04); };
      r.appendChild(b);
    }
  };
  rangee('r-pompes', 'pompes', i => `Pompe primaire ${i + 1}|Vert : en service. Cliquez pour l'arrêter ou la redémarrer.`);
  rangee('r-viv', 'viv', i => `Vanne vapeur du GV${i + 1}|Vert : ouverte (le GV alimente la turbine). Rouge : fermée (GV isolé côté vapeur).`);
  rangee('r-alim', 'alim', i => `Alimentation en eau du GV${i + 1}|Vert : le GV reçoit de l'eau (normale ou secours). Rouge : alimentation isolée.`);

  // ---- synoptique ----
  syn = App.syn = Syn.construire($('svg-hote'), K); syn.montrerFuite = true;
  for (let i = 0; i < K.NB; i++) {
    syn.q('syn-viv' + i).addEventListener('click', () => { if (App.debloque.has('secondaire')) u.viv[i] = !u.viv[i]; else toast('Les vannes vapeur seront débloquées plus tard dans les missions.'); });
    syn.q('syn-pompe' + i).addEventListener('click', () => { if (App.debloque.has('pompes')) u.pompes[i] = !u.pompes[i]; else toast('Les pompes primaires seront débloquées plus tard dans les missions.'); });
  }

  // ---- courbes ----
  hist = new W.Historique(['n', 'pe', 'ts', 'tm', 'te', 'p', 'ps', 'np', 'gmin', 'gmax']);
  hist.ajouter(-30, echantillon(sim)); hist.ajouter(0, echantillon(sim));      // un début de tracé, pour que les courbes ne soient pas vides
  const hp = $('p-courbes'); hp.innerHTML = ''; courbes = [];
  const coul = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const S1 = coul('--s1'), S2 = coul('--s2'), S3 = coul('--s3');
  courbes.push(W.courbe(hp, { titre: 'Puissance (%)', unite: '%', etendueMin: 10, min: 0, series: [{ nom: 'réacteur', cle: 'n', couleur: S1 }, { nom: 'électrique', cle: 'pe', couleur: S2 }] }, hist));
  courbes.push(W.courbe(hp, { titre: 'Températures du primaire (°C)', unite: '°C', etendueMin: 8, series: [{ nom: 'entrée cœur', cle: 'te', couleur: S1 }, { nom: 'sortie cœur', cle: 'ts', couleur: S2 }, { nom: 'moyenne', cle: 'tm', couleur: S3 }] }, hist));
  courbes.push(W.courbe(hp, { titre: 'Pressions (bar)', unite: 'bar', etendueMin: 10, series: [{ nom: 'primaire', cle: 'p', couleur: S1 }, { nom: 'vapeur', cle: 'ps', couleur: S2 }] }, hist));
  courbes.push(W.courbe(hp, { titre: 'Niveaux (%)', unite: '%', etendueMin: 10, dec: 0, series: [{ nom: 'pressuriseur', cle: 'np', couleur: S1 }, { nom: 'GV le plus bas', cle: 'gmin', couleur: S2 }, { nom: 'GV le plus haut', cle: 'gmax', couleur: S3 }] }, hist));
  App.couleurs = { S1, S2, S3 };

  // ---- bilan de réactivité ----
  $('p-reac').innerHTML = [['barresR', 'Barres de commande R'], ['barresS', 'Barres d\'arrêt S'], ['bore', 'Bore'], ['doppler', 'Doppler (combustible)'], ['moderateur', 'Modérateur (eau)'], ['xenon', 'Xénon 135'], ['total', 'RÉACTIVITÉ TOTALE']]
    .map(([k, n]) => `<div class="reac-ligne ${k === 'total' ? 'total' : ''}" data-aide="${n}|${AIDE_REAC[k]}"><span>${n}</span><div class="piste"><i id="rb-${k}"></i></div><span class="v" id="rv-${k}"></span></div>`).join('') +
    `<div class="reac-notes"><span>Échelle : ±<b id="r-ech">500</b> pcm</span><span>β effectif : <b id="r-beta"></b> pcm</span><span>Taux de démarrage : <b id="r-sur"></b> décades/min</span><span>Temps de doublement : <b id="r-dbl"></b></span><span>Flux : <b id="r-log"></b> de Pn</span><span>Puissance résiduelle : <b id="r-res"></b> %</span></div>`;
}
const AIDE_REAC = {
  barresR: 'Effet des grappes de commande par rapport à leur position de référence. Courbe en S : (B3) et (B4) de la fiche neutronique.',
  barresS: 'Les barres d\'arrêt valent −4000 pcm quand elles sont insérées, 0 quand elles sont extraites.',
  bore: 'Chaque ppm de bore en plus retire environ 10 pcm.',
  doppler: 'Quand le combustible chauffe, l\'uranium 238 capture plus de neutrons : contre-réaction immédiate et toujours stabilisante (environ −2,5 pcm/°C).',
  moderateur: 'Quand l\'eau chauffe, elle se dilate et ralentit moins bien les neutrons : la réactivité baisse. C\'est ce qui permet au réacteur de suivre la turbine.',
  xenon: 'Poison neutronique produit par la fission, avec plusieurs heures de retard. Après une baisse de puissance, il s\'accumule (pic vers 8 à 10 h) puis disparaît.',
  total: 'Somme de tous les effets. Zéro : puissance stable. Positive : la puissance monte. Au-delà de β (environ 650 pcm), le réacteur serait critique sur les seuls neutrons prompts.',
};

/* =====================================================================
   VERROUS (difficulté croissante)
   ===================================================================== */
function majVerrous() {
  document.querySelectorAll('[data-verrou]').forEach(el => {
    const k = el.dataset.verrou; if (!k) return;
    const libre = App.debloque.has(k);
    el.classList.toggle('verrouille', !libre);
    let c = el.querySelector(':scope > .cadenas');
    if (!libre && !c) { c = document.createElement('div'); c.className = 'cadenas'; c.title = 'Commande débloquée plus tard dans les missions'; el.appendChild(c); }
    if (libre && c) c.remove();
  });
  document.querySelectorAll('#temps .vit').forEach(b => b.classList.toggle('verrou', +b.dataset.v > 10 && !App.debloque.has('temps')));
}
App.debloquer = function (cles) { App.debloque = new Set(cles); majVerrous(); App.simplifier(); };

/* =====================================================================
   AFFICHAGE SIMPLIFIÉ (option) : moins d'éléments à l'écran, qui apparaissent
   aucune courbe. Un élément est visible s'il fait partie de la base de la mission
   (App.vue). Seule exception : une commande qu'une étape d'action demande de
   manœuvrer (classe « vu »). Les explications sur un élément caché sont sautées.
   Mode normal : rien n'est masqué. Aucun effet sur la physique ni sur les objectifs.
   ===================================================================== */
const UNITES = '.cadran, #curseurs .vs, #commandes [data-verrou], #bas, #verriere';
const VUE_LIBRE = { cadrans: ['n', 'pe', 'tm', 'p'], cles: ['turbine', 'barres', 'autoR', 'arret'], verriere: true };
App.vue = VUE_LIBRE;
App.simplifier = function () {
  const simple = !!App.opt.simple, v = App.vue;
  document.body.classList.toggle('simple', simple);
  document.querySelectorAll(UNITES).forEach(el => {
    let base = true;
    if (simple && !el.classList.contains('vu')) {
      if (el.classList.contains('cadran')) base = v.cadrans.includes(el.id.slice(4));
      else if (el.id === 'bas') base = false;
      else if (el.id === 'verriere') base = !!v.verriere;
      else base = v.cles.includes(el.dataset.verrou);
    }
    el.classList.toggle('masque', !base);
  });
  const b = $('btn-vue'); if (b) { b.textContent = simple ? '👁 Simplifié' : '👁 Complet'; b.classList.toggle('accent', simple); }
};
// appelé par le guidage pour une étape d'ACTION seulement : la commande à manœuvrer apparaît (jamais les courbes)
App.reveler = function (el) {
  if (!App.opt.simple) return;
  const u = el.closest(UNITES); if (u && u.id !== 'bas' && !u.classList.contains('vu')) { u.classList.add('vu'); u.classList.remove('masque'); }
};
// vrai si tout ce que désigne le sélecteur est supprimé de l'écran en affichage simplifié
App.cache = function (sel) {
  if (!App.opt.simple) return false;
  const els = [...document.querySelectorAll(sel)];
  return els.length > 0 && els.every(el => el.closest('.masque') || el.getBoundingClientRect().width === 0);
};
App.basculerVue = function (simple) {
  App.opt.simple = simple == null ? !App.opt.simple : simple; sauver(); App.simplifier();
  if (Guide.actif()) Guide.rendre();
};

/* =====================================================================
   TEMPS
   ===================================================================== */
App.regler = function (v) {
  if (v > 10 && !App.debloque.has('temps')) { toast('Les vitesses supérieures à ×10 se débloquent à la mission « Bore et xénon ».'); return; }
  App.vitesse = v;
  document.querySelectorAll('#temps .vit').forEach(b => b.classList.toggle('actif', +b.dataset.v === v));
};
App.basculerPause = function (p) {
  App.pause = p == null ? !App.pause : p;
  const b = $('btn-pause'); b.classList.toggle('pause', App.pause); b.textContent = App.pause ? '▶ Reprendre' : '⏸ Pause';
};

/* =====================================================================
   ALARMES (verrière)
   ===================================================================== */
const TUILES = [
  ['aar', 'Arrêt automatique réacteur', '', (s) => s.aar, 'Les grappes sont tombées dans le cœur. La cause est indiquée dans le journal.'],
  ['is', 'Injection de sécurité', '', (s) => s.IS, 'Les pompes d\'injection envoient de l\'eau borée dans le primaire.'],
  ['pb', 'Pression primaire basse', '', (s) => s.P < 138, 'Pression sous 138 bar. Arrêt automatique à 131 bar, injection de sécurité à 121 bar.'],
  ['ph', 'Pression primaire haute', '', (s) => s.P > 162, 'Pression au-dessus de 162 bar. Arrêt automatique à 165 bar, soupape à 166 bar.'],
  ['np', 'Niveau pressuriseur', 'ambre', (s, o) => o.nivPzr < 17 || o.nivPzr > 85, 'Niveau anormal : trop bas (fuite ou refroidissement) ou trop haut (échauffement, injection).'],
  ['mg', 'Marge à la saturation', '', (s, o) => o.marge < 10, 'L\'eau du primaire est proche de l\'ébullition : moins de 10 °C de marge.'],
  ['wr', 'Débit primaire bas', '', (s, o) => o.wr < 0.9, 'Une ou plusieurs pompes primaires sont arrêtées.'],
  ['fl', 'Flux neutronique élevé', 'ambre', (s) => s.n > 1.04, 'Puissance au-dessus de 104 %. Arrêt automatique à 109 %.'],
  ['ng', 'Niveau GV anormal', 'ambre', (s) => s.bcl.some(b => b.niv < 30 || b.niv > 80), 'Un générateur de vapeur a un niveau trop bas (manque d\'eau alimentaire) ou trop haut (fuite du primaire, suralimentation).'],
  ['act', 'Activité secondaire', '', (s) => s.bcl.some(b => b.act > 1.5), 'De la radioactivité est détectée dans la vapeur d\'un GV : de l\'eau primaire passe dans le secondaire (rupture de tube).'],
  ['sp', 'Soupape pressuriseur', 'ambre', (s) => s.soupape, 'Une soupape du pressuriseur est ouverte : le primaire perd de la vapeur.'],
  ['atm', 'Rejet vapeur atmosphère', 'ambre', (s, o) => o.W_atm > 1, 'De la vapeur est rejetée directement dehors (décharge à l\'atmosphère ou soupapes GV).'],
  ['asg', 'ASG en service', 'vert', (s, o) => o.W_asg > 0, 'L\'alimentation de secours alimente au moins un générateur de vapeur.'],
  ['dt', 'Turbine déclenchée', 'ambre', (s) => s.declTurb, 'L\'admission vapeur de la turbine est fermée.'],
  ['res', 'Réseau perdu', '', (s) => !s.reseau, 'La liaison avec le réseau électrique est coupée.'],
  ['cb', 'Combustible en danger', '', (s, o) => s.crise || s.gainesRompues || o.Tcentre > 2400 || o.decouvert > 0, 'Crise d\'ébullition, cœur découvert ou température excessive : la première barrière est menacée.'],
];
function construireVerriere() {
  const h = $('verriere'); h.innerHTML = ''; tuiles = [];
  for (const [id, nom, cl, test, aide] of TUILES) {
    const d = document.createElement('div'); d.className = 'tuile ' + cl; d.id = 'tu-' + id; d.textContent = nom; d.dataset.aide = nom + '|' + aide;
    d.onclick = () => d.classList.add('vu');
    h.appendChild(d); tuiles.push({ d, test, on: false, rouge: !cl });
  }
}
function majAlarmes() {
  const s = App.sim.s, o = s.out; let nouveauRouge = false;
  for (const t of tuiles) {
    const v = !!t.test(s, o);
    if (v !== t.on) { t.on = v; t.d.classList.toggle('on', v); t.d.classList.remove('vu'); if (v && t.rouge) nouveauRouge = true; }
  }
  if (nouveauRouge) {
    bip(880, 0.12, 3);
    if (App.vitesse > 10) { App.regler(1); toast('Alarme : vitesse ramenée à ×1.'); }
  }
}

/* =====================================================================
   AFFICHAGE
   ===================================================================== */
let nJournal = 0, compteur = 0;
const hms = t => { const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; };

function majCommandes() {
  const s = App.sim.s, u = App.sim.u, o = s.out, K = App.sim.K;
  const et = (id, on, cl, txt, des) => { const b = $(id); b.classList.toggle('on', !!on); if (cl) b.classList.toggle('off', cl === 'off'); if (txt != null && b.textContent !== txt) b.textContent = txt; if (des != null) b.disabled = des; };
  $('i-autoR').checked = u.autoR;
  const mvt = s.xS > 0.01 && s.xS < 0.99;
  et('b-S', s.xS < 0.01, s.xS > 0.99 ? 'off' : '', mvt ? 'En mouvement… ' + Math.round(225 * (1 - s.xS)) + ' pas' : s.xS < 0.5 ? 'Extraites · cliquer pour insérer' : 'Insérées · cliquer pour extraire', s.aar);
  const aar = $('btn-aar'); aar.classList.toggle('tombe', s.aar); aar.textContent = s.aar ? 'RÉACTEUR ARRÊTÉ (AAR)' : 'ARRÊT D\'URGENCE (AAR)';
  $('b-rearm').disabled = !s.aar;
  for (let i = 0; i < K.NB; i++) {
    const b = s.bcl[i];
    const p = $('b-pompes' + i); p.classList.toggle('on', u.pompes[i] && !b.pompeHS && s.elec); p.classList.toggle('off', b.pompeHS || !s.elec || !u.pompes[i]);
    const v = $('b-viv' + i); v.classList.toggle('on', u.viv[i]); v.classList.toggle('off', !u.viv[i]);
    const a = $('b-alim' + i); a.classList.toggle('on', u.alim[i]); a.classList.toggle('off', !u.alim[i]);
  }
  et('b-pzrAuto', u.pzrAuto, '', u.pzrAuto ? 'Auto' : 'Manuel');
  et('b-chauf', u.pzrAuto ? o.Qch > K.G.Q_chauf * 0.3 : u.chauf, '', null, u.pzrAuto);
  et('b-asp', u.pzrAuto ? o.masp > 0.5 : u.asp > 0, '', null, u.pzrAuto);
  et('b-soupOuv', s.soupape, '', s.soupape ? (s.soupapeBloquee ? 'BLOQUÉE ouverte' : 'Ouverte') : 'Ouvrir');
  et('b-soupIsol', u.soupapeIsol, '', u.soupapeIsol ? 'Isolée' : 'Isoler');
  et('b-is', s.IS, '', s.IS ? 'En service' : 'Démarrer');
  $('b-isStop').disabled = !s.IS;
  et('b-lancer', s.turbine === 'lancement' || s.turbine === 'prete', '', s.turbine === 'lancement' ? 'Lancement…' : s.turbine === 'prete' ? '1500 tr/min' : 'Lancer', s.turbine !== 'arret');
  et('b-coupler', s.turbine === 'couplee', '', s.turbine === 'couplee' ? 'Couplée' : s.turbine === 'ilotee' ? 'Recoupler' : 'Coupler', !(s.turbine === 'prete' || s.turbine === 'ilotee'));
  et('b-declT', s.declTurb, '', s.declTurb ? 'Déclenchée' : 'Déclencher', s.turbine === 'arret');
  document.querySelectorAll('[data-asg]').forEach(b => b.classList.toggle('on', u.asg === b.dataset.asg));
  for (const c of curseurs) c.maj();
}

function majReac() {
  const s = App.sim.s, o = s.out, r = o.rho;
  let ech = 500; for (const k in r) if (k !== 'incident') ech = Math.max(ech, Math.abs(r[k]));
  ech = ech <= 500 ? 500 : ech <= 2000 ? 2000 : ech <= 5000 ? 5000 : 12000;
  $('r-ech').textContent = ech;
  for (const k of ['barresR', 'barresS', 'bore', 'doppler', 'moderateur', 'xenon', 'total']) {
    const v = r[k] || 0, b = $('rb-' + k), f = clamp(Math.abs(v) / ech, 0, 1) * 50;
    b.style.width = f + '%'; b.style.left = (v < 0 ? 50 - f : 50) + '%'; b.style.background = v < 0 ? App.couleurs.S1 : App.couleurs.S2;
    $('rv-' + k).textContent = (v > 0 ? '+' : '') + Math.round(v) + ' pcm';
  }
  $('r-beta').textContent = Math.round(App.sim.K.ref.beta * 1e5);
  $('r-sur').textContent = (s.sur >= 0 ? '+' : '') + s.sur.toFixed(2);
  $('r-dbl').textContent = isFinite(o.doublement) && o.doublement < 1e5 ? W.fmtDuree(o.doublement) : '∞';
  $('r-log').textContent = s.n > 0.001 ? (s.n * 100).toFixed(1) + ' %' : '10^' + Math.log10(s.n).toFixed(1);
  $('r-res').textContent = (s.qRes * 100).toFixed(2);
}

function dessinerPT() {
  const sim = App.sim, s = sim.s, E = REP.eau, { g, w, h } = W.prepCanvas($('cv-pt'));
  const mg = { g: 40, d: 12, h: 8, b: 22 }, T0 = 180, T1 = 365, P0 = 0, P1 = 180;
  const X = T => mg.g + (T - T0) / (T1 - T0) * (w - mg.g - mg.d), Y = P => mg.h + (1 - (P - P0) / (P1 - P0)) * (h - mg.h - mg.b);
  g.font = '10px ui-monospace, monospace';
  // zone d'ébullition (à droite de la courbe de saturation)
  g.beginPath(); g.moveTo(X(T0), Y(E.Psat(T0)));
  for (let T = T0; T <= T1; T += 3) g.lineTo(X(T), Y(Math.min(P1, E.Psat(T))));
  g.lineTo(X(T1), Y(P0)); g.lineTo(X(T0), Y(P0)); g.closePath(); g.fillStyle = 'rgba(217,89,38,.10)'; g.fill();
  g.fillStyle = '#6f8294'; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let P = 0; P <= 180; P += 40) { g.strokeStyle = '#1e2a36'; g.beginPath(); g.moveTo(mg.g, Y(P) + .5); g.lineTo(w - mg.d, Y(P) + .5); g.stroke(); g.fillText(P, mg.g - 4, Y(P)); }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (let T = 200; T <= 360; T += 40) g.fillText(T + ' °C', X(T), h - 6);
  g.save(); g.translate(10, h / 2); g.rotate(-Math.PI / 2); g.fillText('pression (bar)', 0, 0); g.restore();
  g.strokeStyle = App.couleurs.S2; g.lineWidth = 2; g.beginPath();
  for (let T = T0; T <= T1; T += 2) { const y = Y(E.Psat(T)); T === T0 ? g.moveTo(X(T), y) : g.lineTo(X(T), y); } g.stroke();
  g.fillStyle = '#a9b8c6'; g.textAlign = 'left'; g.fillText('LIQUIDE (sous-refroidi)', X(205), Y(120)); g.fillText('VAPEUR', X(330), Y(40));
  // trajectoire du point primaire
  const n = hist.t.length;
  g.strokeStyle = App.couleurs.S1; g.globalAlpha = .45; g.lineWidth = 1.5; g.beginPath();
  for (let i = 0; i < n; i++) { const x = X(clamp(hist.d.ts[i], T0, T1)), y = Y(clamp(hist.d.p[i], P0, P1)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.globalAlpha = 1;
  const pt = (T, P, c, lab) => { const x = X(clamp(T, T0, T1)), y = Y(clamp(P, P0, P1)); g.fillStyle = c; g.strokeStyle = '#121a23'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#e8eef4'; const dr = x + g.measureText(lab).width + 14 > w; g.textAlign = dr ? 'right' : 'left'; g.fillText(lab, x + (dr ? -9 : 9), y - 7); };
  const ps = s.out.Ph || s.bcl[0].Ps;
  pt(E.Tsat(ps), ps, App.couleurs.S3, 'GV ' + ps.toFixed(0) + ' bar');
  pt(s.Ts, s.P, App.couleurs.S1, 'primaire ' + s.Ts.toFixed(0) + ' °C / ' + s.P.toFixed(0) + ' bar · marge ' + s.out.marge.toFixed(0) + ' °C');
}

function dessinerCrayon() {
  const sim = App.sim, s = sim.s, o = s.out, K = sim.K, G = K.G, { g, w, h } = W.prepCanvas($('cv-crayon'));
  const pr = o.profil; if (!pr) return;
  const mg = { g: 44, d: 12, h: 8, b: 22 }, pw = w - mg.g - mg.d, ph = h - mg.h - mg.b;
  // crayon chaud : même forme, mise à l'échelle sur la température au centre
  const fc = (o.Tcentre - o.Tm) / Math.max(1, pr.centre - o.Tm);
  const chaud = k => o.Tm + (pr[k] - o.Tm) * fc;
  const hi = Math.max(1200, Math.ceil((Math.max(o.Tcentre, pr.centre) + 150) / 400) * 400), lo = 200;
  const xs = { c: 0, s: 0.62, gi: 0.68, ge: 0.78, e: 1 };                       // abscisses schématiques (rayon non à l'échelle)
  const X = f => mg.g + f * pw, Y = T => mg.h + (1 - (T - lo) / (hi - lo)) * ph;
  const bandes = [[0, xs.s, 'pastille UO₂', '#2a2433'], [xs.s, xs.gi, 'jeu', '#1b232c'], [xs.gi, xs.ge, 'gaine', '#2b3440'], [xs.ge, 1, 'eau', '#12293d']];
  g.font = '10px ui-monospace, monospace';
  for (const [a, b, n, c] of bandes) { g.fillStyle = c; g.fillRect(X(a), mg.h, X(b) - X(a), ph); g.fillStyle = '#a9b8c6'; g.textAlign = 'center'; g.fillText(n, (X(a) + X(b)) / 2, h - 6); }
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const T of W.echelle(lo, hi, 4)) { g.strokeStyle = '#ffffff12'; g.beginPath(); g.moveTo(mg.g, Y(T) + .5); g.lineTo(w - mg.d, Y(T) + .5); g.stroke(); g.fillStyle = '#6f8294'; g.fillText(T, mg.g - 4, Y(T)); }
  g.textBaseline = 'alphabetic';
  if (hi >= 2840) { g.strokeStyle = '#ff4d4d'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(mg.g, Y(2840)); g.lineTo(w - mg.d, Y(2840)); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff9d9d'; g.textAlign = 'right'; g.fillText('fusion UO₂ 2840 °C', w - mg.d - 4, Y(2840) - 4); }
  const trace = (f, c, nom) => {
    g.strokeStyle = c; g.lineWidth = 2; g.beginPath();
    const Tc = f('centre'), Tsu = f('surf');
    for (let i = 0; i <= 20; i++) { const r = i / 20, T = Tc - (Tc - Tsu) * r * r; i ? g.lineTo(X(r * xs.s), Y(T)) : g.moveTo(X(0), Y(T)); }   // parabole (24)
    g.lineTo(X(xs.gi), Y(f('gaine_int'))); g.lineTo(X(xs.ge), Y(f('gaine_ext'))); g.lineTo(X(xs.ge + 0.04), Y(f('eau'))); g.lineTo(X(1), Y(f('eau'))); g.stroke();
    g.fillStyle = '#e8eef4'; g.textAlign = 'left'; g.fillText(nom + ' : ' + Math.round(Tc) + ' °C au centre', X(0.02), Y(Tc) - 5);
  };
  trace(k => pr[k], App.couleurs.S1, 'crayon moyen');
  trace(chaud, App.couleurs.S2, 'crayon le plus chaud');
  $('crayon-titre').innerHTML = `Température dans un crayon combustible <span class="leg"><i style="background:var(--s1)"></i>crayon moyen</span><span class="leg"><i style="background:var(--s2)"></i>crayon le plus chaud (F<sub>Q</sub> = ${G.F_Q})</span><span class="leg">gaine : ${Math.round(o.Tgaine)} °C · marge à la crise d'ébullition (REC) : ${o.REC >= 9.9 ? '> 9' : o.REC.toFixed(2)}</span>`;
}

function majJournal() {
  const ev = App.sim.s.events, j = $('journal');
  if (ev.length < nJournal) { nJournal = 0; j.innerHTML = ''; }
  for (; nJournal < ev.length; nJournal++) {
    const e = ev[nJournal], d = document.createElement('div');
    d.className = e.niveau; d.innerHTML = `<b>${hms(e.t)}</b>${e.msg}`; j.prepend(d);
  }
  const dern = ev[ev.length - 1];
  $('onglet-note').textContent = dern ? hms(dern.t) + ' · ' + dern.msg.slice(0, 70) : '';
}

function afficher(dtReel) {
  const sim = App.sim, s = sim.s, o = s.out;
  cadrans.n.maj(s.n * 100); cadrans.pe.maj(s.Pe / 1e6); cadrans.tm.maj(o.Tmoy, o.Tref); cadrans.p.maj(s.P);
  cadrans.np.maj(o.nivPzr); cadrans.mg.maj(clamp(o.marge, 0, 99)); cadrans.tc.maj(o.Tcentre); cadrans.wr.maj(o.wr * 100);
  Syn.maj(syn, sim, dtReel, !Guide.gele() && !App.pause);
  const hg = $('horloge'); hg.firstChild.textContent = hms(s.t);
  $('horloge-etat').textContent = Guide.gele() ? 'temps figé (guidage)' : App.pause ? 'en pause' : App.vitesse === 1 ? 'temps réel' : 'accéléré ×' + App.vitesse;
  compteur++;
  if (compteur % 4 === 0) { majCommandes(); majAlarmes(); majJournal(); }
  if (compteur % 10 === 0) {
    const ong = document.querySelector('#onglets button.actif').dataset.o;
    if (ong === 'courbes') for (const c of courbes) c.dessiner();
    else if (ong === 'reac') majReac(); else if (ong === 'pt') dessinerPT(); else if (ong === 'crayon') dessinerCrayon();
    majMission();
  }
}

/* =====================================================================
   BOUCLE PRINCIPALE
   ===================================================================== */
let dernier = 0;
function echantillon(sim) {
  const s = sim.s, o = s.out, b = s.bcl;
  return { n: s.n * 100, pe: 100 * s.Pe / sim.K.G.P_e, ts: s.Ts, tm: o.Tmoy, te: s.Tdesc, p: s.P, ps: o.Ph > 2 ? o.Ph : b[0].Ps, np: o.nivPzr, gmin: clamp(Math.min(...b.map(x => x.niv)), 0, 120), gmax: clamp(Math.max(...b.map(x => x.niv)), 0, 120) };
}
function boucle(ts) {
  const dtReel = Math.min(0.1, (ts - dernier) / 1000 || 0.016); dernier = ts;
  const sim = App.sim;
  if (sim) {
    if (!App.pause && !Guide.gele() && !App.fini) {
      const v = App.vitesse, dtMax = v <= 5 ? 0.05 : v <= 60 ? 0.1 : 0.2;
      const t0 = sim.s.t;
      sim.avancer(dtReel * v, dtMax);
      const s = sim.s, o = s.out, b = s.bcl;
      hist.ajouter(s.t, echantillon(sim));
      suivreMission(s.t - t0);
      if (s.fusion && !App.fini) finPartie();
    }
    Guide.tic(sim);
    afficher(dtReel);
  }
  requestAnimationFrame(boucle);
}
function finPartie() {
  App.fini = true; bip(220, 0.5, 2);
  if (Guide.actif()) Guide.fermer(false);
  $('fin-titre').textContent = 'Fusion du combustible';
  $('fin-texte').textContent = 'Le cœur n\'a plus été refroidi : la température au centre des pastilles a dépassé 2840 °C. C\'est un accident grave, comme à Three Mile Island (1979) ou Fukushima (2011). Regardez le journal pour comprendre l\'enchaînement, puis recommencez.';
  $('fin-partie').style.display = 'flex';
  document.querySelector('#onglets [data-o="journal"]').click();
}

/* =====================================================================
   MISSIONS : objectifs suivis en continu
   ===================================================================== */
const nomM = def => def.cours ? 'Cours' : 'Mission ' + def.num;
App.lancerMission = function (id) {
  const def = root.Contenus.MISSIONS.find(m => m.id === id);
  App.nouvelle({ etat: def.etat || 'nominal' });
  App.vue = { cadrans: def.cadrans || ['n', 'pe', 'tm'], cles: def.vueCles || def.debloque, verriere: true };
  App.debloquer(def.debloque);
  if (def.preparer) def.preparer(App.sim);
  App.mission = { def, i: 0, tenu: 0, etat: 'intro' };
  $('chip-nom').textContent = nomM(def); $('chip-texte').textContent = def.titre;
  Guide.lancer({ titre: nomM(def) + ' · ' + def.titre, large: def.cours, etapes: def.intro, onFin: termine => {
    if (!App.mission || App.mission.def !== def) return;
    if (def.cours && !termine) {                                    // cours quitté en route : pas validé, on passe en mode libre
      App.mission = null; App.debloquer(TOUT); $('chip-nom').textContent = 'Mode libre'; $('chip-texte').textContent = 'Cours interrompu : vous pouvez le reprendre avec le bouton 🎯 Missions.';
      $('objectifs').style.display = 'none'; return;
    }
    App.mission.etat = 'cours'; majMission();
  } });
};
App.modeLibre = function (o) {
  App.nouvelle(o); App.vue = VUE_LIBRE; App.debloquer(TOUT);
  if (!o || o.etat !== 'arret') App.sim.u.autoR = true;             // en puissance, la tranche démarre avec son pilotage automatique
  $('chip-nom').textContent = 'Mode libre'; $('chip-texte').textContent = 'Toutes les commandes sont débloquées. Essayez un incident avec le bouton ⚡.';
  $('chip-jauge').style.width = '0'; $('objectifs').style.display = 'none';
};
function suivreMission(dtSim) {
  const m = App.mission; if (!m || m.etat !== 'cours') return;
  const sim = App.sim, def = m.def;
  const raison = def.echec && def.echec(sim);
  if (raison) { m.etat = 'echec'; bilanMission(false, raison); return; }
  const ob = def.objectifs[m.i];
  const ok = ob.test(sim);
  if (ok) m.tenu += dtSim; else m.tenu = Math.max(0, m.tenu - dtSim * 2);
  if (ok && m.tenu >= (ob.maintien || 0)) {
    m.i++; m.tenu = 0; bip(990, 0.09, 2);
    if (ob.apres) ob.apres(sim);
    if (m.i >= def.objectifs.length) { m.etat = 'gagne'; App.prog.missions[def.id] = true; sauver(); bilanMission(true); }
    else if (def.objectifs[m.i].guide) Guide.lancer({ titre: nomM(def) + ' · ' + def.titre, alerte: def.objectifs[m.i].alerte, etapes: def.objectifs[m.i].guide });
  }
}
function majMission() {
  const m = App.mission, box = $('objectifs');
  if (!m || m.etat === 'intro') { box.style.display = 'none'; return; }
  let h = '<h4>Objectifs de la mission</h4>';
  m.def.objectifs.forEach((ob, k) => {
    const fait = k < m.i || m.etat === 'gagne', cours = k === m.i && m.etat === 'cours';
    h += `<div class="${fait ? 'fait' : ''}" style="${!fait && !cours ? 'opacity:.45' : ''}"><span>${fait ? '✔' : cours ? '▶' : '○'}</span><span style="flex:1">${ob.texte}</span>${cours && ob.maintien ? `<span class="barre"><i style="width:${Math.round(100 * m.tenu / ob.maintien)}%"></i></span>` : ''}</div>`;
  });
  if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
  box.style.display = 'block';
  $('chip-jauge').style.width = Math.round(100 * (m.i + (m.def.objectifs[m.i] && m.def.objectifs[m.i].maintien ? m.tenu / m.def.objectifs[m.i].maintien : 0)) / m.def.objectifs.length) + '%';
}
function bilanMission(gagne, raison) {
  const m = App.mission, def = m.def, s = App.sim.s, M = root.Contenus.MISSIONS, suiv = M[M.indexOf(def) + 1];
  if (Guide.actif()) Guide.fermer(false);
  App.basculerPause(true);
  const stats = `<div class="bilan"><div><b>${hms(s.t)}</b><span>durée simulée</span></div><div><b>${s.energie.toFixed(0)}</b><span>MWh produits</span></div><div><b>${s.events.filter(e => e.niveau === 'alarme').length}</b><span>alarmes</span></div></div>`;
  if (gagne) {
    bip(660, 0.12, 3);
    ouvrirModal(def.cours ? 'Cours terminé ✔' : 'Mission ' + def.num + ' réussie ✔', `<p>${typeof def.bilan === 'function' ? def.bilan(App.sim) : def.bilan}</p>${def.cours ? '' : stats}
      ${suiv ? `<p><b>${def.cours ? 'Votre première commande, dans la mission 1' : 'Nouvelles commandes débloquées'} :</b> ${suiv.nouveau}</p>` : '<p><b>Parcours terminé.</b> Toutes les commandes sont débloquées : place au mode libre et aux incidents.</p>'}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${suiv ? `<button class="bt accent" id="m-suiv">Mission suivante : ${suiv.titre} ▶</button>` : ''}<button class="bt" id="m-libre">Continuer librement sur cette partie</button><button class="bt" id="m-liste">Toutes les missions</button></div>`);
    if (suiv) $('m-suiv').onclick = () => { fermerModal(); App.lancerMission(suiv.id); };
  } else {
    ouvrirModal('Mission interrompue', `<p><b>${raison}</b></p><p>${def.conseil || ''}</p>${stats}
      <div style="display:flex;gap:8px;margin-top:12px"><button class="bt accent" id="m-re">Recommencer la mission</button><button class="bt" id="m-libre">Continuer librement</button><button class="bt" id="m-liste">Toutes les missions</button></div>`);
    $('m-re').onclick = () => { fermerModal(); App.lancerMission(def.id); };
  }
  $('m-libre').onclick = () => { fermerModal(); App.basculerPause(false); App.mission = null; App.debloquer(TOUT); $('chip-nom').textContent = 'Mode libre'; $('chip-texte').textContent = 'Partie poursuivie librement.'; $('objectifs').style.display = 'none'; };
  $('m-liste').onclick = () => fenetreMissions();
}

/* =====================================================================
   INCIDENTS
   ===================================================================== */
App.incident = function (id, guide) {
  const sim = App.sim, inc = REP.surete.INCIDENTS[id];
  if (App.fini) return;
  if (inc.possible && !inc.possible(sim.s)) { toast('Cet incident n\'a de sens que si la tranche est couplée au réseau.'); return; }
  if (App.mission) { App.mission = null; $('objectifs').style.display = 'none'; toast('Mission interrompue : la partie continue en mode libre.'); }
  App.debloquer(TOUT);
  App.basculerPause(false); if (App.vitesse > 5) App.regler(1);
  sim.incident(id);
  bip(880, 0.15, 4);
  $('chip-nom').textContent = 'Incident'; $('chip-texte').textContent = inc.nom; $('chip-jauge').style.width = '0';
  syn.montrerFuite = !guide;
  if (guide) {
    const g = root.Contenus.GUIDES[id];
    Guide.lancer({ titre: '⚡ ' + inc.court, alerte: true, etapes: g.etapes, onFin: fini => {
      syn.montrerFuite = true;
      if (fini) { App.prog.incidents[id] = true; sauver(); bip(660, 0.12, 3); }
    } });
  }
};

/* =====================================================================
   FENÊTRES
   ===================================================================== */
function ouvrirModal(titre, html) { $('modal-titre').innerHTML = titre; $('modal-contenu').innerHTML = html; $('modal').style.display = 'flex'; }
function fermerModal() { $('modal').style.display = 'none'; }
App.ouvrirModal = ouvrirModal; App.fermerModal = fermerModal;

function fenetreAccueil() {
  ouvrirModal('', `<div id="accueil"><div class="sous">Projet Procom · IMT Atlantique · spécialisation nucléaire</div><h1>Simulateur de réacteur à eau pressurisée</h1>
    <p>Prenez les commandes d'une centrale nucléaire simplifiée : neutronique du cœur, circuit primaire, pressuriseur, générateurs de vapeur, turbine. Les modèles physiques sont ceux des fiches de l'équipe (cinétique ponctuelle à 6 groupes, bilans thermiques par nœuds, pressuriseur à l'équilibre liquide-vapeur).</p>
    <p><b>Vous n'y connaissez rien ?</b> Le cours (15 minutes) explique la fission, la réaction en chaîne et le rôle de chaque bouton avec des comparaisons simples. Ensuite, les commandes se débloquent mission après mission, jusqu'aux accidents (rupture de tube de générateur de vapeur, perte du réseau, brèche...). À tout moment, le bouton <b>⚡ Incident</b> permet de déclencher une panne : le temps se fige, la cause est expliquée et vous êtes guidé pas à pas.</p>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="bt accent" id="a-cours" style="font-size:15px;padding:9px 16px">🎓 Je débute : commencer par le cours</button><button class="bt" id="a-tuto" style="padding:9px 16px">▶ Je connais le principe : mission 1</button><button class="bt" id="a-missions" style="padding:9px 16px">🎯 Choisir une mission</button><button class="bt" id="a-libre" style="padding:9px 16px">Mode libre (tout débloqué)</button></div>
    <label style="display:flex;gap:8px;align-items:flex-start;margin-top:14px;cursor:pointer"><input type="checkbox" id="a-simple" ${App.opt.simple ? 'checked' : ''} style="margin-top:3px"><span><b>Affichage simplifié</b> : l'écran ne garde que l'essentiel (quelques cadrans, les commandes utiles, aucune courbe) et le cours ne présente que ce qui est affiché. Conseillé pour une première découverte. Le bouton 👁 en haut de l'écran permet de changer à tout moment.</span></label>
    <p style="font-size:11.5px;margin-top:14px">Outil pédagogique : les ordres de grandeur sont réalistes, mais ce n'est ni un simulateur d'exploitation ni une étude de sûreté.</p></div>`);
  $('a-simple').onchange = e => App.basculerVue(e.target.checked);
  $('a-cours').onclick = () => { fermerModal(); App.lancerMission('m0'); };
  $('a-tuto').onclick = () => { fermerModal(); App.lancerMission('m1'); };
  $('a-missions').onclick = fenetreMissions;
  $('a-libre').onclick = () => { fermerModal(); App.modeLibre({}); };
}
function fenetreMissions() {
  const M = root.Contenus.MISSIONS; let h = '<p>Le cours explique tout depuis le début. Ensuite, chaque mission débloque de nouvelles commandes. Vous pouvez refaire une mission réussie ou passer en mode libre à tout moment.</p><div class="liste">';
  M.forEach((m, k) => {
    const ok = k <= 1 || App.prog.missions[M[k - 1].id] || App.prog.toutOuvert;
    h += `<button class="fiche ${App.prog.missions[m.id] ? 'fait' : ''} ${ok ? '' : 'bloque'}" data-m="${m.id}" ${ok ? '' : 'disabled'}><span class="niv">${m.cours ? '🎓 Le cours pour débuter' : 'Mission ' + m.num} · ${m.duree}</span><h3>${m.titre}</h3><p>${m.resume}</p><p style="color:var(--accent)">${m.cours ? 'Aucune manipulation : ' : 'Débloque : '}${m.nouveau}</p></button>`;
  });
  h += `<button class="fiche" data-m="libre"><span class="niv">Sans objectif</span><h3>Mode libre</h3><p>Toutes les commandes, à pleine puissance. Idéal pour essayer les incidents.</p></button>
        <button class="fiche" data-m="arret"><span class="niv">Sans objectif</span><h3>Mode libre : démarrage</h3><p>Réacteur à l'arrêt à chaud, sans xénon. À vous de diverger et de monter en puissance.</p></button></div>
        <p style="margin-top:12px"><button class="lien" id="m-ouvrir" style="background:none;border:0;color:var(--muet);text-decoration:underline">débloquer toutes les missions</button></p>`;
  ouvrirModal('🎯 Missions', h);
  document.querySelectorAll('#modal [data-m]').forEach(b => b.onclick = () => { const id = b.dataset.m; fermerModal(); if (id === 'libre') App.modeLibre({}); else if (id === 'arret') App.modeLibre({ etat: 'arret' }); else App.lancerMission(id); });
  $('m-ouvrir').onclick = () => { App.prog.toutOuvert = true; sauver(); fenetreMissions(); };
}
function fenetreIncidents() {
  const I = REP.surete.INCIDENTS; let h = `<p>L'incident se produit immédiatement, sur la partie en cours. Avec le guidage, le temps se fige pour expliquer la cause, puis chaque action à faire est montrée par une flèche.</p>
    <label class="coche" style="margin:8px 0"><input type="checkbox" id="inc-guide" checked> Avec guidage pas à pas (recommandé la première fois)</label><div class="liste">`;
  for (const id in I) { const i = I[id]; h += `<button class="fiche ${App.prog.incidents[id] ? 'fait' : ''}" data-i="${id}"><span class="grav">${'●'.repeat(i.gravite)}${'○'.repeat(3 - i.gravite)}</span><h3>${i.nom}</h3><p>${i.resume}</p></button>`; }
  ouvrirModal('⚡ Déclencher un incident', h + '</div>');
  document.querySelectorAll('#modal [data-i]').forEach(b => b.onclick = () => { const g = $('inc-guide').checked; fermerModal(); App.incident(b.dataset.i, g); });
}
function fenetreAide() {
  const C = root.Contenus;
  ouvrirModal('❔ Aide', `<p style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt accent" id="h-cours">🎓 Suivre le cours pour débutants</button><button class="bt" id="h-tuto">Revoir la visite guidée de l'écran</button></p>
    <h3>Comment marche un REP, en six phrases</h3><ol style="color:var(--texte2);line-height:1.55;padding-left:20px">${C.PRINCIPES.map(p => `<li>${p}</li>`).join('')}</ol>
    <h3>Raccourcis</h3><p><b>Espace</b> : pause · <b>1 à 7</b> : vitesse du temps · survol d'un élément : aide contextuelle en bas à droite.</p>
    <h3>Glossaire</h3><dl class="glossaire">${C.GLOSSAIRE.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`);
  $('h-cours').onclick = () => { fermerModal(); App.lancerMission('m0'); };
  $('h-tuto').onclick = () => { fermerModal(); Guide.lancer({ titre: 'Visite guidée', etapes: root.Contenus.VISITE }); };
}
function fenetreOptions() {
  const sel = (id, o, v) => `<select id="${id}">${o.map(([k, n]) => `<option value="${k}" ${k == v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  ouvrirModal('⚙ Options', `<div class="opt-ligne"><label>Palier</label>${sel('o-palier', [[900, 'REP 900 MWe (3 boucles)'], [1300, 'REP 1300 MWe (4 boucles)']], App.opt.palier)}</div>
    <div class="opt-ligne"><label>Avancement du cycle</label>${sel('o-cycle', Object.entries(REP.CYCLES).map(([k, c]) => [k, `${c.nom} (bore ${c.bore0} ppm, modérateur ${c.alpha_M} pcm/°C)`]), App.opt.cycle)}</div>
    <p style="font-size:12px">Changer le palier ou le cycle relance une partie en mode libre. En fin de cycle, le coefficient modérateur est très négatif : le réacteur suit la turbine beaucoup plus franchement.</p>
    <div class="opt-ligne"><label>Affichage simplifié</label><input type="checkbox" id="o-simple" ${App.opt.simple ? 'checked' : ''}><span style="font-size:12px">seulement l'essentiel : quelques cadrans, les commandes utiles à la mission, aucune courbe.</span></div>
    <div class="opt-ligne"><label>Son des alarmes</label><input type="checkbox" id="o-son" ${App.opt.son ? 'checked' : ''}></div>
    <div class="opt-ligne"><label>Inhiber les protections (expert)</label><input type="checkbox" id="o-inh" ${App.sim.u.inhibe ? 'checked' : ''}><span style="color:var(--alerte);font-size:12px">plus d'arrêt automatique ni d'injection de sécurité : pour voir ce que les protections évitent.</span></div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="bt accent" id="o-ok">Appliquer</button><button class="bt" id="o-raz">Effacer ma progression</button></div>`);
  $('o-ok').onclick = () => {
    const p = +$('o-palier').value, c = $('o-cycle').value, change = p !== App.opt.palier || c !== App.opt.cycle;
    App.opt.palier = p; App.opt.cycle = c; App.opt.son = $('o-son').checked; App.opt.simple = $('o-simple').checked; sauver();
    const inh = $('o-inh').checked; fermerModal();
    if (change) App.modeLibre({});
    App.sim.u.inhibe = inh; App.simplifier();
  };
  $('o-raz').onclick = () => { App.prog = { missions: {}, incidents: {}, tuto: false }; sauver(); toast('Progression effacée.'); };
}

/* =====================================================================
   BRANCHEMENT DES COMMANDES
   ===================================================================== */
function brancher() {
  const u = () => App.sim.u, s = () => App.sim.s, clic = (id, f) => $(id).addEventListener('click', () => { if (App.fini) return; f(); bip(660, 0.04); });
  const action = (nom) => { const r = App.sim.action(nom); if (r) toast(r); };
  $('btn-pause').onclick = () => App.basculerPause();
  document.querySelectorAll('#temps .vit').forEach(b => b.onclick = () => App.regler(+b.dataset.v));
  $('i-autoR').addEventListener('change', e => { u().autoR = e.target.checked; });
  clic('b-S', () => { u().S = !u().S; });
  clic('btn-aar', () => action('aar'));
  clic('b-rearm', () => action('rearmerAAR'));
  clic('b-pzrAuto', () => { u().pzrAuto = !u().pzrAuto; u().chauf = false; u().asp = 0; });
  clic('b-chauf', () => { u().chauf = !u().chauf; });
  clic('b-asp', () => { u().asp = u().asp ? 0 : 1; });
  clic('b-soupOuv', () => { if (s().soupapeBloquee) return toast('La soupape est bloquée ouverte : elle ne répond plus. Utilisez la vanne d\'isolement.'); u().soupapeOuv = !u().soupapeOuv; if (!u().soupapeOuv && s().P < 160) s().soupape = false; });
  clic('b-soupIsol', () => { u().soupapeIsol = !u().soupapeIsol; });
  clic('b-is', () => action('is'));
  clic('b-isStop', () => action('arreterIS'));
  clic('b-lancer', () => action('lancerTurbine'));
  clic('b-coupler', () => action('coupler'));
  clic('b-declT', () => action('declTurbine'));
  document.querySelectorAll('[data-asg]').forEach(b => b.addEventListener('click', () => { u().asg = b.dataset.asg; }));
  document.querySelectorAll('#onglets button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#onglets button').forEach(x => x.classList.toggle('actif', x === b));
    document.querySelectorAll('#panneau > div').forEach(d => d.classList.toggle('actif', d.id === 'p-' + b.dataset.o));
    compteur = 9;
  });
  $('btn-missions').onclick = fenetreMissions; $('chip-mission').onclick = fenetreMissions;
  $('btn-incident').onclick = fenetreIncidents; $('btn-aide').onclick = fenetreAide; $('btn-options').onclick = fenetreOptions; $('btn-vue').onclick = () => { App.basculerVue(); toast(App.opt.simple ? 'Affichage simplifié : seulement l\'essentiel.' : 'Affichage complet.'); };
  $('modal-fermer').onclick = () => { fermerModal(); if (App.mission && App.mission.etat !== 'cours' && App.mission.etat !== 'intro') App.basculerPause(false); };
  $('fin-recommencer').onclick = () => { if (App.mission) App.lancerMission(App.mission.def.id); else App.modeLibre({}); };
  // aide contextuelle au survol
  document.addEventListener('pointerover', e => {
    const el = e.target.closest && e.target.closest('[data-aide]'); if (!el) return;
    const [t, x] = el.dataset.aide.split('|'); $('info-titre').textContent = t; $('info-texte').textContent = x || '';
  });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); App.basculerPause(); }
    const v = [1, 2, 5, 10, 60, 600, 3600]['1234567'.indexOf(e.key)]; if (v) App.regler(v);
  });
}

addEventListener('DOMContentLoaded', () => {
  charger(); construireVerriere(); brancher();
  App.modeLibre({});
  requestAnimationFrame(boucle);
  fenetreAccueil();
});
})(window);
