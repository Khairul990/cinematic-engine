/* ============================================================
   Cinematic Engine — render.js
   DOM স্টেজ রেন্ডারার + অডিও-সিঙ্ক প্লেব্যাক ইঞ্জিন
   ============================================================ */

import { clamp, lerp, ease, invLerp, el, round } from './util.js';
import { getTheme, applyThemeVars } from './themes.js';
import { makeEffect } from './effects.js';
import { createElementNode, updateElement } from './elements.js';

/* ---------- স্টেজ বিল্ডার ---------- */
export function buildStageRoot() {
  const stage = el('div', { class: 'cx-stage' });
  stage.innerHTML = `
    <div class="cx-bg-layer" data-layer="bg"></div>
    <canvas class="cx-fx" data-layer="fx"></canvas>
    <div class="cx-bloom" data-layer="bloom"></div>
    <div class="cx-scenes" data-layer="scenes"></div>
    <div class="cx-vignette" data-layer="vignette"></div>
    <div class="cx-grain" data-layer="grain"></div>
    <div class="cx-scanlines" data-layer="scan"></div>
    <div class="cx-bars" data-layer="bars"></div>
    <div class="cx-guides" data-layer="guides" style="display:none"></div>
  `;
  return stage;
}

/* ---------- গ্রেইন টেক্সচার (প্রি-রেন্ডার) ---------- */
let grainCache = null;
function buildGrain(size = 256, frames = 5) {
  if (grainCache) return grainCache;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const urls = [];
  for (let f = 0; f < frames; f++) {
    const img = g.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 110 + Math.random() * 145;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    urls.push(c.toDataURL('image/png'));
  }
  grainCache = urls;
  return urls;
}

/* ============================================================
   StageRenderer
   ============================================================ */
export class StageRenderer {
  constructor(stageEl, opts = {}) {
    this.stage = stageEl;
    this.layers = {
      bg: stageEl.querySelector('[data-layer=bg]'),
      fx: stageEl.querySelector('[data-layer=fx]'),
      bloom: stageEl.querySelector('[data-layer=bloom]'),
      scenes: stageEl.querySelector('[data-layer=scenes]'),
      vignette: stageEl.querySelector('[data-layer=vignette]'),
      grain: stageEl.querySelector('[data-layer=grain]'),
      scan: stageEl.querySelector('[data-layer=scan]'),
      bars: stageEl.querySelector('[data-layer=bars]'),
      guides: stageEl.querySelector('[data-layer=guides]'),
    };
    this.fxCanvas = this.layers.fx;
    this.W = 1920; this.H = 1080;
    this.project = null;
    this.theme = null;
    this.sceneNodes = new Map();   // id -> node bundle
    this.lastGrain = -1;
    this.quality = opts.quality ?? 'high';
    this.grainUrls = buildGrain();
    this._guidesBuilt = false;
  }

  /** প্রজেক্ট (বা শুধু theme/settings) সেট → পুরো স্টেজ রিবিল্ড */
  setSize(w, h) {
    const changed = (w !== this.W) || (h !== this.H);
    this.W = w; this.H = h;
    this.stage.style.width = w + 'px';
    this.stage.style.height = h + 'px';
    this.stage.style.setProperty('--stage-w', w + 'px');
    this.stage.style.setProperty('--stage-h', h + 'px');
    if (changed && this.project) this.rebuildScenes();
  }

  setProject(project, { rebuild = true } = {}) {
    this.project = project;
    const dims = aspectDims(project.meta.aspect);
    if (dims && (dims.w !== this.W || dims.h !== this.H)) { this.W = dims.w; this.H = dims.h; }
    this.theme = getTheme(project.meta.theme);
    applyThemeVars(this.stage, this.theme);
    this.stage.style.width = this.W + 'px';
    this.stage.style.height = this.H + 'px';

    this.layers.bars.style.display = this.theme.fx.bars ? 'block' : 'none';
    this.layers.vignette.style.opacity = String(this.theme.fx.vignette * 0.9);
    this.layers.bloom.style.opacity = String(this.theme.fx.bloom * 0.55);
    this.layers.grain.style.opacity = String(this.theme.fx.grain ?? 0.05);
    this.layers.scan.style.opacity = project.meta.theme === 'noir' ? '0.10' : '0';

    if (rebuild) this.rebuildScenes();
    if (!this._guidesBuilt) { this.buildGuides(); this._guidesBuilt = true; }
  }

  buildGuides() {
    const g = this.layers.guides;
    g.innerHTML = `
      <div class="cx-guide safe90"></div>
      <div class="cx-guide safe80"></div>
      <div class="cx-guide-center"></div>
      <div class="cx-guide-third h1"></div><div class="cx-guide-third h2"></div>
      <div class="cx-guide-third v1"></div><div class="cx-guide-third v2"></div>
    `;
  }

  rebuildScenes() {
    const host = this.layers.scenes;
    host.innerHTML = '';
    this.sceneNodes.clear();
    (this.project?.scenes || []).forEach((sc, i) => this.buildSceneNode(sc, i));
  }

  buildSceneNode(sc, index) {
    const theme = this.theme;
    const node = el('div', { class: 'cx-scene', 'data-scene': sc.id });
    node.style.cssText = 'position:absolute;inset:0;opacity:0;visibility:hidden;will-change:opacity,transform;';

    // ব্যাকগ্রাউন্ড: বেস গ্রেডিয়েন্ট + স্পটলাইট + অ্যাকসেন্ট গ্লো
    const b = sc.bg || {};
    const angle = b.gradientAngle ?? 160;
    const spotX = b.spotX ?? 50, spotY = b.spotY ?? 40, spotS = b.spotSize ?? 60;

    const bg = el('div', { class: 'cx-scene-bg' });
    bg.style.cssText = `position:absolute;inset:-8%;will-change:transform;background:linear-gradient(${angle}deg, ${theme.bg.top} 0%, ${theme.bg.base} 48%, ${theme.bg.bottom} 100%);`;

    const spot = el('div');
    spot.style.cssText = `position:absolute;inset:0;background:radial-gradient(${spotS * 1.7}% ${spotS * 1.7}% at ${spotX}% ${spotY}%, ${hexA(theme.colors.accent, 0.16)} 0%, ${hexA(theme.colors.accent2, 0.06)} 42%, transparent 72%);`;
    bg.appendChild(spot);

    const glow = el('div');
    glow.style.cssText = `position:absolute;inset:0;background:radial-gradient(85% 70% at ${100 - spotX}% ${100 - spotY}%, ${hexA(theme.colors.accent2, 0.10)} 0%, transparent 68%);`;
    bg.appendChild(glow);

    node.appendChild(bg);

    // এফেক্ট ক্যানভাস
    const fx = el('canvas', { class: 'cx-scene-fx' });
    fx.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    node.appendChild(fx);
    const scale = this.quality === 'low' ? 0.35 : (this.quality === 'med' ? 0.5 : 0.6);
    const effect = makeEffect(fx, b.effect || 'none', {
      theme,
      density: b.density ?? 1,
      speed: b.speed ?? 1,
      seed: b.seed ?? (index * 7919 + 13),
      width: Math.round(this.W * scale),
      height: Math.round(this.H * scale),
    });

    // এলিমেন্ট
    const elHost = el('div', { class: 'cx-scene-elems' });
    elHost.style.cssText = 'position:absolute;inset:0;';
    node.appendChild(elHost);

    const elemApis = new Map();
    sc.elements.forEach(d => {
      const api = createElementNode(d, theme, this.W);
      elemApis.set(d.id, api);
      elHost.appendChild(api.wrap);
    });

    this.layers.scenes.appendChild(node);
    const bundle = { id: sc.id, node, bg, effect, elemApis, elHost, index, builtFor: sig(sc) };
    this.sceneNodes.set(sc.id, bundle);
    return bundle;
  }

  /** একটি সিন বদলালে শুধু সেটাই রিবিল্ড */
  ensureScene(sc, index) {
    let b = this.sceneNodes.get(sc.id);
    if (!b || b.builtFor !== sig(sc)) {
      if (b) { b.node.remove(); this.sceneNodes.delete(sc.id); }
      b = this.buildSceneNode(sc, index);
    }
    return b;
  }

  setQuality(q) {
    this.quality = q;
    this.rebuildScenes();
  }

  showGuides(on) { this.layers.guides.style.display = on ? 'block' : 'none'; }

  /** একটি সময়ে পুরো স্টেজ রেন্ডার */
  renderAt(t, project = this.project) {
    if (!project) return;
    const scenes = project.scenes || [];
    const S = project.settings || {};

    if (this.project !== project) this.setProject(project);

    // সক্রিয় সিন
    const activeIdx = findSceneIndex(scenes, t);
    const prevIdx = activeIdx > 0 ? activeIdx - 1 : -1;

    // নতুন/বদলানো সিন রিবিল্ড
    for (let i = 0; i < scenes.length; i++) {
      if (i === activeIdx || i === prevIdx) this.ensureScene(scenes[i], i);
    }

    for (const [id, b] of this.sceneNodes) {
      const i = b.index;
      if (i !== activeIdx && i !== prevIdx) {
        if (b.node.style.visibility !== 'hidden') { b.node.style.visibility = 'hidden'; b.node.style.opacity = '0'; }
        continue;
      }
      const sc = scenes[i];
      b.node.style.visibility = 'visible';
      const localT = t - sc.start;

      let alpha = 1, sx = 1, sy = 1, tx = 0, ty = 0, blur = 0;

      // --- ইন ট্রানজিশন ---
      if (i === activeIdx) {
        const td = Math.min(sc.transitionDur || 0.5, sc.dur * 0.45);
        const p = td > 0.01 ? clamp(localT / td) : 1;
        const e = ease('expoInOut', p);
        switch (sc.transition) {
          case 'fade': case 'fadeIn': case 'crossfade': alpha *= e; break;
          case 'zoomIn': alpha *= e; sx = sy = lerp(1.14, 1, e); break;
          case 'zoomOut': alpha *= e; sx = sy = lerp(0.88, 1, e); break;
          case 'slideLeft': alpha *= clamp(e * 1.5); tx = (1 - e) * this.W * 0.22; break;
          case 'slideRight': alpha *= clamp(e * 1.5); tx = -(1 - e) * this.W * 0.22; break;
          case 'slideUp': alpha *= clamp(e * 1.5); ty = (1 - e) * this.H * 0.18; break;
          case 'slideDown': alpha *= clamp(e * 1.5); ty = -(1 - e) * this.H * 0.18; break;
          case 'blur': alpha *= e; blur = (1 - e) * 34; sx = sy = lerp(1.05, 1, e); break;
          case 'wipeRight':
            b.node.style.clipPath = `inset(0 ${(100 * (1 - e)).toFixed(2)}% 0 0)`;
            break;
          case 'wipeDown':
            b.node.style.clipPath = `inset(0 0 ${(100 * (1 - e)).toFixed(2)}% 0)`;
            break;
          case 'cinematicCut': alpha *= p > 0.02 ? 1 : 0; sx = sy = lerp(1.06, 1, ease('expoOut', clamp(localT / 1.2))); break;
          default: alpha *= e;
        }
        if (sc.transition !== 'wipeRight' && sc.transition !== 'wipeDown') b.node.style.clipPath = '';
      } else {
        // --- আগের সিনের আউট ট্রানজিশন (ক্রসফেড) ---
        const next = scenes[activeIdx];
        const td = Math.min(next.transitionDur || 0.5, sc.dur * 0.45);
        const over = t - sc.start - sc.dur;   // 0 .. td
        const p = td > 0.01 ? clamp(over / td) : 1;
        const e = ease('expoInOut', p);
        alpha *= (1 - e);
        switch (next.transition) {
          case 'zoomIn': sx = sy = lerp(1, 0.95, e); break;
          case 'zoomOut': sx = sy = lerp(1, 1.06, e); break;
          case 'slideLeft': tx = -e * this.W * 0.18; break;
          case 'slideRight': tx = e * this.W * 0.18; break;
          case 'slideUp': ty = -e * this.H * 0.14; break;
          case 'blur': blur = e * 26; break;
        }
        b.node.style.clipPath = '';
      }

      b.node.style.opacity = clamp(alpha).toFixed(3);
      b.node.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
      b.node.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';

      // ব্যাকগ্রাউন্ড মোশন
      updateBg(b.bg, sc.bg || {}, t, clamp(localT / Math.max(0.001, sc.dur)));

      // এফেক্ট
      if (alpha > 0.01) b.effect.render(t, clamp(localT / Math.max(0.001, sc.dur)));

      // এলিমেন্ট
      for (const d of sc.elements) {
        const api = b.elemApis.get(d.id);
        if (api) updateElement(api, d, this.theme, localT, clamp(localT / sc.dur), this.W);
      }
    }

    // গ্লোবাল ওভারলে
    const gf = Math.floor(t * 24) % this.grainUrls.length;
    if (gf !== this.lastGrain) {
      this.layers.grain.style.backgroundImage = `url(${this.grainUrls[gf]})`;
      this.lastGrain = gf;
    }
  }
}

/* ---------- ব্যাকগ্রাউন্ড মোশন ---------- */
function updateBg(node, bg, t, lt) {
  let tx = 0, ty = 0, sc = 1, op = 1;
  switch (bg.motion) {
    case 'driftLeft': tx = -(t * 7) % 90; break;
    case 'driftRight': tx = (t * 7) % 90; break;
    case 'driftUp': ty = -(t * 5) % 70; break;
    case 'pulse': sc = 1 + 0.035 * Math.sin(t * 0.55); op = 0.9 + 0.1 * Math.sin(t * 0.4); break;
    case 'slowPan': tx = Math.sin(t * 0.09) * 40; ty = Math.cos(t * 0.07) * 26; sc = 1.06; break;
    case 'breathe': sc = 1 + 0.02 * Math.sin(t * 0.35) + lt * 0.05; break;
    default: sc = 1.02;
  }
  node.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${sc.toFixed(4)})`;
  node.style.opacity = op.toFixed(3);
}

/* ---------- হেল্পার ---------- */
export function findSceneIndex(scenes, t) {
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (t >= scenes[i].start - 1e-4) return i;
  }
  return 0;
}

/** সিনের "সিগনেচার" — বদলালে রিবিল্ড লাগবে।
 *  গুরুত্বপূর্ণ: বড় ডেটা (ছবির dataUrl, লম্বা টেক্সট) এখানে নেওয়া হয় না,
 *  তাই প্রতি ফ্রেমে সস্তা থাকে। কনটেন্ট বদলালে এলিমেন্টের _rev বাড়ানো হয়। */
function sig(sc) {
  const els = sc.elements;
  let s = sc.id + '|' + (sc._rev || 0) + '|' + els.length + '|' + JSON.stringify(sc.bg) + '|';
  for (const e of els) {
    s += e.id + ',' + e.type + ',' + (e._rev || 0) + ',' + e.x + ',' + e.y + ',' + e.w + ',' + e.size + ',' +
         e.color + ',' + e.align + ',' + e.weight + ',' + e.enter + ',' + e.exit + ',' +
         e.t + ',' + e.dur + ',' + (e.extra?.src ? 1 : 0) + ';';
  }
  return s;
}

export function hexA(color, a = 1) {
  const s = String(color || '').trim();
  if (s.startsWith('rgb')) {
    const n = s.match(/[\d.]+/g) || [];
    return `rgba(${n[0] | 0},${n[1] | 0},${n[2] | 0},${(n[3] === undefined ? 1 : +n[3]) * a})`;
  }
  let h = s.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h || 'ffffff', 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ============================================================
   PlaybackEngine — অডিও ক্লক ভিত্তিক নিখুঁত সিঙ্ক
   ============================================================ */
export class PlaybackEngine {
  constructor(renderer, opts = {}) {
    this.r = renderer;
    this.project = null;
    this.time = 0;
    this.playing = false;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.bgm = new Audio();
    this.bgm.loop = true;
    this.bgm.preload = 'auto';
    this._acc = 0;
    this._last = 0;
    this._raf = null;
    this.onTick = opts.onTick || (() => { });
    this.onState = opts.onState || (() => { });
    this.onEnded = opts.onEnded || (() => { });
    this.audio.addEventListener('ended', () => this.stop());
  }

  get duration() {
    const scenes = this.project?.scenes || [];
    const last = scenes[scenes.length - 1];
    const sceneEnd = last ? last.start + last.dur : 0;
    return Math.max(sceneEnd, this.project?.audio?.duration || 0, this.audio.duration || 0);
  }

  loadProject(project) {
    this.project = project;
    this._lastChange = performance.now();
    const src = project.audio?.src;
    if (src && this.audio.src !== src) this.audio.src = src;
    this.audio.volume = clamp(project.audio?.volume ?? 1, 0, 1);
    const bs = project.settings?.bgmSrc;
    if (bs) { this.bgm.src = bs; this.bgm.volume = clamp(project.settings.bgmVolume ?? 0.12, 0, 1); }
    this.r.setProject(project);
    this.seek(this.time, true);
  }

  setAudioSrc(src) {
    if (!src) return;
    this.audio.src = src;
    this.audio.load();
  }

  play(from) {
    if (from !== undefined) this.time = clamp(from, 0, this.duration);
    if (this.duration <= 0) { this.r.renderAt(0, this.project); return; }
    this.syncAudioToTime();
    this._acc = this.time;
    this._last = performance.now();
    this.playing = true;
    const p1 = this.time > 0.02 ? this.audio.play() : this.audio.play();
    Promise.resolve(p1).catch(e => console.warn('audio play blocked:', e));
    if (this.project?.settings?.bgm && this.project?.settings?.bgmSrc) {
      this.bgm.currentTime = Math.min(this.bgm.duration || 0, this.time);
      this.bgm.play().catch(() => { });
    }
    this.onState(true);
    if (!this._raf) this.loop();
  }

  pause() {
    this.playing = false;
    this.audio.pause();
    this.bgm.pause();
    this.onState(false);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  stop() {
    this.playing = false;
    this.audio.pause();
    this.bgm.pause();
    this.onState(false);
    this.onEnded();
  }

  /** নিষ্ক্রিয় লুপ আবার চালু করা */
  wake() {
    if (!this._raf) { this._last = performance.now(); this.loop(); }
  }

  seek(t, force = false) {
    this.time = clamp(t, 0, Math.max(0.001, this.duration));
    this.wake();
    this._lastChange = performance.now();
    if (force || !this.playing) {
      this.syncAudioToTime();
      this.r.renderAt(this.time, this.project);
      this.onTick(this.time, this.playing);
    } else {
      this.syncAudioToTime();
      this._acc = this.time;
      this._last = performance.now();
    }
  }

  /** অডিও এলিমেন্টকে বর্তমান টাইমলাইন টাইমে আনা */
  syncAudioToTime() {
    const src = this.project?.audio?.src;
    if (!src) return;
    const ad = this.audio.duration;
    const target = clamp(this.time, 0, isFinite(ad) && ad ? ad : this.time);
    if (Math.abs((this.audio.currentTime || 0) - target) > 0.05) {
      try { this.audio.currentTime = target; } catch (e) { }
    }
    if (this.project?.settings?.bgm && this.project?.settings?.bgmSrc) {
      try { this.bgm.currentTime = Math.min(this.bgm.duration || 1e6, this.time); } catch (e) { }
    }
  }

  loop() {
    this._raf = requestAnimationFrame(now => {
      this._raf = null;
      const dt = Math.min(0.25, (now - this._last) / 1000);

      if (this.playing) {
        this._last = now;
        this._acc += dt;
        // অডিও ক্লকের সাথে মেলানো (ড্রিফট সংশোধন)
        if (this.project?.audio?.src && isFinite(this.audio.duration)) {
          const drift = Math.abs(this.audio.currentTime - this._acc);
          if (drift > 0.045) this._acc = this.audio.currentTime;
        }
        this.time = this._acc;
        if (this.time >= this.duration - 0.005) {
          this.time = this.duration;
          this.r.renderAt(this.time, this.project);
          this.onTick(this.time, true);
          this.stop();
          return;
        }
        this.r.renderAt(this.time, this.project);
        this.onTick(this.time, true);
        this.loop();
        return;
      }

      // পজ করা অবস্থা: অলস রিফ্রেশ (৩০fps) — CPU কম খাবে
      if (now - this._last >= 33) {
        this._last = now;
        this.r.renderAt(this.time, this.project);
        this.onTick(this.time, false);
        // ৪ সেকেন্ড কোনো বদল না হলে লুপ বন্ধ (ব্যাটারি/CPU সাশ্রয়)
        if (!this._lastChange || now - this._lastChange > 4000) {
          this._raf = null;
          return;
        }
      }
      this.loop();
    });
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this.audio.pause(); this.bgm.pause();
  }
}


/* ---------- অ্যাসপেক্ট রেশো → ডাইমেনশন ---------- */
export function aspectDims(aspect) {
  switch (aspect) {
    case '9:16': return { w: 1080, h: 1920 };
    case '1:1':  return { w: 1080, h: 1080 };
    case '4:5':  return { w: 1080, h: 1350 };
    case '16:9':
    default:     return { w: 1920, h: 1080 };
  }
}
