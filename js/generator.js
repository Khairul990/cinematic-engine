/* ============================================================
   Cinematic Engine — generator.js
   অডিও সিগমেন্ট + স্ক্রিপ্ট → পূর্ণাঙ্গ সিন টাইমলাইন (অটোম্যাটিক)
   সিনেমাটিক/স্টোরি-মোটিভেশন স্টাইলের কম্পোজিশন টেমপ্লেট
   ============================================================ */

import { clamp, mulberry32, uid, round, pick } from './util.js';
import { makeElement } from './elements.js';
import { EFFECT_IDS } from './effects.js';

/* সিন টেমপ্লেট — প্রতিটি একটি ভিজ্যুয়াল কম্পোজিশন */
export const TEMPLATES = {
  hero:        { bn: 'হিরো টাইটেল',      minDur: 2.0 },
  titleBig:    { bn: 'বড় টাইটেল',       minDur: 2.2 },
  lineCenter:  { bn: 'কেন্দ্রীয় লাইন',   minDur: 1.6 },
  lineMask:    { bn: 'লাইন মাস্ক',       minDur: 1.6 },
  kickerLine:  { bn: 'কিকার + লাইন',     minDur: 2.0 },
  quote:       { bn: 'উক্তি কার্ড',       minDur: 2.6 },
  bigWord:     { bn: 'একটি বড় শব্দ',    minDur: 1.8 },
  twoColumn:   { bn: 'দুই কলাম',         minDur: 2.8 },
  listSteps:   { bn: 'ধাপ তালিকা',       minDur: 3.2 },
  cardsRow:    { bn: 'কার্ড সারি',       minDur: 3.4 },
  counter:     { bn: 'কাউন্টার',         minDur: 2.4 },
  progress:    { bn: 'প্রোগ্রেস বার',     minDur: 2.2 },
  chartBar:    { bn: 'বার চার্ট',        minDur: 2.8 },
  chartLine:   { bn: 'লাইন চার্ট',       minDur: 2.8 },
  donut:       { bn: 'ডোনাট চার্ট',      minDur: 2.6 },
  imageStory:  { bn: 'ছবি + টেক্সট',     minDur: 3.0 },
  chapter:     { bn: 'অধ্যায় কার্ড',     minDur: 2.0 },
  outro:       { bn: 'আউট্রো / CTA',     minDur: 2.6 },
};
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

/* অটো-জেনারেটের সময় কোন টেমপ্লেট কতবার ব্যবহার হবে (ওয়েট) */
const AUTO_MIX = [
  'lineCenter', 'lineCenter', 'lineCenter',
  'lineMask', 'lineMask',
  'kickerLine', 'kickerLine',
  'quote',
  'bigWord', 'bigWord',
  'titleBig',
  'counter', 'progress',
  'listSteps', 'cardsRow',
  'imageStory',
  'chapter',
];

/* ---------- ডিফল্ট প্রজেক্ট ---------- */
export function defaultProject() {
  return {
    meta: {
      title: 'নতুন ভিডিও প্রজেক্ট',
      aspect: '16:9',
      width: 1920, height: 1080,
      theme: 'midnight',
      channel: 'তোমার চ্যানেল',
      created: Date.now(),
    },
    audio: { src: null, name: null, duration: 0, volume: 1 },
    settings: {
      leadIn: 0.6,
      leadOut: 1.6,
      minSceneDur: 1.6,
      maxSceneDur: 14,
      sensitivity: 0.5,
      minSilence: 0.45,
      bgm: false, bgmSrc: null, bgmVolume: 0.12,
      showSafe: false, showGrid: false,
      watermark: true,
      autoFx: true,
      charsPerSecond: 8.2,
      titleWords: 7,
    },
    scenes: [],
    images: [],   // { id, name, dataUrl }
    _rev: 0,      // রিভিশন কাউন্টার — স্টেজ রিবিল্ড ঠিক করতে
  };
}

/* ---------- ডেমো প্রজেক্ট (অডিও ছাড়াই টেস্ট করা যায়) ---------- */
export function demoProject() {
  const p = defaultProject();
  p.meta.title = 'ডেমো — স্বপ্নের পথ';
  p.meta.channel = 'তোমার চ্যানেল';
  const lines = [
    { t: 'hero', dur: 4.2, text: 'যে দিনটা সব বদলে দেয়', sub: 'একটা সত্যিকারের গল্প' },
    { t: 'bigWord', dur: 3.4, text: 'সেদিন ছিল সাধারণ' },
    { t: 'lineCenter', dur: 4.0, text: 'কিন্তু ভেতরে একটা ঝড় চলছিল' },
    { t: 'quote', dur: 5.2, text: '“যে থামে না, তাকে থামানো যায় না।”', author: '— অজানা' },
    { t: 'counter', dur: 4.0, to: 365, suffix: ' দিন', label: 'টানা পরিশ্রম' },
    { t: 'progress', dur: 3.6, value: 82, label: 'লক্ষ্যের অগ্রগতি' },
    { t: 'listSteps', dur: 5.4, items: ['প্রতিদিন ওঠো ভোরে', 'একটা কাজ শেষ করো', 'নিজেকে মাপো'] },
    { t: 'outro', dur: 4.6, text: 'আজ থেকে শুরু করো', sub: 'সাবস্ক্রাইব করো · বেল আইকন চাপো' },
  ];
  let t = 0.6;
  p.audio.duration = 0;   // ডেমোতে আসল অডিও নেই
  p._demoDur = lines.reduce((a, b) => a + b.dur, 0) + 2.2;
  p.scenes = lines.map((L, i) => {
    const sc = makeSceneFromTemplate(p, L.t, { start: t, dur: L.dur, text: L.text }, i);
    if (L.sub) sc.elements.push(makeElement('kicker', { x: 50, y: 78, w: 70, size: 34, color: 'muted', t: 0.9, dur: L.dur - 1.4, enter: 'fade', enterDur: 1, extra: { text: L.sub, withLine: false } }));
    if (L.author) sc.elements.forEach(e => { if (e.type === 'quote') e.extra.author = L.author; });
    if (L.to !== undefined) sc.elements.forEach(e => { if (e.type === 'counter') { e.extra.to = L.to; e.extra.suffix = L.suffix; e.extra.label = L.label; } });
    if (L.value !== undefined) sc.elements.forEach(e => { if (e.type === 'progress') { e.extra.value = L.value; e.extra.label = L.label; } });
    if (L.items) sc.elements.forEach(e => { if (e.type === 'list') e.extra.items = L.items; });
    t += L.dur;
    return sc;
  });
  return p;
}

/* ============================================================
   মূল জেনারেটর
   segments: [{start,end,dur,energy}]
   scriptLines: [{text,start,end,dur}] | null
   ============================================================ */
export function generateTimeline(project, segments, scriptLines, opt = {}) {
  const S = project.settings;
  const rnd = mulberry32(opt.seed ?? 20260916);
  const total = project.audio.duration || (segments[segments.length - 1]?.end || 0);

  // লাইনগুলো ঠিক করি: স্ক্রিপ্ট থাকলে সেটাই মাস্টার, নাহলে সিগমেন্ট
  let units;
  if (scriptLines && scriptLines.length) {
    units = scriptLines.map(l => ({ text: l.text, start: l.start, end: l.end, dur: l.dur, energy: 0.5 }));
  } else {
    units = segments.map(s => ({ text: '', start: s.start, end: s.end, dur: s.dur, energy: s.energy }));
  }

  // খুব ছোট ইউনিট মার্জ
  units = mergeTinyUnits(units, S.minSceneDur * 0.55);

  const scenes = [];
  const n = units.length;
  let usedTemplate = [];

  units.forEach((u, i) => {
    const start = Math.max(0, u.start - S.leadIn);
    const end = Math.min(total + S.leadOut, u.end + S.leadOut);
    let dur = clamp(end - start, S.minSceneDur, S.maxSceneDur);

    // পরের সিনের সাথে ওভারল্যাপ ঠিক
    const prev = scenes[i - 1];
    if (prev && start < prev.start + prev.dur) {
      const fixed = start - prev.start;
      if (fixed < S.minSceneDur) { dur = Math.max(S.minSceneDur, prev.dur - (start - prev.start) + dur); }
      else prev.dur = round(fixed, 3);
    }

    const isLast = i === n - 1;
    const isFirst = i === 0;

    // টেমপ্লেট বাছাই
    let tpl;
    if (isFirst) tpl = (u.text && u.text.split(/\s+/).length <= S.titleWords + 3) ? 'hero' : 'titleBig';
    else if (isLast) tpl = 'outro';
    else {
      tpl = pickTemplate(rnd, u, i, usedTemplate, S);
    }
    usedTemplate.push(tpl);
    if (usedTemplate.length > 4) usedTemplate.shift();

    const sc = makeSceneFromTemplate(project, tpl, u, i, rnd, S);
    sc.start = round(start, 3);
    sc.dur = round(dur, 3);
    sc.transition = isFirst ? 'fadeIn' : pickTransition(rnd, prev?.transition);
    sc.transitionDur = isFirst ? 0.8 : round(0.4 + rnd() * 0.35, 2);
    scenes.push(sc);
  });

  // টাইমলাইন সিল করা (গ্যাপ/ওভারল্যাপ দূর)
  sealScenes(scenes, total + S.leadOut, S);

  // ওয়াটারমার্ক যোগ
  if (S.watermark && project.meta.channel) {
    scenes.forEach(sc => {
      if (!sc.elements.some(e => e.type === 'watermark')) {
        sc.elements.push(makeElement('watermark', {
          x: 93, y: 94, w: 26, size: 26, align: 'right',
          t: 0.4, dur: sc.dur - 0.6, enter: 'fade', enterDur: 1.2, exit: 'fade', exitDur: 0.6,
          extra: { text: project.meta.channel }
        }));
      }
    });
  }

  return scenes;
}

/* ---------- ছোট ইউনিট মার্জ ---------- */
function mergeTinyUnits(units, minDur) {
  const out = [];
  for (const u of units) {
    const last = out[out.length - 1];
    if (last && (u.dur < minDur || last.dur < minDur * 0.6)) {
      last.end = u.end;
      last.dur = last.end - last.start;
      last.text = [last.text, u.text].filter(Boolean).join(' ');
      last.energy = Math.max(last.energy || 0, u.energy || 0);
    } else out.push({ ...u });
  }
  return out;
}

/* ---------- টেমপ্লেট বাছাই ---------- */
function pickTemplate(rnd, u, i, used, S) {
  const words = (u.text || '').split(/\s+/).filter(Boolean).length;
  const pool = [];

  // সংখ্যা থাকলে ডেটা টেমপ্লেট
  if (/\d/.test(u.text || '')) {
    pool.push('counter', 'progress', 'chartBar');
  }
  if (words <= 3 && u.text) pool.push('bigWord', 'bigWord');
  if (words >= 4 && words <= 14) pool.push('lineCenter', 'lineMask', 'kickerLine');
  if (words > 14) pool.push('lineMask', 'lineCenter');
  if ((u.text || '').includes('"') || (u.text || '').includes('“')) pool.push('quote');
  if (!u.text) pool.push('lineCenter', 'bigWord', 'chapter', 'imageStory');

  // মাঝে মাঝে বৈচিত্র্য
  if (i % 5 === 3) pool.push('cardsRow', 'listSteps');
  if (i % 7 === 5) pool.push('imageStory', 'chapter');
  if (S.autoFx && rnd() < 0.12) pool.push('chartLine', 'donut');

  const base = pool.length ? pool : AUTO_MIX;
  let t = base[Math.floor(rnd() * base.length)];
  // একই টেমপ্লেট পরপর ২ বার নয়
  let guard = 0;
  while (used.slice(-2).includes(t) && guard++ < 8) {
    t = (base.length > 1 ? base : AUTO_MIX)[Math.floor(rnd() * (base.length || AUTO_MIX.length))];
  }
  return t;
}

function pickTransition(rnd, prev) {
  const opts = ['crossfade', 'crossfade', 'crossfade', 'zoomIn', 'zoomOut', 'slideLeft', 'slideUp', 'blur', 'wipeRight', 'cinematicCut'];
  let t = opts[Math.floor(rnd() * opts.length)];
  if (t === prev) t = opts[(opts.indexOf(t) + 3) % opts.length];
  return t;
}

/* ---------- গ্যাপ/ওভারল্যাপ সিল ---------- */
function sealScenes(scenes, totalDur, S) {
  scenes.sort((a, b) => a.start - b.start);
  for (let i = 1; i < scenes.length; i++) {
    const p = scenes[i - 1], c = scenes[i];
    if (c.start < p.start + p.dur) c.start = round(p.start + p.dur, 3);
    p.dur = round(Math.max(S.minSceneDur * 0.6, c.start - p.start), 3);
    fitElements(p);
  }
  const last = scenes[scenes.length - 1];
  if (last) {
    const want = Math.max(last.dur, totalDur - last.start);
    last.dur = round(Math.max(S.minSceneDur * 0.6, want), 3);
    fitElements(last);
  }
  scenes.forEach(fitElements);
}
function fitElements(sc) {
  sc.elements.forEach(e => {
    e.t = clamp(e.t, 0, Math.max(0.05, sc.dur - 0.1));
    e.dur = clamp(e.dur, 0.25, sc.dur - e.t);
  });
}

/* ============================================================
   টেমপ্লেট → সিন (এলিমেন্ট সেট)
   ============================================================ */
export function makeSceneFromTemplate(project, tpl, u = {}, idx = 0, rnd = null, S = null) {
  S = S || project.settings;
  rnd = rnd || mulberry32(9999 + idx * 31);
  const text = (u.text || '').trim();
  const dur = u.dur || 4;
  const themeId = project.meta.theme;
  const fxPool = ['embers', 'dust', 'stars', 'softblobs', 'rays', 'bokeh', 'waves', 'smoke'];

  const bg = {
    effect: S.autoFx ? fxPool[Math.floor(rnd() * fxPool.length)] : 'none',
    density: round(0.7 + rnd() * 0.9, 2),
    speed: round(0.6 + rnd() * 0.9, 2),
    motion: pick(['driftLeft', 'driftUp', 'pulse', 'slowPan', 'none']),
    gradientAngle: Math.floor(rnd() * 360),
    spotX: round(20 + rnd() * 60, 1),
    spotY: round(15 + rnd() * 55, 1),
    spotSize: round(45 + rnd() * 40, 1),
    seed: Math.floor(rnd() * 100000),
  };

  const sc = {
    id: uid('sc'),
    name: `${idx + 1}. ${TEMPLATES[tpl]?.bn || tpl}`,
    template: tpl,
    start: u.start ?? 0,
    dur: round(dur, 3),
    bg,
    transition: 'crossfade',
    transitionDur: 0.55,
    elements: [],
    note: text ? text.slice(0, 40) : '',
  };

  const add = (type, over = {}) => { const e = makeElement(type, over); sc.elements.push(e); return e; };
  const inDur = Math.min(0.9, dur * 0.3);
  const outDur = Math.min(0.55, dur * 0.2);

  switch (tpl) {
    case 'hero': {
      add('kicker', { x: 50, y: 30, w: 60, size: 32, color: 'accent', t: 0.25, dur: dur - 0.7, enter: 'fade', enterDur: 1, tracking: 8, extra: { text: u.sub || 'একটি সত্য গল্প', withLine: true } });
      add('title', {
        x: 50, y: 50, w: 84, size: sizeForText(text, 84, 132), color: 'gradient', weight: 800, lineH: 1.18,
        t: 0.5, dur: dur - 1.0, enter: 'lineMask', enterDur: 1.2, exit: 'fade', exitDur: outDur,
        extra: { text: text || 'তোমার শিরোনাম' }
      });
      add('divider', { x: 50, y: 70, w: 26, size: 10, t: 1.1, dur: dur - 1.5, enter: 'fade', enterDur: 0.9, extra: { width: 5 } });
      bg.effect = 'rays';
      break;
    }

    case 'titleBig': {
      add('title', {
        x: 50, y: 50, w: 86, size: sizeForText(text, 86, 108), color: 'gradient', weight: 800, lineH: 1.22,
        t: 0.35, dur: dur - 0.75, enter: 'wordByWord', enterDur: 1.0, enterEase: 'expoOut', exit: 'blurOut', exitDur: outDur,
        extra: { text: text || 'বড় শিরোনাম' }
      });
      bg.effect = 'softblobs';
      break;
    }

    case 'bigWord': {
      const words = text.split(/\s+/).filter(Boolean);
      const one = words.length <= 2 ? text : words.slice(0, Math.min(3, words.length)).join(' ');
      add('text', {
        x: 50, y: 50, w: 80, size: 150, color: 'accent', weight: 800, lineH: 1.1, tracking: -2,
        t: 0.3, dur: dur - 0.6, enter: 'zoomIn', enterDur: 0.9, enterEase: 'backOut', exit: 'zoomOut', exitDur: outDur,
        extra: { text: one }
      });
      if (words.length > 3) {
        add('text', { x: 50, y: 74, w: 74, size: 46, color: 'muted', weight: 500, t: 0.8, dur: dur - 1.2, enter: 'rise', enterDur: 0.8, extra: { text: words.slice(3).join(' ') } });
      }
      bg.effect = 'embers';
      break;
    }

    case 'lineCenter': {
      add('text', {
        x: 50, y: 50, w: 78, size: sizeForText(text, 78, 84), color: 'text', weight: 700, lineH: 1.4,
        t: 0.3, dur: dur - 0.65, enter: 'rise', enterDur: inDur, exit: 'fade', exitDur: outDur,
        extra: { text: text || 'তোমার লাইন' }
      });
      break;
    }

    case 'lineMask': {
      add('text', {
        x: 50, y: 48, w: 82, size: sizeForText(text, 82, 92), color: 'gradient', weight: 800, lineH: 1.32,
        t: 0.3, dur: dur - 0.65, enter: 'lineMask', enterDur: 1.1, exit: 'slideUp', exitDur: outDur,
        extra: { text: text || 'তোমার লাইন' }
      });
      add('divider', { x: 50, y: 74, w: 18, size: 10, t: 0.7, dur: dur - 1.1, enter: 'fade', enterDur: 0.8, extra: { width: 4 } });
      bg.effect = 'dust';
      break;
    }

    case 'kickerLine': {
      add('kicker', { x: 50, y: 32, w: 56, size: 30, color: 'accent', tracking: 7, weight: 700, t: 0.25, dur: dur - 0.6, enter: 'fade', enterDur: 0.8, extra: { text: chapterName(idx), withLine: true } });
      add('text', { x: 50, y: 54, w: 78, size: sizeForText(text, 78, 82), color: 'text', weight: 700, lineH: 1.38, t: 0.5, dur: dur - 0.9, enter: 'rise', enterDur: inDur, exit: 'fade', exitDur: outDur, extra: { text: text || 'তোমার লাইন' } });
      break;
    }

    case 'quote': {
      add('quote', {
        x: 50, y: 50, w: 72, size: 66, color: 'text', weight: 700, lineH: 1.45, align: 'center',
        t: 0.35, dur: dur - 0.75, enter: 'blurIn', enterDur: 1.0, exit: 'blurOut', exitDur: outDur,
        extra: { text: text || '“উক্তি লিখুন”', author: '', mark: true }
      });
      bg.effect = 'bokeh';
      break;
    }

    case 'twoColumn': {
      add('title', { x: 26, y: 50, w: 40, size: 76, color: 'gradient', weight: 800, lineH: 1.25, align: 'left', t: 0.3, dur: dur - 0.7, enter: 'slideRight', enterDur: 0.9, extra: { text: splitHalf(text)[0] } });
      add('text', { x: 74, y: 50, w: 40, size: 42, color: 'muted', weight: 500, lineH: 1.7, align: 'left', t: 0.7, dur: dur - 1.1, enter: 'fade', enterDur: 0.9, extra: { text: splitHalf(text)[1] } });
      add('divider', { x: 50, y: 50, w: 1.5, size: 10, t: 0.5, dur: dur - 1, enter: 'fade', enterDur: .8, extra: { width: 3 } });
      break;
    }

    case 'listSteps': {
      add('kicker', { x: 50, y: 18, w: 50, size: 30, color: 'accent', tracking: 7, t: 0.2, dur: dur - 0.5, enter: 'fade', enterDur: .8, extra: { text: chapterName(idx), withLine: false } });
      const items = text ? splitToList(text, 4) : ['প্রথম ধাপ', 'দ্বিতীয় ধাপ', 'তৃতীয় ধাপ'];
      add('list', { x: 50, y: 54, w: 62, size: 54, color: 'text', weight: 700, align: 'left', t: 0.5, dur: dur - 1.0, enter: 'fade', enterDur: .8, extra: { items, numbered: true, stagger: clamp(dur * 0.12, 0.12, 0.4) } });
      break;
    }

    case 'cardsRow': {
      add('title', { x: 50, y: 17, w: 70, size: 58, color: 'gradient', weight: 800, t: 0.25, dur: dur - 0.6, enter: 'rise', enterDur: .8, extra: { text: text ? firstN(text, 6) : 'তিনটি বিষয়' } });
      const cs = text ? splitToCards(text, 3) : [{ t: 'শিরোনাম', d: 'বিবরণ' }, { t: 'শিরোনাম', d: 'বিবরণ' }, { t: 'শিরোনাম', d: 'বিবরণ' }];
      add('cards', { x: 50, y: 56, w: 82, size: 46, t: 0.7, dur: dur - 1.2, enter: 'fade', enterDur: .8, extra: { cards: cs, stagger: clamp(dur * 0.1, 0.1, 0.3) } });
      break;
    }

    case 'counter': {
      const nums = (text.match(/\d+/g) || []);
      const to = nums.length ? parseInt(nums[0], 10) : 100;
      add('kicker', { x: 50, y: 28, w: 56, size: 32, color: 'muted', tracking: 6, t: 0.25, dur: dur - 0.6, enter: 'fade', enterDur: .8, extra: { text: text ? text.replace(/\d+/g, '').replace(/\s{2,}/g, ' ').trim() || 'পরিমাণ' : 'পরিমাণ', withLine: false } });
      add('counter', {
        x: 50, y: 55, w: 60, size: 230, color: 'gradient', align: 'center',
        t: 0.45, dur: dur - 0.9, enter: 'zoomIn', enterDur: .8, enterEase: 'expoOut',
        extra: { from: 0, to, suffix: nums.length ? '' : '', prefix: '', decimals: 0, locale: 'bn', label: '', countDur: clamp(dur * 0.5, 0.8, 2.2) }
      });
      bg.effect = 'grid';
      break;
    }

    case 'progress': {
      const nums = (text.match(/\d+/g) || []);
      const value = clamp(nums.length ? parseInt(nums[0], 10) : 70, 1, 100);
      add('title', { x: 50, y: 32, w: 70, size: 62, color: 'text', weight: 800, t: 0.3, dur: dur - 0.7, enter: 'rise', enterDur: .8, extra: { text: text ? text.replace(/\d+\s*%?/, '').trim() || 'অগ্রগতি' : 'অগ্রগতি' } });
      add('progress', { x: 50, y: 60, w: 62, size: 46, t: 0.7, dur: dur - 1.1, enter: 'fade', enterDur: .7, extra: { value, label: '', showValue: true, barDur: clamp(dur * 0.45, 0.7, 2) } });
      break;
    }

    case 'chartBar': {
      add('title', { x: 50, y: 16, w: 70, size: 54, color: 'gradient', weight: 800, t: 0.25, dur: dur - 0.6, enter: 'rise', enterDur: .8, extra: { text: text ? firstN(text, 6) : 'তুলনা' } });
      add('chartBar', { x: 50, y: 57, w: 66, size: 46, t: 0.6, dur: dur - 1.0, enter: 'fade', enterDur: .7, extra: { data: numsToBars(text), stagger: 0.14 } });
      break;
    }

    case 'chartLine': {
      add('title', { x: 50, y: 15, w: 70, size: 54, color: 'gradient', weight: 800, t: 0.25, dur: dur - 0.6, enter: 'rise', enterDur: .8, extra: { text: text ? firstN(text, 6) : 'বৃদ্ধির ধারা' } });
      add('chartLine', { x: 50, y: 56, w: 68, size: 44, t: 0.6, dur: dur - 1.0, enter: 'fade', enterDur: .7, extra: { data: numsToLine(text), drawDur: clamp(dur * 0.6, 1, 2.4) } });
      break;
    }

    case 'donut': {
      add('title', { x: 50, y: 13, w: 70, size: 50, color: 'gradient', weight: 800, t: 0.25, dur: dur - 0.6, enter: 'rise', enterDur: .8, extra: { text: text ? firstN(text, 5) : 'ভাগ' } });
      add('donut', { x: 50, y: 55, w: 46, size: 40, t: 0.6, dur: dur - 1.0, enter: 'zoomIn', enterDur: .8, extra: { data: numsToDonut(text), drawDur: clamp(dur * 0.55, 1, 2.2) } });
      break;
    }

    case 'imageStory': {
      const img = project.images?.[idx % Math.max(1, project.images?.length || 1)];
      add('image', { x: 29, y: 50, w: 42, size: 40, t: 0.3, dur: dur - 0.7, enter: 'slideLeft', enterDur: 1.0, exit: 'fade', exitDur: outDur, extra: { src: img?.dataUrl || '', radius: 30, kenburns: 1.14, border: true } });
      add('text', { x: 72, y: 50, w: 40, size: sizeForText(text, 40, 62, 30, 96), color: 'text', weight: 700, lineH: 1.42, align: 'left', t: 0.7, dur: dur - 1.1, enter: 'rise', enterDur: .9, exit: 'fade', exitDur: outDur, extra: { text: text || 'ছবির পাশের টেক্সট' } });
      break;
    }

    case 'chapter': {
      add('badge', { x: 50, y: 38, w: 40, size: 34, t: 0.25, dur: dur - 0.6, enter: 'zoomIn', enterDur: .7, extra: { text: `অধ্যায় ${bnNum(idx + 1)}`, icon: '◆' } });
      add('title', { x: 50, y: 56, w: 76, size: sizeForText(text, 76, 96), color: 'gradient', weight: 800, lineH: 1.24, t: 0.5, dur: dur - 0.9, enter: 'blurIn', enterDur: 1.0, exit: 'fade', exitDur: outDur, extra: { text: text || 'অধ্যায়ের নাম' } });
      bg.effect = 'smoke';
      break;
    }

    case 'outro': {
      add('title', { x: 50, y: 42, w: 80, size: sizeForText(text, 80, 104), color: 'gradient', weight: 800, lineH: 1.2, t: 0.3, dur: dur - 0.7, enter: 'zoomIn', enterDur: 1.0, enterEase: 'expoOut', extra: { text: text || 'ধন্যবাদ' } });
      add('divider', { x: 50, y: 60, w: 24, size: 10, t: 0.9, dur: dur - 1.3, enter: 'fade', enterDur: .8, extra: { width: 5 } });
      add('kicker', { x: 50, y: 70, w: 70, size: 38, color: 'accent', tracking: 6, weight: 700, t: 1.2, dur: dur - 1.6, enter: 'rise', enterDur: .9, extra: { text: 'সাবস্ক্রাইব করো · বেল আইকন চাপো', withLine: false } });
      bg.effect = 'embers';
      break;
    }

    default: {
      add('text', { x: 50, y: 50, w: 78, size: sizeForText(text, 78, 84), t: 0.3, dur: dur - 0.65, enter: 'rise', enterDur: inDur, extra: { text: text || '' } });
    }
  }

  fitElements(sc);
  return sc;
}

/* ---------- লম্বা টেক্সটের জন্য উপযুক্ত ফন্ট সাইজ ---------- */
/**
 * বক্সের প্রশস্ততা (শতকরা) ও টেক্সটের দৈর্ঘ্য দেখে ফন্ট সাইজ ঠিক করে,
 * যেন কথা স্ক্রিনের বাইরে না যায় এবং ৩ লাইনের বেশি না হয়।
 */
export function sizeForText(text, boxW = 78, base = 84, minPx = 34, maxPx = 150, stageW = 1920) {
  const s = String(text || '').trim();
  if (!s) return base;
  const usable = (boxW / 100) * stageW;
  const rawLines = s.split('\n');
  let worst = 0;
  for (const rl of rawLines) {
    const perLine = Math.max(1, rl.length);
    // বাংলা গ্লিফের গড় প্রশস্ততা ≈ 0.55 × font-size
    const size = usable / (perLine * 0.55);
    worst = Math.min(worst || Infinity, size);
  }
  // লাইন সংখ্যা ৩-এর বেশি হলে আরও ছোট করব না; বরং বড় রাখব (র‍্যাপ হবে)
  let out = Math.min(base, worst || base);
  // কমপক্ষে ২ লাইনে ভাগ হতে দিই → সাইজ একটু বাড়ানো যায়
  if (s.length > 26) out = Math.max(out, Math.min(base, usable / (Math.ceil(s.length / 2) * 0.55)));
  return Math.round(clamp(out, minPx, maxPx));
}

/* ---------- টেক্সট হেল্পার ---------- */
const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const bnNum = n => String(n).split('').map(d => /\d/.test(d) ? BN[+d] : d).join('');

function chapterName(i) {
  const names = ['সূচনা', 'প্রেক্ষাপট', 'মোড়', 'সংগ্রাম', 'অনুধাবন', 'পরিবর্তন', 'উত্থান', 'সিদ্ধান্ত', 'ফলাফল', 'উপসংহার'];
  return `অধ্যায় ${bnNum(i + 1)} · ${names[i % names.length]}`;
}
function firstN(text, n) {
  const w = text.split(/\s+/).filter(Boolean);
  return w.slice(0, n).join(' ') + (w.length > n ? '…' : '');
}
function splitHalf(text) {
  const w = (text || '').split(/\s+/).filter(Boolean);
  if (w.length < 4) return [text || '', ''];
  const h = Math.ceil(w.length / 2);
  return [w.slice(0, h).join(' '), w.slice(h).join(' ')];
}
function splitToList(text, max) {
  let parts = text.split(/[।;,\n•·]+/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    const w = text.split(/\s+/).filter(Boolean);
    const size = Math.max(2, Math.ceil(w.length / Math.min(max, Math.max(2, Math.ceil(w.length / 4)))));
    parts = [];
    for (let i = 0; i < w.length; i += size) parts.push(w.slice(i, i + size).join(' '));
  }
  return parts.slice(0, max).map(p => p.length > 46 ? p.slice(0, 46).trim() + '…' : p);
}
function splitToCards(text, n) {
  const parts = splitToList(text, n);
  while (parts.length < n) parts.push('বিবরণ যোগ করুন');
  return parts.slice(0, n).map(p => {
    const w = p.split(/\s+/);
    return { t: w.slice(0, 3).join(' '), d: w.slice(3).join(' ') || p };
  });
}
function numsToBars(text) {
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number).filter(n => isFinite(n));
  const labels = ['১ম', '২য়', '৩য়', '৪র্থ', '৫ম'];
  if (nums.length >= 2) return nums.slice(0, 5).map((v, i) => ({ l: labels[i], v }));
  return [{ l: '২০২১', v: 22 }, { l: '২০২২', v: 41 }, { l: '২০২৩', v: 63 }, { l: '২০২৪', v: 88 }];
}
function numsToLine(text) {
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number).filter(n => isFinite(n));
  if (nums.length >= 3) return nums.slice(0, 9);
  return [12, 24, 20, 38, 52, 47, 68, 84];
}
function numsToDonut(text) {
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number).filter(n => isFinite(n));
  const labels = ['অংশ ক', 'অংশ খ', 'অংশ গ', 'অংশ ঘ'];
  if (nums.length >= 2) return nums.slice(0, 4).map((v, i) => ({ l: labels[i], v }));
  return [{ l: 'কাজ', v: 45 }, { l: 'ঘুম', v: 30 }, { l: 'নিজের সময়', v: 25 }];
}

/* ---------- সিন খালি/কপি ---------- */
export function blankScene(project, start = 0, dur = 4, tpl = 'lineCenter') {
  return makeSceneFromTemplate(project, tpl, { start, dur, text: '' }, 0, mulberry32(Date.now() & 0xffff), project.settings);
}
