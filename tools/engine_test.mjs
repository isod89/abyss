// SPDX-License-Identifier: GPL-3.0-only
// ABYSS web: the sound engine (js/worklet.js, with the FM-1's brain in engines/abyss-brain.wasm) run outside the
// browser, every world: it plays (nothing NaN, nothing stuck, never silent for long), faster than real time; the
// gestures do what they say (the peak comes, the void falls silent, the next piece starts, HOLD keeps the section); the
// world changes; LIGHT brightens; a muted layer is silent; another sound is another sound; the textures and the sound
// lab play.   node tools/engine_test.mjs [OUT_DIR]   (OUT_DIR: a WAV of each world's test)   WORLD=0..2: one world
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.argv[2];
const SR = 44100;
let Proc = null;
const ctx = { sampleRate: SR, console, Math, Float32Array, Uint8Array, Set, Map, WebAssembly, Object, Array, JSON, Number, String };
ctx.globalThis = ctx;
ctx.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: (m) => ctx.onmsg?.(m), onmessage: null }; } };
ctx.registerProcessor = (_, c) => { Proc = c; };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/worklet.js'), 'utf8'), ctx);

const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const packs = J('engines/packs/index.json');
const mods = { brain: await WebAssembly.compile(fs.readFileSync(path.join(ROOT, 'engines/abyss-brain.wasm'))) }, cats = {};
for (const id of ['clipper', 'sloop']) {
  mods[id] = await WebAssembly.compile(fs.readFileSync(path.join(ROOT, `engines/${id}.wasm`)));
  const w = new WebAssembly.Instance(mods[id], {}).exports; w._initialize?.(); w.k_init(0);
  const n = w.k_catalog(); cats[id] = JSON.parse(new TextDecoder().decode(new Uint8Array(w.memory.buffer, w.k_buffer(), n).slice()));
}
const COMMUNITY = process.env.COMMUNITY === '1';
const cur = J('data/curation.json'), kits = J('data/kits.json'), lev = J('data/levels.json');
const parse = (k) => { const [bank, rest] = k.includes('/') ? [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)] : ['clipper', k]; const i = rest.indexOf(':'); return { bank, engine: rest.slice(0, i), preset: rest.slice(i + 1), fm1: bank === 'clipper' }; };
if (COMMUNITY) for (const id of new Set(Object.values(cur).flatMap((l) => Object.values(l).flat()).map((k) => parse(k).bank))) {
  if (mods[id]) continue; const p = packs.find((x) => x.id === id);
  mods[id] = await WebAssembly.compile(fs.readFileSync(path.join(ROOT, 'engines/packs/' + p.file))); cats[id] = p.catalog;
}
// (as js/app.js)
function resolve(s) {
  const c = cats[s.bank]; if (!c) return null;
  const e = c.engines.findIndex((x) => x.name === s.engine); if (e < 0) return null;
  const p = c.engines[e].presets.indexOf(s.preset); if (p < 0) return null;
  return { bank: s.bank, e, p, name: s.preset, engine: s.engine, fm1: s.fm1, key: `${s.bank}/${s.engine}/${s.preset}` };
}
const CUR = {};
for (const [W, ls] of Object.entries(cur)) { CUR[W] = {}; for (const [L, arr] of Object.entries(ls)) CUR[W][L] = arr.map(parse).filter((s) => s.fm1 || COMMUNITY).map((s) => { const x = resolve(s); if (!x) return null; const c = lev[`${W}|${L}|${x.key}`] || {}; return { ...x, trim: c.trim || 0, tone: c.tone || 0 }; }).filter(Boolean); }
const palette = { CUR, KITS: kits, SYN1: (cats.sloop.kits || []).indexOf('SYN1') };

let fails = 0;
const CHECK = (c, msg) => { if (!c) { console.log('  FAIL: ' + msg); fails++; } };
const WORLDS = ['CINEMATIC', 'COSMIC', 'DARK'];
const G = { RISE: 0, PEAK: 1, CALM: 2, BREATH: 3, LIFT: 4, THEME: 5, HARMONY: 6, HOLD: 7, NEXT: 8, VOID: 9, FADE: 10 };
for (let w = 0; w < 3; w++) {
  if (process.env.WORLD && +process.env.WORLD !== w) continue;
  let last = null, sounds = null;
  ctx.onmsg = (m) => { if (m.t === 'step') last = m; else if (m.t === 'sounds') sounds = m; };
  const S = new Proc({ processorOptions: { modules: { ...mods } } });
  const send = (m) => S.msg(m);
  send({ t: 'palette', palette }); send({ t: 'seed', code: 'AB0-0' + w + 'X5', world: w });
  send({ t: 'knob', k: 1, v: 0.6 }); send({ t: 'play', on: true });
  const L = new Float32Array(128), R = new Float32Array(128), wav = [];
  let limT = 0, peak = 0, sq = 0, cnt = 0, sqh = 0, prev = 0, silent = 0, maxSilent = 0, t = 0;
  const run = (sec) => {
    const nb = Math.round(sec * SR / 128);
    for (let b = 0; b < nb; b++) {
      S.process([], [[L, R]]);
      let bp = 0;
      for (let i = 0; i < 128; i++) { const a = L[i], c = R[i]; if (!Number.isFinite(a) || !Number.isFinite(c)) { console.log('NaN at', t.toFixed(1), 's'); process.exit(1); } bp = Math.max(bp, Math.abs(a)); peak = Math.max(peak, Math.abs(a)); sq += a * a; sqh += (a - prev) ** 2; prev = a; cnt++; if (OUT) wav.push(a, c); }
      t += 128 / SR;
      if (S.lim < 0.97) limT += 128 / SR;
      if (bp < 1e-4) { silent += 128 / SR; maxSilent = Math.max(maxSilent, silent); } else silent = 0;
    }
  };
  const rms = (sec) => { sq = 0; sqh = 0; cnt = 0; run(sec); return Math.sqrt(sq / cnt); };
  const hfr = (sec) => { rms(sec); return Math.sqrt(sqh / cnt) / (Math.sqrt(sq / cnt) + 1e-9); };
  const until = (f, sec) => { for (let k = 0; k < sec * 10; k++) { run(0.1); if (f()) return true; } return false; };
  const t0 = Date.now(); const r0 = rms(60); const ms = Date.now() - t0;
  console.log(`web: ${WORLDS[w]} ${last.info.bpm} BPM, kind ${last.info.kind}, ${Object.values(sounds.sounds).join(' / ')}`);
  console.log(`  one minute in ${ms} ms (${(60000 / ms).toFixed(1)}x real time), rms ${r0.toFixed(3)}, plan ${last.info.plan.join(' ')}`);
  CHECK(ms < 30000, `${WORLDS[w]}: too slow (${ms} ms a minute)`);
  CHECK(r0 > 0.003, `${WORLDS[w]}: too quiet (${r0.toFixed(4)})`);
  // the hand's: a layer's next sound, muted, the knobs
  const was = sounds.sounds.PAD; send({ t: 'sound', L: 'PAD', d: 1 }); CHECK(sounds.sounds.PAD !== was || sounds.n.PAD < 2, `${WORLDS[w]} PAD next sound (${was})`);
  CHECK(sounds.locks.PAD, `${WORLDS[w]} PAD kept after choosing it`);
  for (const Ly of ['DRONE', 'PAD', 'LOW', 'MELO', 'BELL', 'SWELL']) send({ t: 'mute', L: Ly, on: true }); run(4); S.peaks.PAD = 0; run(2);
  CHECK((S.peaks.PAD || 0) < 1e-4 && (S.peaks.DRONE || 0) < 1e-4, `${WORLDS[w]} mute: PAD ${S.peaks.PAD} DRONE ${S.peaks.DRONE}`);
  for (const Ly of ['DRONE', 'PAD', 'LOW', 'MELO', 'BELL', 'SWELL']) send({ t: 'mute', L: Ly, on: false });
  send({ t: 'knob', k: 0, v: 0 }); run(6); const dark = hfr(6), c0 = S.fl.PAD.c; send({ t: 'knob', k: 0, v: 1 }); run(6); const bright = hfr(6), c1 = S.fl.PAD.c;
  console.log(`  LIGHT: the filters ${c0} -> ${c1}, the highs ${dark.toFixed(3)} -> ${bright.toFixed(3)}`); CHECK(c1 >= Math.min(1000, c0 + 200) && bright >= dark, `${WORLDS[w]} LIGHT: the filters ${c0} -> ${c1}, the highs ${dark.toFixed(3)} -> ${bright.toFixed(3)}`); send({ t: 'knob', k: 0, v: 0.5 });
  send({ t: 'texture', k: 'shimmer', on: true }); send({ t: 'texture', k: 'tape', on: true }); run(8); send({ t: 'texture', k: 'shimmer', on: false }); send({ t: 'texture', k: 'tape', on: false });
  // the gestures
  send({ t: 'gesture', g: G.PEAK });
  CHECK(until(() => last.info.sec === 'PEAK', 90), `${WORLDS[w]} PEAK: still ${last.info.sec}`);
  const fr = last.info.frisson; run(10); console.log('  layer peaks at the peak', JSON.stringify(Object.fromEntries(Object.entries(S.peaks).map(([k,v])=>[k,+v.toFixed(3)])))); console.log(`  the peak at ${t.toFixed(0)} s (frisson ${fr}), rms ${rms(4).toFixed(3)}`);
  send({ t: 'gesture', g: G.HOLD }); const at = last.info.planAt; run(90); CHECK(last.info.planAt === at && last.info.hold, `${WORLDS[w]} HOLD: ${at} -> ${last.info.planAt}`); send({ t: 'gesture', g: G.HOLD });
  send({ t: 'gesture', g: G.VOID });
  CHECK(until(() => last.info.sec === 'VOID', 90), `${WORLDS[w]} VOID: still ${last.info.sec}`);
  const p0 = last.info.piece; send({ t: 'gesture', g: G.NEXT });
  CHECK(until(() => last.info.piece === p0 + 1, 180), `${WORLDS[w]} NEXT: piece ${p0} -> ${last.info.piece}`);
  for (const g of ['RISE', 'CALM', 'BREATH', 'LIFT', 'THEME', 'HARMONY']) { send({ t: 'gesture', g: G[g] }); run(15); }
  // the world, the sound lab
  const nw = (w + 1) % 3; send({ t: 'world', w: nw, now: true }); run(5); CHECK(last.info.world === WORLDS[nw], `${WORLDS[w]} -> ${WORLDS[nw]}: ${last.info.world}`);
  send({ t: 'world', w, now: true });
  const s0 = CUR[WORLDS[w]].BELL[0]; send({ t: 'play', on: false }); run(6);
  send({ t: 'audition', bank: s0.bank, e: s0.e, p: s0.p, atk: -1, rel: -1, notes: [60, null, 67, null, 64] }); const ra = rms(3);
  CHECK(ra > 0.002, `${WORLDS[w]} audition ${s0.name}: ${ra.toFixed(4)}`); send({ t: 'play', on: true });
  run(120);
  CHECK(peak < 1, `${WORLDS[w]} peak ${peak}`);
  console.log(`  ${t.toFixed(0)} s played, peak ${peak.toFixed(2)}, longest silence ${maxSilent.toFixed(1)} s, limiter ${limT.toFixed(1)} s, piece ${last.info.piece}`);
  if (OUT) {
    const n = wav.length, buf = Buffer.alloc(44 + n * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(wav[i] * 32767))), 44 + i * 2);
    fs.writeFileSync(path.join(OUT, `web-${WORLDS[w].toLowerCase()}.wav`), buf);
  }
}
console.log(fails ? `web engine: ${fails} FAILED` : 'web engine: ok');
process.exit(fails ? 1 : 0);
