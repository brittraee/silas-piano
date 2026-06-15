# CLAUDE.md — Silas's Piano

Context for Claude Code working in this repo.

## What this is
A single-file, offline web app that teaches a young hyperlexic child (Silas, 3) to play
melodies on his physical toy piano. The iPad app mirrors the toy and runs the guided
"Follow the glow" mode. Everything lives in `index.html` — no build step, no framework,
no dependencies at runtime (tests use jsdom as a devDependency only).

Three instruments, switchable from the top bar: **Piano** (8 keys, mirrors the toy),
**Kalimba** (17-tine thumb piano), and **Drums** (5 synthesized percussion pads, free-play
only — no follow mode). Pitched songs are shared across piano + kalimba — see Song data format.

## The hardware it mirrors (important constraints)
- Toy: **Baby Einstein × Hape "Magic Touch" piano** — flat wooden surface, touch-sensitive
  zones, **no physical keys**.
- It has **8 playable color zones = a one-octave C major scale**, do→do.
- **Leftmost key = low C = "do"** (confirmed against the actual unit).
- Key positions are 1-based, left→right: `1=C 2=D 3=E 4=F 5=G 6=A 7=B 8=C(high)`.
- The 8 colors are matched to *his specific unit* (they vary between units):
  `1 red · 2 orange · 3 yellow · 4 green · 5 teal · 6 sky-blue · 7 blue · 8 pink`
  CSS vars `--k1..--k8` in `index.html` hold these — keep them in sync with the toy.
- Reviewers note the toy is tuned ~½ step flat with inconsistent printed colors, so the app
  is the source of truth for pitch/labels, **anchored on position number + letter, not color.**

## Design priorities (do not regress)
- **No fail state.** Wrong taps still sound the note; they just don't advance. No scolding,
  no red X. A wrong tap instead **nudges the glowing target** (a one-shot bounce, `.nudge`)
  to redirect attention — never a shake on the wrong key. This is deliberate for a toddler /
  ADHD-friendly use.
- **Label difficulty is user-controlled** via the ABC chip: color-only → letters → numbers → solfège.
- Calm, not overstimulating. `prefers-reduced-motion` is respected (kills confetti + pulse).
- Big touch targets, full-screen on iPad (Add to Home Screen), works offline.
- iOS audio requires a user gesture → the **start gate** exists to unlock `AudioContext`. Keep it.
- No `localStorage`/`sessionStorage` if this is ever opened inside an Artifact viewer; plain
  GitHub Pages is fine with storage, but current app keeps all state in memory.

## Song data format
Songs are a plain array near the top of the `<script>` in `index.html`:

```js
{ id:'hcb', name:'Hot Cross Buns', notes:[3,2,1, 3,2,1, 1,1,1,1, 2,2,2,2, 3,2,1] }
```

- `notes` = key positions 1..8 (see mapping above). That's the whole contract — instrument-agnostic.
- Optional `beta:true` renders a small "beta" badge (used where the transcription is unverified).
- To add/fix a song, edit only this array. Tests will validate range + completability.
- **Kalimba mapping:** song positions 1..7 → the kalimba's lowest do→ti tines, position 8 → the
  next C up (`do` one octave higher). Songs only use positions 1..8, so every note has a tine.
- **Kalimba-only songs** (`kal:true`) carry `tines:[…]` instead of `notes` — indices 0..16 into
  `TINES`. Used for melodies wider than one octave (e.g. Happy Birthday, do=C6) that the 8-key
  piano can't play. They render only in kalimba view; follow-mode matches `el.dataset.tidx`.

## Architecture (all in index.html)
- `NOTES[1..8]` — piano: position → `{n, sol, f}` (letter, solfège, frequency in Hz).
- `TINES[]` — kalimba: 17 tines in ascending-pitch order, each `{num, dots, n, sol, f, c, songPos}`.
  `songPos` links a tine back to a song position (1..8) or `null`; `c` is the dot color class.
- `KORDER` — physical left→right tine order (lowest tine centered, zig-zagging outward).
- `SONGS[]` — the shared song list above.
- Web Audio synth in `playNote(freq, kind)` — `kind` `'piano'` (triangle + octave sine) or
  `'kalimba'` (brighter sine + faster decay). Takes a frequency, not a position.
- `playDrum(kind)` + `noiseBuf(dur)` — fully synthesized percussion (no audio files): `mid` kick,
  `edge` rim/snare, `cym` cymbal, `jing` jingle, `tri` triangle. Free-play only.
- `buildPiano()` / `buildKalimba()` / `buildDrums()` render the active instrument into `#stage`;
  `setView(v)` switches between them and rebuilds. `posToEl{}` maps song position 1..8 and
  `tineToEl{}` maps tine index 0..16 → the live DOM element, so glow/nudge targeting works for
  normal songs (either instrument) and kalimba-range songs.
- Follow-mode reducer lives in `onTap(el, kind)`. Sequence helpers `curSeq()` / `seqElAt(i)` /
  `tapMatches(el)` unify normal (`songpos`) and kalimba-range (`tidx`) songs: correct→advance +
  dots + target glow; wrong→`nudgeTarget()`; complete→celebrate→loop. Guards taps during the
  celebration window (`idx >= curSeq().length`). `onDrum(kind, el)` is the free-play drum handler.
- `renderSongbar()` rebuilds the song chips per view (hidden on drums; kalimba-only songs shown
  only in kalimba view).
- **Telemetry** (`logEv(ev,data)`): appends events (taps w/ correct flag, song_start/_done, drum,
  view, session_start) to `localStorage['silas_telemetry']`, capped at 5000, fully wrapped in
  try/catch so it never breaks play. **Parent gate:** a 1.5s long-press on the top-bar title
  (`openExport()`) opens an overlay with JSON/CSV download + Clear. Local only, no network.
- `window.__SILAS` is a test hook exposing `{SONGS, NOTES, TINES, KORDER, DRUMS, setView,
  startSong, goFree, onTap, onDrum, playDrum, renderSongbar, logEv, state, posToEl, tineToEl}`.
  Keep it; the DOM test depends on it.

## Tests
```
npm install          # jsdom (dev only)
npm test             # logic suite + real-DOM (jsdom) suite
npm run serve        # python3 http.server on :8000 for manual testing
```
- `test/test_logic.js` — parses SONGS/NOTES from the HTML, validates ranges, simulates the
  reducer (perfect play completes; wrong notes hold position).
- `test/test_dom.js` — loads the real app in jsdom, stubs Web Audio (incl. buffer source + param
  ramps for drums), dispatches taps via the live `posToEl`/`tineToEl` maps. Asserts start gate,
  label toggle, follow-mode on **piano and kalimba**, the **kalimba-range** Happy Birthday flow
  (tine-index targeting, hidden on piano, drops to free on view switch), and **drums** (5 pads,
  songbar/label hidden, taps don't throw). No-fail invariants checked throughout (no `wrong` class).
- Both resolve `index.html` from repo root regardless of cwd.

## Deploy (iPad target)
**Live:** https://brittraee.github.io/silas-piano/ — public GitHub Pages repo `brittraee/silas-piano`,
served from `main` / root over https.
- **Update = push:** edit files → commit → `git push`; Pages auto-rebuilds in ~30–60s.
- On the iPad: open the live URL in Safari → Share → **Add to Home Screen**. Re-add after an
  icon change (iOS snapshots the icon at add-time).
- https here is what unlocks the future mic-calibration feature (getUserMedia) and a service
  worker (not yet added — the next lever if cold-launch still isn't instant).
- `npm run serve` (LAN http on :8000) still works for quick local testing, but the iPad should
  use the Pages URL so launch no longer depends on the Mac being awake.

PWA assets: `manifest.webmanifest` + `icon-152/180/512.png` (generated from `icon.svg` via
`rsvg-convert`); `apple-touch-icon` links live in `<head>`.

## Roadmap / next features
1. **Compose & save** — child taps a sequence; app plays it back and adds it as a new card.
   (Avoid localStorage if Artifact-compatibility matters; otherwise fine on Pages.)
2. **Calibrated listen mode (experimental)** — use the mic to detect the *physical* toy.
   Standard pitch detection is unreliable on this toy (½-step flat, noisy speaker, room noise).
   Plan: a one-time **calibration** where Silas presses each of the 8 keys and the app records
   that key's *actual* frequency (autocorrelation / YIN), then matches live input against his
   8 measured pitches instead of textbook ones. Monophonic only; frame accuracy as "approximate."
3. Optional: lock orientation, a parent gate on settings, simple session progress.
4. **Marimba / xylophone timbres** — parked. Discussed but never built; would be a few
   oscillator/envelope presets + a timbre switcher. Kalimba already gives timbre contrast.

Done: usage telemetry (local + parent-gated export), drums, 4 new piano songs (London Bridge,
Jingle Bells, Row Your Boat, Rain Rain Go Away), Happy Birthday on kalimba.

## Style notes for edits
- Keep it a single self-contained `index.html`. No frameworks, no runtime deps.
- Preserve the no-fail-state and reduced-motion behaviors in any refactor.
- If you change key colors, update both the `--k1..--k8` CSS vars and the confetti color list.
