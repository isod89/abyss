// SPDX-License-Identifier: GPL-3.0-only
// ABYSS web: each curated sound's calibration in its world and layer, as the web player plays it (data/levels.json).
// Each sound on its own engine instance (the same WebAssembly as the player: Clipper's, the community's packs), with the
// world's envelopes (abyss.c ABYSS_ENV, as js/worklet.js), played as its layer plays it: the brain's own notes for that
// world and layer (engines/abyss-brain.wasm, a few pieces; their velocities, registers and lengths, the long silences
// between them shortened, six windows of it from the dawn to the peak and the end), at its layer's place in the mix. Its loudness as the ear weighs it (the energy, its highs over ~2.8 kHz counted four times), while it plays. Too bright for its layer: a low-pass (the "tone", Hz) closed step by step; then
// the trim (dB) that brings it to its layer's median (the bells 3 dB under, the swell on top).
//   node tools/level_web.mjs [check]
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FS = 44100, BLOCK = 32, SECS = 14;
const WORLDS = ['CINEMATIC', 'COSMIC', 'DARK'], LAYERS = ['DRONE', 'PAD', 'LOW', 'MELO', 'BELL', 'SWELL'];
const MIX = { DRONE: 0.5, PAD: 0.5, LOW: 0.62, MELO: 0.5, BELL: 0.38, SWELL: 0.5 };
const ENV = [[[105, 119], [98, 117], [83, 110], [69, 108], [-1, 110], [108, 119]],
  [[114, 123], [110, 123], [-1, -1], [95, 114], [-1, 114], [114, 123]],
  [[119, 127], [114, 127], [117, 127], [110, 123], [-1, 123], [110, 123]]];
const HFMAX = { DRONE: 1.5, PAD: 2, LOW: 1, MELO: 3, BELL: 5, SWELL: 2.5 };
const OFFSET = { DRONE: 0, PAD: 0, LOW: 0, MELO: 0, BELL: -3, SWELL: 1 };
const TONES = [0, 9000, 7000, 5500, 4500, 3600, 2800, 2200];
const check = process.argv[2] === 'check';
const packs = JSON.parse(fs.readFileSync(path.join(ROOT, 'engines/packs/index.json'), 'utf8'));
const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/curation.json'), 'utf8'));
const old = check ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data/levels.json'), 'utf8')) : {};
const banks = {};
async function bank(id) {
  if (banks[id]) return banks[id];
  const file = id === 'clipper' ? 'engines/clipper.wasm' : 'engines/packs/' + packs.find((p) => p.id === id).file;
  const mod = await WebAssembly.compile(fs.readFileSync(path.join(ROOT, file)));
  const inst = () => { const w = new WebAssembly.Instance(mod, {}).exports; w._initialize?.(); w.k_init(0); return w; };
  let cat = id === 'clipper' ? null : packs.find((p) => p.id === id).catalog;
  if (!cat) { const w = inst(), n = w.k_catalog(); cat = JSON.parse(new TextDecoder().decode(new Uint8Array(w.memory.buffer, w.k_buffer(), n).slice())); }
  return (banks[id] = { inst, cat });
}
function lp(fc) {
  if (!fc) return null;
  const g = Math.tan(Math.PI * Math.min(fc, FS * 0.45) / FS), k = 1.3, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2, s = [0, 0];
  return (x) => { const v3 = x - s[1], v1 = a1 * s[0] + a2 * v3, v2 = s[1] + a2 * s[0] + a3 * v3; s[0] = 2 * v1 - s[0]; s[1] = 2 * v2 - s[1]; return v2; };
}
// the layer's playing: the brain's notes, [time (s), note, velocity, length (s)], six windows of 10 s across each layer's playing
const brain = new WebAssembly.Instance(await WebAssembly.compile(fs.readFileSync(path.join(ROOT, 'engines/abyss-brain.wasm'))), {}).exports;
const PLAY = {};
for (let w = 0; w < 3; w++) {
  PLAY[w] = {};
  for (let L = 0; L < 8; L++) brain.w_pal(w, L, 4);
  brain.w_init();
  for (const seed of [0x1234567, 0x7654321, 0x0ABCDEF]) {
    brain.w_seed(seed, w); const p0 = brain.w_b(2), last = {};
    for (let st = 0; st < 16 * 2000 && brain.w_b(2) < p0 + 1; st++) {
      brain.w_step(); const spb = 60 / (brain.w_ev(18) || 64) / 4;
      for (let i = 0, n = brain.w_n(); i < n; i++) {
        const x = brain.w_note(i), Li = x >> 16; if (Li < 1 || Li > 6) continue;
        const Ln = LAYERS[Li - 1], A = (PLAY[w][Ln] ||= []), tl = last[Ln] ?? 0, now = st * spb;
        const t = A.length ? A.at(-1)[0] + Math.min(now - tl, 3) : 0.5;                // (a silence of over 3 s: 3 s)
        A.push([t, (x >> 8) & 255, x & 255, Math.min(brain.w_len(i) * spb, 20)]); last[Ln] = now;
      }
    }
  }
  // six windows of 10 s spread over the whole of it (the dawn to the peak and the end: every velocity it plays)
  for (const [Ln, A] of Object.entries(PLAY[w])) {
    const T = A.at(-1)[0], out = [];
    for (let k = 0; k < 6; k++) { const a = T * k / 6; for (const x of A) if (x[0] >= a && x[0] < a + 10) out.push([x[0] - a + k * 10 + 0.5, x[1], x[2], x[3]]); }
    PLAY[w][Ln] = T <= 60 ? A : out;
  }
}
function meas(B, e, p, w, L, tone, gain) {
  const x = B.inst(); x.k_preset(e, p);
  const [a, r] = ENV[w][LAYERS.indexOf(L)]; if (a >= 0) x.k_param(1, a); if (r >= 0) x.k_param(4, r);
  x.k_render(); x.k_render();
  const ev = [];
  for (const [t, n, v, len] of PLAY[w][L] || []) { ev.push([Math.floor(t * FS / BLOCK), n, v]); ev.push([Math.floor((t + len) * FS / BLOCK), n, 0]); }
  ev.sort((A, B2) => A[0] - B2[0] || A[2] - B2[2]);
  const end = ev.length ? ev.at(-1)[0] + Math.floor(2 * FS / BLOCK) : 0, f = lp(tone);
  let e2 = 0, h2 = 0, lpz = 0, cnt = 0, k = 0;
  for (let b = 0; b < end; b++) {
    while (k < ev.length && ev[k][0] <= b) { const [, n, v] = ev[k++]; x.k_note(n, v, v ? 1 : 0); }
    const buf = new Float32Array(x.memory.buffer, x.k_render(), BLOCK * 2);
    if (b * BLOCK > 1.5 * FS) for (let i = 0; i < BLOCK; i++) {
      let y = (buf[2 * i] + buf[2 * i + 1]) * 0.5 * MIX[L] * gain;
      if (f) y = f(y);
      lpz += (y - lpz) * 26 / 64; const hh = y - lpz;
      e2 += y * y; h2 += hh * hh; cnt++;
    }
  }
  return { db: 10 * Math.log10((e2 + 3 * h2) / (cnt || 1) + 1e-12), hf: h2 / (e2 + 1e-12) * 100 };
}
for (let w = 0; w < 3; w++) console.error(WORLDS[w], Object.entries(PLAY[w]).map(([L, A]) => `${L} ${A.length} notes ${A.length ? A.at(-1)[0].toFixed(0) : 0} s`).join(', '));
const parse = (k) => { const [b, rest] = k.includes('/') ? [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)] : ['clipper', k]; const i = rest.indexOf(':'); return { bank: b, engine: rest.slice(0, i), preset: rest.slice(i + 1) }; };
const res = {};
for (const [wn, ls] of Object.entries(cur)) {
  const w = WORLDS.indexOf(wn);
  for (const [L, arr] of Object.entries(ls)) for (const k of arr) {
    const s = parse(k), B = await bank(s.bank);
    const e = B.cat.engines.findIndex((x) => x.name === s.engine), p = e < 0 ? -1 : B.cat.engines[e].presets.indexOf(s.preset);
    if (p < 0) { console.error('missing', k); continue; }
    const key = `${wn}|${L}|${s.bank}/${s.engine}/${s.preset}`;
    if (check) { const c = old[key] || { trim: 0, tone: 0 }; res[key] = { ...meas(B, e, p, w, L, c.tone, Math.pow(10, c.trim / 20)), L }; continue; }
    let tone = 0, m = meas(B, e, p, w, L, 0, 1); const raw = m;
    for (let t = 1; t < TONES.length && m.hf > HFMAX[L]; t++) { tone = TONES[t]; m = meas(B, e, p, w, L, tone, 1); }
    res[key] = { L, db: m.db, raw: raw.db, hf: raw.hf, tone };
  }
  process.stderr.write(`${wn} measured\n`);
}
const by = {};
for (const r of Object.values(res)) if (r.db > -80) (by[r.L] ||= []).push(r.db);
const med = Object.fromEntries(Object.entries(by).map(([L, a]) => { a = [...a].sort((x, y) => x - y); return [L, a[Math.floor(a.length / 2)]]; }));
if (check) {
  let bad = 0;
  for (const [L, a] of Object.entries(by)) {
    const mean = a.reduce((s, x) => s + x, 0) / a.length, sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length);
    console.log(`${L.padEnd(5)} ${String(a.length).padStart(3)} sounds  mean ${mean.toFixed(1)} dB  spread ${sd.toFixed(1)} dB  (${Math.min(...a).toFixed(1)} .. ${Math.max(...a).toFixed(1)})`);
    for (const [k, r] of Object.entries(res)) if (r.L === L && Math.abs(r.db - mean) > 3) { bad++; console.log('  off:', k, r.db.toFixed(1)); }
  }
  console.log(bad ? `levels: ${bad} sounds over 3 dB from their layer` : 'levels: ok');
  process.exit(bad ? 1 : 0);
}
const out = {};
for (const [key, r] of Object.entries(res).sort()) {
  const trim = Math.max(-14, Math.min(12, med[r.L] + OFFSET[r.L] - r.db));
  out[key] = { trim: Math.round(trim * 10) / 10, tone: r.tone, db: Math.round(r.raw * 10) / 10, hf: Math.round(r.hf * 10) / 10 };
}
fs.writeFileSync(path.join(ROOT, 'data/levels.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`levels: ${Object.keys(out).length} sounds -> data/levels.json; medians`, Object.fromEntries(Object.entries(med).map(([L, v]) => [L, v.toFixed(1)])));
const clamp = Object.entries(out).filter(([, v]) => v.trim <= -14 || v.trim >= 12).map(([k, v]) => `${k} ${v.trim} (${v.db})`);
if (clamp.length) console.log('at the limits:\n ' + clamp.join('\n '));
