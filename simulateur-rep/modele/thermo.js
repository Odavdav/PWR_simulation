/* ======== thermo.js ======== */
/* =====================================================================
   thermo.js — LOT 2 : THERMOHYDRAULIQUE (primaire, pressuriseur, GV, secondaire)
   ---------------------------------------------------------------------
   Fiche « Thermohydraulique du circuit primaire » (H12 à H19, éq. (8) à (36)).
   Différences assumées par rapport à la fiche (détaillées dans MODELES.md) :
     - H13 levée : chaque boucle est calculée séparément (isolement d'un GV) ;
     - (26) : l'état du nœud « eau du cœur » est la température de sortie T_s,
       et T_m = (T_e + T_s)/2 sert à l'échange et à la contre-réaction ;
     - c_p constant, calé pour retrouver exactement le ΔT cœur de la fiche ;
     - pressuriseur : modèle 2 (équilibre liquide-vapeur) + terme transitoire du modèle 1.
   calibrer() refait les calculs de calculs.py : l'état 100 % est un équilibre exact.
   ===================================================================== */
(function (root) {
'use strict';
const REP = root.REP = root.REP || {};
const E = REP.eau, C = REP.COMMUN;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const g = 9.81;

/* ------------------------------------------------------------------
   CALIBRAGE : constantes dérivées du régime nominal (script calculs.py)
   ------------------------------------------------------------------ */
function calibrer(palier, cycle) {
  const G = REP.PALIERS[palier], CY = REP.CYCLES[cycle || 'milieu'];
  const K = { G, palier, cycle: cycle || 'milieu', NB: G.NB };
  // --- (8) débit à partir du bilan d'énergie ---
  const h_e = E.hL(G.T_e), h_s = E.hL(G.T_s);
  K.m_coeur = G.P_th / (h_s - h_e);
  K.m_tot = K.m_coeur / (1 - G.f_by);
  K.m_b = K.m_tot / G.NB;
  K.cp = (h_s - h_e) / (G.T_s - G.T_e);                 // c_p moyen équivalent
  K.Tm0 = (G.T_e + G.T_s) / 2;
  K.rho_e = E.rho(G.T_e); K.rho_s = E.rho(G.T_s); K.rho_m = E.rho(K.Tm0);
  K.T_bc0 = G.T_e + (1 - G.f_by) * (G.T_s - G.T_e);     // branche chaude après mélange du bypass
  K.Tsat1 = E.Tsat(G.p1);
  // --- Géométrie du cœur ---
  K.N_rod = G.N_ass * G.N_cr;
  K.S_ech = Math.PI * G.D_ext * G.H * K.N_rod;
  const A_cell = G.pas ** 2 - Math.PI * G.D_ext ** 2 / 4;
  K.A_pass = G.N_ass * G.pas_ass ** 2 - K.N_rod * Math.PI * G.D_ext ** 2 / 4 - G.N_ass * G.N_tg * Math.PI * G.D_tg ** 2 / 4;
  K.Dh = 4 * A_cell / (Math.PI * G.D_ext);
  K.v_coeur = K.m_coeur / (K.rho_m * K.A_pass);
  K.q_lin = G.f_comb * G.P_th / (K.N_rod * G.H);        // W/m, puissance linéique moyenne
  K.D_int = G.D_ext - 2 * G.e_g;
  K.M_UO2 = K.N_rod * Math.PI * G.D_p ** 2 / 4 * G.H * G.rho_UO2;
  K.M_Zr = K.N_rod * Math.PI / 4 * (G.D_ext ** 2 - K.D_int ** 2) * G.H * G.rho_Zr;
  K.V_coeur = K.A_pass * G.H;
  // --- (21) Dittus-Boelter ---
  K.Re = K.rho_m * K.v_coeur * K.Dh / G.mu;
  K.Nu = 0.023 * K.Re ** 0.8 * G.Pr ** 0.4;
  K.h_conv = K.Nu * G.k_eau / K.Dh;
  // --- (20) à (24) profil radial du crayon moyen à 100 % ---
  K.dT = profilRadial(K, K.q_lin, 1);
  K.Tc0 = K.Tm0 + K.dT.film + K.dT.gaine + K.dT.jeu + K.dT.pastille / 2;      // T moyenne combustible
  K.R_th = (K.Tc0 - K.Tm0) / (G.f_comb * G.P_th);                             // (27)
  K.part_conv = K.dT.film / (K.Tc0 - K.Tm0);
  K.C_comb = K.M_UO2 * G.cp_UO2 + K.M_Zr * G.cp_Zr;                           // (25)
  K.tau_comb = K.R_th * K.C_comb;
  // --- Pompe (14) à (17), pertes de charge (13) ---
  K.Q_b = K.m_b / K.rho_e;
  K.omega0 = G.N_rpm * 2 * Math.PI / 60;
  K.P_arbre = K.rho_e * g * G.H_pompe * K.Q_b / G.eta_p;
  K.C0 = K.P_arbre / K.omega0;
  K.tau_p = G.J_pompe * K.omega0 / K.C0;                                      // (17)
  K.dP_boucle = K.rho_e * g * G.H_pompe;
  K.Rm = K.dP_boucle / K.m_b ** 2;                                            // Pa/(kg/s)², par boucle
  // --- Volumes et capacités thermiques des nœuds ---
  const sec = D => Math.PI * D * D / 4;
  K.V_bc = sec(G.tuy.bc[0]) * G.tuy.bc[1];
  K.V_bu = sec(G.tuy.bu[0]) * G.tuy.bu[1] + G.V_volute;
  K.V_bf = sec(G.tuy.bf[0]) * G.tuy.bf[1];
  K.V_tub = G.N_tub * sec(G.D_tub - 2 * G.e_tub) * G.A_gv / (G.N_tub * Math.PI * G.D_tub);
  K.V_gv = K.V_tub + 2 * G.V_boite_eau;
  K.V_prim = K.V_coeur + G.V_plenum_sup + G.V_descente + G.NB * (K.V_bc + K.V_gv + K.V_bu + K.V_bf);
  K.Cn = {            // J/K
    coeur: K.V_coeur * K.rho_m * K.cp, ps: G.V_plenum_sup * K.rho_s * K.cp, desc: G.V_descente * K.rho_e * K.cp,
    bc: K.V_bc * K.rho_s * K.cp, gv: K.V_gv * K.rho_m * K.cp, bu: K.V_bu * K.rho_e * K.cp, bf: K.V_bf * K.rho_e * K.cp,
  };
  K.V_haut = G.V_plenum_sup + G.NB * (K.V_bc + 0.5 * K.V_gv);     // volume situé au-dessus du cœur
  // --- Générateur de vapeur (29) ---
  K.Q_gv0 = (G.P_th + G.NB * G.P_pompe) / G.NB;
  K.Tsat2 = E.Tsat(G.p2);
  K.T_gv0 = G.T_e - G.P_pompe / (K.m_b * K.cp);                   // sortie GV (avant la pompe)
  K.UA = K.Q_gv0 / ((K.T_bc0 + K.T_gv0) / 2 - K.Tsat2);
  K.m_vap0 = K.Q_gv0 / (E.hg(G.p2) - G.h_ae);                     // kg/s par GV
  K.W_vap = G.NB * K.m_vap0;                                      // débit vapeur total nominal
  K.k_turb = K.W_vap / G.p2;
  // --- Pressuriseur ---
  K.A_pzr = sec(G.D_pzr);
  K.Tmoy0 = (K.T_bc0 + G.T_e) / 2;                                // T moyenne des boucles à 100 %
  // --- Neutronique : référence critique à 100 % ---
  K.ref = {
    Tc0: K.Tc0, Tm0: K.Tm0, bore0: CY.bore0, alpha_M: CY.alpha_M,
    beta_i: C.beta_i.map(b => b * CY.f_beta),
  };
  K.ref.beta = K.ref.beta_i.reduce((a, b) => a + b, 0);
  return K;
}

/* (20) à (24) : écarts de température dans un crayon de puissance linéique q (W/m), débit relatif wr */
function profilRadial(K, q, wr) {
  const G = K.G, h = K.h_conv * Math.max(wr, 0.02) ** 0.8;
  return {
    film: q / (Math.PI * G.D_ext * h),                                  // (20)
    gaine: q * Math.log(G.D_ext / K.D_int) / (2 * Math.PI * G.k_Zr),    // (22)
    jeu: q / (Math.PI * G.D_p * G.h_gap),                               // (23)
    pastille: q / (4 * Math.PI * G.k_UO2),                              // (24)
  };
}

/* Niveau programmé du pressuriseur en fonction de la température moyenne */
function niveauProgramme(K, Tmoy) {
  const G = K.G, x = clamp((Tmoy - G.T_e) / (K.Tmoy0 - G.T_e), 0, 1);
  return G.niv_pzr_0 + (G.niv_pzr_100 - G.niv_pzr_0) * x;
}
/* Température moyenne de référence en fonction de la charge turbine (0..1) */
function TmoyReference(K, charge) {
  return K.G.T_e + (K.Tmoy0 - K.G.T_e) * clamp(charge, 0, 1);
}

/* Masse d'eau liquide contenue dans les boucles et la cuve si elles sont pleines */
function masseBoucles(s, K) {
  const G = K.G;
  let M = K.V_coeur * E.rho((s.Tdesc + s.Ts) / 2) + G.V_plenum_sup * E.rho(s.Tps) + G.V_descente * E.rho(s.Tdesc);
  for (const b of s.bcl) M += K.V_bc * E.rho(b.Tbc) + K.V_gv * E.rho((b.Tbc + b.Tgv) / 2) + K.V_bu * E.rho(b.Tbu) + K.V_bf * E.rho(b.Tbf);
  return M;
}

/* ------------------------------------------------------------------
   HYDRAULIQUE : pompes (16)(17), débit (15), circulation naturelle (18)(19)
   ------------------------------------------------------------------ */
function pasHydraulique(s, u, dt, K) {
  let mtot = 0;
  for (let i = 0; i < K.NB; i++) {
    const b = s.bcl[i];
    const marche = u.pompes[i] && s.elec && !b.pompeHS;
    // (16) J·dω/dt = C_moteur − C0·(ω/ω0)²   (ω normalisé ; couple moteur = 1,6·C0 au démarrage)
    if (marche) b.w = Math.min(1, b.w + dt * (1.6 - b.w * b.w) / K.tau_p);
    else b.w = b.w / (1 + dt * b.w / K.tau_p);                               // (17) : ω = ω0/(1 + t/τp)
    const m_pompe = b.w * K.m_b;                                             // (15)
    // (18) ΔP moteur = ρ·β·ΔT·g·ΔZ = Rm·ṁ²
    const dTm = Math.max(0, b.Tbc - b.Tbf) * clamp(b.Qgv / (0.002 * K.Q_gv0), 0, 1);   // pas de thermosiphon sans puits froid
    let m_nc = Math.sqrt(K.rho_m * K.G.beta_dil * g * K.G.dZ_nc * dTm / K.Rm);
    if (s.Vvide > 0.6 * K.V_haut) m_nc *= clamp(1 - (s.Vvide - 0.6 * K.V_haut) / (0.3 * K.V_haut), 0, 1);  // bulle dans les tubes GV
    const cible = Math.max(m_pompe, m_nc, 1e-4 * K.m_b);
    b.m = cible > m_pompe ? b.m + (cible - b.m) * Math.min(1, dt / 8) : Math.max(cible, b.m - (b.m - cible) * Math.min(1, dt / 0.5));
    mtot += b.m;
  }
  return mtot;
}

/* ------------------------------------------------------------------
   PRIMAIRE : combustible (25), eau du cœur (26), nœuds (28), GV (29)
   q = puissance totale / puissance nominale. x = { m_is : débit d'IS total }
   Schéma amont implicite : stable quel que soit le pas de temps.
   ------------------------------------------------------------------ */
function pasPrimaire(s, u, q, dt, K, x) {
  const G = K.G, cp = K.cp, o = s.out;
  const mtot = pasHydraulique(s, u, dt, K);
  const mc = (1 - G.f_by) * mtot, wr = mc / K.m_coeur;
  const P = q * G.P_th;
  // --- (27) résistance thermique combustible -> eau ---
  let R = K.R_th * ((1 - K.part_conv) + K.part_conv * Math.max(wr, 0.02) ** -0.8);
  if (s.crise) R *= 5;                                         // crise d'ébullition : film de vapeur sur la gaine
  if (o.decouvert > 0) R /= (1 - 0.995 * o.decouvert);         // cœur découvert : plus de refroidissement
  const Tm = (s.Tdesc + s.Ts) / 2;
  // --- (25) combustible ---
  const a = dt / (K.C_comb * R);
  s.Tc = (s.Tc + dt * G.f_comb * P / K.C_comb + a * Tm) / (1 + a);
  const Qfc = (s.Tc - Tm) / R;
  // --- (26) eau du cœur (état = température de sortie) ---
  const ac = dt * mc * cp / K.Cn.coeur;
  s.Ts = (s.Ts + ac * s.Tdesc + dt * (Qfc + (1 - G.f_comb) * P) / K.Cn.coeur) / (1 + ac);
  // --- (28) plénum supérieur : sortie cœur + bypass ---
  const ap = dt * mtot * cp / K.Cn.ps;
  s.Tps = (s.Tps + ap * ((1 - G.f_by) * s.Ts + G.f_by * s.Tdesc)) / (1 + ap);
  // --- boucles ---
  let somme = 0, sommeA = 0;
  const m_is = x.m_is / K.NB;
  for (let i = 0; i < K.NB; i++) {
    const b = s.bcl[i], m = b.m, mcp = m * cp;
    let a1 = dt * mcp / K.Cn.bc;
    b.Tbc = (b.Tbc + a1 * s.Tps) / (1 + a1);
    // (29) GV : Q = UA·(T moyenne primaire − Tsat secondaire)
    const fNiv = clamp(b.Ms / G.M_gv_decouv, 0.01, 1);
    const fDeb = 0.55 + 0.45 * Math.min(1, m / K.m_b) ** 0.8;
    let UA = K.UA * fNiv * fDeb;
    if (b.Tsec > (b.Tbc + b.Tgv) / 2) UA *= 0.004;     // GV plus chaud que le primaire : pas d'ébullition, l'eau se stratifie, échange très faible
    const Tgv = (K.Cn.gv * b.Tgv / dt + mcp * b.Tbc - UA * (b.Tbc / 2 - b.Tsec)) / (K.Cn.gv / dt + mcp + UA / 2);
    b.Tgv = Tgv;
    b.Qgv = UA * ((b.Tbc + Tgv) / 2 - b.Tsec);
    a1 = dt * mcp / K.Cn.bu;
    b.Tbu = (b.Tbu + a1 * b.Tgv + dt * G.P_pompe * b.w ** 3 / K.Cn.bu) / (1 + a1);
    a1 = dt * mcp / K.Cn.bf;
    const ai = dt * m_is * cp / K.Cn.bf;
    b.Tbf = (b.Tbf + a1 * b.Tbu + ai * C.IS_T) / (1 + a1 + ai);
    const ad = dt * (m + m_is) * cp / K.Cn.desc;
    somme += ad * b.Tbf; sommeA += ad;
  }
  s.Tdesc = (s.Tdesc + somme) / (1 + sommeA);
  o.mtot = mtot; o.mc = mc; o.wr = mtot / K.m_tot; o.Tm = Tm; o.Qfc = Qfc; o.P = P;
  s.Tm = Tm;
}

/* ------------------------------------------------------------------
   Températures du crayon (profil radial (20) à (24)), marge à la crise d'ébullition
   ------------------------------------------------------------------ */
function crayon(s, K) {
  const o = s.out, G = K.G;
  const qf = Math.max(0, o.Qfc / (G.f_comb * G.P_th));        // flux thermique relatif
  const wrc = o.mc / K.m_coeur;
  const moy = profilRadial(K, K.q_lin * qf, wrc), chaud = profilRadial(K, K.q_lin * qf * G.F_Q, wrc);
  const Tsat = E.Tsat(s.P);
  const Teau_chaud = Math.min(Tsat, o.Tm + 0.73 * (s.Ts - o.Tm));     // eau au niveau du point chaud (≈ T_s − 5 °C)
  // gaine : l'ébullition nucléée limite la surchauffe de paroi (Jens-Lottes)
  const phi = K.q_lin * qf * G.F_Q / (Math.PI * G.D_ext);
  const jens = Tsat + 25 * Math.pow(Math.max(phi, 1) / 1e6, 0.25) * Math.exp(-s.P / 62);
  let Tg_chaud = Math.min(Teau_chaud + chaud.film, jens);
  // rapport d'échauffement critique (indicateur simplifié, voir MODELES.md)
  let rec = C.REC_nom * Math.max(0, Tsat - o.Tm) / (K.Tsat1 - K.Tm0) * Math.max(wrc, 0.02) ** 0.8 / Math.max(qf, 0.02);
  rec = qf < 0.05 ? 9.9 : Math.min(rec, 9.9);
  if (!s.crise && rec < 1 && qf > 0.05) s.crise = true;
  if (s.crise && rec > 1.3) s.crise = false;
  if (s.crise || o.decouvert > 0.05) Tg_chaud = o.Tm + (s.Tc - o.Tm) * G.F_Q * 0.45;   // gaine mal refroidie : suit le combustible
  o.REC = rec;
  o.profil = {
    eau: o.Tm, gaine_ext: o.Tm + moy.film, gaine_int: o.Tm + moy.film + moy.gaine,
    surf: o.Tm + moy.film + moy.gaine + moy.jeu, centre: o.Tm + moy.film + moy.gaine + moy.jeu + moy.pastille,
  };
  // crayon chaud : même forme de profil, mise à l'échelle avec l'écart réel combustible-eau (inertie comprise)
  const d = K.dT, rc = (d.film + d.gaine + d.jeu + d.pastille) / (d.film + d.gaine + d.jeu + d.pastille / 2);
  o.Tcentre = Teau_chaud + (s.Tc - o.Tm) * G.F_Q * rc;
  o.Tgaine = Tg_chaud;
}

/* ------------------------------------------------------------------
   PRESSURISEUR : modèle 2 (32) à (34), équilibre liquide-vapeur
   États : s.Mpz (kg), s.Upz (J, énergie interne), s.dPne (bar, écart transitoire du modèle 1 (31))
   ------------------------------------------------------------------ */
function etatPzr(M, U, V, P0) {
  // cherche P tel que M·u(P, v) = U, avec v = V/M et u = h − P·v (méthode de la sécante)
  const v = V / M;
  const f = P => {
    const vf = E.vf(P), vg = E.vg(P), hf = E.hf(P), hg = E.hg(P);
    const xt = (v - vf) / (vg - vf);
    return hf + xt * (hg - hf) - P * 1e5 * v - U / M;
  };
  // encadrement autour de la pression précédente, puis fausse position / dichotomie (toujours convergent)
  let a = clamp(P0 - 6, 1, 219), b = clamp(P0 + 6, 1, 219), fa = f(a), fb = f(b);
  if (fa > 0 || fb < 0) { a = 1; b = 219; fa = f(a); fb = f(b); }
  if (fa >= 0) b = a; else if (fb <= 0) a = b;
  else for (let k = 0; k < 40 && b - a > 1e-4; k++) {
    let c = k % 2 ? (a + b) / 2 : a - fa * (b - a) / (fb - fa);
    const fc = f(c);
    if (fc > 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  b = (a + b) / 2;
  const vf = E.vf(b), vg = E.vg(b);
  const xt = (v - vf) / (vg - vf);
  return { P: b, x: xt, Vliq: clamp((1 - xt) * M * vf, 0, V) };
}
function initPzr(s, K, P, niveau) {
  const V = K.G.V_pzr, Vl = V * niveau / 100;
  const Ml = Vl / E.vf(P), Mv = (V - Vl) / E.vg(P);
  s.Mpz = Ml + Mv;
  s.Upz = Ml * E.hf(P) + Mv * E.hg(P) - P * 1e5 * V;
  s.P = P; s.dPne = 0; s.Vliq = Vl; s.defE = 0; s.Vvide = 0;
}

function pasPressuriseur(s, u, dt, K, x) {
  const G = K.G, o = s.out, V = G.V_pzr;
  const Tchaud = Math.max(s.Ts, s.Tps);
  const PsatChaud = E.Psat(Tchaud);
  const niv = 100 * s.Vliq / V;
  // --- régulation : chaufferettes et aspersion ---
  let Qch, masp;
  const fPompe = Math.min(1, Math.max(...s.bcl.map(b => b.w)));
  if (u.pzrAuto) {
    Qch = clamp(C.pertes_pzr + C.gain_chauf * (u.Pconsigne - s.P), 0, G.Q_chauf);
    masp = clamp(C.gain_asp * (s.P - u.Pconsigne - C.seuil_asp), 0, G.m_asp) * fPompe;
  } else {
    Qch = u.chauf ? G.Q_chauf : 0;
    masp = clamp(u.asp, 0, 1) * G.m_asp * fPompe;
  }
  if (niv < 14 || !s.elec && !s.diesel) Qch = 0;
  // --- soupape ---
  if (!s.soupape && s.P > C.P_soup_ouv) { s.soupape = true; REP.evt(s, 'Ouverture d\'une soupape du pressuriseur', 'alarme'); }
  if (s.soupape && s.P < C.P_soup_ferm && !s.soupapeBloquee && !u.soupapeOuv) { s.soupape = false; REP.evt(s, 'Fermeture de la soupape du pressuriseur'); }
  if (u.soupapeOuv && !s.soupape) { s.soupape = true; REP.evt(s, 'Ouverture manuelle d\'une soupape du pressuriseur'); }
  const passante = s.soupape && !u.soupapeIsol;
  const msoup = passante ? C.m_soup * s.P / C.P_soup_ouv * (niv > 99 ? 3 : 1) : 0;    // plein : décharge d'eau
  // --- inventaire primaire ---
  s.Mprim += dt * (x.m_rcv + x.m_is - x.m_fuite - msoup);
  const Mliq = masseBoucles(s, K);
  const rhoPs = E.rho(s.Tps);
  const hl = E.hf(s.P), hv = E.hg(s.P);
  let Peq, Vliq;
  if (!s.pzrVide) {
    // --- vapeur dans la cuve si le primaire atteint la saturation (le pressuriseur contient encore de l'eau) ---
    s.Vvide = Math.max(0, s.Vvide + dt * 0.5 * (PsatChaud - s.P));
    const Mnew = s.Mprim - (Mliq - s.Vvide * rhoPs);
    if (Mnew <= V / E.vg(s.P - s.dPne) * 1.03) s.pzrVide = true;       // plus d'eau dans le pressuriseur
    else {
      // --- (32)(33) bilans de masse et d'énergie ---
      const exp = Mnew - (s.Mpz - msoup * dt);                         // débit d'expansion (30) × dt
      const h_bc = Math.min(E.hL(s.bcl[0].Tbc), hl);
      s.Upz += exp * hl;                                               // l'eau qui entre reste au fond (non mélangée)...
      s.defE = Math.max(0, s.defE + exp * (hl - h_bc));                // ...et ressort en premier
      const mel = s.defE * Math.min(1, dt / C.tau_melange_pzr);
      s.defE -= mel;
      s.Upz += -mel + dt * (Qch - C.pertes_pzr - masp * (hl - E.hL(s.bcl[0].Tbf)) - msoup * (niv > 99 ? hl : hv));
      s.Mpz = Mnew;
      const r = etatPzr(s.Mpz, s.Upz, V, s.P - s.dPne);
      Peq = r.P; Vliq = r.Vliq;
      if (r.x < 0.002) Peq += (0.002 - r.x) * 4000;                    // pressuriseur plein d'eau : très raide
    }
  }
  if (s.pzrVide) {
    // Pressuriseur vide : le primaire est à la saturation de son point le plus chaud,
    // et l'eau qui manque est remplacée par de la vapeur en haut de la cuve.
    Peq = Math.max(PsatChaud, s.P - 4 * dt);
    const Mv = V / E.vg(Peq);
    const vv = (Mliq + Mv - s.Mprim) / rhoPs;
    s.dPne = 0; s.defE = 0;
    if (vv > 0) { s.Vvide = vv; Vliq = 0; s.Mpz = Mv; s.Upz = Mv * E.hg(Peq) - Peq * 1e5 * V; }
    else {                                                             // le primaire est de nouveau plein : le pressuriseur se remplit
      s.pzrVide = false; s.Vvide = 0;
      s.Mpz = s.Mprim - Mliq;
      const vf = E.vf(Peq), vg = E.vg(Peq);
      Vliq = clamp((s.Mpz - V / vg) / (1 / vf - 1 / vg), 0, V);
      s.Upz = Vliq / vf * E.hf(Peq) + (V - Vliq) / vg * E.hg(Peq) - Peq * 1e5 * V;
    }
  }
  // --- (31) terme transitoire : compression de la bulle avant retour à l'équilibre ---
  const Vv = Math.max(1.0, V - s.Vliq);
  s.dPne += C.gamma_vap * s.P * (Vliq - s.Vliq) / Vv;
  s.dPne = clamp(s.dPne / (1 + dt / C.tau_pzr), -12, 12);
  s.Vliq = Vliq;
  s.P = clamp(Math.max(Peq + s.dPne, 1), 1, 219);
  // --- découvrement du cœur ---
  o.decouvert = clamp((s.Vvide - K.V_haut) / (3 * K.V_coeur), 0, 1);
  o.nivCuve = 100 * (1 - clamp(s.Vvide / (K.V_haut + 3 * K.V_coeur), 0, 1));
  o.nivPzr = 100 * Vliq / V; o.Qch = Qch; o.masp = masp; o.msoup = msoup;
  o.Tsat1 = E.Tsat(s.P); o.marge = o.Tsat1 - Tchaud; o.ebullition = s.Vvide > 0.5;
}

/* ------------------------------------------------------------------
   SECONDAIRE : GV (bilan masse + énergie à saturation), collecteur vapeur,
   turbine, contournement (GCT), décharge atmosphère, soupapes, ARE, ASG
   ------------------------------------------------------------------ */
function pasSecondaire(s, u, dt, K) {
  const G = K.G, o = s.out, NB = K.NB;
  // --- collecteur : moyenne des GV dont la vanne vapeur (VIV) est ouverte ---
  let n = 0, Ph = 0;
  for (let i = 0; i < NB; i++) { const b = s.bcl[i]; b.Ps = E.Psat(b.Tsec); b.vivOuv = u.viv[i]; if (b.vivOuv) { n++; Ph += b.Ps; } }
  Ph = n ? Ph / n : 1;
  // --- turbine ---
  const T = s.turbine;
  let tvCible = 0;
  if (s.declTurb) { s.tv = Math.max(0, s.tv - dt * 2); s.Nturb = Math.max(0, s.Nturb - dt * (2 + s.Nturb / 150)); }
  else if (T === 'lancement' || T === 'prete') {
    tvCible = C.turb_vide * G.p2 / Math.max(Ph, 10) * (T === 'lancement' ? 1.6 : 1);
    s.tv += clamp(tvCible - s.tv, -dt * 0.05, dt * 0.01);
    if (T === 'lancement') {
      if (Ph > 30 && n) s.Nturb = Math.min(1500, s.Nturb + dt * 1500 / 60);
      if (s.Nturb >= 1500) { s.turbine = 'prete'; REP.evt(s, 'Turbine à 1500 tr/min : prête à être couplée au réseau'); }
    }
  } else if (T === 'ilotee') {
    tvCible = (C.turb_vide + C.ilotage) * G.p2 / Math.max(Ph, 10);
    s.tv += clamp(tvCible - s.tv, -dt * 0.4, dt * 0.01);
  } else if (T === 'couplee') {
    // régulateur de charge : l'admission compense la pression vapeur pour tenir la consigne de puissance
    s.charge += clamp(clamp(u.turb, 0, 1) - s.charge, -dt * C.turb_vitesse, dt * C.turb_vitesse);
    tvCible = clamp((C.turb_vide + s.charge * (1 - C.turb_vide)) * G.p2 / Math.max(Ph, 10), 0, 1.08);
    s.tv += clamp(tvCible - s.tv, -dt * 0.05, dt * 0.05);
  } else s.tv = 0;
  if (T !== 'couplee') s.charge = T === 'ilotee' ? C.ilotage : 0;
  const W_turb = n ? s.tv * K.k_turb * Ph : 0;
  // --- contournement turbine vers le condenseur (GCT-c) ---
  let gct = 0;
  if (s.condenseur && n) {
    gct = clamp(C.gct_gain * (Ph - u.gctConsigne), 0, 1);                           // mode pression
    if (T === 'couplee' || T === 'ilotee') gct = Math.max(gct, clamp((o.Tmoy - o.Tref - 4) / 8, 0, 1));   // mode température (îlotage, baisse rapide)
  }
  s.gct += clamp(gct - s.gct, -dt * 0.5, dt * 0.5);
  const capGct = C.gct_cap * (s.aar ? C.gct_cap_arret : 1);                         // réacteur arrêté : un seul groupe de vannes
  const W_gct = s.gct * capGct * K.W_vap * Ph / G.p2_zero;
  const W_dem = W_turb + W_gct;
  // --- chaque GV ---
  let rejet = 0, W_ae_tot = 0, W_asg_tot = 0, W_atm = 0;
  for (let i = 0; i < NB; i++) {
    const b = s.bcl[i];
    const Ps = b.Ps;
    const hf = E.hf(Ps), hg = E.hg(Ps);
    let W_col = b.vivOuv ? Math.max(0, W_dem / n + C.K_coll * K.W_vap * (Ps - Ph)) : 0;
    // décharge à l'atmosphère (GCT-a) : automatique à 76 bar, ou manuelle
    // sans condenseur, la consigne GCT de l'opérateur s'applique aux GV non isolés
    const pGcta = G.p2_zero + C.gcta_marge, pSoup = G.p2_zero + C.soup_gv_marge;
    const consA = (!s.condenseur && b.vivOuv) ? Math.min(u.gctConsigne, pGcta) : pGcta;
    let oa = clamp((Ps - consA) / C.gcta_bande, 0, 1);
    if (b.gctaBloquee) oa = 1;
    b.gcta += clamp(oa - b.gcta, -dt * 0.5, dt * 0.5);
    const W_a = b.gcta * C.gcta_cap * K.W_vap * Ps / pGcta;
    const W_s = clamp((Ps - pSoup) / C.soup_gv_bande, 0, 1) * C.soup_gv_cap * K.W_vap;
    const W_br = (b.brecheVap || 0) * K.W_vap * Ps / G.p2;
    let W_out = W_col + W_a + W_s + W_br;
    // --- eau alimentaire normale (ARE) ---
    const niv = 50 + (b.Ms - G.M_gv) / G.M_gv_plage * 100;
    const areDispo = s.are && u.alim[i];
    let cmd = 0;
    if (areDispo) {
      cmd = u.aeAuto ? clamp(b.Wvap + C.ae_gain * K.m_vap0 * (50 - niv) * 3, 0, C.ae_max * K.m_vap0)
                     : clamp(u.ae, 0, C.ae_max) * K.m_vap0;
    }
    b.Wae += (cmd - b.Wae) * Math.min(1, dt / C.ae_tau);
    // --- alimentation de secours (ASG) ---
    const asgPossible = s.asgDispo && u.alim[i];
    if (u.asg === 'marche') b.asg = asgPossible && (b.asg ? niv < 62 : niv < 52);
    else if (u.asg === 'arret') b.asg = false;
    else {
      if (!b.asg && asgPossible && !s.asgAutoHS && (niv < C.asg_marche || (s.signalASG && niv < C.asg_arret - 5))) { b.asg = true; if (!b.asgVu) { b.asgVu = true; REP.evt(s, 'ASG : alimentation de secours du GV' + (i + 1) + ' en service', 'info'); } }
      if (b.asg && (niv > C.asg_arret || !asgPossible)) b.asg = false;
    }
    const W_asg = b.asg ? C.asg_debit : 0;
    const W_f = b.fuite || 0;                       // fuite primaire -> secondaire (RTGV), calculée dans surete.js
    let fr = 1;                                     // GV à sec : il ne sort que ce qu'il reste
    if (W_out * dt > b.Ms) { fr = W_out > 0 ? b.Ms / dt / W_out : 0; W_out = b.Ms / dt; }
    // --- bilans : énergie (GV à saturation) et masse ---
    const Cgv = Math.max(b.Ms, 3000) * 5000 + G.C_gv_metal;
    const dE = b.Qgv - W_out * (hg - hf) - b.Wae * (hf - G.h_ae) - W_asg * (hf - C.h_asg) + W_f * (E.hL(Math.min(b.Tgv, 340)) - hf);
    b.Tsec = clamp(b.Tsec + dt * dE / Cgv, 100, 372);
    b.Ms = Math.max(0, b.Ms + dt * (b.Wae + W_asg + W_f - W_out));
    // GV plein : l'eau déborde dans la ligne vapeur et sort par les soupapes (rejet liquide)
    let W_deb = 0;
    if (b.Ms > G.M_gv_plein) {
      W_deb = (b.Ms - G.M_gv_plein) / dt; b.Ms = G.M_gv_plein;
      if (!b.plein) { b.plein = true; REP.evt(s, 'GV' + (i + 1) + ' PLEIN D\'EAU : débordement par les soupapes, rejet liquide à l\'atmosphère', 'alarme'); }
    } else if (b.Ms < 0.97 * G.M_gv_plein) b.plein = false;
    b.Wvap = W_out; b.Wcol = W_col * fr; b.Watm = (W_a + W_s + W_br) * fr + W_deb; b.niv = Math.max(0, 50 + (b.Ms - G.M_gv) / G.M_gv_plage * 100);
    b.soupGV = W_s > 0;
    // --- radioactivité côté secondaire ---
    b.Mfuite += Math.max(0, W_f) * dt;             // eau primaire entrée dans le GV (on ne décompte pas un retour vers le primaire)
    b.act = 1 + 400 * b.Mfuite / Math.max(b.Ms, 5000);
    rejet += ((W_a + W_s + W_br) * fr + W_deb) * Math.min(1, b.Mfuite / Math.max(b.Ms, 5000));   // part d'eau primaire dans ce qui sort
    W_ae_tot += b.Wae; W_asg_tot += W_asg; W_atm += b.Watm;
  }
  s.rejets += rejet * dt;                                          // kg d'eau primaire relâchés à l'atmosphère
  // --- alternateur ---
  let PeC = 0;
  if (T === 'couplee' || T === 'ilotee') PeC = G.P_e * clamp((W_turb / K.W_vap - C.turb_vide) / (1 - C.turb_vide), 0, 1.2);
  if (s.declTurb) PeC = 0;
  s.Pe += (PeC - s.Pe) * Math.min(1, dt / C.Pe_tau);
  s.energie += s.Pe * dt / 3.6e9;                                  // MWh
  o.Ph = Ph; o.nViv = n; o.W_turb = W_turb; o.W_gct = W_gct; o.W_atm = W_atm; o.W_ae = W_ae_tot; o.W_asg = W_asg_tot;
  o.Qcond = (W_turb + W_gct) * 1.9e6 - s.Pe;                       // chaleur cédée à la mer (ordre de grandeur)
}

REP.thermo = { calibrer, profilRadial, niveauProgramme, TmoyReference, masseBoucles, pasPrimaire, crayon, initPzr, etatPzr, pasPressuriseur, pasSecondaire };
})(typeof window !== 'undefined' ? window : globalThis);
