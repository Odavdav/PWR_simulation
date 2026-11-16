/* ======== moteur.js ======== */
/* =====================================================================
   moteur.js — ASSEMBLAGE DES MODÈLES ET BOUCLE DE CALCUL
   ---------------------------------------------------------------------
   API utilisée par l'interface (aucun code d'affichage ici) :
     const sim = REP.creer({ palier: 900, cycle: 'milieu', etat: 'nominal' })
     sim.s  : état de la centrale        sim.u : commandes de l'opérateur
     sim.K  : constantes calibrées       sim.avancer(duree) : fait avancer la simulation
     sim.action('aar' | 'rearmerAAR' | 'lancerTurbine' | 'coupler' | ...)
     sim.incident('rtgv' | ...)
   Ordre de calcul à chaque pas (fiche thermo 2.6) :
     1 neutronique → 2 hydraulique → 3 combustible → 4 eau → 5 pressuriseur → 6 contre-réactions
   ===================================================================== */
(function (root) {
'use strict';
const REP = root.REP = root.REP || {};
const E = REP.eau, C = REP.COMMUN, N = REP.neutronique, TH = REP.thermo, SU = REP.surete;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function etatDeBase(K, puissance) {
  const G = K.G, p = puissance;
  const s = {
    t: 0, prerol: true,
    // neutronique
    n: Math.max(p, 1e-9), Cn: N.precurseursEquilibre(Math.max(p, 1e-9), C, K.ref), res: C.res_a.map(a => a * p), qRes: 0,
    xe: N.xenonEquilibre(p, C), iode: p, xR: C.xR0, xS: 0, bore: K.ref.bore0, rhoExt: 0, sur: 0,
    // primaire
    Tc: G.T_e + (K.Tc0 - G.T_e) * p, Ts: G.T_e + (G.T_s - G.T_e) * p, Tps: G.T_e + (K.T_bc0 - G.T_e) * p, Tdesc: G.T_e, Tm: G.T_e + (K.Tm0 - G.T_e) * p,
    bcl: [], crise: false, Vvide: 0, pzrVide: false,
    // secondaire
    tv: p, charge: p, gct: 0, Nturb: p > 0.02 ? 1500 : 0, turbine: p > 0.02 ? 'couplee' : 'arret', declTurb: false, Pe: G.P_e * p, energie: 0, rejets: 0,
    // disponibilités
    reseau: true, elec: true, diesel: true, condenseur: true, are: true, asgDispo: true, signalASG: false,
    // sûreté
    aar: false, aarCause: '', IS: false, isBloquee: false, isolVap: false, soupape: false, soupapeBloquee: false,
    gainesRompues: false, fusion: false, incidents: [], gvAccident: -1,
    events: [], out: { decouvert: 0, nivCuve: 100, wr: 1, REC: C.REC_nom, Tmoy: 0, nivPzr: 0, rho: {} },
  };
  const Ps = G.p2_zero + (G.p2 - G.p2_zero) * p;
  for (let i = 0; i < K.NB; i++) s.bcl.push({
    Tbc: s.Tps, Tgv: G.T_e, Tbu: G.T_e, Tbf: G.T_e, w: 1, m: K.m_b, Qgv: K.Q_gv0 * p, pompeHS: false,
    Tsec: E.Tsat(Ps), Ps, Ms: G.M_gv, Wae: K.m_vap0 * p, Wvap: K.m_vap0 * p, Wcol: 0, Watm: 0, niv: 50, asg: false, gcta: 0,
    vivOuv: true, rtgv: 0, fuite: 0, brecheVap: 0, Mfuite: 0, act: 1,
  });
  const nivPzr = TH.niveauProgramme(K, (s.Tps + G.T_e) / 2);
  TH.initPzr(s, K, G.p1, nivPzr);
  s.Mprim = TH.masseBoucles(s, K) + s.Mpz;
  return s;
}

function commandesDefaut(s, K) {
  return {
    R: Math.round(C.pas_max * (1 - s.xR)), autoR: false, S: s.xS < 0.5, bore: s.bore,
    pompes: s.bcl.map(() => true), pzrAuto: true, Pconsigne: K.G.p1, chauf: false, asp: 0, soupapeOuv: false, soupapeIsol: false,
    turb: s.tv, aeAuto: true, ae: 1, asg: 'auto', gctConsigne: K.G.p2_zero,
    viv: s.bcl.map(() => true), alim: s.bcl.map(() => true), inhibe: false,
  };
}

/* ------------------------------------------------------------------ PAS DE CALCUL ------------------------------------------------------------------ */
function pas(s, u, dt, K) {
  if (s.fusion) return;
  const o = s.out;
  s.t += dt;
  // --- événements différés ---
  if (s.tRetourReseau && s.t > s.tRetourReseau) { s.tRetourReseau = 0; s.reseau = true; REP.evt(s, 'Le réseau est de nouveau disponible : la tranche peut être recouplée'); }

  // --- régulation automatique de la température moyenne par le groupe R ---
  // îloté, le réacteur reste vers 30 % (le contournement évacue l'excédent) pour pouvoir reprendre la charge rapidement
  const charge = s.turbine === 'ilotee' ? Math.max(s.charge, C.palier_ilotage) : s.charge;
  o.Tref = TH.TmoyReference(K, charge);
  if (u.autoR && !s.aar && !s.prerol) {
    let err = (o.Tmoy - o.Tref) + C.reg_kp * (s.n - Math.max(charge, 0));       // écart de température + écart de puissance (anticipation)
    if (s.defautRegul) err = -5;
    if (Math.abs(err) > C.bande_Tmoy) u.R = clamp(u.R - Math.sign(err) * Math.min(C.v_R, C.reg_kv * (Math.abs(err) - C.bande_Tmoy) + 0.1) * dt, 0, C.pas_max);
  }
  // --- déplacement des grappes ---
  if (s.aar) {
    const v = dt / C.t_chute;
    s.xR = Math.min(1, s.xR + v); s.xS = Math.min(1, s.xS + v);
    u.R = C.pas_max * (1 - s.xR); u.S = false;
  } else {
    const cibleR = 1 - clamp(u.R, 0, C.pas_max) / C.pas_max;
    s.xR += clamp(cibleR - s.xR, -C.v_R * dt / C.pas_max, C.v_R * dt / C.pas_max);
    const cibleS = u.S ? 0 : 1;
    s.xS += clamp(cibleS - s.xS, -C.v_S * dt / C.pas_max, C.v_S * dt / C.pas_max);
  }

  // --- 1. neutronique : (35) puis (1) à (7) ---
  const rho = N.reactivite(s, C, K.ref);
  const sur = N.pasCinetique(s, rho.total, dt, C, K.ref);
  s.sur += (sur - s.sur) * Math.min(1, dt / 2);
  const q = N.pasPuissance(s, dt, C);                         // (36)
  if (!s.prerol) N.pasXenon(s, dt, C);

  // --- automatismes de sûreté, fuites, appoints ---
  o.Tmoy = s.bcl.reduce((a, b) => a + (b.Tbc + b.Tbf) / 2, 0) / K.NB;
  const x = SU.pasSurete(s, u, dt, K);

  // --- 2 à 4. hydraulique, combustible, eau ---
  TH.pasPrimaire(s, u, q, dt, K, x);
  // --- 5. pressuriseur ---
  TH.pasPressuriseur(s, u, dt, K, x);
  TH.crayon(s, K);
  // --- secondaire ---
  TH.pasSecondaire(s, u, dt, K);

  o.rho = rho; o.q = q;
  o.Tbc = Math.max(...s.bcl.map(b => b.Tbc));
  o.Tbf = s.Tdesc;
  o.periode = Math.abs(s.sur) > 0.01 ? 26.06 / s.sur : Infinity;       // période (s) = 60/(ln10·TD)
  o.doublement = s.sur > 0.01 ? 18.06 / s.sur : Infinity;              // temps de doublement (s)
}

/* ------------------------------------------------------------------ CRÉATION ------------------------------------------------------------------ */
const ETATS = {
  nominal: { nom: 'Pleine puissance (100 %)' },
  arret: { nom: 'Arrêt à chaud (réacteur sous-critique)' },
};

function creer(opt) {
  opt = Object.assign({ palier: 900, cycle: 'milieu', etat: 'nominal' }, opt);
  const K = TH.calibrer(opt.palier, opt.cycle);
  let s, u;
  if (opt.etat === 'arret') {
    s = etatDeBase(K, 0);
    s.xR = 1; s.xS = 1; s.xe = 0; s.iode = 0; s.n = 1e-8; s.Cn = N.precurseursEquilibre(1e-8, C, K.ref);
    // bore tel que la divergence ait lieu avec le groupe R à mi-course (barres d'arrêt extraites, sans xénon)
    const G = K.G;
    const r = -C.W_R * (N.fBarres(0.5) - N.fBarres(C.xR0)) + C.alpha_D * (G.T_e - K.Tc0) + K.ref.alpha_M * (G.T_e - K.Tm0) - C.rho_Xe;
    s.bore = Math.round(K.ref.bore0 - r / C.alpha_B);
    s.declTurb = false; s.turbine = 'arret';
    u = commandesDefaut(s, K);
    u.R = 0; u.S = false; u.turb = 0;
  } else {
    s = etatDeBase(K, 1);
    u = commandesDefaut(s, K);
  }
  // pré-calcul : on laisse le modèle se poser sur son équilibre exact
  for (let i = 0; i < 4000; i++) pas(s, u, 0.1, K);
  if (opt.etat !== 'arret') {      // on annule l'écart résiduel de réactivité pour partir exactement à 100 %
    for (let k = 0; k < 6; k++) { s.rhoExt -= s.out.rho.total; s.n = 1; s.Cn = N.precurseursEquilibre(1, C, K.ref); for (let i = 0; i < 1500; i++) pas(s, u, 0.1, K); }
  }
  s.t = 0; s.prerol = false; s.events = []; s.energie = 0; s.rejets = 0; s.sur = 0;
  for (const b of s.bcl) b.Mfuite = 0;

  const sim = {
    s, u, K, opt,
    avancer(duree, dtMax) {
      const nPas = Math.max(1, Math.ceil(duree / (dtMax || 0.1))), dt = duree / nPas;
      for (let i = 0; i < nPas; i++) pas(s, u, dt, K);
    },
    action(nom, arg) { return ACTIONS[nom] ? ACTIONS[nom](s, u, K, arg) : 'action inconnue'; },
    incident(id) { return SU.declencherIncident(s, u, K, id); },
  };
  return sim;
}

/* Actions ponctuelles de l'opérateur. Renvoient null si acceptée, sinon un message expliquant le refus. */
const ACTIONS = {
  aar(s) { SU.declencherAAR(s, 'commande manuelle de l\'opérateur'); return null; },
  rearmerAAR(s, u, K) { const c = SU.rearmerAAR(s, K); return c ? 'Réarmement impossible : ' + c : null; },
  is(s) { SU.demarrerIS(s, 'commande manuelle'); return null; },
  arreterIS(s) { SU.arreterIS(s); return null; },
  declTurbine(s) { SU.declencherTurbine(s, 'commande manuelle'); return null; },
  lancerTurbine(s, u, K) {
    if (s.aar && s.n < 0.01) return 'Le réacteur est à l\'arrêt : il n\'y a pas assez de vapeur.';
    if (!s.condenseur) return 'Condenseur indisponible.';
    if (s.out.q < 0.03) return 'Puissance trop faible : montez d\'abord le réacteur vers 5 à 10 %.';
    s.declTurb = false; s.turbine = 'lancement'; s.tv = 0;
    REP.evt(s, 'Lancement de la turbine : montée en vitesse vers 1500 tr/min');
    return null;
  },
  coupler(s, u) {
    if (s.turbine === 'ilotee') {
      if (!s.reseau) return 'Le réseau n\'est pas encore revenu.';
      s.turbine = 'couplee'; s.charge = u.turb = C.ilotage; REP.evt(s, 'Tranche recouplée au réseau'); return null;
    }
    if (s.turbine !== 'prete') return 'La turbine doit d\'abord tourner à 1500 tr/min.';
    if (!s.reseau) return 'Réseau indisponible.';
    s.turbine = 'couplee'; s.charge = 0; u.turb = 0.05;
    REP.evt(s, 'Alternateur couplé au réseau');
    return null;
  },
};

REP.creer = creer; REP.pas = pas; REP.ETATS = ETATS;
})(typeof window !== 'undefined' ? window : globalThis);
