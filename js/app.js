/* ============================================================
   Cinematic Engine — app.js
   সম্পূর্ণ অ্যাপ অর্কেস্ট্রেশন
   ============================================================ */

import { clamp, el, $, $$, uid, clone, round, fmtTime, fmtTimeShort, storage, downloadBlob, toBengaliDigits, mulberry32 } from './util.js';
import { THEMES, THEME_IDS, getTheme } from './themes.js';
import { analyzeAudioFile, detectSegments, alignScriptToSegments, scriptToLines, buildWaveformPeaks } from './audio.js';
import { defaultProject, demoProject, generateTimeline, makeSceneFromTemplate, blankScene, TEMPLATES, bnNum } from './generator.js';
import { StageRenderer, PlaybackEngine, findSceneIndex, aspectDims } from './render.js';
import { Timeline, scaleElements } from './timeline.js';
import { Inspector, findMainText, autoFitTextSize } from './inspector.js';
import { RecordMode } from './record.js';
import { makeElement, ELEMENT_TYPES } from './elements.js';
import { EFFECT_IDS } from './effects.js';

/* ============================================================
   স্টেট
   ============================================================ */
const S = {
  project: defaultProject(),
  analysis: null,          // { duration, frames, url, name, segments }
  sel: { sceneId: null, elemId: null },
  undo: [], redo: [],
  dirty: false,
  loop: false,
};

const MAX_HISTORY = 60;

/* ---------- DOM ---------- */
const D = {
  stageViewport: $('#stageViewport'),
  stageScaler: $('#stageScaler'),
  stage: $('#stage'),
  emptyState: $('#emptyState'),
  // top
  projectTitle: $('#projectTitle'),
  aspect: $('#aspectSelect'),
  themeSwatches: $('#themeSwatches'),
  btnUndo: $('#btnUndo'), btnRedo: $('#btnRedo'),
  btnDemo: $('#btnDemo'), btnImportJson: $('#btnImportJson'), btnExportJson: $('#btnExportJson'),
  btnNew: $('#btnNew'), btnRecord: $('#btnRecord'),
  // audio
  audioDrop: $('#audioDrop'), audioInput: $('#audioInput'), audioInfo: $('#audioInfo'),
  aiName: $('#aiName'), aiDur: $('#aiDur'), aiSegs: $('#aiSegs'), waveCanvas: $('#waveCanvas'),
  btnTestPlay: $('#btnTestPlay'), btnRemoveAudio: $('#btnRemoveAudio'),
  analyzeProgress: $('#analyzeProgress'), analyzeMsg: $('#analyzeMsg'),
  bgmDrop: $('#bgmDrop'), bgmInput: $('#bgmInput'), bgmToggle: $('#bgmToggle'),
  bgmVolume: $('#bgmVolume'), bgmVolumeVal: $('#bgmVolumeVal'),
  voiceVolume: $('#voiceVolume'), voiceVolumeVal: $('#voiceVolumeVal'),
  // script
  scriptInput: $('#scriptInput'), btnScriptLines: $('#btnScriptLines'), btnScriptClear: $('#btnScriptClear'),
  scriptStat: $('#scriptStat'), channelName: $('#channelName'), watermarkToggle: $('#watermarkToggle'),
  // generate
  gSensitivity: $('#gSensitivity'), gSensitivityVal: $('#gSensitivityVal'),
  gMinSilence: $('#gMinSilence'), gMinSilenceVal: $('#gMinSilenceVal'),
  gLeadIn: $('#gLeadIn'), gLeadInVal: $('#gLeadInVal'),
  gLeadOut: $('#gLeadOut'), gLeadOutVal: $('#gLeadOutVal'),
  gMinScene: $('#gMinScene'), gMinSceneVal: $('#gMinSceneVal'),
  gMaxScene: $('#gMaxScene'), gMaxSceneVal: $('#gMaxSceneVal'),
  gCPS: $('#gCPS'), gCPSVal: $('#gCPSVal'),
  gAutoFx: $('#gAutoFx'), gSeed: $('#gSeed'), btnDice: $('#btnDice'),
  btnGenerate: $('#btnGenerate'), btnRegenVariation: $('#btnRegenVariation'), btnPreviewSegs: $('#btnPreviewSegs'),
  // scenes
  sceneList: $('#sceneList'), btnAddScene: $('#btnAddScene'), btnDupScene: $('#btnDupScene'),
  btnSplitScene: $('#btnSplitScene'), btnDelScene: $('#btnDelScene'),
  // assets
  imgDrop: $('#imgDrop'), imgInput: $('#imgInput'), imgGrid: $('#imgGrid'), imgAutoApply: $('#imgAutoApply'),
  // transport
  btnPlay: $('#btnPlay'), btnPrevScene: $('#btnPrevScene'), btnNextScene: $('#btnNextScene'),
  tCur: $('#tCur'), tDur: $('#tDur'), loopToggle: $('#loopToggle'),
  qualitySelect: $('#qualitySelect'), speedSelect: $('#speedSelect'),
  btnGuides: $('#btnGuides'), btnFullscreen: $('#btnFullscreen'),
  // timeline
  timeline: $('#timeline'), tlScroll: $('#tlScroll'),
  btnZoomIn: $('#btnZoomIn'), btnZoomOut: $('#btnZoomOut'), btnZoomFit: $('#btnZoomFit'), zoomRange: $('#zoomRange'),
  // inspector
  inspTitle: $('#inspTitle'), inspSub: $('#inspSub'), inspBody: $('#inspBody'),
  // record
  recordOverlay: $('#recordOverlay'), recStageWrap: $('#recStageWrap'), recHud: $('#recHud'),
  recTime: $('#recTime'), recBlocker: $('#recBlocker'),
  toastHost: $('#toastHost'), jsonInput: $('#jsonInput'),
};

/* ============================================================
   টোস্ট
   ============================================================ */
let toastTimer = null;
function toast(msg, kind = 'ok', ms = 2600) {
  const t = el('div', { class: `toast ${kind}`, html: msg });
  D.toastHost.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; t.style.transition = '.3s'; }, ms);
  setTimeout(() => t.remove(), ms + 340);
}

/* ============================================================
   ইঞ্জিন সেটআপ
   ============================================================ */
const renderer = new StageRenderer(D.stage, { quality: 'med' });
const engine = new PlaybackEngine(renderer, {
  onTick: (t, playing) => {
    D.tCur.textContent = fmtTime(t);
    timeline.updatePlayhead(t);
    if (!playing) D.btnPlay.textContent = '▶';
  },
  onState: playing => { D.btnPlay.textContent = playing ? '⏸' : '▶'; },
  onEnded: () => {
    D.btnPlay.textContent = '▶';
    if (S.loop && !record.active) setTimeout(() => engine.play(0), 350);
  },
});
renderer.setProject(S.project);

const timeline = new Timeline(D.timeline, {
  onSelectScene: (id, focus) => { selectScene(id); if (focus) focusSelected(); },
  onSelectElem: (sid, eid) => selectElem(sid, eid),
  onScrub: t => engine.seek(t, true),
  onEditScene: () => { commitLight('টাইমলাইন এডিট'); },
  onEditElem: () => { commitLight('এলিমেন্ট মুভ'); },
});

const inspector = new Inspector(D.inspBody, {
  titleEl: D.inspTitle, subEl: D.inspSub,
  getState: () => ({ project: S.project, sel: S.sel }),
  commit: (label, fn) => commit(label, fn),
  selectScene: id => selectScene(id),
  selectElem: (sid, eid) => selectElem(sid, eid),
  actions: {
    applyTemplate: applyTemplate,
    addElement: addElementToScene,
    deleteElement: deleteElement,
    dupeElement: dupeElement,
    rerollSceneBg: rerollSceneBg,
    rerollFx: rerollAllFx,
    bulkTransition: bulkTransition,
    refreshWatermark: refreshWatermarks,
    reseal: resealTimeline,
    fitScene: sc => scaleElements(sc, sc.dur, sc.dur),
    snapToVoice: snapElementToVoice,
    addElementText: (sc, text) => {
      const e = makeElement('text', {
        x: 50, y: 50, w: 78, size: autoFitTextSize(text),
        t: round(clamp((sc.dur - 2.4) / 2, 0, Math.max(0, sc.dur - 0.5)), 2),
        dur: round(Math.min(sc.dur * 0.8, 3), 2),
        extra: { text },
      });
      sc.elements.push(e);
      sc._rev = (sc._rev || 0) + 1;
    },
    autoFitText: (sc) => {
      const m = findMainText(sc);
      if (!m) { toast('এই সিনে টেক্সট এলিমেন্ট নেই', 'warn'); return; }
      m.size = autoFitTextSize(m.extra.text || '', m.w || 78);
      m._rev = (m._rev || 0) + 1;
      toast(`ফন্ট সাইজ ঠিক করা হয়েছে: <b>${m.size}px</b>`, 'ok');
    },
  },
});

const record = new RecordMode({
  overlay: D.recordOverlay, wrap: D.recStageWrap, hud: D.recHud,
  timeEl: D.recTime, blocker: D.recBlocker,
  getStage: () => document.querySelector('#stage') || D.stage,
  engine,
  onExit: () => {
    fitStage();
    fullRefresh();
    toast('রেকর্ড মোড বন্ধ হয়েছে ✓ — এখন রেকর্ডিং ফাইলটা সেভ/স্টপ করো', 'ok', 3600);
  },
});

/* ============================================================
   থিম সোয়াচ
   ============================================================ */
function buildSwatches() {
  D.themeSwatches.innerHTML = '';
  THEME_IDS.forEach(id => {
    const t = THEMES[id];
    const s = el('div', {
      class: 'swatch' + (S.project.meta.theme === id ? ' active' : ''),
      'data-tip': t.bn,
      title: `${t.bn} — ${t.desc}`,
    });
    s.style.background = `linear-gradient(135deg, ${t.bg.top} 0%, ${t.bg.base} 55%, ${t.colors.accent} 130%)`;
    s.addEventListener('click', () => commit('থিম', () => { S.project.meta.theme = id; }));
    D.themeSwatches.appendChild(s);
  });
}

/* ============================================================
   ট্যাব
   ============================================================ */
$$('#leftTabs .tab').forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
});
function activateTab(name) {
  $$('#leftTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tabpane').forEach(p => p.classList.toggle('active', p.dataset.pane === name));
}

/* ============================================================
   অডিও আপলোড
   ============================================================ */
setupDrop(D.audioDrop, D.audioInput, files => handleAudioFile(files[0]));
setupDrop(D.bgmDrop, D.bgmInput, files => handleBgmFile(files[0]));
D.btnTestPlay.addEventListener('click', () => {
  if (!S.project.scenes.length && !S.project.audio.src) { toast('আগে অডিও আপলোড করো', 'warn'); activateTab('audio'); return; }
  engine.toggle();
});
D.btnRemoveAudio.addEventListener('click', () => {
  commit('অডিও সরানো', () => {
    S.project.audio = { src: null, name: null, duration: 0, volume: S.project.audio.volume ?? 1 };
    S.analysis = null;
  });
  engine.pause();
  try { engine.audio.pause(); engine.audio.removeAttribute('src'); engine.audio.load(); } catch (e) { }
  D.audioInfo.hidden = true;
  fullRefresh();
  toast('অডিও সরানো হয়েছে', 'ok');
});

D.voiceVolume.addEventListener('input', () => {
  const v = +D.voiceVolume.value;
  S.project.audio.volume = v;
  engine.audio.volume = v;
  D.voiceVolumeVal.textContent = Math.round(v * 100) + '%';
});
D.bgmToggle.addEventListener('change', () => {
  S.project.settings.bgm = D.bgmToggle.checked;
  if (!S.project.settings.bgmSrc && D.bgmToggle.checked) toast('আগে মিউজিক ফাইল বাছো', 'warn');
  engine.bgm.pause();
});
D.bgmVolume.addEventListener('input', () => {
  const v = +D.bgmVolume.value;
  S.project.settings.bgmVolume = v;
  engine.bgm.volume = v;
  D.bgmVolumeVal.textContent = Math.round(v * 100) + '%';
});

async function handleAudioFile(file) {
  if (!file) return;
  if (!/^audio\//.test(file.type) && !/\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(file.name)) {
    toast('এটা অডিও ফাইল নয় বলে মনে হচ্ছে', 'err'); return;
  }
  D.analyzeProgress.hidden = false;
  setProgress(4, 'ফাইল পড়া হচ্ছে…');
  try {
    const a = await analyzeAudioFile(file, (p, m) => setProgress(p, m));
    S.analysis = { ...a, segments: null };
    S.analysis.segments = detectSegments(a, currentSegSettings());
    commit('অডিও যোগ', () => {
      S.project.audio = { src: a.url, name: a.name, duration: a.duration, volume: S.project.audio.volume ?? 1 };
    });
    engine.setAudioSrc(a.url);
    engine.audio.volume = S.project.audio.volume ?? 1;
    showAudioInfo();
    drawWavePreview();
    saveAudioBlob(file);
    setProgress(100, 'শেষ ✓');
    setTimeout(() => { D.analyzeProgress.hidden = true; }, 700);
    toast(`অডিও লোড হয়েছে — <b>${a.duration.toFixed(1)}s</b>, <b>${S.analysis.segments.length}</b>টি সিগমেন্ট পাওয়া গেছে`, 'ok', 3600);
    savePersistent();
  } catch (err) {
    console.error(err);
    D.analyzeProgress.hidden = true;
    toast('অডিও ডিকোড করা যায়নি: ' + (err.message || err), 'err', 5000);
  }
}

function setProgress(p, msg) {
  const bar = D.analyzeProgress.querySelector('.bar i');
  if (bar) bar.style.width = clamp(p, 0, 100) + '%';
  D.analyzeMsg.textContent = msg || '';
}

function currentSegSettings() {
  const st = S.project.settings;
  return {
    sensitivity: +D.gSensitivity.value,
    minSilence: +D.gMinSilence.value,
    minSegment: Math.max(0.6, st.minSceneDur * 0.7),
    maxSegment: st.maxSceneDur,
  };
}

function showAudioInfo() {
  const a = S.project.audio;
  D.audioInfo.hidden = false;
  D.aiName.textContent = a.name || '—';
  D.aiDur.textContent = a.duration ? fmtTimeShort(a.duration) + ` (${a.duration.toFixed(2)}s)` : '—';
  D.aiSegs.textContent = S.analysis?.segments ? toBengaliDigits(S.analysis.segments.length) + 'টি' : '—';
  D.voiceVolume.value = a.volume ?? 1;
  D.voiceVolumeVal.textContent = Math.round((a.volume ?? 1) * 100) + '%';
}

function drawWavePreview() {
  const cv = D.waveCanvas;
  if (!cv || !S.analysis) return;
  const W = cv.clientWidth || 300, H = 72;
  cv.width = W * (window.devicePixelRatio || 1);
  cv.height = H * (window.devicePixelRatio || 1);
  cv.style.height = H + 'px';
  const g = cv.getContext('2d');
  g.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  g.clearRect(0, 0, W, H);
  const peaks = buildWaveformPeaks(S.analysis, W);
  const mid = H / 2;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(125,211,252,.9)');
  grad.addColorStop(.5, 'rgba(245,196,81,.95)');
  grad.addColorStop(1, 'rgba(125,211,252,.9)');
  g.fillStyle = grad;
  for (let x = 0; x < W; x++) {
    const h = Math.max(1, (peaks[x] || 0) * (H * .45));
    g.fillRect(x, mid - h, 1, h * 2);
  }
  // সিগমেন্ট মার্ক
  if (S.analysis.segments) {
    g.strokeStyle = 'rgba(255,107,107,.55)'; g.lineWidth = 1;
    S.analysis.segments.forEach(s => {
      const x = (s.start / S.analysis.duration) * W;
      g.beginPath(); g.moveTo(x, 2); g.lineTo(x, H - 2); g.stroke();
    });
  }
}

async function handleBgmFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  commit('BGM', () => { S.project.settings.bgmSrc = url; S.project.settings.bgm = true; S.project.settings.bgmName = file.name; });
  engine.bgm.src = url;
  D.bgmToggle.checked = true;
  D.bgmDrop.querySelector('span').textContent = '✓ ' + file.name.slice(0, 26);
  toast('ব্যাকগ্রাউন্ড মিউজিক যোগ হয়েছে', 'ok');
}

/* ============================================================
   স্ক্রিপ্ট
   ============================================================ */
D.scriptInput.addEventListener('input', debounce(() => {
  S.project.scriptText = D.scriptInput.value;
  updateScriptStat();
  autoSave();
}, 500));
D.btnScriptLines.addEventListener('click', () => {
  const lines = scriptToLines(D.scriptInput.value);
  toast(`<b>${toBengaliDigits(lines.length)}</b>টি লাইন পাওয়া গেছে। ${lines.length ? '<br><i style="opacity:.7;font-size:11.5px">' + escapeHtml(lines[0].slice(0, 60)) + '…</i>' : ''}`, 'ok', 4000);
});
D.btnScriptClear.addEventListener('click', () => { D.scriptInput.value = ''; S.project.scriptText = ''; updateScriptStat(); });
function updateScriptStat() {
  const lines = scriptToLines(D.scriptInput.value);
  const words = (D.scriptInput.value.match(/\S+/g) || []).length;
  D.scriptStat.textContent = `${toBengaliDigits(lines.length)}টি লাইন · ${toBengaliDigits(words)}টি শব্দ`;
}

D.channelName.addEventListener('input', debounce(() => {
  S.project.meta.channel = D.channelName.value;
  refreshWatermarks();
  autoSave();
}, 400));
D.watermarkToggle.addEventListener('change', () => {
  commit('ওয়াটারমার্ক টগল', () => { S.project.settings.watermark = D.watermarkToggle.checked; });
  if (S.project.settings.watermark) refreshWatermarks(); else removeAllWatermarks();
  fullRefresh();
});

/* ============================================================
   জেনারেট কন্ট্রোল
   ============================================================ */
function bindRange(input, out, fmt) {
  const f = () => { out.textContent = fmt(+input.value); };
  input.addEventListener('input', f); f();
}
bindRange(D.gSensitivity, D.gSensitivityVal, v => Math.round(v * 100) + '%');
bindRange(D.gMinSilence, D.gMinSilenceVal, v => v.toFixed(2) + 's');
bindRange(D.gLeadIn, D.gLeadInVal, v => v.toFixed(2) + 's');
bindRange(D.gLeadOut, D.gLeadOutVal, v => v.toFixed(1) + 's');
bindRange(D.gMinScene, D.gMinSceneVal, v => v.toFixed(1) + 's');
bindRange(D.gMaxScene, D.gMaxSceneVal, v => v.toFixed(0) + 's');
bindRange(D.gCPS, D.gCPSVal, v => v.toFixed(1));

const syncSettings = () => {
  Object.assign(S.project.settings, {
    leadIn: +D.gLeadIn.value,
    leadOut: +D.gLeadOut.value,
    minSceneDur: +D.gMinScene.value,
    maxSceneDur: +D.gMaxScene.value,
    charsPerSecond: +D.gCPS.value,
    autoFx: D.gAutoFx.checked,
  });
};
[D.gSensitivity, D.gMinSilence].forEach(i => i.addEventListener('change', () => recomputeSegments()));
[D.gLeadIn, D.gLeadOut, D.gMinScene, D.gMaxScene, D.gCPS].forEach(i => i.addEventListener('change', syncSettings));
D.gAutoFx.addEventListener('change', syncSettings);
D.btnDice.addEventListener('click', () => { D.gSeed.value = Math.floor(Math.random() * 999999); toast('নতুন seed — চেপে দেখো, অন্য রকম টাইমলাইন আসবে', 'ok'); });

function recomputeSegments() {
  if (!S.analysis) return;
  S.analysis.segments = detectSegments(S.analysis, currentSegSettings());
  showAudioInfo(); drawWavePreview(); timeline.render();
}

/* ---------- মূল জেনারেট বাটন ---------- */
D.btnGenerate.addEventListener('click', () => generate(false));
D.btnRegenVariation.addEventListener('click', () => {
  D.gSeed.value = Math.floor(Math.random() * 999999);
  generate(false);
});
D.btnPreviewSegs.addEventListener('click', () => {
  if (!S.analysis) { toast('আগে অডিও আপলোড করো', 'warn'); return; }
  recomputeSegments();
  const segs = S.analysis.segments;
  toast(`<b>${toBengaliDigits(segs.length)}</b>টি সিগমেন্ট: ${segs.slice(0, 6).map(s => s.dur.toFixed(1) + 's').join(' · ')}${segs.length > 6 ? ' …' : ''}`, 'ok', 4200);
});

function generate(isDemo = false) {
  syncSettings();
  if (!isDemo && !S.project.audio.src) { toast('আগে অডিও আপলোড করো', 'warn'); activateTab('audio'); return; }
  if (!isDemo && !S.analysis) { toast('অডিও বিশ্লেষণ হয়নি — আবার আপলোড করো', 'warn'); return; }

  const seed = parseInt(D.gSeed.value, 10) || 20260916;
  let segments, scriptLines = null;

  if (!isDemo) {
    segments = S.analysis.segments || detectSegments(S.analysis, currentSegSettings());
    S.analysis.segments = segments;
    const script = D.scriptInput.value.trim();
    if (script) {
      const lines = scriptToLines(script);
      scriptLines = alignScriptToSegments(lines, segments, { charsPerSecond: S.project.settings.charsPerSecond });
    }
  } else {
    // ডেমো: কৃত্রিম সিগমেন্ট
    segments = [];
    let t = 0.6;
    for (let i = 0; i < 8; i++) { const d = 3 + (i % 3); segments.push({ start: t, end: t + d, dur: d, energy: .5 }); t += d + .5; }
    S.project.audio.duration = t;
  }

  commit('টাইমলাইন তৈরি', () => {
    S.project.scenes = generateTimeline(S.project, segments, scriptLines, { seed });
    if (S.project.settings.watermark && S.project.meta.channel) refreshWatermarks(true);
  });
  S.sel = { sceneId: S.project.scenes[0]?.id || null, elemId: null };

  // প্রজেক্টের নাম এখনো ডিফল্ট হলে স্ক্রিপ্টের প্রথম লাইন থেকে নাম দিই
  if (!isDemo && scriptLines?.length && (!S.project.meta.title || S.project.meta.title === 'নতুন ভিডিও প্রজেক্ট')) {
    const first = scriptLines[0].text.replace(/[।!?…]/g, '').trim();
    S.project.meta.title = first.split(/\s+/).slice(0, 6).join(' ') || S.project.meta.title;
    D.projectTitle.value = S.project.meta.title;
  }

  const n = S.project.scenes.length;
  toast(scriptLines
    ? `টাইমলাইন তৈরি ✓ <b>${toBengaliDigits(n)}</b>টি সিন — স্ক্রিপ্টের ${toBengaliDigits(scriptLines.length)}টি লাইন সিঙ্ক হয়েছে`
    : `টাইমলাইন তৈরি ✓ <b>${toBengaliDigits(n)}</b>টি সিন — অডিওর সাইলেন্স ধরে ভাগ করা হয়েছে`, 'ok', 4200);

  fullRefresh();
  D.emptyState.hidden = true;
  engine.seek(0, true);
  timeline.zoomFit();
  activateTab('scenes');
  savePersistent();
}

/* ============================================================
   সিলেকশন
   ============================================================ */
function selectScene(id) {
  S.sel = { sceneId: id, elemId: null };
  timeline.select(id, null);
  renderSceneList();
  inspector.render();
}
function selectElem(sid, eid) {
  S.sel = { sceneId: sid, elemId: eid };
  timeline.select(sid, eid);
  renderSceneList();
  inspector.render();
}
function focusSelected() {
  const sc = getScene(S.sel.sceneId);
  if (sc) { engine.seek(sc.start + 0.05, true); timeline.scrollToScene(sc); }
}
const getScene = id => S.project.scenes.find(s => s.id === id);

/* ============================================================
   সিন লিস্ট
   ============================================================ */
function renderSceneList() {
  const host = D.sceneList;
  host.innerHTML = '';
  S.project.scenes.forEach((sc, i) => {
    const txt = (sc.elements.find(e => ['title', 'text', 'quote'].includes(e.type))?.extra?.text) || sc.note || '';
    const item = el('div', { class: 'scene-item' + (S.sel.sceneId === sc.id ? ' active' : '') });
    item.innerHTML = `
      <div class="si-top"><span class="si-name">${escapeHtml(sc.name || `সিন ${i + 1}`)}</span>
      <span class="si-time">${sc.dur.toFixed(2)}s</span></div>
      <div class="si-text">${escapeHtml(txt)}</div>`;
    item.addEventListener('click', () => { selectScene(sc.id); engine.seek(sc.start + 0.05, true); });
    item.addEventListener('dblclick', () => { selectScene(sc.id); focusSelected(); });
    host.appendChild(item);
  });
  if (!S.project.scenes.length) host.appendChild(el('div', { class: 'insp-empty', text: 'এখনো কোনো সিন নেই' }));
}

D.btnAddScene.addEventListener('click', () => {
  const scenes = S.project.scenes;
  const start = scenes.length ? scenes[scenes.length - 1].start + scenes[scenes.length - 1].dur : 0;
  commit('সিন যোগ', () => {
    const sc = blankScene(S.project, start, 4, 'lineCenter');
    sc.name = `সিন ${scenes.length + 1}`;
    scenes.push(sc);
    S.sel = { sceneId: sc.id, elemId: null };
  });
  fullRefresh();
});
D.btnDupScene.addEventListener('click', () => {
  const sc = getScene(S.sel.sceneId);
  if (!sc) { toast('আগে একটি সিন বাছাই করো', 'warn'); return; }
  commit('সিন নকল', () => {
    const copy = clone(sc);
    copy.id = uid('sc');
    copy.elements = copy.elements.map(e => ({ ...e, id: uid('el') }));
    copy.start = sc.start + sc.dur;
    const idx = S.project.scenes.indexOf(sc) + 1;
    S.project.scenes.splice(idx, 0, copy);
    resealTimeline();
    S.sel = { sceneId: copy.id, elemId: null };
  });
  fullRefresh();
});
D.btnSplitScene.addEventListener('click', () => {
  const sc = getScene(S.sel.sceneId);
  if (!sc) { toast('আগে একটি সিন বাছাই করো', 'warn'); return; }
  const t = engine.time;
  if (t <= sc.start + 0.4 || t >= sc.start + sc.dur - 0.4) { toast('প্লেহেড সিনের মাঝখানে আনো, তারপর কাটো', 'warn'); return; }
  commit('সিন কাটা', () => {
    const idx = S.project.scenes.indexOf(sc);
    const cut = round(t - sc.start, 3);
    const oldDur = sc.dur;
    const right = clone(sc);
    right.id = uid('sc');
    right.name = sc.name + ' (খ)';
    right.start = round(sc.start + cut, 3);
    right.dur = round(oldDur - cut, 3);
    right.elements = right.elements
      .filter(e => (e.t + e.dur) > cut + 0.05)
      .map(e => {
        const c = { ...e, id: uid('el') };
        c.t = round(Math.max(0, e.t - cut), 3);
        c.dur = round(clamp(e.t + e.dur - cut - c.t, 0.3, right.dur - c.t), 3);
        c._rev = (e._rev || 0) + 1;
        return c;
      });
    sc.dur = round(cut, 3);
    sc.name = sc.name + ' (ক)';
    sc.elements.forEach(e => {
      e.dur = round(clamp(e.dur, 0.3, Math.max(0.35, sc.dur - e.t)), 3);
      e._rev = (e._rev || 0) + 1;
    });
    sc.elements = sc.elements.filter(e => e.t < sc.dur - 0.05);
    S.project.scenes.splice(idx + 1, 0, right);
  });
  fullRefresh();
  toast('সিন দুই ভাগ হয়েছে', 'ok');
});
D.btnDelScene.addEventListener('click', () => {
  const sc = getScene(S.sel.sceneId);
  if (!sc) { toast('আগে একটি সিন বাছাই করো', 'warn'); return; }
  commit('সিন মুছে ফেলা', () => {
    S.project.scenes = S.project.scenes.filter(s => s.id !== sc.id);
    resealTimeline();
    S.sel = { sceneId: S.project.scenes[0]?.id || null, elemId: null };
  });
  fullRefresh();
});

/* ============================================================
   ইন্সপেক্টর অ্যাকশন
   ============================================================ */
function applyTemplate(sc, tpl) {
  const idx = S.project.scenes.indexOf(sc);
  const text = (sc.elements.find(e => ['title', 'text', 'quote'].includes(e.type))?.extra?.text) || sc.note || '';
  const fresh = makeSceneFromTemplate(S.project, tpl, { start: sc.start, dur: sc.dur, text }, idx, mulberry32(Date.now() & 0xffff), S.project.settings);
  sc.template = tpl;
  sc.bg = fresh.bg;
  sc.elements = fresh.elements;
  sc.name = `${idx + 1}. ${TEMPLATES[tpl]?.bn || tpl}`;
  sc.dur = Math.max(sc.dur, TEMPLATES[tpl]?.minDur || 1.5);
  if (S.project.settings.watermark) addWatermark(sc);
  resealTimeline();
  S.sel = { sceneId: sc.id, elemId: null };
}

function addElementToScene(sc, type) {
  const e = makeElement(type, {
    x: 50, y: 50, w: 60,
    size: type === 'title' ? 96 : (type === 'counter' ? 180 : 56),
    t: round(clamp((sc.dur - 2) / 2, 0, Math.max(0, sc.dur - 0.4)), 2),
    dur: round(Math.min(sc.dur * 0.7, 3), 2),
  });
  sc.elements.push(e);
  S.sel = { sceneId: sc.id, elemId: e.id };
}
function deleteElement(sc, e) {
  sc.elements = sc.elements.filter(x => x.id !== e.id);
  S.sel = { sceneId: sc.id, elemId: null };
}
function dupeElement(sc, e) {
  const c = clone(e); c.id = uid('el'); c.y = clamp(e.y + 12, 0, 100);
  sc.elements.push(c);
  S.sel = { sceneId: sc.id, elemId: c.id };
}
function rerollSceneBg(sc) {
  const r = Math.random;
  sc.bg = {
    ...sc.bg,
    effect: EFFECT_IDS[1 + Math.floor(r() * (EFFECT_IDS.length - 1))],
    density: round(.7 + r() * .9, 2),
    speed: round(.6 + r() * .9, 2),
    gradientAngle: Math.floor(r() * 360),
    spotX: round(20 + r() * 60, 1), spotY: round(15 + r() * 55, 1), spotSize: round(45 + r() * 40, 1),
    seed: Math.floor(r() * 100000),
    motion: ['driftLeft', 'driftUp', 'pulse', 'slowPan', 'breathe', 'none'][Math.floor(r() * 6)],
  };
}
function rerollAllFx() {
  S.project.scenes.forEach((sc, i) => { if (i > 0 && i < S.project.scenes.length - 1) rerollSceneBg(sc); });
  toast('সব সিনের ব্যাকগ্রাউন্ড এফেক্ট নতুন করে রোল হয়েছে', 'ok');
}
function bulkTransition(t) {
  const pickT = t || ['crossfade', 'zoomIn', 'blur', 'slideLeft'][Math.floor(Math.random() * 4)];
  S.project.scenes.forEach((sc, i) => { if (i > 0) { sc.transition = pickT; sc.transitionDur = 0.55; } });
  toast(`সব সিনে ট্রানজিশন: <b>${pickT}</b>`, 'ok');
}
function watermarkPos() {
  // ল্যান্ডস্কেপে ডান-নিচে, পোর্ট্রেটে মাঝে-নিচে
  return S.project.meta.aspect === '16:9'
    ? { x: 93, y: 94, w: 26, align: 'right' }
    : { x: 50, y: 95, w: 60, align: 'center' };
}
function addWatermark(sc) {
  if (sc.elements.some(e => e.type === 'watermark')) return;
  const pos = watermarkPos();
  sc.elements.push(makeElement('watermark', {
    ...pos, size: 26,
    t: 0.4, dur: Math.max(0.4, sc.dur - 0.8), enter: 'fade', enterDur: 1.2, exit: 'fade', exitDur: .6,
    extra: { text: S.project.meta.channel }
  }));
  sc._rev = (sc._rev || 0) + 1;
}
function refreshWatermarks(silent = false) {
  if (!S.project.settings.watermark) { removeAllWatermarks(); return; }
  const pos = watermarkPos();
  S.project.scenes.forEach(sc => {
    addWatermark(sc);
    sc.elements.forEach(e => {
      if (e.type === 'watermark') {
        e.extra.text = S.project.meta.channel || 'তোমার চ্যানেল';
        e.dur = Math.max(0.4, sc.dur - 0.8);
        Object.assign(e, pos);
        e._rev = (e._rev || 0) + 1;
      }
    });
  });
  if (!silent) toast('ওয়াটারমার্ক আপডেট হয়েছে', 'ok');
}
function removeAllWatermarks() {
  S.project.scenes.forEach(sc => { sc.elements = sc.elements.filter(e => e.type !== 'watermark'); });
}
function resealTimeline() {
  const scenes = S.project.scenes;
  scenes.sort((a, b) => a.start - b.start);
  for (let i = 1; i < scenes.length; i++) {
    const p = scenes[i - 1], c = scenes[i];
    if (c.start < p.start + p.dur) {
      // আগেরটাই ছোট হবে
      c.start = round(p.start + p.dur, 3);
    }
    const nd = round(Math.max(0.3, c.start - p.start), 3);
    if (nd !== p.dur) { scaleElements(p, p.dur, nd); p.dur = nd; bump(p); }
  }
  const total = S.project.audio.duration || 0;
  const last = scenes[scenes.length - 1];
  if (last && total > last.start + last.dur) last.dur = round(total - last.start, 3);
}
function snapElementToVoice(sc, e) {
  // নোট: ইন্সপেক্টর এটাকে ইতিমধ্যে commit()-এর ভেতর থেকে ডাকে
  if (!S.analysis?.segments) { toast('অডিও সিগমেন্ট নেই', 'warn'); return; }
  const seg = S.analysis.segments.find(s => s.start >= sc.start - 0.3 && s.start < sc.start + sc.dur);
  if (!seg) { toast('এই সিনে ভয়েস সিগমেন্ট পাওয়া যায়নি', 'warn'); return; }
  e.t = round(clamp(seg.start - sc.start, 0, Math.max(0.05, sc.dur - 0.3)), 3);
  e.dur = round(clamp(seg.end - seg.start + 0.5, 0.4, Math.max(0.5, sc.dur - e.t)), 3);
  e._rev = (e._rev || 0) + 1;
  toast('কথা শুরুর সাথে মিলিয়ে দেওয়া হয়েছে', 'ok');
}

/* ============================================================
   ছবি
   ============================================================ */
setupDrop(D.imgDrop, D.imgInput, files => handleImages(files));
async function handleImages(files) {
  if (!files?.length) return;
  const arr = Array.from(files).slice(0, 12);
  for (const f of arr) {
    try {
      const dataUrl = await fileToResizedDataUrl(f, 1600, 0.82);
      commit('ছবি যোগ', () => { S.project.images.push({ id: uid('img'), name: f.name, dataUrl }); });
    } catch (e) { toast(`ছবি লোড হয়নি: ${f.name}`, 'err'); }
  }
  renderImageGrid();
  toast(`${toBengaliDigits(arr.length)}টি ছবি যোগ হয়েছে`, 'ok');
  savePersistent();
}
function renderImageGrid() {
  const g = D.imgGrid; g.innerHTML = '';
  S.project.images.forEach(im => {
    const t = el('div', { class: 'img-thumb' });
    t.appendChild(el('img', { src: im.dataUrl, alt: im.name }));
    const del = el('button', { class: 'del', text: '×', title: 'মুছে ফেলো' });
    del.addEventListener('click', ev => {
      ev.stopPropagation();
      commit('ছবি মুছে ফেলা', () => { S.project.images = S.project.images.filter(x => x.id !== im.id); });
      renderImageGrid();
    });
    t.appendChild(del);
    t.addEventListener('click', () => {
      const sc = getScene(S.sel.sceneId);
      if (!sc) { toast('আগে টাইমলাইন থেকে একটি সিন বাছাই করো', 'warn'); return; }
      let img = sc.elements.find(e => e.type === 'image');
      commit('ছবি বসানো', () => {
        if (!img) { img = makeElement('image', { x: 50, y: 50, w: 46, size: 40, t: 0.3, dur: Math.max(1, sc.dur - 0.7) }); sc.elements.push(img); }
        img.extra.src = im.dataUrl;
      });
      S.sel = { sceneId: sc.id, elemId: img.id };
      fullRefresh();
      toast('ছবি বসে গেছে', 'ok');
    });
    g.appendChild(t);
  });
  if (!S.project.images.length) g.innerHTML = '<div class="hint" style="grid-column:1/-1">এখনো ছবি নেই</div>';
}
function fileToResizedDataUrl(file, maxDim, quality) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = e => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}

/* ============================================================
   ট্রান্সপোর্ট
   ============================================================ */
D.btnPlay.addEventListener('click', () => engine.toggle());
D.btnPrevScene.addEventListener('click', () => stepScene(-1));
D.btnNextScene.addEventListener('click', () => stepScene(1));
function stepScene(dir) {
  const scenes = S.project.scenes;
  if (!scenes.length) return;
  const i = findSceneIndex(scenes, engine.time);
  const target = clamp(i + dir, 0, scenes.length - 1);
  // একই সিনে থাকলে শুরুতে যাও
  const t = (target === i && dir < 0 && engine.time > scenes[i].start + 0.3) ? scenes[i].start : scenes[target].start;
  engine.seek(t + 0.01, true);
  selectScene(scenes[target].id);
}
D.loopToggle.addEventListener('change', () => { S.loop = D.loopToggle.checked; });
D.qualitySelect.addEventListener('change', () => {
  renderer.setQuality(D.qualitySelect.value);
  renderer.setProject(S.project);
  engine.seek(engine.time, true);
  toast(`রেন্ডার কোয়ালিটি: ${D.qualitySelect.value === 'high' ? 'উচ্চ' : D.qualitySelect.value === 'med' ? 'মাঝারি' : 'নিম্ন'}`, 'ok');
});
D.speedSelect.addEventListener('change', () => {
  engine.audio.playbackRate = +D.speedSelect.value;
  engine.bgm.playbackRate = +D.speedSelect.value;
});
D.btnGuides.addEventListener('click', () => {
  S.project.settings.showGrid = !S.project.settings.showGrid;
  renderer.showGuides(S.project.settings.showGrid);
  D.btnGuides.classList.toggle('active', S.project.settings.showGrid);
});
D.btnFullscreen.addEventListener('click', () => toggleFullscreenPreview());

function toggleFullscreenPreview() {
  if (!document.fullscreenElement) {
    D.stageViewport.requestFullscreen().then(() => setTimeout(fitStage, 120)).catch(() => toast('ফুলস্ক্রিন অনুমতি পাওয়া যায়নি', 'warn'));
  } else document.exitFullscreen();
}

D.btnZoomIn.addEventListener('click', () => timeline.setZoom(timeline.pps * 1.35));
D.btnZoomOut.addEventListener('click', () => timeline.setZoom(timeline.pps / 1.35));
D.btnZoomFit.addEventListener('click', () => timeline.zoomFit());

/* স্টেজে ক্লিক = সেই জায়গার সিনে যাও */
D.stage.addEventListener('pointerdown', ev => {
  if (record.active || !S.project.scenes.length) return;
  const scenes = S.project.scenes;
  const i = findSceneIndex(scenes, engine.time);
  selectScene(scenes[i].id);
});

/* ============================================================
   রেকর্ড মোড
   ============================================================ */
/* ---------- রেকর্ড মোড ---------- */
const recModal = $('#recModal');
D.btnRecord.addEventListener('click', () => openRecordModal());

function openRecordModal() {
  if (!S.project.scenes.length) { toast('আগে অডিও দিয়ে টাইমলাইন তৈরি করো', 'warn'); activateTab('generate'); return; }
  if (storage.load('recDontShow', false)) { startRecord(); return; }
  recModal.hidden = false;
}
function closeRecordModal() { recModal.hidden = true; }
$('#recModalClose').addEventListener('click', closeRecordModal);
$('#recCancel').addEventListener('click', closeRecordModal);
recModal.addEventListener('pointerdown', ev => { if (ev.target === recModal) closeRecordModal(); });
$('#recDontShow').addEventListener('change', ev => storage.save('recDontShow', ev.target.checked));
$('#recStart').addEventListener('click', async () => {
  closeRecordModal();
  await startRecord();
});

async function startRecord() {
  if (!S.project.scenes.length) { toast('আগে টাইমলাইন তৈরি করো', 'warn'); return; }
  engine.pause();
  // রেকর্ডিংয়ে সর্বোচ্চ কোয়ালিটি
  const prevQ = D.qualitySelect.value;
  D.qualitySelect.value = 'high';
  renderer.setQuality('high');
  renderer.setProject(S.project);
  bumpAll();
  toast('রেকর্ড মোড চালু হচ্ছে… স্ক্রিন রেকর্ডার অন থাকলে ভালো হয়', 'warn', 2600);
  await new Promise(r => setTimeout(r, 900));
  try {
    await record.enter(3);
  } catch (e) {
    console.error(e);
    toast('রেকর্ড মোড চালু করা যায়নি: ' + e.message, 'err');
    D.qualitySelect.value = prevQ;
    renderer.setQuality(prevQ);
  }
}

/* ============================================================
   হেল্প মোডাল
   ============================================================ */
const helpModal = $('#helpModal');
function openHelp() { helpModal.hidden = false; }
function closeHelp() { helpModal.hidden = true; }
D.btnHelp = $('#btnHelp');
D.btnHelp.addEventListener('click', openHelp);
$('#helpClose').addEventListener('click', closeHelp);
$('#helpOk').addEventListener('click', closeHelp);
helpModal.addEventListener('pointerdown', ev => { if (ev.target === helpModal) closeHelp(); });

/* ============================================================
   কিবোর্ড শর্টকাট
   ============================================================ */
window.addEventListener('keydown', ev => {
  if (record.active) {
    if (ev.key === 'Escape') { ev.preventDefault(); record.exit(); }
    return;
  }
  const tag = (ev.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || ev.target.isContentEditable;

  if (ev.key === 'F11') { ev.preventDefault(); openRecordModal(); return; }
  if (ev.key === '?' || (ev.key === '/' && ev.shiftKey)) { ev.preventDefault(); helpModal.hidden ? openHelp() : closeHelp(); return; }
  if (ev.key === 'Escape' && !helpModal.hidden) { closeHelp(); return; }
  if (ev.key === 'Escape' && !recModal.hidden) { closeRecordModal(); return; }
  if (ev.key === 'Escape') {
    if (document.fullscreenElement) document.exitFullscreen();
    return;
  }
  if (typing) {
    if (ev.key === 'Escape') ev.target.blur();
    return;
  }

  if (ev.code === 'Space') { ev.preventDefault(); engine.toggle(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); exportJson(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'g') { ev.preventDefault(); generate(false); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); D.btnDupScene.click(); return; }
  if (ev.key === 'f' || ev.key === 'F') { toggleFullscreenPreview(); return; }
  if (ev.key === 'g' || ev.key === 'G') { D.btnGuides.click(); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    if (S.sel.elemId) { const sc = getScene(S.sel.sceneId); const e = sc?.elements.find(x => x.id === S.sel.elemId); if (sc && e) { commit('এলিমেন্ট মুছু', () => deleteElement(sc, e)); fullRefresh(); } ev.preventDefault(); }
    return;
  }
  if (ev.key === 'ArrowLeft') { engine.seek(engine.time - (ev.shiftKey ? 1 : 0.1), true); ev.preventDefault(); }
  if (ev.key === 'ArrowRight') { engine.seek(engine.time + (ev.shiftKey ? 1 : 0.1), true); ev.preventDefault(); }
  if (ev.key === 'Home') { engine.seek(0, true); ev.preventDefault(); }
  if (ev.key === 'End') { engine.seek(engine.duration, true); ev.preventDefault(); }
  if (ev.key === 'j' || ev.key === 'J') stepScene(-1);
  if (ev.key === 'k' || ev.key === 'K') engine.toggle();
  if (ev.key === 'l' || ev.key === 'L') stepScene(1);
});

/* ============================================================
   আনডু / রিডু
   ============================================================ */
function snapshot() {
  return JSON.stringify({ project: S.project, sel: S.sel });
}
function pushHistory() {
  S.undo.push(snapshot());
  if (S.undo.length > MAX_HISTORY) S.undo.shift();
  S.redo.length = 0;
  updateHistoryBtns();
}
function undo() {
  if (!S.undo.length) { toast('পূর্বাবস্থায় যাওয়ার কিছু নেই', 'warn'); return; }
  S.redo.push(snapshot());
  restore(S.undo.pop());
  updateHistoryBtns();
}
function redo() {
  if (!S.redo.length) return;
  S.undo.push(snapshot());
  restore(S.redo.pop());
  updateHistoryBtns();
}
function restore(json) {
  try {
    const st = JSON.parse(json);
    S.project = st.project;
    bumpAll();
    S.sel = st.sel || { sceneId: null, elemId: null };
    if (S.project.audio?.src) engine.setAudioSrc(S.project.audio.src);
    engine.project = S.project;
    renderer.setProject(S.project);
    fullRefresh();
  } catch (e) { console.error(e); toast('পূর্বাবস্থায় ফেরানো যায়নি', 'err'); }
}
function updateHistoryBtns() {
  D.btnUndo.disabled = !S.undo.length;
  D.btnRedo.disabled = !S.redo.length;
}
D.btnUndo.addEventListener('click', undo);
D.btnRedo.addEventListener('click', redo);

/** একটি এডিট কমিট করা (হিস্টোরি সহ) */
function commit(label, fn) {
  pushHistory();
  fn();
  bumpAll();
  renderer.setProject(S.project);
  engine.project = S.project;
  renderer.renderAt(engine.time, S.project);
  timeline.setData(S.project, S.analysis);
  renderSceneList();
  inspector.render();
  updateEmptyState();
  autoSave();
}
/** হালকা কমিট (ড্র্যাগের সময় হিস্টোরি একবারই) */
let lightTimer = null;
function commitLight(label) {
  if (!lightTimer) pushHistory();
  clearTimeout(lightTimer);
  lightTimer = setTimeout(() => { lightTimer = null; }, 500);
  bumpAll();
  renderer.setProject(S.project);
  renderer.renderAt(engine.time, S.project);
  timeline.render();
  renderSceneList();
  inspector.render();
  autoSave();
}

/* ============================================================
   টপবার অ্যাকশন
   ============================================================ */
D.projectTitle.addEventListener('input', debounce(() => { S.project.meta.title = D.projectTitle.value; autoSave(); }, 400));
D.aspect.addEventListener('change', () => commit('অ্যাসপেক্ট', () => { S.project.meta.aspect = D.aspect.value; }));

D.btnDemo.addEventListener('click', loadDemo);
$('#btnEmptyDemo').addEventListener('click', loadDemo);
$('#btnEmptyAudio').addEventListener('click', () => { activateTab('audio'); D.audioInput.click(); });

function loadDemo() {
  commit('ডেমো লোড', () => {
    S.project = demoProject();
    S.project.meta.theme = S.project.meta.theme || 'midnight';
    S.analysis = null;
    S.sel = { sceneId: S.project.scenes[0].id, elemId: null };
  });
  syncUIFromProject();
  engine.project = S.project;
  renderer.setProject(S.project);
  fullRefresh();
  engine.seek(0, true);
  timeline.zoomFit();
  toast('ডেমো প্রজেক্ট লোড হয়েছে — <b>Space</b> চেপে প্লে করো', 'ok', 3600);
}

D.btnNew.addEventListener('click', () => {
  if (S.project.scenes.length && !confirm('নতুন প্রজেক্ট শুরু করলে বর্তমান কাজ মুছে যাবে (আনডু করা যাবে)। এগিয়ে যাবে?')) return;
  commit('নতুন প্রজেক্ট', () => {
    S.project = defaultProject();
    S.analysis = null;
    S.sel = { sceneId: null, elemId: null };
  });
  syncUIFromProject();
  fullRefresh();
  activateTab('audio');
  toast('নতুন খালি প্রজেক্ট', 'ok');
});

D.btnExportJson.addEventListener('click', exportJson);
D.btnImportJson.addEventListener('click', () => D.jsonInput.click());
D.jsonInput.addEventListener('change', async ev => {
  const f = ev.target.files?.[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data.meta || !Array.isArray(data.scenes)) throw new Error('ফাইলের গঠন ঠিক নেই');
    commit('প্রজেক্ট আমদানি', () => {
      S.project = Object.assign(defaultProject(), data);
      S.project.settings = Object.assign(defaultProject().settings, data.settings || {});
      S.sel = { sceneId: S.project.scenes[0]?.id || null, elemId: null };
    });
    syncUIFromProject();
    fullRefresh();
    engine.seek(0, true);
    toast('প্রজেক্ট আমদানি হয়েছে ✓ (অডিও আবার আপলোড করতে হবে)', 'ok', 4000);
  } catch (e) { toast('JSON পড়া যায়নি: ' + e.message, 'err'); }
  ev.target.value = '';
});

function exportJson() {
  const data = clone(S.project);
  // বড় ডেটা বাদ দিই (ছবি রাখি, অডিও src রাখি না)
  data.audio.src = null;
  data.settings.bgmSrc = null;
  data._exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${(data.meta.title || 'project').replace(/[^\w\u0980-\u09FF-]+/g, '_')}.cineproj.json`);
  toast('প্রজেক্ট ফাইল ডাউনলোড হয়েছে', 'ok');
}

/* ============================================================
   UI সিঙ্ক
   ============================================================ */
function syncUIFromProject() {
  const p = S.project;
  D.projectTitle.value = p.meta.title || '';
  D.aspect.value = p.meta.aspect || '16:9';
  D.channelName.value = p.meta.channel || '';
  D.scriptInput.value = p.scriptText || '';
  updateScriptStat();
  D.watermarkToggle.checked = !!p.settings.watermark;
  D.gSensitivity.value = p.settings.sensitivity ?? 0.5;
  D.gMinSilence.value = p.settings.minSilence ?? 0.45;
  D.gLeadIn.value = p.settings.leadIn ?? 0.6;
  D.gLeadOut.value = p.settings.leadOut ?? 1.6;
  D.gMinScene.value = p.settings.minSceneDur ?? 1.6;
  D.gMaxScene.value = p.settings.maxSceneDur ?? 14;
  D.gCPS.value = p.settings.charsPerSecond ?? 8.2;
  D.gAutoFx.checked = p.settings.autoFx !== false;
  D.voiceVolume.value = p.audio.volume ?? 1;
  D.voiceVolumeVal.textContent = Math.round((p.audio.volume ?? 1) * 100) + '%';
  D.bgmToggle.checked = !!p.settings.bgm;
  D.bgmVolume.value = p.settings.bgmVolume ?? 0.12;
  D.bgmVolumeVal.textContent = Math.round((p.settings.bgmVolume ?? 0.12) * 100) + '%';
  [D.gSensitivity, D.gMinSilence, D.gLeadIn, D.gLeadOut, D.gMinScene, D.gMaxScene, D.gCPS].forEach(i => i.dispatchEvent(new Event('input')));
  buildSwatches();
  renderImageGrid();
  if (p.audio.src) showAudioInfo(); else D.audioInfo.hidden = true;
  renderer.showGuides(!!p.settings.showGrid);
  D.btnGuides.classList.toggle('active', !!p.settings.showGrid);
}

function fullRefresh() {
  renderer.setProject(S.project);
  engine.project = S.project;
  renderer.renderAt(engine.time, S.project);
  timeline.setData(S.project, S.analysis);
  D.tDur.textContent = fmtTime(engine.duration);
  renderSceneList();
  inspector.render();
  buildSwatches();
  updateEmptyState();
  autoSave();
}

function updateEmptyState() {
  D.emptyState.hidden = S.project.scenes.length > 0;
}

/* ============================================================
   স্টেজ ফিটিং
   ============================================================ */
function fitStage() {
  if (record.active) { record.fitStage(); return; }
  const dims = aspectDims(S.project.meta.aspect);
  renderer.setSize(dims.w, dims.h);
  const vp = D.stageViewport;
  const pad = 36;
  const availW = vp.clientWidth - pad, availH = vp.clientHeight - pad;
  const s = Math.min(availW / dims.w, availH / dims.h, 1.35);
  D.stageScaler.style.transform = `scale(${s})`;
  D.stageScaler.style.width = (dims.w * s) + 'px';
  D.stageScaler.style.height = (dims.h * s) + 'px';
}
new ResizeObserver(() => fitStage()).observe(D.stageViewport);
window.addEventListener('resize', () => { fitStage(); timeline.render(); });
document.addEventListener('fullscreenchange', () => setTimeout(fitStage, 140));

/* ============================================================
   ড্র্যাগ-অ্যান্ড-ড্রপ সেটআপ
   ============================================================ */
function setupDrop(zone, input, onFiles) {
  zone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') input.click(); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('over');
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => { if (input.files?.length) onFiles(input.files); input.value = ''; });
}
// পুরো উইন্ডোতে অডিও ড্রপ করলেও কাজ হবে
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  if (/^audio\//.test(f.type)) { handleAudioFile(f); activateTab('audio'); }
  else if (/^image\//.test(f.type)) { handleImages([f]); activateTab('assets'); }
});

/* ============================================================
   পারসিস্টেন্স (IndexedDB + localStorage)
   ============================================================ */
const DB_NAME = 'cine_engine_db', DB_VER = 1;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(store, key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(val, key);
    tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const rq = tx.objectStore(store).get(key);
    rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => rej(rq.error);
  });
}

let saveTimer = null;
function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePersistent, 900);
}
async function savePersistent() {
  try {
    const data = clone(S.project);
    data.audio = { ...data.audio, src: null };
    data.settings = { ...data.settings, bgmSrc: null };
    data.scriptText = S.project.scriptText || D.scriptInput.value || '';
    storage.save('project', data);
    storage.save('ui', { quality: D.qualitySelect.value, seed: D.gSeed.value, sensitivity: D.gSensitivity.value, minSilence: D.gMinSilence.value });
  } catch (e) { console.warn('autosave failed', e); }
}
async function saveAudioBlob(blob) {
  try { await idbPut('media', 'voiceover', blob); } catch (e) { console.warn(e); }
}

async function restorePersistent() {
  const ui = storage.load('ui', {});
  if (ui.quality) D.qualitySelect.value = ui.quality;
  if (ui.seed) D.gSeed.value = ui.seed;
  if (ui.sensitivity !== undefined) D.gSensitivity.value = ui.sensitivity;
  if (ui.minSilence !== undefined) D.gMinSilence.value = ui.minSilence;

  const data = storage.load('project', null);
  if (!data || !data.scenes?.length) return false;
  S.project = Object.assign(defaultProject(), data);
  S.project.settings = Object.assign(defaultProject().settings, data.settings || {});

  // অডিও ব্লব ফেরত আনা
  try {
    const blob = await idbGet('media', 'voiceover');
    if (blob) {
      const url = URL.createObjectURL(blob);
      S.project.audio.src = url;
      engine.setAudioSrc(url);
      // দ্রুত বিশ্লেষণ (টাইমলাইনের ওয়েভফর্মের জন্য)
      analyzeAudioFile(new File([blob], S.project.audio.name || 'voiceover'), () => { })
        .then(a => {
          S.analysis = { ...a, segments: detectSegments(a, currentSegSettings()) };
          showAudioInfo(); drawWavePreview(); timeline.setData(S.project, S.analysis);
          engine.audio.volume = S.project.audio.volume ?? 1;
        }).catch(() => { });
    }
  } catch (e) { console.warn('audio restore failed', e); }

  syncUIFromProject();
  S.sel = { sceneId: S.project.scenes[0]?.id || null, elemId: null };
  return true;
}

/* ============================================================
   ইউটিলিটি
   ============================================================ */
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/** প্রজেক্ট/সিন/এলিমেন্ট বদলালে রিভিশন বাড়ানো — স্টেজ সঠিকভাবে রিবিল্ড হবে */
function bump(target) {
  if (!target) return;
  if (target.scenes) { target._rev = (target._rev || 0) + 1; }
  else if (target.elements) { target._rev = (target._rev || 0) + 1; }
  else { target._rev = (target._rev || 0) + 1; }
}
function bumpAll(p = S.project) {
  bump(p);
  (p.scenes || []).forEach(sc => { bump(sc); (sc.elements || []).forEach(e => bump(e)); });
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ============================================================
   বুট
   ============================================================ */
async function boot() {
  buildSwatches();
  syncUIFromProject();
  fitStage();
  updateHistoryBtns();

  const restored = await restorePersistent();
  if (restored) {
    engine.project = S.project;
    renderer.setProject(S.project);
    fullRefresh();
    engine.seek(0, true);
    timeline.zoomFit();
    toast('আগের প্রজেক্ট ফিরে এসেছে ✓ <span style="opacity:.6">(অডিও থাকলে অটো লোড হয়েছে)</span>', 'ok', 3800);
  } else {
    renderer.setProject(S.project);
    timeline.setData(S.project, null);
    updateEmptyState();
    renderSceneList();
    inspector.render();
  }

  window.__cine = { S, engine, renderer, timeline, inspector, record, toast, generate, fullRefresh };
}

boot();
