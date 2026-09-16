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
    measureText: () => ({ width: 10 }), fillText: noop, strokeText: noop,
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
  querySelector() { return new MockNode('div'); }
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


globalThis.MockNode = MockNode;
