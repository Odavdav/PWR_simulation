/* ======== neutronique.js ======== */
/* =====================================================================
   neutronique.js — LOT 1 : NEUTRONIQUE DU CŒUR
   ---------------------------------------------------------------------
   Fiche « Neutronique du cœur » :
     (1)      dn/dt  = ((ρ − β)/Λ)·n + Σ λi·Ci
     (2 à 7)  dCi/dt = (βi/Λ)·n − λi·Ci
     (B3)     f(x) = x − sin(2πx)/(2π)          efficacité intégrale normalisée
     (B4)     ρ_barres = −W·(f(x) − f(x0))
   Fiche thermo (35) : ρ = ρ_barres + αD·(Tc − Tc0) + αM·(Tm − Tm0) + αB·(CB − CB0)
   Ajouts : xénon 135, puissance résiduelle, source de démarrage.
   Aucune dépendance à l'interface.
   ===================================================================== */
(function (root) {
'use strict';
const REP = root.REP = root.REP || {};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* (B3) Efficacité intégrale normalisée, x = fraction d'insertion (0 = extraites, 1 = insérées) */
function fBarres(x) {
  x = clamp(x, 0, 1);
  return x - Math.sin(2 * Math.PI * x) / (2 * Math.PI);
}

/* Bilan de réactivité en pcm. ref = état de référence critique à 100 % */
function reactivite(s, C, ref) {
  const r = {
    barresR: -C.W_R * (fBarres(s.xR) - fBarres(C.xR0)),            // (B4)
    barresS: -C.W_S * fBarres(s.xS),
    doppler: C.alpha_D * (s.Tc - ref.Tc0),                          // (35)
    moderateur: ref.alpha_M * (s.Tm - ref.Tm0),
    bore: C.alpha_B * (s.bore - ref.bore0),
    xenon: C.rho_Xe * (s.xe - 1),
    incident: s.rhoExt || 0,
  };
  r.total = r.barresR + r.barresS + r.doppler + r.moderateur + r.bore + r.xenon + r.incident;
  return r;
}

/* (1) à (7) : cinétique ponctuelle, schéma d'Euler implicite (le système est raide car Λ ≈ 20 µs).
   s.n : population neutronique normalisée (1 = 100 %), s.Cn[i] : précurseurs.
   rho_pcm : réactivité totale. Renvoie le taux de démarrage en décades par minute. */
function pasCinetique(s, rho_pcm, dt, C, ref) {
  const r = rho_pcm * 1e-5, L = C.Lambda, bi = ref.beta_i, b = ref.beta, li = C.lambda_i;
  const n0 = s.n;
  let nsub = 1;
  if (r - b > 0) nsub = Math.min(500, Math.ceil(dt * (r - b) / L / 0.3));   // sur-criticité prompte : sous-pas
  const h = dt / nsub;
  for (let k = 0; k < nsub; k++) {
    let num = s.n + h * C.source, den = 1 - h * (r - b) / L;
    for (let i = 0; i < 6; i++) {
      const f = 1 / (1 + h * li[i]);
      num += h * li[i] * s.Cn[i] * f;
      den -= h * h * li[i] * bi[i] / L * f;
    }
    s.n = clamp(num / den, 1e-12, 1e3);
    for (let i = 0; i < 6; i++) s.Cn[i] = (s.Cn[i] + h * bi[i] / L * s.n) / (1 + h * li[i]);
  }
  return 60 * (Math.log10(s.n) - Math.log10(n0)) / dt;
}

/* Précurseurs à l'équilibre pour une population n */
function precurseursEquilibre(n, C, ref) {
  return ref.beta_i.map((b, i) => b * n / (C.lambda_i[i] * C.Lambda));
}

/* Puissance résiduelle : s.res[j] suit a_j·n avec la constante de temps tau_j.
   Renvoie la puissance totale en fraction de la puissance nominale ((36) : P = P0·n + P_résiduelle). */
function pasPuissance(s, dt, C) {
  let somme = 0, sa = 0;
  for (let j = 0; j < C.res_a.length; j++) {
    const a = dt / C.res_tau[j];
    s.res[j] = (s.res[j] + a * C.res_a[j] * s.n) / (1 + a);
    somme += s.res[j]; sa += C.res_a[j];
  }
  s.qRes = somme;
  return s.n * (1 - sa) + somme;
}

/* Iode 135 et xénon 135, normalisés à 1 à l'équilibre à 100 %.
   dI/dt = λI·(n − I)
   dX/dt = (λX + σφ)·(γX·n + γI·I)/(γI + γX) − (λX + σφ·n)·X                     */
function pasXenon(s, dt, C) {
  const n = Math.min(s.n, 2);
  s.iode += dt * C.lambda_I * (n - s.iode);
  const prod = (C.lambda_X + C.sigphi_X) * (C.gamma_X * n + C.gamma_I * s.iode) / (C.gamma_I + C.gamma_X);
  const k = C.lambda_X + C.sigphi_X * n;
  s.xe = (s.xe + dt * prod) / (1 + dt * k);
}
/* Xénon d'équilibre à la puissance n */
function xenonEquilibre(n, C) {
  return (C.lambda_X + C.sigphi_X) * n / (C.lambda_X + C.sigphi_X * n);
}

REP.neutronique = { fBarres, reactivite, pasCinetique, precurseursEquilibre, pasPuissance, pasXenon, xenonEquilibre };
})(typeof window !== 'undefined' ? window : globalThis);
