

/* ===== মক DOM ===== */
const noop = () => {};
function makeCtx() {
  const grad = { addColorStop: noop };
  return {
    canvas: null,
    clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, drawImage: noop,
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    measureText: () => ({ width: 10 }),
    globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '',
    lineWidth: 1, lineCap: '', font: '', textAlign: '', filter: '',
  };
}
let idc = 0;
class MockNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.nodeName = this.tagName;
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.firstChild = null;
    this.nextSibling = null;
    this.style = new Proxy({ setProperty: noop, removeProperty: noop, cssText: '' }, {
      set(t, k, v) { t[k] = v; return true; }, get(t, k) { return k in t ? t[k] : ''; }
    });
    this.dataset = {};
    this.classList = { _s: new Set(), add: noop, remove: noop, toggle: noop, contains: () => false };
    this._listeners = {};
    this._ctx = null;
  }
  get className() { return this._cn || ''; }
  set className(v) { this._cn = v; }
  setAttribute(k, v) { this['attr_' + k] = v; if (k === 'class') this._cn = v; }
  getAttribute(k) { return this['attr_' + k] ?? null; }
  removeAttribute() {}
  appendChild(c) { if (!c) return c; c.parentNode = this; this.children.push(c); this.firstChild = this.children[0]; return c; }
  append(...cs) { cs.forEach(c => this.appendChild(c)); }
  insertBefore(c) { return this.appendChild(c); }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(t, f) { (this._listeners[t] ||= []).push(f); }
  removeEventListener() {}
  dispatchEvent() { return true; }
  setPointerCapture() {} releasePointerCapture() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080 }; }
  get clientWidth() { return 1920; } get clientHeight() { return 1080; }
  get offsetWidth() { return 1920; } get offsetHeight() { return 1080; }
  focus() {} blur() {} click() {}
  set innerHTML(v) { this._html = v; this.children.length = 0; }
  get innerHTML() { return this._html || ''; }
  set textContent(v) { this._text = String(v); this.children.length = 0; }
  get textContent() { return this._text || ''; }
  set src(v) { this._src = v; } get src() { return this._src || ''; }
  set width(v) { this._w = v; } get width() { return this._w || 300; }
  set height(v) { this._h = v; } get height() { return this._h || 150; }
  getContext() { if (!this._ctx) { this._ctx = makeCtx(); this._ctx.canvas = this; } return this._ctx; }
  toDataURL() { return 'data:image/png;base64,AAAA'; }
}
global.document = {
  createElement: t => new MockNode(t),
  createElementNS: (ns, t) => new MockNode(t),
  createTextNode: t => { const n = new MockNode('#text'); n.textContent = t; return n; },
  createDocumentFragment: () => new MockNode('#frag'),
  querySelector: () => new MockNode('div'),
  querySelectorAll: () => [],
  body: new MockNode('body'),
  documentElement: new MockNode('html'),
  addEventListener: noop, removeEventListener: noop,
  fullscreenElement: null, exitFullscreen: async () => {},
};
global.window = {
  addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1,
  innerWidth: 1920, innerHeight: 1080, requestAnimationFrame: noop, cancelAnimationFrame: noop,
  AudioContext: class { constructor(){ this.state='running'; this.sampleRate=44100; } resume(){} decodeAudioData(){ return Promise.resolve({}); } },
};
global.requestAnimationFrame = cb => { return 1; };
global.cancelAnimationFrame = noop;
global.performance = global.performance || { now: () => Date.now() };
global.Audio = class { constructor(){ this.volume=1; this.currentTime=0; this.duration=0; this.playbackRate=1; this.src=''; } play(){return Promise.resolve();} pause(){} load(){} addEventListener(){} };
global.Image = class { set src(v){ this._s=v; } };
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
global.indexedDB = { open(){ const r={}; setTimeout(()=>r.onerror&&r.onerror(new Error('no idb')),0); return r; } };
global.URL.createObjectURL = () => 'blob:mock'; global.URL.revokeObjectURL = noop;
global.Blob = class { constructor(p,o){ this.parts=p; this.type=o?.type||''; } };
global.ResizeObserver = class { observe(){} disconnect(){} };
global.getComputedStyle = () => ({ width: '1920px', height: '1080px' });
global.Event = class { constructor(t){ this.type=t; } };
global.confirm = () => true;
global.alert = noop;

/* ===== টেস্ট ===== */
import { fileURLToPath } from 'node:url';
const B = new URL('../js/', import.meta.url).href;

let pass = 0, fail = 0;
function ok(name, cond, extra='') { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } }

console.log('\n[1] util / easing');
const U = await import(B + 'util.js');
ok('clamp', U.clamp(5,0,1) === 1 && U.clamp(-2,0,1) === 0);
ok('easing endpoints', Object.entries(U.EASINGS).every(([k,f]) => Math.abs(f(0)) < 1e-6 && Math.abs(f(1)-1) < 0.06), 'some easing off');
ok('toBengaliDigits', U.toBengaliDigits('2026') === '২০২৬');
ok('fmtTime', U.fmtTime(65.5).startsWith('1:05'));

console.log('\n[2] audio: সাইলেন্স ডিটেকশন (সিন্থেটিক অডিও)');
const A = await import(B + 'audio.js');
// সিন্থেটিক frames: ৫টি কথা বলা অংশ, মাঝে চুপচাপ
const fd = 0.02;
const frames = [];
const spoken = [[0.5,4.0],[5.0,8.5],[10.0,12.0],[14.0,19.0],[21.0,23.5]];
const TOTAL = 26;
for (let t = 0; t < TOTAL; t += fd) {
  const on = spoken.some(([a,b]) => t >= a && t < b);
  frames.push({ t, rms: on ? 0.2 : 0.002, peak: on ? 0.4 : 0.01, norm: on ? 0.5 + 0.2*Math.sin(t*7) : 0.01 });
}
const analysis = { frames, frameDur: fd, duration: TOTAL, sampleRate: 44100, url: 'blob:x', name: 'test.wav' };
const segs = A.detectSegments(analysis, { sensitivity: 0.5, minSilence: 0.45, minSegment: 1.2, maxSegment: 22 });
ok('সিগমেন্ট সংখ্যা ৫', segs.length === 5, `got ${segs.length}: ${JSON.stringify(segs.map(s=>[+s.start.toFixed(2),+s.end.toFixed(2)]))}`);
ok('সিগমেন্ট সীমা প্রায় মিলছে', segs.every((s,i) => Math.abs(s.start - spoken[i][0]) < 0.4 && Math.abs(s.end - spoken[i][1]) < 0.4));
ok('ওভারল্যাপ নেই', segs.every((s,i) => i === 0 || s.start >= segs[i-1].end - 1e-6));

console.log('\n[3] script alignment');
const lines = ['প্রথম লাইন এখানে আছে','দ্বিতীয় লাইন','তৃতীয়','চতুর্থ লাইন যা একটু বড়','পঞ্চম লাইন'];
const aligned = A.alignScriptToSegments(lines, segs, { charsPerSecond: 8.2 });
ok('সব লাইন ম্যাপ হয়েছে', aligned.length === lines.length);
ok('সময় বাড়ে', aligned.every((l,i) => i === 0 || l.start >= aligned[i-1].start - 1e-6), JSON.stringify(aligned.map(a=>+a.start.toFixed(2))));
ok('সীমার ভেতরে', aligned.every(l => l.start >= -0.01 && l.end <= TOTAL + 0.01));
ok('scriptToLines ভাগ করে', A.scriptToLines('এক দুই তিন\n\nচার পাঁচ').length === 2);

console.log('\n[4] generator: অটো টাইমলাইন');
const G = await import(B + 'generator.js');
const proj = G.defaultProject();
proj.audio.duration = TOTAL;
proj.meta.channel = 'টেস্ট চ্যানেল';
const scenes = G.generateTimeline(proj, segs, aligned, { seed: 42 });
ok('সিন তৈরি হয়েছে', scenes.length >= 5, `n=${scenes.length}`);
ok('কোনো গ্যাপ নেই', scenes.every((s,i) => i === 0 || Math.abs(s.start - (scenes[i-1].start + scenes[i-1].dur)) < 0.02), JSON.stringify(scenes.map(s=>[s.start,s.dur])));
ok('সব সিনে এলিমেন্ট আছে', scenes.every(s => s.elements.length >= 1));
ok('প্রতিটি এলিমেন্ট সিনের ভেতরে', scenes.every(s => s.elements.every(e => e.t >= 0 && e.t + e.dur <= s.dur + 0.01)));
ok('ওয়াটারমার্ক যোগ হয়েছে', scenes.every(s => s.elements.some(e => e.type === 'watermark')));
ok('শেষ সিন আউট্রো/সাধারণ', scenes[scenes.length-1].elements.length >= 1);

console.log('\n[5] স্ক্রিপ্ট ছাড়া (শুধু অডিও)');
const scenes2 = G.generateTimeline(proj, segs, null, { seed: 7 });
ok('সিন তৈরি হয়েছে', scenes2.length >= 4);
ok('এলিমেন্ট ঠিক আছে', scenes2.every(s => s.elements.every(e => e.t + e.dur <= s.dur + 0.01)));

console.log('\n[6] রেন্ডারার: বিল্ড + ১০০০ ফ্রেম');
const R = await import(B + 'render.js');
const E = await import(B + 'elements.js');
const T = await import(B + 'themes.js');
const stage = new MockNode('div');
stage.querySelector = sel => new MockNode('div');
// layers চাই
const layerMap = {};
stage.querySelector = (sel) => { const m = sel.match(/data-layer=(\w+)/); const k = m?m[1]:sel; return layerMap[k] ||= new MockNode('div'); };
const renderer = new R.StageRenderer(stage, { quality: 'med' });
proj.meta.theme = 'midnight';
proj.scenes = scenes;
renderer.setProject(proj);
ok('সব সিনের নোড বিল্ড হয়েছে', renderer.sceneNodes.size === scenes.length, `${renderer.sceneNodes.size}/${scenes.length}`);

let errors = [];
const themes = T.THEME_IDS;
let frameCount = 0;
for (const th of themes) {
  proj.meta.theme = th;
  renderer.setProject(proj);
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * (TOTAL + 1);
    try { renderer.renderAt(t, proj); frameCount++; }
    catch (e) { errors.push(`${th}@${t.toFixed(2)}: ${e.message}`); if (errors.length > 6) break; }
  }
}
ok(`${frameCount} ফ্রেম রেন্ডার, থিম ${themes.length}টি`, errors.length === 0, errors.join(' | '));

console.log('\n[7] প্রতিটি এলিমেন্ট টাইপ আলাদাভাবে');
const elErrors = [];
for (const type of E.ELEMENT_IDS) {
  for (const enter of ['rise','fade','lineMask','wordByWord','typewriter','zoomIn','blurIn','wipeRight','flipIn']) {
    try {
      const th = T.getTheme('midnight');
      const d = E.makeElement(type, { enter, exit: 'fade', size: 60, t: 0, dur: 3 });
      const api = E.createElementNode(d, th, 1920);
      for (let i = 0; i <= 40; i++) E.updateElement(api, d, th, (i/40)*3.4, i/40, 1920);
    } catch (e) { elErrors.push(`${type}/${enter}: ${e.message}`); }
  }
}
ok('সব এলিমেন্ট × সব এন্টার অ্যানিমেশন', elErrors.length === 0, elErrors.slice(0,5).join(' | '));

console.log('\n[8] PlaybackEngine');
const eng = new R.PlaybackEngine(renderer, {});
eng.project = proj;
ok('duration হিসাব', Math.abs(eng.duration - (scenes[scenes.length-1].start + scenes[scenes.length-1].dur)) < 0.6, String(eng.duration));
eng.seek(3, true); ok('seek কাজ করে', Math.abs(eng.time - 3) < 1e-6);
eng.seek(99999, true); ok('seek ক্ল্যাম্প', eng.time <= eng.duration + 1e-6);

console.log('\n[9] ডেমো প্রজেক্ট');
const demo = G.demoProject();
ok('ডেমোতে সিন আছে', demo.scenes.length === 8);
ok('ডেমো গ্যাপ-মুক্ত', demo.scenes.every((s,i) => i===0 || Math.abs(s.start - (demo.scenes[i-1].start + demo.scenes[i-1].dur)) < 0.02));
demo.meta.theme = 'crimson';
renderer.setProject(demo);
let demoErr = null;
try { for (let i=0;i<=200;i++) renderer.renderAt(i/200*36, demo); } catch(e){ demoErr = e.message; }
ok('ডেমো রেন্ডার', !demoErr, demoErr||'');

console.log(`\n========== ফল: ${pass} pass, ${fail} fail ==========`);
process.exit(fail ? 1 : 0);
