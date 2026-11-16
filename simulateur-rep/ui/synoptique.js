/* ======== ui/synoptique.js ======== */
/* =====================================================================
   ui/synoptique.js — vue en coupe animée de la centrale (SVG)
   Le schéma s'adapte au nombre de boucles (3 ou 4 générateurs de vapeur).
   ===================================================================== */
(function (root) {
'use strict';
const S = root.Synoptique = {};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* couleur d'une tuyauterie selon sa température (bleu = froid, rouge = chaud) */
function coulT(T) {
  const f = clamp((T - 255) / (330 - 255), 0, 1);
  const a = [70, 120, 235], m = [150, 110, 190], b = [255, 92, 72];
  const mix = (p, q, t) => p.map((v, i) => Math.round(v + (q[i] - v) * t));
  const c = f < 0.5 ? mix(a, m, f * 2) : mix(m, b, (f - 0.5) * 2);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
S.coulT = coulT;

const vanne = (x, y, id, r) => `<g id="${id}" transform="translate(${x},${y}) rotate(${r || 0})"><path class="corps" d="M-7 -5L7 5V-5L-7 5Z" fill="#1c2a37" stroke="#9fb3c4" stroke-width="1.3" stroke-linejoin="round"/></g>`;
const tuyau = (d, id, coul, larg) => `<path d="${d}" fill="none" stroke="#070b10" stroke-width="${(larg || 7) + 3}" stroke-linejoin="round"/><path id="${id}" d="${d}" fill="none" stroke="${coul}" stroke-width="${larg || 7}" stroke-linejoin="round"/><path id="${id}-f" class="flux" d="${d}"/>`;

S.construire = function (hote, K) {
  const NB = K.NB, X0 = NB === 3 ? 305 : 290, DX = NB === 3 ? 112 : 88;
  const cx = i => X0 + i * DX, xDer = cx(NB - 1);
  let h = `<svg viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="g-coeur" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#c8f4ff"/><stop offset=".45" stop-color="#4fc3f7"/><stop offset="1" stop-color="#0b3a5c"/></radialGradient>
    <linearGradient id="g-cuve" x1="0" x2="1"><stop offset="0" stop-color="#3a4856"/><stop offset=".5" stop-color="#52657a"/><stop offset="1" stop-color="#2c3844"/></linearGradient>
    <filter id="lueur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <pattern id="hach" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#ffb020" stroke-width="2"/></pattern>
  </defs>
  <!-- bâtiment réacteur et salle des machines -->
  <path id="syn-enceinte" d="M14 508V110Q14 14 110 14H${xDer + 10}Q${xDer + 110} 14 ${xDer + 110} 110V508" fill="#0e151c" stroke="#33475a" stroke-width="3" data-aide="Bâtiment réacteur (enceinte)|Troisième barrière de confinement, en béton. Les deux premières sont la gaine du combustible et le circuit primaire lui-même."/>
  <text class="syn-lab" x="24" y="503">Bâtiment réacteur</text><text class="syn-lab" x="${xDer + 122}" y="503">Salle des machines</text>
  <line x1="${xDer + 110}" y1="508" x2="990" y2="508" stroke="#33475a" stroke-width="3"/>`;

  // --- eau alimentaire (dessinée d'abord : elle passe derrière les GV) ---
  const xT = xDer + 150;            // début de la zone turbine
  h += tuyau(`M${xT + 105} 205V238H${cx(0) + 26}`, 'syn-are', '#2f6ea5', 4);
  h += `<g id="syn-pompe-are" data-aide="Pompes alimentaires (ARE)|Renvoient l'eau du condenseur vers les générateurs de vapeur, après réchauffage (220 °C). La régulation ajuste le débit pour garder le niveau des GV à 50 %."><circle cx="${xT + 60}" cy="238" r="9" fill="#1c2a37" stroke="#9fb3c4" stroke-width="1.5"/><path class="rotor" d="M${xT + 60} 231v14M${xT + 53} 238h14" stroke="#cfd8dc" stroke-width="1.6"/></g>
  <text class="syn-txt" id="syn-are-t" x="${xT + 74}" y="254">ARE</text>`;
  // ASG
  const xA = xDer + 62;
  h += tuyau(`M${xA} 300V246H${cx(0) + 26}`, 'syn-asg', '#2a4c66', 3);
  h += `<g id="syn-asg-bache" data-aide="ASG : alimentation de secours des générateurs de vapeur|Réserve d'eau froide et pompes de secours. Elles prennent le relais quand l'eau alimentaire normale est perdue, pour continuer à évacuer la puissance résiduelle par les GV."><rect x="${xA - 16}" y="300" width="32" height="46" rx="5" fill="#16232f" stroke="#6f8294" stroke-width="1.5"/><rect id="syn-asg-eau" x="${xA - 13}" y="312" width="26" height="31" rx="3" fill="#2a6da8"/><text class="syn-lab" x="${xA}" y="358" text-anchor="middle">ASG</text><text class="syn-txt" id="syn-asg-t" x="${xA}" y="296" text-anchor="middle"></text></g>`;

  // --- collecteur vapeur, turbine, alternateur, condenseur ---
  h += tuyau(`M${cx(0)} 44H${xT}`, 'syn-coll', '#b9c4cc', 6);
  h += tuyau(`M${xT - 18} 44V152H${xT + 20}`, 'syn-gct', '#8a969e', 4);
  h += vanne(xT - 18, 96, 'syn-v-gct', 90);
  h += `<text class="syn-lab" x="${xT - 28}" y="118" text-anchor="end">GCT</text><text class="syn-txt" id="syn-gct-t" x="${xT - 28}" y="130" text-anchor="end"></text>
  <g id="syn-turbine" data-aide="Turbine|La vapeur se détend dans la turbine et la fait tourner à 1500 tr/min. Seul un tiers de la chaleur devient de l'électricité : le reste part au condenseur.">
    <path d="M${xT} 30L${xT + 34} 20V68L${xT} 58Z" fill="#22303d" stroke="#8fa4b6" stroke-width="1.6"/><path d="M${xT + 38} 26L${xT + 98} 6V82L${xT + 38} 62Z" fill="#22303d" stroke="#8fa4b6" stroke-width="1.6"/>
    <g id="syn-aubes" stroke="#4fc3f7" stroke-width="1.5" opacity=".8"><line x1="${xT + 52}" y1="24" x2="${xT + 52}" y2="64"/><line x1="${xT + 66}" y1="19" x2="${xT + 66}" y2="69"/><line x1="${xT + 80}" y1="14" x2="${xT + 80}" y2="74"/></g>
    <text class="syn-lab" x="${xT + 24}" y="97" text-anchor="middle">Turbine</text><text class="syn-txt" id="syn-turb-t" x="${xT + 24}" y="109" text-anchor="middle"></text></g>
  <rect x="${xT + 98}" y="40" width="20" height="8" fill="#5b6b7a"/>
  <g id="syn-alt" data-aide="Alternateur|Transforme la rotation de la turbine en électricité. Il doit être couplé au réseau (disjoncteur fermé) pour produire."><rect x="${xT + 118}" y="22" width="52" height="44" rx="7" fill="#22303d" stroke="#8fa4b6" stroke-width="1.6"/><path id="syn-alt-ic" d="M${xT + 134} 54L${xT + 154} 34M${xT + 134} 34L${xT + 154} 54" stroke="#ffb020" stroke-width="2.4" stroke-linecap="round"/><text class="syn-lab" x="${xT + 144}" y="78" text-anchor="middle">Alternateur</text></g>
  <path id="syn-ligne" d="M${xT + 170} 44H${xT + 196}l12 -22l12 22h20M${xT + 196} 44h24M${xT + 202} 33h12" fill="none" stroke="#ffb020" stroke-width="1.8"/>
  <g id="syn-reseau" data-aide="Réseau électrique|Puissance envoyée sur le réseau. Si le réseau disparaît, la tranche doit s'îloter (ne produire que pour elle-même) ou s'arrêter."><text class="syn-txt" id="syn-pe" x="${xT + 208}" y="62" text-anchor="middle" style="font-size:13px">900 MWe</text><text class="syn-lab" id="syn-reseau-t" x="${xT + 208}" y="14" text-anchor="middle">Réseau</text></g>
  <path d="M${xT + 68} 82V152" stroke="#8a969e" stroke-width="8"/>
  <g id="syn-cond" data-aide="Condenseur|La vapeur sortie de la turbine y redevient liquide au contact de tubes refroidis par l'eau de mer ou de rivière. C'est la source froide de la centrale : environ deux tiers de la chaleur du réacteur y partent."><rect x="${xT + 20}" y="150" width="130" height="56" rx="6" fill="#16232f" stroke="#8fa4b6" stroke-width="1.6"/><path d="M${xT + 30} 166h110M${xT + 30} 178h110M${xT + 30} 190h110" stroke="#2f7fc4" stroke-width="2"/><text class="syn-lab" x="${xT + 22}" y="218">Condenseur</text></g>
  <path id="syn-mer" class="flux" d="M990 170H${xT + 150}M${xT + 150} 190H990" style="stroke:#3b82c4;stroke-width:3;stroke-dasharray:8 6"/>
  <text class="syn-lab" x="988" y="160" text-anchor="end">Mer / rivière</text><text class="syn-txt" id="syn-mer-t" x="988" y="206" text-anchor="end"></text>`;

  // --- circuit primaire : branches chaudes et froides ---
  h += tuyau(`M148 268H215V442H${cx(NB - 1) - 12}`, 'syn-bc', '#ff5c48', 8);
  for (let i = 0; i < NB; i++) h += tuyau(`M${cx(i) - 12} 442V416`, 'syn-bc' + i, '#ff5c48', 7);
  h += tuyau(`M${cx(NB - 1) + 12} 488H182V306H148`, 'syn-bf', '#4678eb', 8);
  for (let i = 0; i < NB; i++) h += tuyau(`M${cx(i) + 12} 416V488`, 'syn-bf' + i, '#4678eb', 7);
  // ligne d'expansion + IS
  h += `<path d="M205 190V264" stroke="#070b10" stroke-width="7"/><path id="syn-exp" d="M205 190V264" stroke="#c0605a" stroke-width="4"/>`;
  h += tuyau('M62 470H182', 'syn-is', '#24506e', 3);
  h += `<g id="syn-is-bache" data-aide="Injection de sécurité (IS)|Réservoir d'eau borée et pompes haute pression. En cas de brèche ou de très basse pression, elles injectent de l'eau froide borée directement dans les branches froides."><rect x="26" y="448" width="36" height="46" rx="5" fill="#16232f" stroke="#6f8294" stroke-width="1.5"/><rect x="29" y="456" width="30" height="35" rx="3" fill="#2a8f7a"/><text class="syn-lab" x="44" y="444" text-anchor="middle">IS</text><text class="syn-txt" id="syn-is-t" x="70" y="464"></text><text class="syn-txt" id="syn-rcv-t" x="70" y="484" style="fill:#6f8294"></text></g>`;

  // --- cuve et cœur ---
  h += `<g id="syn-cuve" data-aide="Cuve et cœur du réacteur|${K.G.N_ass} assemblages de crayons d'uranium. La fission chauffe l'eau du primaire de ${Math.round(K.G.T_e)} à ${Math.round(K.G.T_s)} °C. L'eau sert aussi de modérateur : elle ralentit les neutrons pour entretenir la réaction en chaîne.">
    <rect x="80" y="150" width="50" height="62" rx="6" fill="#1a2632" stroke="#4a6278" stroke-width="1.5"/>
    <path d="M62 250Q62 205 105 205Q148 205 148 250V400Q148 446 105 446Q62 446 62 400Z" fill="url(#g-cuve)" stroke="#8fa4b6" stroke-width="2"/>
    <path id="syn-cuve-eau" d="M68 250Q68 211 105 211Q142 211 142 250V400Q142 440 105 440Q68 440 68 400Z" fill="#17466f"/>
    <rect id="syn-vide" x="68" y="211" width="74" height="0" fill="#c9d6de" opacity=".55"/>
    <ellipse id="syn-lueur" cx="105" cy="350" rx="44" ry="66" fill="#4fc3f7" filter="url(#lueur)" opacity=".5"/>
    <rect id="syn-coeur" x="76" y="292" width="58" height="118" rx="4" fill="url(#g-coeur)" stroke="#0a2a40" stroke-width="1"/>
    <g stroke="#06202f" stroke-width=".7" opacity=".6">${[84, 92, 100, 110, 118, 126].map(x => `<line x1="${x}" y1="292" x2="${x}" y2="410"/>`).join('')}</g>
    <g id="syn-barresS" stroke="#b6c2cc" stroke-width="3" stroke-linecap="round" data-aide="Barres d'arrêt (groupe S)|Grappes de sécurité, en gris. Extraites en fonctionnement, elles chutent par gravité à l'arrêt automatique.">${[97, 113].map(x => `<line x1="${x}" y1="172" x2="${x}" y2="292"/>`).join('')}</g>
    <g id="syn-barresR" stroke="#ffb020" stroke-width="3" stroke-linecap="round" data-aide="Groupe de régulation R|Grappes de commande, en orange. Elles absorbent les neutrons : les insérer fait baisser la réactivité. Leur efficacité suit une courbe en S (maximale au milieu du cœur).">${[86, 105, 124].map(x => `<line x1="${x}" y1="172" x2="${x}" y2="292"/>`).join('')}</g>
    <text class="syn-lab" x="105" y="462" text-anchor="middle">Cuve / cœur</text></g>
  <text class="syn-txt" id="syn-ts" x="152" y="261"></text><text class="syn-txt" id="syn-te" x="152" y="322"></text>
  <text class="syn-txt" id="syn-barres-t" x="22" y="168"></text><text class="syn-txt" id="syn-bore-t" x="22" y="180" style="fill:#a9b8c6"></text>`;

  // --- pressuriseur ---
  h += `<g id="syn-pzr" data-aide="Pressuriseur|Réservoir où coexistent eau et vapeur à 345 °C. Il impose la pression du primaire (155 bar) pour empêcher l'eau de bouillir dans le cœur, et absorbe les dilatations de l'eau. Chaufferettes pour monter la pression, aspersion pour la baisser.">
    <path d="M205 22V40" stroke="#8a969e" stroke-width="4"/>
    <rect x="186" y="56" width="38" height="134" rx="19" fill="#1a2632" stroke="#8fa4b6" stroke-width="2"/>
    <clipPath id="clip-pzr"><rect x="189" y="59" width="32" height="128" rx="16"/></clipPath>
    <rect x="189" y="59" width="32" height="128" fill="#3d4d5c" clip-path="url(#clip-pzr)"/>
    <rect id="syn-pzr-eau" x="189" y="120" width="32" height="70" fill="#c0605a" clip-path="url(#clip-pzr)"/>
    <g id="syn-asp" opacity="0" stroke="#7fb4ff" stroke-width="1.2"><path d="M205 62l-9 16M205 62l-3 18M205 62l3 18M205 62l9 16"/></g>
    <g id="syn-chauf" opacity="0" stroke="#ff9d2e" stroke-width="2" stroke-linecap="round"><path d="M196 182v-12M202 182v-12M208 182v-12M214 182v-12"/></g>
    <text class="syn-lab" x="180" y="64" text-anchor="end">Pressuriseur</text>
    <text class="syn-txt" id="syn-pzr-p" x="180" y="78" text-anchor="end"></text><text class="syn-txt" id="syn-pzr-n" x="180" y="90" text-anchor="end"></text><text class="syn-txt" id="syn-pzr-m" x="180" y="102" text-anchor="end" style="fill:#a9b8c6"></text></g>`;
  h += vanne(205, 44, 'syn-v-soup', 90);
  h += `<g id="syn-panache-pzr" opacity="0"><ellipse cx="205" cy="20" rx="12" ry="7" fill="#dfe8ee" filter="url(#lueur)"/><ellipse cx="205" cy="22" rx="7" ry="4" fill="#fff"/></g>`;

  // --- générateurs de vapeur, pompes, lignes vapeur ---
  for (let i = 0; i < NB; i++) {
    const x = cx(i);
    h += `<path d="M${x} 96V44" stroke="#070b10" stroke-width="9"/><path id="syn-lv${i}" d="M${x} 96V44" stroke="#b9c4cc" stroke-width="6"/><path id="syn-lv${i}-f" class="flux" d="M${x} 96V44"/>
    <g id="syn-gv${i}" data-aide="Générateur de vapeur ${i + 1}|Échangeur de chaleur : l'eau du primaire (rouge) passe dans des milliers de tubes en U et fait bouillir l'eau du secondaire (bleu) sans jamais se mélanger avec elle. La vapeur part vers la turbine. Les tubes font partie de la deuxième barrière de confinement.">
      <path class="halo" d="M${x - 30} 126Q${x - 30} 96 ${x} 96Q${x + 30} 96 ${x + 30} 126V200L${x + 24} 222V400Q${x + 24} 418 ${x} 418Q${x - 24} 418 ${x - 24} 400V222L${x - 30} 200Z" fill="#1a2632" stroke="#8fa4b6" stroke-width="2"/>
      <clipPath id="clip-gv${i}"><path d="M${x - 27} 126Q${x - 27} 99 ${x} 99Q${x + 27} 99 ${x + 27} 126V199L${x + 21} 221V392H${x - 21}V221L${x - 27} 199Z"/></clipPath>
      <rect x="${x - 28}" y="98" width="56" height="296" fill="#33414f" clip-path="url(#clip-gv${i})"/>
      <rect id="syn-gv-eau${i}" x="${x - 28}" y="240" width="56" height="154" fill="#1f5f95" clip-path="url(#clip-gv${i})"/>
      <path id="syn-tubes${i}" d="M${x - 12} 392V270Q${x - 12} 250 ${x} 250Q${x + 12} 250 ${x + 12} 270V392M${x - 6} 392V282Q${x - 6} 264 ${x} 264Q${x + 6} 264 ${x + 6} 282V392" fill="none" stroke="#ff8a70" stroke-width="2.4"/>
      <path d="M${x - 21} 392H${x + 21}V400Q${x + 21} 414 ${x} 414Q${x - 21} 414 ${x - 21} 400Z" fill="#3a2a30"/><line x1="${x}" y1="392" x2="${x}" y2="414" stroke="#8fa4b6" stroke-width="1.5"/>
      <text class="syn-lab" x="${x}" y="114" text-anchor="middle" style="fill:#cfd8dc">GV${i + 1}</text>
      <text class="syn-txt" id="syn-gv-p${i}" x="${x}" y="130" text-anchor="middle"></text><text class="syn-txt" id="syn-gv-n${i}" x="${x}" y="143" text-anchor="middle"></text>
      <g id="syn-gv-act${i}" opacity="0"><circle cx="${x}" cy="172" r="15" fill="url(#hach)" stroke="#ffb020" stroke-width="1.5"/><text x="${x}" y="177" text-anchor="middle" style="font:700 15px sans-serif;fill:#fff">☢</text><text class="syn-txt" id="syn-gv-a${i}" x="${x}" y="200" text-anchor="middle" style="fill:#ffd27a"></text></g>
      <g id="syn-fuite${i}" opacity="0"><circle cx="${x + 12}" cy="300" r="6" fill="none" stroke="#fff" stroke-width="1.5"><animate attributeName="r" values="3;10;3" dur="1s" repeatCount="indefinite"/></circle></g>
    </g>
    <g id="syn-viv${i}" class="syn-clic" data-aide="Vanne d'isolement vapeur du GV${i + 1}|Cliquez pour l'ouvrir ou la fermer (si la commande est débloquée). Fermée, le GV est isolé du collecteur vapeur.">${vanne(x, 70, 'syn-v-viv' + i, 90)}<circle class="halo" cx="${x}" cy="70" r="12" fill="transparent" stroke="transparent"/></g>
    <g id="syn-gcta${i}" data-aide="Décharge à l'atmosphère du GV${i + 1} (GCT-a) et soupapes|S'ouvre si la pression du GV dépasse ${Math.round(K.G.p2_zero + 6)} bar (ou sur commande quand le condenseur est indisponible). La vapeur part dehors : sans gravité en temps normal, mais c'est un rejet radioactif si un tube du GV est rompu."><path d="M${x - 16} 100V86" stroke="#8a969e" stroke-width="3"/><path d="M${x - 21} 86h10l-5 -8z" fill="#1c2a37" stroke="#9fb3c4" stroke-width="1.2"/>
      <g id="syn-panache${i}" opacity="0"><ellipse cx="${x - 16}" cy="64" rx="11" ry="9" fill="#dfe8ee" filter="url(#lueur)"/><ellipse cx="${x - 16}" cy="68" rx="6" ry="5" fill="#fff"/></g></g>
    <g id="syn-pompe${i}" class="syn-clic" data-aide="Pompe primaire ${i + 1}|Fait circuler environ ${Math.round(K.m_b / 100) * 100} kg d'eau par seconde dans la boucle. À l'arrêt, son volant d'inertie maintient un débit décroissant pendant quelques dizaines de secondes, puis la circulation naturelle (thermosiphon) prend le relais. Cliquez pour l'arrêter ou la démarrer."><circle class="halo" cx="${x + 12}" cy="458" r="12" fill="#1c2a37" stroke="#9fb3c4" stroke-width="1.6"/><g id="syn-rotor${i}"><path d="M${x + 12} 449v18M${x + 3} 458h18M${x + 5.6} 451.6l12.8 12.8M${x + 18.4} 451.6l-12.8 12.8" stroke="#e8eef4" stroke-width="1.5"/></g></g>
    <path d="M${x + 26} 238V246" stroke="#2f6ea5" stroke-width="3"/><circle id="syn-alim${i}" cx="${x + 27}" cy="242" r="4" fill="#3ecf8e" stroke="#0b1016" stroke-width="1"/>`;
  }
  h += `<text class="syn-txt" id="syn-debit" x="150" y="503"></text>
  <text class="syn-txt" id="syn-vap-t" x="${xDer + 98}" y="34" text-anchor="end"></text>
  </svg>`;
  hote.innerHTML = h;
  const q = id => hote.querySelector('#' + id);
  const R = { NB, hote, q, off: {}, cache: {} };
  for (const id of ['ts', 'te', 'barres-t', 'bore-t', 'pzr-p', 'pzr-n', 'pzr-m', 'debit', 'vap-t', 'pe', 'reseau-t', 'turb-t', 'gct-t', 'are-t', 'asg-t', 'is-t', 'rcv-t', 'mer-t']) R[id] = q('syn-' + id);
  return R;
};

function txt(R, cle, el, v) { if (R.cache[cle] !== v) { R.cache[cle] = v; el.textContent = v; } }
function attr(R, cle, el, a, v) { if (R.cache[cle] !== v) { R.cache[cle] = v; el.setAttribute(a, v); } }

/* Mise à jour à chaque image. dtReel sert à animer les écoulements. */
S.maj = function (R, sim, dtReel, anime) {
  const s = sim.s, o = s.out, u = sim.u, K = sim.K, G = K.G, q = R.q, f1 = x => x.toFixed(1);
  // cœur : lueur selon la puissance, teinte selon la température du combustible
  const p = clamp(o.q || 0, 0, 1.2);
  attr(R, 'lu', q('syn-lueur'), 'opacity', (0.05 + 0.75 * Math.sqrt(p)).toFixed(2));
  const chaud = clamp((o.Tcentre - 1900) / 900, 0, 1);
  attr(R, 'luc', q('syn-lueur'), 'fill', s.fusion ? '#ff3b1f' : chaud > 0 ? `rgb(${Math.round(79 + 176 * chaud)},${Math.round(195 - 110 * chaud)},${Math.round(247 - 190 * chaud)})` : '#4fc3f7');
  attr(R, 'co', q('syn-coeur'), 'opacity', (0.35 + 0.65 * Math.min(1, Math.sqrt(p) + 0.1)).toFixed(2));
  // grappes
  attr(R, 'bR', q('syn-barresR'), 'transform', `translate(0,${(s.xR * 118).toFixed(1)})`);
  attr(R, 'bS', q('syn-barresS'), 'transform', `translate(0,${(s.xS * 118).toFixed(1)})`);
  txt(R, 'bt', R['barres-t'], 'R ' + Math.round(225 * (1 - s.xR)) + ' pas');
  txt(R, 'bo', R['bore-t'], Math.round(s.bore) + ' ppm B');
  // vide dans la cuve
  const hv = clamp(s.Vvide / (K.V_haut + 3 * K.V_coeur), 0, 1) * 200;
  attr(R, 'vd', q('syn-vide'), 'height', hv.toFixed(0));
  // températures
  txt(R, 'ts', R.ts, f1(s.Ts) + ' °C'); txt(R, 'te', R.te, f1(s.Tdesc) + ' °C');
  attr(R, 'cbc', q('syn-bc'), 'stroke', coulT(s.Tps)); attr(R, 'cbf', q('syn-bf'), 'stroke', coulT(s.Tdesc));
  attr(R, 'ceau', q('syn-cuve-eau'), 'fill', coulT((s.Ts + s.Tdesc) / 2).replace('rgb', 'rgba').replace(')', ',.55)'));
  // pressuriseur
  const hp = 128 * clamp(o.nivPzr / 100, 0, 1);
  attr(R, 'pzy', q('syn-pzr-eau'), 'y', (187 - hp).toFixed(1)); attr(R, 'pzh', q('syn-pzr-eau'), 'height', hp.toFixed(1));
  txt(R, 'pp', R['pzr-p'], f1(s.P) + ' bar'); txt(R, 'pn', R['pzr-n'], 'niv. ' + Math.round(o.nivPzr) + ' %');
  txt(R, 'pm', R['pzr-m'], 'Tsat ' + Math.round(o.Tsat1) + ' °C');
  attr(R, 'asp', q('syn-asp'), 'opacity', o.masp > 0.5 ? 1 : 0); attr(R, 'ch', q('syn-chauf'), 'opacity', clamp(o.Qch / G.Q_chauf, 0, 1).toFixed(2));
  attr(R, 'pan', q('syn-panache-pzr'), 'opacity', o.msoup > 0 ? 1 : 0);
  attr(R, 'vso', q('syn-v-soup').firstChild, 'fill', u.soupapeIsol ? '#7a1414' : s.soupape ? '#ffb020' : '#1c2a37');
  // boucles
  let mtot = 0;
  for (let i = 0; i < R.NB; i++) {
    const b = s.bcl[i];
    mtot += b.m;
    attr(R, 'c1' + i, q('syn-bc' + i), 'stroke', coulT(b.Tbc)); attr(R, 'c2' + i, q('syn-bf' + i), 'stroke', coulT(b.Tbf));
    attr(R, 'tu' + i, q('syn-tubes' + i), 'stroke', coulT((b.Tbc + b.Tgv) / 2));
    const nv = clamp(b.Ms / G.M_gv_plein, 0, 1.0), hg = 30 + nv * 250;
    attr(R, 'gy' + i, q('syn-gv-eau' + i), 'y', (394 - hg).toFixed(0)); attr(R, 'gh' + i, q('syn-gv-eau' + i), 'height', hg.toFixed(0));
    attr(R, 'gc' + i, q('syn-gv-eau' + i), 'fill', b.act > 1.5 ? '#6d7a2c' : '#1f5f95');
    txt(R, 'gp' + i, q('syn-gv-p' + i), f1(b.Ps) + ' bar'); txt(R, 'gn' + i, q('syn-gv-n' + i), 'niv. ' + Math.round(clamp(b.niv, 0, 150)) + ' %');
    attr(R, 'ga' + i, q('syn-gv-act' + i), 'opacity', b.act > 1.5 ? 1 : 0);
    if (b.act > 1.5) txt(R, 'gat' + i, q('syn-gv-a' + i), '×' + (b.act > 99 ? Math.round(b.act) : b.act.toFixed(1)));
    attr(R, 'fu' + i, q('syn-fuite' + i), 'opacity', Math.abs(b.fuite) > 1 && R.montrerFuite ? 1 : 0);
    attr(R, 'viv' + i, q('syn-v-viv' + i).firstChild, 'fill', u.viv[i] ? '#0f3b2c' : '#7a1414');
    attr(R, 'vivs' + i, q('syn-v-viv' + i).firstChild, 'stroke', u.viv[i] ? '#3ecf8e' : '#ff6b6b');
    attr(R, 'lv' + i, q('syn-lv' + i), 'stroke', b.Wcol > 1 ? '#cfd8dc' : '#56626c');
    attr(R, 'pa' + i, q('syn-panache' + i), 'opacity', b.Watm > 1 ? Math.min(1, 0.4 + b.Watm / 60).toFixed(2) : 0);
    attr(R, 'al' + i, q('syn-alim' + i), 'fill', !u.alim[i] ? '#ff4d4d' : b.asg ? '#ffb020' : b.Wae > 1 ? '#3ecf8e' : '#56626c');
    attr(R, 'po' + i, q('syn-pompe' + i).firstElementChild, 'stroke', b.pompeHS || !s.elec ? '#ff4d4d' : u.pompes[i] ? '#3ecf8e' : '#9fb3c4');
    if (anime) {
      R.off['r' + i] = ((R.off['r' + i] || 0) + b.w * 360 * dtReel * 1.2) % 360;
      q('syn-rotor' + i).setAttribute('transform', `rotate(${R.off['r' + i].toFixed(0)} ${R.NB === 3 ? 305 + i * 112 + 12 : 290 + i * 88 + 12} 458)`);
    }
  }
  txt(R, 'deb', R.debit, 'débit ' + Math.round(100 * mtot / K.m_tot) + ' %');
  // secondaire
  txt(R, 'vt', R['vap-t'], f1(o.Ph || 0) + ' bar · ' + Math.round((o.W_turb || 0) + (o.W_gct || 0)) + ' kg/s');
  txt(R, 'pe', R.pe, Math.round(s.Pe / 1e6) + ' MWe');
  txt(R, 'rt', R['reseau-t'], s.reseau ? (s.turbine === 'couplee' ? 'Réseau (couplé)' : 'Réseau') : 'Réseau perdu');
  attr(R, 'rl', q('syn-ligne'), 'stroke', !s.reseau ? '#ff4d4d' : s.turbine === 'couplee' ? '#ffb020' : '#5b6b7a');
  attr(R, 'ai', q('syn-alt-ic'), 'stroke', s.turbine === 'couplee' || s.turbine === 'ilotee' ? '#ffb020' : '#5b6b7a');
  txt(R, 'tt', R['turb-t'], Math.round(s.Nturb) + ' tr/min');
  txt(R, 'gt', R['gct-t'], s.gct > 0.01 ? Math.round(s.gct * 100) + ' %' : 'fermé');
  attr(R, 'vg', q('syn-v-gct').firstChild, 'fill', s.gct > 0.01 ? '#ffb020' : '#1c2a37');
  txt(R, 'at', R['are-t'], 'ARE ' + Math.round(o.W_ae || 0) + ' kg/s');
  txt(R, 'ast', R['asg-t'], o.W_asg > 0 ? Math.round(o.W_asg) + ' kg/s' : '');
  attr(R, 'asc', q('syn-asg'), 'stroke', o.W_asg > 0 ? '#ffb020' : '#2a4c66');
  attr(R, 'arc', q('syn-are'), 'stroke', o.W_ae > 5 ? '#2f7fc4' : '#2a3d4d');
  txt(R, 'ist', R['is-t'], s.IS ? 'IS ' + Math.round(o.m_is) + ' kg/s' : '');
  txt(R, 'rcvt', R['rcv-t'], Math.abs(o.m_rcv) > 0.3 ? 'RCV ' + (o.m_rcv > 0 ? '+' : '') + o.m_rcv.toFixed(1) + ' kg/s' : '');
  attr(R, 'isc', q('syn-is'), 'stroke', s.IS ? '#3ecf8e' : '#24506e');
  txt(R, 'mt', R['mer-t'], Math.round(Math.max(0, o.Qcond || 0) / 1e6) + ' MW cédés');
  attr(R, 'co2', q('syn-cond').firstElementChild, 'stroke', s.condenseur ? '#8fa4b6' : '#ff4d4d');
  // écoulements animés
  if (anime) {
    const av = (id, v) => { const el = q(id); if (!el) return; if (Math.abs(v) < 0.01) { if (R.cache['v' + id] !== 0) { el.style.display = 'none'; R.cache['v' + id] = 0; } return; } if (R.cache['v' + id] !== 1) { el.style.display = ''; R.cache['v' + id] = 1; } R.off[id] = ((R.off[id] || 0) - v * 60 * dtReel) % 12; el.style.strokeDashoffset = R.off[id].toFixed(1); };
    const wr = mtot / K.m_tot;
    av('syn-bc-f', wr); av('syn-bf-f', wr);
    for (let i = 0; i < R.NB; i++) { const b = s.bcl[i], w = b.m / K.m_b; av('syn-bc' + i + '-f', w); av('syn-bf' + i + '-f', w); av('syn-lv' + i + '-f', b.Wcol / K.m_vap0); }
    av('syn-coll-f', ((o.W_turb || 0) + (o.W_gct || 0)) / K.W_vap); av('syn-gct-f', (o.W_gct || 0) / K.W_vap * 2);
    av('syn-are-f', (o.W_ae || 0) / K.W_vap); av('syn-asg-f', o.W_asg > 0 ? 0.5 : 0); av('syn-is-f', s.IS ? 0.6 : 0);
    R.off.mer = ((R.off.mer || 0) - (s.condenseur ? 0.5 : 0) * 60 * dtReel) % 14; q('syn-mer').style.strokeDashoffset = R.off.mer.toFixed(1);
    R.off.tb = ((R.off.tb || 0) + s.Nturb / 1500 * 40 * dtReel) % 14;
    q('syn-aubes').setAttribute('transform', `translate(${(R.off.tb - 7).toFixed(1)},0)`);
  }
};
})(window);
