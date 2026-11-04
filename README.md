# ABYSS · ambient that writes itself
TRY HERE : https://isod89.github.io/abyss/
ABYSS composes endless ambient music in real time, and you sculpt it while it plays.

**Play it in your browser:** open this repository's GitHub Pages site (Chrome or Edge on a computer works best;
headphones or good speakers, a lot happens in the lows).

ABYSS is being made for the **FM-1**, as the sister of SIREN. This page is the web version: the FM-1's own brain
compiled to WebAssembly (the same seed plays the same pieces here and on the machine), the real sound engines of the
FM-1 firmwares compiled for the browser, and the controls of the FM-1 version as big knobs, pads and faders.

## Three worlds

- **CINEMATIC** (modern-classical and film ambient): 56–72 BPM, the chord loops of that music, strings and cello, a
  felt piano repeating one note across octaves, tape hiss, sometimes a clock's tick.
- **COSMIC** (space music, Berlin school): beatless half the time, a sequencer or a slow beat that enters late;
  lydian and major, sus and add9 chords; wind; the "lift" (the key moves a third and a new voice enters); the pitch
  drifting a few cents like an old analog synth.
- **DARK** (dark ambient and drone): no pulse; drones a semitone or a tritone apart, a sub at 27–45 Hz that breathes,
  rumble, distant struck metal, one rise of several minutes, rough clusters at the top, then the void (silence and the
  reverb's tail) and the decay. One dark piece in four is a tape loop played until it falls apart.

Pieces last 6 to 15 minutes and flow into each other, the next one in a nearby key.

## Built toward the chills

Each piece is built toward one moment, at 65–80 % of its length, combining at least three of the things research on
musical chills found (Sloboda 1991; Grewe et al. 2007; Guhn et al. 2007; Bannister & Eerola 2018): a long crescendo,
a breath of near-silence just before, a new voice entering, an unexpected chord, an appoggiatura on the melody's
highest note, the register opening at both ends, the theme coming back. The research notes and sources are in the
FM-1 firmware (`tools/abyss/RESEARCH.md`).

## The controls

- **The hands:** LIGHT (shadow to light: filters, register, and the harmonies of the next pieces), SPACE, DENSITY,
  TIME (slower to faster), TENSION (how rough the peak gets); the textures SHIMMER and TAPE
- **The gestures:** PEAK NOW, RISE, CALM, BREATH, LIFT, NEW THEME, NEW HARMONY, HOLD, VOID, NEXT PIECE, FADE.
  A gesture glows until ABYSS answers it, in its own time
- **The layers:** drums, drone, pad, low, melody, bells, swell; for each, its sound (‹ ›, ↻ by chance), keep it in
  the next pieces (◆), volume, filter, space, mute
- **The arc:** the piece's sections drawn as high as they are intense, and how long until the peak
- **Seeds:** the same seed in the same world plays the same set again

## Help build the sound bank

ABYSS picks each piece's sounds from its **sound bank**: for every world, a short list of sounds per layer.
Choosing that bank is the biggest job left before ABYSS ships on the FM-1.

1. Open the **Sound lab** tab, pick a world, listen (each sound plays as its layer plays it, with the world's slow
   envelopes), remove what doesn't fit, add what's missing.
2. Go back to **Play** and listen to ABYSS with your bank.
3. Press **Send my bank**: your bank, your name and your notes go straight to **sodwavecontact@gmail.com**
   (through the FormSubmit form service: no email app, no attachment needed). Or download it and email the file.

Everything you do stays in your browser until you press Send. No account, no tracking.

## Run it on your own computer

It is a static site: serve the folder with any web server, for example

```
python -m http.server 8780
```

then open http://localhost:8780/ (opening `index.html` directly from the disk does not work: browsers only load
the sound engines from a web server).

## Inside

- `engines/abyss-brain.wasm` ABYSS's brain: the FM-1 firmware's `abyss_brain.c`, compiled as it is
  (`tools/abyss/build_brain_wasm.sh` in the firmware; `tools/brain_identity.mjs` checks it gives the FM-1's notes)
- `js/worklet.js` the sound: the engines, the mix, the sub, the textures, the reverb (an AudioWorklet)
- `js/app.js` the page
- `data/curation.json` ABYSS's sound bank (`tools/make_data.py`) · `data/levels.json` its calibration, each sound
  played with the brain's own notes (`tools/level_web.mjs`) · `data/kits.json` its drum kits · `data/scan.json` every
  sound the lab can add, measured (`tools/scan_web.mjs`)
- `engines/clipper.wasm`, `engines/sloop.wasm` the sound engines of the Clipper and SLOOP firmwares for the FM-1
  (sources: https://github.com/isod89/clipper-fm1 and https://github.com/isod89/sloop-fm1)
- `engines/packs/` community sound modules (only used with "include community sound packs")
- `tools/engine_test.mjs` runs the sound engine outside the browser in every world and checks every control (Node.js)

## License

ABYSS is free software under the GNU General Public License v3.0 only (`LICENSE`), by Sodwave.
Parts of the FM synthesis code come from Music Synthesizer for Android (Apache-2.0, `LICENSES/`).

The community sound modules in `engines/packs/` are the work of their authors, under their own licenses:

| Module | Author | Version | License | Source | File |
|---|---|---|---|---|---|
| JIANT FM | juanjiant-bit | 0.9.9-beta4a+c5bd351 | GPL-3.0-only | https://github.com/juanjiant-bit/JIANT | `engines/packs/jiant-e971b3d9d8.wasm` |
| X0X | charlesvestal | 1.1.0+54194c5 | GPL-3.0-only | https://github.com/charlesvestal/fm1-x0x | `engines/packs/x0x-6c336ca558.wasm` |
| Melodee | keremimo | 1.4.5+c14912b | GPL-3.0-only | https://github.com/keremimo/melodee | `engines/packs/melodee-16709e3819.wasm` |
| OberVave | zvenson | 3.0.1 | GPL-3.0-only | https://github.com/zvenson/obervave | `engines/packs/obervave-b09865eb8f.wasm` |
| Mutable Dreams | Kid Bunka | v1.2 | GPL-3.0-only | https://github.com/kidbee85-beep/mutable-dreams | `engines/packs/mutable-3cb6b0997c.wasm` |
| Frodhes | Leonardo Mirabal | 0.9.4+bf859e4 | GPL-3.0-only | https://github.com/leonardoMirabal/frodhes | `engines/packs/frodhes-080c35a735.wasm` |
| FiMba-1 | jadamsowers | v0.6.1 | GPL-3.0-only | https://github.com/jadamsowers/fm1-fimba | `engines/packs/fimba-e6df86b9c5.wasm` |
| OPN-1 | putchdev | 2.0.0+3319da4 | GPL-3.0-only | https://github.com/putchdev/opn-1 | `engines/packs/opn1-a7a7257346.wasm` |
| Chipbox | Pasquale Barilla | 1.2.4+2cf4936 | GPL-3.0-only | https://github.com/pbarilla/chipbox | `engines/packs/chipbox-a981f637b0.wasm` |
| FOMAJAM | konsumer | 0.1.6+138c5d9 | GPL-3.0-only | https://github.com/konsumer/fomajam | `engines/packs/fomajam-0d6660efdf.wasm` |
| Tonitor | Nuno Zimas | build 68+0dccfca | GPL-3.0-only | https://github.com/nzimas/tonitor | `engines/packs/tonitor-5c03a09f1e.wasm` |
| Bigorna | Nuno Zimas | build 71+2ae17c5 | GPL-3.0-only | https://github.com/nzimas/bigorna | `engines/packs/bigorna-466422e01a.wasm` |
| GHOULBOX | Jason Persinger | 2.4 | GPL-3.0-only | https://github.com/jasonpersinger/ghoulbox-fm1-dungeon-synth | `engines/packs/ghoulbox-3b656b14c4.wasm` |
