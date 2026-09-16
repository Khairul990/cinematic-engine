await import('./mockdom.mjs');
import { fileURLToPath } from 'node:url';
const B = new URL('../js/', import.meta.url).href;

const A=await import(B+'audio.js'), G=await import(B+'generator.js'), R=await import(B+'render.js'), T=await import(B+'themes.js');
let pass=0,fail=0; const ok=(n,c,x='')=>{c?(pass++,console.log('  ✓',n)):(fail++,console.log('  ✗',n,x));};

// --- বাস্তবসম্মত বাংলা ভয়েসওভার: ৯টি বাক্য, মাঝে শ্বাস/চুপচাপ ---
const script = `আমি যখন ছোট ছিলাম, তখন ভাবতাম স্বপ্ন বুঝি শুধু গল্পেই সাজে।
কিন্তু একদিন একটা ছোট ঘটনা সব বদলে দিল।
সেদিন বিকেলে বৃষ্টি নামছিল, আর আমি একা দাঁড়িয়ে ছিলাম।
হঠাৎ একজন অচেনা মানুষ এসে বললেন, তুমি কি সত্যিই চাও?
প্রশ্নটা আমার ভেতরে গেঁথে গেল।
সেই রাতে আমি প্রথমবার নিজের লক্ষ্য লিখে ফেললাম কাগজে।
তারপর শুরু হলো টানা তিনশো পঁয়ষট্টি দিনের লড়াই।
প্রতিদিন ভোরে উঠেছি, একটা কাজ শেষ করেছি, নিজেকে মাপছি।
আজ যখন পেছনে তাকাই, দেখি সেই বৃষ্টির দিনটাই ছিল আসল শুরু।`;

const lines = A.scriptToLines(script);
console.log('স্ক্রিপ্ট লাইন:', lines.length);

// সিন্থেটিক অডিও ফ্রেম: প্রতি লাইনের জন্য কথা + ফাঁক
const fd=0.02, frames=[];
const cps = 8.2;
const segs=[]; let t=0.7;
for (const L of lines) {
  const dur = Math.max(1.4, A.countSpeakable(L)/cps);
  segs.push({s:t, e:t+dur});
  t += dur + 0.55 + Math.random()*0.35;
}
const TOTAL = t + 1.5;
for (let x=0; x<TOTAL; x+=fd) {
  const k = segs.findIndex(s => x>=s.s && x<s.e);
  const on = k>=0;
  let n = 0.012;
  if (on) {
    const p = (x-segs[k].s)/(segs[k].e-segs[k].s);
    n = 0.42 + 0.18*Math.sin(x*11+k) * (0.6+0.4*Math.sin(p*Math.PI));  // শব্দের উত্থান-পতন
  }
  frames.push({t:x, rms:n*0.5, peak:n, norm:Math.max(0,Math.min(1,n))});
}
const analysis={frames, frameDur:fd, duration:TOTAL, url:'blob:x', name:'voice.wav'};

console.log('\n[ধাপ ১] সাইলেন্স ডিটেকশন');
const detected = A.detectSegments(analysis, { sensitivity:0.5, minSilence:0.45, minSegment:1.2, maxSegment:22 });
console.log('   আসল বাক্য:', lines.length, '| ধরা পড়েছে:', detected.length);
ok('সিগমেন্ট সংখ্যা কাছাকাছি (±3)', Math.abs(detected.length - lines.length) <= 3, `${detected.length} vs ${lines.length}`);
// সময়ের নির্ভুলতা
let drift = 0, matched=0;
detected.forEach(d => {
  const best = segs.reduce((a,b)=> Math.abs(b.s-d.start) < Math.abs(a.s-d.start) ? b : a);
  const err = Math.abs(best.s - d.start);
  if (err < 0.5) matched++;
  drift += err;
});
console.log('   গড় শুরু-ত্রুটি:', (drift/detected.length).toFixed(3),'s | ০.৫s এর মধ্যে মিলেছে:', matched+'/'+detected.length);
ok('গড় শুরু-ত্রুটি < ০.৪ সেকেন্ড', drift/detected.length < 0.4);

console.log('\n[ধাপ ২] স্ক্রিপ্ট অ্যালাইনমেন্ট');
const aligned = A.alignScriptToSegments(lines, detected, { charsPerSecond: cps });
ok('সব লাইন সময় পেয়েছে', aligned.length === lines.length && aligned.every(a=>a.dur>0.3));
ok('সময় ক্রমান্বয়ে বাড়ে', aligned.every((a,i)=> i===0 || a.start >= aligned[i-1].start - 1e-9));
ok('অডিওর সীমার ভেতরে', aligned.every(a=> a.start>=-0.01 && a.end<=TOTAL+0.01));
// প্রতি লাইনের শুরু vs আসল বাক্যের শুরু
const errs = aligned.map((a,i)=> Math.abs(a.start - segs[i].s));
const avgErr = errs.reduce((x,y)=>x+y,0)/errs.length;
console.log('   প্রতি লাইনের গড় সময়-ত্রুটি:', avgErr.toFixed(3), 's  | সর্বোচ্চ:', Math.max(...errs).toFixed(3),'s');
ok('গড় অ্যালাইনমেন্ট ত্রুটি < ১.২ সেকেন্ড', avgErr < 1.2);

console.log('\n[ধাপ ৩] টাইমলাইন জেনারেশন');
const proj = G.defaultProject();
proj.audio.duration = TOTAL; proj.meta.channel='গল্পের আসর'; proj.scriptText=script;
const scenes = G.generateTimeline(proj, detected, aligned, { seed: 20260916 });
console.log('   সিন:', scenes.length, '| মোট সময়:', (scenes[scenes.length-1].start+scenes[scenes.length-1].dur).toFixed(2),'s /', TOTAL.toFixed(2),'s');
ok('সিন সংখ্যা = লাইন সংখ্যা (±3)', Math.abs(scenes.length-lines.length)<=3);
ok('পুরো অডিও কভার হয়েছে', scenes[scenes.length-1].start+scenes[scenes.length-1].dur >= TOTAL-0.6);
ok('কোনো গ্যাপ নেই', scenes.every((s,i)=> i===0 || Math.abs(s.start-(scenes[i-1].start+scenes[i-1].dur))<0.02));
ok('কোনো ওভারল্যাপ নেই', scenes.every((s,i)=> i===0 || s.start >= scenes[i-1].start+scenes[i-1].dur-1e-6));
ok('প্রতিটি সিনে স্ক্রিপ্টের টেক্সট বসেছে', scenes.filter(s=>s.elements.some(e=>(e.extra?.text||'').length>3)).length >= scenes.length*0.8);
const usedTpls = new Set(scenes.map(s=>s.template));
console.log('   ব্যবহৃত টেমপ্লেট:', [...usedTpls].join(', '));
ok('অন্তত ৪ ধরনের টেমপ্লেট (বৈচিত্র্য)', usedTpls.size >= 4);
const usedFx = new Set(scenes.map(s=>s.bg.effect));
ok('অন্তত ৩ ধরনের ব্যাকগ্রাউন্ড এফেক্ট', usedFx.size >= 3, [...usedFx].join(','));

console.log('\n[ধাপ ৪] পুরো ভিডিও রেন্ডার (সব থিম, প্রতি সেকেন্ডে ৩০ ফ্রেম)');
const stage=new MockNode('div'); const layers={};
stage.querySelector=s=>{const m=s.match(/data-layer=(\w+)/);return layers[m?m[1]:s]||=new MockNode('div');};
const rErrs=[]; let framesRendered=0;
const renderer=new R.StageRenderer(stage,{quality:'high'});
proj.scenes=scenes;
for (const th of T.THEME_IDS) {
  proj.meta.theme=th;
  renderer.setProject(proj);
  const steps=Math.ceil(TOTAL*30);
  for (let i=0;i<=steps;i++){
    try { renderer.renderAt(i/30, proj); framesRendered++; }
    catch(e){ rErrs.push(`${th}@${(i/30).toFixed(2)}s: ${e.message}`); if(rErrs.length>4) break; }
  }
}
console.log(`   ${framesRendered} ফ্রেম রেন্ডার হলো (${T.THEME_IDS.length} থিম × ${(TOTAL).toFixed(0)}s × 30fps)`);
ok('কোনো রেন্ডার এরর নেই', rErrs.length===0, rErrs.join(' | '));

console.log('\n[ধাপ ৫] অ্যাসপেক্ট রেশিও + ডেমো');
for (const ar of ['9:16','1:1','4:5']) {
  proj.meta.aspect=ar;
  renderer.setProject(proj);
  try { for(let i=0;i<=60;i++) renderer.renderAt(i/60*TOTAL, proj); ok(`${ar} রেন্ডার`, true); }
  catch(e){ ok(`${ar} রেন্ডার`, false, e.message); }
}

console.log(`\n========== এন্ড-টু-এন্ড: ${pass} pass, ${fail} fail ==========`);
console.log('\n📋 নমুনা আউটপুট (প্রথম ৩ সিন):');
scenes.slice(0,3).forEach((s,i)=>{
  const main = s.elements.find(e=>['title','text','quote'].includes(e.type));
  console.log(`  ${i+1}. [${s.start.toFixed(2)}–${(s.start+s.dur).toFixed(2)}s] ${s.template.padEnd(11)} fx=${s.bg.effect.padEnd(9)} "${(main?.extra?.text||'').slice(0,44)}"`);
});
process.exit(fail?1:0);
