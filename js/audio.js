/* ============================================================
   Cinematic Engine — audio.js
   অডিও ডিকোড → লাউডনেস কার্ভ → সাইলেন্স ডিটেকশন → অটো সিগমেন্ট
   + স্ক্রিপ্ট লাইনের সাথে সময় মেলানো (forced alignment, lightweight)
   ============================================================ */

import { clamp } from './util.js';

/* ---------- ১. ফাইল ডিকোড ---------- */
let _ctx = null;
export function audioCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => { });
  return _ctx;
}

/**
 * অডিও ফাইল (mp3/wav/m4a/ogg) → { duration, buffer, url, frames }
 * frames: প্রতি ২০ms-এর লাউডনেস (0..1 নরমালাইজড)
 */
export async function analyzeAudioFile(file, onProgress = () => { }) {
  const arrayBuffer = await file.arrayBuffer();
  onProgress(15, 'ডিকোড হচ্ছে…');
  const ctx = audioCtx();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  onProgress(45, 'লাউডনেস মাপা হচ্ছে…');

  const mono = toMono(buffer);
  const frames = computeFrames(mono, buffer.sampleRate, 0.02);
  onProgress(80, 'সাইলেন্স খোঁজা হচ্ছে…');
  normalizeFrames(frames);
  onProgress(100, 'শেষ');

  const url = URL.createObjectURL(file);
  return {
    name: file.name,
    size: file.size,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    url,
    frames,           // { t, rms, peak, norm }[]
    frameDur: 0.02,
    buffer,
  };
}

function toMono(buffer) {
  const n = buffer.length;
  const out = new Float32Array(n);
  const ch = buffer.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / ch;
  }
  return out;
}

/** প্রতি frameDur সেকেন্ডে RMS + peak */
function computeFrames(samples, sampleRate, frameDur = 0.02) {
  const hop = Math.max(1, Math.round(sampleRate * frameDur));
  const count = Math.ceil(samples.length / hop);
  const frames = new Array(count);
  let maxPeak = 1e-6;
  for (let f = 0; f < count; f++) {
    const s = f * hop, e = Math.min(samples.length, s + hop);
    let sum = 0, peak = 0;
    for (let i = s; i < e; i++) {
      const v = samples[i] || 0;
      sum += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    const rms = Math.sqrt(sum / Math.max(1, e - s));
    if (peak > maxPeak) maxPeak = peak;
    frames[f] = { t: s / sampleRate, rms, peak, norm: 0 };
  }
  // নরমালাইজ
  for (const fr of frames) fr.norm = clamp(fr.rms / (maxPeak * 0.85), 0, 1);
  frames.maxPeak = maxPeak;
  return frames;
}
function normalizeFrames(frames) { /* computeFrames-এই করা আছে, hook হিসেবে রাখা */ }

/* ---------- ২. সাইলেন্স ডিটেকশন → ভয়েস সিগমেন্ট ---------- */
/**
 * @param {object} analysis  analyzeAudioFile() এর ফল
 * @param {object} opt  { sensitivity: 0..1, minSilence, minSegment, maxSegment }
 * @returns {Array<{start,end,dur,energy}>}
 *
 * sensitivity বেশি = কম লাউডনেসেও "কথা" ধরবে (নরম ভয়েসের জন্য ভালো)
 */
export function detectSegments(analysis, opt = {}) {
  const {
    sensitivity = 0.5,
    minSilence = 0.45,     // এর চেয়ে বড় চুপচাপ = নতুন সিনের সীমা
    minSegment = 1.2,      // এর চেয়ে ছোট সিগমেন্ট বাদ/মার্জ
    maxSegment = 22,       // এর চেয়ে বড় হলে ভেতরে ভাগ করব
    padStart = 0.12,
    padEnd = 0.18,
  } = opt;

  const frames = analysis.frames;
  const frameDur = analysis.frameDur || 0.02;
  if (!frames || !frames.length) return [];

  // থ্রেশহোল্ড: sensitivity অনুযায়ী নয়েজ ফ্লোর ও পিকের মাঝামাঝি
  const sorted = frames.map(f => f.norm).slice().sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const noiseFloor = q(0.25);
  const voiced = q(0.90);
  const thr = clamp(noiseFloor + (voiced - noiseFloor) * (0.55 - sensitivity * 0.40), 0.015, 0.7);

  // হ্যাংওভার স্মুথিং (ক্ষণিক ড্রপ বাদ দিতে)
  const hang = Math.max(2, Math.round(0.12 / frameDur));
  let hold = 0;
  const isVoice = frames.map(f => {
    const on = f.norm > thr;
    if (on) hold = hang; else hold = Math.max(0, hold - 1);
    return on || hold > 0;
  });

  // রান তৈরি
  const runs = [];
  let cur = null;
  for (let i = 0; i < isVoice.length; i++) {
    if (isVoice[i]) {
      if (!cur) cur = { start: frames[i].t, end: frames[i].t + frameDur, sum: 0, n: 0 };
      cur.end = frames[i].t + frameDur;
      cur.sum += frames[i].norm; cur.n++;
    } else if (cur) {
      runs.push(cur); cur = null;
    }
  }
  if (cur) runs.push(cur);
  if (!runs.length) {
    // কোনো ভয়েস পাওয়া যায়নি → পুরোটা এক সেগমেন্ট
    return [{ start: 0, end: analysis.duration, dur: analysis.duration, energy: 0.3 }];
  }

  // ছোট গ্যাপ মার্জ করা (< minSilence)
  const merged = [runs[0]];
  for (let i = 1; i < runs.length; i++) {
    const prev = merged[merged.length - 1], r = runs[i];
    const gap = r.start - prev.end;
    if (gap < minSilence) {
      prev.end = r.end;
      prev.sum += r.sum; prev.n += r.n;
    } else merged.push({ ...r });
  }

  // ছোট সিগমেন্ট মার্জ/বাদ
  const out = [];
  for (const r of merged) {
    const dur = r.end - r.start;
    if (dur < 0.22) continue;                     // শ্বাস/ক্লিক
    if (dur < minSegment && out.length) {
      const p = out[out.length - 1];
      if (r.start - p.end < minSilence * 3) { p.end = r.end; p.sum += r.sum; p.n += r.n; continue; }
    }
    out.push({
      start: Math.max(0, r.start - padStart),
      end: Math.min(analysis.duration, r.end + padEnd),
      energy: r.n ? r.sum / r.n : 0.3
    });
  }

  // খুব লম্বা সেগমেন্ট ভেতরের সাব-পজ দিয়ে ভাগ করা
  const finalSegs = [];
  for (const s of out) {
    if (s.end - s.start <= maxSegment) { finalSegs.push({ ...s, dur: s.end - s.start }); continue; }
    for (const sub of splitLongSegment(analysis, s, maxSegment)) finalSegs.push(sub);
  }

  return finalSegs.map(s => ({ ...s, dur: s.end - s.start }));
}

/** লম্বা সেগমেন্টকে ভেতরের সবচেয়ে শান্ত জায়গা দিয়ে ভাগ করা */
function splitLongSegment(analysis, seg, maxSegment) {
  const frames = analysis.frames;
  const fd = analysis.frameDur || 0.02;
  const i0 = Math.floor(seg.start / fd), i1 = Math.ceil(seg.end / fd);
  const pieces = [];
  let curStart = seg.start;

  while (seg.end - curStart > maxSegment) {
    // curStart+maxSegment*0.6 .. curStart+maxSegment*1.05 এর মধ্যে সবচেয়ে শান্ত ফ্রেম
    let best = null, bestScore = Infinity;
    const a = Math.floor((curStart + maxSegment * 0.55) / fd);
    const b = Math.floor((curStart + maxSegment * 1.02) / fd);
    for (let i = Math.max(i0, a); i < Math.min(i1, b); i++) {
      const f = frames[i]; if (!f) continue;
      // কেন্দ্র থেকে দূরত্ব পেনাল্টি + লাউডনেস
      const centerBias = Math.abs(f.t - (curStart + maxSegment * 0.82)) * 0.35;
      const score = f.norm + centerBias;
      if (score < bestScore) { bestScore = score; best = f; }
    }
    if (!best) break;
    const cut = best.t + fd / 2;
    pieces.push({ start: curStart, end: cut, dur: cut - curStart, energy: seg.energy });
    curStart = cut;
  }
  pieces.push({ start: curStart, end: seg.end, dur: seg.end - curStart, energy: seg.energy });
  return pieces;
}

/* ---------- ৩. স্ক্রিপ্ট → সিগমেন্ট ম্যাপিং (Forced Alignment Lite) ---------- */
/**
 * স্ক্রিপ্টের লাইন সংখ্যা ও সিগমেন্ট সংখ্যা মিলিয়ে প্রতিটি লাইনের সময় নির্ধারণ।
 * কৌশল: প্রতিটি সিগমেন্টকে "চরিত্র-ক্ষমতা" দিই (সময় × কথা বলার হার)।
 * তারপর লাইনগুলোকে সেই ক্ষমতা অনুযায়ী বন্টন করি — যেন কম কথা থাকা
 * সিগমেন্টে ছোট লাইন, বেশি কথা থাকা সিগমেন্টে বড় লাইন পড়ে।
 *
 * @returns {Array<{text, start, end, dur, segIndex, confidence}>}
 */
export function alignScriptToSegments(scriptLines, segments, opt = {}) {
  const { charsPerSecond = 8.2 } = opt; // বাংলা গড় উচ্চারণ হার
  const lines = scriptLines.map(s => String(s).trim()).filter(Boolean);
  if (!lines.length || !segments.length) return [];

  // প্রতিটি লাইনের "প্রত্যাশিত সময়"
  const expected = lines.map(l => Math.max(0.6, countSpeakable(l) / charsPerSecond));
  const totalExpected = expected.reduce((a, b) => a + b, 0);
  const totalSegTime = segments.reduce((a, s) => a + s.dur, 0);

  // স্কেল ফ্যাক্টর (স্ক্রিপ্ট vs আসল অডিও)
  const scale = totalSegTime / Math.max(0.001, totalExpected);

  // সিগমেন্ট ধারণক্ষমতা = seg.dur / scale (অর্থাৎ কত "স্ক্রিপ্ট-সেকেন্ড" এতে ঢুকবে)
  const caps = segments.map(s => s.dur / scale);

  const out = [];
  let si = 0, used = 0;           // si = বর্তমান সিগমেন্ট, used = তার মধ্যে কতটা খরচ হয়েছে
  for (let li = 0; li < lines.length; li++) {
    let need = expected[li];
    let start = null, end = null;

    while (need > 1e-6 && si < segments.length) {
      const seg = segments[si];
      const room = caps[si] - used;
      if (room <= 1e-6) { si++; used = 0; continue; }

      const take = Math.min(room, need);
      const tStart = seg.start + (used / Math.max(1e-6, caps[si])) * seg.dur;
      const tEnd = seg.start + ((used + take) / Math.max(1e-6, caps[si])) * seg.dur;

      if (start === null) start = tStart;
      end = tEnd;

      used += take; need -= take;
      if (used >= caps[si] - 1e-6) { si++; used = 0; }
    }

    if (start === null) {   // সিগমেন্ট শেষ — বাকি লাইনগুলো শেষে চেপে দিই
      const last = segments[segments.length - 1];
      start = end = last.end;
    }

    out.push({
      text: lines[li],
      start,
      end,
      dur: Math.max(0.35, end - start),
      segIndex: Math.min(si, segments.length - 1),
      confidence: need > 1e-6 ? 0.5 : 1,
    });
  }
  return out;
}

/** উচ্চারণযোগ্য চরিত্র সংখ্যা (বিরাম চিহ্ন বাদে) */
export function countSpeakable(text) {
  return String(text).replace(/[\s\p{P}\p{S}]/gu, '').length;
}

/** স্ক্রিপ্ট টেক্সট → লাইন অ্যারে (ফাঁকা লাইন অনুযায়ী ভাগ, দীর্ঘ লাইন আরও ভাগা) */
export function scriptToLines(raw, maxChars = 90) {
  const blocks = String(raw || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{1,}/)
    .map(s => s.trim())
    .filter(Boolean);

  const lines = [];
  for (const b of blocks) {
    if (b.length <= maxChars) { lines.push(b); continue; }
    // বাক্যের শেষে ভাগ, না হলে কমা/ছন্দচিহ্নে, না হলে শব্দে
    const parts = b.split(/(?<=[।!?…])\s+/);
    for (const p of parts) {
      if (p.length <= maxChars) { lines.push(p); continue; }
      const words = p.split(/\s+/);
      let cur = '';
      for (const w of words) {
        if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur.trim()); cur = w; }
        else cur = (cur + ' ' + w).trim();
      }
      if (cur) lines.push(cur.trim());
    }
  }
  return lines;
}

/* ---------- ৪. লাউডনেস কার্ভ থেকে ওয়েভফর্ম পিক (টাইমলাইনে দেখানোর জন্য) ---------- */
export function buildWaveformPeaks(analysis, buckets = 900) {
  const frames = analysis.frames || [];
  if (!frames.length) return new Float32Array(0);
  const dur = analysis.duration || frames[frames.length - 1].t;
  const out = new Float32Array(buckets);
  const perBucket = dur / buckets;
  for (const f of frames) {
    const b = Math.min(buckets - 1, Math.floor(f.t / perBucket));
    if (f.norm > out[b]) out[b] = f.norm;
  }
  return out;
}
