/* ======== params.js ======== */
/* =====================================================================
   params.js — DONNÉES DE RÉFÉRENCE DU SIMULATEUR
   ---------------------------------------------------------------------
   Toutes les valeurs modifiables par l'équipe sont ici. Les numéros
   (H..), (8), (25)... renvoient aux hypothèses et équations des fiches
   « Neutronique du cœur » et « Thermohydraulique du circuit primaire ».
   Les valeurs « à vérifier » sont celles surlignées en jaune dans les fiches.

   REP.PALIERS  : données propres à chaque palier (900 MWe / 1300 MWe)
   REP.COMMUN   : données communes (neutronique, régulations, seuils)
   REP.CYCLES   : avancement du cycle combustible (début / milieu / fin)
   Unités SI sauf mention contraire (bar, °C, pcm, ppm).
   ===================================================================== */
(function (root) {
'use strict';
const REP = root.REP = root.REP || {};

REP.PALIERS = {
  /* ---------------- REP 900 MWe, 3 boucles (CP0/CPY) : fiche thermo ---------------- */
  900: {
    nom: 'REP 900 MWe (3 boucles)',
    NB: 3,                    // nombre de boucles (H13 levée : boucles calculées séparément)
    P_th: 2785e6,             // W   puissance thermique du cœur
    P_e: 900e6,               // W   puissance électrique
    P_pompe: 4.0e6,           // W   chaleur apportée par UNE pompe primaire
    p1: 155,                  // bar pression primaire
    T_e: 286.0, T_s: 323.0,   // °C  entrée / sortie cœur à 100 %
    f_by: 0.045,              //     débit de contournement (bypass) du cœur
    f_comb: 0.974,            //     part de puissance déposée dans le combustible (H18)
    // Cœur (tableau 2.1)
    N_ass: 157, N_cr: 264, H: 3.66,
    D_ext: 9.50e-3, e_g: 0.57e-3, D_p: 8.19e-3, pas: 12.6e-3, pas_ass: 0.215, N_tg: 25, D_tg: 12.24e-3,
    k_UO2: 3.0, k_Zr: 16.0, h_gap: 6000, rho_UO2: 10400, cp_UO2: 300, cp_Zr: 330, rho_Zr: 6550,
    F_Q: 2.3,                 //     facteur de point chaud (H19)
    // Eau à T moyenne du cœur, 155 bar (IAPWS) : pour Dittus-Boelter (21)
    mu: 8.675e-5, k_eau: 0.5567, Pr: 0.8689, beta_dil: 3.013e-3,
    // Volumes des nœuds (m3), tableau « Découpage en nœuds »
    V_plenum_sup: 40.0, V_descente: 95.0,
    tuy: { bc: [0.7366, 6.2], bu: [0.7874, 9.0], bf: [0.6985, 6.5] },   // [D int (m), L (m)] par boucle
    V_volute: 1.5, V_boite_eau: 4.0,
    // Générateur de vapeur 51B
    N_tub: 3330, D_tub: 22.22e-3, e_tub: 1.27e-3, A_gv: 4746,
    p2: 58,                   // bar pression vapeur à 100 %
    p2_zero: 70,              // bar pression vapeur à puissance nulle (≈ Psat(286 °C))
    h_ae: 944.8e3,            // J/kg eau alimentaire à 220 °C
    M_gv: 44000,              // kg  eau secondaire par GV à 100 % (niveau 50 %)
    M_gv_plage: 38000,        // kg  entre 0 et 100 % de niveau (gamme étroite)
    M_gv_plein: 78000,        // kg  GV plein : l'eau atteint les lignes vapeur
    M_gv_decouv: 20000,       // kg  en dessous, les tubes se découvrent (échange dégradé)
    C_gv_metal: 5e7,          // J/K inertie de l'acier du GV
    // Pompe primaire (14) à (17)
    N_rpm: 1485, H_pompe: 90.7, eta_p: 0.80, J_pompe: 3300,
    // Pressuriseur (2.4)
    V_pzr: 39.7, niv_pzr_100: 60, niv_pzr_0: 25, D_pzr: 2.13,
    Q_chauf: 1.44e6,          // W   chaufferettes
    m_asp: 30,                // kg/s aspersion maximale
    dZ_nc: 10.0,              // m   dénivelé GV / cœur (circulation naturelle, (18))
  },
  /* ---------------- REP 1300 MWe, 4 boucles (P4/P'4) : fiche thermo 1300 ---------------- */
  1300: {
    nom: 'REP 1300 MWe (4 boucles)',
    NB: 4,
    P_th: 3817e6, P_e: 1300e6, P_pompe: 6.0e6,
    p1: 155, T_e: 292.8, T_s: 328.4, f_by: 0.045, f_comb: 0.974,
    N_ass: 193, N_cr: 264, H: 4.27,
    D_ext: 9.50e-3, e_g: 0.57e-3, D_p: 8.19e-3, pas: 12.6e-3, pas_ass: 0.215, N_tg: 25, D_tg: 12.24e-3,
    k_UO2: 3.0, k_Zr: 16.0, h_gap: 6000, rho_UO2: 10400, cp_UO2: 300, cp_Zr: 330, rho_Zr: 6550,
    F_Q: 2.3,
    mu: 8.431e-5, k_eau: 0.5464, Pr: 0.8894, beta_dil: 3.294e-3,
    V_plenum_sup: 57.0, V_descente: 133.0,
    tuy: { bc: [0.7366, 6.2], bu: [0.7874, 9.0], bf: [0.6985, 6.5] },
    V_volute: 1.5, V_boite_eau: 4.0,
    N_tub: 5342, D_tub: 19.05e-3, e_tub: 1.09e-3, A_gv: 6940,
    p2: 64.5, p2_zero: 77,
    h_ae: 988.8e3,
    M_gv: 55000, M_gv_plage: 46000, M_gv_plein: 96000, M_gv_decouv: 25000, C_gv_metal: 7e7,
    N_rpm: 1485, H_pompe: 97.0, eta_p: 0.80, J_pompe: 3900,
    V_pzr: 59.5, niv_pzr_100: 60, niv_pzr_0: 25, D_pzr: 2.50,
    Q_chauf: 2.16e6, m_asp: 42,
    dZ_nc: 11.0,
  },
};

REP.COMMUN = {
  // ---------- Cinétique ponctuelle, 6 groupes (fiche neutronique 1.2, éq. (1) à (7)) ----------
  Lambda: 2.0e-5,            // s   temps moyen de génération
  beta_i:   [0.000215, 0.001424, 0.001274, 0.002568, 0.000748, 0.000273],   // Keepin, U-235
  lambda_i: [0.0124,   0.0305,   0.111,    0.301,    1.14,     3.01],       // 1/s
  source: 2.5e-4,            // source de démarrage (fraction de P_nom par s) : ÉCART à H6, nécessaire pour diverger

  // ---------- Barres (fiche neutronique 1.3, éq. (B1) à (B5)) ----------
  pas_max: 225,              // course des grappes en pas
  W_R: 2500,                 // pcm efficacité intégrale du groupe de régulation R (commande)
  W_S: 4000,                 // pcm efficacité des barres d'arrêt S
  xR0: 25 / 225,             // insertion de référence du groupe R à 100 % (x0 de (B4))
  v_R: 72 / 60,              // pas/s : vitesse max du groupe R (H11 levée)
  v_S: 4,                    // pas/s
  t_chute: 2.0,              // s   chute des grappes à l'AAR

  // ---------- Contre-réactions (éq. (35)) ----------
  alpha_D: -2.5,             // pcm/°C Doppler (sur T moyenne combustible)
  alpha_B: -10,              // pcm/ppm bore
  v_bore: 10 / 60,           // ppm/s vitesse max de borication / dilution (RCV)
  bore_IS: 2500,             // ppm eau borée de l'injection de sécurité

  // ---------- Xénon 135 / iode 135 (au-delà des fiches : variations de charge longues) ----------
  gamma_I: 0.0639, gamma_X: 0.0025,
  lambda_I: 2.87e-5,         // 1/s (période 6,7 h)
  lambda_X: 2.09e-5,         // 1/s (période 9,2 h)
  sigphi_X: 7.0e-5,          // 1/s  σ_Xe·φ à 100 % (destruction par capture)
  rho_Xe: -2800,             // pcm  antiréactivité du xénon à l'équilibre à 100 %

  // ---------- Puissance résiduelle : 8 groupes ajustés sur la loi de Way-Wigner ----------
  res_a:   [0.0407, 0.0112, 0.0144, 0.0103, 0.0051, 0.0064, 0.0006, 0.0053],
  res_tau: [1, 5, 30, 200, 1500, 1e4, 8e4, 8e5],     // s

  // ---------- Thermique ----------
  T_fusion: 2840,            // °C fusion UO2
  T_gaine_max: 1204,         // °C critère de tenue de la gaine
  H0_sur_H: 1.25,            // hauteur de pompe à débit nul / nominale (14)
  REC_nom: 2.1,              // rapport d'échauffement critique à 100 % (indicateur simplifié)

  // ---------- Pressuriseur ----------
  gamma_vap: 1.3,            // exposant du modèle 1 (31)
  tau_pzr: 4,                // s  retour à l'équilibre liquide-vapeur (modèle 2)
  tau_melange_pzr: 120,      // s  mélange de l'eau entrée par la ligne d'expansion
  gain_chauf: 1.0e6,         // W/bar
  pertes_pzr: 0.15e6,        // W
  gain_asp: 12,              // kg/s par bar au-dessus du seuil
  seuil_asp: 1.0,            // bar au-dessus de la consigne
  P_soup_ouv: 166, P_soup_ferm: 160, m_soup: 45,   // soupape : bar, bar, kg/s de vapeur à 166 bar
  rcv_gain: 2.0, rcv_min: -6, rcv_max: 8,          // RCV : kg/s par % d'écart de niveau

  // ---------- Secondaire ----------
  ae_gain: 0.02,             // régulation ARE : fraction du débit nominal par % d'écart de niveau
  ae_max: 1.25, ae_tau: 3,
  asg_debit: 35,             // kg/s par GV
  asg_marche: 30, asg_arret: 50,     // % niveau GV
  h_asg: 126e3,              // J/kg eau ASG à 30 °C
  turb_vitesse: 0.005,       // /s vitesse max de variation de charge (30 %/min)
  turb_vide: 0.03,           // débit vapeur à vide (turbine à 1500 tr/min non couplée)
  ilotage: 0.05,             // charge d'îlotage (auxiliaires de la tranche)
  palier_ilotage: 0.30,      // -    puissance réacteur visée pendant l'îlotage (fraction de Pn)
  Pe_tau: 3,
  gct_gain: 0.25, gct_cap: 0.85, gct_cap_arret: 0.25,     // contournement au condenseur : /bar, fraction du débit nominal
  gcta_marge: 6, gcta_bande: 2, gcta_cap: 0.035,       // décharge à l'atmosphère, par GV : s'ouvre à p2_zero + 6 bar (76 bar sur le 900)
  soup_gv_marge: 13, soup_gv_bande: 3, soup_gv_cap: 0.4, // soupapes de sûreté GV, par GV : p2_zero + 13 bar (83 bar sur le 900)
  K_coll: 0.06,              // équilibrage des GV par le collecteur vapeur (fraction du débit nominal total par bar)

  // ---------- Sauvegarde et protections ----------
  IS_seuil: 121, IS_refoul: 178, IS_debit: 45, IS_T: 20,
  fuite_rtgv: 30,            // kg/s  un tube rompu, à ΔP nominal
  aar_flux: 1.09, aar_P_bas: 131, aar_P_haut: 165, aar_debit: 0.88, aar_niv_gv: 25, aar_REC: 1.15,
  aar_T_chaude: 12,          // °C au-dessus de la T branche chaude nominale
  // ---------- Pilotage automatique ----------
  reg_kp: 40, reg_kv: 0.4,   // régulation de Tmoy par le groupe R : poids de l'écart de puissance (°C par unité de Pn), gain de vitesse (pas/s par °C)
  bande_Tmoy: 0.8,           // °C bande morte de la régulation de température moyenne (groupe R)
};

/* Avancement du cycle : le bore baisse, le coefficient modérateur devient plus négatif, β diminue */
REP.CYCLES = {
  debut:  { nom: 'Début de cycle',  bore0: 1200, alpha_M: -15, f_beta: 1.00 },
  milieu: { nom: 'Milieu de cycle', bore0: 700,  alpha_M: -35, f_beta: 0.92 },
  fin:    { nom: 'Fin de cycle',    bore0: 80,   alpha_M: -60, f_beta: 0.85 },
};
})(typeof window !== 'undefined' ? window : globalThis);
