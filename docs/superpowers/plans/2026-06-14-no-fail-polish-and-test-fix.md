# No-Fail Polish + Test Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wrong taps purely redirective (never scolding) and restore the broken test suite, locking in the no-fail behavior with tests.

**Architecture:** Two contained changes to a single-file vanilla app. First restore `npm test` by moving the two test files into the `test/` folder they already expect. Then, via TDD, replace the wrong-tap shake with a positive "nudge the glowing target" cue and guard the post-win celebration window so taps aren't evaluated.

**Tech Stack:** Single-file HTML/CSS/vanilla JS (`index.html`), Node test scripts, jsdom (dev-only).

> **Git note:** This directory is **not a git repo yet**. The commit steps below are optional. If you want version control (and the documented GitHub Pages deploy path later), run `git init` once before starting; otherwise skip every "Commit" step. Nothing else in the plan depends on git.

---

## File Structure

- `index.html` — the entire app. Modify: `onKey()` reducer (~lines 254-267), add a `nudgeTarget()` helper, swap the `.key.wrong`/`@keyframes shake` CSS (~lines 89-90) for a `.key.nudge` cue, and extend the existing `prefers-reduced-motion` block (~lines 105-108).
- `test/test_logic.js` — moved from repo root, unchanged. Resolves `../index.html`.
- `test/test_dom.js` — moved from repo root, then extended with 3 no-fail assertions.

---

## Task 1: Restore the test suite

**Files:**
- Move: `test_logic.js` → `test/test_logic.js`
- Move: `test_dom.js` → `test/test_dom.js`

Both files already read `path.join(__dirname, '..', 'index.html')` and `package.json` already runs `node test/test_logic.js && node test/test_dom.js`. They just need to live in `test/`. No code edits in this task.

- [ ] **Step 1: Create the folder and move both test files**

```bash
cd /Users/brittneyraee/Downloads/SilasMusicApp
mkdir -p test
mv test_logic.js test/test_logic.js
mv test_dom.js test/test_dom.js
```

- [ ] **Step 2: Install the dev dependency (jsdom)**

Run: `npm install`
Expected: jsdom installs, `node_modules/` present, no errors.

- [ ] **Step 3: Run the suite to confirm the baseline is green**

Run: `npm test`
Expected: PASS — logic suite prints `ALL PASS ✅`, DOM suite prints `DOM E2E ALL PASS ✅`. This baseline still reflects the *old* shake behavior; Task 2 changes it.

- [ ] **Step 4: Commit (optional — only if you ran `git init`)**

```bash
git add -A
git commit -m "fix: move tests into test/ so npm test runs"
```

---

## Task 2: No-fail polish (remove shake → nudge the target, guard the win window)

**Files:**
- Modify: `index.html` — `onKey()`, new `nudgeTarget()`, CSS
- Test: `test/test_dom.js`

The reducer keeps its existing contract (wrong tap sounds the note, does not advance `idx`). We change only the *feedback*: no shake; instead the glowing target gets a one-shot bounce. We also early-return from the follow branch once the song is complete so taps during the ~2.6s celebration aren't evaluated.

- [ ] **Step 1: Write the failing assertions**

In `test/test_dom.js`, locate the existing wrong-tap block (the lines around `tap(keyByPos(wrongPos));` / `'wrong tap via DOM does not advance'`). Immediately **after** that `ok(...)` line, add:

```js
// no-fail: wrong tap must not scold and must keep guiding
ok(d.querySelector('.key.wrong')===null,'wrong tap adds no "wrong"/shake class');
ok(keyByPos(hcb.notes[0]).classList.contains('target'),'target key still glows after a wrong tap');
```

Then, **after** the existing completion block (after the `'completion message shown'` assertion, before the "back to free" section), add:

```js
// no-fail: tapping during the celebration window must not be flagged wrong
tap(keyByPos(wrongPos));
ok(d.querySelector('.key.wrong')===null,'tap during celebration is not flagged wrong');
```

- [ ] **Step 2: Run the DOM suite to verify the new assertions FAIL**

Run: `node test/test_dom.js`
Expected: FAIL — `wrong tap adds no "wrong"/shake class` fails, because the current `onKey` adds the `wrong` class on a mismatched tap.

- [ ] **Step 3: Rewrite `onKey()` and add `nudgeTarget()` in `index.html`**

Replace the current `onKey` function (the block starting `function onKey(p){` and ending at its closing `}`, ~lines 254-267):

```js
function onKey(p){
  initAudio(); playNote(p); pressVisual(p);
  if(mode==='follow' && song){
    if(idx>=song.notes.length) return;        // celebration window: free play, no scolding
    if(p===song.notes[idx]){
      keyEls[p].classList.remove('target');
      idx++;
      updateDots();
      if(idx>=song.notes.length){ finishSong(); }
      else { showTarget(); }
    } else {
      nudgeTarget();                          // redirect attention to the glowing key
    }
  }
}
function nudgeTarget(){
  if(!song || idx>=song.notes.length) return;
  const k=keyEls[song.notes[idx]];
  k.classList.remove('nudge');
  void k.offsetWidth;                          // reflow so the one-shot animation replays
  k.classList.add('nudge');
  setTimeout(()=>k.classList.remove('nudge'),450);
}
```

- [ ] **Step 4: Swap the shake CSS for the nudge cue in `index.html`**

Find and **delete** these two lines (~89-90):

```css
  .key.wrong{animation:shake .3s;}
  @keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
```

Replace them with:

```css
  .key.nudge{animation:nudge .45s ease;}
  @keyframes nudge{0%,100%{transform:translateY(0);}40%{transform:translateY(-8px);}70%{transform:translateY(0);}}
```

Then find the existing reduced-motion block (~105-108):

```css
  @media (prefers-reduced-motion: reduce){
    .key.target::after{animation:none; opacity:.95;}
    .confetti{display:none;}
  }
```

Add a `.key.nudge` fallback inside it so reduced-motion gets a static brighten instead of a bounce:

```css
  @media (prefers-reduced-motion: reduce){
    .key.target::after{animation:none; opacity:.95;}
    .key.nudge{animation:none; filter:brightness(1.3);}
    .confetti{display:none;}
  }
```

- [ ] **Step 5: Run the full suite to verify it passes**

Run: `npm test`
Expected: PASS — both suites green, including the 3 new assertions. The pre-existing `wrong tap via DOM does not advance` assertion still passes (the reducer still holds position on a wrong tap).

- [ ] **Step 6: Manual check on iPad (LAN-IP server already running)**

On the Home-Screen app: start a song, tap a wrong key → note sounds, **no shake**, the glowing key gives a brief bounce. Finish a song, then tap during the cheer → note sounds, **no shake**.

- [ ] **Step 7: Commit (optional — only if you ran `git init`)**

```bash
git add -A
git commit -m "feat: no-fail wrong-tap cue + guard celebration window"
```

---

## Acceptance

- `npm test` → logic + DOM suites green, including: wrong tap adds no `wrong` class, target persists after a wrong tap, and a tap during the celebration window isn't flagged.
- On-device: wrong taps never shake; the glowing target bounces to redirect; finishing then tapping during the cheer produces no shake.
- No regressions: wrong taps still sound and still don't advance; dots, completion message, free-play return, and reduced-motion behavior unchanged.
