/* ============================================================
   Cinematic Engine — effects.js
   Canvas ব্যাকগ্রাউন্ড এফেক্ট: embers, dust, stars, rain, grid,
   softblobs, rays, bokeh, waves, smoke
   সব এফেক্ট time-driven (স্ক্রাব করলেও ঠিক থাকে)
   ============================================================ */

import { clamp } from './util.js';

export const EFFECTS = {
  none:     { id: 'none',     bn: 'কিছু নেই' },
  embers:   { id: 'embers',   bn: 'জ্বলন্ত কণা (Embers)' },
  dust:     { id: 'dust',     bn: 'ধুলো/আলোক কণা (Dust)' },
  stars:    { id: 'stars',    bn: 'তারকা (Stars)' },
  rain:     { id: 'rain',     bn: 'বৃষ্টি (Rain)' },
  grid:     { id: 'grid',     bn: 'নিয়ন গ্রিড (Grid)' },
  softblobs:{ id: 'softblobs',bn: 'নরম আলোর ঢেউ (Blobs)' },
  rays:     { id: 'rays',     bn: 'আলোক রশ্মি (Rays)' },
  bokeh:    { id: 'bokeh',    bn: 'বোকে (Bokeh)' },
  waves:    { id: 'waves',    bn: 'ঢেউ (Waves)' },
  smoke:    { id: 'smoke',    bn: 'ধোঁয়া (Smoke)' },
  confetti: { id: 'confetti', bn: 'কনফেটি (Confetti)' },
};
export const EFFECT_IDS = Object.keys(EFFECTS);

/** ডিটারমিনিস্টিক ছদ্ম-র‍্যান্ডম (seed থেকে) — স্ক্রাবেও একই পার্টিকেল */
function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * একটি এফেক্ট লেয়ার তৈরি করে।
 * fx = makeEffect(canvas, effectId, { theme, density, speed, seed })
 * fx.render(time, localT)  // time = গ্লোবাল, localT = সিন-লোকাল 0..1
 */
export function makeEffect(canvas, effectId, opts = {}) {
  const {
    theme, density = 1, speed = 1, seed = 1234,
    width = 1920, height = 1080,
  } = opts;

  const ctx = canvas.getContext('2d', { alpha: true });
  canvas.width = width; canvas.height = height;
  const c = theme.colors;
  const R = rnd(seed);

  const N = Math.round(90 * density);
  const parts = [];
  for (let i = 0; i < N; i++) {
    parts.push({
      x: R() * width, y: R() * height,
      r: 0.6 + R() * 3.2,
      sp: 0.25 + R() * 1.1,
      ph: R() * Math.PI * 2,
      drift: (R() - 0.5) * 40,
      hue: R(),
      rot: R() * Math.PI * 2,
      rotSp: (R() - 0.5) * 2,
      size: 8 + R() * 26,
    });
  }

  function clearCanvas() { ctx.clearRect(0, 0, width, height); }

  const renderers = {
    none() { clearCanvas(); },

    embers(t, lt) {
      clearCanvas();
      ctx.globalCompositeOperation = 'lighter';
      const fadeIn = clamp(lt * 5), fadeOut = clamp((1 - lt) * 5);
      const alpha = Math.min(fadeIn, fadeOut);
      for (const p of parts) {
        const life = ((t * 22 * p.sp * speed + p.ph * 90) % (height + 260)) ;
        const y = height + 130 - life;
        const x = p.x + Math.sin(t * 0.55 * speed + p.ph) * p.drift * 1.6;
        const rr = p.r * (1 + 0.35 * Math.sin(t * 2.4 + p.ph));
        const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 7);
        const col = p.hue > 0.72 ? c.accent2 : c.accent;
        g.addColorStop(0, hexA(col, 0.9 * alpha));
        g.addColorStop(0.35, hexA(col, 0.30 * alpha));
        g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, rr * 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    dust(t, lt) {
      clearCanvas();
      ctx.globalCompositeOperation = 'lighter';
      const alpha = Math.min(clamp(lt * 4), clamp((1 - lt) * 4));
      for (const p of parts) {
        const y = (p.y - t * 12 * p.sp * speed) % (height + 60);
        const yy = y < -30 ? y + height + 60 : y;
        const x = p.x + Math.sin(t * 0.4 * speed + p.ph) * 55;
        const a = (0.10 + 0.42 * Math.abs(Math.sin(t * 0.9 + p.ph))) * alpha;
        const rr = p.r * 1.5;
        const g = ctx.createRadialGradient(x, yy, 0, x, yy, rr * 6);
        g.addColorStop(0, hexA(p.hue > .8 ? c.accent2 : c.text, a));
        g.addColorStop(1, hexA(c.text, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, yy, rr * 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    stars(t, lt) {
      clearCanvas();
      ctx.globalCompositeOperation = 'lighter';
      const alpha = Math.min(clamp(lt * 3), clamp((1 - lt) * 3));
      for (const p of parts) {
        const tw = 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(t * (0.6 + p.sp) * speed + p.ph)), 2);
        const a = tw * alpha * 0.9;
        const rr = p.r * 0.9;
        ctx.fillStyle = hexA(p.hue > .85 ? c.accent : c.text, a);
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
        if (p.hue > 0.88) {   // বড় তারায় চার-কোণা ঝলক
          ctx.strokeStyle = hexA(c.accent, a * 0.55);
          ctx.lineWidth = 1.1;
          const L = rr * 9 * tw;
          ctx.beginPath();
          ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y);
          ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    rain(t, lt) {
      clearCanvas();
      ctx.globalCompositeOperation = 'lighter';
      const alpha = Math.min(clamp(lt * 4), clamp((1 - lt) * 4));
      ctx.lineCap = 'round';
      for (const p of parts) {
        const y = (p.y + t * 620 * p.sp * speed) % (height + 240) - 120;
        const x = p.x + y * 0.12;
        const len = 26 + p.r * 22;
        const g = ctx.createLinearGradient(x, y - len, x, y);
        g.addColorStop(0, hexA(c.accent2, 0));
        g.addColorStop(1, hexA(c.accent2, 0.42 * alpha * (0.4 + p.sp)));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1 + p.r * 0.35;
        ctx.beginPath(); ctx.moveTo(x, y - len); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    grid(t, lt) {
      clearCanvas();
      const alpha = Math.min(clamp(lt * 3), clamp((1 - lt) * 3));
      const horizon = height * 0.62;
      const step = 90;
      const off = (t * 60 * speed) % step;
      ctx.save();
      ctx.strokeStyle = hexA(c.accent, 0.30 * alpha);
      ctx.lineWidth = 1.6;
      // অনুভূমিক রেখা (perspective)
      for (let i = 0; i < 22; i++) {
        const z = (i * step + off) / (22 * step);
        const y = horizon + Math.pow(z, 1.9) * (height - horizon) * 1.6;
        if (y > height + 10) continue;
        ctx.globalAlpha = clamp((1 - z) * 1.2) * alpha;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      // উল্লম্ব রেখা (vanishing point)
      const vp = width / 2;
      ctx.globalAlpha = alpha;
      for (let i = -14; i <= 14; i++) {
        const x = vp + i * 150;
        ctx.strokeStyle = hexA(c.accent, 0.16 * alpha);
        ctx.beginPath(); ctx.moveTo(vp + i * 22, horizon); ctx.lineTo(x * 2.2 - vp, height + 20); ctx.stroke();
      }
      // সূর্য/গ্লো
      const g = ctx.createRadialGradient(vp, horizon, 0, vp, horizon, 520);
      g.addColorStop(0, hexA(c.accent2, 0.30 * alpha));
      g.addColorStop(1, hexA(c.accent2, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },

    softblobs(t, lt) {
      clearCanvas();
      const alpha = Math.min(clamp(lt * 2.2), clamp((1 - lt) * 2.2));
      ctx.globalCompositeOperation = 'lighter';
      const cols = [c.accent, c.accent2, c.glow, c.chartB || c.accent2];
      for (let i = 0; i < 5; i++) {
        const p = parts[i * 7 % parts.length];
        const cx = width * (0.18 + 0.16 * i) + Math.sin(t * 0.16 * speed + i * 1.7) * 220;
        const cy = height * (0.30 + 0.12 * (i % 3)) + Math.cos(t * 0.13 * speed + i * 2.1) * 180;
        const rr = 340 + 130 * Math.sin(t * 0.22 + i);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, hexA(cols[i % cols.length], 0.30 * alpha));
        g.addColorStop(0.55, hexA(cols[i % cols.length], 0.09 * alpha));
        g.addColorStop(1, hexA(cols[i % cols.length], 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    rays(t, lt) {
      clearCanvas();
      const alpha = Math.min(clamp(lt * 2.5), clamp((1 - lt) * 2.5));
      ctx.globalCompositeOperation = 'lighter';
      const cx = width * 0.5, cy = height * -0.12;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const base = -0.55 + (i / (n - 1)) * 1.1;
        const a = base + Math.sin(t * 0.22 * speed + i) * 0.045;
        const w = 0.028 + 0.02 * Math.abs(Math.sin(t * 0.4 + i * 1.3));
        const len = height * 1.75;
        const g = ctx.createLinearGradient(cx, cy, cx + Math.sin(a) * len, cy + Math.cos(a) * len);
        g.addColorStop(0, hexA(c.accent, 0.30 * alpha));
        g.addColorStop(0.5, hexA(c.accent2, 0.10 * alpha));
        g.addColorStop(1, hexA(c.accent2, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(a - w) * len, cy + Math.cos(a - w) * len);
        ctx.lineTo(cx + Math.sin(a + w) * len, cy + Math.cos(a + w) * len);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    bokeh(t, lt) {
      clearCanvas();
      const alpha = Math.min(clamp(lt * 2.5), clamp((1 - lt) * 2.5));
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < Math.round(16 * density); i++) {
        const p = parts[i * 5 % parts.length];
        const cx = p.x + Math.sin(t * 0.18 * speed + p.ph) * 90;
        const cy = p.y + Math.cos(t * 0.14 * speed + p.ph) * 70;
        const rr = 60 + p.size * 5;
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.5 + p.ph);
        const col = i % 3 === 0 ? c.accent : (i % 3 === 1 ? c.accent2 : c.text);
        const g = ctx.createRadialGradient(cx, cy, rr * 0.55, cx, cy, rr);
        g.addColorStop(0, hexA(col, 0));
        g.addColorStop(0.78, hexA(col, 0.13 * alpha * (0.4 + pulse)));
        g.addColorStop(0.94, hexA(col, 0.20 * alpha * (0.4 + pulse)));
        g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    waves(t, lt) {
      clearCanvas();
      const alpha = Math.min(clamp(lt * 2.5), clamp((1 - lt) * 2.5));
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const yBase = height * (0.62 + k * 0.09);
        const amp = 26 + k * 16;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 12) {
          const y = yBase
            + Math.sin(x * 0.0042 + t * (0.5 + k * 0.22) * speed + k) * amp
            + Math.sin(x * 0.011 - t * 0.35 * speed) * amp * 0.35;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = hexA(k % 2 ? c.accent2 : c.accent, (0.20 - k * 0.035) * alpha);
        ctx.lineWidth = 2.4 - k * 0.4;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    smoke(t, lt) {
      clearCanvas();
      const alpha = Math.min(clamp(lt * 2.5), clamp((1 - lt) * 2.5));
      for (let i = 0; i < Math.round(9 * density); i++) {
        const p = parts[i * 11 % parts.length];
        const life = ((t * 16 * p.sp * speed + i * 90) % 900);
        const y = height * 1.05 - life;
        const x = width * 0.5 + Math.sin(life * 0.006 + i) * (150 + i * 40) + p.drift * 3;
        const rr = 120 + life * 0.42;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
        const a = clamp((1 - life / 900)) * 0.13 * alpha;
        g.addColorStop(0, hexA(c.text, a));
        g.addColorStop(0.6, hexA(c.muted, a * 0.4));
        g.addColorStop(1, hexA(c.muted, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
      }
    },

    confetti(t, lt) {
      clearCanvas();
      const alpha = Math.min(clamp(lt * 4), clamp((1 - lt) * 4));
      const cols = [c.accent, c.accent2, c.chartB, c.chartC, c.chartD, c.text];
      for (let i = 0; i < Math.round(60 * density); i++) {
        const p = parts[i % parts.length];
        const fall = (t * (120 + p.sp * 240) * speed + p.ph * 400) % (height + 200);
        const y = fall - 100;
        const x = p.x + Math.sin(t * 1.6 * speed + p.ph) * 60;
        const rot = p.rot + t * p.rotSp * 2.4 * speed;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = hexA(cols[i % cols.length], 0.85 * alpha);
        ctx.fillRect(-p.size * 0.32, -p.size * 0.14, p.size * 0.64, p.size * 0.28);
        ctx.restore();
      }
    },
  };

  const fn = renderers[effectId] || renderers.none;
  return {
    id: effectId,
    render(time, localT) { fn(time, clamp(localT)); },
    resize(w, h) { canvas.width = w; canvas.height = h; },
  };
}

/* ---------- রঙ হেল্পার ---------- */
/** hex/rgba স্ট্রিং → rgba(...) alpha সহ */
export function hexA(color, alpha = 1) {
  if (!color) return `rgba(255,255,255,${alpha})`;
  const s = String(color).trim();
  if (s.startsWith('rgba') || s.startsWith('rgb')) {
    const nums = s.match(/[\d.]+/g) || [];
    const [r, g, b, a] = nums.map(Number);
    return `rgba(${r | 0},${g | 0},${b | 0},${(a === undefined ? 1 : a) * alpha})`;
  }
  let h = s.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
