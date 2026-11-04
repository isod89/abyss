// SPDX-License-Identifier: GPL-3.0-only
// ABYSS on the web (0.1): the FM-1's brain and the sound in the audio thread (engines/abyss-brain.wasm, js/worklet.js);
// here the deck: the world and the seed, the hands (LIGHT, SPACE, DENSITY, TIME, TENSION; the textures), the gestures
// (the FM-1's black keys), the layers (each one's sound, volume, filter, space, mute, keep); the piece's arc and where the
// peak is; the sound lab (the bank, sent by mail), the set's log, and the deep behind it all.
const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') { for (const [p, x] of Object.entries(v)) { if (p.startsWith('--')) e.style.setProperty(p, x); else e.style[p] = x; } } else if (v != null && v !== false) e.setAttribute(k, v); } for (const c of kids.flat()) if (c != null && c !== false) e.append(c); return e; };
const LAYERS = ['DRUMS', 'DRONE', 'PAD', 'LOW', 'MELO', 'BELL', 'SWELL'];
const SYN = LAYERS.slice(1);
const LAYER_NAME = { DRUMS: 'DRUMS', DRONE: 'DRONE', PAD: 'PAD', LOW: 'LOW', MELO: 'MELODY', BELL: 'BELLS', SWELL: 'SWELL' };
const COL = { DRUMS: '#C9D3E6', DRONE: '#3D7BFF', PAD: '#8C7CFF', LOW: '#1FB3A8', MELO: '#FFB45C', BELL: '#7FF3FF', SWELL: '#FF7FB0', SUB: '#2A5BD0' };
const WORLDS = ['CINEMATIC', 'COSMIC', 'DARK'];
const WCOL = { CINEMATIC: '#F2B66B', COSMIC: '#9DB2FF', DARK: '#E0483E' };
const WSUB = { CINEMATIC: 'Strings, cello, felt piano, tape. Film-score loops at 56–72 BPM.', COSMIC: 'Drifting pads, wind, a Berlin sequencer or a slow beat. Lydian skies.', DARK: 'Drones, a breathing sub, distant metal, one long rise, then the void.' };
const SEC_HINT = { DAWN: 'it begins', THEME: 'the theme', RISE: 'it rises', SWELL: 'it swells', BREATH: 'a breath', PEAK: 'the peak', FALL: 'it falls', TAIL: 'it fades', PULSE: 'the pulse', ORBIT: 'in orbit', VOID: 'the void', DECAY: 'it falls apart' };
const SEC_H = { DAWN: 0.18, THEME: 0.36, RISE: 0.6, SWELL: 0.78, BREATH: 0.1, PEAK: 1, FALL: 0.5, TAIL: 0.2, PULSE: 0.55, ORBIT: 0.45, VOID: 0.04, DECAY: 0.28 };
const KINDS = ['', 'DISINTEGRATION LOOP', 'BERLIN SEQUENCER', 'SLOW BEAT', 'THE CLOCK', 'ORGAN'];
const NOTE = 'C C# D D# E F F# G G# A A# B'.split(' ');
const MODES = ['AEOLIAN', 'DORIAN', 'PHRYGIAN', 'LYDIAN', 'IONIAN', 'MIXOLYDIAN', 'LOCRIAN'];
const QS = ['m', '', 'm9', 'add9', 'maj7', 'sus2', 'sus4', 'm7', '5', ' cl.', ' tri.', ' oct.'];
// each world's envelopes (abyss.c ABYSS_ENV, as worklet.js), DRONE .. SWELL: for the sound lab's audition
const ENV = [[[105, 119], [98, 117], [83, 110], [69, 108], [-1, 110], [108, 119]],
  [[114, 123], [110, 123], [-1, -1], [95, 114], [-1, 114], [114, 123]],
  [[119, 127], [114, 127], [117, 127], [110, 123], [-1, 123], [110, 123]]];
// the gestures (the FM-1's black keys: abyss_brain.h AG_*)
const PADS = [
  { g: 1, k: 'peak', b: 'PEAK NOW', s: 'a breath, then the peak', c: '#FF7FB0', big: true, ic: '✦' },
  { g: 0, k: 'rise', b: 'RISE', s: 'a long rise begins', c: '#F2B66B', ic: '↗' },
  { g: 2, k: 'calm', b: 'CALM', s: 'it settles down', c: '#7FF3FF', ic: '∽' },
  { g: 3, k: 'breath', b: 'BREATH', s: 'a moment of near-silence', c: '#C9D3E6', ic: '◌' },
  { g: 4, k: 'lift', b: 'LIFT', s: 'the key lifts, a new voice', c: '#9DB2FF', ic: '⇡' },
  { g: 5, k: 'theme', b: 'NEW THEME', s: 'another melody', c: '#FFB45C', ic: '♪' },
  { g: 6, k: 'harmony', b: 'NEW HARMONY', s: 'other chords', c: '#8C7CFF', ic: '♮' },
  { g: 7, k: 'hold', b: 'HOLD', s: 'this section loops', c: '#1FB3A8', ic: '⟲' },
  { g: 9, k: 'void', b: 'VOID', s: 'silence, the reverb’s tail', c: '#56678A', ic: '○' },
  { g: 8, k: 'next', b: 'NEXT PIECE', s: 'it winds down, the next one', c: '#7FF3FF', ic: '⏭' },
  { g: 10, k: 'fade', b: 'FADE', s: 'the end, then silence', c: '#E0483E', ic: '▽' },
];
// the hands: the brain's knobs (AK_*) and the space
const HANDS = [
  { k: 'light', ak: 0, label: 'LIGHT', def: 0.5, color: '#F2B66B', fmt: (v) => (v < 0.4 ? 'SHADOW' : v > 0.6 ? 'LIGHT' : 'DUSK'), title: 'Shadow .. light: the filters, the register, and the harmonies of the next pieces' },
  { k: 'space', label: 'SPACE', min: 0, max: 2, def: 1, color: '#9DB2FF', fmt: (v) => `${Math.round(v * 100)} %`, title: 'The reverb and the echo' },
  { k: 'density', ak: 1, label: 'DENSITY', def: 0.5, color: '#7FF3FF', fmt: (v) => `${Math.round(v * 100)}`, title: 'How much it plays: the melody, the bells, the layers' },
  { k: 'time', ak: 2, label: 'TIME', def: 0.5, color: '#1FB3A8', fmt: (v) => (v < 0.4 ? 'SLOWER' : v > 0.6 ? 'FASTER' : 'AS WRITTEN'), title: 'Slower (longer sections, slower chords) .. faster' },
  { k: 'tension', ak: 3, label: 'TENSION', def: 0.4, color: '#E0483E', fmt: (v) => `${Math.round(v * 100)}`, title: 'How rough the peak gets: the clusters, the surprise chord' },
];

let ctx = null, node = null, mods = {}, cats = {}, curData = {}, kitData = {}, levData = {}, packIndex = [], scanData = [];
let info = null, playing = false, scope = new Float32Array(256), peaks = {}, sparks = [], soundsMsg = null, playStart = 0, frisson = 0, lastPiece = '';
const store = (() => { try { return JSON.parse(localStorage.getItem('abyss.v1') || '{}'); } catch (_) { return {}; } })();
store.community ||= false; store.world ||= 'CINEMATIC';
const save = () => { try { localStorage.setItem('abyss.v1', JSON.stringify(store)); } catch (_) { /* (private mode) */ } };
const post = (m) => node?.port.postMessage(m);
const hands = Object.assign(Object.fromEntries(HANDS.map((x) => [x.k, x.def])), store.hands || {});
const strip = Object.fromEntries(LAYERS.map((L) => [L, { vol: 0, flt: 0, space: 1, mute: false }]));
const tex = { shimmer: false, tape: false };

// ------------------------------------------------------------------------------------------------ loading ---
async function compile(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ': ' + r.status); return WebAssembly.compile(await r.arrayBuffer()); }
function catalogOf(m, drums) { const w = new WebAssembly.Instance(m, {}).exports; w._initialize?.(); w.k_init(drums ? 1 : 0); const n = w.k_catalog(); return JSON.parse(new TextDecoder().decode(new Uint8Array(w.memory.buffer, w.k_buffer(), n).slice())); }
async function loadBank(id) {
  if (mods[id]) return;
  if (id === 'clipper' || id === 'sloop') { mods[id] = await compile(`engines/${id}.wasm`); cats[id] = catalogOf(mods[id]); return; }
  const e = packIndex.find((x) => x.id === id); if (!e) return;
  mods[id] = await compile(`engines/packs/${e.file}`); cats[id] = e.catalog;
  post({ t: 'module', bank: id, m: mods[id] });
}
// a bank entry ("ENGINE:PRESET", Clipper's; "bank/ENGINE:PRESET", a community pack's) -> what the worklet plays
const curParse = (k) => { const [bank, rest] = k.includes('/') ? [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)] : ['clipper', k]; const i = rest.indexOf(':'); return { bank, engine: rest.slice(0, i), preset: rest.slice(i + 1), fm1: bank === 'clipper' }; };
const keyOf = (s) => `${s.bank}/${s.engine}/${s.preset}`;
const curOf = (s) => (s.bank === 'clipper' ? `${s.engine}:${s.preset}` : `${s.bank}/${s.engine}:${s.preset}`);
function resolve(s) {
  const c = cats[s.bank]; if (!c) return null;
  const e = c.engines.findIndex((x) => x.name === s.engine); if (e < 0) return null;
  const p = c.engines[e].presets.indexOf(s.preset); if (p < 0) return null;
  return { bank: s.bank, e, p, name: s.preset, engine: s.engine, fm1: s.bank === 'clipper', key: keyOf(s) };
}
const CUR_VER = '0.1';   // (the shipped bank's version: ABYSS 0.1's, calibrated)
const curation = () => store.cur || curData;
const allowed = (s) => s.fm1 || store.community;
function curated() {
  const o = {};
  for (const [W, ls] of Object.entries(curation())) {
    o[W] = {};
    for (const [L, arr] of Object.entries(ls)) o[W][L] = arr.map(curParse).filter(allowed).map((s) => { const x = resolve(s); if (!x) return null; const c = levData[`${W}|${L}|${x.key}`] || {}; return { ...x, trim: c.trim || 0, tone: c.tone || 0 }; }).filter(Boolean);
  }
  return o;
}
async function sendPalette() {
  if (store.community) for (const id of new Set(Object.values(curation()).flatMap((l) => Object.values(l).flat()).map((k) => curParse(k).bank))) await loadBank(id);
  post({ t: 'palette', palette: { CUR: curated(), KITS: kitData, SYN1: (cats.sloop.kits || []).indexOf('SYN1') } });
}

// -------------------------------------------------------------------------------------------- the sound ---
async function start() {
  if (ctx) { if (ctx.state !== 'running') await ctx.resume(); return; }
  ctx = new AudioContext({ sampleRate: 44100, latencyHint: 'playback' });
  await ctx.audioWorklet.addModule('js/worklet.js');
  node = new AudioWorkletNode(ctx, 'abyss', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { modules: mods } });
  node.connect(ctx.destination);
  node.port.onmessage = (e) => {
    const m = e.data;
    if (m.t === 'step') onStep(m);
    else if (m.t === 'scope') { scope = m.s; peaks = m.peaks; }
    else if (m.t === 'sounds') { soundsMsg = m; updateStrips(); }
  };
  await sendPalette();
  for (const x of HANDS) sendHand(x, hands[x.k]);
  for (const L of LAYERS) { const s = strip[L]; post({ t: 'strip', L, what: 'vol', v: s.vol }); post({ t: 'strip', L, what: 'flt', v: s.flt }); post({ t: 'strip', L, what: 'space', v: s.space }); if (s.mute) post({ t: 'mute', L, on: true }); }
  for (const k of ['shimmer', 'tape']) post({ t: 'texture', k, on: tex[k] });
  post({ t: 'seed', code: $('#seed').value, world: WORLDS.indexOf(store.world) });
}
const sendHand = (x, v) => (x.ak != null ? post({ t: 'knob', k: x.ak, v }) : post({ t: 'space', v }));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function onStep(m) {
  const i = info = m.info;
  for (const [L, n, v] of m.notes) sparks.push({ L, n, v, t: performance.now(), x: Math.random() });
  if (sparks.length > 300) sparks.splice(0, sparks.length - 300);
  if (i.frisson) frisson = 1;
  if (i.step % 4 === 0) { renderPlan(i); renderPads(); renderWorlds(); }
  document.body.style.setProperty('--e', (i.e / 1000).toFixed(2));
  const pid = `${i.world}|${i.seed}|${i.piece}`;
  if (i.step === 0 || pid !== lastPiece) {
    const kind = KINDS[i.kind] || '';
    $('#label').textContent = `${i.world} · ${i.seed} · piece ${i.piece + 1}${kind ? ' · ' + kind : ''}`;
    $('#bpm').textContent = i.kind === 2 || i.kind === 3 || i.kind === 4 ? i.bpm : '∞';
    $('#bpm').title = `${i.bpm} BPM`;
    $('#key').textContent = NOTE[i.key]; $('#mode').textContent = MODES[i.mode] || 'KEY';
    $('#kind').textContent = kind ? `THIS PIECE: ${kind}` : '';
    if (i.world !== store.world) { store.world = i.world; save(); renderWorlds(); }
    document.body.dataset.world = i.world;
    if (pid !== lastPiece) {
      lastPiece = pid; $('#seed').value = i.seed;
      $('#setlog').prepend(h('li', {}, h('b', {}, `${i.world} · ${i.seed} · piece ${i.piece + 1}`), ` · ${NOTE[i.key]} ${(MODES[i.mode] || '').toLowerCase()}${kind ? ' · ' + kind.toLowerCase() : ''} · ${new Date().toLocaleTimeString()}`));
    }
    $('#s-sec').textContent = i.sec; $('#s-label').textContent = `${i.world} · ${i.seed}`;
  }
  $('#chord').textContent = NOTE[i.chord] + (QS[i.chordQ] ?? '');
}
// the piece's arc: its sections (as high as they are intense), the playhead; the section, and when the peak comes
function renderPlan(i) {
  const tot = i.planLen.reduce((a, b) => a + b, 0) || 1;
  $('#plan').replaceChildren(...i.plan.map((s, k) => {
    const el = h('i', { class: s + (k === i.planAt ? ' now' : k < i.planAt ? ' past' : ''), title: `${s} · ${i.planLen[k]} bars`, style: { flex: `${i.planLen[k] / tot}`, '--h': SEC_H[s] ?? 0.3 } });
    if (k === i.planAt) el.append(h('b', { style: { width: `${((i.secBar + i.step / 16) / i.secLen) * 100}%` } }));
    return el;
  }));
  $('#sec').textContent = i.sec;
  const bar = 240 / i.bpm, left = (i.secLen - i.secBar - i.step / 16) * bar;
  $('#secinfo').textContent = `${SEC_HINT[i.sec] || ''} · bar ${i.secBar + 1}/${i.secLen}${i.hold ? ' · HOLD' : ''}`;
  const e = $('#next'); let txt = '', hot = false;
  if (i.faded) txt = 'THE END · FADE again or NEXT PIECE to go on';
  else if (i.fade) txt = 'FADING OUT…', hot = true;
  else if (i.worldQ && i.worldQ !== i.world) txt = `${i.worldQ} WITH THE NEXT PIECE`, hot = true;
  else if (i.req.calm === 3) txt = 'WINDING DOWN · THE NEXT PIECE COMES', hot = true;
  else if (i.req.void) txt = 'THE VOID IS COMING', hot = true;
  else if (i.req.rise === 2) txt = 'A BREATH, THEN THE PEAK', hot = true;
  else if (i.hold) txt = 'HOLD: THIS SECTION LOOPS';
  else {
    const pk = i.plan.indexOf('PEAK', i.planAt);
    if (i.sec === 'PEAK') txt = 'THE PEAK', hot = true;
    else if (pk > i.planAt) { let s = left; for (let k = i.planAt + 1; k < pk; k++) s += i.planLen[k] * bar; txt = `PEAK IN ${mmss(s)}`; hot = s < 30; }
    else { let s = left; for (let k = i.planAt + 1; k < i.plan.length; k++) s += i.planLen[k] * bar; txt = `NEXT PIECE IN ${mmss(s)}`; }
  }
  e.textContent = txt; e.classList.toggle('hot', hot);
  const secs = playing ? Math.floor((performance.now() - playStart) / 1000) : 0;
  $('#where').textContent = `set ${mmss(secs)} · ${SEC_HINT[i.sec] || i.sec}${i.lift ? ' · lifted' : ''}`;
}
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 1500); }

// -------------------------------------------------------------------------------------------- the controls ---
// a knob: drag up / down (or the wheel), double-click to its default; bipolar: drawn from the middle
function knob({ label, min = 0, max = 1, value, def = value, bipolar = false, fmt, color, size, title, onchange }) {
  let v = value;
  const ptr = h('div', { class: 'ptr' }), dial = h('div', { class: 'dial' }, ptr), em = h('em'), el = h('div', { class: 'knob', title: title || '' }, dial, h('b', {}, label), em);
  if (color) el.style.setProperty('--kc', color); if (size) el.style.setProperty('--d', size + 'px');
  const draw = () => {
    const x = (v - min) / (max - min);
    dial.style.setProperty('--v', x);
    if (bipolar) { dial.style.setProperty('--s', Math.min(x, 0.5) * 270); dial.style.setProperty('--w', Math.abs(x - 0.5) * 270); }
    else { dial.style.setProperty('--s', 0); dial.style.setProperty('--w', x * 270); }
    em.textContent = fmt ? fmt(v) : '';
  };
  const set = (nv, quiet) => {
    nv = Math.max(min, Math.min(max, nv));
    if (bipolar && Math.abs(nv) < (max - min) * 0.025) nv = 0;
    if (nv === v && !quiet) return; v = nv; draw(); if (!quiet) onchange(v);
  };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); const y0 = e.clientY, v0 = v; const mv = (ev) => set(v0 + (y0 - ev.clientY) / 160 * (max - min)); el.addEventListener('pointermove', mv); const up = () => el.removeEventListener('pointermove', mv); el.addEventListener('pointerup', up, { once: true }); el.addEventListener('pointercancel', up, { once: true }); });
  el.addEventListener('wheel', (e) => { e.preventDefault(); set(v - Math.sign(e.deltaY) * (max - min) / 50); }, { passive: false });
  el.addEventListener('dblclick', () => set(def));
  draw();
  return { el, set, get: () => v };
}
// a fader: the layer's volume (dB), drag up / down, double-click: 0 dB
function fader({ value, onchange, title }) {
  const MIN = -30, MAX = 6; let v = value;
  const fill = h('i', { class: 'fill' }), cap = h('i', { class: 'cap' }), zero = h('i', { class: 'zero' }), el = h('div', { class: 'fader', title }, zero, fill, cap);
  const span = () => (el.clientHeight || 110) - 12, pos = (x) => 6 + (x - MIN) / (MAX - MIN) * span();
  const draw = () => { zero.style.bottom = pos(0) + 'px'; cap.style.bottom = pos(v) + 'px'; fill.style.height = Math.max(0, pos(v) - 6) + 'px'; };
  new ResizeObserver(draw).observe(el);
  const set = (nv) => { nv = Math.round(Math.max(MIN, Math.min(MAX, nv)) * 2) / 2; if (Math.abs(nv) < 0.75) nv = 0; if (nv === v) return; v = nv; draw(); onchange(v); };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); const y0 = e.clientY, v0 = v; const mv = (ev) => set(v0 + (y0 - ev.clientY) / span() * (MAX - MIN)); el.addEventListener('pointermove', mv); const up = () => el.removeEventListener('pointermove', mv); el.addEventListener('pointerup', up, { once: true }); el.addEventListener('pointercancel', up, { once: true }); });
  el.addEventListener('wheel', (e) => { e.preventDefault(); set(v - Math.sign(e.deltaY)); }, { passive: false });
  el.addEventListener('dblclick', () => set(0));
  draw();
  return { el, set: (nv) => { v = nv; draw(); } };
}
const fFilt = (v) => (v === 0 ? 'OPEN' : v < 0 ? `DARK ${Math.round(-v * 100)}` : `THIN ${Math.round(v * 100)}`);
const fPct = (v) => `${Math.round(v * 100)} %`;
const fDb = (v) => (v === 0 ? '0 dB' : `${v > 0 ? '+' : ''}${v} dB`);

// the layers: seven strips
const S = {};
function buildStrips() {
  $('#strips').replaceChildren(...LAYERS.map((L) => {
    const st = strip[L], col = COL[L];
    const nm = h('div', { class: 'nm' }, LAYER_NAME[L], h('small'));
    const name = h('span', {}, '—'), eng = h('em', {}, ''), prev = h('button', { title: 'Previous sound (it stays)', onclick: () => soundStep(L, -1) }, '‹'), next = h('button', { title: 'Next sound (it stays)', onclick: () => soundStep(L, 1) }, '›');
    const meter = h('div', { class: 'meter' }, h('i'));
    const flt = knob({ label: 'FILTER', min: -1, max: 1, value: st.flt, def: 0, bipolar: true, fmt: fFilt, color: col, size: 40, title: 'Left: darker · right: thinner', onchange: (v) => { st.flt = v; post({ t: 'strip', L, what: 'flt', v }); } });
    const spc = knob({ label: 'SPACE', min: 0, max: 2, value: st.space, def: 1, fmt: fPct, color: col, size: 40, title: 'Its reverb and echo', onchange: (v) => { st.space = v; post({ t: 'strip', L, what: 'space', v }); } });
    const fv = h('div', { class: 'fval' }, fDb(st.vol));
    const fad = fader({ value: st.vol, title: 'Volume (double-click: 0 dB)', onchange: (v) => { st.vol = v; fv.textContent = fDb(v); post({ t: 'strip', L, what: 'vol', v }); } });
    const vari = h('button', { title: 'Another sound, by chance (and for the melody, another theme)', onclick: async () => { await start(); post({ t: 'reroll', L }); toast(`${LAYER_NAME[L]}: ANOTHER SOUND`); } }, '↻');
    const lock = h('button', { title: 'Keep this sound in the next pieces', onclick: async () => { await start(); const on = !lock.classList.contains('on'); lock.classList.toggle('on', on); post({ t: 'lock', L, on }); toast(on ? `${LAYER_NAME[L]} KEPT` : `${LAYER_NAME[L]} FREE`); } }, '◆');
    const mute = h('button', { class: 'm', title: 'Mute / unmute', onclick: () => { st.mute = !st.mute; mute.classList.toggle('on', st.mute); el.classList.toggle('muted', st.mute); post({ t: 'mute', L, on: st.mute }); } }, 'M');
    const nav = h('small', {}, '');
    const el = h('div', { class: 'strip', style: { '--c': col } }, nm, h('div', { class: 'snd' }, name, eng, h('div', { class: 'nav' }, prev, nav, next)), meter, h('div', { class: 'minis' }, flt.el), h('div', { class: 'minis' }, spc.el), fad.el, fv, h('div', { class: 'sbtns' }, vari, lock, mute));
    S[L] = { el, nm, name, eng, nav, meter: meter.firstChild, flt, spc, fad, fv, lock, mute };
    return el;
  }));
}
const bankName = (b) => ({ clipper: 'FM-1', sloop: 'SLOOP' }[b] || (packIndex.find((x) => x.id === b)?.manifest?.name) || b);
function updateStrips() {
  const m = soundsMsg; if (!m) return;
  for (const L of LAYERS) {
    const s = S[L]; if (!s) continue;
    s.name.textContent = m.sounds[L] || '—';
    const en = m.engines[L] || '', [engine, bank] = en.split(' · ');
    s.eng.textContent = L === 'DRUMS' ? 'SLOOP KIT' : bank ? `${engine} · ${bankName(bank)}` : engine;
    s.name.title = s.eng.textContent;
    s.nav.textContent = m.n[L] ? `${(m.idx[L] ?? 0) % m.n[L] + 1} / ${m.n[L]}` : '';
    s.lock.classList.toggle('on', !!m.locks[L]);
  }
}
async function soundStep(L, d) { await start(); post({ t: 'sound', L, d }); }
// the hands
const HK = {};
function buildHands() {
  $('#knobs').replaceChildren(...HANDS.map((x) => {
    HK[x.k] = knob({ size: 76, label: x.label, min: x.min ?? 0, max: x.max ?? 1, value: hands[x.k], def: x.def, fmt: x.fmt, color: x.color, title: x.title, onchange: (v) => { hands[x.k] = v; store.hands = hands; save(); sendHand(x, v); } });
    return HK[x.k].el;
  }), h('div', { class: 'knob', title: 'Everything back to the middle' }, h('button', { class: 'btn ghost', style: { marginTop: '22px' }, onclick: () => { for (const x of HANDS) HK[x.k].set(x.def); resetLayers(); } }, 'Reset')));
  for (const k of ['shimmer', 'tape']) $(`#tx-${k}`).addEventListener('click', async () => { await start(); tex[k] = !tex[k]; $(`#tx-${k}`).classList.toggle('on', tex[k]); post({ t: 'texture', k, on: tex[k] }); });
}
function resetLayers() {
  for (const L of LAYERS) { const st = strip[L], s = S[L]; st.vol = 0; st.flt = 0; st.space = 1; s.flt.set(0, true); s.spc.set(1, true); s.fad.set(0); s.fv.textContent = fDb(0); post({ t: 'strip', L, what: 'vol', v: 0 }); post({ t: 'strip', L, what: 'flt', v: 0 }); post({ t: 'strip', L, what: 'space', v: 1 }); if (st.mute) s.mute.click(); }
  toast('BACK TO THE MIDDLE');
}
// the gestures
const PE = {};
function buildPads() {
  $('#pads').replaceChildren(...PADS.map((p) => {
    const el = h('button', { class: 'pad' + (p.big ? ' big' : ''), style: { '--pc': p.c }, title: `${p.b}: ${p.s}`, onclick: async () => {
      await start(); if (!playing) { toast('PRESS PLAY FIRST (▶)'); return; }
      post({ t: 'gesture', g: p.g });
      if (['lift', 'theme', 'harmony'].includes(p.k)) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 260); }
      toast(p.k === 'hold' ? (info?.hold ? 'HOLD: OFF' : 'HOLD: THIS SECTION LOOPS') : p.k === 'fade' ? (info?.fade ? 'FADE: OFF' : 'FADING OUT') : p.b);
    } }, h('span', { class: 'ic' }, p.ic), h('b', {}, p.b), h('small', {}, p.s));
    PE[p.k] = el; return el;
  }));
}
function renderPads() {
  const i = info; if (!i) return;
  const pend = { rise: i.req.rise === 1, peak: i.req.rise === 2, calm: i.req.calm === 1, next: i.req.calm === 3, breath: !!i.req.breath, void: !!i.req.void };
  for (const p of PADS) {
    const el = PE[p.k]; if (!el) continue;
    if (p.k === 'hold') { el.classList.toggle('lit', !!i.hold); continue; }
    if (p.k === 'fade') { el.classList.toggle('lit', !!i.fade); continue; }
    el.classList.toggle('pending', !!pend[p.k]);
  }
  for (const L of LAYERS) S[L]?.el.classList.toggle('off', !i.g[LAYERS.indexOf(L)]);
}
// the worlds
function renderWorlds() {
  const cur = info?.world || store.world, q = info?.worldQ;
  $('#worlds').replaceChildren(...WORLDS.map((n) => h('button', { class: 'world' + (cur === n ? ' on' : '') + (q === n && q !== cur ? ' next' : ''), style: { '--c': WCOL[n] }, onclick: async () => {
    await start(); const w = WORLDS.indexOf(n);
    if (!playing) { store.world = n; save(); document.body.dataset.world = n; post({ t: 'world', w, now: true }); renderWorlds(); return; }
    if (n === cur && q !== n) return;
    const now = q === n;                                   // (a second click: now)
    post({ t: 'world', w, now }); toast(now ? `${n}: NOW` : `${n} WITH THE NEXT PIECE · click again: now`);
  } }, h('b', {}, n), h('small', {}, WSUB[n]))));
}

// ------------------------------------------------------------------------------------------- the sound lab ---
// build ABYSS's sound bank: for each world and layer, the sounds ABYSS picks from. Listen (as the layer plays it, with the
// world's slow envelopes), remove, add, play it on the deck, then send it (sodwavecontact@gmail.com) or download it
const MAIL = 'sodwavecontact@gmail.com';
const LAYER_LAB = { DRONE: ['Drone', 'held under everything'], PAD: ['Pad', 'the chords'], LOW: ['Low', 'the bass line, cellos'], MELO: ['Melody', 'the theme'], BELL: ['Bells', 'felt piano, bells, plucks'], SWELL: ['Swell', 'the new voice at the peak: choir, brass, organ'] };
// what each layer's candidates look like in the scan of every sound (data/scan.json): held or struck, slow or not
const LAB_FIT = {
  DRONE: (s) => s.sus > 0.5 && s.cen < 900, PAD: (s) => s.sus > 0.45 && s.cen < 1400, LOW: (s) => s.sus > 0.3 && s.cen < 500,
  MELO: (s) => s.sus > 0.3 && s.cen < 2200, BELL: (s) => s.sus < 0.45 && s.db > -60, SWELL: (s) => s.sus > 0.5 && s.cen < 1800,
};
// (the likeliest first: held and slow for the drone, the pads and the swell; dark for the low; struck for the bells)
const LAB_SCORE = {
  DRONE: (s) => s.sus + Math.min(s.att, 2) * 0.3 - s.cen / 2000, PAD: (s) => s.sus + Math.min(s.att, 2) * 0.25 - s.cen / 3000, LOW: (s) => s.sus - s.cen / 600,
  MELO: (s) => s.sus - Math.abs(s.cen - 700) / 2000, BELL: (s) => -s.sus + s.cen / 3000, SWELL: (s) => s.sus + Math.min(s.att, 2) * 0.3,
};
const AUD = {
  DRONE: [[45, 52], ...Array(23).fill(null), 0], PAD: [[57, 60, 64], ...Array(11).fill(null), [53, 57, 60], ...Array(11).fill(null), 0],
  LOW: [45, ...Array(7).fill(null), 41, ...Array(7).fill(null), 43, ...Array(7).fill(null), 0], MELO: [69, null, null, null, 72, null, null, null, 71, null, 67, null, 69, ...Array(7).fill(null), 0],
  BELL: [72, null, 79, null, 76, null, 84, null, 72, null, 79, null, 76, null, null, null], SWELL: [[57, 60, 64, 69], ...Array(23).fill(null), 0],
};
let aWorld = null, aPicked = false;
function editCur(fn) { store.cur = JSON.parse(JSON.stringify(curation())); fn(store.cur); save(); renderAtelier(); sendPalette(); }
async function audition(s, L, btn) {
  await start(); await loadBank(s.bank); const x = resolve(s); if (!x) return;
  const [a, r] = ENV[WORLDS.indexOf(aWorld)][SYN.indexOf(L)];
  post({ t: 'audition', bank: x.bank, e: x.e, p: x.p, atk: a, rel: r, notes: AUD[L] });
  document.querySelectorAll('.snd-card button.playing').forEach((b) => b.classList.remove('playing'));
  btn.classList.add('playing'); setTimeout(() => btn.classList.remove('playing'), 5000);
}
function changes() {
  const out = {}, mine = curation();
  for (const W of Object.keys(curData)) for (const L of Object.keys(LAYER_LAB)) {
    const a = new Set((mine[W] || {})[L] || []), b = new Set(curData[W][L] || []);
    const add = [...a].filter((k) => !b.has(k)), rem = [...b].filter((k) => !a.has(k));
    if (add.length || rem.length) ((out[W] ||= {})[L] = { added: add, removed: rem });
  }
  return out;
}
const nChanges = () => Object.values(changes()).reduce((a, ls) => a + Object.values(ls).reduce((b, d) => b + d.added.length + d.removed.length, 0), 0);
function changesText(max = 1400) {
  const c = changes(), lines = [];
  for (const [W, ls] of Object.entries(c)) for (const [L, d] of Object.entries(ls)) lines.push(`${W} ${L}: ${d.added.map((k) => '+' + k).concat(d.removed.map((k) => '-' + k)).join(', ')}`);
  let t = lines.join('\n') || '(no changes yet)';
  if (t.length > max) t = t.slice(0, max) + '\n... (the rest is in the file)';
  return t;
}
const safeName = () => (($('#lab-name').value || 'anonymous').trim().replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 32) || 'anonymous');
const bankFile = () => ({ abyss_bank: 1, name: $('#lab-name').value.trim(), notes: $('#lab-notes').value.trim(), date: new Date().toISOString(), base: CUR_VER, community: !!store.community, changes: changes(), curation: curation() });
function downloadBank() {
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(bankFile(), null, 1)], { type: 'application/json' })), download: `abyss-bank-${safeName()}.json` });
  document.body.append(a); a.click(); a.remove();
}
// the bank straight to the inbox: FormSubmit (formsubmit.co) relays the form to MAIL, no email app and no attachment
let sending = false;
async function sendBank() {
  if (sending) return;
  if (!nChanges() && !$('#lab-notes').value.trim()) { toast('CHANGE THE BANK (OR WRITE A NOTE) FIRST'); return; }
  const btn = $('#lab-mail'), name = $('#lab-name').value.trim();
  sending = true; btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const r = await fetch(`https://formsubmit.co/ajax/${MAIL}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ _subject: `ABYSS sound bank from ${name || 'an ABYSS listener'}`, _template: 'box', _captcha: 'false',
        name: name || '-', notes: $('#lab-notes').value.trim() || '-', community_sounds: store.community ? 'yes' : 'no',
        changes: changesText(20000), bank: JSON.stringify(bankFile()) }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && String(j.success) === 'true') { setSent('SENT, THANK YOU!'); toast('BANK SENT, THANK YOU!'); }
    else throw new Error(j.message || `HTTP ${r.status}`);
  } catch (e) {
    setSent(''); toast('COULD NOT SEND: DOWNLOAD IT AND EMAIL THE FILE');
    $('#lab-err').hidden = false; $('#lab-err').textContent = `Could not send (${String(e.message || e).slice(0, 120)}). Use Download, then email the file to ${MAIL}.`;
  } finally { sending = false; btn.disabled = false; btn.textContent = 'Send my bank'; }
}
function setSent(t) { const e = $('#lab-sent'); e.textContent = t; e.hidden = !t; if (t) $('#lab-err').hidden = true; }
function pasteBank() { const t = prompt('Paste an ABYSS bank (the "bank" text from an email, or a .json file\'s content):'); if (t) loadBankFile(new Blob([t.trim()])); }
async function copyBank() { try { await navigator.clipboard.writeText(JSON.stringify(bankFile())); toast('BANK COPIED: PASTE IT IN AN EMAIL'); } catch (_) { toast('COULD NOT COPY: USE DOWNLOAD'); } }
function loadBankFile(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result), cur = j.curation || j;
      if (!cur || typeof cur !== 'object' || !WORLDS.some((W) => cur[W] && typeof cur[W] === 'object')) throw new Error('not a bank');
      store.cur = cur; if (j.community != null) store.community = !!j.community; save();
      $('#community').checked = store.community;
      if (j.name != null) $('#lab-name').value = j.name; if (j.notes != null) $('#lab-notes').value = j.notes;
      renderAtelier(); sendPalette(); toast(`BANK LOADED${j.name ? ': ' + j.name.toUpperCase() : ''}`);
    } catch (_) { toast('THIS FILE IS NOT AN ABYSS BANK'); }
  };
  r.readAsText(file);
}
function renderAtelier() {
  if (!aPicked) aWorld = info?.world || store.world;
  $('#a-worlds').replaceChildren(...WORLDS.map((n) => h('button', { class: 'chip' + (n === aWorld ? ' on' : ''), style: n === aWorld ? { background: WCOL[n], borderColor: WCOL[n] } : {}, onclick: () => { aWorld = n; aPicked = true; renderAtelier(); } }, n)));
  const cur = curation()[aWorld] || {};
  let total = 0;
  const blocks = Object.keys(LAYER_LAB).map((L) => {
    const list = (cur[L] || []).map(curParse).filter(allowed);
    const have = new Set(list.map(keyOf));
    const cands = scanData.filter((s) => (s.bank === 'clipper' || store.community) && LAB_FIT[L](s) && !have.has(keyOf(s))).sort((a, b) => LAB_SCORE[L](b) - LAB_SCORE[L](a));
    total += list.length;
    return h('div', { class: 'lrole' },
      h('h4', { style: { color: COL[L] } }, `${LAYER_LAB[L][0]} · ${list.length} sound${list.length === 1 ? '' : 's'}`, h('small', {}, LAYER_LAB[L][1]),
        h('select', { title: 'Add a sound to this layer of this world', onchange: (e) => { const s = cands[+e.target.value]; if (s) editCur((c) => { ((c[aWorld] ||= {})[L] ||= []).push(curOf(s)); }); } }, h('option', { value: '' }, `+ add a sound (${cands.length} more)…`), cands.map((s, i) => h('option', { value: i }, `${s.preset} · ${s.engine}${s.bank === 'clipper' ? '' : ' · ' + bankName(s.bank)}`)))),
      h('div', { class: 'sounds' }, list.map((s) => { const b = h('button', { title: 'Listen (alone, as this layer plays it)' }, '▶'); b.onclick = () => audition(s, L, b); return h('div', { class: 'snd-card' },
        b, h('div', { class: 'nm' }, h('b', {}, s.preset), h('small', {}, `${bankName(s.bank)} · ${s.engine}`), !s.fm1 ? h('span', { class: 'tag' }, 'COMMUNITY') : null),
        h('button', { title: 'Remove from this world', onclick: () => editCur((c) => { c[aWorld][L] = c[aWorld][L].filter((k) => k !== curOf(s)); }) }, '×')); })));
  });
  $('#atelier').replaceChildren(...blocks);
  const n = nChanges();
  $('#count').textContent = `${aWorld}: ${total} sounds · ${n ? `${n} change${n > 1 ? 's' : ''} from ABYSS's bank` : 'ABYSS\'s own bank'}`;
  $('#lab-changes').textContent = changesText(4000);
}

// ------------------------------------------------------------------------------------------------ the deep ---
// the layers as glows at their depths (the swell and the bells near the surface, the drone and the low deep down),
// breathing with their levels; each note a light where its pitch is; the snow (CINEMATIC: warm dust; COSMIC: stars;
// DARK: embers); the surface a slow wave of the sound itself; the peak's chill a bloom of light
const cv = $('#deep'), g = cv.getContext('2d');
const DEPTH = { SWELL: 0.24, BELL: 0.2, MELO: 0.34, PAD: 0.48, DRONE: 0.64, LOW: 0.78, SUB: 0.9, DRUMS: 0.7 };
const SNOW = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.6, v: 0.3 + Math.random(), p: Math.random() * 6.28 }));
const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
let lightV = 0.5;
function frame(now) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const i = info, e = i ? i.e / 1000 : 0.15, world = i ? i.world : store.world, wc = WCOL[world], sec = i ? i.sec : 'DAWN';
  lightV += ((hands.light ?? 0.5) - lightV) * 0.02;
  const voidK = sec === 'VOID' ? 0.25 : 1;
  // the water: lighter toward the surface, more so with the light and the energy
  const bg = g.createLinearGradient(0, 0, 0, H);
  const top = world === 'DARK' ? [26, 8, 10] : world === 'COSMIC' ? [14, 16, 44] : [30, 26, 34];
  const k = (0.35 + 0.65 * lightV) * (0.5 + 0.8 * e) * voidK;
  bg.addColorStop(0, `rgb(${top.map((c) => Math.round(c * k + 2)).join(',')})`); bg.addColorStop(0.55, 'rgb(3,6,14)'); bg.addColorStop(1, 'rgb(1,2,6)');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // the layers' glows
  g.globalCompositeOperation = 'lighter';
  for (const L of [...SYN, 'SUB']) {
    const p = Math.min(1, (peaks[L] || 0) * 4.5) * voidK; if (p < 0.01) continue;
    const y = H * DEPTH[L], rx = W * (0.35 + 0.3 * p), ry = H * (0.06 + 0.08 * p);
    const gr = g.createRadialGradient(W / 2, y, 0, W / 2, y, rx);
    gr.addColorStop(0, hex(COL[L], 0.42 * p)); gr.addColorStop(1, hex(COL[L], 0));
    g.save(); g.translate(0, y); g.scale(1, ry / rx); g.translate(0, -y); g.fillStyle = gr; g.beginPath(); g.arc(W / 2, y, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // the notes
  for (const s of sparks) {
    const life = s.L === 'BELL' ? 2200 : s.L === 'MELO' ? 3200 : s.L === 'DRUMS' ? 900 : 5200, t = (now - s.t) / life; if (t > 1) continue;
    const x = W * (0.08 + 0.84 * ((s.n - 24) / 80 * 0.7 + s.x * 0.3)), y = H * (DEPTH[s.L] ?? 0.5) + (s.L === 'BELL' ? -t * H * 0.05 : t * H * 0.02);
    const r = (s.L === 'BELL' || s.L === 'MELO' ? 3 + s.v / 18 : s.L === 'DRUMS' ? 10 + s.v / 6 : 18 + s.v / 3) * dpr * (1 + t * 0.6);
    const a = (1 - t) * (s.L === 'BELL' ? 0.95 : 0.55) * (0.45 + s.v / 140) * voidK;
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, hex(COL[s.L] || '#ffffff', a)); gr.addColorStop(0.3, hex(COL[s.L] || '#ffffff', a * 0.35)); gr.addColorStop(1, hex(COL[s.L] || '#ffffff', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
  }
  // the snow
  for (const p of SNOW) {
    if (world === 'COSMIC') { p.x += 0.00002 * p.v; } else if (world === 'DARK') { p.y -= 0.00008 * p.v; p.x += Math.sin(now / 3000 + p.p) * 0.00004; } else { p.y += 0.00006 * p.v; p.x += Math.sin(now / 4000 + p.p) * 0.00003; }
    if (p.y > 1) p.y -= 1; if (p.y < 0) p.y += 1; if (p.x > 1) p.x -= 1;
    const tw = world === 'COSMIC' ? 0.5 + 0.5 * Math.sin(now / 900 * p.v + p.p) : 1;
    g.fillStyle = hex(world === 'COSMIC' ? '#dfe8ff' : wc, (0.12 + 0.3 * e) * tw * p.s / 2 * voidK);
    g.beginPath(); g.arc(p.x * W, p.y * H, p.s * dpr, 0, Math.PI * 2); g.fill();
  }
  // the surface: the sound itself, slow
  g.globalCompositeOperation = 'source-over';
  g.beginPath();
  for (let x = 0; x <= 128; x++) { const v = scope[(x * 2) % scope.length] || 0, y = H * 0.12 + Math.sin(x / 9 + now / 2400) * H * 0.008 + v * H * 0.06; x ? g.lineTo(x / 128 * W, y) : g.moveTo(0, y); }
  g.strokeStyle = hex(wc, 0.12 + 0.3 * e); g.lineWidth = 1.5 * dpr; g.stroke();
  // the chill
  if (frisson > 0.005) { const gr = g.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.8); gr.addColorStop(0, `rgba(255,240,250,${frisson * 0.22})`); gr.addColorStop(1, 'rgba(255,240,250,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); frisson *= 0.985; }
  // the strips' meters
  for (const L of LAYERS) { const s = S[L]; if (!s) continue; const p = Math.max(peaks[L] || 0, L === 'LOW' ? peaks.SUB || 0 : 0); s.meter.style.width = `${Math.min(100, p * 220)}%`; }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------------------------------------- the start ---
function randomCode() { const B = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; let s = crypto.getRandomValues(new Uint32Array(1))[0], o = ''; for (let i = 0; i < 7; i++) { o = B[s & 31] + o; s >>>= 5; } return o.slice(0, 3) + '-' + o.slice(3); }
async function main() {
  $('#loadbar').value = 10;
  try { packIndex = await (await fetch('engines/packs/index.json')).json(); } catch (_) { packIndex = []; }
  curData = await (await fetch('data/curation.json')).json();
  try { levData = await (await fetch('data/levels.json')).json(); } catch (_) { levData = {}; }
  try { scanData = await (await fetch('data/scan.json')).json(); } catch (_) { scanData = []; }
  kitData = await (await fetch('data/kits.json')).json();
  if (store.cur && store.curVer !== CUR_VER) delete store.cur;   // (a new bank: an old edit of the old one goes)
  store.curVer = CUR_VER; save();
  mods.brain = await compile('engines/abyss-brain.wasm'); $('#loadbar').value = 25;
  await loadBank('clipper'); $('#loadbar').value = 70; await loadBank('sloop'); $('#loadbar').value = 95;
  $('#seed').value = store.seed || randomCode();
  document.body.dataset.world = store.world;
  buildStrips(); buildHands(); buildPads(); renderWorlds(); renderAtelier();
  $('#community').checked = store.community;
  $('#community').addEventListener('change', async (e) => { store.community = e.target.checked; save(); renderAtelier(); if (node) { toast(store.community ? 'LOADING THE COMMUNITY PACKS…' : 'FM-1 SOUNDS ONLY'); await sendPalette(); } });
  $('#export').addEventListener('click', downloadBank);
  $('#lab-mail').addEventListener('click', sendBank); $('#lab-copy').addEventListener('click', copyBank); $('#lab-paste').addEventListener('click', pasteBank);
  $('#lab-load').addEventListener('click', () => $('#lab-file').click()); $('#lab-file').addEventListener('change', (e) => { if (e.target.files[0]) loadBankFile(e.target.files[0]); e.target.value = ''; });
  $('#lab-name').value = store.labName || ''; $('#lab-notes').value = store.labNotes || '';
  $('#lab-name').addEventListener('input', (e) => { store.labName = e.target.value; save(); }); $('#lab-notes').addEventListener('input', (e) => { store.labNotes = e.target.value; save(); });
  for (const b of document.querySelectorAll('[data-go]')) b.addEventListener('click', (e) => { e.preventDefault(); document.querySelector(`.tabs button[data-tab="${b.dataset.go}"]`).click(); scrollTo(0, 0); });
  $('#resetcur').addEventListener('click', () => { delete store.cur; save(); renderAtelier(); sendPalette(); });
  const showOff = () => { document.body.classList.remove('show'); if (document.fullscreenElement) document.exitFullscreen?.(); };
  $('#show').addEventListener('click', () => { document.body.classList.add('show'); document.documentElement.requestFullscreen?.().catch(() => {}); });
  $('#deep').addEventListener('click', showOff); $('#showinfo').addEventListener('click', showOff);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('show'); });
  let starting = false;
  $('#play').addEventListener('click', async () => {
    if (starting) return;
    if (!ctx) { starting = true; $('#play').classList.add('wait'); $('#play').firstChild.textContent = '…'; toast('STARTING THE SOUND ENGINES…'); }
    try { await start(); } finally { starting = false; $('#play').classList.remove('wait'); }
    playing = !playing; post({ t: 'play', on: playing });
    $('#play').classList.toggle('on', playing); $('#play').firstChild.textContent = playing ? '■' : '▶';
    if (playing) playStart = performance.now();
  });
  const reseed = async (c) => { $('#seed').value = c; store.seed = c; save(); lastPiece = ''; await start(); post({ t: 'seed', code: c, world: WORLDS.indexOf(info?.world || store.world) }); };
  $('#newseed').addEventListener('click', async () => { await reseed(randomCode()); toast('A NEW SET'); });
  $('#seed').addEventListener('change', (e) => reseed(e.target.value.toUpperCase()));
  $('#copyseed').addEventListener('click', () => { navigator.clipboard?.writeText(`${info?.world || store.world} · ${$('#seed').value}`); toast('COPIED'); });
  for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => { for (const x of document.querySelectorAll('.tabs button')) x.classList.toggle('on', x === b); for (const p of document.querySelectorAll('.panel')) p.classList.toggle('on', p.id === 'tab-' + b.dataset.tab); if (b.dataset.tab === 'atelier') renderAtelier(); });
  const help = (on) => { $('#helpbox').hidden = !on; if (!on) { store.helped = true; save(); } };
  $('#help').addEventListener('click', () => help(true)); $('#helpok').addEventListener('click', () => help(false)); $('#helpbox').addEventListener('click', (e) => { if (e.target.id === 'helpbox') help(false); });
  addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.code === 'Space') { e.preventDefault(); $('#play').click(); } if (e.key === 'f') $('#show').click(); if (e.key === 'Escape') { showOff(); help(false); } });
  $('#loading').remove();
  if (!store.helped) help(true);
  requestAnimationFrame(frame);
}
main();
