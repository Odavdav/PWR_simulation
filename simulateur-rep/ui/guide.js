/* ======== ui/guide.js ======== */
/* =====================================================================
   ui/guide.js — moteur de guidage pas à pas (tutoriel, missions, accidents)
   ---------------------------------------------------------------------
   Guide.lancer({ titre, alerte, etapes: [...], onFin })
   Une étape :
     { cible: '#selecteur' | sim => '#selecteur',   élément mis en évidence (facultatif)
       titre, texte: 'html' | sim => 'html',
       attend: sim => bool,   si présent : étape d'ACTION, le temps tourne et on avance quand c'est vrai
       afaire: 'consigne',    texte de la consigne pour une étape d'action
       gel: bool,             fige le temps (par défaut : oui pour une explication, non pour une action)
       fais: sim => {},       réalise l'action à la place du joueur (bouton « le faire à ma place »)
       dynamique: bool,       texte recalculé en continu (valeurs en direct)
       avant: sim => {},      exécuté à l'entrée dans l'étape
       si: sim => bool,       étape sautée si faux
       garde: bool }          en affichage simplifié, garder l'explication même si sa cible est cachée
   ===================================================================== */
(function (root) {
'use strict';
const G = root.Guide = { def: null, i: 0, fait: false };
const $ = id => document.getElementById(id);
const val = (x, sim) => typeof x === 'function' ? x(sim) : x;

G.actif = () => !!G.def;
G.gele = () => { if (!G.def) return false; const e = G.def.etapes[G.i]; return e.gel != null ? e.gel : !e.attend; };

const saute = (e, sim) => !!((e.si && !e.si(sim)) || (!e.attend && !e.garde && e.cible && root.App.cache && root.App.cache(val(e.cible, sim))));
G.lancer = function (def) {
  if (G.def) G.fermer(false);
  G.def = def; G.i = -1; G.fait = false;
  $('g-bulle').classList.toggle('alerte', !!def.alerte);
  $('g-bulle').classList.toggle('large', !!def.large);          // bulle plus large pour les textes longs avec schémas (cours)
  G.aller(1);
};
G.aller = function (sens) {
  if (!G.def) return;
  const sim = root.App.sim, E = G.def.etapes;
  let i = G.i + sens;
  // étape sautée si sa condition `si` est fausse, ou (affichage simplifié) si c'est une explication portant sur un élément supprimé de l'écran
  while (i >= 0 && i < E.length && saute(E[i], sim)) i += sens;
  if (i >= E.length) return G.fermer(true);
  if (i < 0) return;
  G.i = i; G.fait = false; clearTimeout(G.minuterie);
  const e = E[i];
  if (e.avant) e.avant(sim);
  G.rendre();
};
G.fermer = function (termine) {
  const def = G.def; G.def = null; clearTimeout(G.minuterie);
  for (const id of ['g-voile', 'g-trou', 'g-fleche', 'g-bulle', 'g-gel']) $(id).style.display = 'none';
  if (def && def.onFin) def.onFin(termine);
};

function cibles(e, sim) {
  const c = val(e.cible, sim);
  if (!c) return [];
  const els = [...document.querySelectorAll(c)];
  if (e.attend && root.App && root.App.reveler) els.forEach(root.App.reveler);   // affichage simplifié : une commande cachée n'apparaît que si une action l'exige
  return els.filter(x => x.getBoundingClientRect().width > 0);
}
function boite(els) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const el of els) { const r = el.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

G.rendre = function () {
  if (!G.def) return;
  const sim = root.App.sim, e = G.def.etapes[G.i], action = !!e.attend;
  const vues = G.def.etapes.map((x, k) => k === G.i || !saute(x, sim)), n = vues.filter(Boolean).length, rang = vues.slice(0, G.i + 1).filter(Boolean).length;   // numérotation sans les étapes sautées
  const bulle = $('g-bulle'), trou = $('g-trou'), fleche = $('g-fleche'), voile = $('g-voile');
  const els = cibles(e, sim);
  if (els[0] && els[0].scrollIntoView && els[0].closest('#commandes')) els[0].scrollIntoView({ block: 'nearest' });
  let pts = '';
  if (n > 24) pts = `<span class="prog"><b style="width:${Math.round(100 * rang / n)}%"></b></span>`;      // guidage long (cours) : barre de progression
  else for (let k = 0; k < n; k++) pts += `<i class="${k < rang ? 'fait' : ''}"></i>`;
  bulle.innerHTML = `<div class="entete"><span>${G.def.titre}</span><span>${rang} / ${n}</span></div>
    <h2>${val(e.titre, sim)}</h2><div class="corps">${val(e.texte, sim)}</div>
    ${action ? `<div class="afaire" id="g-afaire"><span>👉</span><span>${val(e.afaire, sim) || 'À vous de jouer.'}</span></div>` : ''}
    <div class="actions"><div class="pts">${pts}</div>
      ${rang > 1 ? '<button class="bt" id="g-prec">◀</button>' : ''}
      ${action ? (e.fais ? '<button class="lien" id="g-fais">le faire à ma place</button>' : '<button class="lien" id="g-saut">passer cette étape</button>') : `<button class="bt accent" id="g-suiv">${rang === n ? 'Terminer' : 'Suivant ▶'}</button>`}
    </div><div style="margin-top:7px;text-align:right"><button class="lien" id="g-quit">quitter le guidage</button></div>`;
  const b = id => document.getElementById(id);
  if (b('g-prec')) b('g-prec').onclick = () => G.aller(-1);
  if (b('g-suiv')) b('g-suiv').onclick = () => G.aller(1);
  if (b('g-saut')) b('g-saut').onclick = () => G.aller(1);
  if (b('g-fais')) b('g-fais').onclick = () => { e.fais(sim); };
  b('g-quit').onclick = () => G.fermer(false);
  bulle.style.display = 'block';
  voile.style.display = 'block'; voile.className = action ? 'libre' : 'bloque';
  $('g-gel').style.display = G.gele() ? 'block' : 'none';
  G.placer();
};

/* place le projecteur, la flèche et la bulle (appelé aussi au redimensionnement) */
G.placer = function () {
  if (!G.def) return;
  const sim = root.App.sim, e = G.def.etapes[G.i], action = !!e.attend;
  const bulle = $('g-bulle'), trou = $('g-trou'), fleche = $('g-fleche');
  const els = cibles(e, sim), W = innerWidth, H = innerHeight, bw = bulle.offsetWidth, bh = bulle.offsetHeight;
  if (!els.length) {
    trou.style.display = 'block'; trou.className = '';
    Object.assign(trou.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px', borderColor: 'transparent' });
    fleche.style.display = 'none';
    bulle.style.left = (W - bw) / 2 + 'px'; bulle.style.top = Math.max(60, (H - bh) / 2) + 'px';
    return;
  }
  const r = boite(els), m = 6;
  trou.style.display = 'block'; trou.className = action ? 'action' : ''; trou.style.borderColor = '';
  Object.assign(trou.style, { left: r.x - m + 'px', top: r.y - m + 'px', width: r.w + 2 * m + 'px', height: r.h + 2 * m + 'px' });
  // bulle : à droite, à gauche, dessous ou dessus selon la place
  const e2 = 46;
  let x, y, cote;
  if (r.x + r.w + e2 + bw < W) { cote = 'd'; x = r.x + r.w + e2; y = r.y + r.h / 2 - bh / 2; }
  else if (r.x - e2 - bw > 0) { cote = 'g'; x = r.x - e2 - bw; y = r.y + r.h / 2 - bh / 2; }
  else if (r.y + r.h + e2 + bh < H) { cote = 'b'; x = r.x + r.w / 2 - bw / 2; y = r.y + r.h + e2; }
  else if (r.y - e2 - bh > 0) { cote = 'h'; x = r.x + r.w / 2 - bw / 2; y = r.y - e2 - bh; }
  else { cote = 'c'; x = W - bw - 16; y = H - bh - 16; }
  x = Math.max(8, Math.min(W - bw - 8, x)); y = Math.max(8, Math.min(H - bh - 8, y));
  bulle.style.left = x + 'px'; bulle.style.top = y + 'px';
  // flèche animée qui pointe la cible
  const F = { d: ['◀', r.x + r.w + 8, r.y + r.h / 2 - 22, '8px', '0'], g: ['▶', r.x - 40, r.y + r.h / 2 - 22, '-8px', '0'], b: ['▲', r.x + r.w / 2 - 15, r.y + r.h + 4, '0', '8px'], h: ['▼', r.x + r.w / 2 - 15, r.y - 44, '0', '-8px'], c: ['▼', r.x + r.w / 2 - 15, r.y - 44, '0', '-8px'] }[cote];
  fleche.style.display = 'block'; fleche.firstChild.textContent = F[0];
  fleche.style.left = F[1] + 'px'; fleche.style.top = F[2] + 'px';
  fleche.style.setProperty('--dx', F[3]); fleche.style.setProperty('--dy', F[4]);
  fleche.style.color = action ? 'var(--alerte)' : 'var(--accent)';
};

/* appelé à chaque image : fait avancer les étapes d'action quand leur condition est remplie */
G.tic = function (sim) {
  if (!G.def) return;
  const e = G.def.etapes[G.i];
  if (e.attend && !G.fait && e.attend(sim)) {
    G.fait = true;
    const a = document.getElementById('g-afaire');
    if (a) { a.classList.add('fait'); a.firstChild.textContent = '✔'; }
    G.minuterie = setTimeout(() => G.aller(1), 900);
  }
  if (e.dynamique && !G.fait) {           // texte recalculé en continu (valeurs en direct)
    const c = document.querySelector('#g-bulle .corps'); if (c) c.innerHTML = val(e.texte, sim);
  }
};
addEventListener('resize', () => G.placer());
})(window);
