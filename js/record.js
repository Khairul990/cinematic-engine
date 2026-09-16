/* ============================================================
   Cinematic Engine — record.js
   রেকর্ড মোড: পুরো স্ক্রিনে স্টেজ, সব ইনপুট লক, কাউন্টডাউন,
   তারপর অটো প্লেব্যাক → Chrome স্ক্রিন রেকর্ডের জন্য প্রস্তুত
   ============================================================ */

import { clamp, el, fmtTimeShort } from './util.js';

export class RecordMode {
  constructor(opts) {
    this.overlay = opts.overlay;
    this.wrap = opts.wrap;
    this.hud = opts.hud;
    this.timeEl = opts.timeEl;
    this.blocker = opts.blocker;
    this.getStage = opts.getStage;          // () => cx-stage element
    this.engine = opts.engine;                // PlaybackEngine
    this.onExit = opts.onExit || (() => { });
    this.active = false;
    this._cleanup = [];
    this._hudTimer = null;
  }

  /** স্টেজকে স্ক্রিন অনুযায়ী স্কেল করা */
  fitStage() {
    const stage = this.getStage();
    if (!stage) return;
    stage.style.transform = '';
    const W = parseFloat(getComputedStyle(stage).width) || stage.offsetWidth || 1920;
    const H = parseFloat(getComputedStyle(stage).height) || stage.offsetHeight || 1080;
    const pad = 0;
    const vw = window.innerWidth - pad, vh = window.innerHeight - pad;
    const s = Math.min(vw / W, vh / H);
    stage.style.transform = `scale(${s})`;
    stage.style.transformOrigin = 'top left';
    this.wrap.style.width = (W * s) + 'px';
    this.wrap.style.height = (H * s) + 'px';
    this.wrap.style.position = 'absolute';
    this.wrap.style.left = ((vw - W * s) / 2) + 'px';
    this.wrap.style.top = ((vh - H * s) / 2) + 'px';
  }

  async enter(countdown = 3) {
    if (this.active) return;
    this.active = true;
    this.engine.pause();
    this.overlay.hidden = false;
    document.body.classList.add('recording');

    // স্টেজ মুভ করা
    this._origParent = this.getStage()?.parentNode;
    this._origNext = this.getStage()?.nextSibling;
    const stage = this.getStage();
    if (stage) { this.wrap.innerHTML = ''; this.wrap.appendChild(stage); }

    this.fitStage();
    this.lockInputs();

    // ফুলস্ক্রিন
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (e) { console.warn('fullscreen denied:', e); }

    // কাউন্টডাউন
    if (countdown > 0) {
      const cd = el('div', { class: 'countdown' });
      cd.style.cssText = 'position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(0,0,0,.55);';
      const num = el('span');
      num.style.cssText = 'font-size:min(22vw,240px);font-weight:800;color:#f5c451;font-variant-numeric:tabular-nums;text-shadow:0 0 80px rgba(245,196,81,.55);';
      cd.appendChild(num);
      this.overlay.appendChild(cd);
      for (let i = countdown; i >= 1; i--) {
        num.textContent = String(i);
        num.style.animation = 'none'; void num.offsetWidth; num.style.animation = 'cdPop .9s ease-out';
        await sleep(900);
      }
      num.textContent = '▶';
      await sleep(350);
      cd.remove();
      setTimeout(() => this.fitStage(), 60);
    }

    // রেন্ডার শুরু + প্লে
    this.engine.seek(0, true);
    this.fitStage();
    this.engine.play(0);

    // HUD: শুরুতে ২ সেকেন্ড দেখাবে, তারপর লুকাবে; মাউস নড়লে আবার
    this.showHud();
    this._hudTimer = setInterval(() => {
      if (this.engine.playing) this.timeEl.textContent = fmtTimeShort(this.engine.time);
      else this.timeEl.textContent = 'শেষ';
    }, 200);

    this.engine.onEnded = () => {
      this.showHud();
      this.timeEl.textContent = 'শেষ ✓';
    };
  }

  showHud() {
    this.hud.classList.add('show');
    clearTimeout(this._hudHide);
    this._hudHide = setTimeout(() => this.hud.classList.remove('show'), 2600);
  }

  /** সব কীবোর্ড/মাউস ইনপুট ব্লক (শুধু Esc ছাড়া) */
  lockInputs() {
    const stop = ev => {
      if (ev.key === 'Escape' || ev.key === 'F11' || (ev.key === 'q' && ev.ctrlKey)) return; // বের হতে দিই
      ev.preventDefault(); ev.stopPropagation();
    };
    const stopMouse = ev => { ev.preventDefault(); ev.stopPropagation(); this.showHud(); };

    window.addEventListener('keydown', stop, true);
    window.addEventListener('keyup', stop, true);
    window.addEventListener('keypress', stop, true);
    window.addEventListener('wheel', stop, { passive: false, capture: true });
    window.addEventListener('contextmenu', stop, true);
    this.blocker.addEventListener('pointerdown', stopMouse);
    this.blocker.addEventListener('click', stopMouse);
    this.blocker.addEventListener('dblclick', stopMouse);

    const onFsChange = () => { if (!document.fullscreenElement) this.showHud(); };
    document.addEventListener('fullscreenchange', onFsChange);

    this._cleanup = [
      () => window.removeEventListener('keydown', stop, true),
      () => window.removeEventListener('keyup', stop, true),
      () => window.removeEventListener('keypress', stop, true),
      () => window.removeEventListener('wheel', stop, { capture: true }),
      () => window.removeEventListener('contextmenu', stop, true),
      () => this.blocker.removeEventListener('pointerdown', stopMouse),
      () => this.blocker.removeEventListener('click', stopMouse),
      () => this.blocker.removeEventListener('dblclick', stopMouse),
      () => document.removeEventListener('fullscreenchange', onFsChange),
    ];
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    clearInterval(this._hudTimer);
    clearTimeout(this._hudHide);
    this.hud.classList.remove('show');

    this.engine.pause();
    this._cleanup.forEach(f => { try { f(); } catch (e) { } });
    this._cleanup = [];

    // স্টেজ ফেরত
    const stage = this.wrap.querySelector('.cx-stage');
    if (stage && this._origParent) this._origParent.insertBefore(stage, this._origNext || null);

    this.overlay.hidden = true;
    document.body.classList.remove('recording');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    this.onExit();
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
