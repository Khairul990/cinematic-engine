/* ============================================================
   Cinematic Engine — timeline.js
   ভিজ্যুয়াল টাইমলাইন: রুলার, ওয়েভফর্ম, সিন ব্লক (ড্র্যাগ/ট্রিম),
   এলিমেন্ট চিপ, প্লেহেড
   ============================================================ */

import { clamp, el, fmtTime, round } from './util.js';
import { buildWaveformPeaks } from './audio.js';

const ROWS = { ruler: 22, wave: 56, scenes: 62, elements: 46 };

export class Timeline {
  constructor(root, opts = {}) {
    this.root = root;
    this.ruler = root.querySelector('#tlRuler');
    this.wave = root.querySelector('#tlWave');
    this.waveCanvas = root.querySelector('#tlWaveCanvas');
    this.scenesHost = root.querySelector('#tlScenes');
    this.elemsHost = root.querySelector('#tlElements');
    this.playhead = root.querySelector('#tlPlayhead');
    this.scroll = root.querySelector('#tlScroll');
    this.inner = root.querySelector('#tlInner');
    this.stats = root.querySelector('#tlStats');
    this.zoomRange = root.querySelector('#zoomRange');

    this.project = null;
    this.analysis = null;
    this.pps = 90;              // pixels per second
    this.duration = 30;
    this.selectedScene = null;
    this.selectedElem = null;
    this.onSelectScene = opts.onSelectScene || (() => { });
    this.onSelectElem = opts.onSelectElem || (() => { });
    this.onScrub = opts.onScrub || (() => { });
    this.onEditScene = opts.onEditScene || (() => { });   // ড্র্যাগ/ট্রিম শেষ
    this.onEditElem = opts.onEditElem || (() => { });
    this.playheadTime = 0;
    this.peaks = null;
    this._drag = null;

    this.zoomRange.addEventListener('input', () => {
      this.pps = +this.zoomRange.value;
      this.render();
    });

    this.scroll.addEventListener('scroll', () => { /* প্লেহেড অটো-স্ক্রল নিচে */ });
  }

  setZoom(pps) {
    this.pps = clamp(pps, 20, 400);
    this.zoomRange.value = String(Math.round(this.pps));
    this.render();
  }
  zoomFit() {
    const w = this.scroll.clientWidth - 20;
    this.setZoom(clamp(w / Math.max(1, this.duration), 20, 400));
  }

  setData(project, analysis) {
    this.project = project;
    this.analysis = analysis;
    const scenes = project?.scenes || [];
    const last = scenes[scenes.length - 1];
    const sceneEnd = last ? last.start + last.dur : 0;
    this.duration = Math.max(10, sceneEnd + 2, Number(project?.audio?.duration) || 0);
    if (!isFinite(this.duration)) this.duration = 30;
    this.peaks = analysis ? buildWaveformPeaks(analysis, Math.min(2000, Math.round(this.duration * 12))) : null;
    this.render();
  }

  select(sceneId, elemId = null) {
    this.selectedScene = sceneId;
    this.selectedElem = elemId;
    this.paintSelection();
  }

  render() {
    if (!this.project) return;
    const W = Math.max(this.scroll.clientWidth, this.duration * this.pps);
    this.inner.style.width = W + 'px';
    this.renderRuler(W);
    this.renderWave(W);
    this.renderScenes();
    this.renderElements();
    this.updatePlayhead(this.playheadTime);
    const scenes = this.project.scenes || [];
    const tot = scenes.reduce((a, s) => a + s.dur, 0);
    this.stats.textContent = `${scenes.length} সিন · ${fmtTime(tot, 1)} · ${fmtTime(this.duration, 1)} মোট`;
  }

  /* ---------- রুলার ---------- */
  renderRuler(W) {
    this.ruler.innerHTML = '';
    this.ruler.style.width = W + 'px';
    // টিক স্টেপ বাছাই
    const targets = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const minPx = 62;
    let step = targets[targets.length - 1];
    for (const t of targets) { if (t * this.pps >= minPx) { step = t; break; } }
    for (let s = 0; s <= this.duration + step; s += step) {
      const x = s * this.pps;
      if (!(x >= 0) || x > W) break;
      const major = Number.isInteger(s);
      const t = el('div', { class: 'tick' + (major ? ' major' : '') });
      t.style.left = x + 'px';
      if (major || step >= 1) t.appendChild(el('span', { text: fmtTime(s, step < 1 ? 1 : 0) }));
      this.ruler.appendChild(t);
    }
  }

  /* ---------- ওয়েভফর্ম ---------- */
  renderWave(W) {
    this.wave.style.width = W + 'px';
    const cv = this.waveCanvas;
    const H = 56;
    cv.width = Math.max(1, Math.min(9000, Math.round(W)));
    cv.height = H;
    cv.style.width = W + 'px';
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);

    // সিগমেন্ট ছায়া
    if (this.analysis?.segments?.length) {
      g.fillStyle = 'rgba(245,196,81,0.055)';
      for (const s of this.analysis.segments) {
        g.fillRect(s.start * this.pps, 0, (s.end - s.start) * this.pps, H);
      }
    }

    const peaks = this.peaks;
    if (peaks && peaks.length) {
      const perPx = peaks.length / W;
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(125,211,252,.85)');
      grad.addColorStop(0.5, 'rgba(245,196,81,.9)');
      grad.addColorStop(1, 'rgba(125,211,252,.85)');
      g.fillStyle = grad;
      const mid = H / 2;
      for (let x = 0; x < W; x++) {
        const i0 = Math.floor(x * perPx), i1 = Math.max(i0 + 1, Math.floor((x + 1) * perPx));
        let m = 0;
        for (let i = i0; i < i1 && i < peaks.length; i++) if (peaks[i] > m) m = peaks[i];
        const h = Math.max(1, m * (H * 0.46));
        g.fillRect(x, mid - h, 1, h * 2);
      }
    } else {
      g.strokeStyle = 'rgba(255,255,255,.07)';
      g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.font = '11px Hind Siliguri, sans-serif';
      g.fillText('অডিও আপলোড করলে ওয়েভফর্ম দেখা যাবে', 12, H / 2 - 8);
    }
  }

  /* ---------- সিন ব্লক ---------- */
  renderScenes() {
    const host = this.scenesHost;
    host.innerHTML = '';
    host.style.width = (this.duration * this.pps) + 'px';
    const scenes = this.project?.scenes || [];
    const palette = ['#f5c451', '#7dd3fc', '#fb7185', '#86efac', '#c4b5fd', '#fdba74', '#5eead4', '#f9a8d4'];

    scenes.forEach((sc, i) => {
      const x = sc.start * this.pps;
      const w = Math.max(6, sc.dur * this.pps);
      const col = palette[i % palette.length];
      const b = el('div', { class: 'tl-block', 'data-scene': sc.id });
      b.style.left = x + 'px';
      b.style.width = w + 'px';
      const txt = sceneSummary(sc);
      b.innerHTML = `
        <div class="stripe" style="background:${col}"></div>
        <div class="bh"><span>${escapeHtml(sc.name || `সিন ${i + 1}`)}</span><i>${sc.dur.toFixed(2)}s</i></div>
        <div class="bb">${escapeHtml(txt)}</div>
        <div class="handle l"></div><div class="handle r"></div>
      `;
      if (sc.id === this.selectedScene) b.classList.add('active');

      // ড্র্যাগ / ট্রিম
      b.addEventListener('pointerdown', ev => this.startDrag(ev, sc, b));
      b.addEventListener('dblclick', ev => { ev.stopPropagation(); this.onSelectScene(sc.id, true); });
      host.appendChild(b);
    });

    // ফাঁকা জায়গায় ক্লিক = স্ক্রাব, ডাবল = ডিসিলেক্ট
    host.onpointerdown = ev => {
      if (ev.target === host) {
        const rect = host.getBoundingClientRect();
        this.onScrub(clamp((ev.clientX - rect.left) / this.pps, 0, this.duration));
      }
    };
  }

  startDrag(ev, sc, node) {
    ev.preventDefault(); ev.stopPropagation();
    const rect = node.getBoundingClientRect();
    const EDGE = 12;   // কিনারার এত পিক্সেলের ভেতরে = রিসাইজ
    const nearL = ev.clientX - rect.left <= EDGE;
    const nearR = rect.right - ev.clientX <= EDGE;
    const onHandle = ev.target.classList.contains('handle');
    let mode = 'move';
    if (onHandle) mode = ev.target.classList.contains('l') ? 'trimL' : 'trimR';
    else if (nearL) mode = 'trimL';
    else if (nearR) mode = 'trimR';
    const startX = ev.clientX;
    const orig = { start: sc.start, dur: sc.dur };
    const scenes = this.project.scenes;
    const idx = scenes.indexOf(sc);
    const minDur = 0.3;

    // প্রথমে ক্লিক = সিলেক্ট
    this.onSelectScene(sc.id, false);
    node.classList.add('dragging');
    node.setPointerCapture?.(ev.pointerId);

    let moved = false;
    const onMove = e => {
      const dx = (e.clientX - startX) / this.pps;
      if (Math.abs(dx) > 0.002) moved = true;

      if (mode === 'move') {
        let ns = clamp(orig.start + dx, 0, this.duration - minDur);
        // প্রতিবেশীর মধ্যে ঢুকতে দেব না
        const prev = scenes[idx - 1], next = scenes[idx + 1];
        if (prev) ns = Math.max(ns, prev.start + minDur);
        if (next) ns = Math.min(ns, next.start + next.dur - minDur);
        sc.start = round(ns, 3);
        // প্রতিবেশীর দৈর্ঘ্য ঠিক
        if (prev) prev.dur = round(Math.max(minDur, sc.start - prev.start), 3);
        if (next) next.dur = round(Math.max(minDur, next.start + next.dur - (sc.start + sc.dur)), 3);
      } else if (mode === 'trimL') {
        const prev = scenes[idx - 1];
        const lo = prev ? prev.start + minDur : 0;
        let ns = clamp(orig.start + dx, lo, orig.start + orig.dur - minDur);
        const shift = ns - orig.start;
        sc.start = round(ns, 3);
        sc.dur = round(Math.max(minDur, orig.dur - shift), 3);
        if (prev) prev.dur = round(Math.max(minDur, sc.start - prev.start), 3);
        shiftElements(sc, shift, false);
      } else {
        const next = scenes[idx + 1];
        const hi = next ? next.start : this.duration;
        let nd = clamp(orig.dur + dx, minDur, hi - orig.start);
        sc.dur = round(nd, 3);
        if (next) {
          const nextEnd = next.start + next.dur;
          next.start = round(sc.start + sc.dur, 3);
          next.dur = round(Math.max(minDur, nextEnd - next.start), 3);
          shiftElements(next, next.start - (orig.start + orig.dur));
        }
        scaleElements(sc, orig.dur, nd);
      }
      this.render();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      node.classList.remove('dragging');
      if (moved) this.onEditScene(sc.id, mode);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  /* ---------- এলিমেন্ট চিপ ---------- */
  renderElements() {
    const host = this.elemsHost;
    host.innerHTML = '';
    host.style.width = (this.duration * this.pps) + 'px';
    const scenes = this.project?.scenes || [];
    const maxRows = 2;

    scenes.forEach((sc, si) => {
      const els = (sc.elements || []).filter(e => e.type !== 'watermark');
      els.slice(0, 8).forEach((e, ei) => {
        const row = ei % maxRows;
        const rowHost = host.querySelector(`[data-row="${row}"]`) || (() => {
          const r = el('div', { class: 'tl-el-row', 'data-row': String(row) });
          r.style.top = (row * 21) + 'px';
          host.appendChild(r); return r;
        })();
        const x = (sc.start + e.t) * this.pps;
        const w = Math.max(4, e.dur * this.pps);
        const chip = el('div', { class: 'tl-chip', text: shortLabel(e) });
        chip.style.left = x + 'px';
        chip.style.width = w + 'px';
        chip.title = `${labelOfType(e.type)} · ${e.t.toFixed(2)}s → ${(e.t + e.dur).toFixed(2)}s`;
        if (this.selectedScene === sc.id && this.selectedElem === e.id) chip.classList.add('active');
        chip.addEventListener('pointerdown', ev => {
          ev.stopPropagation();
          this.onSelectElem(sc.id, e.id);
          this.startElemDrag(ev, sc, e, chip);
        });
        rowHost.appendChild(chip);
      });
    });
    host.style.height = (maxRows * 21 + 8) + 'px';
  }

  startElemDrag(ev, sc, e, node) {
    const startX = ev.clientX, startY = ev.clientY;
    const o = { t: e.t, dur: e.dur };
    let mode = null;
    const onMove = m => {
      const dx = (m.clientX - startX) / this.pps;
      const dy = m.clientY - startY;
      if (!mode) {
        if (Math.abs(dx) > 0.004) mode = 'move';
        else if (Math.abs(dy) > 3) mode = 'none';
        else return;
      }
      if (mode === 'move') {
        e.t = round(clamp(o.t + dx, 0, Math.max(0.05, sc.dur - 0.2)), 3);
        e.dur = round(Math.min(o.dur, sc.dur - e.t), 3);
        this.render();
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (mode === 'move') this.onEditElem(sc.id, e.id);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  /* ---------- প্লেহেড ---------- */
  updatePlayhead(t) {
    this.playheadTime = t;
    const x = t * this.pps;
    this.playhead.style.transform = `translateX(${x}px)`;
    // অটো স্ক্রল
    const sl = this.scroll;
    const view = sl.clientWidth;
    if (x < sl.scrollLeft + 40 || x > sl.scrollLeft + view - 80) {
      sl.scrollLeft = Math.max(0, x - view * 0.35);
    }
  }

  paintSelection() {
    this.root.querySelectorAll('.tl-block').forEach(n =>
      n.classList.toggle('active', n.dataset.scene === this.selectedScene));
    this.root.querySelectorAll('.tl-chip').forEach(n => n.classList.remove('active'));
    // চিপগুলো হালকা — দরকারে রি-রেন্ডার
    this.renderElements();
  }

  scrollToScene(sc) {
    const x = sc.start * this.pps;
    this.scroll.scrollLeft = Math.max(0, x - 80);
  }
}

/* ---------- হেল্পার ---------- */
function shiftElements(sc, shift, scale = false) {
  sc.elements.forEach(e => { e.t = round(clamp(e.t - shift, 0, sc.dur - 0.1), 3); });
}
function scaleElements(sc, oldDur, newDur) {
  if (oldDur <= 0) return;
  const k = newDur / oldDur;
  sc.elements.forEach(e => {
    e.t = round(clamp(e.t * k, 0, Math.max(0.05, newDur - 0.1)), 3);
    e.dur = round(clamp(e.dur * k, 0.25, newDur - e.t), 3);
  });
}
export { scaleElements, shiftElements };

function sceneSummary(sc) {
  const t = (sc.elements || []).find(e => e.type === 'title' || e.type === 'text' || e.type === 'quote');
  return t?.extra?.text || sc.note || labelOfType(sc.template);
}
function shortLabel(e) {
  const txt = e.extra?.text || e.extra?.label || e.extra?.title || '';
  const base = labelOfType(e.type);
  return txt ? `${base}: ${txt.slice(0, 26)}` : base;
}
export function labelOfType(t) {
  const M = {
    title: 'টাইটেল', text: 'টেক্সট', kicker: 'কিকার', quote: 'উক্তি', counter: 'কাউন্টার',
    progress: 'প্রোগ্রেস', chartBar: 'বার চার্ট', chartLine: 'লাইন চার্ট', donut: 'ডোনাট',
    list: 'তালিকা', cards: 'কার্ড', image: 'ছবি', divider: 'ডিভাইডার', badge: 'ব্যাজ', watermark: 'ওয়াটারমার্ক',
    hero: 'হিরো', titleBig: 'বড় টাইটেল', lineCenter: 'কেন্দ্রীয় লাইন', lineMask: 'লাইন মাস্ক',
    kickerLine: 'কিকার+লাইন', bigWord: 'বড় শব্দ', twoColumn: 'দুই কলাম', listSteps: 'ধাপ তালিকা',
    cardsRow: 'কার্ড সারি', imageStory: 'ছবি+টেক্সট', chapter: 'অধ্যায়', outro: 'আউট্রো'
  };
  return M[t] || t;
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
