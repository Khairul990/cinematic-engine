/* ============================================================
   Cinematic Engine — util.js
   গণিত, ইজিং, ইউনিট, DOM হেল্পার, স্টোরেজ
   ============================================================ */

export const clamp = (v, a = 0, b = 1) => v < a ? a : (v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a) ? 0 : clamp((v - a) / (b - a), 0, 1);
export const round = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

/** 0..1 ইনপুট → ইজড 0..1 আউটপুট */
export const EASINGS = {
  linear: t => t,
  ease: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeIn: t => t * t * t,
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeInOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  expoOut: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  expoInOut: t => t === 0 ? 0 : t === 1 ? 1 : t < .5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2,
  quintOut: t => 1 - Math.pow(1 - t, 5),
  backOut: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  backInOut: t => {
    const c1 = 1.70158, c2 = c1 * 1.525;
    return t < .5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  elasticOut: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * c4) + 1;
  },
  softOut: t => 1 - Math.pow(1 - t, 2),
  cineOut: t => 1 - Math.pow(1 - t, 4),
};
export const ease = (name, t) => (EASINGS[name] || EASINGS.easeOut)(clamp(t));

/** সময় ফরম্যাট: 12.34 -> "0:12.34" */
export function fmtTime(s, decimals = 2) {
  if (!isFinite(s)) s = 0;
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(decimals).padStart(decimals ? decimals + 3 : 2, '0')}`;
}
export function fmtTimeShort(s) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/* ---------- DOM ---------- */
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined || c === false) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

/* ---------- অ্যারে / অবজেক্ট ---------- */
export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const clone = o => JSON.parse(JSON.stringify(o));
export const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

/** দৈব চয়ন কিন্তু seed ধরলে বারবার একই ফল (reproducible auto-generate) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- স্টোরেজ ---------- */
const LS_PREFIX = 'cine_engine::';
export const storage = {
  save(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('storage.save failed', e); return false; }
  },
  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  remove(key) { try { localStorage.removeItem(LS_PREFIX + key); } catch (e) { } }
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** বাংলা সংখ্যা <-> ইংরেজি */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export function toBengaliDigits(str) {
  return String(str).replace(/[0-9]/g, d => BN_DIGITS[+d]);
}
export function formatNumber(n, locale = 'bn', decimals = 0) {
  const fixed = Number(n).toFixed(decimals);
  return locale === 'bn' ? toBengaliDigits(fixed) : fixed;
}

/** টেক্সটকে word-wrap লাইনে ভাগ করা (অনুমানিক চরিত্র প্রশস্ততা দিয়ে) */
export function wrapWords(text, maxWordsPerLine = 6) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (cur.join(' ').length > maxWordsPerLine * 5 || cur.length >= maxWordsPerLine) {
      lines.push(cur.join(' ')); cur = [];
    }
  }
  if (cur.length) lines.push(cur.join(' '));
  return lines;
}
