# SPDX-License-Identifier: GPL-3.0-only
# ABYSS web: data/curation.json (the FM-1's own picks, tools/abyss/curation.json in the firmware, then the community's
# sounds that suit each world and layer, chosen from data/scan.json: slow or held, dark or airy) and data/kits.json
# (SIREN's kits that ABYSS's worlds use). Each name is checked against the scan (every sound the site can play).
#   python3 tools/make_data.py FIRMWARE_DIR SIREN_KITS_JSON
import json, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fw, kitsrc = sys.argv[1], sys.argv[2]
fm1 = json.load(open(os.path.join(fw, 'tools/abyss/curation.json')))
scan = {(s['bank'], s['engine'], s['preset']) for s in json.load(open(os.path.join(ROOT, 'data/scan.json')))}
COMMUNITY = {
  'CINEMATIC': {
    'DRONE': ['ghoulbox/STRINGS & REEDS:STRING MACH', 'melodee/PROPHET:LOW STRINGS', 'ghoulbox/FM6 DUNGEON:DARK STRINGS'],
    'PAD': ['melodee/PROPHET:REVERBERANT STRING', 'melodee/PROPHET:OLD STRING MACHINE', 'ghoulbox/PADS & HORNS:FROST STR', 'melodee/CZ-1:STRINGS 2', 'obervave/OBERVAVE:PWM STRING', 'mutable/VELVET KEYS:KEYS STILLNESS'],
    'LOW': ['ghoulbox/FM6 DUNGEON:DARK STRINGS', 'ghoulbox/STRINGS & REEDS:MOURN HORN', 'mutable/ROUND BASS:VELVET DUSK'],
    'MELO': ['ghoulbox/FM6 DUNGEON:LOFI FLUTE', 'ghoulbox/RECORDINGS:TENOR RECORD', 'obervave/OBERVAVE:SOFT FLUTE', 'ghoulbox/ORGANS:TOWER FLUTE'],
    'BELL': ['frodhes/RHODES:DREAM', 'frodhes/RHODES:EARLY FELT', 'fimba/KALIMBA:BRONZE BELLS', 'frodhes/VIBES:VIBES', 'ghoulbox/PLUCKED:DUNGEON HARP'],
    'SWELL': ['ghoulbox/CHOIRS:MONKS', 'ghoulbox/FM6 DUNGEON:GLASS CHOIR', 'mutable/SINE CHOIR:SLOW HALO', 'ghoulbox/FM6 DUNGEON:FRENCH HORN', 'ghoulbox/RECORDINGS:REN ORGAN'],
  },
  'COSMIC': {
    'DRONE': ['tonitor/BAYAREA:DRONE 1', 'tonitor/HIVE:DRONE 1', 'obervave/OBERVAVE:SPACEDRONE', 'mutable/PLAITS HARMONIC:DEEP SPECTRUM', 'tonitor/HIVE:GROUND 1'],
    'PAD': ['mutable/SPECTRAL BLOOM:BLOOM HONEY', 'mutable/MELLOW DRIFT:MELLOW WILLOW', 'melodee/PROPHET:UNICORN DREAMS', 'obervave/OBERVAVE:SLOW SWEEP', 'tonitor/BAYAREA:SWELL 1', 'mutable/PLAITS HARMONIC:BRONZE BLOOM', 'melodee/PROPHET:HOLLOW DREAMS'],
    'LOW': ['mutable/ROUND BASS:VELVET LAGOON', 'obervave/OBERVAVE:NIGHTDRIVE', 'mutable/SATIN MORPH:CEDAR BASS'],
    'MELO': ['obervave/OBERVAVE:FIFTHS LD', 'obervave/OBERVAVE:SOLO LEAD', 'mutable/SATIN MORPH:HOLLOW REED', 'tonitor/ANIMA:VOYAGE 1'],
    'BELL': ['melodee/PROPHET:ANTIQUE BELL', 'fimba/KALIMBA:GLASS TINES', 'fimba/KALIMBA:SHIMMER GLASS', 'obervave/OBERVAVE:ICE BELLS', 'frodhes/RHODES:GLASS BELL'],
    'SWELL': ['mutable/SINE CHOIR:WARM MEADOW', 'tonitor/ANIMA:GOLDEN 1', 'melodee/PROPHET:TAARICHOIR', 'obervave/OBERVAVE:AIR CHOIR', 'ghoulbox/CHIP WINDS:CASIO CHOIR'],
  },
  'DARK': {
    'DRONE': ['ghoulbox/CHOIRS:LOW DRONE', 'tonitor/CALIGULA:UNDERTOW 1', 'tonitor/FM OBJECTS:ABYSS 1', 'tonitor/CALIGULA:SPORE 2', 'ghoulbox/CAVE:CAVE WIND', 'melodee/PROPHET:METAL DRONESPACE'],
    'PAD': ['ghoulbox/PADS & HORNS:CRYPT PAD', 'tonitor/CALIGULA:VEIL 2', 'obervave/OBERVAVE:GHOST PAD', 'obervave/OBERVAVE:DARK PAD', 'melodee/PROPHET:80S HORROR STRINGS', 'tonitor/HIVE:WASH 1'],
    'LOW': ['ghoulbox/PADS & HORNS:DIRGE BASS', 'tonitor/HIVE:SUB 1', 'tonitor/FM OBJECTS:TIDE 1'],
    'MELO': ['ghoulbox/CHOIRS:WRAITH', 'ghoulbox/STRINGS & REEDS:MOURN HORN', 'tonitor/CALIGULA:LITANY 1', 'ghoulbox/GURDY:DRONE WHEEL'],
    'BELL': ['melodee/PROPHET:CLANGOROUS BELLS', 'melodee/PROPHET:OMINOUS BELLFALL', 'tonitor/FM OBJECTS:METAL 1', 'tonitor/HIVE:METAL 2', 'fimba/KALIMBA:DARK KALIMBA'],
    'SWELL': ['ghoulbox/CHOIRS:CRYPT CHOIR', 'ghoulbox/ORGANS:CATHEDRAL', 'ghoulbox/FM6 DUNGEON:PIPE ORGAN', 'tonitor/FM OBJECTS:REVERSE 1', 'tonitor/CALIGULA:CARRION 1'],
  },
}
def parse(k):
  bank, rest = (k.split('/', 1) if '/' in k else ('clipper', k))
  e, p = rest.split(':', 1); return bank, e, p
cur, bad = {}, 0
for w in ('CINEMATIC', 'COSMIC', 'DARK'):
  cur[w] = {}
  for L in ('DRONE', 'PAD', 'LOW', 'MELO', 'BELL', 'SWELL'):
    arr = list(fm1[w][L]) + COMMUNITY[w][L]
    for k in arr:
      if parse(k) not in scan: print('missing', w, L, k); bad += 1
    cur[w][L] = arr
json.dump(cur, open(os.path.join(ROOT, 'data/curation.json'), 'w'), indent=1)
src = json.load(open(kitsrc)); allk = {k['name']: k for v in src.values() for k in v}
kits = {w: [allk[n] for n in fm1[w]['KITS']] for w in cur}
json.dump(kits, open(os.path.join(ROOT, 'data/kits.json'), 'w'))
print('curation:', {w: sum(len(v) for v in cur[w].values()) for w in cur}, 'kits:', {w: [k['name'] for k in v] for w, v in kits.items()}, 'missing:', bad)
sys.exit(1 if bad else 0)
