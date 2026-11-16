/* ======== surete.js ======== */
/* =====================================================================
   surete.js — PROTECTIONS, SAUVEGARDES ET INCIDENTS
   ---------------------------------------------------------------------
   - AAR  : arrêt automatique du réacteur (chute des grappes)
   - IS   : injection de sécurité (eau borée)
   - ASG  : alimentation de secours des générateurs de vapeur
   - RCV  : contrôle volumétrique et chimique (appoint, niveau pressuriseur)
   - INCIDENTS : pannes déclenchables à tout moment (RTGV, RTV, perte réseau...)
   Seuils : tableau « Régulation et seuils » de la fiche thermo (2.4) et params.js.
   ===================================================================== */
(function (root) {
'use strict';
const REP = root.REP = root.REP || {};
const E = REP.eau, C = REP.COMMUN;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

REP.evt = function (s, msg, niveau) {
  if (s.prerol) return;
  s.events.push({ t: s.t, msg, niveau: niveau || 'info' });
  if (s.events.length > 300) s.events.shift();
};

/* ---------- Logique de protection : renvoie la cause d'AAR ou null ---------- */
function protections(s, K) {
  const o = s.out;
  if (s.n > C.aar_flux) return 'haut flux neutronique (> 109 %)';
  if (s.P < C.aar_P_bas) return 'basse pression primaire (< 131 bar)';
  if (s.P > C.aar_P_haut) return 'haute pression primaire (> 165 bar)';
  if (o.wr < C.aar_debit && s.n > 0.1) return 'bas débit primaire (< 88 %)';
  if (s.n > 0.1 && s.bcl.some(b => b.niv < C.aar_niv_gv)) return 'très bas niveau dans un générateur de vapeur';
  if (o.REC < C.aar_REC && s.n > 0.1) return 'marge à la crise d\'ébullition insuffisante (ΔT)';
  if (Math.max(...s.bcl.map(b => b.Tbc)) > K.T_bc0 + C.aar_T_chaude) return 'haute température branche chaude';
  if (s.declTurb && s.n > 0.3 && !s.condenseur) return 'perte des alimentations électriques (turbine déclenchée, condenseur indisponible)';
  return null;
}

function declencherAAR(s, cause) {
  if (s.aar) return;
  s.aar = true; s.aarCause = cause; s.tAAR = s.t;
  REP.evt(s, 'ARRÊT AUTOMATIQUE DU RÉACTEUR : ' + cause, 'alarme');
  declencherTurbine(s, 'arrêt du réacteur');
}
function declencherTurbine(s, cause) {
  if (s.declTurb) return;
  if (s.turbine !== 'arret') REP.evt(s, 'Déclenchement turbine' + (cause ? ' (' + cause + ')' : ''), 'alarme');
  s.declTurb = true; s.turbine = 'arret';
}
function rearmerAAR(s, K) {
  const c = protections(s, K);
  if (c) return c;
  if (s.IS) return 'injection de sécurité en service';
  s.aar = false; s.aarCause = '';
  REP.evt(s, 'Réarmement de l\'arrêt automatique : les grappes peuvent être extraites');
  return null;
}
function demarrerIS(s, cause) {
  if (s.IS) return;
  s.IS = true; s.isBloquee = false;
  REP.evt(s, 'INJECTION DE SÉCURITÉ' + (cause ? ' : ' + cause : ''), 'alarme');
  if (s.are) { s.are = false; REP.evt(s, 'Isolement de l\'eau alimentaire normale (ARE), démarrage de l\'ASG', 'info'); }
  s.signalASG = true;
}
function arreterIS(s) {
  if (!s.IS) return;
  s.IS = false; s.isBloquee = true;
  REP.evt(s, 'Arrêt manuel de l\'injection de sécurité');
}

/* ---------- Pas de calcul des automatismes. Renvoie les débits échangés avec le primaire ---------- */
function pasSurete(s, u, dt, K) {
  const G = K.G, o = s.out, x = { m_is: 0, m_rcv: 0, m_fuite: 0 };
  // --- RTGV : débit de fuite primaire -> secondaire, ∝ √ΔP ---
  for (const b of s.bcl) {
    if (b.rtgv) {
      const dP = s.P - b.Ps;
      b.fuite = b.rtgv * Math.sign(dP) * Math.sqrt(Math.abs(dP) / (G.p1 - G.p2));
      x.m_fuite += b.fuite;
    } else b.fuite = 0;
  }
  // --- signaux d'injection de sécurité ---
  if (!s.prerol && !u.inhibe) {
    if (!s.IS && !s.isBloquee && s.P < C.IS_seuil) demarrerIS(s, 'très basse pression primaire (< 121 bar)');
    // rupture de tuyauterie vapeur : la pression vapeur s'effondre (critère = basse pression ET chute rapide)
    const PsMin = Math.min(...s.bcl.map(b => b.Ps));
    s.dPsMin = (s.dPsMin || 0) + ((PsMin - (s.PsMinPrec || PsMin)) / dt - (s.dPsMin || 0)) * Math.min(1, dt / 3);
    s.PsMinPrec = PsMin;
    if (!s.isolVap && PsMin < 50 && s.dPsMin < -0.5) {
      s.isolVap = true;
      REP.evt(s, 'Chute rapide de la pression vapeur : isolement automatique des lignes vapeur', 'alarme');
      for (let i = 0; i < K.NB; i++) u.viv[i] = false;
      if (!s.isBloquee) demarrerIS(s, 'basse pression vapeur');
    }
    if (s.IS && !s.aar) declencherAAR(s, 'injection de sécurité');
  }
  if (s.isBloquee && s.P > 140) s.isBloquee = false;
  const secours = s.elec || s.diesel;
  if (s.IS && secours) {
    x.m_is = C.IS_debit * Math.min(1.35, Math.sqrt(Math.max(0, (C.IS_refoul - s.P) / (C.IS_refoul - C.IS_seuil))));
    s.bore += dt * x.m_is * (C.bore_IS - s.bore) / s.Mprim;
    if (s.bore > u.bore) u.bore = s.bore;          // la consigne suit : on ne redilue pas après une injection de sécurité
  }
  // --- RCV : appoint / décharge pour tenir le niveau du pressuriseur ---
  const Tmoy = o.Tmoy;
  o.nivRef = REP.thermo.niveauProgramme(K, Tmoy);
  if (secours && !s.IS) {
    // pressuriseur plein d'eau : la décharge est bridée pour ne pas dépressuriser le primaire jusqu'à l'ébullition
    const bride = o.nivPzr > 90 ? clamp((o.marge - 25) / 10, 0, 1) : 1;
    x.m_rcv = clamp(C.rcv_gain * (o.nivRef - o.nivPzr), C.rcv_min * bride, C.rcv_max);
  }
  // --- bore (borication / dilution par le RCV) ---
  if (s.dilutionHS) {
    s.bore = Math.max(0, s.bore - dt * 0.35);
    if (u.bore > s.boreCmd0 + 2) { s.dilutionHS = false; REP.evt(s, 'Borication lancée : la dilution incontrôlée est isolée'); }
  } else if (!s.IS && secours) s.bore += clamp(u.bore - s.bore, -C.v_bore * dt, C.v_bore * dt);
  // --- eau alimentaire ---
  if (!s.elec || s.areHS) s.are = false;
  if (!s.are) s.signalASG = true;
  s.asgDispo = secours && !s.asgHS;
  // --- AAR ---
  if (!s.aar && !u.inhibe && !s.prerol) {
    const c = protections(s, K);
    if (c) declencherAAR(s, c);
  }
  // --- intégrité du combustible ---
  if (!s.prerol) {
    if (!s.gainesRompues && o.Tgaine > C.T_gaine_max) { s.gainesRompues = true; REP.evt(s, 'Gaines du combustible endommagées (> 1204 °C) : première barrière perdue', 'alarme'); }
    if (!s.fusion && o.Tcentre > C.T_fusion) { s.fusion = true; REP.evt(s, 'FUSION DU COMBUSTIBLE : accident grave', 'alarme'); }
  }
  o.m_is = x.m_is; o.m_rcv = x.m_rcv; o.m_fuite = x.m_fuite;
  return x;
}

/* =====================================================================
   INCIDENTS déclenchables à tout moment. gv = numéro de boucle (0..NB-1)
   ===================================================================== */
const INCIDENTS = {
  rtgv: {
    nom: 'RTGV : rupture d\'un tube de générateur de vapeur', court: 'RTGV', gravite: 3,
    resume: 'Un tube de GV casse : l\'eau primaire radioactive passe dans le circuit secondaire.',
    declencher(s, u, K) {
      const i = s.gvAccident = Math.floor(Math.random() * K.NB);
      s.bcl[i].rtgv = C.fuite_rtgv;
    },
  },
  rtv: {
    nom: 'RTV : rupture d\'une tuyauterie vapeur', court: 'RTV', gravite: 3,
    resume: 'Une ligne vapeur casse entre un GV et sa vanne d\'isolement : le GV se vide, le primaire se refroidit brutalement.',
    declencher(s, u, K) {
      const i = s.gvAccident = Math.floor(Math.random() * K.NB);
      s.bcl[i].brecheVap = 0.5;
    },
  },
  soupape: {
    nom: 'Brèche primaire : soupape du pressuriseur bloquée ouverte', court: 'Soupape bloquée', gravite: 3,
    resume: 'Une soupape du pressuriseur s\'ouvre et ne se referme pas : le primaire se vide en vapeur (scénario de Three Mile Island).',
    declencher(s) { s.soupape = true; s.soupapeBloquee = true; },
  },
  perte_reseau: {
    nom: 'Perte totale des alimentations électriques externes', court: 'Perte du réseau', gravite: 2,
    resume: 'Le réseau disparaît et l\'îlotage échoue : plus de pompes primaires, plus de condenseur. Les diesels alimentent les secours.',
    declencher(s) {
      s.reseau = false; s.elec = false; s.condenseur = false; s.are = false;
      declencherTurbine(s, 'perte du réseau');
    },
  },
  ilotage: {
    nom: 'Îlotage : la tranche se sépare du réseau', court: 'Îlotage', gravite: 1,
    resume: 'Défaut sur le réseau : la turbine ne fournit plus que les 5 % nécessaires à la centrale elle-même.',
    possible: s => s.turbine === 'couplee',
    declencher(s, u) { s.reseau = false; s.turbine = 'ilotee'; s.tRetourReseau = s.t + 900; u.autoR = true; },   // l'îlotage enclenche le pilotage automatique des grappes
  },
  perte_pompes: {
    nom: 'Arrêt des pompes primaires', court: 'Perte des pompes', gravite: 2,
    resume: 'Défaut électrique sur le tableau qui alimente les pompes primaires : le débit s\'effondre.',
    declencher(s) { for (const b of s.bcl) b.pompeHS = true; },
  },
  perte_are: {
    nom: 'Perte de l\'eau alimentaire (et panne du démarrage automatique de l\'ASG)', court: 'Perte d\'eau alimentaire', gravite: 2,
    resume: 'Les pompes alimentaires s\'arrêtent. Les GV se vident en une minute environ, et le secours ne démarre pas tout seul.',
    declencher(s) { s.areHS = true; s.are = false; s.asgAutoHS = true; },
  },
  dilution: {
    nom: 'Dilution incontrôlée du bore', court: 'Dilution', gravite: 1,
    resume: 'Une vanne d\'eau claire reste ouverte : la concentration en bore baisse, la réactivité augmente lentement.',
    declencher(s, u) { s.dilutionHS = true; s.boreCmd0 = u.bore; },
  },
};
function declencherIncident(s, u, K, id) {
  const inc = INCIDENTS[id];
  if (!inc || (inc.possible && !inc.possible(s))) return false;
  inc.declencher(s, u, K);
  s.incidents.push({ id, t: s.t });
  REP.evt(s, 'INCIDENT : ' + inc.nom, 'alarme');
  return true;
}

REP.surete = { protections, declencherAAR, declencherTurbine, rearmerAAR, demarrerIS, arreterIS, pasSurete, INCIDENTS, declencherIncident };
})(typeof window !== 'undefined' ? window : globalThis);
