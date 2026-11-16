/* ======== ui/cours.js ======== */
/* =====================================================================
   ui/cours.js — MISSION 0 : le cours pour débutants (lycéens)
   ---------------------------------------------------------------------
   Deux parties, toutes en temps figé :
     1. « Comprendre » : fission, réaction en chaîne, trois circuits, sûreté,
        expliqués par des comparaisons (bouilloire, dominos, cocotte-minute...).
     2. « Les commandes, une par une » : chaque cadran, curseur, bouton et onglet
        est mis en évidence et expliqué (à quoi il sert, par analogie, quand l'utiliser).
   Aucun calcul de centrale ici. Format d'une étape : voir ui/guide.js.
   Ce fichier est chargé avant contenus.js, qui en fait la mission m0.
   ===================================================================== */
(function (root) {
'use strict';
const f0 = x => Math.round(x);
const onglet = o => { if (root.document) { const b = document.querySelector('#onglets [data-o="' + o + '"]'); if (b) b.click(); } };
const complet = () => !(root.App && root.App.opt && root.App.opt.simple);   // faux en affichage simplifié (les groupes de commandes sont encore vides)
const tousGV = sim => sim.s.bcl.map((b, i) => '#syn-gv' + i).join(', ');

/* ---------------- petits schémas (SVG en ligne, lisibles sur fond sombre) ---------------- */
const svg = (h, corps) => `<svg viewBox="0 0 340 ${h}" style="width:100%;height:auto;display:block;margin:8px 0 4px" font-family="system-ui,sans-serif" font-size="10.5">${corps}</svg>`;
const T = (x, y, t, c = '#cfd9e3', a = 'middle', s = '') => `<text x="${x}" y="${y}" fill="${c}" text-anchor="${a}" ${s}>${t}</text>`;
const fleche = (x1, y1, x2, y2, c = '#8aa0b4') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1.6" marker-end="url(#fl)"/>`;
const defs = `<defs><marker id="fl" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#8aa0b4"/></marker></defs>`;

const SCHEMA_FISSION = svg(120, defs +
  `<circle cx="18" cy="48" r="5" fill="#8fd3ff"/>` + T(18, 66, 'neutron', '#8fd3ff') + fleche(26, 48, 64, 48) +
  `<circle cx="98" cy="48" r="27" fill="#b9792a" stroke="#f0b960" stroke-width="2"/>` + T(98, 52, 'U-235', '#fff', 'middle', 'font-weight="bold"') +
  T(98, 92, 'noyau d\'uranium', '#e8c791') +
  fleche(134, 48, 172, 48) + T(153, 40, 'fission', '#ffd08a') +
  `<circle cx="206" cy="30" r="15" fill="#a8452f"/><circle cx="206" cy="68" r="15" fill="#a8452f"/>` +
  `<circle cx="252" cy="14" r="5" fill="#8fd3ff"/><circle cx="262" cy="48" r="5" fill="#8fd3ff"/><circle cx="252" cy="84" r="5" fill="#8fd3ff"/>` +
  fleche(224, 26, 244, 17) + fleche(224, 48, 254, 48) + fleche(224, 72, 244, 82) +
  `<path d="M286 30 q6 -10 0 -20 q12 8 10 20 q8 -6 4 -16 q16 14 4 36 q-10 8 -18 0 q-6 -8 0 -20z" fill="#ff7a3c"/>` + T(298, 66, 'chaleur', '#ff9d6b') +
  T(170, 114, 'résultat : 2 morceaux + 2 ou 3 neutrons + de la chaleur', '#cfd9e3'));

const SCHEMA_DOMINOS = (() => {
  const ang = [84, 66, 44, 22, 0, 0, 0, 0, 0];
  let d = '';
  ang.forEach((a, k) => { const x = 20 + k * 34; d += `<rect x="${x}" y="40" width="10" height="46" rx="2" fill="${a > 0 ? '#c98a2b' : '#8fd3ff'}" transform="rotate(${a} ${x + 10} 86)"/>`; });
  return svg(124, `<line x1="8" y1="87" x2="332" y2="87" stroke="#4a5a6a" stroke-width="2"/>` + d +
    T(170, 20, 'chaque domino en fait tomber <tspan font-weight="bold" fill="#fff">exactement un</tspan> autre', '#cfd9e3') +
    T(170, 110, 'réaction en chaîne stable = puissance constante', '#8fd3ff'));
})();

const SCHEMA_CIRCUITS = svg(146, defs +
  `<rect x="4" y="34" width="62" height="52" rx="8" fill="#6d2323" stroke="#ff6b5a" stroke-width="1.5"/>` + T(35, 56, 'Cœur', '#fff', 'middle', 'font-weight="bold"') + T(35, 70, 'du réacteur', '#ffb3a8') +
  `<rect x="96" y="34" width="62" height="52" rx="8" fill="#5a3a12" stroke="#ffb020" stroke-width="1.5"/>` + T(127, 56, 'Générateur', '#fff', 'middle', 'font-weight="bold" font-size="9.5"') + T(127, 70, 'de vapeur', '#ffd08a') +
  `<rect x="188" y="34" width="62" height="52" rx="8" fill="#5a3a12" stroke="#ffb020" stroke-width="1.5"/>` + T(219, 56, 'Turbine +', '#fff', 'middle', 'font-weight="bold"') + T(219, 70, 'alternateur', '#ffd08a') +
  `<rect x="280" y="34" width="58" height="52" rx="8" fill="#123a5a" stroke="#4aa8ff" stroke-width="1.5"/>` + T(309, 56, 'Condenseur', '#fff', 'middle', 'font-weight="bold" font-size="9"') + T(309, 70, 'refroidi', '#9fd0ff') +
  fleche(66, 48, 96, 48, '#ff6b5a') + fleche(96, 74, 66, 74, '#ff6b5a') +
  fleche(158, 60, 188, 60, '#ffb020') + fleche(250, 60, 280, 60, '#ffb020') +
  T(35, 22, '① PRIMAIRE', '#ff8a7a', 'middle', 'font-weight="bold"') +   T(190, 22, '② SECONDAIRE', '#ffc860', 'middle', 'font-weight="bold"') + T(338, 22, '③ RIVIÈRE', '#7cc0ff', 'end', 'font-weight="bold"') +
  T(35, 100, '= la flamme', '#ffb3a8') + T(127, 100, '= la bouilloire', '#ffd08a') + T(219, 100, '= une éolienne', '#ffd08a') + T(309, 100, '= le frigo', '#9fd0ff') +
  T(170, 124, 'trois circuits séparés : la chaleur passe, pas l\'eau', '#cfd9e3') +
  T(170, 140, 'rouge : eau du réacteur · orange : vapeur · bleu : rivière', '#8aa0b4', 'middle', 'font-size="9.5"'));

const SCHEMA_BARRIERES = svg(138,
  `<rect x="4" y="6" width="196" height="126" rx="16" fill="#27323d" stroke="#8a97a6" stroke-width="2"/>` +
  `<rect x="26" y="24" width="152" height="90" rx="14" fill="#223a4d" stroke="#6fb0e0" stroke-width="2"/>` +
  `<rect x="52" y="42" width="100" height="54" rx="10" fill="#4a3a1c" stroke="#e0b060" stroke-width="2"/>` +
  `<circle cx="102" cy="69" r="13" fill="#c98a2b"/>` +
  T(102, 73, 'U', '#fff', 'middle', 'font-weight="bold"') +
  T(208, 22, '③ l\'enceinte en béton', '#c4cdd6', 'start') + T(208, 35, 'avec une peau d\'étanchéité', '#8aa0b4', 'start', 'font-size="9.5"') +
  T(208, 66, '② la cuve et le circuit', '#9fd0ff', 'start') + T(208, 79, 'primaire en acier épais', '#8aa0b4', 'start', 'font-size="9.5"') +
  T(208, 106, '① la gaine du crayon', '#f0c878', 'start') + T(208, 119, 'et la pastille elle-même', '#8aa0b4', 'start', 'font-size="9.5"'));

const sect = t => `<div style="font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#7be0b5;margin-bottom:3px">${t}</div>`;
const astuce = t => `<div style="margin-top:7px;border-left:3px solid #4aa8ff;padding:3px 8px;background:#10243a;color:#cfe6ff;font-size:12.5px">💡 ${t}</div>`;
const quand = t => `<div style="margin-top:7px;border-left:3px solid #ffb020;padding:3px 8px;background:#2b2108;color:#ffe2a1;font-size:12.5px">🕹 <b>Quand l'utiliser :</b> ${t}</div>`;

/* ===================================================================== */
const COURS = [
  /* ------------------------------ PARTIE 1 : COMPRENDRE ------------------------------ */
  { titre: 'Bienvenue ! Un petit cours avant de jouer',
    texte: sim => `<p>Ce simulateur reproduit une vraie centrale nucléaire française de type <b>REP</b> (réacteur à eau sous pression), comme celles qui fournissent environ <b>deux tiers de l'électricité</b> du pays.</p>
      <p>Avant de toucher à quoi que ce soit, on va comprendre <b>comment ça marche</b>, avec des comparaisons du quotidien. Aucune connaissance préalable n'est nécessaire.</p>
      <p>Le temps est <b>figé</b> : prenez celui de lire. Le bouton « Suivant » avance, la flèche ◀ revient en arrière, et vous pouvez quitter à tout moment.</p>
      ${sect('Au programme')}<ul><li>Partie 1 : la physique, en 14 étapes</li><li>Partie 2 : l'écran, bouton par bouton</li></ul>` },

  { cible: '#synoptique', titre: '1 · Une centrale, c\'est une grosse bouilloire',
    texte: `<p>Une bouilloire chauffe de l'eau jusqu'à la vapeur. Une centrale fait <b>exactement pareil</b>, en beaucoup plus grand : on chauffe de l'eau, elle devient de la vapeur, et la vapeur fait tourner une <b>turbine</b> (comme le vent fait tourner une éolienne). La turbine entraîne un <b>alternateur</b>, qui fabrique l'électricité (comme la dynamo d'un vélo).</p>
      <p>Ce qui change d'une centrale à l'autre, c'est <b>ce qui chauffe l'eau</b> : du charbon, du gaz... ou, ici, des <b>atomes d'uranium</b> qui se cassent.</p>
      ${astuce('Tout le schéma que vous avez sous les yeux, c\'est une bouilloire géante avec une éolienne au bout.')}` },

  { titre: '2 · La fission : casser un atome pour faire de la chaleur',
    texte: `<p>Tout est fait d'<b>atomes</b>. Au centre de chaque atome, un <b>noyau</b>. Le noyau d'<b>uranium 235</b> est gros et fragile : quand un petit projectile, un <b>neutron</b>, le heurte, il <b>se casse en deux</b>. C'est la <b>fission</b>.</p>
      ${SCHEMA_FISSION}
      <p>Cette cassure libère une énergie énorme sous forme de <b>chaleur</b>, et éjecte <b>2 ou 3 nouveaux neutrons</b>.</p>
      ${astuce('Comme une boule de billard qui fait exploser un triangle de boules : un seul choc, beaucoup de mouvement. Une pastille d\'uranium plus petite qu\'un doigt libère autant d\'énergie qu\'environ <b>une tonne de charbon</b>.')}` },

  { titre: '3 · La réaction en chaîne : l\'effet domino',
    texte: `<p>Les neutrons libérés peuvent casser d'autres noyaux, qui libèrent d'autres neutrons, etc. C'est la <b>réaction en chaîne</b>.</p>
      ${SCHEMA_DOMINOS}
      <ul><li><b>Plus d'un</b> domino renversé à chaque fois : la réaction s'emballe (comme un feu qui gagne du terrain).</li><li><b>Moins d'un</b> : elle s'éteint.</li><li><b>Exactement un</b> : elle est stable. La puissance reste constante. C'est l'état de fonctionnement normal.</li></ul>
      <p>Piloter un réacteur, c'est <b>rester pile sur ce « exactement un »</b>.</p>` },

  { titre: '4 · Pourquoi on arrive à piloter : le petit retard',
    texte: `<p>Une réaction en chaîne qui s'emballe en un clin d'œil serait impossible à conduire. Heureusement, <b>moins de 1 % des neutrons</b> arrivent avec un <b>retard</b> de quelques secondes (ils sortent de morceaux de noyaux encore instables).</p>
      <p>Ce petit retard ralentit tout le système : au lieu de réagir en millièmes de seconde, le réacteur réagit en <b>secondes</b>. Assez lentement pour que les automatismes, et vous, puissent corriger.</p>
      ${astuce('C\'est comme conduire une voiture dont l\'accélérateur répond avec un léger délai : on a le temps de corriger avant de partir en vrille.')}` },

  { cible: '#syn-cuve', titre: '5 · L\'eau fait deux métiers',
    texte: sim => `<p>Dans la cuve, ${sim.K.G.N_ass} <b>assemblages</b> de combustible : des faisceaux de crayons en métal, remplis de pastilles d'uranium. L'eau circule autour.</p>
      <p>L'eau fait <b>deux métiers</b> à la fois :</p>
      <ul><li><b>Elle emporte la chaleur</b> vers la turbine (elle entre à ${f0(sim.K.G.T_e)} °C et ressort à ${f0(sim.K.G.T_s)} °C).</li><li><b>Elle ralentit les neutrons.</b> Ils sortent très rapides, trop pour casser facilement un noyau : en rebondissant sur les molécules d'eau, ils ralentissent et deviennent efficaces. C'est le <b>modérateur</b>.</li></ul>
      ${astuce('Une balle de ping-pong lancée à toute vitesse traverse un nuage de billes sans rien casser ; ralentie, elle se laisse attraper. L\'eau est ce « tapis qui freine ».')}` },

  { cible: '#syn-cuve', titre: '6 · La sécurité naturelle du réacteur',
    texte: `<p>Quand l'eau <b>chauffe</b>, elle se dilate et devient <b>moins dense</b> : elle ralentit moins bien les neutrons. La réaction en chaîne <b>faiblit toute seule</b>. Quand l'eau <b>refroidit</b>, c'est l'inverse.</p>
      <p>Résultat : si le réacteur produit trop de chaleur, <b>il se freine lui-même</b>, sans qu'aucune machine n'intervienne. C'est une loi de la physique, pas un automatisme.</p>
      ${astuce('Comme un feu de cheminée qui s\'étoufferait de lui-même s\'il devenait trop vif. Vous verrez cet effet à l\'œuvre dans la mission 1 : on ne règle que la turbine, et le réacteur suit.')}` },

  { cible: '#syn-cuve', titre: '7 · Les grappes : le frein et l\'accélérateur',
    texte: `<p>Pour piloter, on glisse dans le cœur des <b>grappes de commande</b> : des barres en métal qui <b>absorbent les neutrons</b>, comme une éponge qui boit l'eau.</p>
      <ul><li>On <b>descend</b> les grappes : moins de neutrons, la réaction <b>ralentit</b>.</li><li>On les <b>remonte</b> : plus de neutrons, elle <b>accélère</b>.</li><li>En urgence, on les <b>laisse toutes tomber</b> d'un coup : la réaction s'arrête en quelques secondes. C'est l'<b>arrêt automatique du réacteur (AAR)</b>.</li></ul>
      ${astuce('Les grappes, c\'est le frein à main et la pédale d\'accélérateur du réacteur.')}` },

  { cible: '#sl-bore', garde: true, titre: '8 · Le bore : des éponges dissoutes dans l\'eau',
    texte: `<p>Il existe une autre façon d'absorber des neutrons : dissoudre du <b>bore</b> (sous forme d'acide borique) dans l'eau. Plus il y en a, plus la réaction est freinée.</p>
      <p>Les grappes sont rapides, mais le bore est <b>lent</b>. On l'utilise pour les changements qui durent des heures : l'usure du combustible, ou le <b>xénon</b>, un gaz produit par la fission qui absorbe aussi des neutrons.</p>
      ${astuce('Le sucre dans le café : on en ajoute ou on en retire doucement, et il agit partout dans la tasse. Les grappes, elles, sont comme une cuillère qu\'on plonge ou qu\'on retire vite.')}` },

  { cible: '#syn-cuve', titre: '9 · Même arrêté, le cœur reste chaud',
    texte: `<p>Quand la réaction en chaîne est stoppée, la chaleur ne disparaît pas d'un coup. Les morceaux d'atomes créés par les fissions sont instables et continuent de se désintégrer en chauffant : c'est la <b>puissance résiduelle</b>.</p>
      <ul><li><b>Environ 6 %</b> de la puissance nominale juste après l'arrêt</li><li><b>Environ 1,5 %</b> après un quart d'heure</li><li>Encore de la chaleur pendant des jours</li></ul>
      <p>Pour un réacteur de ce type, cela représente encore plusieurs dizaines de mégawatts qu'il faut <b>toujours évacuer</b>, sinon le combustible surchauffe.</p>
      ${astuce('Une plaque de cuisson éteinte reste brûlante un long moment. Ici, c\'est la même chose, en beaucoup plus intense : on arrête la réaction, mais on ne peut pas arrêter de refroidir.')}` },

  { cible: '#synoptique', titre: '10 · Trois circuits qui ne se mélangent jamais',
    texte: `${SCHEMA_CIRCUITS}
      <p><b>① Le primaire</b> : l'eau du réacteur. Elle passe dans le cœur, devient radioactive, chauffe, puis va réchauffer le circuit suivant. Elle tourne en boucle fermée.</p>
      <p><b>② Le secondaire</b> : une autre eau, jamais en contact avec la première. Elle se transforme en vapeur, fait tourner la turbine, puis redevient liquide.</p>
      <p><b>③ Le refroidissement</b> : l'eau d'une rivière ou de la mer (ou d'une tour de refroidissement) qui condense la vapeur.</p>` },

  { cible: '#syn-pzr', titre: '11 · Pourquoi l\'eau ne bout pas : la cocotte-minute',
    texte: `<p>À la pression normale, l'eau bout à 100 °C. Mais dans une <b>cocotte-minute</b>, la pression est plus forte et l'eau reste liquide bien au-dessus de 100 °C.</p>
      <p>Dans le primaire, l'eau est à plus de <b>300 °C</b> : pour qu'elle reste liquide, on la maintient à <b>155 bar</b>, environ 155 fois la pression de l'air. Le <b>pressuriseur</b> est le réservoir qui règle cette pression, avec une bulle de vapeur au-dessus de l'eau, comme un coussin.</p>
      ${astuce('Si la pression baisse trop, l\'eau se met à bouillir dans le cœur. Beaucoup de bulles de vapeur isolent mal : le combustible refroidit moins bien. C\'est ce que la « marge à la saturation » vous permet de surveiller.')}` },

  { cible: tousGV, titre: '12 · Le générateur de vapeur : l\'échangeur',
    texte: sim => `<p>C'est ici que les deux circuits se rencontrent <b>sans se toucher</b>. L'eau chaude du primaire circule dans des milliers de petits tubes en U ; autour de ces tubes, l'eau du secondaire chauffe et bout.</p>
      <p>La chaleur traverse la paroi des tubes, mais <b>l'eau radioactive reste à l'intérieur</b>. Il y a ${sim.K.NB} générateurs de vapeur sur cette centrale, un par boucle.</p>
      ${astuce('C\'est comme un radiateur de chauffage central : l\'eau chaude reste dans le tuyau et chauffe la pièce à travers le métal. Que se passe-t-il si un tube se perce ? C\'est justement l\'accident RTGV que vous découvrirez plus tard.')}` },

  { cible: '#syn-turbine, #syn-alt, #syn-cond', titre: '13 · Turbine, alternateur, condenseur',
    texte: sim => `<p>La vapeur arrive sur la <b>turbine</b> et la fait tourner à <b>1500 tours par minute</b>, comme l'eau d'une rivière fait tourner un moulin. L'<b>alternateur</b> branché dessus produit <b>${f0(sim.K.G.P_e / 1e6)} MW</b> d'électricité envoyés sur le réseau.</p>
      <p>À la sortie, la vapeur passe dans le <b>condenseur</b> où elle est refroidie et redevient de l'eau, qui repart vers les générateurs de vapeur.</p>
      <p>Il ne devient de l'électricité qu'<b>environ un tiers</b> de la chaleur produite. Les deux autres tiers sont rejetés dans la rivière ou dans l'air : c'est une limite de la physique de tous les moteurs thermiques, pas une perte évitable.</p>` },

  { cible: '#verriere', titre: '14 · Plusieurs barrières entre le combustible et vous',
    texte: `${SCHEMA_BARRIERES}
      <p>La radioactivité est enfermée derrière <b>trois barrières</b>, comme des poupées russes : si l'une cède, les autres tiennent. Des systèmes de secours surveillent en permanence et s'affichent sur la <b>verrière</b> d'alarmes, en bas.</p>
      ${astuce('<b>Une centrale peut-elle exploser comme une bombe ?</b> Non : son uranium est enrichi à 3 à 5 %, une bombe en demande plus de 90 %. Le vrai risque est que le cœur, mal refroidi, fonde. Toute la sûreté consiste à l\'éviter.')}` },

  { titre: 'Ce qu\'il faut retenir de la partie 1',
    texte: `<ul>
      <li>Une centrale est une <b>bouilloire géante</b> : l'uranium chauffe l'eau, la vapeur fait tourner une turbine.</li>
      <li>La chaleur vient de la <b>fission</b> : un neutron casse un noyau, qui libère de la chaleur et d'autres neutrons.</li>
      <li>On garde la <b>réaction en chaîne stable</b> avec les <b>grappes</b> (rapides) et le <b>bore</b> (lent).</li>
      <li>L'eau <b>ralentit les neutrons</b> : si elle chauffe, la réaction se freine toute seule.</li>
      <li>Même arrêté, le cœur reste chaud : il faut <b>toujours le refroidir</b>.</li>
      <li>Trois circuits, <b>trois barrières</b>, des automatismes de secours.</li></ul>
      <p>Place à la partie 2 : l'écran de la salle de commande, <b>bouton par bouton</b>.</p>` },

  /* ------------------------------ PARTIE 2 : LES COMMANDES ------------------------------ */
  { cible: '#synoptique', titre: 'Partie 2 · Le schéma de la centrale',
    texte: `<p>Le schéma est <b>vivant</b>. Les couleurs des tuyaux suivent la <b>température</b> : bleu pour froid, rouge pour chaud. Les petits tirets qui défilent montrent le <b>débit</b>. Les niveaux d'eau montent et descendent.</p>
      <p>À gauche, le bâtiment réacteur (cuve, pompes, pressuriseur, générateurs de vapeur). À droite, la salle des machines (turbine, alternateur, condenseur).</p>
      <p>Chaque élément du schéma peut être survolé avec la souris pour qu'il explique son rôle.</p>` },

  { cible: '#cad-n, #cad-pe', titre: 'Cadrans · Les deux puissances',
    texte: `<p><b>Puissance réacteur</b> (en % de la puissance nominale) : la chaleur produite par les fissions. 100 % est le fonctionnement normal. Au-dessus de 102 % le cadran devient orange, à 109 % le réacteur s'arrête tout seul.</p>
      <p><b>Puissance électrique</b> (en MW) : ce que l'alternateur envoie réellement sur le réseau.</p>
      ${astuce('On retrouve le rendement vu plus haut : la puissance électrique est environ le tiers de la puissance thermique du réacteur.')}` },

  { cible: '#cad-tm', titre: 'Cadran · La température moyenne',
    texte: `<p>C'est la température moyenne de l'eau du primaire. Le petit <b>repère violet</b> est la valeur <b>à tenir</b> : elle change avec la puissance demandée.</p>
      <p>Piloter le réacteur, c'est en grande partie garder l'aiguille sur ce repère. La partie orange, au-dessus, est une zone à éviter.</p>` },

  { cible: '#cad-p, #cad-np', titre: 'Cadrans · Pression et niveau du pressuriseur',
    texte: `<p><b>Pression primaire</b> : doit rester près de <b>155 bar</b>. Trop basse, l'eau risque de bouillir. Trop haute, le circuit est en danger. Les zones colorées indiquent les seuils de protection.</p>
      <p><b>Niveau du pressuriseur</b> : la hauteur d'eau dans le réservoir. Il monte quand l'eau chauffe (elle se dilate) et baisse quand elle refroidit ou fuit.</p>
      ${astuce('Le niveau du pressuriseur est le meilleur témoin de ce qui arrive à l\'eau du circuit primaire, comme la jauge d\'un vase d\'expansion.')}` },

  { cible: '#cad-mg, #cad-tc, #cad-wr', titre: 'Cadrans · Marge, combustible, débit',
    texte: `<p><b>Marge à la saturation</b> : l'écart avec l'ébullition. Plus elle est grande, mieux c'est. À zéro, l'eau bout.</p>
      <p><b>Température du centre du combustible</b> : celle du centre de la pastille du crayon le plus chaud. L'uranium fond vers 2840 °C, ce qu'il ne faut jamais atteindre.</p>
      <p><b>Débit primaire</b> : la vitesse de circulation de l'eau dans le cœur. Les pompes s'arrêtent, il en reste quelques pour cent par simple circulation naturelle.</p>` },

  { cible: '#g-curseurs', titre: 'Les curseurs : comment on les lit',
    texte: `<p>Les curseurs verticaux pilotent la centrale. Pour chacun :</p>
      <ul><li>La <b>poignée blanche</b> est ce que vous <b>demandez</b>. Glissez-la, ou utilisez la molette ou les boutons − et +.</li><li>Le <b>trait orange</b> est ce qui se passe <b>réellement</b>. Il met du temps à suivre : une grappe, une turbine, une concentration de bore ne bougent pas instantanément.</li></ul>
      ${astuce('C\'est comme le thermostat d\'une maison : vous réglez 20 °C, mais la pièce met du temps à y arriver.')}` },

  { cible: '#sl-turb', titre: 'Curseur · Charge turbine',
    texte: `<p>La puissance électrique <b>demandée</b> par le réseau, en % de la puissance nominale. C'est la <b>commande la plus importante</b> : dans un réacteur à eau sous pression, <b>la turbine commande et le réacteur suit</b>.</p>
      <p>Quand la turbine prend moins de vapeur, l'eau du primaire chauffe, et la réaction faiblit toute seule.</p>
      ${quand('pour augmenter ou baisser la production d\'électricité, par exemple quand la consommation du pays diminue la nuit.')}` },

  { cible: '#sl-R', titre: 'Curseur · Barres R (les grappes de régulation)',
    texte: `<p>Position des grappes de régulation, en « pas » extraits : <b>225</b> = entièrement sorties du cœur, <b>0</b> = entièrement enfoncées.</p>
      <p>Elles se déplacent vite mais pas instantanément (72 pas par minute au maximum), d'où le trait orange pour la position réelle. Pilotage automatique actif, le curseur bouge tout seul.</p>
      ${quand('pour garder la température moyenne sur son repère violet quand vous pilotez à la main.')}` },

  { cible: '#sl-bore', titre: 'Curseur · Bore',
    texte: `<p>La <b>concentration de bore</b> dans l'eau du primaire, en « ppm » (millionièmes). Plus elle est élevée, plus la réaction est freinée.</p>
      <p>On la change lentement : 10 ppm par minute au plus. En fonctionnement normal, le bore sert à compenser l'usure du combustible et le xénon, pour garder les grappes presque toutes sorties.</p>
      ${quand('pour les changements lents, sur plusieurs heures. Pour un changement rapide, on utilise les grappes.')}` },

  { cible: '#sl-gct', titre: 'Curseur · Consigne GCT (le contournement)',
    texte: `<p>Le GCT est une <b>soupape géante</b> qui envoie la vapeur directement au condenseur sans passer par la turbine. Elle s'ouvre quand la pression de vapeur dépasse la consigne que vous réglez.</p>
      <p>Baisser la consigne, c'est évacuer davantage de vapeur : le primaire <b>se refroidit</b>.</p>
      ${quand('quand la turbine est déclenchée (la vapeur doit aller quelque part) ou pour refroidir volontairement la centrale après un accident.')}` },

  { cible: '#sl-pzr', titre: 'Curseur · Consigne de pression primaire',
    texte: `<p>La pression que le pressuriseur cherche à tenir : normalement <b>155 bar</b>. S'il est trop bas, ses chaufferettes se mettent en route. Trop haut, l'aspersion fait redescendre.</p>
      ${quand('pas en fonctionnement normal. On la baisse volontairement dans certains accidents, par exemple pour faire cesser une fuite de générateur de vapeur.')}` },

  { cible: '#g-reacteur', si: complet, titre: 'Commandes du réacteur',
    texte: `<p>Cette zone regroupe tout ce qui touche à la réaction en chaîne :</p>
      <ul><li><b>Pilotage automatique</b> des grappes</li><li><b>Barres d'arrêt</b> (groupe S)</li><li><b>Arrêt d'urgence</b> (AAR) et son <b>réarmement</b></li></ul>
      <p>Les cadenas 🔒 sont des commandes qui seront débloquées au fil des missions.</p>` },

  { cible: '#c-autoR', titre: 'Case · Pilotage automatique des grappes',
    texte: `<p>Cochée, un automate déplace tout seul les grappes R pour garder la température moyenne sur son repère, comme un <b>régulateur de vitesse</b> de voiture.</p>
      <p>Décochée, c'est vous qui conduisez, comme avec un volant sans assistance.</p>
      ${quand('laissez-la cochée pour débuter. On la décoche pour apprendre à piloter à la main (mission 2).')}` },

  { cible: '#b-S', titre: 'Bouton · Barres d\'arrêt (groupe S)',
    texte: `<p>Les barres d'arrêt sont des grappes de <b>sécurité</b>. En fonctionnement, elles sont <b>entièrement sorties</b> et ne servent à rien, comme un frein d'urgence qu'on n'utilise pas. Elles retombent toutes seules lors d'un arrêt automatique.</p>
      ${quand('uniquement pour démarrer le réacteur : il faut d\'abord les sortir (mission 4).')}` },

  { cible: '#btn-aar', titre: 'Bouton · Arrêt d\'urgence (AAR)',
    texte: `<p>Le <b>gros bouton rouge</b>. Il fait tomber toutes les grappes dans le cœur en 2 secondes : la réaction en chaîne s'arrête presque immédiatement.</p>
      <p>Mais la <b>puissance résiduelle</b> demeure (environ 6 % au début) : il faut continuer à refroidir. Les automatismes de la centrale déclenchent aussi cet arrêt tout seuls quand un seuil de sécurité est dépassé.</p>
      ${quand('au moindre doute sur la sûreté. Arrêter un réacteur n\'est jamais une faute.')}` },

  { cible: '#b-rearm', titre: 'Bouton · Réarmer l\'AAR',
    texte: `<p>Après un arrêt, on ne peut pas rouvrir les grappes tant que <b>la cause</b> de l'arrêt <b>n'est pas supprimée</b>. Ce bouton les autorise à bouger de nouveau, quand c'est sans danger.</p>
      ${quand('après un arrêt, quand le problème est réglé et que vous voulez redémarrer.')}` },

  { cible: '#g-primaire', si: complet, titre: 'Commandes du circuit primaire',
    texte: `<p>Tout ce qui touche à l'eau du réacteur : les <b>pompes</b>, le <b>pressuriseur</b> et ses organes (chaufferettes, aspersion, soupape) et l'<b>injection de sécurité</b>.</p>
      <p>Chaque rangée a des boutons : <b style="color:#7be0b5">vert</b> signifie actif, gris inactif, <b style="color:#ff8f8f">rouge</b> signifie coupé.</p>` },

  { cible: '#r-pompes', titre: 'Boutons · Les pompes primaires',
    texte: sim => `<p>Une pompe par boucle (${sim.K.NB} ici). Elles font <b>circuler l'eau</b> dans le cœur à très fort débit, comme le circulateur d'un chauffage central.</p>
      <p>Si elles s'arrêtent, il reste un petit débit par <b>circulation naturelle</b> : l'eau chaude monte, l'eau froide descend, comme une cheminée.</p>
      ${quand('pas en fonctionnement normal. On les arrête pour étudier la circulation naturelle (mission 5).')}` },

  { cible: '#b-pzrAuto, #b-chauf, #b-asp', titre: 'Boutons · Régulation de pression, chaufferettes, aspersion',
    texte: `<p><b>Auto</b> : le pressuriseur règle la pression tout seul, comme un thermostat.</p>
      <p><b>Chauff.</b> (les chaufferettes) : des résistances qui vaporisent de l'eau et <b>font monter</b> la pression.</p>
      <p><b>Aspersion</b> : de l'eau froide est pulvérisée dans la vapeur, qui se condense, et la pression <b>baisse</b>. Elle demande au moins une pompe primaire en service.</p>
      ${quand('on laisse « Auto » enclenché. On passe en manuel pour voir comment la pression réagit.')}` },

  { cible: '#b-soupOuv, #b-soupIsol', titre: 'Boutons · Soupape du pressuriseur',
    texte: `<p>La <b>soupape</b> protège le circuit : elle s'ouvre toute seule si la pression dépasse 166 bar, comme celle d'une cocotte-minute qui siffle. On peut aussi l'<b>ouvrir à la main</b> pour baisser vite la pression.</p>
      <p>Si elle reste <b>coincée ouverte</b>, l'eau du primaire s'échappe : c'est un accident. Le bouton <b>Isoler</b> ferme la ligne en amont.</p>
      ${quand('« Isoler » seulement si la soupape ne se referme plus.')}` },

  { cible: '#b-is, #b-isStop', titre: 'Boutons · Injection de sécurité (IS)',
    texte: `<p>Des pompes puissantes qui <b>injectent de l'eau froide chargée en bore</b> dans le circuit, pour le remplir et étouffer la réaction. Elles démarrent toutes seules sous 121 bar.</p>
      <p>On ne les arrête que lorsque le primaire est de nouveau sous contrôle (niveau pressuriseur et marge à la saturation suffisants), sinon elles remplissent trop le circuit.</p>
      ${quand('en cas de fuite du circuit primaire. Elles sont là pour compenser l\'eau perdue.')}` },

  { cible: '#g-secondaire', si: complet, titre: 'Commandes du circuit secondaire',
    texte: `<p>Tout ce qui touche à la vapeur et à la turbine : <b>démarrage de la turbine</b>, <b>vannes</b> d'isolement des générateurs de vapeur, et <b>alimentation en eau</b> de ces générateurs.</p>` },

  { cible: '#b-lancer, #b-coupler, #b-declT', titre: 'Boutons · Lancer, coupler, déclencher la turbine',
    texte: `<p><b>Lancer</b> : on amène la turbine à 1500 tours par minute avec un peu de vapeur (il faut au moins 3 % de puissance réacteur).</p>
      <p><b>Coupler</b> : on branche l'alternateur sur le réseau électrique. La centrale commence à produire.</p>
      <p><b>Déclencher</b> : on coupe brutalement la vapeur de la turbine. Elle part alors au condenseur par le contournement (GCT).</p>
      ${quand('pour démarrer une centrale arrêtée (mission 4). « Déclencher » arrive aussi automatiquement après un arrêt du réacteur.')}` },

  { cible: '#r-viv, #r-alim', titre: 'Boutons · Vannes vapeur et alimentation en eau',
    texte: `<p><b>Vannes vapeur</b> (une par générateur de vapeur) : fermées, elles <b>isolent</b> un générateur du reste du circuit vapeur.</p>
      <p><b>Alimentation</b> : coupe l'arrivée d'eau dans un générateur de vapeur.</p>
      <p>Ces deux boutons servent surtout à <b>isoler un générateur de vapeur accidenté</b>, par exemple après une rupture de tube, pour que la radioactivité ne se répande pas dans la salle des machines.</p>` },

  { cible: '#r-asg', titre: 'Boutons · Alimentation de secours (ASG)',
    texte: `<p>Les générateurs de vapeur doivent toujours contenir de l'eau pour évacuer la chaleur du cœur. Si l'alimentation normale est perdue, l'<b>ASG</b> prend le relais avec des pompes de secours.</p>
      <p><b>Auto</b> : elle démarre toute seule si besoin. <b>Marche</b> : on la force. <b>Arrêt</b> : on l'arrête.</p>
      ${quand('laissez « Auto ». C\'est le remplaçant qui entre sur le terrain quand le titulaire est blessé.')}` },

  { cible: '#verriere', titre: 'La verrière d\'alarmes',
    texte: `<p>Chaque tuile s'allume quand quelque chose sort de la normale :</p>
      <ul><li><b style="color:#ff4d4d">Rouge</b> : alarme. Un son retentit et le temps repasse à vitesse normale.</li><li><b style="color:#ffb020">Orange</b> : avertissement.</li><li><b style="color:#37d39b">Vert</b> : un système de secours est en service.</li></ul>
      <p>Cliquez sur une tuile pour l'acquitter et lire son explication.</p>` },

  { cible: '#onglets', titre: 'Les onglets · Comprendre ce qui se passe',
    avant: () => onglet('courbes'),
    texte: `<p>Cinq vues pour comprendre en profondeur ce qui se passe :</p>
      <ul><li><b>Courbes</b> : l'historique des grandeurs principales, pour voir une tendance.</li><li><b>Bilan de réactivité</b> : qui pousse la réaction vers le haut ou le bas (grappes, bore, température, xénon).</li><li><b>Diagramme pression-température</b> : la distance qui vous sépare de l'ébullition.</li><li><b>Crayon combustible</b> : la température dans une pastille d'uranium, du centre jusqu'à l'eau.</li><li><b>Journal</b> : tout ce qui s'est passé, avec l'heure.</li></ul>` },

  { cible: '#bas', titre: 'Onglet · Bilan de réactivité',
    avant: () => onglet('reac'),
    texte: `<p>Chaque ligne est un effet qui agit sur la réaction en chaîne : les grappes, le bore, la température du combustible, celle de l'eau, le xénon.</p>
      <p>Une barre <b>vers la droite</b> pousse la réaction vers le haut, une barre <b>vers la gauche</b> la freine. Pour que la puissance reste constante, tout doit <b>s'équilibrer</b> : la ligne « total » reste à zéro. C'est le « exactement un domino » de tout à l'heure.</p>
      ${astuce('Quand vous bougerez un curseur, regardez quelle barre change, et laquelle vient la compenser.')}` },

  { cible: '#bas', titre: 'Onglets · Diagramme pression-température et crayon',
    avant: () => onglet('pt'),
    texte: `<p>Le <b>diagramme pression-température</b> montre la courbe d'ébullition de l'eau. Tant que le point du primaire reste <b>à gauche de la courbe</b>, dans la zone « liquide », le cœur est bien refroidi. S'il touche la courbe, l'eau se met à bouillir.</p>
      <p>L'onglet <b>Crayon combustible</b> montre à quel point le centre de la pastille d'uranium est plus chaud que l'eau qui la refroidit.</p>` },

  { cible: '#temps, #horloge', titre: 'Le temps : pause et accélération',
    avant: () => onglet('courbes'),
    texte: `<p><b>Pause</b> (ou touche Espace) : tout est gelé, le temps de réfléchir.</p>
      <p><b>×1</b> : temps réel. Les autres vitesses accélèrent la simulation : <b>×60</b> = 1 minute par seconde, <b>×3600</b> = 1 heure par seconde.</p>
      <p>L'accélération sert pour les phénomènes lents, comme le xénon qui s'accumule sur des heures. Le temps ralentit tout seul quand une alarme se déclenche.</p>` },

  { cible: '#btn-missions, #btn-incident, #btn-aide, #btn-options', titre: 'Les quatre boutons du haut',
    texte: `<p><b>🎯 Missions</b> : le parcours pour apprendre, de plus en plus difficile. Chaque mission débloque de nouvelles commandes.</p>
      <p><b>⚡ Incident</b> : déclenche une panne à n'importe quel moment. Le temps se fige, la cause est expliquée, puis des flèches vous guident.</p>
      <p><b>❔ Aide</b> : le glossaire des sigles (AAR, RTGV, GCT...) et un rappel des principes.</p>
      <p><b>⚙ Options</b> : modèle de centrale (900 ou 1300 MWe), moment dans le cycle du combustible, son.</p>` },

  { cible: '#info', titre: 'À vous : survolez pour comprendre',
    attend: sim => !!sim._survol,
    avant: sim => { sim._survol = false; if (root.document) { const el = document.getElementById('cadrans'); const h = () => { sim._survol = true; el.removeEventListener('mouseover', h); }; el.addEventListener('mouseover', h); } },
    texte: `<p>Cette barre en bas de l'écran est votre <b>aide en direct</b> : elle explique ce que vous survolez avec la souris, que ce soit un cadran, un bouton, une tuile d'alarme ou un morceau du schéma.</p>`,
    afaire: 'Passez la souris sur un des cadrans à gauche : lisez son explication dans la barre du bas.',
    fais: sim => { sim._survol = true; } },

  { titre: 'Cours terminé !',
    texte: `<p>Vous savez maintenant <b>comment marche une centrale</b> et <b>à quoi sert chaque bouton</b>.</p>
      <p>Ensuite viennent les missions, une commande à la fois :</p>
      <ul><li><b>1</b> · suivre la demande du réseau avec la turbine</li><li><b>2</b> · piloter les grappes</li><li><b>3</b> · bore et xénon</li><li><b>4</b> · démarrer le réacteur</li><li><b>5</b> · arrêt d'urgence</li><li><b>6</b> · accident de tube de générateur de vapeur</li></ul>
      <p>Si un terme vous échappe en route, le bouton <b>❔ Aide</b> contient un glossaire, et vous pouvez refaire ce cours à tout moment depuis la liste des missions.</p>` },
];

root.Cours = { ETAPES: COURS };
})(typeof window !== 'undefined' ? window : globalThis);
