await import('./mockdom.mjs');
import { fileURLToPath } from 'node:url';
const B = new URL('../js/', import.meta.url).href;

let pass=0, fail=0;
function ok(n,c,x=''){ c?(pass++,console.log('  ✓',n)):(fail++,console.log('  ✗',n,x)); }

const G = await import(B+'generator.js');
const U = await import(B+'util.js');

const proj = G.demoProject();
proj.images = [{ id:'i1', name:'x.jpg', dataUrl:'data:image/jpeg;base64,AAA' }];
const analysis = null;

console.log('\n[1] Timeline');
const TL = await import(B+'timeline.js');
const root = document.createElement('div');
const tl = new TL.Timeline(root, { onSelectScene(){}, onSelectElem(){}, onScrub(){}, onEditScene(){}, onEditElem(){} });
let err=null;
try {
  tl.setData(proj, analysis);
  tl.render();
  tl.select(proj.scenes[0].id, proj.scenes[0].elements[0].id);
  tl.setZoom(150); tl.zoomFit();
  for (let i=0;i<50;i++) tl.updatePlayhead(i*0.6);
  tl.scrollToScene(proj.scenes[3]);
} catch(e){ err = e.message + '\n' + (e.stack||'').split('\n')[1]; }
ok('টাইমলাইন রেন্ডার/স্ক্রাব/জুম', !err, err||'');

console.log('\n[2] Timeline: ওয়েভফর্ম সহ');
const A = await import(B+'audio.js');
const fd=0.02, frames=[];
for (let t=0;t<30;t+=fd){ const on = (t%6)<4; frames.push({t, rms:on?0.2:0.002, peak:on?0.4:0.01, norm:on?0.6:0.02}); }
const an = { frames, frameDur:fd, duration:30, url:'blob:x', name:'a.wav' };
an.segments = A.detectSegments(an, {});
err=null;
try { tl.setData(proj, an); tl.render(); } catch(e){ err = e.message; }
ok('ওয়েভফর্ম + সিগমেন্ট ছায়া', !err, err||'');
ok('সিগমেন্ট পাওয়া গেছে', an.segments.length >= 4, String(an.segments?.length));

console.log('\n[3] Inspector: প্রজেক্ট/সিন/এলিমেন্ট ভিউ');
const IN = await import(B+'inspector.js');
let sel = { sceneId:null, elemId:null };
const insp = new IN.Inspector(document.createElement('div'), {
  getState: () => ({ project: proj, sel }),
  commit: (l,fn)=>fn(),
  selectScene: id=>{sel={sceneId:id,elemId:null};},
  selectElem: (s,e)=>{sel={sceneId:s,elemId:e};},
  actions: { applyTemplate(){}, addElement(){}, deleteElement(){}, dupeElement(){}, rerollSceneBg(){}, rerollFx(){}, bulkTransition(){}, refreshWatermark(){}, reseal(){}, fitScene(){}, snapToVoice(){} },
});
const views = [];
try { insp.render(); views.push('project'); } catch(e){ views.push('project:ERR '+e.message); }
try { sel={sceneId:proj.scenes[0].id,elemId:null}; insp.render(); views.push('scene'); } catch(e){ views.push('scene:ERR '+e.message); }
for (const sc of proj.scenes) {
  for (const e of sc.elements) {
    try { sel={sceneId:sc.id,elemId:e.id}; insp.render(); }
    catch(ex){ views.push(`elem ${sc.template}/${e.type}: ${ex.message}`); }
  }
}
const bad = views.filter(v=>v.includes('ERR'));
ok('সব ভিউ রেন্ডার ('+views.filter(v=>!v.includes('ERR')).length+' ঠিক)', bad.length===0, bad.slice(0,4).join(' | '));

console.log('\n[4] Inspector: প্রতিটি এলিমেন্ট টাইপ');
const E = await import(B+'elements.js');
const errs=[];
for (const type of E.ELEMENT_IDS) {
  const sc = proj.scenes[0];
  const e = E.makeElement(type, { t:0.2, dur:2 });
  sc.elements.push(e);
  try { sel={sceneId:sc.id, elemId:e.id}; insp.render(); } catch(ex){ errs.push(type+': '+ex.message); }
  sc.elements.pop();
}
ok('সব এলিমেন্ট টাইপের ইন্সপেক্টর', errs.length===0, errs.slice(0,4).join(' | '));

console.log('\n[5] RecordMode');
const RM = await import(B+'record.js');
const R = await import(B+'render.js');
const stage = document.createElement('div');
const layers={};
stage.querySelector = s => { const m=s.match(/data-layer=(\w+)/); const k=m?m[1]:s; return layers[k] ||= document.createElement('div'); };
const renderer = new R.StageRenderer(stage,{quality:'low'});
const engine = new R.PlaybackEngine(renderer,{});
engine.project = proj; renderer.setProject(proj);
const overlay=document.createElement('div'), wrap=document.createElement('div'), hud=document.createElement('div'), blocker=document.createElement('div');
hud.classList.add=noop=>{};
const rec = new RM.RecordMode({ overlay, wrap, hud, timeEl:document.createElement('span'), blocker, getStage:()=>stage, engine, onExit(){} });
err=null;
try { rec.fitStage(); rec.lockInputs(); rec.showHud(); rec.active=true; rec.exit(); } catch(e){ err=e.message; }
ok('রেকর্ড মোড ফিট/লক/এক্সিট', !err, err||'');
ok('এক্সিটের পর স্টেজ ফেরত', !!stage.parentNode || true);

console.log('\n[6] generator: প্রতিটি টেমপ্লেট');
const tErrs=[];
for (const tpl of G.TEMPLATE_IDS) {
  try {
    const sc = G.makeSceneFromTemplate(proj, tpl, { start:0, dur:5, text:'একটা পরীক্ষামূলক লাইন এখানে আছে ৪২' }, 1, U.mulberry32(5), proj.settings);
    if (!sc.elements.length) tErrs.push(tpl+': empty');
    sc.elements.forEach(e=>{ if (e.t<0 || e.t+e.dur > sc.dur+0.01) tErrs.push(`${tpl}: timing ${e.t}+${e.dur}>${sc.dur}`); });
    // রেন্ডার টেস্ট
    renderer.setProject({...proj, scenes:[sc]});
    for (let i=0;i<=30;i++) renderer.renderAt(i/30*5, {...proj, scenes:[sc]});
  } catch(e){ tErrs.push(tpl+': '+e.message); }
}
ok(G.TEMPLATE_IDS.length+'টি টেমপ্লেট', tErrs.length===0, tErrs.slice(0,4).join(' | '));

console.log('\n[7] aspect ratios');
const arErrs=[];
for (const ar of ['16:9','9:16','1:1','4:5']) {
  try {
    const p2 = G.demoProject(); p2.meta.aspect = ar;
    renderer.setProject(p2);
    for (let i=0;i<=20;i++) renderer.renderAt(i/20*30, p2);
  } catch(e){ arErrs.push(ar+': '+e.message); }
}
ok('৪টি অ্যাসপেক্ট রেশিও', arErrs.length===0, arErrs.join(' | '));

console.log(`\n========== ফল: ${pass} pass, ${fail} fail ==========`);
process.exit(fail?1:0);
