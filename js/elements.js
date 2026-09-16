/* ============================================================
   Cinematic Engine — elements.js
   প্রতিটি ভিজ্যুয়াল এলিমেন্টের DOM তৈরি + প্রতি-ফ্রেম অ্যানিমেশন
   সবকিছু time-driven → স্ক্রাব/পজ/রেকর্ড সব সময় নিখুঁত সিঙ্ক
   ============================================================ */

import { clamp, lerp, ease, invLerp, uid, el, formatNumber } from './util.js';
import { hexA } from './effects.js';

export const ELEMENT_TYPES = {
  title:     { bn: 'বড় টাইটেল' },
  text:      { bn: 'টেক্সট / বডি' },
  kicker:    { bn: 'কিকার (ছোট লেবেল)' },
  quote:     { bn: 'উক্তি কার্ড' },
  counter:   { bn: 'কাউন্টার (নম্বর)' },
  progress:  { bn: 'প্রোগ্রেস বার' },
  chartBar:  { bn: 'বার চার্ট' },
  chartLine: { bn: 'লাইন চার্ট' },
  donut:     { bn: 'ডোনাট চার্ট' },
  list:      { bn: 'তালিকা' },
  cards:     { bn: 'কার্ড গ্রুপ' },
  image:     { bn: 'ছবি' },
  divider:   { bn: 'ডিভাইডার লাইন' },
  badge:     { bn: 'ব্যাজ / পিল' },
  watermark: { bn: 'চ্যানেল ওয়াটারমার্ক' },
};
export const ELEMENT_IDS = Object.keys(ELEMENT_TYPES);

export const ENTER_ANIMS = [
  'rise', 'fade', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'blurIn',
  'lineMask', 'wordByWord', 'dropIn', 'flipIn', 'wipeRight', 'scaleIn', 'typewriter'
];
export const EXIT_ANIMS = ['fade', 'slideUp', 'slideDown', 'zoomOut', 'blurOut', 'wipeRight', 'scaleDown'];

/* ডিফল্ট এলিমেন্ট তৈরি */
export function makeElement(type, extra = {}) {
  const base = {
    id: uid('el'), type,
    x: 50, y: 50,           // শতকরা (সেন্টার-অ্যাংকর)
    w: 60,                  // শতকরা প্রশস্ততা
    size: 64,               // px (1920x1080 স্টেজে)
    color: 'text',          // text|muted|accent|accent2|gradient|custom
    hex: '#ffffff',
    align: 'center',
    weight: 700,
    tracking: 0,
    lineH: 1.35,
    opacity: 1,
    italic: false,
    shadow: true,
    t: 0, dur: 3,
    enter: 'rise', enterDur: 0.7, enterEase: 'expoOut', enterDelay: 0,
    exit: 'fade', exitDur: 0.5, exitEase: 'easeIn',
    extra: {},
  };
  const e = Object.assign(base, extra);
  e.extra = Object.assign(defaultExtra(type), extra.extra || {});
  e._rev = 0;
  return e;
}

function defaultExtra(type) {
  switch (type) {
    case 'title':     return { text: 'শিরোনাম লিখুন', lines: null };
    case 'text':      return { text: 'বর্ণনা লিখুন' };
    case 'kicker':    return { text: 'অধ্যায় ০১', withLine: true };
    case 'quote':     return { text: '“জীবন যা ভাবো, তাই হয়ে ওঠে।”', author: '— লেখক', mark: true };
    case 'counter':   return { from: 0, to: 100, suffix: '', prefix: '', decimals: 0, locale: 'bn', label: '' };
    case 'progress':  return { value: 72, label: 'অগ্রগতি', showValue: true };
    case 'chartBar':  return { data: [{ l: '২০২১', v: 20 }, { l: '২০২২', v: 45 }, { l: '২০২৩', v: 70 }, { l: '২০২৪', v: 100 }], title: '' };
    case 'chartLine': return { data: [12, 28, 22, 48, 62, 58, 88], title: '', fill: true };
    case 'donut':     return { data: [{ l: 'কাজ', v: 45 }, { l: 'ঘুম', v: 30 }, { l: 'বিশ্রাম', v: 25 }], title: '' };
    case 'list':      return { items: ['প্রথম পদক্ষেপ', 'দ্বিতীয় পদক্ষেপ', 'তৃতীয় পদক্ষেপ'], stagger: 0.18, numbered: true };
    case 'cards':     return { cards: [{ t: 'শিরোনাম ১', d: 'বিবরণ লিখুন' }, { t: 'শিরোনাম ২', d: 'বিবরণ লিখুন' }, { t: 'শিরোনাম ৩', d: 'বিবরণ লিখুন' }], stagger: 0.16 };
    case 'image':     return { src: '', fit: 'cover', radius: 28, kenburns: 1.12, border: true, caption: '' };
    case 'divider':   return { style: 'line', width: 4 };
    case 'badge':     return { text: 'নতুন', icon: '●' };
    case 'watermark': return { text: 'তোমার চ্যানেল', corner: 'br' };
    default:          return {};
  }
}

/* ============================================================
   রঙ সমাধান
   ============================================================ */
function resolveColor(d, theme) {
  const c = theme.colors;
  switch (d.color) {
    case 'text':    return c.text;
    case 'muted':   return c.muted;
    case 'accent':  return c.accent;
    case 'accent2': return c.accent2;
    case 'custom':  return d.hex || c.text;
    case 'gradient': return `linear-gradient(100deg, ${c.text} 8%, ${c.accent} 48%, ${c.accent2} 92%)`;
    default:        return c.text;
  }
}
function applyColor(node, d, theme, useGradient = true) {
  const v = resolveColor(d, theme);
  if (v.startsWith('linear-gradient') && useGradient && theme.gradientText) {
    node.style.backgroundImage = v;
    node.style.webkitBackgroundClip = 'text';
    node.style.backgroundClip = 'text';
    node.style.color = 'transparent';
    node.style.webkitTextFillColor = 'transparent';
  } else {
    node.style.color = v.startsWith('linear-gradient') ? theme.colors.text : v;
  }
}
function applyShadow(node, d, theme) {
  node.style.textShadow = d.shadow
    ? `0 4px 40px ${hexA(theme.bg.base, 0.85)}, 0 2px 6px rgba(0,0,0,.45)`
    : 'none';
}

/* ============================================================
   এলিমেন্ট তৈরি → DOM নোড
   ============================================================ */
export function createElementNode(d, theme, stageW = 1920) {
  const wrap = el('div', { class: `cx-elem cx-${d.type}`, 'data-id': d.id });
  wrap.style.position = 'absolute';
  wrap.style.left = '0'; wrap.style.top = '0';
  wrap.style.width = `${d.w}%`;
  wrap.style.willChange = 'transform, opacity, filter';
  wrap.style.pointerEvents = 'none';

  const inner = el('div', { class: 'cx-inner' });
  inner.style.textAlign = d.align || 'center';
  inner.style.fontFamily = fontFamilyFor(d, theme);
  inner.style.fontWeight = String(d.weight ?? 700);
  inner.style.fontStyle = d.italic ? 'italic' : 'normal';
  inner.style.letterSpacing = (d.tracking || 0) + 'px';
  inner.style.lineHeight = String(d.lineH ?? 1.35);
  inner.style.fontSize = d.size + 'px';
  applyColor(inner, d, theme, d.type === 'title' || d.type === 'kicker');
  applyShadow(inner, d, theme);

  const ex = d.extra || {};
  const api = { wrap, inner, update: null };

  switch (d.type) {
    case 'title':
    case 'text':
    case 'kicker':
      buildTextNodes(inner, ex.text || '', d, theme);
      break;

    case 'quote': {
      const card = el('div', { class: 'cx-quote' });
      card.style.background = theme.colors.card;
      card.style.border = `1px solid ${theme.colors.cardLine}`;
      card.style.borderRadius = '32px';
      card.style.padding = '64px 78px';
      card.style.backdropFilter = 'blur(14px)';
      card.style.boxShadow = `0 40px 120px ${hexA(theme.bg.base, .6)}`;
      card.style.position = 'relative';
      if (ex.mark) {
        const m = el('div', { text: '❝' });
        m.style.cssText = `position:absolute;left:34px;top:-6px;font-size:150px;line-height:1;color:${hexA(theme.colors.accent, .35)};font-family:Georgia,serif;`;
        card.appendChild(m);
      }
      const bar = el('div');
      bar.style.cssText = `position:absolute;left:0;top:52px;bottom:52px;width:6px;border-radius:6px;background:linear-gradient(180deg,${theme.colors.accent},${theme.colors.accent2});`;
      card.appendChild(bar);
      const q = el('div', { text: ex.text || '' });
      q.style.cssText = `font-family:${theme.fonts.headline};font-weight:${d.weight};font-size:${d.size}px;line-height:${d.lineH};text-align:${d.align === 'center' ? 'center' : 'left'};`;
      applyColor(q, d, theme, true); applyShadow(q, d, theme);
      card.appendChild(q);
      if (ex.author) {
        const a = el('div', { text: ex.author });
        a.style.cssText = `margin-top:34px;font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .34)}px;letter-spacing:4px;color:${theme.colors.accent};font-weight:700;text-align:${d.align === 'center' ? 'center' : 'left'};`;
        card.appendChild(a);
      }
      inner.textContent = '';
      inner.appendChild(card);
      break;
    }

    case 'counter': {
      const box = el('div', { class: 'cx-counter' });
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.alignItems = d.align === 'left' ? 'flex-start' : (d.align === 'right' ? 'flex-end' : 'center');
      box.style.gap = '14px';
      const num = el('div', { class: 'cx-num', text: '0' });
      num.style.cssText = `font-family:${theme.fonts.number};font-weight:800;font-size:${d.size}px;line-height:1;font-variant-numeric:tabular-nums;`;
      applyColor(num, d, theme, true); applyShadow(num, d, theme);
      box.appendChild(num);
      if (ex.label) {
        const lab = el('div', { text: ex.label });
        lab.style.cssText = `font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .26)}px;letter-spacing:5px;color:${theme.colors.muted};font-weight:600;text-transform:uppercase;`;
        box.appendChild(lab);
      }
      inner.textContent = '';
      inner.appendChild(box);
      api.update = (t, lt, gt) => {
        const p = ease(d.enterEase || 'expoOut', invLerp(d.t + (d.enterDelay || 0), d.t + (d.enterDelay || 0) + Math.max(0.3, (ex.countDur || 1.4)), gt));
        const v = lerp(ex.from ?? 0, ex.to ?? 100, p);
        const txt = (ex.prefix || '') + formatNumber(v, ex.locale || 'bn', ex.decimals || 0) + (ex.suffix || '');
        if (num.textContent !== txt) num.textContent = txt;
        // পালস
        const pop = 1 + 0.06 * Math.sin(Math.min(1, p) * Math.PI) * (1 - p * 0.6);
        num.style.transform = `scale(${pop.toFixed(4)})`;
      };
      break;
    }

    case 'progress': {
      const box = el('div', { class: 'cx-progress' });
      box.style.width = '100%';
      box.style.display = 'flex'; box.style.flexDirection = 'column'; box.style.gap = '16px';
      const top = el('div');
      top.style.cssText = `display:flex;justify-content:space-between;align-items:baseline;gap:20px;`;
      const lab = el('div', { text: ex.label || '' });
      lab.style.cssText = `font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .38)}px;font-weight:700;color:${theme.colors.text};letter-spacing:2px;`;
      const val = el('div', { text: '' });
      val.style.cssText = `font-family:${theme.fonts.number};font-size:${Math.round(d.size * .48)}px;font-weight:800;color:${theme.colors.accent};font-variant-numeric:tabular-nums;`;
      top.append(lab, val);
      const track = el('div');
      track.style.cssText = `height:${Math.max(10, d.size * .22)}px;border-radius:999px;background:${hexA(theme.colors.text, .10)};overflow:hidden;box-shadow:inset 0 2px 8px rgba(0,0,0,.35);`;
      const fill = el('div');
      fill.style.cssText = `height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,${theme.colors.accent2},${theme.colors.accent});box-shadow:0 0 30px ${hexA(theme.colors.accent, .6)};`;
      track.appendChild(fill);
      box.append(top, track);
      inner.textContent = ''; inner.appendChild(box);
      api.update = (t, lt, gt) => {
        const s = d.t + (d.enterDelay || 0);
        const p = ease('expoOut', invLerp(s, s + Math.max(0.35, ex.barDur || 1.2), gt));
        const v = (ex.value || 0) * p;
        fill.style.width = v.toFixed(2) + '%';
        const txt = formatNumber(v, 'bn', 0) + '%';
        if (val.textContent !== txt) val.textContent = ex.showValue === false ? '' : txt;
      };
      break;
    }

    case 'chartBar': {
      const data = ex.data || [];
      const box = el('div', { class: 'cx-chart' });
      box.style.cssText = 'display:flex;flex-direction:column;gap:22px;width:100%;';
      if (ex.title) {
        const t = el('div', { text: ex.title });
        t.style.cssText = `font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .4)}px;font-weight:700;color:${theme.colors.text};text-align:${d.align};letter-spacing:2px;`;
        box.appendChild(t);
      }
      const max = Math.max(1, ...data.map(x => x.v || 0));
      const rows = data.map((it, i) => {
        const row = el('div');
        row.style.cssText = 'display:grid;grid-template-columns:1.1fr 4fr 0.7fr;align-items:center;gap:20px;';
        const l = el('div', { text: it.l });
        l.style.cssText = `font-family:${theme.fonts.body};font-size:${Math.round(d.size * .34)}px;color:${theme.colors.muted};font-weight:600;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
        const tr = el('div');
        tr.style.cssText = `height:${Math.round(d.size * .38)}px;background:${hexA(theme.colors.text, .07)};border-radius:10px;overflow:hidden;`;
        const f = el('div');
        const col = [theme.colors.chartA, theme.colors.chartB, theme.colors.chartC, theme.colors.chartD][i % 4];
        f.style.cssText = `height:100%;width:0%;border-radius:10px;background:linear-gradient(90deg,${hexA(col, .75)},${col});box-shadow:0 0 26px ${hexA(col, .45)};`;
        tr.appendChild(f);
        const v = el('div', { text: '' });
        v.style.cssText = `font-family:${theme.fonts.number};font-size:${Math.round(d.size * .38)}px;font-weight:800;color:${theme.colors.text};font-variant-numeric:tabular-nums;`;
        row.append(l, tr, v);
        box.appendChild(row);
        return { f, v, target: (it.v || 0) / max, val: it.v || 0, i };
      });
      inner.textContent = ''; inner.appendChild(box);
      api.update = (t, lt, gt) => {
        const s = d.t + (d.enterDelay || 0);
        rows.forEach((r, idx) => {
          const st = s + idx * (ex.stagger ?? 0.14);
          const p = ease('expoOut', invLerp(st, st + 0.85, gt));
          r.f.style.width = (r.target * 100 * p).toFixed(2) + '%';
          const txt = formatNumber(r.val * p, 'bn', 0);
          if (r.v.textContent !== txt) r.v.textContent = txt;
        });
      };
      break;
    }

    case 'chartLine': {
      const data = ex.data || [];
      const W = 1000, H = 420, PAD = 46;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.cssText = 'width:100%;height:auto;overflow:visible;';
      const max = Math.max(1, ...data), min = Math.min(0, ...data);
      const pts = data.map((v, i) => ({
        x: PAD + (W - PAD * 2) * (data.length < 2 ? .5 : i / (data.length - 1)),
        y: H - PAD - (H - PAD * 2) * ((v - min) / (max - min || 1)),
        v
      }));
      const defs = document.createElementNS(svgNS, 'defs');
      defs.innerHTML = `
        <linearGradient id="lg_${d.id}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${theme.colors.accent2}"/><stop offset="100%" stop-color="${theme.colors.accent}"/>
        </linearGradient>
        <linearGradient id="fa_${d.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${hexA(theme.colors.accent, .45)}"/><stop offset="100%" stop-color="${hexA(theme.colors.accent, 0)}"/>
        </linearGradient>
        <filter id="gl_${d.id}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`;
      svg.appendChild(defs);
      // গ্রিড
      for (let i = 0; i <= 4; i++) {
        const y = PAD + (H - PAD * 2) * i / 4;
        const ln = document.createElementNS(svgNS, 'line');
        ln.setAttribute('x1', PAD); ln.setAttribute('x2', W - PAD);
        ln.setAttribute('y1', y); ln.setAttribute('y2', y);
        ln.setAttribute('stroke', hexA(theme.colors.text, .09)); ln.setAttribute('stroke-width', '1.5');
        svg.appendChild(ln);
      }
      const dPath = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
      const area = document.createElementNS(svgNS, 'path');
      area.setAttribute('d', `${dPath} L ${pts[pts.length - 1]?.x ?? PAD} ${H - PAD} L ${pts[0]?.x ?? PAD} ${H - PAD} Z`);
      area.setAttribute('fill', `url(#fa_${d.id})`); area.setAttribute('opacity', '0');
      svg.appendChild(area);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', dPath);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', `url(#lg_${d.id})`);
      path.setAttribute('stroke-width', '7');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('filter', `url(#gl_${d.id})`);
      svg.appendChild(path);
      const dots = pts.map(p => {
        const c1 = document.createElementNS(svgNS, 'circle');
        c1.setAttribute('cx', p.x); c1.setAttribute('cy', p.y); c1.setAttribute('r', '0');
        c1.setAttribute('fill', theme.colors.text);
        c1.setAttribute('stroke', theme.colors.accent); c1.setAttribute('stroke-width', '5');
        svg.appendChild(c1); return c1;
      });
      inner.textContent = ''; inner.appendChild(svg);
      let L = 0;
      try { L = path.getTotalLength(); } catch (e) { L = 2000; }
      path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
      api.update = (t, lt, gt) => {
        const s = d.t + (d.enterDelay || 0);
        const p = ease('easeInOut', invLerp(s, s + (ex.drawDur || 1.6), gt));
        path.style.strokeDashoffset = (L * (1 - p)).toFixed(1);
        area.setAttribute('opacity', (p * .9).toFixed(3));
        dots.forEach((c, i) => {
          const dp = clamp((p * dots.length) - i, 0, 1);
          c.setAttribute('r', (10 * ease('backOut', dp)).toFixed(2));
        });
      };
      break;
    }

    case 'donut': {
      const data = ex.data || [];
      const svgNS = 'http://www.w3.org/2000/svg';
      const S = 460, R = 165, SW = 54;
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
      svg.style.cssText = `width:${d.size * 4.2}px;height:${d.size * 4.2}px;max-width:100%;overflow:visible;`;
      const total = data.reduce((a, b) => a + (b.v || 0), 0) || 1;
      const C = 2 * Math.PI * R;
      const segs = data.map((it, i) => {
        const cir = document.createElementNS(svgNS, 'circle');
        const col = [theme.colors.chartA, theme.colors.chartB, theme.colors.chartC, theme.colors.chartD][i % 4];
        cir.setAttribute('cx', S / 2); cir.setAttribute('cy', S / 2); cir.setAttribute('r', R);
        cir.setAttribute('fill', 'none'); cir.setAttribute('stroke', col); cir.setAttribute('stroke-width', SW);
        cir.setAttribute('stroke-linecap', 'round');
        cir.setAttribute('transform', `rotate(-90 ${S / 2} ${S / 2})`);
        cir.style.filter = `drop-shadow(0 0 18px ${hexA(col, .5)})`;
        svg.appendChild(cir);
        return { cir, frac: (it.v || 0) / total, col, i };
      });
      const mid = el('div', { text: '' });
      mid.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:${theme.fonts.number};font-weight:800;color:${theme.colors.text};pointer-events:none;`;
      const box = el('div');
      box.style.cssText = 'position:relative;display:inline-block;';
      box.append(svg, mid);
      inner.textContent = '';
      inner.style.display = 'flex'; inner.style.flexDirection = 'column'; inner.style.alignItems = 'center'; inner.style.gap = '18px';
      inner.appendChild(box);
      if (ex.title) {
        const t = el('div', { text: ex.title });
        t.style.cssText = `font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .4)}px;font-weight:700;color:${theme.colors.muted};letter-spacing:3px;`;
        inner.appendChild(t);
      }
      api.update = (t, lt, gt) => {
        const s = d.t + (d.enterDelay || 0);
        const p = ease('expoOut', invLerp(s, s + (ex.drawDur || 1.3), gt));
        let acc = 0;
        segs.forEach(sg => {
          const frac = sg.frac * p;
          const dash = frac * C;
          const gap = Math.max(0, C - dash);
          sg.cir.setAttribute('stroke-dasharray', `${dash.toFixed(2)} ${gap.toFixed(2)}`);
          sg.cir.setAttribute('stroke-dashoffset', `${(-acc * C).toFixed(2)}`);
          acc += sg.frac;
        });
        const pct = Math.round(p * 100);
        mid.innerHTML = `<div style="font-size:${d.size * 1.05}px;line-height:1;">${formatNumber(pct, 'bn', 0)}<span style="font-size:${d.size * .45}px">%</span></div>`;
      };
      break;
    }

    case 'list': {
      const items = ex.items || [];
      const ul = el('div', { class: 'cx-list' });
      ul.style.cssText = `display:flex;flex-direction:column;gap:${Math.round(d.size * .34)}px;width:100%;align-items:${d.align === 'center' ? 'center' : 'flex-start'};`;
      const rows = items.map((it, i) => {
        const row = el('div');
        row.style.cssText = `display:flex;align-items:center;gap:${Math.round(d.size * .3)}px;max-width:100%;`;
        const bullet = el('div');
        const bw = Math.round(d.size * .62);
        bullet.style.cssText = `flex:0 0 ${bw}px;width:${bw}px;height:${bw}px;border-radius:${ex.numbered ? '14px' : '50%'};display:flex;align-items:center;justify-content:center;font-family:${theme.fonts.number};font-weight:800;font-size:${Math.round(d.size * .34)}px;color:${theme.bg.base};background:linear-gradient(135deg,${theme.colors.accent},${theme.colors.accent2});box-shadow:0 8px 30px ${hexA(theme.colors.accent, .35)};`;
        bullet.textContent = ex.numbered === false ? '✓' : formatNumber(i + 1, 'bn', 0);
        const tx = el('div', { text: it });
        tx.style.cssText = `font-family:${theme.fonts.body};font-size:${d.size}px;font-weight:${d.weight};line-height:${d.lineH};text-align:left;`;
        applyColor(tx, { ...d, color: d.color === 'gradient' ? 'text' : d.color }, theme, false);
        applyShadow(tx, d, theme);
        row.append(bullet, tx);
        ul.appendChild(row);
        return row;
      });
      inner.textContent = ''; inner.appendChild(ul);
      api.update = (t, lt, gt) => {
        const s = d.t + (d.enterDelay || 0);
        rows.forEach((r, i) => {
          const st = s + i * (ex.stagger ?? 0.18);
          const p = ease(d.enterEase || 'expoOut', invLerp(st, st + (d.enterDur || 0.6), gt));
          r.style.opacity = p.toFixed(3);
          r.style.transform = `translateX(${((1 - p) * -60).toFixed(2)}px)`;
        });
      };
      break;
    }

    case 'cards': {
      const cards = ex.cards || [];
      const grid = el('div', { class: 'cx-cards' });
      grid.style.cssText = `display:grid;grid-template-columns:repeat(${clamp(cards.length, 1, 4)},1fr);gap:${Math.round(d.size * .45)}px;width:100%;`;
      const nodes = cards.map((cd, i) => {
        const card = el('div');
        card.style.cssText = `background:${theme.colors.card};border:1px solid ${theme.colors.cardLine};border-radius:26px;padding:${Math.round(d.size * .55)}px ${Math.round(d.size * .45)}px;backdrop-filter:blur(12px);display:flex;flex-direction:column;gap:${Math.round(d.size * .2)}px;box-shadow:0 30px 80px ${hexA(theme.bg.base, .5)};position:relative;overflow:hidden;`;
        const top = el('div');
        top.style.cssText = `position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,${theme.colors.accent},${theme.colors.accent2});`;
        const n = el('div', { text: formatNumber(i + 1, 'bn', 0).padStart(2, '০') });
        n.style.cssText = `font-family:${theme.fonts.number};font-size:${Math.round(d.size * .5)}px;font-weight:800;color:${hexA(theme.colors.accent, .85)};`;
        const t = el('div', { text: cd.t || '' });
        t.style.cssText = `font-family:${theme.fonts.headline};font-size:${Math.round(d.size * .58)}px;font-weight:800;line-height:1.25;color:${theme.colors.text};`;
        const dd = el('div', { text: cd.d || '' });
        dd.style.cssText = `font-family:${theme.fonts.body};font-size:${Math.round(d.size * .4)}px;line-height:1.6;color:${theme.colors.muted};`;
        card.append(top, n, t, dd);
        grid.appendChild(card);
        return card;
      });
      inner.textContent = ''; inner.appendChild(grid);
      api.update = (t, lt, gt) => {
        const s = d.t + (d.enterDelay || 0);
        nodes.forEach((nd, i) => {
          const st = s + i * (ex.stagger ?? 0.16);
          const p = ease('expoOut', invLerp(st, st + (d.enterDur || 0.7), gt));
          nd.style.opacity = p.toFixed(3);
          nd.style.transform = `translateY(${((1 - p) * 60).toFixed(1)}px) scale(${lerp(.93, 1, p).toFixed(4)})`;
        });
      };
      break;
    }

    case 'image': {
      const box = el('div', { class: 'cx-img' });
      box.style.cssText = `position:relative;width:100%;border-radius:${ex.radius ?? 24}px;overflow:hidden;background:${hexA(theme.colors.text, .06)};box-shadow:0 40px 120px ${hexA(theme.bg.base, .7)};`;
      if (ex.border) box.style.border = `1px solid ${theme.colors.cardLine}`;
      const img = el('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;transform-origin:center;';
      img.setAttribute('draggable', 'false');
      if (ex.src) img.src = ex.src;
      else {
        img.style.display = 'none';
        const ph = el('div', { text: 'ছবি যোগ করুন' });
        ph.style.cssText = `height:${d.size * 4}px;display:flex;align-items:center;justify-content:center;font-family:${theme.fonts.body};font-size:${Math.round(d.size * .4)}px;color:${theme.colors.muted};border:2px dashed ${theme.colors.cardLine};border-radius:${ex.radius ?? 24}px;`;
        box.appendChild(ph);
      }
      box.appendChild(img);
      // অনুপাত রাখতে
      box.style.aspectRatio = ex.ratio || '16/9';
      if (ex.caption) {
        const cap = el('div', { text: ex.caption });
        cap.style.cssText = `margin-top:16px;font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .32)}px;color:${theme.colors.muted};letter-spacing:2px;text-align:center;`;
        box.appendChild(cap);
      }
      inner.textContent = ''; inner.appendChild(box);
      api.update = (t, lt, gt) => {
        if (!ex.src) return;
        const kb = ex.kenburns || 1;
        const sc = lerp(1, kb, clamp(lt));
        const dx = Math.sin(t * 0.12) * 12, dy = Math.cos(t * 0.1) * 8;
        img.style.transform = `scale(${sc.toFixed(4)}) translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
      };
      break;
    }

    case 'divider': {
      const line = el('div');
      line.style.cssText = `height:${ex.width || 4}px;width:100%;border-radius:99px;background:linear-gradient(90deg,${hexA(theme.colors.accent, 0)},${theme.colors.accent} 30%,${theme.colors.accent2} 70%,${hexA(theme.colors.accent2, 0)});transform-origin:${d.align === 'right' ? 'right' : (d.align === 'left' ? 'left' : 'center')};`;
      inner.textContent = ''; inner.appendChild(line);
      api.update = (t, lt, gt) => {
        const s = d.t + (d.enterDelay || 0);
        const p = ease('expoOut', invLerp(s, s + (d.enterDur || .8), gt));
        line.style.transform = `scaleX(${p.toFixed(4)})`;
      };
      break;
    }

    case 'badge': {
      const b = el('div', { class: 'cx-badge' });
      b.style.cssText = `display:inline-flex;align-items:center;gap:14px;padding:16px 34px;border-radius:999px;background:${hexA(theme.colors.accent, .14)};border:1.5px solid ${hexA(theme.colors.accent, .45)};font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .42)}px;font-weight:700;letter-spacing:4px;color:${theme.colors.accent};backdrop-filter:blur(8px);`;
      if (ex.icon) { const i = el('span', { text: ex.icon }); i.style.fontSize = `${Math.round(d.size * .34)}px`; b.appendChild(i); }
      b.appendChild(document.createTextNode(ex.text || ''));
      inner.textContent = ''; inner.appendChild(b);
      api.update = (t, lt, gt) => {
        const pulse = 1 + 0.02 * Math.sin(t * 2.2);
        b.style.transform = `scale(${pulse.toFixed(4)})`;
      };
      break;
    }

    case 'watermark': {
      const w = el('div', { text: ex.text || '' });
      w.style.cssText = `font-family:${theme.fonts.kicker};font-size:${Math.round(d.size * .34)}px;letter-spacing:6px;font-weight:700;color:${hexA(theme.colors.text, .55)};`;
      inner.textContent = ''; inner.appendChild(w);
      break;
    }
  }

  wrap.appendChild(inner);
  return api;
}

/* ---------- টেক্সট নোড (word-by-word / char-by-char সাপোর্ট সহ) ---------- */
function buildTextNodes(inner, text, d, theme) {
  inner.textContent = '';
  const str = String(text || '');
  if (d.enter === 'wordByWord' || d.enter === 'typewriter') {
    const words = str.split(/(\s+)/);
    inner._parts = words.map((w, i) => {
      if (!w.trim()) { inner.appendChild(document.createTextNode(w)); return null; }
      const s = el('span', { text: w });
      s.style.cssText = 'display:inline-block;will-change:transform,opacity;';
      inner.appendChild(s);
      return s;
    }).filter(Boolean);
  } else {
    inner.textContent = str;
    inner._parts = null;
  }
}

/* ============================================================
   প্রতি-ফ্রেম আপডেট (enter/hold/exit + layout)
   ============================================================ */
const DIRS = {
  slideLeft: [-1, 0], slideRight: [1, 0], slideUp: [0, -1], slideDown: [0, 1],
  rise: [0, 1], dropIn: [0, -1],
};

export function updateElement(api, d, theme, t, sceneT, stageW = 1920) {
  if (!api) return;
  const { wrap, inner } = api;
  const s = d.t + (d.enterDelay || 0);
  const e = Math.max(s + 0.15, d.t + d.dur);

  // --- দৃশ্যমানতা ---
  const visible = t >= s - 0.02 && t <= e + (d.exitDur || 0);
  wrap.style.display = visible ? 'block' : 'none';
  if (!visible) return;

  const inP = ease(d.enterEase || 'expoOut', invLerp(s, s + (d.enterDur || 0.6), t));
  const outStart = e - (d.exitDur || 0);
  const outP = d.exit && d.exit !== 'none' ? ease(d.exitEase || 'easeIn', invLerp(outStart, e, t)) : 0;

  let tx = 0, ty = 0, sc = 1, rot = 0, blur = 0, alpha = d.opacity ?? 1;

  // এন্টার
  const enter = d.enter || 'rise';
  switch (enter) {
    case 'fade': alpha *= inP; break;
    case 'rise': case 'slideLeft': case 'slideRight': case 'slideUp': case 'slideDown': case 'dropIn': {
      const [dx, dy] = DIRS[enter] || [0, 1];
      const dist = d.size * (enter === 'dropIn' ? 2.2 : 1.1);
      tx += dx * (1 - inP) * dist;
      ty += dy * (1 - inP) * dist;
      alpha *= clamp(inP * 1.6);
      break;
    }
    case 'zoomIn': sc = lerp(1.28, 1, inP); alpha *= inP; break;
    case 'zoomOut': case 'scaleIn': sc = lerp(0.62, 1, inP); alpha *= inP; break;
    case 'blurIn': blur = (1 - inP) * 26; ty += (1 - inP) * 26; alpha *= clamp(inP * 1.4); break;
    case 'flipIn': rot = (1 - inP) * -80; sc = lerp(0.9, 1, inP); alpha *= inP; break;
    case 'lineMask': { /* লাইন-মাস্ক নিচে হ্যান্ডেল */ alpha *= clamp(inP * 2); break; }
    case 'wordByWord':
    case 'typewriter': {
      const parts = inner._parts || [];
      const n = Math.max(1, parts.length);
      parts.forEach((p, i) => {
        const st = (i / n) * 0.72;
        const pp = ease('expoOut', invLerp(st, st + 0.28, inP));
        p.style.opacity = pp.toFixed(3);
        p.style.transform = enter === 'typewriter'
          ? `translateY(${((1 - pp) * 6).toFixed(1)}px)`
          : `translateY(${((1 - pp) * 34).toFixed(1)}px) scale(${lerp(.88, 1, pp).toFixed(3)})`;
        if (enter === 'typewriter') p.style.filter = `blur(${((1 - pp) * 5).toFixed(1)}px)`;
      });
      alpha *= clamp(inP * 3);
      break;
    }
    case 'wipeRight': {
      inner.style.clipPath = `inset(0 ${(100 * (1 - inP)).toFixed(2)}% 0 0)`;
      tx += (1 - inP) * -30;
      break;
    }
  }

  // এক্সিট
  if (outP > 0) {
    switch (d.exit) {
      case 'fade': alpha *= (1 - outP); break;
      case 'slideUp': ty -= outP * d.size * 1.2; alpha *= (1 - outP); break;
      case 'slideDown': ty += outP * d.size * 1.2; alpha *= (1 - outP); break;
      case 'zoomOut': sc *= lerp(1, 1.22, outP); alpha *= (1 - outP); blur += outP * 8; break;
      case 'scaleDown': sc *= lerp(1, 0.82, outP); alpha *= (1 - outP); break;
      case 'blurOut': blur += outP * 24; alpha *= (1 - outP); break;
      case 'wipeRight': inner.style.clipPath = `inset(0 0 0 ${(100 * outP).toFixed(2)}%)`; alpha *= (1 - outP * .5); break;
    }
  } else if (d.exit !== 'wipeRight') {
    inner.style.clipPath = '';
  }

  // লাইন-মাস্ক: প্রতিটি লাইন আলাদা ক্লিপ
  if (enter === 'lineMask') {
    const txt = String(d.extra?.text || '');
    const lines = txt.split('\n');
    if (inner._lines === undefined || inner._lineSrc !== txt) {
      inner.textContent = '';
      inner._lineSrc = txt;
      inner._lines = lines.map(L => {
        const mask = el('div');
        mask.style.cssText = 'overflow:hidden;display:block;';
        const span = el('span', { text: L || '\u00A0' });
        span.style.cssText = 'display:block;will-change:transform;';
        mask.appendChild(span);
        inner.appendChild(mask);
        return span;
      });
    }
    inner._lines.forEach((span, i) => {
      const st = (i / Math.max(1, inner._lines.length)) * 0.55;
      const pp = ease('expoOut', invLerp(st, st + 0.45, inP));
      span.style.transform = `translateY(${((1 - pp) * 108).toFixed(2)}%)`;
      span.style.opacity = clamp(pp * 1.5).toFixed(3);
    });
  }

  // বসানো (center anchor)
  const cx = (d.x / 100) * stageW;
  const cy = (d.y / 100) * 1080;
  wrap.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -50%) translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`;
  wrap.style.opacity = clamp(alpha).toFixed(3);
  wrap.style.filter = blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : 'none';

  if (api.update) api.update(t, invLerp(s, e, t), t);
}

function fontFamilyFor(d, theme) {
  if (d.type === 'title' || d.type === 'quote') return theme.fonts.headline;
  if (d.type === 'kicker' || d.type === 'badge' || d.type === 'watermark') return theme.fonts.kicker;
  if (d.type === 'counter') return theme.fonts.number;
  return theme.fonts.body;
}
