# Design: No-fail polish + test fix

**Date:** 2026-06-14
**App:** Silas's Piano (`index.html`, single-file)
**Status:** Approved for planning

## Goal

Two small, contained changes to the existing app:

1. **No-fail polish** — make wrong taps purely redirective, never scolding, so the app
   matches its stated "no fail state" philosophy.
2. **Fix the test suite** — `npm test` is currently broken; restore it and lock in the
   polish so it can't regress.

Out of scope this session: mic calibration, compose & save, Ants ear-check, orientation
lock, parent gate, git/Pages deploy. (LAN-IP local serving for iPad testing is already
running separately.)

---

## Section 1 — No-fail polish

### Problem

`onKey(p)` currently adds a `wrong` class on an incorrect tap, triggering a 0.3s shake
(`@keyframes shake`). A shake reads as a mild "no," which contradicts CLAUDE.md:
*"Wrong taps still sound the note; they just don't advance. No scolding, no red X."*

Separately, after a song completes, `finishSong()` waits ~2.6s before resetting `idx`.
During that window `idx >= notes.length`, so any tap falls into the wrong-note branch and
shakes — a "shake after winning" dead-zone.

### Decision — Approach A: redirect, don't reject

On a wrong tap in follow mode:
- The note still sounds (already the case — `playNote` runs before the follow logic).
- **Remove** the `wrong` shake entirely.
- The correct/target key gives a **one-shot attention pull** — a brief bounce/brighten —
  to draw the eye toward where to tap next. Positive guidance, zero negative signal.

This keeps the glowing target as the single teaching signal and stops the shake from
fighting it.

### Decision — celebration dead-zone guard

Guard `onKey` so that once the active song is complete (the ~2.6s cheer-and-loop window),
taps are treated as free play: they sound, but are **not** evaluated and **never** flagged.
Cleanest expression: early-return from the follow branch when `idx >= song.notes.length`.

### Changes (all in `index.html`)

- **`onKey(p)`** — replace the `else { ...add('wrong')... }` branch with a call to a small
  redirect cue on the current target key; add the `idx >= notes.length` guard so completed
  songs don't evaluate taps.
- **CSS** — remove (or stop using) `.key.wrong` + `@keyframes shake`; add a gentle,
  one-shot target-nudge animation. Must respect `prefers-reduced-motion` (no motion when
  reduced — fall back to a static brighten, consistent with the existing `.key.target`
  reduced-motion handling).
- No change to `playNote`, the synth, label modes, songs, or the start gate.

### What stays the same (do not regress)

- Wrong taps still produce sound and still do not advance `idx`.
- Steady target glow, dots, completion message, free-play return, reduced-motion behavior.

---

## Section 2 — Fix the tests

### Problem

`package.json` runs `node test/test_logic.js && node test/test_dom.js`, and both test files
read `path.join(__dirname, '..', 'index.html')` — both assume the tests live in a `test/`
subfolder. The files currently sit at repo root, so `npm test` fails on a missing path at
both ends. CLAUDE.md documents the intended `test/` layout.

### Decision

- Move `test_logic.js` and `test_dom.js` into `test/`. This matches `package.json`, the
  files' own `../index.html` paths, and the documented layout — no path edits needed.
- Verify `npm test` runs green (existing 12 DOM assertions + logic suite).

### New assertions (lock in the polish)

Add to `test/test_dom.js`:
1. A wrong tap in follow mode adds **no** `wrong` class to any key (and still doesn't
   advance `idx` — already covered, keep it).
2. A tap during the post-completion celebration window is **not** flagged as wrong
   (no `wrong` class), confirming the dead-zone guard.

The existing wrong-tap assertion (`idx` does not advance) remains valid under Approach A.

---

## Testing & acceptance

- `npm install && npm test` → all assertions pass (logic + DOM), including the 2 new ones.
- Manual on iPad via LAN-IP: in a song, tapping a wrong key sounds the note, shows no
  shake, and the target gives a gentle nudge; finishing a song then tapping during the
  cheer produces no shake.

## Risks / notes

- jsdom can't truly verify animation playback; the new assertions check for the **absence**
  of the negative `wrong` class rather than the presence of the positive cue. The positive
  cue is verified manually on-device.
- Not a git repo yet — spec is written to disk but not committed. Git init/commit deferred
  until explicitly requested.
