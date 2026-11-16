/* ======== ui/widgets.js ======== */
/* =====================================================================
   ui/widgets.js — cadrans à aiguille, curseurs verticaux, courbes
   ===================================================================== */
(function (root) {
'use strict';
const W = root.Widgets = {};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const NS = 'http://www.w3.org/2000/svg';
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------------- Cadran à aiguille ---------------- */
const A0 = -120, A1 = 120;                                   // angles extrêmes (degrés, 0 = haut)
function pol(cx, cy, r, deg) { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function arc(cx, cy, r, d0, d1) {
  const [x0, y0] = pol(cx, cy, r, d0), [x1, y1] = pol(cx, cy, r, d1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
W.cadran = function (hote, def) {
  const el = document.createElement('div');
  el.className = 'cadran'; el.id = 'cad-' + def.id;
  el.dataset.aide = def.nom + '|' + def.aide;
  const ang = v => A0 + (A1 - A0) * clamp((v - def.min) / (def.max - def.min), 0, 1);
  let zones = '';
  for (const [a, b, c] of def.zones || []) zones += `<path d="${arc(60, 58, 44, ang(a), ang(b))}" stroke="${c}" stroke-width="6" fill="none"/>`;
  let grad = '';
  for (let i = 0; i <= 10; i++) { const d = A0 + (A1 - A0) * i / 10, [x0, y0] = pol(60, 58, 38, d), [x1, y1] = pol(60, 58, i % 5 ? 35 : 32, d); grad += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#51677b" stroke-width="1"/>`; }
  el.innerHTML = `<svg viewBox="0 0 120 92"><path d="${arc(60, 58, 44, A0, A1)}" stroke="#263442" stroke-width="6" fill="none" stroke-linecap="round"/>${zones}${grad}
    <g class="ref" style="display:none"><path d="M60 9l-4 -7h8z" fill="#b08cff"/></g>
    <g class="aig" style="transition:transform .25s linear;transform-origin:60px 58px"><line x1="60" y1="62" x2="60" y2="20" stroke="#f4f8fb" stroke-width="2.4" stroke-linecap="round"/></g>
    <circle cx="60" cy="58" r="4.5" fill="#f4f8fb"/></svg><div class="val">–</div><div class="unite">${def.unite}</div><div class="nom">${def.nom}</div>`;
  hote.appendChild(el);
  const aig = el.querySelector('.aig'), val = el.querySelector('.val'), ref = el.querySelector('.ref');
  ref.style.transformOrigin = '60px 58px';
  let dernier = null;
  return {
    el,
    maj(v, r) {
      const t = def.fmt ? def.fmt(v) : v.toFixed(def.dec || 0);
      if (t !== dernier) { val.textContent = t; dernier = t; }
      aig.style.transform = `rotate(${ang(v).toFixed(1)}deg)`;
      let col = '';
      for (const [a, b, c] of def.zones || []) if (v >= a && v <= b) col = c;
      val.style.color = col || '';
      if (r != null) { ref.style.display = ''; ref.style.transform = `rotate(${ang(r).toFixed(1)}deg)`; }
    },
  };
};

/* ---------------- Curseur vertical ---------------- */
W.curseur = function (hote, def) {
  const el = document.createElement('div');
  el.className = 'vs'; el.id = 'sl-' + def.id; el.dataset.verrou = def.verrou || '';
  el.dataset.aide = def.titre + '|' + def.aide;
  el.innerHTML = `<div class="nom">${def.nom}</div><div class="rail"><div class="plein"></div><div class="reel"></div><div class="poignee"></div></div>
    <div class="v mono">–</div><div class="u">${def.unite}</div><div class="pm"><button data-d="-1">−</button><button data-d="1">+</button></div>`;
  hote.appendChild(el);
  const rail = el.querySelector('.rail'), plein = el.querySelector('.plein'), reel = el.querySelector('.reel'), poignee = el.querySelector('.poignee'), v = el.querySelector('.v');
  const frac = x => clamp((x - def.min()) / (def.max() - def.min()), 0, 1);
  const bloque = () => el.closest('.verrouille') || (def.auto && def.auto());
  function depuisY(e) {
    const r = rail.getBoundingClientRect();
    const f = clamp(1 - (e.clientY - r.top - 6) / (r.height - 12), 0, 1);
    const p = def.pas || 1;
    def.set(Math.round((def.min() + f * (def.max() - def.min())) / p) * p);
  }
  rail.addEventListener('pointerdown', e => { if (bloque()) return; rail.setPointerCapture(e.pointerId); depuisY(e); });
  rail.addEventListener('pointermove', e => { if (e.buttons && rail.hasPointerCapture(e.pointerId)) depuisY(e); });
  rail.addEventListener('wheel', e => { if (bloque()) return; e.preventDefault(); def.set(clamp(def.get() - Math.sign(e.deltaY) * (def.pas || 1), def.min(), def.max())); }, { passive: false });
  let rep = null;
  for (const b of el.querySelectorAll('.pm button')) {
    const f = () => { if (!bloque()) def.set(clamp(def.get() + (+b.dataset.d) * (def.pas || 1), def.min(), def.max())); };
    b.addEventListener('pointerdown', () => { f(); rep = setInterval(f, 90); });
    for (const ev of ['pointerup', 'pointerleave']) b.addEventListener(ev, () => clearInterval(rep));
  }
  return {
    el,
    maj() {
      const H = rail.clientHeight - 12, c = def.get(), f = frac(c);
      poignee.style.top = (6 + (1 - f) * H) + 'px';
      plein.style.height = Math.max(0, f * H + 3) + 'px';
      if (def.reel) { const fr = frac(def.reel()); reel.style.display = Math.abs(fr - f) > 0.004 ? '' : 'none'; reel.style.top = (6 + (1 - fr) * H) + 'px'; } else reel.style.display = 'none';
      v.textContent = def.fmt ? def.fmt(c) : Math.round(c);
      el.classList.toggle('auto', !!(def.auto && def.auto()));
    },
  };
};

/* ---------------- Historique partagé (échantillonnage adaptatif) ---------------- */
W.Historique = function (cles) {
  this.cles = cles; this.t = []; this.d = {}; this.pas = 1; this.dernier = -1e9;
  for (const k of cles) this.d[k] = [];
};
W.Historique.prototype.ajouter = function (t, valeurs) {
  if (t - this.dernier < this.pas) return;
  this.dernier = t; this.t.push(t);
  for (const k of this.cles) this.d[k].push(valeurs[k]);
  if (this.t.length > 1400) {                    // on garde tout l'historique en doublant le pas d'échantillonnage
    const g = a => a.filter((_, i) => i % 2 === 0);
    this.t = g(this.t); for (const k of this.cles) this.d[k] = g(this.d[k]);
    this.pas *= 2;
  }
};

function prepCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(50, Math.round(r.width)), h = Math.max(40, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  return { g, w, h };
}
W.prepCanvas = prepCanvas;
function fmtDuree(s) {
  if (s < 120) return Math.round(s) + ' s';
  if (s < 7200) return (s / 60).toFixed(s < 600 ? 1 : 0) + ' min';
  return (s / 3600).toFixed(1) + ' h';
}
W.fmtDuree = fmtDuree;
function echelle(min, max, n) {
  const brut = (max - min) / n, p = Math.pow(10, Math.floor(Math.log10(brut))), m = brut / p;
  const pas = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  const t = []; for (let v = Math.ceil(min / pas) * pas; v <= max + 1e-9; v += pas) t.push(v);
  return t;
}
W.echelle = echelle;

/* ---------------- Courbe temporelle (un seul axe vertical, légende, survol) ---------------- */
W.courbe = function (hote, def, hist) {
  const el = document.createElement('div'); el.className = 'graphe';
  el.innerHTML = `<h4>${def.titre} ${def.series.map(s => `<span class="leg"><i style="background:${s.couleur}"></i>${s.nom}</span>`).join('')}</h4><div class="zone"><canvas></canvas><div class="bulle-graphe"></div></div>`;
  hote.appendChild(el);
  const cv = el.querySelector('canvas'), bulle = el.querySelector('.bulle-graphe');
  let survol = null, geo = null;
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); survol = e.clientX - r.left; dessiner(); });
  cv.addEventListener('pointerleave', () => { survol = null; bulle.style.display = 'none'; dessiner(); });
  function dessiner() {
    const { g, w, h } = prepCanvas(cv);
    const n = hist.t.length; if (n < 2) return;
    const mg = { g: 34, d: 6, h: 5, b: 15 }, pw = w - mg.g - mg.d, ph = h - mg.h - mg.b;
    let lo = Infinity, hi = -Infinity;
    for (const s of def.series) for (const v of hist.d[s.cle]) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const emin = def.etendueMin || 1;
    if (hi - lo < emin) { const m = (hi + lo) / 2; lo = m - emin / 2; hi = m + emin / 2; }
    const marge = (hi - lo) * 0.08; lo -= marge; hi += marge;
    if (def.min != null) lo = Math.max(lo, def.min);
    const t0 = hist.t[0], t1 = hist.t[n - 1];
    const X = t => mg.g + (t - t0) / Math.max(1e-9, t1 - t0) * pw, Y = v => mg.h + (1 - (v - lo) / (hi - lo)) * ph;
    g.font = '10px ' + css('--mono'); g.textBaseline = 'middle'; g.textAlign = 'right';
    for (const v of echelle(lo, hi, 4)) {
      g.strokeStyle = '#1e2a36'; g.lineWidth = 1; g.beginPath(); g.moveTo(mg.g, Y(v) + .5); g.lineTo(w - mg.d, Y(v) + .5); g.stroke();
      g.fillStyle = '#6f8294'; g.fillText(Math.abs(v) >= 1000 ? v.toFixed(0) : +v.toFixed(1), mg.g - 4, Y(v));
    }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('−' + fmtDuree(t1 - t0), mg.g, h - 3);
    g.textAlign = 'right'; g.fillText('maintenant', w - mg.d, h - 3);
    g.lineWidth = 2; g.lineJoin = 'round';
    for (const s of def.series) {
      const d = hist.d[s.cle]; g.strokeStyle = s.couleur; g.beginPath();
      for (let i = 0; i < n; i++) { const x = X(hist.t[i]), y = clamp(Y(d[i]), mg.h - 2, h - mg.b + 2); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    if (survol != null && survol >= mg.g) {
      const ts = t0 + (survol - mg.g) / pw * (t1 - t0);
      let i = 0; while (i < n - 1 && hist.t[i] < ts) i++;
      const x = X(hist.t[i]);
      g.strokeStyle = '#7d93a8'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + .5, mg.h); g.lineTo(x + .5, h - mg.b); g.stroke();
      let html = `<div style="color:#6f8294">il y a ${fmtDuree(t1 - hist.t[i])}</div>`;
      for (const s of def.series) { const v = hist.d[s.cle][i]; g.fillStyle = s.couleur; g.strokeStyle = css('--panneau'); g.lineWidth = 2; g.beginPath(); g.arc(x, Y(v), 4, 0, 7); g.fill(); g.stroke(); html += `<div><i style="background:${s.couleur}"></i>${s.nom} : <b>${v.toFixed(def.dec == null ? 1 : def.dec)} ${def.unite}</b></div>`; }
      bulle.innerHTML = html; bulle.style.display = 'block';
      bulle.style.left = (x > w / 2 ? x - bulle.offsetWidth - 8 : x + 8) + 'px'; bulle.style.top = '4px';
    }
  }
  return { dessiner };
};
})(window);
