// SPDX-License-Identifier: GPL-3.0-only
// ABYSS, the sound: the FM-1's own brain (engines/abyss-brain.wasm, abyss_brain.c compiled as it is) asked for each
// sixteenth; its notes played on the real engines of the FM-1's firmwares (WebAssembly: Clipper's, SLOOP's drums, the
// community's packs), one instance a layer, with ABYSS's envelopes (slow attacks, long releases); then the mix as on the
// machine: each layer's level (the brain's fades and swells, the sound's calibration, the hand's), its filter (the
// brain's, opening at the peak), the sub (a sine, 27-65 Hz), the textures (tape hiss, wind, rumble), a long reverb (an
// eight-line feedback delay network: CINEMATIC ~6 s, COSMIC ~10 s, DARK ~24 s; SHIMMER: its tail an octave up), an echo,
// the master's low-pass (DARK's closed but at the peak), the whole set's pitch drifting a few cents.
const BLOCK = 32;
const LAYERS = ['DRUMS', 'DRONE', 'PAD', 'LOW', 'MELO', 'BELL', 'SWELL'];   // (the brain's AL_*: 0..6, the sub 7)
const SYN = LAYERS.slice(1);
// each layer's place: level, echo send, reverb send, pan
const MIX = { DRONE: [0.5, 0, 0.62, 0], PAD: [0.5, 0.12, 0.8, 0], LOW: [0.62, 0, 0.34, 0], MELO: [0.5, 0.34, 0.64, 0.14], BELL: [0.38, 0.44, 0.74, -0.25], SWELL: [0.5, 0.1, 0.92, 0] };
// each world's envelopes (abyss.c ABYSS_ENV: P_ATK, P_REL; -1 the sound's own), DRONE .. SWELL
const ENV = [[[105, 119], [98, 117], [83, 110], [69, 108], [-1, 110], [108, 119]],
  [[114, 123], [110, 123], [-1, -1], [95, 114], [-1, 114], [114, 123]],
  [[119, 127], [114, 127], [117, 127], [110, 123], [-1, 123], [110, 123]]];
// each world's space: reverb RT60 (s), damping (0..1), pre-delay (s); the echo (in beats) and its feedback; the drums' sends
const FXW = [{ rt: 6, damp: 0.45, pre: 0.025, dly: 0.75, fb: 0.36, ds: 0.1, rs: 0.3 }, { rt: 10, damp: 0.3, pre: 0.04, dly: 1, fb: 0.52, ds: 0.2, rs: 0.4 }, { rt: 24, damp: 0.72, pre: 0.09, dly: 1, fb: 0.72, ds: 0.1, rs: 0.6 }];
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const uncode = (c) => { let s = 0; for (const ch of String(c || '').toUpperCase()) { const v = B32.indexOf(ch); if (v >= 0) s = (s * 32 + v) >>> 0; } return s; };
const code = (s) => { let o = ''; for (let i = 0; i < 7; i++) { o = B32[s & 31] + o; s >>>= 5; } return o.slice(0, 3) + '-' + o.slice(3); };
const SECS = ['DAWN', 'THEME', 'RISE', 'SWELL', 'BREATH', 'PEAK', 'FALL', 'TAIL', 'PULSE', 'ORBIT', 'VOID', 'DECAY'];
const WORLDS = ['CINEMATIC', 'COSMIC', 'DARK'];

// a 12 dB state-variable filter (Cytomic's trapezoidal), low-pass or high-pass, stereo
class Svf {
  constructor() { this.s = [0, 0, 0, 0]; this.fc = 0; this.hp = false; }
  set(fc, hp) {
    fc = Math.max(20, Math.min(fc, sampleRate * 0.45));
    if (Math.abs(fc - this.fc) < 0.5 && hp === this.hp) return;
    this.fc = fc; this.hp = hp;
    const g = Math.tan(Math.PI * fc / sampleRate), k = 1.3;
    this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2; this.k = k;
  }
  run(x, ch) {
    const s = this.s, o = ch * 2, v3 = x - s[o + 1], v1 = this.a1 * s[o] + this.a2 * v3, v2 = s[o + 1] + this.a2 * s[o] + this.a3 * v3;
    s[o] = 2 * v1 - s[o]; s[o + 1] = 2 * v2 - s[o + 1];
    return this.hp ? x - this.k * v1 - v2 : v2;
  }
}
// the reverb: two input diffusers, then eight delay lines mixed by a Householder matrix, each damped (a one-pole
// low-pass in the loop) and set for the world's RT60; two outputs taken from alternate lines; a pre-delay
class Fdn {
  constructor() {
    const L = [1123, 1361, 1567, 1823, 2083, 2357, 2633, 2971].map((n) => Math.round(n * sampleRate / 44100));
    this.d = L.map((n) => ({ b: new Float32Array(n), i: 0, z: 0 }));
    this.ap = [347, 529].map((n) => ({ b: new Float32Array(n), i: 0 }));
    this.pre = new Float32Array(Math.ceil(sampleRate * 0.2)); this.pi = 0; this.preN = 1000;
    this.g = new Float32Array(8); this.damp = 0.4; this.set(6, 0.4, 0.03);
    this.v = new Float32Array(8);
  }
  set(rt, damp, pre) {
    this.d.forEach((l, k) => { this.g[k] = Math.pow(10, -3 * l.b.length / (rt * sampleRate)); });
    this.damp = damp; this.preN = Math.max(1, Math.min(this.pre.length - 1, Math.round(pre * sampleRate)));
  }
  run(x) {                                          // mono in, [l, r] out
    const P = this.pre; P[this.pi] = x; let y = P[(this.pi - this.preN + P.length) % P.length]; this.pi = (this.pi + 1) % P.length;
    for (const a of this.ap) { const z = a.b[a.i]; const w = y + z * 0.6; a.b[a.i] = w; y = z - w * 0.6; a.i = (a.i + 1) % a.b.length; }
    const v = this.v; let s = 0;
    for (let k = 0; k < 8; k++) { const l = this.d[k]; v[k] = l.b[l.i]; s += v[k]; }
    s *= 0.25;                                      // (Householder: 2/N)
    let oL = 0, oR = 0;
    for (let k = 0; k < 8; k++) {
      const l = this.d[k], o = v[k];
      if (k & 1) oR += o; else oL += o;
      let w = (o - s) * this.g[k];
      l.z += (w - l.z) * (1 - this.damp); w = l.z;  // (damping)
      l.b[l.i] = w + y * 0.35; l.i = (l.i + 1) % l.b.length;
    }
    return [oL * 0.5, oR * 0.5];
  }
}
// SHIMMER: an octave up (two read heads at twice the speed, crossfaded), fed back into the reverb
class Octave {
  constructor() { this.n = 4096; this.b = new Float32Array(this.n); this.w = 0; this.p = 0; }
  run(x) {
    const n = this.n; this.b[this.w] = x; this.w = (this.w + 1) % n;
    this.p = (this.p + 1) % n;                      // (the read head moves twice as fast as the write: +1 more a sample)
    const d1 = this.p, d2 = (this.p + n / 2) % n, r1 = this.b[(this.w - d1 + n) % n], r2 = this.b[(this.w - d2 + n) % n];
    const f = d1 / n, g1 = Math.sin(Math.PI * f), g2 = Math.sin(Math.PI * ((f + 0.5) % 1));
    return (r1 * g1 + r2 * g2) * 0.7;
  }
}

class Abyss extends AudioWorkletProcessor {
  constructor(opt) {
    super();
    this.mods = opt.processorOptions.modules;      // { brain, clipper, sloop, packs... } compiled modules
    const b = this.b = new WebAssembly.Instance(this.mods.brain, {}).exports;
    this.pal = null; this.inst = {}; this.dr = null; this.drKit = null; this.aud = null;
    this.offs = []; this.playing = false; this.until = 0;
    this.fl = {}; for (const L of SYN) this.fl[L] = { lp: new Svf(), hp: new Svf(), c: 1000 };
    this.lvl = {}; this.lvlT = {}; for (const L of LAYERS) { this.lvl[L] = 0; this.lvlT[L] = 0; }
    this.vol = {}; this.flt = {}; this.space = {}; this.mute = {}; this.mSpace = 1;
    this.verb = new Fdn(); this.oct = new Octave(); this.shimmer = 0; this.tape = 0;
    this.dl = [new Float32Array(sampleRate * 3), new Float32Array(sampleRate * 3)]; this.dw = 0; this.dlz = [0, 0];
    this.mlp = new Svf(); this.mlpV = 0; this.gain = 0.7; this.gainT = 0.7; this.lim = 1;
    this.sub = { ph: 0, f: 40, env: 0, gate: 0, n: -1, vel: 0, am: 0, amph: 0 };
    this.nz = 1234567; this.hiss = 0; this.wind = 0; this.windF = 0; this.rum = 0; this.hz = 0; this.wl = 0; this.wb = 0; this.b1 = 0; this.b2 = 0; this.rph = 0;
    this.hissT = 0; this.windT = 0; this.windFT = 0; this.rumT = 0; this.subAm = 0; this.drift = 0;
    this.peaks = {}; this.scope = new Float32Array(1024); this.sw = 0; this.since = 0;
    this.world = 0; this.bpm = 64; this.sentSounds = '';
    this.port.onmessage = (e) => this.msg(e.data);
  }
  msg(m) {
    const b = this.b;
    switch (m.t) {
      case 'module': this.mods[m.bank] = m.m; break;
      case 'palette': {
        this.pal = m.palette;
        for (let w = 0; w < 3; w++) { for (let L = 1; L < 7; L++) b.w_pal(w, L, (this.pal.CUR[WORLDS[w]][LAYERS[L]] || []).length); b.w_pal(w, 0, (this.pal.KITS[WORLDS[w]] || []).length); }
        if (!this.seeded) { b.w_init(); this.seeded = true; }
        this.sync(true); break;
      }
      case 'seed': this.allOff(); b.w_seed(uncode(m.code), m.world ?? b.w_b(0)); this.sync(true); break;
      case 'play': this.playing = !!m.on; if (!this.playing) this.allOff(); else this.until = 0; break;
      case 'knob': b.w_knob(m.k, Math.round(m.v * 1000)); break;
      case 'gesture': b.w_gesture(m.g); break;
      case 'world': if (m.now) this.allOff(); b.w_world(m.w, m.now ? 1 : 0); this.sync(true); break;
      case 'space': this.mSpace = m.v; break;
      case 'strip': (m.what === 'vol' ? this.vol : m.what === 'flt' ? this.flt : this.space)[m.L] = m.v; break;
      case 'mute': this.mute[m.L] = !!m.on; if (m.on) this.layerOff(m.L); break;
      case 'sound': b.w_snd_step(LAYERS.indexOf(m.L), m.d); this.sync(true); break;
      case 'lock': b.w_lock(LAYERS.indexOf(m.L), m.on ? 1 : 0); this.sync(true); break;
      case 'reroll': b.w_reroll(LAYERS.indexOf(m.L)); this.sync(true); break;
      case 'texture': if (m.k === 'shimmer') this.shimmer = m.on ? 1 : 0; else this.tape = m.on ? 1 : 0; break;
      case 'audition': this.audition(m); break;
    }
  }
  mg(Ln) {                                         // (a muted layer: out in a few milliseconds, no click)
    const M = this.mgv || (this.mgv = {}), v = (M[Ln] ?? 1) + ((this.mute[Ln] ? 0 : 1) - (M[Ln] ?? 1)) * 0.25;
    return (M[Ln] = v < 1e-4 ? 0 : v);
  }
  make(bank, drums) { const w = new WebAssembly.Instance(this.mods[bank], {}).exports; w._initialize?.(); w.k_init(drums ? 1 : 0); return w; }
  // the sounds the brain picked (an index in the world's selection, each layer), applied with the world's envelopes
  sync(force) {
    const b = this.b, p = this.pal; if (!p) return;
    const w = b.w_b(0), W = WORLDS[w];
    if (!force && !b.w_b(17)) return;
    b.w_b(18);
    for (let L = 1; L < 7; L++) {
      const Ln = LAYERS[L], pool = p.CUR[W][Ln] || [], i = b.w_snd(L);
      if (!pool.length || i < 0) continue;
      const s = pool[i % pool.length], it = this.inst[Ln];
      if (it && it.sound === s && it.world === w && it.kind === b.w_b(3)) continue;
      this.setSound(Ln, s, w);
    }
    const kits = p.KITS[W] || [], ki = b.w_snd(0);
    if (kits.length && ki >= 0 && this.drKit !== kits[ki % kits.length]) this.setDrums(kits[ki % kits.length]);
    const names = Object.fromEntries(LAYERS.map((Ln) => [Ln, Ln === 'DRUMS' ? (this.drKit ? this.drKit.name : '-') : this.inst[Ln] ? this.inst[Ln].sound.name : '-']));
    const engines = Object.fromEntries(LAYERS.map((Ln) => [Ln, Ln === 'DRUMS' ? 'KIT' : this.inst[Ln] ? this.inst[Ln].sound.engine + (this.inst[Ln].sound.fm1 ? '' : ' · ' + this.inst[Ln].sound.bank) : '']));
    const n = Object.fromEntries(LAYERS.map((Ln, L) => [Ln, L ? (p.CUR[W][Ln] || []).length : kits.length]));
    const idx = Object.fromEntries(LAYERS.map((Ln, L) => [Ln, b.w_snd(L)]));
    const locks = Object.fromEntries(LAYERS.map((Ln, L) => [Ln, !!b.w_locked(L)]));
    this.port.postMessage({ t: 'sounds', sounds: names, engines, n, idx, locks });
  }
  setSound(Ln, s, w) {
    if (!this.mods[s.bank]) return;
    let it = this.inst[Ln];
    if (!it || it.bank !== s.bank) it = this.inst[Ln] = { w: this.make(s.bank, 0), bank: s.bank };
    else { it.w.k_panic(); this.offs = this.offs.filter((o) => o.w !== it.w); }
    it.w.k_preset(s.e, s.p);
    const L = LAYERS.indexOf(Ln), E = ENV[w][L - 1], kind = this.b.w_b(3);
    let [a, r] = E; if (kind === 1 && Ln === 'PAD') { a = 80; r = 112; }   // (DARK's decaying loop: a short pad)
    if (a >= 0) it.w.k_param(1, a); if (r >= 0) it.w.k_param(4, r);
    it.w.k_render(); it.w.k_render();
    it.sound = s; it.world = w; it.kind = kind; it.trim = Math.pow(10, (s.trim || 0) / 20); it.tone = s.tone || 0;
  }
  setDrums(K) {
    if (!this.mods.sloop) return;
    if (!this.dr) this.dr = this.make('sloop', 1);
    const w = this.dr; w.k_panic();
    const retune = (v, n16) => { if (!n16) return v; v = v.slice(); v[2] = n16 >> 4; v[3] = n16 & 15; return v; };
    const lanes = K.lanes.map((v, i) => (i === 0 ? retune(v, K.kickN16) : i === 14 ? retune(v, K.kick2N16) : v));
    const base = w.k_dsu(), mem = new Uint8Array(w.memory.buffer), o = base + 8;
    mem.fill(0, o, o + 364); for (let i = 0; i < Math.min(8, K.name.length); i++) mem[o + i] = K.name.charCodeAt(i);
    mem[o + 8] = K.crush; lanes.forEach((v, i) => mem.set(v, o + 12 + i * 22)); w.k_dsu_fix();
    w.k_kit(this.pal.SYN1 ?? 42);
    this.drKit = K;
  }
  audition(m) {                                    // the sound lab: one sound alone, as its layer plays it
    if (!this.mods[m.bank]) return;
    const a = this.aud || (this.aud = {});
    if (a.bank !== m.bank) { a.w = this.make(m.bank, 0); a.bank = m.bank; }
    a.w.k_panic(); a.w.k_preset(m.e, m.p);
    if (m.atk >= 0) a.w.k_param(1, m.atk); if (m.rel >= 0) a.w.k_param(4, m.rel);
    a.w.k_render(); a.w.k_render();
    a.seq = m.notes; a.t = 0; a.k = 0; a.on = true; a.held = [];
  }
  allOff() {
    for (const o of this.offs) if (o.w) o.w.k_note(o.n, 0, 0);
    this.offs = []; for (const L in this.inst) this.inst[L].w.k_panic(); if (this.dr) this.dr.k_panic(); this.sub.gate = 0;
  }
  layerOff(Ln) {
    if (Ln === 'DRUMS') { if (this.dr) this.dr.k_panic(); return; }
    if (Ln === 'LOW') this.sub.gate = 0;
    const it = this.inst[Ln]; if (!it) return;
    it.w.k_panic(); this.offs = this.offs.filter((o) => o.w !== it.w);
  }
  // one sixteenth: the brain's step, its notes into the instances; the mix's targets; what the screen shows
  fire() {
    const b = this.b; b.w_step();
    const bpm = b.w_ev(18) || 64, spb = sampleRate * 60 / bpm / 4; this.bpm = bpm;
    if (b.w_b(17)) this.sync(false);
    const w = this.world = b.w_b(0), notes = [];
    for (let i = 0, n = b.w_n(); i < n; i++) {
      const x = b.w_note(i), L = x >> 16, nt = (x >> 8) & 255, v = x & 255, len = b.w_len(i), Ln = L === 7 ? 'SUB' : LAYERS[L];
      if (this.mute[Ln === 'SUB' ? 'LOW' : Ln]) continue;
      if (Ln !== 'SUB' && Ln !== 'DRUMS' && b.w_lvl(L) <= 0) continue;
      notes.push([Ln, nt, v]);
      if (Ln === 'SUB') { const S = this.sub; S.f = 440 * Math.pow(2, (nt - 69) / 12); S.vel = v / 127; S.gate = 1; S.n = nt; this.offs.push({ sub: true, n: nt, at: len * spb * 0.98 }); continue; }
      const wi = Ln === 'DRUMS' ? this.dr : this.inst[Ln] && this.inst[Ln].w;
      if (!wi) continue;
      if (Ln !== 'DRUMS') for (const o of this.offs) if (o.w === wi && o.n === nt) { wi.k_note(nt, 0, 0); o.at = -1e9; }
      wi.k_note(nt, v, 1);
      this.offs.push({ w: wi, n: nt, at: Math.max(1, len * spb * (Ln === 'DRUMS' ? 0.5 : 0.98)) });
    }
    for (let L = 0; L < 7; L++) this.lvlT[LAYERS[L]] = b.w_lvl(L) / 1000;
    this.subLvl = b.w_lvl(7) / 1000;
    for (let L = 1; L < 7; L++) this.fl[LAYERS[L]].c = b.w_cut(L) >= 0 ? b.w_cut(L) : this.fl[LAYERS[L]].c;
    this.gainT = b.w_ev(0) / 1000; this.verbAmt = b.w_ev(1) / 1000; this.lpT = b.w_ev(2) / 1000;
    this.hissT = (b.w_ev(3) + (this.tape ? 250 * b.w_ev(23) / 1000 : 0)) / 1000; this.windT = b.w_ev(4) / 1000; this.windFT = b.w_ev(5) / 1000; this.rumT = b.w_ev(6) / 1000; this.subAm = b.w_ev(7);
    // (TAPE's extra hiss follows the music too: w_ev(23), the textures' share, never alone)
    const cents = Math.round(b.w_ev(8) * 100 / 4096 * (this.tape ? 2 : 1));
    if (cents !== this.drift) { this.drift = cents; for (const L in this.inst) this.inst[L].w.k_global(3, cents); }
    const F = FXW[w]; this.verb.set(F.rt * (0.5 + 0.5 * this.mSpace) * (this.shimmer ? 1.3 : 1), F.damp, F.pre);
    // what the screen shows
    const step = b.w_ev(11), pn = b.w_ev(22), plan = [], planLen = [];
    for (let i = 0; i < pn; i++) { plan.push(SECS[b.w_plan_sec(i)]); planLen.push(b.w_plan_len(i)); }
    const prog = []; for (let i = 0, np = b.w_b(13); i < np; i++) { const c = b.w_prog(i); prog.push([(c << 24) >> 24, (c >> 8) & 255]); }
    this.port.postMessage({ t: 'step', notes, info: {
      world: WORLDS[w], worldQ: b.w_b(1) >= 0 ? WORLDS[b.w_b(1)] : null, piece: b.w_b(2), kind: b.w_b(3), hold: !!b.w_b(4), fade: !!b.w_b(5), faded: !!b.w_b(6), lift: b.w_b(7),
      req: { rise: b.w_b(8), calm: b.w_b(9), breath: b.w_b(10), void: b.w_b(11) }, chordI: b.w_b(12), prog,
      seed: code(b.w_seedv()), frisson: b.w_ev(9), bar: b.w_ev(10), step, sec: SECS[b.w_ev(12)], key: b.w_ev(13), mode: b.w_ev(14), chord: b.w_ev(15), chordQ: b.w_ev(16),
      e: b.w_ev(17), bpm, secBar: b.w_ev(19), secLen: b.w_ev(20), planAt: b.w_ev(21), plan, planLen,
      g: LAYERS.map((_, L) => b.w_g(L)) } });
    return spb;
  }
  process(_, outputs) {
    const out = outputs[0], OL = out[0], OR = out[1] || out[0], n = OL.length;
    OL.fill(0); OR.fill(0);
    const dB = (x) => Math.pow(10, (x || 0) / 20), F = FXW[this.world];
    for (let off = 0; off < n; off += BLOCK) {
      const m = Math.min(BLOCK, n - off);
      if (this.playing) { this.until -= m; while (this.until <= 0) this.until += this.fire(); }
      for (let i = this.offs.length - 1; i >= 0; i--) {
        const o = this.offs[i]; o.at -= m;
        if (o.at <= 0) { if (o.sub) { if (this.sub.n === o.n) this.sub.gate = 0; } else if (o.at > -1e8) o.w.k_note(o.n, 0, 0); this.offs.splice(i, 1); }
      }
      const S = this.sends || (this.sends = { dl: new Float32Array(BLOCK), dr: new Float32Array(BLOCK), rv: new Float32Array(BLOCK) });
      S.dl.fill(0); S.dr.fill(0); S.rv.fill(0);
      // the layers, each glides to its level over the block (the brain's fades: no step)
      for (const Ln of LAYERS) this.lvl[Ln] += (this.lvlT[Ln] - this.lvl[Ln]) * 0.08;
      if (this.dr && this.drKit) {
        const g = this.mg('DRUMS') * this.lvl.DRUMS * 0.9 * dB(this.vol.DRUMS), sp = (this.space.DRUMS ?? 1) * this.mSpace;
        const buf = new Float32Array(this.dr.memory.buffer, this.dr.k_render(), BLOCK * 2);
        let pk = 0;
        for (let i = 0; i < m; i++) {
          const a = buf[2 * i] * g, c = buf[2 * i + 1] * g;
          OL[off + i] += a; OR[off + i] += c; S.dl[i] += a * F.ds * sp; S.dr[i] += c * F.ds * sp; S.rv[i] += (a + c) * 0.5 * F.rs * sp; pk = Math.max(pk, Math.abs(a));
        }
        this.peaks.DRUMS = Math.max(pk, (this.peaks.DRUMS || 0) * 0.94);
      }
      for (const Ln of SYN) {
        const it = this.inst[Ln]; if (!it) continue;
        const buf = new Float32Array(it.w.memory.buffer, it.w.k_render(), BLOCK * 2);
        const lv = this.lvl[Ln], q = lv * lv;     // (the brain's level is per mille of its place: its square, 40 log10, as the FM-1)
        const [l0, ds0, rs0, pan] = MIX[Ln], g = this.mg(Ln) * l0 * (it.trim || 1) * dB(this.vol[Ln]) * q, gl = g * (1 - pan * 0.5), gr = g * (1 + pan * 0.5);
        const sp = (this.space[Ln] ?? 1) * this.mSpace, ds = ds0 * sp, rs = rs0 * sp * (0.6 + 0.6 * (this.verbAmt || 0.6));
        // its filter: the brain's (per mille: 150 Hz .. 19 kHz), its tone ceiling, the hand's (left darker, right thinner)
        const fl = this.fl[Ln], uf = this.flt[Ln] || 0;
        let fc = 150 * Math.pow(2, (fl.c / 1000) * 7);
        if (it.tone) fc = Math.min(fc, it.tone);
        if (uf < 0) fc *= Math.pow(2, uf * 6);
        const useLp = fc < 18000; if (useLp) fl.lp.set(fc, false);
        const useHp = uf > 0.02; if (useHp) fl.hp.set(20 * Math.pow(60, uf), true);
        let pk = 0;
        if (g > 1e-6 || it.ring) {
          it.ring = g > 1e-6 ? 8 : it.ring - 1;      // (a few blocks more for a filter's tail)
          // its guard: a sound far louder than its calibration (a bowed model pushed hard at the peak, say) is held down
          // at once and let back over a second or two; the mix's own swells stay well under it
          const TL = this.tl || (this.tl = new Float32Array(BLOCK)), TR = this.tr || (this.tr = new Float32Array(BLOCK));
          let raw = 0;
          for (let i = 0; i < m; i++) {
            let a = buf[2 * i], c = buf[2 * i + 1];
            if (useLp) { a = fl.lp.run(a, 0); c = fl.lp.run(c, 1); } if (useHp) { a = fl.hp.run(a, 0); c = fl.hp.run(c, 1); }
            TL[i] = a; TR[i] = c; raw = Math.max(raw, Math.abs(a * gl), Math.abs(c * gr));
          }
          it.lim ??= 1;
          if (raw * it.lim > 0.3) it.lim = 0.3 / raw; else it.lim += (1 - it.lim) * 0.0015;
          const gl2 = gl * it.lim, gr2 = gr * it.lim;
          for (let i = 0; i < m; i++) {
            const yl = TL[i] * gl2, yr = TR[i] * gr2;
            OL[off + i] += yl; OR[off + i] += yr;
            S.dl[i] += yl * ds; S.dr[i] += yr * ds; S.rv[i] += (yl + yr) * 0.5 * rs;
            pk = Math.max(pk, Math.abs(yl));
          }
        }
        this.peaks[Ln] = Math.max(pk, (this.peaks[Ln] || 0) * 0.94);
      }
      // the sub: a sine, slow in and out; DARK's swelling (a 5-second wave)
      { const s = this.sub, inc = 2 * Math.PI * s.f / sampleRate, g = (this.subLvl ?? 0) * dB(this.vol.LOW); let pk = 0;
        if (s.gate || s.env > 1e-4) for (let i = 0; i < m; i++) {
          s.env += ((s.gate ? s.vel * g : 0) - s.env) * (s.gate ? 0.0006 : 0.00015);
          s.ph += inc; if (s.ph > 6.283185307) s.ph -= 6.283185307;
          let am = 1; if (this.subAm) { s.amph += 2 * Math.PI / (5 * sampleRate); am = 0.67 + 0.25 * Math.sin(s.amph); }
          const y = Math.sin(s.ph) * 0.19 * s.env * am;
          OL[off + i] += y; OR[off + i] += y; pk = Math.max(pk, Math.abs(y));
        }
        this.peaks.SUB = Math.max(pk, (this.peaks.SUB || 0) * 0.94); }
      // the sound lab's audition
      if (this.aud && this.aud.on) {
        const a = this.aud, spb = sampleRate * 60 / 70 / 4;
        a.t -= m;
        if (a.t <= 0) {
          const s = a.seq[a.k % a.seq.length];
          if (s === 0) { for (const h of a.held) a.w.k_note(h, 0, 0); a.held = []; }
          else if (s) { const ns = Array.isArray(s) ? s : [s]; for (const h of a.held) a.w.k_note(h, 0, 0); for (const x of ns) a.w.k_note(x, 95, 1); a.held = ns; }
          a.k++; a.t += spb;
          if (a.k > a.seq.length + 24) { for (const h of a.held) a.w.k_note(h, 0, 0); a.on = false; }
        }
        const buf = new Float32Array(a.w.memory.buffer, a.w.k_render(), BLOCK * 2);
        for (let i = 0; i < m; i++) { const l = buf[2 * i] * 0.5, r = buf[2 * i + 1] * 0.5; OL[off + i] += l; OR[off + i] += r; S.rv[i] += (l + r) * 0.2; }
      }
      // the textures, the echo, the reverb, the master's low-pass, its gain, the limiter
      this.hiss += (this.hissT - this.hiss) * 0.02; this.wind += (this.windT - this.wind) * 0.02; this.rum += (this.rumT - this.rum) * 0.02; this.windF += (this.windFT - this.windF) * 0.02;
      this.lpV = (this.lpV ?? 0) + (((this.lpT ?? 0)) - (this.lpV ?? 0)) * 0.05;
      const mlpOn = this.lpV > 0.01; if (mlpOn) this.mlp.set(20000 * Math.pow(2, -this.lpV * 6), false);
      const wf = 2 * Math.sin(Math.PI * (250 + 1750 * this.windF) / sampleRate);
      const dt = Math.min(this.dl[0].length - 2, Math.round(sampleRate * 60 / this.bpm * F.dly)), D = this.dl, dlen = D[0].length;
      if (this.rum > 0.001) this.rph += m * 2 * Math.PI / (20 * sampleRate);
      const rAm = 0.75 + 0.25 * Math.sin(this.rph);
      for (let i = 0; i < m; i++) {
        let l = OL[off + i], r = OR[off + i];
        if (this.hiss > 0.001 || this.wind > 0.001 || this.rum > 0.001) {
          this.nz = (this.nz * 1664525 + 1013904223) >>> 0; const x = this.nz / 2147483648 - 1;
          this.hz += (x - this.hz) * 0.25; const hp = x - this.hz;                           // (the hiss: its top)
          this.wl += wf * this.wb; this.wb += wf * (x - this.wl - 0.5 * this.wb);              // (the wind: a band, Q 2)
          this.b1 += (x - this.b1) * 0.008; this.b2 += (this.b1 - this.b2) * 0.016;           // (the rumble: brown, ~100 Hz)
          const y = hp * this.hiss * 0.012 + this.wb * this.wind * 0.05 + this.b2 * 8 * this.rum * 0.09 * rAm;
          l += y; r += y;
        }
        // the echo: ping-pong, its feedback low-passed
        const rd = (this.dw - dt + dlen) % dlen, el = D[0][rd], er = D[1][rd];
        this.dlz[0] += (er - this.dlz[0]) * 0.35; this.dlz[1] += (el - this.dlz[1]) * 0.35;
        D[0][this.dw] = S.dl[i] + this.dlz[0] * F.fb; D[1][this.dw] = S.dr[i] + this.dlz[1] * F.fb; this.dw = (this.dw + 1) % dlen;
        let rin = S.rv[i] + (el + er) * 0.15;
        if (this.shimmer) rin += this.oct.run(this.lastV || 0) * 0.45;
        const [vl, vr] = this.verb.run(rin); this.lastV = (vl + vr) * 0.5;
        l += el * 0.5 + vl * 1.1; r += er * 0.5 + vr * 1.1;
        if (mlpOn) { l = this.mlp.run(l, 0); r = this.mlp.run(r, 1); }
        this.gain += (this.gainT * 0.5 - this.gain) * 0.00004;    // (the master: the peak about -14 dB RMS, the dawn -37, as the FM-1)
        l *= this.gain; r *= this.gain;
        const pk = Math.max(Math.abs(l), Math.abs(r)) * this.lim;           // (a soft limiter: down at once, back over a second)
        if (pk > 0.9) this.lim *= 0.9 / pk; else this.lim += (1 - this.lim) * 0.00002;
        l = Math.tanh(l * this.lim * 1.05); r = Math.tanh(r * this.lim * 1.05);
        OL[off + i] = l; OR[off + i] = r;
        this.scope[this.sw] = (l + r) * 0.5; this.sw = (this.sw + 1) % 1024;
      }
    }
    this.since += n;
    if (this.since > 1600) { this.since = 0; const s = new Float32Array(256); for (let i = 0; i < 256; i++) s[i] = this.scope[(this.sw + i * 4) % 1024]; this.port.postMessage({ t: 'scope', s, peaks: this.peaks }); }
    return true;
  }
}
registerProcessor('abyss', Abyss);
