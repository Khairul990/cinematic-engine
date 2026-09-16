/* ============================================================
   Cinematic Engine — themes.js
   প্রতিটি থিম = ডিজাইন টোকেন সেট (রঙ, ফন্ট, ব্যাকগ্রাউন্ড, এফেক্ট)
   ============================================================ */

export const FONTS = {
  bnSerif: `'Noto Serif Bengali','Hind Siliguri','Vrinda','Nirmala UI',serif`,
  bnSans: `'Hind Siliguri','Noto Sans Bengali','Anek Bangla','Vrinda','Nirmala UI',sans-serif`,
  bnDisplay: `'Baloo Da 2','Hind Siliguri','Anek Bangla','Noto Sans Bengali',sans-serif`,
  enSerif: `'Playfair Display','Noto Serif Bengali',Georgia,serif`,
  enSans: `'Inter','Hind Siliguri',system-ui,sans-serif`,
};

export const THEMES = {
  /* ---------- ১. Midnight Gold — সিনেমাটিক মোটিভেশন ---------- */
  midnight: {
    id: 'midnight', name: 'Midnight Gold', bn: 'মিডনাইট গোল্ড',
    desc: 'গাঢ় রাত + সোনালি আলো — মোটিভেশন/স্টোরির জন্য সেরা',
    bg: { base: '#060810', top: '#0d1224', bottom: '#03040a' },
    colors: {
      text: '#f4f1e8', muted: '#9aa3bd', accent: '#f5c451', accent2: '#e8873a',
      line: 'rgba(245,196,81,.28)', card: 'rgba(255,255,255,.045)',
      cardLine: 'rgba(255,255,255,.10)', glow: 'rgba(245,196,81,.45)',
      chartA: '#f5c451', chartB: '#7dd3fc', chartC: '#fb7185', chartD: '#86efac'
    },
    fonts: { headline: FONTS.bnSerif, body: FONTS.bnSans, kicker: FONTS.bnSans, number: FONTS.enSerif },
    headline: { weight: 800, tracking: '-0.5px', lineH: 1.28 },
    body: { weight: 500, lineH: 1.7 },
    kicker: { weight: 700, tracking: '6px', size: 30, uppercase: false },
    fx: { defaultEffect: 'embers', vignette: .85, grain: .055, bars: true, bloom: .55 },
    gradientText: true,
  },

  /* ---------- ২. Dawn Mist — শান্ত, ইমোশনাল ---------- */
  dawn: {
    id: 'dawn', name: 'Dawn Mist', bn: 'ডন মিস্ট',
    desc: 'নরম ভোরের আলো — ইমোশনাল/লাইফ স্টোরি',
    bg: { base: '#0a0d14', top: '#182238', bottom: '#070a10' },
    colors: {
      text: '#fdf6f0', muted: '#a8b0c4', accent: '#ffb4a2', accent2: '#90c8ff',
      line: 'rgba(255,180,162,.30)', card: 'rgba(255,255,255,.05)',
      cardLine: 'rgba(255,255,255,.12)', glow: 'rgba(144,200,255,.40)',
      chartA: '#ffb4a2', chartB: '#90c8ff', chartC: '#c3f0ca', chartD: '#ffe08a'
    },
    fonts: { headline: FONTS.bnSans, body: FONTS.bnSans, kicker: FONTS.bnSans, number: FONTS.enSans },
    headline: { weight: 700, tracking: '0px', lineH: 1.35 },
    body: { weight: 400, lineH: 1.8 },
    kicker: { weight: 600, tracking: '5px', size: 26 },
    fx: { defaultEffect: 'dust', vignette: .7, grain: .045, bars: true, bloom: .45 },
    gradientText: true,
  },

  /* ---------- ৩. Neon Noir — ডার্ক + নিয়ন ---------- */
  noir: {
    id: 'noir', name: 'Neon Noir', bn: 'নিয়ন নোয়ার',
    desc: 'উচ্চ কনট্রাস্ট নিয়ন — টেক/থ্রিলার/ডার্ক স্টোরি',
    bg: { base: '#04050a', top: '#0a0f1e', bottom: '#010205' },
    colors: {
      text: '#eaf6ff', muted: '#7f8db3', accent: '#22d3ee', accent2: '#f472b6',
      line: 'rgba(34,211,238,.30)', card: 'rgba(10,20,40,.55)',
      cardLine: 'rgba(34,211,238,.22)', glow: 'rgba(34,211,238,.55)',
      chartA: '#22d3ee', chartB: '#f472b6', chartC: '#a3e635', chartD: '#fbbf24'
    },
    fonts: { headline: FONTS.bnSans, body: FONTS.bnSans, kicker: FONTS.bnSans, number: FONTS.enSans },
    headline: { weight: 800, tracking: '-0.5px', lineH: 1.25 },
    body: { weight: 400, lineH: 1.75 },
    kicker: { weight: 700, tracking: '8px', size: 24 },
    fx: { defaultEffect: 'grid', vignette: .9, grain: .05, bars: true, bloom: .8 },
    gradientText: true,
  },

  /* ---------- ৪. Paper Light — পরিষ্কার উজ্জ্বল ---------- */
  paper: {
    id: 'paper', name: 'Paper Light', bn: 'পেপার লাইট',
    desc: 'উজ্জ্বল পটভূমি — ফ্যাক্টস/এডুকেশন/ক্লিন লুক',
    bg: { base: '#f5f3ef', top: '#ffffff', bottom: '#e7e3db' },
    colors: {
      text: '#16181d', muted: '#5c6470', accent: '#c2410c', accent2: '#1d4ed8',
      line: 'rgba(22,24,29,.18)', card: 'rgba(255,255,255,.85)',
      cardLine: 'rgba(22,24,29,.12)', glow: 'rgba(194,65,12,.25)',
      chartA: '#c2410c', chartB: '#1d4ed8', chartC: '#15803d', chartD: '#a21caf'
    },
    fonts: { headline: FONTS.bnSerif, body: FONTS.bnSans, kicker: FONTS.bnSans, number: FONTS.enSerif },
    headline: { weight: 800, tracking: '-0.5px', lineH: 1.3 },
    body: { weight: 500, lineH: 1.75 },
    kicker: { weight: 700, tracking: '6px', size: 26 },
    fx: { defaultEffect: 'softblobs', vignette: .35, grain: .03, bars: false, bloom: .2 },
    gradientText: false,
  },

  /* ---------- ৫. Crimson Drama ---------- */
  crimson: {
    id: 'crimson', name: 'Crimson Drama', bn: 'ক্রিমসন ড্রামা',
    desc: 'গাঢ় লাল-কালো — ড্রামা/ইনটেন্স স্টোরি',
    bg: { base: '#0b0305', top: '#1c0710', bottom: '#040102' },
    colors: {
      text: '#fff3f0', muted: '#c39a9a', accent: '#ff5a4e', accent2: '#ffc46b',
      line: 'rgba(255,90,78,.32)', card: 'rgba(255,255,255,.05)',
      cardLine: 'rgba(255,90,78,.22)', glow: 'rgba(255,90,78,.5)',
      chartA: '#ff5a4e', chartB: '#ffc46b', chartC: '#8bd3ff', chartD: '#b8f2a0'
    },
    fonts: { headline: FONTS.bnSerif, body: FONTS.bnSans, kicker: FONTS.bnSans, number: FONTS.enSerif },
    headline: { weight: 800, tracking: '-1px', lineH: 1.22 },
    body: { weight: 500, lineH: 1.7 },
    kicker: { weight: 700, tracking: '7px', size: 28 },
    fx: { defaultEffect: 'embers', vignette: .95, grain: .06, bars: true, bloom: .7 },
    gradientText: true,
  },

  /* ---------- ৬. Forest Calm ---------- */
  forest: {
    id: 'forest', name: 'Forest Calm', bn: 'ফরেস্ট ক্যালম',
    desc: 'সবুজ শান্ত — প্রকৃতি/স্বাস্থ্য/ধ্যান',
    bg: { base: '#04120d', top: '#0c2a1e', bottom: '#020806' },
    colors: {
      text: '#eefaf2', muted: '#93b3a3', accent: '#5eead4', accent2: '#fde68a',
      line: 'rgba(94,234,212,.28)', card: 'rgba(255,255,255,.045)',
      cardLine: 'rgba(94,234,212,.2)', glow: 'rgba(94,234,212,.4)',
      chartA: '#5eead4', chartB: '#fde68a', chartC: '#a3e635', chartD: '#93c5fd'
    },
    fonts: { headline: FONTS.bnSans, body: FONTS.bnSans, kicker: FONTS.bnSans, number: FONTS.enSans },
    headline: { weight: 700, tracking: '0px', lineH: 1.32 },
    body: { weight: 400, lineH: 1.8 },
    kicker: { weight: 700, tracking: '6px', size: 26 },
    fx: { defaultEffect: 'dust', vignette: .8, grain: .045, bars: true, bloom: .45 },
    gradientText: true,
  },
};

export const THEME_IDS = Object.keys(THEMES);
export const getTheme = id => THEMES[id] || THEMES.midnight;

/** স্টেজে থিমের CSS ভেরিয়েবল সেট করা */
export function applyThemeVars(root, theme) {
  const c = theme.colors;
  const s = root.style;
  s.setProperty('--bg-base', theme.bg.base);
  s.setProperty('--bg-top', theme.bg.top);
  s.setProperty('--bg-bottom', theme.bg.bottom);
  s.setProperty('--c-text', c.text);
  s.setProperty('--c-muted', c.muted);
  s.setProperty('--c-accent', c.accent);
  s.setProperty('--c-accent2', c.accent2);
  s.setProperty('--c-line', c.line);
  s.setProperty('--c-card', c.card);
  s.setProperty('--c-cardline', c.cardLine);
  s.setProperty('--c-glow', c.glow);
  s.setProperty('--f-head', theme.fonts.headline);
  s.setProperty('--f-body', theme.fonts.body);
  s.setProperty('--f-kick', theme.fonts.kicker);
  s.setProperty('--f-num', theme.fonts.number);
  s.setProperty('--vignette', String(theme.fx.vignette));
  s.setProperty('--bloom', String(theme.fx.bloom));
}
