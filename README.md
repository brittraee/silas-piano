# Silas's Piano 🎹

A single-file, offline web app that mirrors Silas's Baby Einstein × Hape **Magic Touch**
toy piano (8-key C-major scale, do→do) and runs a no-fail **Follow the glow** song mode.

Built for an iPad: tap a song, the right key glows and waits, he taps it, it advances —
with progress dots and a gentle cheer at the end. Labels toggle between color / letter /
number / do-re-mi so difficulty scales with him.

## Quickstart
```bash
npm install        # jsdom (tests only — the app itself has no runtime deps)
npm test           # logic + real-DOM (jsdom) suites
npm run serve      # http://localhost:8000  (open index.html on a device on the same Wi-Fi)
```

The app is entirely `index.html`. Open it directly, or serve it.

## Put it on the iPad
1. Push to GitHub with `index.html` at the repo root.
2. **Settings → Pages →** deploy from `main` / root.
3. Open the Pages URL in Safari → Share → **Add to Home Screen** (full-screen, offline, https).

## Edit songs
Songs are an array near the top of the `<script>` in `index.html`. Each note is a key
position `1..8` (`1=C … 8=high C`). Add or fix a song by editing that array only.

> **Ants Go Marching** is flagged `beta` — transcribed without a clean source. Verify by ear
> and correct its `notes`. See `CLAUDE.md` for details.

## More context
See **CLAUDE.md** for the hardware constraints, design rules (no fail state, reduced motion),
test descriptions, and the v2 roadmap (compose-and-save, calibrated mic listen mode).
