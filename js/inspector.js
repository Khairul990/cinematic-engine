/* ============================================================
   Cinematic Engine — inspector.js
   ডান পাশের ইন্সপেক্টর: সিন + এলিমেন্ট প্রপার্টি এডিটিং
   ============================================================ */

import { el, clamp, round, uid } from './util.js';
import { THEMES, getTheme } from './themes.js';
import { EFFECTS, EFFECT_IDS } from './effects.js';
import { ELEMENT_TYPES, ELEMENT_IDS, ENTER_ANIMS, EXIT_ANIMS, makeElement } from './elements.js';
import { TEMPLATES, TEMPLATE_IDS, makeSceneFromTemplate } from './generator.js';
import { labelOfType } from './timeline.js';
import { mulberry32 } from './util.js';

const TRANSITIONS = ['crossfade', 'fade', 'zoomIn', 'zoomOut', 'slideLeft', 'slideRight', 'slideUp', 'slideDown', 'blur', 'wipeRight', 'wipeDown', 'cinematicCut'];
const BG_MOTION = ['none', 'driftLeft', 'driftRight', 'driftUp', 'pulse', 'slowPan', 'breathe'];
const BG_MOTION_BN = { none: 'স্থির', driftLeft: 'বামে সরে', driftRight: 'ডানে সরে', driftUp: 'উপরে ওঠে', pulse: 'স্পন্দন', slowPan: 'ধীর প্যান', breathe: 'শ্বাস' };

export class Inspector {
  constructor(host, opts = {}) {
    this.host = host;
    this.titleEl = opts.titleEl;
    this.subEl = opts.subEl;
    this.getState = opts.getState;
    this.commit = opts.commit || (() => { });      // (label, mutateFn) => void
    this.selectScene = opts.selectScene || (() => { });
    this.selectElem = opts.selectElem || (() => { });
    this.actions = opts.actions || {};
  }

  render() {
    const st = this.getState();
    const host = this.host;
    host.innerHTML = '';
    const { project, sel } = st;

    if (!project || !project.scenes.length) {
      this.setHead('ইন্সপেক্টর', 'কিছু নেই');
      host.appendChild(el('div', { class: 'insp-empty', html: 'প্রথমে অডিও আপলোড করে<br><b>“টাইমলাইন তৈরি করো”</b> চাপো।<br><br>অথবা উপরে <b>ডেমো</b> চেপে দেখে নাও।' }));
      return;
    }

    if (sel.elemId) {
      const sc = project.scenes.find(s => s.id === sel.sceneId);
      const e = sc?.elements.find(x => x.id === sel.elemId);
      if (sc && e) { this.renderElement(st, sc, e); return; }
    }
    if (sel.sceneId) {
      const sc = project.scenes.find(s => s.id === sel.sceneId);
      if (sc) { this.renderScene(st, sc); return; }
    }
    this.renderProject(st);
  }

  setHead(t, s) { if (this.titleEl) this.titleEl.textContent = t; if (this.subEl) this.subEl.textContent = s || ''; }

  /* ============ প্রজেক্ট লেভেল ============ */
  renderProject(st) {
    const { project: p } = st;
    this.setHead('প্রজেক্ট সেটিংস', `${p.scenes.length}টি সিন`);
    const h = this.host;

    h.appendChild(section('থিম', [
      themeGrid(p.meta.theme, id => this.commit('থিম বদল', () => { p.meta.theme = id; }))
    ]));

    h.appendChild(section('স্টেজ', [
      selectField('ভিডিওর আকার', p.meta.aspect, [
        ['16:9', '16:9 · ল্যান্ডস্কেপ'], ['9:16', '9:16 · Shorts'], ['1:1', '1:1 · Square'], ['4:5', '4:5 · Feed']
      ], v => this.commit('অ্যাসপেক্ট', () => { p.meta.aspect = v; })),
      checkField('সেফ-এরিয়া গাইড দেখাও', p.settings.showSafe, v => this.commit('গাইড', () => { p.settings.showSafe = v; })),
      checkField('প্রতিটি সিনে ওয়াটারমার্ক', p.settings.watermark, v => this.commit('ওয়াটারমার্ক', () => { p.settings.watermark = v; })),
    ]));

    h.appendChild(section('অটো-জেনারেশন ডিফল্ট', [
      rangeField('সিনের আগে (lead-in)', p.settings.leadIn, 0, 2, 0.05, 's', v => this.commit('leadIn', () => { p.settings.leadIn = v; })),
      rangeField('সিনের পরে (lead-out)', p.settings.leadOut, 0, 4, 0.1, 's', v => this.commit('leadOut', () => { p.settings.leadOut = v; })),
      rangeField('কথা বলার হার', p.settings.charsPerSecond, 5, 14, 0.1, '', v => this.commit('cps', () => { p.settings.charsPerSecond = v; })),
      rangeField('টাইটেল হিসেবে সর্বোচ্চ শব্দ', p.settings.titleWords, 3, 14, 1, '', v => this.commit('titleWords', () => { p.settings.titleWords = v; })),
    ]));

    h.appendChild(section('সব সিন একসাথে', [
      el('div', { class: 'btnrow', style: { flexWrap: 'wrap' } }, [
        el('button', { class: 'btn small', text: 'সব সিনে একই ট্রানজিশন', onClick: () => this.actions.bulkTransition?.() }),
        el('button', { class: 'btn small', text: 'র‍্যান্ডম এফেক্ট রোল', onClick: () => this.actions.rerollFx?.() }),
        el('button', { class: 'btn small ghost', text: 'ওয়াটারমার্ক রিফ্রেশ', onClick: () => this.actions.refreshWatermark?.() }),
      ])
    ]));
  }

  /* ============ সিন লেভেল ============ */
  renderScene(st, sc) {
    const { project: p } = st;
    const idx = p.scenes.indexOf(sc);
    this.setHead(`সিন ${idx + 1}`, `${sc.start.toFixed(2)}s → ${(sc.start + sc.dur).toFixed(2)}s · ${sc.dur.toFixed(2)}s`);
    const h = this.host;

    const mainEl = findMainText(sc);
    h.appendChild(section('এই সিনে যা দেখাবে', [
      textareaField('স্ক্রিনের টেক্সট', mainEl ? (mainEl.extra.text || '') : '', v => this.commit('সিনের টেক্সট', () => {
        const m = findMainText(sc);
        if (m) { m.extra.text = v; m._rev = (m._rev || 0) + 1; }
        else this.actions.addElementText?.(sc, v);
        sc.note = v.slice(0, 40);
      })),
      el('div', { class: 'btnrow' }, [
        el('button', { class: 'btn small', text: '📏 টেক্সট অনুযায়ী সাইজ ঠিক করো', onClick: () => this.commit('অটো সাইজ', () => this.actions.autoFitText?.(sc)) }),
        el('button', { class: 'btn small ghost', text: '🎲 অন্য টেমপ্লেট', onClick: () => this.commit('র‍্যান্ডম টেমপ্লেট', () => {
          const t = TEMPLATE_IDS[Math.floor(Math.random() * TEMPLATE_IDS.length)];
          this.actions.applyTemplate?.(sc, t);
        }) }),
      ]),
    ]));

    h.appendChild(section('সিন', [
      textField('নাম', sc.name, v => this.commit('সিনের নাম', () => { sc.name = v; })),
      grid2([
        numField('শুরু (s)', sc.start, 0, 9999, 0.05, v => this.commit('সিন শুরু', () => { sc.start = v; this.actions.reseal?.(); })),
        numField('দৈর্ঘ্য (s)', sc.dur, 0.3, 120, 0.05, v => this.commit('সিন দৈর্ঘ্য', () => { sc.dur = v; this.actions.fitScene?.(sc); })),
      ]),
      selectField('টেমপ্লেট', sc.template, TEMPLATE_IDS.map(id => [id, TEMPLATES[id]?.bn || id]), v =>
        this.commit('টেমপ্লেট', () => this.actions.applyTemplate?.(sc, v))),
    ]));

    h.appendChild(section('ট্রানজিশন', [
      selectField('ধরন', sc.transition, TRANSITIONS.map(t => [t, t]), v => this.commit('ট্রানজিশন', () => { sc.transition = v; })),
      rangeField('সময়', sc.transitionDur, 0.05, 2, 0.05, 's', v => this.commit('ট্রানজিশন সময়', () => { sc.transitionDur = v; })),
      el('div', { class: 'btnrow' }, [
        el('button', { class: 'btn small ghost', text: '🎲 র‍্যান্ডম', onClick: () => this.commit('র‍্যান্ডম ট্রানজিশন', () => { sc.transition = TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)]; }) }),
        el('button', { class: 'btn small ghost', text: 'সব সিনে লাগাও', onClick: () => this.actions.bulkTransition?.(sc.transition) }),
      ])
    ]));

    h.appendChild(section('ব্যাকগ্রাউন্ড', [
      selectField('এফেক্ট', sc.bg.effect, EFFECT_IDS.map(id => [id, EFFECTS[id]?.bn || id]), v => this.commit('এফেক্ট', () => { sc.bg.effect = v; })),
      grid2([
        rangeField('ঘনত্ব', sc.bg.density, 0.2, 3, 0.05, '', v => this.commit('ঘনত্ব', () => { sc.bg.density = v; }), true),
        rangeField('গতি', sc.bg.speed, 0.1, 3, 0.05, '', v => this.commit('গতি', () => { sc.bg.speed = v; }), true),
      ]),
      selectField('মোশন', sc.bg.motion, BG_MOTION.map(m => [m, BG_MOTION_BN[m] || m]), v => this.commit('মোশন', () => { sc.bg.motion = v; })),
      rangeField('গ্রেডিয়েন্ট কোণ', sc.bg.gradientAngle, 0, 360, 1, '°', v => this.commit('কোণ', () => { sc.bg.gradientAngle = v; })),
      grid2([
        rangeField('আলোর X', sc.bg.spotX, 0, 100, 1, '%', v => this.commit('spotX', () => { sc.bg.spotX = v; }), true),
        rangeField('আলোর Y', sc.bg.spotY, 0, 100, 1, '%', v => this.commit('spotY', () => { sc.bg.spotY = v; }), true),
      ]),
      rangeField('আলোর আকার', sc.bg.spotSize, 15, 120, 1, '%', v => this.commit('spotSize', () => { sc.bg.spotSize = v; })),
      el('div', { class: 'btnrow' }, [
        el('button', { class: 'btn small ghost', text: '🎲 র‍্যান্ডম লুক', onClick: () => this.commit('র‍্যান্ডম লুক', () => this.actions.rerollSceneBg?.(sc)) }),
      ])
    ]));

    h.appendChild(section(`এলিমেন্ট (${sc.elements.length})`, [
      el('div', { class: 'elem-list' }, sc.elements.map(e => elemRow(e, st.sel.elemId === e.id,
        () => this.selectElem(sc.id, e.id),
        () => this.commit('এলিমেন্ট মুছু', () => this.actions.deleteElement?.(sc, e))
      ))),
      el('div', { class: 'lbl-sm', text: 'নতুন এলিমেন্ট যোগ করো:' }),
      el('div', { class: 'seg wide' }, ELEMENT_IDS.filter(t => t !== 'watermark').map(t =>
        el('button', { text: ELEMENT_TYPES[t].bn, onClick: () => this.commit('এলিমেন্ট যোগ', () => this.actions.addElement?.(sc, t)) })
      )),
    ]));
  }

  /* ============ এলিমেন্ট লেভেল ============ */
  renderElement(st, sc, e) {
    const p = st.project;
    this.setHead(labelOfType(e.type), `সিন ${p.scenes.indexOf(sc) + 1} · ${e.t.toFixed(2)}s + ${e.dur.toFixed(2)}s`);
    const h = this.host;

    h.appendChild(el('div', { class: 'btnrow', style: { marginBottom: '12px' } }, [
      el('button', { class: 'btn small ghost', text: '← সিনে ফিরে যাও', onClick: () => this.selectScene(sc.id) }),
      el('button', { class: 'btn small ghost', text: 'নকল', onClick: () => this.commit('এলিমেন্ট নকল', () => this.actions.dupeElement?.(sc, e)) }),
      el('button', { class: 'btn small danger', text: 'মুছো', onClick: () => this.commit('এলিমেন্ট মুছু', () => this.actions.deleteElement?.(sc, e)) }),
    ]));

    // --- কনটেন্ট ---
    const ex = e.extra;
    const content = [];
    if ('text' in ex) content.push(textareaField('লেখা', ex.text, v => this.commit('লেখা', () => { ex.text = v; })));
    if ('label' in ex) content.push(textField('লেবেল', ex.label, v => this.commit('লেবেল', () => { ex.label = v; })));
    if ('author' in ex) content.push(textField('লেখকের নাম', ex.author, v => this.commit('author', () => { ex.author = v; })));
    if ('title' in ex) content.push(textField('চ্যার্ট শিরোনাম', ex.title, v => this.commit('chart title', () => { ex.title = v; })));
    if ('caption' in ex) content.push(textField('ক্যাপশন', ex.caption, v => this.commit('caption', () => { ex.caption = v; })));
    if (e.type === 'counter') {
      content.push(grid2([
        numField('শুরু', ex.from, -1e9, 1e9, 1, v => this.commit('from', () => { ex.from = v; })),
        numField('শেষ', ex.to, -1e9, 1e9, 1, v => this.commit('to', () => { ex.to = v; })),
      ]));
      content.push(grid2([
        textField('প্রিফিক্স', ex.prefix || '', v => this.commit('prefix', () => { ex.prefix = v; })),
        textField('সাফিক্স', ex.suffix || '', v => this.commit('suffix', () => { ex.suffix = v; })),
      ]));
      content.push(rangeField('গুনে ওঠার সময়', ex.countDur || 1.4, 0.3, 6, 0.1, 's', v => this.commit('countDur', () => { ex.countDur = v; })));
      content.push(checkField('বাংলা সংখ্যা', ex.locale !== 'en', v => this.commit('locale', () => { ex.locale = v ? 'bn' : 'en'; })));
    }
    if (e.type === 'progress') {
      content.push(rangeField('মান (%)', ex.value, 0, 100, 1, '%', v => this.commit('value', () => { ex.value = v; })));
      content.push(rangeField('বার পূরণের সময়', ex.barDur || 1.2, 0.3, 5, 0.1, 's', v => this.commit('barDur', () => { ex.barDur = v; })));
    }
    if (e.type === 'list') {
      content.push(textareaField('তালিকা (প্রতি লাইনে একটি)', (ex.items || []).join('\n'), v => this.commit('items', () => { ex.items = v.split('\n').map(s => s.trim()).filter(Boolean); })));
      content.push(checkField('নম্বর দেখাও', ex.numbered !== false, v => this.commit('numbered', () => { ex.numbered = v; })));
      content.push(rangeField('স্ট্যাগার', ex.stagger ?? 0.18, 0, 1, 0.02, 's', v => this.commit('stagger', () => { ex.stagger = v; })));
    }
    if (e.type === 'cards') {
      content.push(el('div', { class: 'lbl-sm', text: 'প্রতিটি কার্ড: শিরোনাম | বিবরণ' }));
      content.push(textareaField('কার্ড', (ex.cards || []).map(c => `${c.t} | ${c.d}`).join('\n'), v => this.commit('cards', () => {
        ex.cards = v.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
          const [t, ...d] = line.split('|');
          return { t: (t || '').trim(), d: d.join('|').trim() };
        });
      })));
      content.push(rangeField('স্ট্যাগার', ex.stagger ?? 0.16, 0, 1, 0.02, 's', v => this.commit('stagger', () => { ex.stagger = v; })));
    }
    if (e.type === 'chartBar') {
      content.push(el('div', { class: 'lbl-sm', text: 'লেবেল:মান (প্রতি লাইনে একটি)' }));
      content.push(textareaField('ডেটা', (ex.data || []).map(d => `${d.l}:${d.v}`).join('\n'), v => this.commit('bardata', () => {
        ex.data = v.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
          const [l, val] = line.split(':');
          return { l: (l || '').trim(), v: parseFloat(val) || 0 };
        });
      })));
    }
    if (e.type === 'chartLine') {
      content.push(textareaField('মান (কমা দিয়ে)', (ex.data || []).join(', '), v => this.commit('linedata', () => { ex.data = v.split(/[,\s]+/).map(Number).filter(n => isFinite(n)); })));
      content.push(rangeField('আঁকার সময়', ex.drawDur || 1.6, 0.4, 5, 0.1, 's', v => this.commit('drawDur', () => { ex.drawDur = v; })));
    }
    if (e.type === 'donut') {
      content.push(textareaField('লেবেল:মান', (ex.data || []).map(d => `${d.l}:${d.v}`).join('\n'), v => this.commit('donutdata', () => {
        ex.data = v.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
          const [l, val] = line.split(':');
          return { l: (l || '').trim(), v: parseFloat(val) || 0 };
        });
      })));
    }
    if (e.type === 'image') {
      content.push(imagePicker(p, ex, v => this.commit('ছবি', () => { ex.src = v; })));
      content.push(rangeField('কেন বার্নস জুম', ex.kenburns ?? 1.12, 1, 1.5, 0.01, '×', v => this.commit('kenburns', () => { ex.kenburns = v; })));
      content.push(rangeField('কোণা গোলাকার', ex.radius ?? 24, 0, 90, 1, 'px', v => this.commit('radius', () => { ex.radius = v; })));
    }
    if (content.length) h.appendChild(section('কনটেন্ট', content));

    // --- টাইমিং ---
    h.appendChild(section('টাইমিং', [
      grid2([
        numField('শুরু (সিনের ভেতরে)', e.t, 0, 300, 0.05, v => this.commit('el.t', () => { e.t = clamp(v, 0, Math.max(0.05, sc.dur - 0.15)); })),
        numField('দৈর্ঘ্য', e.dur, 0.25, 300, 0.05, v => this.commit('el.dur', () => { e.dur = clamp(v, 0.25, sc.dur - e.t); })),
      ]),
      el('div', { class: 'btnrow' }, [
        el('button', { class: 'btn small ghost', text: 'পুরো সিন জুড়ে', onClick: () => this.commit('full scene', () => { e.t = 0; e.dur = sc.dur; }) }),
        el('button', { class: 'btn small ghost', text: 'কথা শুরুতে', onClick: () => this.actions.snapToVoice?.(sc, e) }),
      ])
    ]));

    // --- অ্যানিমেশন ---
    h.appendChild(section('অ্যানিমেশন', [
      selectField('প্রবেশ', e.enter, ENTER_ANIMS.map(a => [a, animName(a)]), v => this.commit('enter', () => { e.enter = v; })),
      rangeField('প্রবেশের সময়', e.enterDur, 0.1, 3, 0.05, 's', v => this.commit('enterDur', () => { e.enterDur = v; })),
      selectField('ইজিং', e.enterEase, Object.keys(EASING_NAMES).map(k => [k, EASING_NAMES[k]]), v => this.commit('enterEase', () => { e.enterEase = v; })),
      rangeField('দেরি', e.enterDelay || 0, 0, 4, 0.05, 's', v => this.commit('enterDelay', () => { e.enterDelay = v; })),
      selectField('প্রস্থান', e.exit, ['none', ...EXIT_ANIMS].map(a => [a, a === 'none' ? 'কিছু নেই' : animName(a)]), v => this.commit('exit', () => { e.exit = v; })),
      rangeField('প্রস্থানের সময়', e.exitDur, 0.05, 2, 0.05, 's', v => this.commit('exitDur', () => { e.exitDur = v; })),
    ]));

    // --- লেআউট ও স্টাইল ---
    h.appendChild(section('অবস্থান ও আকার', [
      grid2([
        rangeField('X', e.x, -20, 120, 0.5, '%', v => this.commit('x', () => { e.x = v; }), true),
        rangeField('Y', e.y, -20, 120, 0.5, '%', v => this.commit('y', () => { e.y = v; }), true),
      ]),
      rangeField('প্রশস্ততা', e.w, 5, 130, 1, '%', v => this.commit('w', () => { e.w = v; })),
      rangeField('ফন্ট সাইজ', e.size, 10, 400, 1, 'px', v => this.commit('size', () => { e.size = v; })),
      el('div', { class: 'lbl-sm', text: 'দ্রুত অবস্থান:' }),
      el('div', { class: 'grid3' }, [
        posBtn('↖', 18, 18), posBtn('↑', 50, 14), posBtn('↗', 82, 18),
        posBtn('←', 18, 50), posBtn('●', 50, 50), posBtn('→', 82, 50),
        posBtn('↙', 18, 82), posBtn('↓', 50, 84), posBtn('↘', 82, 82),
      ].map(b => b(e, v => this.commit('অবস্থান', () => { e.x = v[0]; e.y = v[1]; })))),
    ]));

    h.appendChild(section('স্টাইল', [
      el('div', { class: 'lbl-sm', text: 'রঙ:' }),
      colorRow(p, e, v => this.commit('রঙ', () => { e.color = v; })),
      e.color === 'custom' ? textField('কাস্টম hex', e.hex, v => this.commit('hex', () => { e.hex = v; })) : null,
      grid2([
        selectField('অ্যালাইন', e.align, [['left', 'বামে'], ['center', 'মাঝে'], ['right', 'ডানে']], v => this.commit('align', () => { e.align = v; })),
        selectField('ওজন', String(e.weight), [[300, 'পাতলা'], [400, 'স্বাভাবিক'], [500, 'মিডিয়াম'], [600, 'সেমি'], [700, 'বোল্ড'], [800, 'অতি বোল্ড']], v => this.commit('weight', () => { e.weight = +v; })),
      ]),
      grid2([
        rangeField('অক্ষর ফাঁক', e.tracking, -6, 20, 0.5, 'px', v => this.commit('tracking', () => { e.tracking = v; }), true),
        rangeField('লাইন উচ্চতা', e.lineH, 0.9, 2.4, 0.02, '', v => this.commit('lineH', () => { e.lineH = v; }), true),
      ]),
      rangeField('স্বচ্ছতা', e.opacity, 0, 1, 0.02, '', v => this.commit('opacity', () => { e.opacity = v; })),
      checkField('ছায়া', !!e.shadow, v => this.commit('shadow', () => { e.shadow = v; })),
      checkField('ইটালিক', !!e.italic, v => this.commit('italic', () => { e.italic = v; })),
    ].filter(Boolean)));
  }
}

const EASING_NAMES = {
  linear: 'লিনিয়ার', ease: 'স্বাভাবিক', easeIn: 'ধীর শুরু', easeOut: 'ধীর শেষ',
  easeInOut: 'দুই পাশে ধীর', expoOut: 'এক্সপো (সিনেমাটিক)', expoInOut: 'এক্সপো দুই পাশে',
  quintOut: 'কুইন্ট', backOut: 'ব্যাক (বাউন্স)', backInOut: 'ব্যাক দুই পাশে',
  elasticOut: 'ইলাস্টিক', softOut: 'নরম', cineOut: 'সিনে আউট'
};
function animName(a) {
  const M = {
    rise: 'উপরে ওঠে', fade: 'ফেড', slideLeft: 'বাম থেকে', slideRight: 'ডান থেকে',
    zoomIn: 'জুম ইন', zoomOut: 'জুম আউট', blurIn: 'ব্লার থেকে', lineMask: 'লাইন মাস্ক',
    wordByWord: 'শব্দে শব্দে', dropIn: 'উপর থেকে পড়ে', flipIn: 'ফ্লিপ',
    wipeRight: 'ওয়াইপ', scaleIn: 'স্কেল ইন', typewriter: 'টাইপরাইটার',
    slideUp: 'উপরে সরে', slideDown: 'নিচে সরে', blurOut: 'ব্লার আউট', scaleDown: 'ছোট হয়ে'
  };
  return M[a] || a;
}

/* ============================================================
   ফিল্ড বিল্ডার
   ============================================================ */
function section(title, nodes) {
  return el('div', { class: 'insp-section' }, [el('h5', { text: title }), ...nodes.filter(Boolean)]);
}
function grid2(nodes) { return el('div', { class: 'grid2' }, nodes.filter(Boolean)); }

function textField(label, value, onChange) {
  const inp = el('input', { class: 'input', type: 'text', value: value ?? '' });
  inp.addEventListener('change', () => onChange(inp.value));
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); });
  return el('div', {}, [el('label', { class: 'lbl-sm', text: label }), inp]);
}
function textareaField(label, value, onChange) {
  const ta = el('textarea', { class: 'textarea', rows: 4, style: { minHeight: '90px' } });
  ta.value = value ?? '';
  ta.addEventListener('change', () => onChange(ta.value));
  return el('div', {}, [el('label', { class: 'lbl-sm', text: label }), ta]);
}
function numField(label, value, min, max, step, onChange) {
  const inp = el('input', { class: 'input num', type: 'number', value: round(value ?? 0, 3), min, max, step });
  inp.addEventListener('change', () => {
    let v = parseFloat(inp.value);
    if (!isFinite(v)) v = 0;
    onChange(round(clamp(v, min, max), 3));
  });
  return el('div', {}, [el('label', { class: 'lbl-sm', text: label }), inp]);
}
function rangeField(label, value, min, max, step, unit, onChange, compact = false) {
  const out = el('b', { text: `${round(value ?? 0, 2)}${unit || ''}` });
  const inp = el('input', { type: 'range', min, max, step, value: value ?? 0 });
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value);
    out.textContent = `${round(v, 2)}${unit || ''}`;
    onChange(v);
  });
  return el('div', { class: 'field' + (compact ? ' compact' : '') }, [el('span', { text: label }), out, inp]);
}
function selectField(label, value, options, onChange) {
  const sel = el('select', { class: 'input' }, options.map(([v, t]) => el('option', { value: String(v), text: String(t), selected: String(v) === String(value) })));
  sel.value = String(value);
  sel.addEventListener('change', () => onChange(sel.value));
  return el('div', {}, [el('label', { class: 'lbl-sm', text: label }), sel]);
}
function checkField(label, checked, onChange) {
  const inp = el('input', { type: 'checkbox' });
  inp.checked = !!checked;
  inp.addEventListener('change', () => onChange(inp.checked));
  return el('label', { class: 'check' }, [inp, el('span', { text: label })]);
}
function themeGrid(active, onChange) {
  return el('div', { class: 'grid2' }, Object.values(THEMES).map(t => {
    const b = el('button', { class: 'btn small' + (t.id === active ? ' primary' : ' ghost'), style: { width: '100%', justifyContent: 'flex-start' } });
    const dot = el('span', { style: { width: '14px', height: '14px', borderRadius: '5px', flex: '0 0 auto', background: `linear-gradient(135deg, ${t.colors.accent}, ${t.colors.accent2})`, display: 'inline-block' } });
    b.append(dot, document.createTextNode(t.bn));
    b.addEventListener('click', () => onChange(t.id));
    return b;
  }));
}
function colorRow(project, e, onChange) {
  const theme = getTheme(project.meta.theme);
  const opts = [
    ['text', 'মূল টেক্সট', theme.colors.text],
    ['muted', 'হালকা', theme.colors.muted],
    ['accent', 'অ্যাকসেন্ট', theme.colors.accent],
    ['accent2', 'অ্যাকসেন্ট ২', theme.colors.accent2],
    ['gradient', 'গ্রেডিয়েন্ট', `linear-gradient(120deg,${theme.colors.text},${theme.colors.accent},${theme.colors.accent2})`],
    ['custom', 'কাস্টম', 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)'],
  ];
  return el('div', { class: 'color-row' }, opts.map(([id, tip, bg]) => {
    const c = el('div', { class: 'color-chip' + (e.color === id ? ' active' : ''), title: tip });
    c.style.background = bg;
    c.addEventListener('click', () => onChange(id));
    return c;
  }));
}
function posBtn(label, x, y) {
  return (e, onChange) => {
    const b = el('button', { class: 'btn small ghost', text: label, style: { padding: '5px' } });
    b.addEventListener('click', () => onChange([x, y]));
    return b;
  };
}
function imagePicker(project, ex, onChange) {
  const host = el('div', {});
  const grid = el('div', { class: 'img-grid', style: { marginTop: '0', marginBottom: '10px' } });
  const imgs = project.images || [];
  if (!imgs.length) grid.appendChild(el('div', { class: 'hint', text: '“ছবি” ট্যাব থেকে ছবি আপলোড করো।' }));
  imgs.forEach(im => {
    const t = el('div', { class: 'img-thumb' + (ex.src === im.dataUrl ? ' active' : '') });
    if (ex.src === im.dataUrl) t.style.borderColor = 'var(--ui-acc)';
    t.appendChild(el('img', { src: im.dataUrl, alt: im.name }));
    t.addEventListener('click', () => onChange(im.dataUrl));
    grid.appendChild(t);
  });
  const url = el('input', { class: 'input', type: 'text', placeholder: 'অথবা ছবির URL বসাও' });
  url.value = ex.src && !ex.src.startsWith('data:') ? ex.src : '';
  url.addEventListener('change', () => onChange(url.value.trim()));
  host.append(grid, url);
  return host;
}
function elemRow(e, active, onClick, onDelete) {
  const icons = { title: '🅣', text: '🅣', kicker: '▪', quote: '❝', counter: '#', progress: '▰', chartBar: '📊', chartLine: '📈', donut: '◔', list: '☰', cards: '▦', image: '🖼', divider: '—', badge: '◉', watermark: '©' };
  const row = el('div', { class: 'elem-row' + (active ? ' active' : '') });
  row.append(
    el('span', { class: 'ei', text: icons[e.type] || '•' }),
    el('span', { class: 'en', text: `${labelOfType(e.type)} · ${(e.extra?.text || e.extra?.label || e.extra?.title || '').slice(0, 22)}`.trim() }),
    el('span', { class: 'ed', text: `${e.t.toFixed(1)}+${e.dur.toFixed(1)}` }),
    el('button', { class: 'ex', text: '×', title: 'মুছে ফেলো', onClick: ev => { ev.stopPropagation(); onDelete(); } })
  );
  row.addEventListener('click', onClick);
  return row;
}


/* ---------- সিনের প্রধান টেক্সট এলিমেন্ট ---------- */
export function findMainText(sc) {
  const order = ['title', 'quote', 'text'];
  for (const t of order) {
    const e = (sc.elements || []).find(x => x.type === t && (x.extra?.text ?? '') !== undefined);
    if (e) return e;
  }
  return (sc.elements || []).find(x => x.extra && 'text' in x.extra) || null;
}

/** টেক্সটের দৈর্ঘ্য অনুযায়ী ফন্ট সাইজ অটো ঠিক করা (1920 স্টেজে ফিট) */
export function autoFitTextSize(text, boxWidthPct = 78, maxPx = 150, minPx = 34) {
  const chars = String(text || '').length;
  if (!chars) return 64;
  // আনুমানিক: বাংলা গ্লিফের গড় প্রশস্ততা ≈ 0.58 × font-size
  const usablePx = (boxWidthPct / 100) * 1920;
  const lines = String(text).split('\n').length;
  const perLine = chars / lines;
  let size = usablePx / (perLine * 0.56);
  return Math.round(clamp(size, minPx, maxPx));
}
