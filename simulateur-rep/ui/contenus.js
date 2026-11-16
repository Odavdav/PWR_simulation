/* ======== ui/contenus.js ======== */
/* =====================================================================
   ui/contenus.js — TOUT LE CONTENU PÉDAGOGIQUE
   ---------------------------------------------------------------------
   Visite guidée de l'écran, missions à difficulté croissante, guidage des
   incidents, principes et glossaire. Aucun calcul de centrale ici : les
   étapes lisent l'état (sim.s), les commandes (sim.u) et les sorties (sim.s.out).
   Format d'une étape : voir ui/guide.js.
   Pour ajouter une mission ou un incident guidé, il suffit d'ajouter une
   entrée dans MISSIONS ou dans GUIDES.
   ===================================================================== */
(function (root) {
'use strict';
const REP = root.REP, C = REP.COMMUN;

/* ---------------- petits outils d'écriture ---------------- */
const f0 = x => Math.round(x), f1 = x => (+x).toFixed(1);
const coche = (c, t) => `<div style="color:${c ? '#7be0b5' : '#ffb7a0'}">${c ? '✔' : '✘'} ${t}</div>`;
const mesure = (nom, v) => `<div style="display:flex;justify-content:space-between;border-bottom:1px dotted #2a3a48"><span>${nom}</span><b style="font-family:ui-monospace,monospace">${v}</b></div>`;
const onglet = o => { if (root.document) { const b = document.querySelector('#onglets [data-o="' + o + '"]'); if (b) b.click(); } };
const pasR = sim => C.pas_max * (1 - sim.s.xR);                 // position réelle du groupe R (pas extraits)
const k = sim => Math.max(0, sim.s.gvAccident);                 // numéro de la boucle accidentée
const GV = sim => 'GV' + (k(sim) + 1);
const tousGV = sim => sim.s.bcl.map((b, i) => '#syn-gv' + i).join(', ');
const depuis = (sim, cle) => sim.s.t - (sim['_' + cle] || 0);
const top = cle => sim => { sim['_' + cle] = sim.s.t; };
const nivMin = sim => Math.min(...sim.s.bcl.map(b => b.niv));
const p0 = sim => sim.K.G.p2_zero;                               // pression vapeur à puissance nulle (consigne GCT par défaut)
const pGcta = sim => f0(p0(sim) + C.gcta_marge);                // ouverture des décharges à l'atmosphère
const Tsat = P => f0(REP.eau.Tsat(P));
const pRefroid = sim => Math.round(p0(sim) - 20);                  // consigne GCT pour refroidir lors d'un RTGV
const TRefroid = sim => Math.round(REP.eau.Tsat(p0(sim) + C.gcta_marge) - 21);   // sortie cœur à atteindre avant de dépressuriser
const simple = () => !!(root.App && root.App.opt && root.App.opt.simple);   // affichage simplifié (voir App.simplifier)
const vite = 'Vous pouvez accélérer le temps avec les boutons <b>×5</b> ou <b>×10</b> en haut de l\'écran.';

/* =====================================================================
   VISITE GUIDÉE DE L'ÉCRAN (temps figé)
   ===================================================================== */
const VISITE = [
  { titre: 'Bienvenue en salle de commande',
    texte: sim => `<p>Vous allez conduire un <b>réacteur à eau pressurisée</b> (${sim.K.G.nom}), le type de centrale qui produit l'essentiel de l'électricité française.</p>
      <p>Le temps est <b>figé</b> pendant cette visite. On regarde d'abord chaque morceau de l'écran, puis vous prendrez les commandes, une à la fois.</p>` },
  { cible: '#synoptique', titre: 'La centrale, vue en coupe',
    texte: `<p>Ce schéma est vivant : les couleurs suivent les <b>températures</b>, les tirets qui défilent montrent les <b>débits</b>, les niveaux d'eau montent et descendent.</p>
      <p>À gauche, le bâtiment réacteur (l'enceinte en béton). À droite, la salle des machines. Tout ce que vous ferez se verra ici.</p>` },
  { cible: '#syn-cuve', titre: 'Le cœur du réacteur',
    texte: sim => `<p>Dans la cuve, ${sim.K.G.N_ass} assemblages de combustible. Les noyaux d'uranium se cassent (<b>fission</b>) et chauffent l'eau qui les traverse : elle entre à ${f0(sim.K.G.T_e)} °C et ressort à ${f0(sim.K.G.T_s)} °C.</p>
      <p>Les <b>grappes de commande</b> descendent par le haut : elles absorbent les neutrons et freinent la réaction. La lueur bleue du cœur suit la puissance.</p>` },
  { cible: '#syn-pzr', titre: 'Le pressuriseur',
    texte: `<p>À 320 °C, l'eau devrait bouillir. Pour qu'elle reste liquide, le circuit primaire est maintenu à <b>155 bar</b> par ce réservoir, moitié eau, moitié vapeur.</p>
      <p>Des <b>chaufferettes</b> font monter la pression, une <b>aspersion</b> la fait baisser. Son niveau d'eau est le meilleur témoin de ce qui arrive au circuit primaire.</p>` },
  { cible: tousGV, titre: 'Les générateurs de vapeur',
    texte: sim => `<p>L'eau du primaire (rouge) circule dans des milliers de tubes en U et chauffe, sans jamais s'y mélanger, l'eau du <b>circuit secondaire</b> qui se transforme en vapeur à ${f0(sim.K.G.p2)} bar.</p>
      <p>Il y a ${sim.K.NB} boucles identiques, chacune avec sa <b>pompe primaire</b>. Ces tubes sont la frontière entre l'eau radioactive et le reste de la centrale : on y reviendra avec l'accident de rupture de tube.</p>` },
  { cible: '#syn-turbine, #syn-alt, #syn-cond', titre: 'Turbine, alternateur, condenseur',
    texte: sim => `<p>La vapeur fait tourner la <b>turbine</b> à 1500 tr/min. L'<b>alternateur</b> transforme ce mouvement en électricité : ${f0(sim.K.G.P_e / 1e6)} MW envoyés sur le réseau.</p>
      <p>La vapeur est ensuite refroidie dans le <b>condenseur</b> par l'eau de mer ou de rivière, et repart vers les générateurs de vapeur. Les deux tiers de la chaleur partent ici : c'est le prix du cycle thermodynamique.</p>` },
  { cible: '#cadrans', titre: 'Les cadrans',
    texte: () => `<p>${simple() ? 'Les grandeurs à surveiller en permanence.' : 'Les huit grandeurs à surveiller en permanence.'} Les arcs <b style="color:#ffb020">orange</b> et <b style="color:#ff4d4d">rouges</b> marquent les zones à éviter : au-delà, les protections arrêtent le réacteur toutes seules.</p>
      <p>Sur le cadran de température moyenne, le petit repère violet est la valeur à tenir.</p>` },
  { cible: '#g-curseurs', titre: 'Les curseurs de conduite',
    texte: `<p>Vos commandes principales. Faites glisser la poignée, utilisez la molette ou les boutons <b>−</b> et <b>+</b>.</p>
      <p>La poignée blanche est <b>votre demande</b>. Le trait orange montre la <b>valeur réelle</b>, qui met du temps à suivre : une grappe, une turbine ou une concentration en bore ne changent pas instantanément.</p>` },
  { cible: () => simple() ? '#commandes' : '#g-reacteur, #g-primaire, #g-secondaire', titre: 'Les commandes de la centrale',
    texte: () => `<p>Pompes, pressuriseur, turbine, vannes, systèmes de secours. ${simple() ? 'Presque tout est <b>caché</b> pour l\'instant, pour ne pas vous noyer.' : 'Presque tout est <b>verrouillé 🔒</b> pour l\'instant.'}</p>
      <p>Chaque mission débloque quelques commandes de plus, jusqu'à avoir toute la salle de commande en main pour gérer un accident.</p>` },
  { cible: '#verriere', titre: 'La verrière d\'alarmes',
    texte: `<p>Chaque tuile s'allume quand quelque chose sort de la normale : <b style="color:#ff4d4d">rouge</b> pour une alarme, <b style="color:#ffb020">orange</b> pour un avertissement, <b style="color:#37d39b">vert</b> pour un système de secours en service.</p>
      <p>Une alarme rouge sonne et ramène le temps à vitesse normale. Cliquez sur une tuile pour l'acquitter.</p>` },
  { cible: '#bas', titre: 'Courbes et diagnostics', si: () => !simple(),
    texte: `<p>Cinq onglets pour comprendre ce qui se passe :</p>
      <ul><li><b>Courbes</b> : l'historique des grandeurs principales</li><li><b>Bilan de réactivité</b> : qui pousse la puissance vers le haut ou vers le bas</li><li><b>Diagramme pression-température</b> : la distance à l'ébullition</li><li><b>Crayon combustible</b> : la température du centre de la pastille jusqu'à l'eau</li><li><b>Journal</b> : tous les événements, horodatés</li></ul>` },
  { cible: '#temps, #horloge', titre: 'Le temps',
    texte: `<p>Mettez en <b>pause</b> à tout moment (touche Espace) pour réfléchir. Accélérez pour les phénomènes lents : une variation de charge prend des minutes, le xénon des heures.</p>
      <p>Les vitesses les plus élevées se débloquent avec la mission sur le xénon.</p>` },
  { cible: '#btn-missions, #btn-incident, #btn-aide, #btn-options', titre: 'Missions, incidents, aide',
    texte: `<p><b>🎯 Missions</b> : le parcours à difficulté croissante.</p><p><b>⚡ Incident</b> : déclenche une panne à n'importe quel moment. Le temps se fige, la cause est expliquée, puis des flèches vous montrent quoi faire.</p>
      <p><b>❔ Aide</b> : glossaire des sigles et rappel des principes. <b>⚙</b> : palier 900 ou 1300 MWe, avancement du cycle, son.</p>` },
  { cible: '#info', titre: 'Un doute ? Survolez',
    texte: `<p>Passez la souris sur n'importe quel cadran, bouton, tuile ou élément du schéma : son rôle s'affiche ici.</p><p>Fin de la visite. À vous de jouer.</p>` },
];

/* =====================================================================
   MISSIONS
   ===================================================================== */
const echecAAR = sim => sim.s.aar ? 'Arrêt automatique du réacteur : ' + (sim.s.aarCause || 'cause inconnue') + '.' : null;
const actionCharge = (cible, pct) => ({ cible: '#sl-turb', titre: 'Charge turbine à ' + pct + ' %',
  texte: `<p>Faites glisser la poignée du curseur <b>Charge turbine</b>, ou utilisez le bouton <b>−</b> ou <b>+</b> sous le curseur.</p><p>Le trait orange (charge réelle) suivra à 30 % par minute.</p>`,
  afaire: 'Réglez la charge turbine sur ' + pct + ' %.', attend: sim => Math.abs(sim.u.turb - cible) < 0.021, fais: sim => { sim.u.turb = cible; } });

const MISSIONS = [
  /* ------------------------------------------------------------------ 0 : le cours (étapes dans ui/cours.js) */
  { id: 'm0', cadrans: ['n', 'pe', 'tm', 'p'], vueCles: ['turbine', 'barres', 'arret'], num: 0, titre: 'Comprendre une centrale', duree: '15 min', etat: 'nominal', cours: true,
    resume: 'Pour débuter sans rien connaître : la fission, la réaction en chaîne, la « grosse bouilloire », les trois circuits, la sûreté. Puis chaque cadran et chaque bouton de l\'écran, expliqués un par un.',
    nouveau: 'rien à piloter, tout à comprendre', debloque: [],
    preparer: sim => { sim.u.autoR = true; },
    intro: root.Cours.ETAPES,
    objectifs: [{ texte: 'Suivre le cours jusqu\'au bout', test: () => true }],
    bilan: 'Vous connaissez maintenant le principe d\'une centrale nucléaire : une <b>réaction en chaîne</b> maîtrisée qui chauffe de l\'eau, de la <b>vapeur</b> qui fait tourner une turbine, et des <b>barrières</b> pour enfermer la radioactivité. Vous savez aussi à quoi sert chaque commande. Place à la pratique.' },

  /* ------------------------------------------------------------------ 1 */
  { id: 'm1', num: 1, titre: 'Prise en main', duree: '5 min', etat: 'nominal',
    resume: 'Visite guidée de l\'écran, puis première manœuvre : baisser la puissance de la centrale à 80 % et la remonter.',
    nouveau: 'le curseur de charge de la turbine', debloque: ['turbine'],
    preparer: sim => { sim.u.autoR = true; },
    intro: VISITE.concat([
      { cible: '#sl-turb', titre: 'Votre première commande',
        texte: `<p>La centrale tourne à <b>100 %</b>. Le réseau électrique demande de baisser la production : c'est le <b>suivi de charge</b>, que les réacteurs français pratiquent tous les jours.</p>
          <p>Dans un REP, on ne règle pas directement le réacteur : on règle la <b>turbine</b>, et le réacteur suit. Vous allez voir pourquoi.</p>` },
      actionCharge(0.8, 80),
    ]),
    objectifs: [
      { texte: 'Régler la charge turbine sur 80 %', test: sim => Math.abs(sim.u.turb - 0.8) < 0.021, bot: sim => { sim.u.turb = 0.8; } },
      { texte: 'Laisser le réacteur se stabiliser à 80 % (30 s)', maintien: 30,
        test: sim => Math.abs(sim.s.n - 0.8) < 0.03 && Math.abs(sim.s.out.Tmoy - sim.s.out.Tref) < 1.6,
        guide: [
          { cible: '#cad-n, #cad-pe', titre: 'Observez les deux cadrans de puissance', dynamique: true,
            texte: sim => `<p>La turbine réduit sa charge : la puissance électrique baisse. Regardez ce que fait le réacteur, alors que vous n'y avez pas touché.</p>
              ${mesure('Puissance électrique', f0(sim.s.Pe / 1e6) + ' MW')}${mesure('Puissance réacteur', f1(sim.s.n * 100) + ' %')}${mesure('Température moyenne', f1(sim.s.out.Tmoy) + ' °C')}`,
            afaire: 'Laissez la puissance du réacteur descendre sous 92 %.', attend: sim => sim.s.n < 0.92 },
          { cible: '#cad-n, #cad-pe', titre: 'Le réacteur suit la turbine',
            texte: `<p>La turbine prend moins de vapeur. La chaleur s'évacue moins bien, donc l'eau du primaire <b>se réchauffe</b> de quelques degrés.</p>
              <p>Une eau plus chaude est moins dense : elle ralentit moins bien les neutrons, la réaction en chaîne faiblit et <b>la puissance baisse toute seule</b>. C'est l'effet modérateur, la grande sécurité naturelle de ce type de réacteur.</p>` },
          { cible: '#cad-tm', titre: 'La température moyenne',
            texte: `<p>Le repère violet est la température de référence : elle baisse avec la charge. Pour l'instant, un <b>pilotage automatique</b> déplace les grappes pour garder l'aiguille sur le repère.</p>
              <p>Vous prendrez la main sur les grappes à la mission suivante.</p>` },
          { cible: '#temps', titre: 'Patience... ou pas',
            texte: () => `<p>La stabilisation prend une à deux minutes. ${vite}</p><p>${simple() ? 'Regardez les deux cadrans de puissance : ils descendent ensemble.' : 'Regardez les courbes en bas : puissance réacteur et puissance électrique descendent ensemble.'}</p>` },
        ] },
      { texte: 'Remonter à 100 % et stabiliser (20 s)', maintien: 20,
        test: sim => sim.s.n > 0.985 && sim.s.charge > 0.99, bot: sim => { sim.u.turb = 1; },
        guide: [
          { cible: () => simple() ? '#cad-pe' : '#bas', titre: 'Stabilisé à 80 %',
            texte: sim => `<p>La centrale produit maintenant <b>${f0(sim.s.Pe / 1e6)} MW</b> électriques. Vous n'avez touché qu'à la turbine, et le réacteur s'est adapté.</p><p>Le réseau redemande la pleine puissance.</p>` },
          actionCharge(1, 100),
        ] },
    ],
    echec: echecAAR,
    bilan: 'Vous venez de faire un suivi de charge. À retenir : dans un REP, <b>la turbine commande et le réacteur suit</b>, grâce à l\'effet de la température de l\'eau sur la réaction en chaîne.',
    conseil: 'Avec le pilotage automatique des grappes, une variation de charge ne doit pas déclencher d\'arrêt. Recommencez en ne touchant qu\'au curseur de charge.' },

  /* ------------------------------------------------------------------ 2 */
  { id: 'm2', num: 2, titre: 'Piloter avec les grappes', duree: '8 min', etat: 'nominal',
    resume: 'Le pilotage automatique est coupé. À vous de tenir la température du primaire avec les grappes de commande.',
    nouveau: 'le curseur des grappes R et le pilotage automatique', debloque: ['turbine', 'barres', 'autoR'],
    preparer: sim => { sim.u.autoR = false; },
    intro: [
      { titre: 'Sans pilote automatique',
        texte: `<p>À la mission précédente, un automate déplaçait les grappes pour vous. Il est maintenant <b>coupé</b>.</p>
          <p>Vous allez voir ce que le réacteur fait tout seul, puis corriger avec les <b>grappes de commande</b>.</p>` },
      { cible: '#sl-R', titre: 'Le groupe de grappes R',
        texte: `<p>Position en <b>pas extraits</b> : 225 = grappes entièrement sorties du cœur, 0 = entièrement insérées. En fonctionnement, elles sont presque sorties (200 pas).</p>
          <p><b>Insérer</b> (baisser le curseur) absorbe des neutrons : la puissance et la température baissent. <b>Extraire</b> fait l'inverse. Les grappes bougent à 72 pas par minute au plus.</p>` },
      { cible: '#bas', titre: 'Le bilan de réactivité', avant: () => onglet('reac'),
        texte: `<p>La <b>réactivité</b> (en pcm) mesure l'écart à l'équilibre de la réaction en chaîne : zéro = puissance stable, positive = la puissance monte, négative = elle baisse.</p>
          <p>Chaque barre montre la contribution d'un effet : grappes, bore, température du combustible (Doppler), température de l'eau (modérateur), xénon. Gardez cet onglet à l'œil pendant la mission.</p>` },
      actionCharge(0.93, 93),
    ],
    objectifs: [
      { texte: 'Baisser la charge turbine à 93 %', test: sim => Math.abs(sim.u.turb - 0.93) < 0.021, bot: sim => { sim.u.turb = 0.93; } },
      { texte: 'Observer : le réacteur suit, mais la température dérive (40 s)', maintien: 40,
        test: sim => sim.s.charge < 0.94 && !sim.u.autoR,
        guide: [
          { cible: '#cad-tm', titre: 'La température s\'écarte du repère',
            texte: `<p>Le réacteur baisse bien sa puissance tout seul, mais regardez : pour y arriver, l'eau du primaire <b>s'est réchauffée</b>, alors que le repère violet, lui, a baissé.</p>
              <p>Si on laissait faire, chaque baisse de charge ferait monter température et pression. On corrige donc avec les grappes.</p>` },
        ] },
      { texte: 'Ramener la température moyenne sur son repère avec les grappes (±0,7 °C pendant 20 s)', maintien: 20,
        test: sim => Math.abs(sim.s.out.Tmoy - sim.s.out.Tref) < 0.7 && sim.s.charge < 0.95 && !sim.u.autoR,
        bot: sim => { const e = sim.s.out.Tmoy - sim.s.out.Tref; if (Math.abs(e) > 0.3 && Math.abs(pasR(sim) - sim.u.R) < 0.6) sim.u.R -= Math.sign(e) * 1; },
        guide: [
          { cible: '#sl-R', titre: 'À vous : insérez les grappes',
            texte: sim => `<p>La température moyenne est <b>${f1(sim.s.out.Tmoy - sim.s.out.Tref)} °C</b> au-dessus de sa référence. Insérez les grappes de quelques pas (bouton <b>−</b> sous le curseur) et attendez l'effet : la température met une vingtaine de secondes à réagir.</p>
              <p>Allez-y par petites touches : 2 ou 3 pas, on regarde, on corrige. C'est exactement ce que fait un opérateur.</p>` },
        ] },
      { texte: 'Réactiver le pilotage automatique et remonter à 100 % (15 s)', maintien: 15,
        test: sim => sim.u.autoR && sim.s.n > 0.985 && sim.s.charge > 0.99, bot: sim => { sim.u.autoR = true; sim.u.turb = 1; },
        guide: [
          { cible: '#c-autoR', titre: 'Rendez la main à l\'automate',
            texte: `<p>Bien joué. Vous savez maintenant ce que fait le pilotage automatique : il déplace le groupe R pour que la température moyenne suive sa référence.</p>`,
            afaire: 'Cochez « Pilotage automatique des grappes ».', attend: sim => sim.u.autoR, fais: sim => { sim.u.autoR = true; } },
          actionCharge(1, 100),
        ] },
    ],
    echec: echecAAR,
    bilan: 'Vous avez piloté le réacteur à la main. À retenir : les grappes ne servent pas à « régler la puissance » (la turbine s\'en charge), elles servent à <b>tenir la température du primaire</b> sur son programme.',
    conseil: 'Bougez les grappes par petites touches et laissez le temps à la température de réagir. Une extraction trop franche fait monter la puissance au-delà de 109 % : arrêt automatique.' },

  /* ------------------------------------------------------------------ 3 */
  { id: 'm3', num: 3, titre: 'Bore et xénon', duree: '10 min', etat: 'nominal',
    resume: 'Une longue baisse de charge à 50 %. Un poison invisible, le xénon, s\'accumule pendant des heures : il faut le compenser avec le bore.',
    nouveau: 'le curseur de bore et le temps accéléré jusqu\'à ×3600', debloque: ['turbine', 'barres', 'autoR', 'bore', 'temps'],
    preparer: sim => { sim.u.autoR = true; },
    intro: [
      { titre: 'Les effets lents',
        texte: `<p>Jusqu'ici tout se jouait en minutes. Deux phénomènes agissent sur des <b>heures</b> : le <b>xénon 135</b>, un produit de fission qui dévore les neutrons, et le <b>bore</b> dissous dans l'eau, que l'opérateur ajuste pour le compenser.</p>` },
      { cible: '#sl-bore', titre: 'Le bore',
        texte: `<p>De l'acide borique est dissous dans l'eau du primaire : il absorbe les neutrons partout dans le cœur, de façon uniforme (environ −10 pcm par ppm).</p>
          <p><b>Boriquer</b> (monter le curseur) retire de la réactivité, <b>diluer</b> (le baisser) en rend. C'est lent, 10 ppm par minute, mais cela permet de garder les grappes presque extraites, là où elles déforment le moins la puissance dans le cœur.</p>` },
      { cible: '#temps', titre: 'Le temps accéléré',
        texte: `<p>Les vitesses <b>×60, ×600 et ×3600</b> sont débloquées : une heure de centrale en une minute, six secondes ou une seconde.</p><p>Une alarme rouge ramène automatiquement à ×1.</p>` },
      actionCharge(0.5, 50),
    ],
    objectifs: [
      { texte: 'Baisser la charge à 50 % et attendre le réacteur', test: sim => Math.abs(sim.u.turb - 0.5) < 0.021 && sim.s.n < 0.56 && sim.s.charge < 0.51, bot: sim => { sim.u.turb = 0.5; } },
      { texte: 'Boriquer pour faire ressortir les grappes R au-dessus de 185 pas', test: sim => pasR(sim) >= 185 && sim.s.n > 0.44 && sim.s.n < 0.56,
        bot: sim => { if (pasR(sim) < 192 && sim.u.bore - sim.s.bore < 3) sim.u.bore += 5; },
        guide: [
          { cible: '#sl-R', titre: 'Les grappes sont trop enfoncées', avant: () => onglet('reac'),
            texte: sim => `<p>À 50 %, le combustible et l'eau sont plus froids : ils « rendent » de la réactivité. Le pilotage automatique a compensé en insérant les grappes jusqu'à <b>${f0(pasR(sim))} pas</b>.</p>
              <p>On ne reste pas ainsi : des grappes enfoncées déforment la répartition de puissance et entament la réserve d'arrêt. On les fait ressortir en <b>boriquant</b>.</p>` },
          { cible: '#sl-bore', titre: 'Boriquez',
            texte: sim => `<p>Montez la consigne de bore d'environ <b>60 à 80 ppm</b> (elle est à ${f0(sim.u.bore)} ppm). Le pilotage automatique ressortira les grappes au fur et à mesure que le bore réel (trait orange) rejoint votre consigne.</p>
              <p>C'est lent : passez en <b>×10</b> ou <b>×60</b>.</p>` },
        ] },
      { texte: 'Xénon : garder les grappes R entre 160 et 220 pas pendant 4 heures en ajustant le bore', maintien: 4 * 3600,
        test: sim => pasR(sim) >= 160 && pasR(sim) <= 220 && sim.s.n > 0.44 && sim.s.n < 0.56,
        bot: sim => { const p = pasR(sim), d = sim.u.bore - sim.s.bore; if (p > 205 && d > -3) sim.u.bore -= 5; if (p < 175 && d < 3) sim.u.bore += 5; },
        guide: [
          { cible: '#bas', titre: 'Le xénon arrive', avant: () => onglet('reac'),
            texte: `<p>Le xénon 135 naît surtout de la désintégration de l'<b>iode 135</b> (période 6,6 h), et il est détruit par les neutrons. Quand la puissance baisse, il est moins détruit alors que l'iode accumulé continue d'en produire : sa quantité <b>monte pendant 7 à 9 heures</b>.</p>
              <p>Regardez la barre « Xénon 135 » : elle va devenir de plus en plus négative. Le pilotage automatique compense en extrayant les grappes... jusqu'à ce qu'il n'y ait plus rien à extraire.</p>` },
          { cible: '#sl-bore', titre: 'Compensez en diluant',
            texte: `<p>Passez en <b>×600</b> et surveillez le curseur des grappes R. Quand elles approchent de 220 pas, <b>diluez</b> : baissez le bore de 10 à 20 ppm, les grappes redescendront.</p>
              <p>Tenez 4 heures de temps simulé. Si les grappes sortent de la plage, le compteur recule.</p>` },
        ] },
    ],
    echec: echecAAR,
    bilan: 'Vous avez compensé le xénon pendant quatre heures. À retenir : le <b>bore</b> gère les effets lents (xénon, usure du combustible), les <b>grappes</b> gèrent les effets rapides. Après un arrêt, le pic de xénon peut même empêcher de redémarrer pendant plusieurs heures en fin de cycle.',
    conseil: 'Gardez le pilotage automatique des grappes et agissez sur le bore par petites touches de 5 à 10 ppm. Si une alarme rouge s\'allume, revenez à ×1 et regardez le bilan de réactivité.' },

  /* ------------------------------------------------------------------ 4 */
  { id: 'm4', num: 4, titre: 'Démarrage', duree: '12 min', etat: 'arret',
    resume: 'Le réacteur est à l\'arrêt à chaud. Faites-le diverger, montez en puissance, lancez la turbine et couplez la centrale au réseau.',
    nouveau: 'les barres d\'arrêt, le bouton d\'arrêt d\'urgence et les commandes de la turbine', debloque: ['turbine', 'barres', 'autoR', 'bore', 'temps', 'arret', 'groupe'],
    intro: [
      { cible: '#synoptique', titre: 'Arrêt à chaud',
        texte: sim => `<p>Le réacteur est arrêté, toutes les grappes sont dans le cœur. Le primaire est pourtant à ${f0(sim.s.out.Tmoy)} °C et 155 bar : ce sont les pompes primaires qui le maintiennent chaud par frottement.</p>
          <p>Il reste une poignée de neutrons (la source). Votre travail : relancer la réaction en chaîne, <b>doucement</b>.</p>` },
      { cible: '#b-S', titre: 'Les barres d\'arrêt',
        texte: `<p>Le groupe S ne sert qu'à la sécurité : il est soit entièrement inséré (réacteur à l'arrêt), soit entièrement extrait, prêt à tomber en 2 secondes en cas d'arrêt automatique.</p>
          <p>On l'extrait toujours <b>en premier</b>, pour que cette réserve soit disponible avant de s'approcher de la criticité.</p>`,
        afaire: 'Cliquez sur le bouton pour extraire les barres d\'arrêt.', attend: sim => sim.u.S, fais: sim => { sim.u.S = true; } },
    ],
    objectifs: [
      { texte: 'Extraire entièrement les barres d\'arrêt', test: sim => sim.s.xS < 0.02, bot: sim => { sim.u.S = true; } },
      { texte: 'Diverger : extraire les grappes R jusqu\'à atteindre 1 % de puissance', test: sim => sim.s.n >= 0.01,
        bot: sim => { if (sim.s.sur < 0.6 && sim.s.n < 0.005) sim.u.R = Math.min(225, sim.u.R + 1); },
        guide: [
          { cible: '#bas', titre: 'Sous-critique', avant: () => onglet('reac'),
            texte: sim => `<p>La réactivité totale est de <b>${f0(sim.s.out.rho.total)} pcm</b> : chaque génération de neutrons est plus petite que la précédente, la réaction s'éteint. Il faut ramener ce total à zéro : c'est la <b>divergence</b>.</p>
              <p>En bas de l'onglet, deux indicateurs vont compter : le <b>taux de démarrage</b> (en décades par minute) et le <b>temps de doublement</b> de la puissance.</p>` },
          { cible: '#sl-R', titre: 'Extrayez les grappes, par paliers',
            texte: `<p>Montez les grappes R par paliers de 10 à 20 pas, en laissant le flux se stabiliser entre deux. Le réacteur deviendra critique vers la <b>mi-course</b>.</p>
              <p>Une fois critique, la puissance monte toute seule, de façon exponentielle. Gardez un temps de doublement <b>supérieur à 20 secondes</b> (taux de démarrage sous 1 décade par minute) : si vous extrayez trop, la puissance s'emballe et le réacteur s'arrête à 109 %.</p>
              <p>Le flux part de très bas (10⁻⁸) : il y a six décades à remonter. Utilisez <b>×5</b> ou <b>×10</b>.</p>` },
        ] },
      { texte: 'Stabiliser la puissance entre 3 et 10 % (30 s)', maintien: 30, test: sim => sim.s.n >= 0.03 && sim.s.n <= 0.10,
        bot: sim => { if (sim.s.n > 0.06 && sim.s.sur > 0.05) sim.u.R = Math.max(0, sim.u.R - 1); else if (sim.s.n < 0.045 && sim.s.sur < 0.05 && Math.abs(pasR(sim) - sim.u.R) < 1) sim.u.R += 1; },
        guide: [
          { cible: '#cad-n', titre: 'Le réacteur a divergé',
            texte: `<p>Vous êtes critique : la réaction s'entretient seule. À partir d'environ 1 %, la chaleur produite devient sensible : le combustible et l'eau chauffent, et leurs <b>contre-réactions</b> freinent la montée.</p>
              <p>Stabilisez entre 3 et 10 % : insérez de quelques pas si la puissance monte trop vite, extrayez si elle redescend. La vapeur produite part pour l'instant directement au condenseur (contournement GCT).</p>` },
        ] },
      { texte: 'Lancer la turbine jusqu\'à 1500 tr/min', test: sim => sim.s.turbine === 'prete' || sim.s.turbine === 'couplee',
        bot: sim => { if (sim.s.turbine === 'arret') sim.action('lancerTurbine'); },
        guide: [
          { cible: '#b-lancer', titre: 'Lancez la turbine',
            texte: `<p>Il y a assez de vapeur. On en admet un peu dans la turbine pour l'amener à sa vitesse de synchronisme : <b>1500 tr/min</b>, soit exactement 50 Hz avec un alternateur à quatre pôles.</p>`,
            afaire: 'Cliquez sur « Lancer ».', attend: sim => sim.s.turbine !== 'arret', fais: sim => { const r = sim.action('lancerTurbine'); if (r && root.App) root.App.toast(r); } },
          { cible: '#syn-turbine', titre: 'Montée en vitesse', dynamique: true,
            texte: sim => `<p>La turbine accélère : <b>${f0(sim.s.Nturb)} tr/min</b>.</p><p>Gardez la puissance du réacteur entre 3 et 10 % pendant ce temps.</p>`,
            afaire: 'Attendez 1500 tr/min.', attend: sim => sim.s.turbine === 'prete' || sim.s.turbine === 'couplee' },
        ] },
      { texte: 'Coupler l\'alternateur au réseau', test: sim => sim.s.turbine === 'couplee', bot: sim => { sim.action('coupler'); },
        guide: [
          { cible: '#b-coupler', titre: 'Couplez au réseau',
            texte: `<p>L'alternateur tourne à la bonne vitesse. Fermer son disjoncteur le relie au réseau électrique : à partir de là, c'est le réseau qui impose la vitesse, et la vapeur admise devient de la puissance électrique.</p>`,
            afaire: 'Cliquez sur « Coupler ».', attend: sim => sim.s.turbine === 'couplee', fais: sim => { sim.action('coupler'); } },
        ] },
      { texte: 'Monter à 30 % de charge avec le pilotage automatique (20 s)', maintien: 20,
        test: sim => sim.s.charge >= 0.295 && sim.s.n > 0.26 && Math.abs(sim.s.out.Tmoy - sim.s.out.Tref) < 2.5,
        bot: sim => { sim.u.autoR = true; sim.u.turb = 0.3; },
        guide: [
          { cible: '#syn-alt, #syn-reseau', titre: 'Couplée !',
            texte: `<p>La centrale fournit ses premiers mégawatts. Il reste à monter en charge : on retrouve la logique des premières missions, la turbine commande et le réacteur suit.</p>` },
          { cible: '#c-autoR', titre: 'Pilotage automatique',
            texte: `<p>Pour la montée en charge, laissez l'automate extraire les grappes à votre place.</p>`,
            afaire: 'Cochez « Pilotage automatique des grappes ».', attend: sim => sim.u.autoR, fais: sim => { sim.u.autoR = true; } },
          { cible: '#sl-turb', titre: 'Montez à 30 %',
            texte: `<p>Montez la charge turbine à 30 %. Aller jusqu'à 100 % demanderait en plus de diluer le bore, comme à la mission précédente : les grappes seules ne suffisent pas à compenser l'échauffement du combustible.</p>`,
            afaire: 'Réglez la charge turbine sur 30 %.', attend: sim => sim.u.turb >= 0.295, fais: sim => { sim.u.turb = 0.3; } },
        ] },
    ],
    echec: echecAAR,
    bilan: 'De la source de neutrons au réseau électrique : vous avez fait diverger le réacteur, stabilisé la puissance, lancé et couplé la turbine. À retenir : on approche la criticité <b>lentement</b>, en surveillant le temps de doublement.',
    conseil: 'Près de la criticité, quelques pas suffisent. Si le temps de doublement passe sous 20 secondes, insérez un peu les grappes et attendez. Le bouton d\'arrêt d\'urgence reste disponible à tout moment.' },

  /* ------------------------------------------------------------------ 5 */
  { id: 'm5', cadrans: ['n', 'pe', 'tm', 'p', 'np', 'mg', 'wr'], num: 5, titre: 'Arrêt d\'urgence et chaleur résiduelle', duree: '10 min', etat: 'nominal',
    resume: 'Arrêtez le réacteur en deux secondes, puis découvrez pourquoi un réacteur arrêté doit encore être refroidi, même sans pompes.',
    nouveau: 'les pompes primaires et les commandes du pressuriseur', debloque: ['turbine', 'barres', 'autoR', 'bore', 'temps', 'arret', 'groupe', 'pompes', 'pzr'],
    preparer: sim => { sim.u.autoR = true; },
    intro: [
      { titre: 'Arrêter n\'est pas éteindre',
        texte: `<p>Un réacteur s'arrête en deux secondes. Mais les produits de fission accumulés dans le combustible continuent de chauffer pendant des jours : c'est la <b>puissance résiduelle</b>.</p>
          <p>Toute la sûreté nucléaire tourne autour de cette chaleur qu'on ne peut pas couper. Vous allez l'observer.</p>` },
      { cible: '#btn-aar', titre: 'L\'arrêt automatique du réacteur (AAR)',
        texte: `<p>Ce bouton coupe l'alimentation des mécanismes qui retiennent les grappes : elles <b>tombent par gravité</b> dans le cœur. Les protections font la même chose toutes seules dès qu'un seuil est dépassé.</p>`,
        afaire: 'Appuyez sur ARRÊT D\'URGENCE.', attend: sim => sim.s.aar, fais: sim => { sim.action('aar'); } },
    ],
    objectifs: [
      { texte: 'Déclencher l\'arrêt automatique du réacteur', test: sim => sim.s.aar, bot: sim => { sim.action('aar'); } },
      { texte: 'Suivre la décroissance jusqu\'à 2,5 % de puissance résiduelle', test: sim => sim.s.out.q < 0.025,
        guide: [
          { cible: '#bas', titre: 'Les fissions sont arrêtées', avant: () => onglet('reac'),
            texte: sim => `<p>Toutes les grappes sont tombées : la réactivité est de <b>${f0(sim.s.out.rho.total)} pcm</b>. La puissance de fission s'effondre, puis décroît plus lentement au rythme des <b>neutrons retardés</b>.</p>
              <p>La turbine a déclenché. La vapeur part au condenseur par le contournement (GCT), qui maintient les générateurs de vapeur vers ${f0(p0(sim))} bar.</p>` },
          { cible: '#bas', titre: 'La puissance résiduelle', dynamique: true,
            texte: sim => `<p>Le réacteur produit encore <b>${(sim.s.out.q * 100).toFixed(1)} %</b> de sa puissance, soit <b>${f0(sim.s.out.q * sim.K.G.P_th / 1e6)} MW</b> de chaleur, sans aucune fission. Environ 6 % juste après l'arrêt, 1,5 % au bout d'un quart d'heure, encore 0,5 % après une journée.</p>
              <p>${vite}</p>`,
            afaire: 'Attendez que la puissance résiduelle passe sous 2,5 %.', attend: sim => sim.s.out.q < 0.025 },
        ] },
      { texte: 'Baisser la pression primaire à 145 bar avec la consigne du pressuriseur', test: sim => sim.s.P < 146, bot: sim => { sim.u.Pconsigne = 145; },
        guide: [
          { cible: '#syn-pzr', titre: 'Piloter la pression',
            texte: `<p>La pression du primaire est celle de la vapeur en haut du pressuriseur. La régulation agit sur deux leviers : les <b>chaufferettes</b> vaporisent de l'eau (la pression monte), l'<b>aspersion</b> pulvérise de l'eau froide qui condense la vapeur (la pression baisse).</p>
              <p>L'aspersion est alimentée par la pression des pompes primaires : sans pompe, plus d'aspersion.</p>` },
          { cible: '#sl-pzr', titre: 'Changez la consigne',
            texte: `<p>Baissez la consigne de pression de 155 à 145 bar et regardez l'aspersion se mettre en route sur le schéma.</p>`,
            afaire: 'Réglez la consigne de pression primaire sur 145 bar.', attend: sim => sim.u.Pconsigne <= 145.5, fais: sim => { sim.u.Pconsigne = 145; } },
        ] },
      { texte: 'Arrêter toutes les pompes primaires et tenir 3 minutes en circulation naturelle (marge à la saturation > 20 °C)', maintien: 180,
        test: sim => sim.u.pompes.every(p => !p) && sim.s.out.wr < 0.2 && sim.s.out.wr > 0.015 && sim.s.out.marge > 20,
        bot: sim => { sim.u.pompes.fill(false); },
        guide: [
          { cible: '#r-pompes', titre: 'Et si les pompes s\'arrêtaient ?',
            texte: `<p>Chaque pompe primaire consomme plusieurs mégawatts. Sans électricité, elles s'arrêtent, en ralentissant sur l'inertie de leur volant pendant une trentaine de secondes.</p>
              <p>Le cœur chauffe toujours. Qui fait circuler l'eau ? Arrêtez les pompes pour voir.</p>`,
            afaire: 'Arrêtez toutes les pompes primaires (boutons P1, P2...).', attend: sim => sim.u.pompes.every(p => !p), fais: sim => { sim.u.pompes.fill(false); } },
          { cible: '#cad-wr, #cad-mg', titre: 'Le thermosiphon', dynamique: true,
            texte: sim => `<p>L'eau chauffée dans le cœur est plus légère : elle monte vers les générateurs de vapeur, s'y refroidit, redescend. Comme les GV sont placés <b>plus haut</b> que le cœur, la circulation s'établit toute seule, sans aucune machine.</p>
              ${mesure('Débit primaire', (sim.s.out.wr * 100).toFixed(1) + ' %')}${mesure('Échauffement dans le cœur', f1(sim.s.Ts - sim.s.Tdesc) + ' °C')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}
              <p>Quelques pour cent de débit suffisent à évacuer la puissance résiduelle. C'est une sécurité passive essentielle du REP.</p>`,
            afaire: 'Laissez la circulation naturelle s\'établir (débit sous 10 %).', attend: sim => sim.s.out.wr < 0.1 },
        ] },
    ],
    echec: sim => sim.s.gainesRompues ? 'Les gaines du combustible ont été endommagées.' : null,
    bilan: 'Vous avez vu les deux piliers de la sûreté d\'un réacteur à l\'arrêt : la <b>puissance résiduelle</b> qu\'il faut évacuer coûte que coûte, et la <b>circulation naturelle</b> qui le permet même sans pompes, tant que les générateurs de vapeur sont alimentés en eau.',
    conseil: 'Laissez les protections faire leur travail et gardez de l\'eau dans les générateurs de vapeur.' },

  /* ------------------------------------------------------------------ 6 */
  { id: 'm6', cadrans: ['n', 'pe', 'tm', 'p', 'np', 'mg', 'wr'], num: 6, titre: 'Accident : rupture de tube de générateur de vapeur', duree: '15 min', etat: 'nominal',
    resume: 'Toute la salle de commande est à vous. Un tube de générateur de vapeur va se rompre : diagnostiquez, isolez, refroidissez, annulez la fuite.',
    nouveau: 'l\'injection de sécurité, les vannes vapeur, l\'alimentation des GV, le contournement turbine : toutes les commandes', debloque: ['turbine', 'barres', 'autoR', 'bore', 'temps', 'arret', 'groupe', 'pompes', 'pzr', 'is', 'secondaire'],
    preparer: sim => { sim.u.autoR = true; },
    intro: [
      { titre: 'Mission finale',
        texte: `<p>Vous connaissez maintenant le réacteur, le pressuriseur, la turbine et la chaleur résiduelle. Il est temps de gérer un <b>accident</b>.</p>
          <p>Celui-ci est l'un des plus étudiés : la rupture d'un tube de générateur de vapeur (<b>RTGV</b>). Il s'est réellement produit, par exemple à Ginna (États-Unis, 1982) et à Mihama (Japon, 1991), sans conséquence grave grâce aux bonnes actions des opérateurs.</p>` },
      { cible: '#g-primaire, #g-secondaire', titre: 'Toutes les commandes sont débloquées',
        texte: `<p>Nouveautés : l'<b>injection de sécurité</b>, les <b>vannes vapeur</b> et l'<b>alimentation</b> de chaque GV, l'alimentation de secours (<b>ASG</b>) et la consigne du <b>contournement turbine</b> (GCT).</p>
          <p>Pas besoin de tout retenir : vous serez guidé à chaque étape.</p>` },
      { titre: 'Tout est calme...',
        texte: `<p>La centrale est à 100 %. L'incident va se produire dans la minute qui suit.</p><p>Quand l'alarme sonnera, le temps se figera pour vous laisser comprendre ce qui se passe.</p>` },
    ],
    objectifs: [
      { texte: 'Surveiller l\'installation', test: sim => sim.s.t > 20,
        apres: sim => { sim.incident('rtgv'); if (root.App && root.App.syn) root.App.syn.montrerFuite = false; } },
      { texte: 'Arrêter le réacteur', alerte: true, test: sim => sim.s.aar, guide: null /* rempli plus bas : GUIDES.rtgv */ },
      { texte: 'Isoler le générateur de vapeur accidenté (vapeur et eau)', test: sim => !sim.u.viv[k(sim)] && !sim.u.alim[k(sim)] },
      { texte: 'Refroidir le primaire avec les GV sains (consigne GCT)', test: sim => sim.s.Ts < TRefroid(sim) + 0.5 },
      { texte: 'Annuler la fuite, injection de sécurité arrêtée (30 s)', maintien: 30, test: sim => sim.s.out.m_fuite < 2.5 && !sim.s.IS },
    ],
    echec: sim => sim.s.gainesRompues ? 'Les gaines du combustible ont été endommagées : le cœur n\'a plus été refroidi.' : null,
    bilan: sim => `Accident maîtrisé. ${f1(sim.s.bcl[k(sim)].Mfuite / 1000)} tonnes d'eau primaire sont passées dans le ${GV(sim)}${sim.s.rejets > 500 ? ` et ${f1(sim.s.rejets / 1000)} tonnes de vapeur ou d'eau contaminée ont été rejetées à l'atmosphère` : ', sans rejet notable à l\'atmosphère'}. À retenir, la logique en quatre temps : <b>diagnostiquer</b> le GV touché, l'<b>isoler</b>, <b>refroidir</b> avec les GV sains, puis <b>dépressuriser</b> le primaire pour annuler la fuite.`,
    conseil: 'Suivez le guidage étape par étape et utilisez la pause pour lire. Le bouton « le faire à ma place » montre l\'action attendue.' },
];

/* =====================================================================
   GUIDAGE DES INCIDENTS
   Schéma commun : 1) ce qui vient de se passer et pourquoi (temps figé)
   2) on laisse tourner pour voir les symptômes  3) actions une à une  4) bilan
   ===================================================================== */
const critIS = sim => sim.s.out.nivPzr > 20 && sim.s.out.marge > 20;
const etapeArretIS = {
  si: sim => sim.s.IS, cible: '#b-isStop', titre: 'Arrêter l\'injection de sécurité', dynamique: true,
  texte: sim => `<p>L'injection de sécurité a rempli son rôle. Si on la laisse, elle remplit le primaire à ras bord et fait remonter la pression. On l'arrête dès que <b>deux critères</b> sont réunis :</p>
    ${coche(sim.s.out.nivPzr > 20, 'niveau pressuriseur > 20 % : ' + f0(sim.s.out.nivPzr) + ' %')}${coche(sim.s.out.marge > 20, 'marge à la saturation > 20 °C : ' + f0(sim.s.out.marge) + ' °C')}
    <p>${critIS(sim) ? 'Les critères sont réunis : arrêtez l\'IS.' : 'Patientez, les critères ne sont pas encore réunis. ' + vite}</p>`,
  afaire: 'Quand les deux critères sont verts, cliquez sur « Arrêter » (injection de sécurité).',
  attend: sim => !sim.s.IS, fais: sim => { if (critIS(sim)) sim.action('arreterIS'); else if (root.App) root.App.toast('Les critères d\'arrêt de l\'IS ne sont pas encore réunis.'); },
};
const etapeAAR = (texte) => ({ si: sim => !sim.s.aar, cible: '#btn-aar', titre: 'Arrêter le réacteur', texte,
  afaire: 'Appuyez sur ARRÊT D\'URGENCE (AAR).', attend: sim => sim.s.aar, fais: sim => { sim.action('aar'); } });

const GUIDES = {
  /* ------------------------------------------------------------------ RTGV */
  rtgv: { etapes: [
    { cible: tousGV, titre: 'Un tube de générateur de vapeur vient de se rompre', avant: top('rtgv'),
      texte: sim => `<p>Chaque générateur de vapeur contient plus de ${sim.K.NB === 4 ? '5000' : '3000'} tubes d'à peine 1 mm d'épaisseur. Corrosion, usure par vibration ou choc d'un corps étranger : l'un d'eux vient de casser net.</p>
        <p>Le primaire est à <b>155 bar</b>, le secondaire à <b>${f0(sim.s.bcl[0].Ps)} bar</b>. L'eau primaire, radioactive, s'engouffre dans le circuit secondaire à environ ${f0(Math.abs(sim.s.out.m_fuite) || C.fuite_rtgv)} kg/s.</p>
        <p><b>Pourquoi c'est grave :</b> les tubes sont la frontière entre l'eau du cœur et la vapeur qui sort du bâtiment réacteur. La radioactivité a maintenant un chemin direct vers l'extérieur.</p>` },
    { cible: '#cad-np, #cad-p', titre: 'Les symptômes à reconnaître',
      texte: `<p>En salle de commande, personne ne vous dit « un tube a cassé ». Il faut le déduire :</p>
        <ul><li>le <b>niveau du pressuriseur</b> baisse : le primaire perd de l'eau</li><li>la <b>pression primaire</b> baisse</li><li>de l'<b>activité</b> est détectée dans la vapeur</li><li>le niveau d'<b>un seul</b> générateur de vapeur a tendance à monter</li></ul>
        <p>Le temps va repartir quelques instants pour que vous les voyiez apparaître.</p>` },
    { cible: '#cad-np, #cad-p', titre: 'Observez', dynamique: true,
      texte: sim => `${mesure('Niveau pressuriseur', f1(sim.s.out.nivPzr) + ' %')}${mesure('Pression primaire', f1(sim.s.P) + ' bar')}${mesure('Débit de fuite', f0(Math.abs(sim.s.out.m_fuite)) + ' kg/s')}${mesure('Appoint automatique (RCV)', f1(Math.max(0, sim.s.out.m_rcv)) + ' kg/s')}
        <p>Le système d'appoint essaie de compenser, mais il ne fournit que quelques kg/s : le niveau baisse inexorablement.</p>`,
      afaire: 'Regardez le niveau du pressuriseur et la pression baisser.', attend: sim => depuis(sim, 'rtgv') > 25 || sim.s.aar },
    { cible: sim => '#syn-gv' + k(sim), titre: sim => 'Diagnostic : c\'est le ' + GV(sim), avant: () => { if (root.App && root.App.syn) root.App.syn.montrerFuite = true; },
      texte: sim => `<p>En bas de l'écran, la tuile <b>Activité secondaire</b> est allumée, et le symbole ☢ apparaît sur le <b>${GV(sim)}</b> : c'est lui qui reçoit l'eau du primaire.</p>
        <p>La stratégie tient en quatre temps :</p><ul><li><b>arrêter</b> le réacteur</li><li><b>isoler</b> le ${GV(sim)} pour enfermer la radioactivité</li><li><b>refroidir</b> le primaire avec les autres GV</li><li><b>dépressuriser</b> le primaire jusqu'à la pression du ${GV(sim)} : sans écart de pression, plus de fuite</li></ul>` },
    etapeAAR(`<p>Si on attend, la protection arrêtera le réacteur toute seule vers 131 bar. On gagne à le faire <b>tout de suite</b> : moins de vapeur contaminée envoyée à la turbine, et plus de marge pour la suite.</p>`),
    { cible: '#synoptique', titre: 'Réacteur arrêté',
      texte: `<p>Les grappes sont tombées, la turbine a déclenché. Les générateurs de vapeur évacuent maintenant la puissance résiduelle en envoyant leur vapeur au condenseur (contournement GCT).</p>
        <p>Le primaire se refroidit et se contracte : pression et niveau du pressuriseur chutent encore plus vite. Sous 121 bar, l'<b>injection de sécurité</b> démarrera toute seule : c'est normal et souhaitable.</p>` },
    { cible: sim => '#b-viv' + k(sim), titre: sim => 'Isoler le ' + GV(sim) + ' côté vapeur',
      texte: sim => `<p>Tant que sa vanne vapeur est ouverte, le ${GV(sim)} envoie de la vapeur contaminée vers la salle des machines. On ferme sa <b>vanne d'isolement vapeur</b>.</p>`,
      afaire: sim => 'Fermez la vanne vapeur ' + GV(sim) + ' (elle passe au rouge).', attend: sim => !sim.u.viv[k(sim)], fais: sim => { sim.u.viv[k(sim)] = false; } },
    { cible: sim => '#b-alim' + k(sim), titre: sim => 'Couper l\'alimentation en eau du ' + GV(sim),
      texte: sim => `<p>Le ${GV(sim)} se remplit déjà par la fuite. Si on continue à l'alimenter, il finira <b>plein d'eau</b> : ses soupapes s'ouvriraient et cracheraient de l'eau contaminée directement dehors.</p>`,
      afaire: sim => 'Coupez l\'alimentation ' + GV(sim) + '.', attend: sim => !sim.u.alim[k(sim)], fais: sim => { sim.u.alim[k(sim)] = false; } },
    { cible: sim => '#syn-gv' + k(sim), titre: 'Le GV accidenté est une bouteille fermée',
      texte: sim => `<p>Le ${GV(sim)} est isolé. Sa pression va se stabiliser vers ${f0(p0(sim))} à ${pGcta(sim)} bar. Pour annuler la fuite, il faut amener le primaire à <b>la même pression</b>.</p>
        <p>Problème : à ${pGcta(sim)} bar, l'eau bout à ${Tsat(p0(sim) + C.gcta_marge)} °C, et le primaire est encore plus chaud que cela. Si on dépressurise maintenant, il se met à bouillir. Il faut donc d'abord le <b>refroidir</b> nettement en dessous, avec les GV sains.</p>` },
    { cible: '#sl-gct', titre: 'Refroidir avec les GV sains',
      texte: sim => `<p>Dans un générateur de vapeur, eau et vapeur sont à l'équilibre : <b>la température suit la pression</b>. En baissant la consigne du contournement (GCT) de ${f0(p0(sim))} à ${pRefroid(sim)} bar, les GV sains passent de ${Tsat(p0(sim))} °C à ${Tsat(pRefroid(sim))} °C et entraînent le primaire avec eux.</p>`,
      afaire: sim => 'Baissez la consigne GCT à ' + pRefroid(sim) + ' bar.', attend: sim => sim.u.gctConsigne <= pRefroid(sim) + 2, fais: sim => { sim.u.gctConsigne = pRefroid(sim); } },
    { cible: '#cad-tm, #cad-mg', titre: 'Le primaire refroidit', dynamique: true,
      texte: sim => `${mesure('Sortie du cœur', f1(sim.s.Ts) + ' °C (objectif < ' + TRefroid(sim) + ')')}${mesure('Pression vapeur GV sains', f1(sim.s.out.Ph || 0) + ' bar')}${mesure('Pression ' + GV(sim), f1(sim.s.bcl[k(sim)].Ps) + ' bar')}${mesure('Pression primaire', f1(sim.s.P) + ' bar')}${mesure('Injection de sécurité', sim.s.IS ? f0(sim.s.out.m_is) + ' kg/s' : 'à l\'arrêt')}
        <p>${vite}</p>`,
      afaire: sim => 'Attendez que la sortie du cœur passe sous ' + TRefroid(sim) + ' °C.', attend: sim => sim.s.Ts < TRefroid(sim) },
    { cible: '#sl-pzr', titre: 'Dépressuriser le primaire',
      texte: sim => `<p>Le primaire est assez froid pour supporter une pression plus basse sans bouillir. Objectif : le tenir à la pression du ${GV(sim)}, soit <b>${f0(sim.s.bcl[k(sim)].Ps)} bar</b>. Sans écart de pression, plus de fuite.</p>
        ${sim.s.P < sim.s.bcl[k(sim)].Ps + 3
          ? `<p>En se refroidissant, l'eau du primaire s'est tellement contractée que la pression est déjà tombée à <b>${f0(sim.s.P)} bar</b>. Réglez quand même la <b>consigne de pression primaire</b> : quand l'injection de sécurité aura regonflé le circuit, la régulation le tiendra à cette valeur, ni plus haut (la fuite reprendrait), ni plus bas (risque d'ébullition).</p>`
          : `<p>Baissez la <b>consigne de pression primaire</b> : l'aspersion du pressuriseur condensera la vapeur et fera chuter la pression.</p>`}`,
      afaire: sim => 'Réglez la consigne de pression primaire sur ' + f0(sim.s.bcl[k(sim)].Ps) + ' bar.',
      attend: sim => sim.u.pzrAuto && sim.u.Pconsigne <= sim.s.bcl[k(sim)].Ps + 2.5,
      fais: sim => { sim.u.pzrAuto = true; sim.u.Pconsigne = Math.round(sim.s.bcl[k(sim)].Ps); } },
    { cible: '#cad-p, #cad-np', titre: 'Pression primaire et pression du GV', dynamique: true,
      texte: sim => `${mesure('Pression primaire', f1(sim.s.P) + ' bar')}${mesure('Pression ' + GV(sim) + ' (cible)', f1(sim.s.bcl[k(sim)].Ps) + ' bar')}${mesure('Débit de fuite', f1(Math.max(0, sim.s.out.m_fuite)) + ' kg/s')}${mesure('Niveau pressuriseur', f0(sim.s.out.nivPzr) + ' %')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}
        <p>${sim.s.IS ? 'L\'injection de sécurité débite d\'autant plus que la pression baisse : le pressuriseur se remplit.' : ''} ${vite}</p>`,
      afaire: 'Attendez que la pression primaire soit au niveau de celle du GV accidenté.',
      attend: sim => sim.s.P < sim.s.bcl[k(sim)].Ps + 5 || sim.s.out.nivPzr > 70 },
    etapeArretIS,
    { cible: '#sl-pzr', titre: 'Annuler la fuite', dynamique: true,
      texte: sim => `<p>Ajustez si besoin la consigne de pression primaire pour rester au niveau du ${GV(sim)}.</p>
        ${mesure('Pression primaire', f1(sim.s.P) + ' bar')}${mesure('Pression ' + GV(sim) + ' (cible)', f1(sim.s.bcl[k(sim)].Ps) + ' bar')}${mesure('Débit de fuite', sim.s.out.m_fuite < -0.5 ? 'inversé (' + f1(-sim.s.out.m_fuite) + ' kg/s du GV vers le primaire)' : f1(Math.max(0, sim.s.out.m_fuite)) + ' kg/s')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}
        ${sim.s.IS ? '<p><em>L\'injection de sécurité est repartie : elle empêche la pression de baisser. Arrêtez-la dès que niveau pressuriseur et marge dépassent 20.</em></p>' : ''}`,
      afaire: 'Attendez que la fuite s\'annule.',
      attend: sim => sim.s.out.m_fuite < 2.5 && !sim.s.IS,
      fais: sim => { if (sim.s.IS && critIS(sim)) sim.action('arreterIS'); sim.u.pzrAuto = true; sim.u.Pconsigne = Math.round(sim.s.bcl[k(sim)].Ps); } },
    { cible: '#synoptique', titre: 'Fuite annulée',
      texte: sim => `<p>${sim.s.out.m_fuite < -1 ? `Le primaire est même passé un peu sous la pression du ${GV(sim)} : le débit s'est inversé, un peu d'eau du GV revient vers le primaire. Plus aucune radioactivité ne sort du circuit primaire.` : `Primaire et ${GV(sim)} sont à la même pression : plus rien ne passe.`} L'accident est maîtrisé.</p>
        ${mesure('Eau primaire passée dans le ' + GV(sim), f1(sim.s.bcl[k(sim)].Mfuite / 1000) + ' t')}${mesure('Rejets à l\'atmosphère', sim.s.rejets > 100 ? f1(sim.s.rejets / 1000) + ' t' : 'aucun')}${mesure('Durée depuis la rupture', f0(depuis(sim, 'rtgv') / 60) + ' min')}
        <p>La pression du GV isolé va continuer d'évoluer lentement : gardez la consigne de pression primaire à sa hauteur. Dans la réalité, l'équipe poursuivrait ainsi le refroidissement jusqu'à l'arrêt à froid. À retenir : <b>diagnostiquer, isoler, refroidir, dépressuriser</b>.</p>
        <p>Refaites l'exercice sans guidage (décochez la case dans le menu ⚡), ou sans rien faire, pour voir ce que les automatismes gèrent seuls.</p>` },
  ] },

  /* ------------------------------------------------------------------ RTV */
  rtv: { etapes: [
    { cible: sim => '#syn-gv' + k(sim), titre: 'Une tuyauterie vapeur vient de se rompre', avant: top('rtv'),
      texte: sim => `<p>La ligne vapeur du <b>${GV(sim)}</b> s'est rompue entre le générateur et sa vanne d'isolement. La vapeur à ${f0(sim.s.bcl[0].Ps)} bar s'échappe à gros débit.</p>
        <p><b>Ce qui va se passer :</b> le ${GV(sim)} se dépressurise, son eau bout violemment et se refroidit. Il aspire alors énormément de chaleur au primaire, qui <b>se refroidit brutalement</b>.</p>
        <p><b>Le piège :</b> une eau primaire plus froide ralentit mieux les neutrons. Le refroidissement apporte de la réactivité : la puissance <b>monte</b>, alors que rien ne le demande.</p>` },
    { cible: '#cad-n, #cad-tm', titre: 'Observez', dynamique: true,
      texte: sim => `${mesure('Pression vapeur ' + GV(sim), f1(sim.s.bcl[k(sim)].Ps) + ' bar')}${mesure('Température moyenne primaire', f1(sim.s.out.Tmoy) + ' °C')}${mesure('Puissance réacteur', f1(sim.s.n * 100) + ' %')}${mesure('Réactivité du modérateur', f0(sim.s.out.rho.moderateur) + ' pcm')}
        <p>Les protections surveillent la chute de pression vapeur : elles vont fermer toutes les vannes vapeur, arrêter le réacteur et lancer l'injection de sécurité (eau très borée, pour étouffer le regain de réactivité).</p>`,
      afaire: 'Laissez les protections agir.', attend: sim => sim.s.aar || depuis(sim, 'rtv') > 60 },
    etapeAAR(`<p>Les automatismes n'ont pas encore arrêté le réacteur. N'attendez pas : la puissance monte à cause du refroidissement.</p>`),
    { cible: sim => '#b-alim' + k(sim), titre: sim => 'Ne plus alimenter le ' + GV(sim),
      texte: sim => `<p>Les vannes vapeur sont fermées : les GV sains sont protégés. Mais la brèche est en amont de la vanne du ${GV(sim)}, qui continue de se vider.</p>
        <p>Tant qu'on lui envoie de l'eau, il la transforme en vapeur et <b>continue de refroidir le primaire</b>. On le laisse donc s'assécher.</p>`,
      afaire: sim => 'Coupez l\'alimentation en eau du ' + GV(sim) + '.', attend: sim => !sim.u.alim[k(sim)], fais: sim => { sim.u.alim[k(sim)] = false; } },
    { cible: sim => '#syn-gv' + k(sim), titre: sim => 'Le ' + GV(sim) + ' se vide', dynamique: true,
      texte: sim => `<p>Le ${GV(sim)} crache toute son eau par la brèche, en moins d'une minute. Chaque kilo vaporisé emporte de la chaleur prise au primaire.</p>
        ${mesure('Niveau ' + GV(sim), f0(sim.s.bcl[k(sim)].niv) + ' %')}${mesure('Pression ' + GV(sim), f1(sim.s.bcl[k(sim)].Ps) + ' bar')}${mesure('Température moyenne primaire', f1(sim.s.out.Tmoy) + ' °C')}${mesure('Pression primaire', f1(sim.s.P) + ' bar')}${mesure('Niveau pressuriseur', f0(sim.s.out.nivPzr) + ' %')}`,
      afaire: sim => 'Attendez que le ' + GV(sim) + ' soit vide.', attend: sim => sim.s.bcl[k(sim)].niv < 2 || depuis(sim, 'rtv') > 200 },
    { cible: '#cad-tm, #cad-p, #cad-np', titre: 'Un primaire refroidi et contracté',
      texte: sim => `<p>Le ${GV(sim)} est à sec : il ne refroidit plus rien. Mais le primaire a perdu <b>${f0(sim.K.Tmoy0 - sim.s.out.Tmoy)} °C</b> en quelques dizaines de secondes. L'eau s'est contractée au point de <b>vider le pressuriseur</b>, et la pression s'est effondrée.</p>
        <p>L'injection de sécurité fait deux choses : elle <b>regonfle</b> le primaire et elle apporte du <b>bore</b> (${f0(sim.s.bore)} ppm maintenant) qui compense la réactivité rendue par le refroidissement.</p>
        <p>On la laisse travailler jusqu'à retrouver un niveau dans le pressuriseur et de la marge à l'ébullition.</p>` },
    { cible: '#cad-np, #cad-mg', titre: 'Le primaire se regonfle', dynamique: true,
      texte: sim => `${coche(sim.s.out.nivPzr > 20, 'niveau pressuriseur > 20 % : ' + f0(sim.s.out.nivPzr) + ' %')}${coche(sim.s.out.marge > 20, 'marge à la saturation > 20 °C : ' + f0(sim.s.out.marge) + ' °C')}
        ${mesure('Injection de sécurité', f0(sim.s.out.m_is) + ' kg/s')}${mesure('Pression primaire', f1(sim.s.P) + ' bar')}
        <p>Cela prend une dizaine de minutes. Passez en <b>×10</b>.</p>`,
      afaire: 'Attendez que les deux critères soient réunis.', attend: sim => !sim.s.IS || critIS(sim) },
    etapeArretIS,
    { cible: '#synoptique', titre: 'Situation stabilisée',
      texte: sim => `<p>Le ${GV(sim)} est vide et isolé, le réacteur est arrêté et très boré. Les GV sains, vannes vapeur fermées, évacueront la puissance résiduelle par leurs décharges à l'atmosphère (vapeur propre) quand le primaire se sera réchauffé, d'ici une demi-heure. Pendant ce réchauffage, gardez un œil sur la marge à la saturation.</p>
        <p>À retenir : une brèche vapeur est un accident de <b>refroidissement</b>. Le danger vient du retour de réactivité, et la parade est d'isoler la vapeur, d'injecter du bore et de ne plus alimenter le GV percé.</p>` },
  ] },

  /* ------------------------------------------------------------------ soupape bloquée */
  soupape: { etapes: [
    { cible: '#syn-pzr', titre: 'Une soupape du pressuriseur est bloquée ouverte', avant: top('soup'),
      texte: `<p>Une soupape de protection du pressuriseur s'est ouverte et <b>ne se referme pas</b>. La vapeur du pressuriseur s'échappe : c'est une <b>brèche du circuit primaire</b>, tout en haut.</p>
        <p>C'est exactement le point de départ de l'accident de <b>Three Mile Island</b> (États-Unis, 1979), où le cœur a fondu à moitié. Le matériel a fait ce qu'il fallait ; ce sont de mauvaises interprétations en salle de commande qui ont aggravé la situation.</p>` },
    { cible: '#cad-p, #cad-np, #cad-mg', titre: 'Observez la pression... et le niveau', dynamique: true,
      texte: sim => `${mesure('Pression primaire', f1(sim.s.P) + ' bar')}${mesure('Niveau pressuriseur', f0(sim.s.out.nivPzr) + ' %')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}${mesure('Débit perdu par la soupape', f0(sim.s.out.msoup || 0) + ' kg/s')}
        <p>La pression chute : à 131 bar le réacteur s'arrête, à 121 bar l'injection de sécurité démarre. Mais la soupape reste ouverte et la pression continue de baisser, jusqu'à rejoindre la pression d'ébullition de l'eau du cœur.</p>
        <p>Cela prend environ deux minutes : vous pouvez passer en <b>×5</b>.</p>`,
      afaire: 'Laissez faire jusqu\'à ce que la marge à la saturation tombe à zéro.', attend: sim => (sim.s.IS && sim.s.out.marge < 1.5 && depuis(sim, 'soup') > 80) || depuis(sim, 'soup') > 300 },
    { cible: '#cad-np', titre: 'Le piège de Three Mile Island',
      texte: sim => `<p>Regardez le niveau du pressuriseur : <b>${f0(sim.s.out.nivPzr)} %</b>, et il va se mettre à <b>monter</b> jusqu'à 100 %. Pourtant le circuit se vide, et la marge à la saturation est de <b>${f0(Math.max(0, sim.s.out.marge))} °C</b> : l'eau commence à bouillir dans le cœur.</p>
        <p>Explication : la brèche est au sommet du pressuriseur. La vapeur qui se forme dans la cuve chasse l'eau du primaire vers le pressuriseur. Son niveau ne dit plus rien de la quantité d'eau autour du cœur.</p>
        <p>En 1979, les opérateurs ont cru le circuit trop plein et ont <b>arrêté l'injection de sécurité</b>. La bonne boussole, c'est la <b>marge à la saturation</b>.</p>` },
    { cible: '#b-soupIsol', titre: 'Isoler la soupape',
      texte: `<p>La soupape ne répond plus, mais une <b>vanne d'isolement</b> est installée juste en amont, précisément pour ce cas. À Three Mile Island, elle n'a été fermée qu'au bout de 2 h 20.</p>`,
      afaire: 'Cliquez sur « Isoler » (ligne Soupape).', attend: sim => sim.u.soupapeIsol, fais: sim => { sim.u.soupapeIsol = true; } },
    { cible: '#cad-p, #cad-mg', titre: 'La brèche est fermée', dynamique: true,
      texte: sim => `<p>Le primaire ne perd plus rien. L'injection de sécurité le regonfle : la pression et la marge à la saturation remontent.</p>
        ${mesure('Pression primaire', f1(sim.s.P) + ' bar')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}${mesure('Niveau pressuriseur', f0(sim.s.out.nivPzr) + ' %')}
        <p>Cela prend quelques minutes : passez en <b>×10</b>.</p>`,
      afaire: 'Attendez que la marge à la saturation dépasse 20 °C.', attend: sim => !sim.s.IS || critIS(sim) },
    etapeArretIS,
    { cible: '#synoptique', titre: 'Brèche isolée',
      texte: `<p>La soupape est isolée, la vapeur formée dans la cuve s'est recondensée et le primaire est de nouveau sous-refroidi. Le système de contrôle volumétrique va lentement ramener le niveau du pressuriseur, et les chaufferettes la pression.</p>
        <p>À retenir : un seul indicateur peut mentir. On ne coupe jamais l'injection de sécurité sur la seule foi du niveau du pressuriseur : il faut <b>aussi</b> de la marge à la saturation.</p>
        <p>Pour voir ce qui s'est passé en 1979, relancez l'incident sans guidage, arrêtez l'injection de sécurité et n'isolez pas la soupape.</p>` },
  ] },

  /* ------------------------------------------------------------------ perte du réseau */
  perte_reseau: { etapes: [
    { cible: '#syn-reseau, #syn-alt', titre: 'Le réseau électrique a disparu', avant: top('res'),
      texte: `<p>Tempête, défaut sur les lignes : la centrale est coupée du réseau, et la tentative de continuer à s'alimenter elle-même (îlotage) a échoué.</p>
        <p><b>Conséquences immédiates :</b> plus de pompes primaires, plus de pompes alimentaires, plus de condenseur. Le réacteur s'arrête automatiquement.</p>
        <p>Les <b>groupes électrogènes diesel</b> démarrent en quelques secondes et alimentent les systèmes de secours. C'est la situation qui a précédé l'accident de Fukushima, où les diesels ont ensuite été noyés par le tsunami.</p>` },
    { cible: '#cad-wr, #cad-n', titre: 'Observez l\'arrêt et le ralentissement des pompes', dynamique: true,
      texte: sim => `${mesure('Débit primaire', f0(sim.s.out.wr * 100) + ' %')}${mesure('Puissance thermique', f1(sim.s.out.q * 100) + ' %')}${mesure('Échauffement dans le cœur', f1(sim.s.Ts - sim.s.Tdesc) + ' °C')}
        <p>Les pompes ralentissent sur leur inertie, puis la <b>circulation naturelle</b> prend le relais.</p>`,
      afaire: 'Laissez le débit primaire tomber sous 15 %.', attend: sim => (sim.s.aar && sim.s.out.wr < 0.15) || depuis(sim, 'res') > 120 },
    { cible: '#r-asg', titre: 'Vérifier l\'alimentation de secours des GV',
      texte: sim => `<p>Les générateurs de vapeur sont le seul moyen d'évacuer la puissance résiduelle, et ils ne reçoivent plus leur eau normale. L'<b>ASG</b> (alimentation de secours) puise dans une bâche dédiée, avec des pompes alimentées par les diesels.</p>
        <p>${sim.s.out.W_asg > 0 ? 'Elle a bien démarré toute seule.' : 'Elle démarrera toute seule dès qu\'un niveau GV sera bas.'} Par précaution, forcez-la en marche.</p>`,
      afaire: 'Cliquez sur « Marche » (ligne Secours ASG).', attend: sim => sim.u.asg === 'marche', fais: sim => { sim.u.asg = 'marche'; } },
    { cible: tousGV, titre: 'Où part la chaleur ?',
      texte: sim => `<p>Sans condenseur, la vapeur des GV n'a plus qu'une sortie : les vannes de <b>décharge à l'atmosphère</b> (GCT-a), qui s'ouvrent vers ${pGcta(sim)} bar. Vous voyez les panaches au-dessus des GV. Cette vapeur vient du secondaire : elle n'est pas radioactive.</p>
        <p>Sans pompes primaires, il n'y a plus d'aspersion au pressuriseur : la pression ne se règle plus que par les chaufferettes, secourues par les diesels.</p>` },
    { cible: '#cad-wr, #cad-mg', titre: 'Circulation naturelle établie', dynamique: true,
      texte: sim => `<p>L'eau chauffée par le cœur monte vers les GV, s'y refroidit et redescend, sans aucune pompe.</p>
        ${mesure('Débit primaire (thermosiphon)', f1(sim.s.out.wr * 100) + ' %')}${mesure('Échauffement dans le cœur', f1(sim.s.Ts - sim.s.Tdesc) + ' °C')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}${mesure('Pression vapeur', f1(sim.s.bcl[0].Ps) + ' bar')}${mesure('Niveau GV le plus bas', f0(nivMin(sim)) + ' %')}
        <p>${vite}</p>`,
      afaire: 'Laissez la circulation naturelle s\'installer (débit sous 8 %).', attend: sim => sim.s.out.wr < 0.08 || depuis(sim, 'res') > 600 },
    { cible: '#synoptique', titre: 'État sûr atteint',
      texte: `<p>Réacteur arrêté, cœur refroidi par circulation naturelle, GV alimentés par l'ASG, chaleur évacuée à l'atmosphère. La centrale peut tenir ainsi des heures, tant que la bâche ASG contient de l'eau et que les diesels ont du carburant.</p>
        <p>À retenir : même sans aucune alimentation extérieure, trois choses suffisent : des <b>grappes qui tombent</b> par gravité, de l'<b>eau dans les GV</b> et la <b>circulation naturelle</b>.</p>` },
  ] },

  /* ------------------------------------------------------------------ îlotage */
  ilotage: { etapes: [
    { cible: '#syn-reseau, #syn-alt', titre: 'Îlotage : la centrale s\'est séparée du réseau', avant: top('ilo'),
      texte: `<p>Un défaut sur le réseau a ouvert le disjoncteur de ligne. La turbine n'a plus de client... sauf la centrale elle-même, qui consomme environ <b>5 %</b> de sa puissance (pompes, auxiliaires).</p>
        <p>La turbine passe donc brutalement de sa charge à 5 %. Le réacteur, lui, produit toujours autant de chaleur. Où va-t-elle ?</p>` },
    { cible: '#syn-cond, #syn-turbine', titre: 'Le contournement au condenseur', dynamique: true,
      texte: sim => `<p>Le <b>GCT</b> s'ouvre en grand et envoie la vapeur en excès directement au condenseur, en court-circuitant la turbine. Le réacteur ne « voit » presque rien, le temps de baisser sa puissance.</p>
        ${mesure('Puissance réacteur', f0(sim.s.n * 100) + ' %')}${mesure('Charge turbine', f0(sim.s.charge * 100) + ' %')}${mesure('Vapeur au contournement', f0((sim.s.out.W_gct || 0) / sim.K.W_vap * 100) + ' % du débit nominal')}${mesure('Température moyenne', f1(sim.s.out.Tmoy) + ' °C (réf. ' + f1(sim.s.out.Tref) + ')')}`,
      afaire: 'Observez le contournement s\'ouvrir.', attend: sim => depuis(sim, 'ilo') > 15 },
    { si: sim => !sim.u.autoR && !sim.s.aar, cible: '#c-autoR', titre: 'Baisser la puissance du réacteur',
      texte: `<p>Le contournement ne peut pas avaler toute la vapeur indéfiniment. Il faut ramener le réacteur vers 20 à 30 %. Le plus simple : laisser le pilotage automatique insérer les grappes.</p>`,
      afaire: 'Cochez « Pilotage automatique des grappes ».', attend: sim => sim.u.autoR || sim.s.aar, fais: sim => { sim.u.autoR = true; } },
    { si: sim => !sim.s.aar, cible: '#cad-n, #sl-R', titre: 'Le réacteur redescend', dynamique: true,
      texte: sim => `<p>L'îlotage a enclenché le <b>pilotage automatique</b> : les grappes s'insèrent pour ramener le réacteur vers 30 %, et le contournement se referme peu à peu. Le réacteur ne descend pas plus bas : il reste ainsi prêt à reprendre de la charge.</p>${mesure('Puissance réacteur', f0(sim.s.n * 100) + ' %')}${mesure('Grappes R', f0(pasR(sim)) + ' pas')}<p>${vite}</p>`,
      afaire: 'Attendez que la puissance passe sous 35 %.', attend: sim => sim.s.n < 0.35 || sim.s.aar },
    { si: sim => !sim.s.aar, cible: '#syn-reseau', titre: 'Attendre le retour du réseau', dynamique: true,
      texte: sim => `<p>La centrale est <b>îlotée</b> : elle tourne pour elle-même, prête à repartir. C'est tout l'intérêt de la manœuvre : éviter un arrêt complet, qui coûterait des heures (et un pic de xénon).</p>
        <p>Le réseau devrait revenir dans environ <b>${f0(Math.max(0, (sim.s.tRetourReseau || sim.s.t) - sim.s.t) / 60)} min</b>. Accélérez le temps (<b>×10</b> ou plus).</p>`,
      afaire: 'Attendez le retour du réseau.', attend: sim => sim.s.reseau || sim.s.aar },
    { si: sim => !sim.s.aar, cible: '#b-coupler', titre: 'Recoupler',
      texte: `<p>Le réseau est de retour. La turbine tourne toujours à 1500 tr/min : il suffit de refermer le disjoncteur.</p>`,
      afaire: 'Cliquez sur « Recoupler ».', attend: sim => sim.s.turbine === 'couplee' || sim.s.aar, fais: sim => { sim.action('coupler'); } },
    { si: sim => !sim.s.aar, cible: '#sl-turb', titre: 'Reprendre de la charge',
      texte: `<p>Remontez la charge de la turbine : le réacteur suivra.</p>`,
      afaire: 'Montez la charge turbine à 50 % ou plus.', attend: sim => sim.u.turb >= 0.5 || sim.s.aar, fais: sim => { sim.u.turb = 0.5; } },
    { cible: '#synoptique', titre: sim => sim.s.aar ? 'Îlotage manqué' : 'Îlotage réussi',
      texte: sim => sim.s.aar
        ? `<p>Le réacteur s'est arrêté (${sim.s.aarCause}). L'îlotage est une manœuvre délicate : même sur les vraies centrales, il ne réussit pas à tous les coups.</p><p>Réessayez avec le pilotage automatique des grappes activé avant de déclencher l'incident.</p>`
        : `<p>La centrale a encaissé une perte de charge quasi totale sans s'arrêter, puis s'est recouplée dès le retour du réseau.</p><p>À retenir : le <b>contournement au condenseur</b> donne au réacteur le temps de s'adapter quand la turbine décroche.</p>` },
  ] },

  /* ------------------------------------------------------------------ perte des pompes */
  perte_pompes: { etapes: [
    { cible: sim => sim.s.bcl.map((b, i) => '#syn-pompe' + i).join(', '), titre: 'Les pompes primaires s\'arrêtent', avant: top('pp'),
      texte: `<p>Un défaut électrique vient de couper l'alimentation des pompes primaires. Chacune brasse plus de 4 tonnes d'eau par seconde : sans elles, le débit dans le cœur s'effondre alors que le réacteur est en puissance.</p>
        <p><b>Le risque :</b> si le débit baisse plus vite que la puissance, l'eau au contact des crayons peut se mettre à bouillir en film (<b>crise d'ébullition</b>) : la gaine n'est plus refroidie.</p>
        <p>Deux parades : un <b>volant d'inertie</b> sur chaque pompe, qui prolonge le débit quelques dizaines de secondes, et l'arrêt automatique dès que le débit passe sous 88 %.</p>` },
    { cible: '#cad-wr, #cad-n', titre: 'Observez le ralentissement', dynamique: true,
      texte: sim => `${mesure('Débit primaire', f0(sim.s.out.wr * 100) + ' %')}${mesure('Puissance thermique', f1(sim.s.out.q * 100) + ' %')}${mesure('Marge à la crise d\'ébullition (REC)', sim.s.out.REC > 9 ? '> 9' : sim.s.out.REC.toFixed(2))}${mesure('Échauffement dans le cœur', f1(sim.s.Ts - sim.s.Tdesc) + ' °C')}`,
      afaire: 'Laissez le débit tomber sous 10 %.', attend: sim => sim.s.out.wr < 0.1 || depuis(sim, 'pp') > 150 },
    { cible: '#syn-cuve, ' + '#syn-gv0', titre: 'La circulation naturelle',
      texte: sim => `<p>Les pompes sont à l'arrêt et pourtant l'eau circule encore : <b>${f1(sim.s.out.wr * 100)} %</b> du débit nominal. L'eau chaude du cœur, plus légère, monte vers les générateurs de vapeur situés plus haut ; refroidie, elle redescend.</p>
        <p>Ce <b>thermosiphon</b> suffit à évacuer la puissance résiduelle, à condition que les GV restent alimentés en eau et qu'il reste de la marge à l'ébullition.</p>` },
    { cible: '#sl-gct', titre: 'Se donner de la marge',
      texte: sim => `<p>En circulation naturelle, l'eau sort du cœur plus chaude. Pour s'éloigner de l'ébullition, refroidissez un peu le primaire : baissez la consigne du contournement de ${f0(p0(sim))} à <b>${f0(p0(sim) - 8)} bar</b>.</p>
        <p>Pas plus : un refroidissement trop fort contracterait l'eau du primaire, viderait le pressuriseur et ferait démarrer l'injection de sécurité.</p>`,
      afaire: sim => 'Baissez la consigne GCT à ' + f0(p0(sim) - 8) + ' bar.', attend: sim => sim.u.gctConsigne <= p0(sim) - 7, fais: sim => { sim.u.gctConsigne = Math.round(p0(sim) - 8); } },
    { cible: '#cad-mg, #cad-tm', titre: 'Refroidissement en cours', dynamique: true,
      texte: sim => `${mesure('Température moyenne', f1(sim.s.out.Tmoy) + ' °C')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}${mesure('Débit primaire', f1(sim.s.out.wr * 100) + ' %')}<p>${vite}</p>`,
      afaire: sim => 'Attendez que la température moyenne passe sous ' + f0(sim.K.G.T_e - 2) + ' °C.', attend: sim => sim.s.out.Tmoy < sim.K.G.T_e - 2 },
    { cible: '#synoptique', titre: 'Situation stabilisée',
      texte: `<p>Le réacteur est arrêté et refroidi sans aucune pompe primaire. Notez que la pression n'est plus réglable à la baisse : l'aspersion du pressuriseur a besoin des pompes.</p>
        <p>À retenir : l'<b>inertie</b> des pompes couvre les premières secondes, l'<b>arrêt automatique</b> réduit la puissance, la <b>circulation naturelle</b> fait le reste.</p>` },
  ] },

  /* ------------------------------------------------------------------ perte d'eau alimentaire */
  perte_are: { etapes: [
    { cible: '#syn-pompe-are, ' + '#syn-gv0', titre: 'Les générateurs de vapeur ne sont plus alimentés', avant: top('are'),
      texte: sim => `<p>Les pompes alimentaires viennent de s'arrêter. À pleine puissance, chaque GV vaporise près de ${f0(sim.K.m_vap0)} kg d'eau par seconde : sans appoint, son niveau s'effondre en une minute.</p>
        <p>Deuxième panne, cachée : l'alimentation de secours (<b>ASG</b>) aurait dû démarrer toute seule. Son automatisme est <b>en défaut</b>.</p>
        <p><b>Le risque :</b> des GV vides ne refroidissent plus le primaire. C'est la perte de la <b>source froide</b>.</p>` },
    { cible: '[data-asg="marche"]', titre: 'Démarrer l\'ASG à la main',
      texte: `<p>Pas de temps à perdre : chaque seconde, les GV perdent de l'eau. L'ASG se commande aussi à la main.</p>`,
      afaire: 'Cliquez sur « Marche » (ligne Secours ASG).', attend: sim => sim.u.asg === 'marche', fais: sim => { sim.u.asg = 'marche'; } },
    { cible: tousGV, titre: 'Observez les niveaux', dynamique: true,
      texte: sim => `<p>Le très bas niveau dans les GV arrête automatiquement le réacteur. La puissance tombe alors à quelques pour cent, que le débit de l'ASG suffit à évacuer.</p>
        ${mesure('Niveau GV le plus bas', f0(nivMin(sim)) + ' %')}${mesure('Débit ASG total', f0(sim.s.out.W_asg || 0) + ' kg/s')}${mesure('Puissance thermique', f1(sim.s.out.q * 100) + ' %')}${mesure('Pression primaire', f1(sim.s.P) + ' bar')}`,
      afaire: 'Attendez l\'arrêt automatique du réacteur.', attend: sim => sim.s.aar || depuis(sim, 'are') > 150 },
    etapeAAR(`<p>Le réacteur est toujours en puissance alors que les GV ne sont plus alimentés normalement. Arrêtez-le.</p>`),
    { cible: tousGV, titre: 'Les GV se remplissent de nouveau', dynamique: true,
      texte: sim => `<p>L'ASG injecte ${f0(C.asg_debit)} kg/s par GV, plus que ce que la puissance résiduelle vaporise : les niveaux remontent, lentement.</p>
        ${mesure('Niveau GV le plus bas', f0(nivMin(sim)) + ' %')}${mesure('Température moyenne', f1(sim.s.out.Tmoy) + ' °C')}${mesure('Marge à la saturation', f0(sim.s.out.marge) + ' °C')}<p>${vite}</p>`,
      afaire: 'Attendez que tous les niveaux GV repassent au-dessus de 35 %.', attend: sim => nivMin(sim) > 35 },
    { cible: '#synoptique', titre: 'Source froide rétablie',
      texte: `<p>Les générateurs de vapeur ont retrouvé de l'eau, le réacteur est arrêté et refroidi.</p>
        <p>À retenir : les GV sont la <b>source froide</b> du réacteur. Si l'ASG n'avait pas pu démarrer du tout, il serait resté un dernier recours, le « gavé-ouvert » : injection de sécurité en marche et soupapes du pressuriseur ouvertes, pour refroidir le cœur directement.</p>
        <p>Pour voir pourquoi, relancez l'incident sans guidage et sans démarrer l'ASG.</p>` },
  ] },

  /* ------------------------------------------------------------------ dilution */
  dilution: { etapes: [
    { cible: '#sl-bore', titre: 'Dilution incontrôlée', avant: sim => { top('dil')(sim); onglet('reac'); },
      texte: sim => `<p>Une vanne d'eau claire est restée ouverte sur le circuit d'appoint : de l'eau <b>sans bore</b> entre dans le primaire. La concentration, qui était de ${f0(sim.s.boreCmd0 != null ? sim.s.boreCmd0 : sim.s.bore)} ppm, baisse de 20 ppm par minute.</p>
        <p>Moins de bore, c'est moins de neutrons absorbés : la <b>réactivité augmente</b> lentement mais sans s'arrêter, environ 200 pcm par minute.</p>
        <p>C'est un incident sournois : rien ne casse, aucune alarme immédiate.</p>` },
    { cible: '#bas', titre: 'Observez le bilan de réactivité', dynamique: true,
      texte: sim => `${mesure('Bore réel', f0(sim.s.bore) + ' ppm')}${mesure('Effet du bore', f0(sim.s.out.rho.bore) + ' pcm')}${mesure('Grappes R', f0(pasR(sim)) + ' pas')}${mesure('Puissance réacteur', f1(sim.s.n * 100) + ' %')}${mesure('Température moyenne', f1(sim.s.out.Tmoy) + ' °C (réf. ' + f1(sim.s.out.Tref) + ')')}
        <p>${sim.u.autoR ? 'Le pilotage automatique insère les grappes pour compenser : c\'est l\'indice à repérer. Des grappes qui s\'enfoncent sans raison, c\'est une dilution.' : 'Sans pilotage automatique, la température et la puissance montent. À 109 %, le réacteur s\'arrêtera.'}</p>`,
      afaire: 'Regardez la barre « Bore » et les grappes évoluer.', attend: sim => depuis(sim, 'dil') > 40 || sim.s.aar },
    { cible: '#sl-bore', titre: 'Boriquer',
      texte: `<p>La parade : isoler la source d'eau claire et <b>boriquer</b>. Ici, relever la consigne de bore au-dessus de sa valeur de départ lance la borication et isole la dilution.</p>`,
      afaire: 'Montez la consigne de bore d\'au moins 5 ppm.', attend: sim => !sim.s.dilutionHS, fais: sim => { sim.u.bore = (sim.s.boreCmd0 || sim.u.bore) + 5; } },
    { cible: '#sl-bore, #sl-R', titre: 'Retour à la normale', dynamique: true,
      texte: sim => `<p>Le bore remonte à 10 ppm par minute vers votre consigne.</p>${mesure('Bore réel', f0(sim.s.bore) + ' ppm')}${mesure('Consigne', f0(sim.u.bore) + ' ppm')}${mesure('Grappes R', f0(pasR(sim)) + ' pas')}<p>${vite}</p>`,
      afaire: 'Attendez que le bore réel rejoigne la consigne.', attend: sim => Math.abs(sim.s.bore - sim.u.bore) < 3 || sim.s.IS },
    { cible: '#synoptique', titre: 'Dilution maîtrisée',
      texte: sim => `<p>${sim.s.aar ? 'Le réacteur s\'est arrêté automatiquement avant la borication : les protections ont joué leur rôle.' : 'Le réacteur est resté en puissance.'}</p>
        <p>À retenir : le bore est un moyen de contrôle puissant mais <b>lent et invisible</b>. Réacteur à l'arrêt, une dilution non détectée pourrait le rendre critique : c'est pourquoi la concentration en bore est surveillée en permanence.</p>` },
  ] },
};
MISSIONS.find(m => m.id === 'm6').objectifs[1].guide = GUIDES.rtgv.etapes;

/* =====================================================================
   AIDE
   ===================================================================== */
const PRINCIPES = [
  'Dans le <b>cœur</b>, la fission de l\'uranium dégage de la chaleur. Les grappes de commande et le bore absorbent des neutrons pour régler la réaction en chaîne.',
  'L\'eau du <b>circuit primaire</b> emporte cette chaleur. Le pressuriseur la maintient à 155 bar pour qu\'elle reste liquide à plus de 300 °C.',
  'Dans les <b>générateurs de vapeur</b>, elle chauffe à travers des tubes l\'eau du circuit secondaire, qui se transforme en vapeur sans jamais se mélanger à l\'eau du primaire.',
  'La vapeur fait tourner la <b>turbine</b> et l\'alternateur, puis elle est condensée et renvoyée aux générateurs de vapeur.',
  'Le réacteur est <b>stable par nature</b> : s\'il chauffe, la réaction en chaîne ralentit (effets Doppler et modérateur). C\'est pourquoi la turbine commande et le réacteur suit.',
  'Même arrêté, le combustible chauffe encore (<b>puissance résiduelle</b>) : toute la sûreté consiste à garder de l\'eau autour du cœur et un moyen d\'évacuer cette chaleur, derrière trois barrières (gaine, circuit primaire, enceinte).',
];

const GLOSSAIRE = [
  ['REP', 'Réacteur à eau pressurisée. L\'eau sert à la fois à refroidir le cœur et à ralentir les neutrons (modérateur).'],
  ['AAR', 'Arrêt automatique du réacteur : chute de toutes les grappes en 2 secondes.'],
  ['IS', 'Injection de sécurité : pompes qui injectent de l\'eau borée dans le primaire en cas de brèche ou de refroidissement brutal.'],
  ['GV', 'Générateur de vapeur : échangeur entre le circuit primaire et le circuit secondaire.'],
  ['RTGV', 'Rupture de tube de générateur de vapeur : l\'eau primaire passe dans le secondaire.'],
  ['RTV', 'Rupture de tuyauterie vapeur : accident de refroidissement du primaire.'],
  ['VIV', 'Vanne d\'isolement vapeur, une par générateur de vapeur.'],
  ['ARE', 'Alimentation normale en eau des générateurs de vapeur.'],
  ['ASG', 'Alimentation de secours des générateurs de vapeur.'],
  ['GCT', 'Contournement de la turbine : envoie la vapeur directement au condenseur (GCT-c) ou à l\'atmosphère (GCT-a).'],
  ['RCV', 'Contrôle volumétrique et chimique : appoint d\'eau, réglage du bore et du niveau du pressuriseur.'],
  ['pcm', 'Pour cent mille : unité de réactivité. 100 pcm = 0,1 % d\'écart à la criticité.'],
  ['ppm', 'Partie par million : unité de concentration du bore dans l\'eau.'],
  ['Réactivité', 'Écart relatif à l\'équilibre de la réaction en chaîne. Nulle : puissance stable (réacteur critique). Positive : la puissance monte. Négative : elle baisse.'],
  ['β (bêta)', 'Fraction de neutrons retardés, environ 650 pcm. Ce sont eux qui rendent le réacteur pilotable : tant que la réactivité reste bien en dessous de β, la puissance évolue en secondes ou minutes et non en millisecondes.'],
  ['Doppler', 'Contre-réaction du combustible : plus il est chaud, plus l\'uranium 238 capture de neutrons.'],
  ['Modérateur', 'L\'eau, qui ralentit les neutrons. Plus elle est chaude, moins elle est dense et moins elle modère : contre-réaction stabilisante.'],
  ['Xénon 135', 'Produit de fission très absorbant, qui s\'accumule pendant quelques heures après une baisse de puissance.'],
  ['Puissance résiduelle', 'Chaleur dégagée par la radioactivité des produits de fission après l\'arrêt : 6 % de la puissance nominale juste après, 1,5 % au bout de 15 minutes.'],
  ['Marge à la saturation', 'Écart entre la température d\'ébullition à la pression du primaire et la température de l\'eau en sortie du cœur.'],
  ['REC', 'Rapport d\'échauffement critique : marge par rapport à la crise d\'ébullition à la surface des crayons. Doit rester au-dessus de 1,15 environ.'],
  ['Thermosiphon', 'Circulation naturelle de l\'eau du primaire, sans pompes, par différence de densité entre l\'eau chaude et l\'eau froide.'],
  ['Îlotage', 'Fonctionnement de la centrale séparée du réseau, la turbine n\'alimentant que les auxiliaires de la tranche.'],
  ['Palier', 'Famille de réacteurs identiques : 900 MWe (3 boucles) ou 1300 MWe (4 boucles).'],
];

root.Contenus = { VISITE, MISSIONS, GUIDES, PRINCIPES, GLOSSAIRE };
})(typeof window !== 'undefined' ? window : globalThis);
