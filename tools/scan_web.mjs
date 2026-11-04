// SPDX-License-Identifier: GPL-3.0-only
// ABYSS web: every sound of every bank the site can play (Clipper's, the community's packs) measured for ambient, as
// the FM-1's tests/abyss/sound_scan.c measures its own: a minor chord held (A2 E3 C4) six seconds then let go. Its
// attack (s to half its peak), its sustain (the last two held seconds against the loudest), its brightness (spectral
// centroid, Hz), its loudness (dB). The drum engines are left out. -> data/scan.json
//   node tools/scan_web.mjs
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FS = 44100, BLOCK = 32, N = 2048;
const DRUMS = /DRUM|KIT|808|909|CR-78|SDS|KICK|SNARE|HAT|PERC|BYTEBEAT|ANIMAL/i;
const packs = JSON.parse(fs.readFileSync(path.join(ROOT, 'engines/packs/index.json'), 'utf8'));
const banks = [{ id: 'clipper', file: 'engines/clipper.wasm' }, ...packs.map((p) => ({ id: p.id, file: 'engines/packs/' + p.file, cat: p.catalog }))];
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let m = 2; m <= n; m <<= 1) { const a = -2 * Math.PI / m; for (let k = 0; k < n; k += m) for (let j = 0; j < m / 2; j++) { const wr = Math.cos(a * j), wi = Math.sin(a * j), u = k + j + m / 2, xr = re[u] * wr - im[u] * wi, xi = re[u] * wi + im[u] * wr; re[u] = re[k + j] - xr; im[u] = im[k + j] - xi; re[k + j] += xr; im[k + j] += xi; } }
}
const out = [];
for (const B of banks) {
  const mod = await WebAssembly.compile(fs.readFileSync(path.join(ROOT, B.file)));
  const inst = () => { const w = new WebAssembly.Instance(mod, {}).exports; w._initialize?.(); w.k_init(0); return w; };
  let cat = B.cat;
  if (!cat) { const w = inst(), n = w.k_catalog(); cat = JSON.parse(new TextDecoder().decode(new Uint8Array(w.memory.buffer, w.k_buffer(), n).slice())); }
  cat.engines.forEach((E, e) => {
    if (DRUMS.test(E.name)) return;
    E.presets.forEach((P, p) => {
      const w = inst(); w.k_preset(e, p); w.k_render(); w.k_render();
      const total = 9 * FS, buf = new Float32Array(total);
      for (let b = 0; b * BLOCK < total; b++) {
        if (b === 2) for (const n of [45, 52, 60]) w.k_note(n, 90, 1);
        if (b === Math.floor(6 * FS / BLOCK)) for (const n of [45, 52, 60]) w.k_note(n, 0, 0);
        const o = new Float32Array(w.memory.buffer, w.k_render(), BLOCK * 2);
        for (let i = 0; i < BLOCK && b * BLOCK + i < total; i++) buf[b * BLOCK + i] = (o[2 * i] + o[2 * i + 1]) * 0.5;
      }
      const rms = (a, z) => { let s = 0; for (let i = a; i < z; i++) s += buf[i] * buf[i]; return Math.sqrt(s / (z - a) + 1e-20); };
      const win = FS / 20; let pk = 0, att = -1;
      for (let x = 0; x + win < 6 * FS; x += win) pk = Math.max(pk, rms(x, x + win));
      for (let x = 0; x + win < 6 * FS; x += win) if (rms(x, x + win) >= pk / 2) { att = x / FS; break; }
      const held = rms(4 * FS, 6 * FS);
      let cen = 0, nw = 0;
      for (let x = FS; x + N <= 6 * FS; x += N * 6) {
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N; i++) re[i] = buf[x + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
        fft(re, im); let num = 0, den = 0;
        for (let k = 2; k < N / 2; k++) { const a = re[k] * re[k] + im[k] * im[k]; num += k * FS / N * a; den += a; }
        if (den > 1e-12) { cen += num / den; nw++; }
      }
      out.push({ bank: B.id, engine: E.name, preset: P, att: +att.toFixed(2), sus: +(held / (pk + 1e-12)).toFixed(2), cen: nw ? Math.round(cen / nw) : 0, db: +(20 * Math.log10(rms(FS, 6 * FS) + 1e-9)).toFixed(1) });
    });
  });
  process.stderr.write(`${B.id} done (${out.length})\n`);
}
fs.writeFileSync(path.join(ROOT, 'data/scan.json'), JSON.stringify(out));
console.log(`scan: ${out.length} sounds -> data/scan.json`);
