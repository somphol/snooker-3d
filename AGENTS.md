# AGENTS.md — THE MAHOGANY ROOM · 3D SNOOKER

> Handoff for the next maintainer or agent. Rebuild detail is in
> [docs/REPRODUCTION.md](docs/REPRODUCTION.md); the technical map is
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 1. What this is

A static, three-file **3D snooker game**: `index.html`, `style.css` and one 3,589-line
IIFE in `script.js`, with **Three.js r128**, **OrbitControls** and **Cannon.js 0.6.2**
loaded from CDNs. The table is a 12 ft × 6 ft playing area rendered in metres; 22 balls
run on a 120 Hz fixed-step rigid-body simulation with cushion restitution, cloth drag,
rolling resistance and pocket capture. A referee engine enforces reds/colours, clearance
order, respotting, scratches, wrong-ball fouls, misses and 4–7 point penalties, and writes
a plain-English ruling for every stroke. A ghost-ball AI can take the other chair; the
career book, ruling history, mute state and interface text size persist in
`localStorage`. Audio is synthesised with Web Audio — there are no sound files.

It is **not** an official rules certification, not betting or real-money gambling, not
online multiplayer, not a native mobile app, and **not offline-capable**: the first load
needs the Three.js, OrbitControls and Cannon CDNs; Google Fonts is styling only. **Frame progress is not persisted** —
reloading starts a fresh Frame 01 — though career stats, rulings, mute and text size are.

Live copy: <https://somphol.github.io/snooker-3d/>. Local master:
`~/Projects/snooker-3d`. No version string is declared in the code and there is no git tag;
`CHANGELOG.md` is the release record. Latest source commit at the time of writing:
`9383e9c`.

## 2. Commands

```bash
cd ~/Projects/snooker-3d

# run — classic scripts, but a server is closer to production
python3 -m http.server 8000
open http://localhost:8000/

# built-in self-test: 15 checks, writes JSON into #selftest
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --use-angle=metal --mute-audio \
  --virtual-time-budget=12000 --timeout=30000 \
  --dump-dom "http://localhost:8000/?selftest=1" > /tmp/snooker-dom.html
grep -o '"passed": *[0-9]*' /tmp/snooker-dom.html
grep -o '"total": *[0-9]*' /tmp/snooker-dom.html

# one frame
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --use-angle=metal --mute-audio \
  --virtual-time-budget=10000 --timeout=25000 --window-size=1600,1000 \
  --screenshot=/tmp/snooker.png "http://localhost:8000/"

# console API (shipped): SNOOKER.rules, .balls, .app, .takeShot(), .newFrame()
# full match flow is driven through the UI; there is no CLI harness

# live probe
curl -s -o /dev/null -w '%{http_code}\n' https://somphol.github.io/snooker-3d/

# deploy — Pages serves the repository root of main; no workflow
git push origin main
```

Headless WebGL on this Mac needs `--use-angle=metal`. With `--disable-gpu` the renderer
throws and the loader shows **"Error creating WebGL context."** plus `BOOT ERROR` in the
self-test panel. There is no CI and no package manager. Evidence is in
[docs/TESTING.md](docs/TESTING.md).

## 3. Architecture

| File | Lines | Role |
| --- | ---: | --- |
| `index.html` | 353 | head/meta/fonts (1–32), stage and grain (33–36), loader (37–47), top bar (48–81), scoreboard (82–148), shot controls (149–224), status/toasts (225–246), modals (247–344), self-test panel (345), CDN scripts (347–352) |
| `style.css` | 1,439 | base/vars (1–91), loading (92–171), top bar (172–259), panels (260–340), scoreboard (341–632), controls (633–898), status/toast/banner (899–1038), modals (1039–1245), ruling history (1246–1307), responsive and reduced motion (1308–1439) |
| `script.js` | 3,589 | 16 numbered sections listed below |
| `favicon.svg` | — | house crest |
| `docs/social-card.png` | — | 1200 × 630 link preview |
| `STATE.md`, `state.json` | 86 / — | historical build receipt (not regenerated) |

`script.js` sections:

| § | Lines | Subject |
| ---: | --- | --- |
| 01 | 11–70 | constants: table, ball, pocket, shot, storage keys |
| 02 | 71–196 | `app`, `rules`, stats and persistence helpers |
| 03 | 197–267 | DOM references |
| 04 | 268–376 | synthesised audio |
| 05 | 377–1005 | Three.js foundation, textures, lights, room, table, cue, aim guide |
| 06 | 1006–1242 | Cannon world, balls, colliders, pocket hooks |
| 07 | 1243–1419 | referee engine (`resolveShot`) |
| 08 | 1420–1962 | aiming, cue, pointer tools, camera |
| 09 | 1963–2641 | charge/shot lifecycle, physics step, pockets, end of shot, respots, frame finish |
| 10 | 2642–2751 | AI opponent |
| 11 | 2752–2824 | frame reset, turn UI, mode switch |
| 12 | 2825–3115 | HUD, ball guide, spin pad, toasts, banner |
| 13 | 3116–3201 | modals, stats export/import |
| 14 | 3202–3272 | render loop |
| 15 | 3273–3457 | bindings, boot |
| 16 | 3458–3589 | self-test, `window.SNOOKER`, DOMContentLoaded |

Key paths:

- **Constants** — `R = 0.0300` (60 mm balls), `PLAY_L = 3.569`, `PLAY_W = 1.778`,
  `BAULK_X = -L + 0.737`, `D_RADIUS = 0.292`, pocket capture radii 0.061/0.064,
  `MAX_SHOT_SPEED = 8.2`, `MIN_SHOT_SPEED = 0.62` (`script.js:14–52`).
- **Boot** — `init()` (`script.js:3392`) checks the three globals, loads stats, rulings,
  mute and font scale, then `initThree()` (398), `initPhysics()` (1008), resets rules and
  balls, binds UI, racks Frame 01 and starts `tick()` (3204). A failure is written into
  the loader note and the self-test panel.
- **State** — `app` (`script.js:74`) holds phase, mode, camera/tool, aim, power, spin,
  elevation, sound, font scale, frame number, break high, shot and AI flags. `rules`
  (102) holds scores, current player, break, ball-on, reds remaining and frame-over.
  `balls[]`, `stats`, `rulingHistory` are module values.
- **Physics** — `initPhysics()` (1008) builds a Cannon world with gravity −9.82, SAP
  broadphase, 24 solver iterations, contact materials (ball–ball friction 0.055 /
  restitution 0.955, ball–cloth 0.42 / 0.03, ball–cushion 0.32 / 0.72), a cloth bed and
  six cushion boxes. `stepPhysics()` (2074) runs `world.step(1/120, dt, steps)` and adds
  cloth drag, spin decay and side-swerve.
- **Shot** — `takeShot()` (2013) freezes the target angle, sets linear/angular velocity
  from power and spin, applies elevation hop above 18°, starts the cue jab and enters
  `rolling`. `checkPockets()` (2118) captures against mouth centres; `ballsAtRest()`
  (2175); `endShot()` (2398) calls the referee, respots, writes the call and returns to
  `aiming`.
- **Referee** — `resolveShot(shot)` (1299) is the rules core. It takes
  `{potted, firstContact, cuePotted}`, mutates `rules`, and returns
  `{foul, reason, penalty, points, respot, cuePotted, endedBreak, turnChanged}`.
  `ballOnAfterTurn()` (1277), `lowestActiveColor()` (1261) and `valueOfOn()` (1273) keep
  the ball-on state coherent across reds, the free-colour phase and the clearance.
- **Respots** — `respotBall()` (2485) uses `findFreeSpot()` (2518): own spot, then the
  highest free colour spot, then a slide along the centre line. `respotCueBall()` (2539)
  returns the cue ball inside the D.
- **Aiming/camera** — `updateAimGuide()` (1430) computes the cue path, ghost ball, target
  line and tangent; `setTool()` (1869) switches Aim/Scene/Shot and preserves the Scene
  framing; `placeAimCamera()` (1846) and `updateAimCamera()` (1941) keep the aim camera
  stable while following the cue ball.
- **AI** — `aiChooseShot()` (2674) scores ghost-ball pots over every legal target and
  pocket with path checks, chooses power from distance, adds small aiming error, and
  falls back to a same-side safety. `scheduleAI()` (2644) waits 1.1 s, then 0.85 s before
  striking.
- **UI** — `updateUI()` (2827), `updateBallGuide()` (2874), `updateBallHighlights()`
  (2908), `updateStatus()` (2934), `drawSpinPad()` (2999), `toast()`/`banner()` (3093 /
  3101). Career modal, export and import are at 3116–3201.
- **Self-test** — `runSelfTests()` (3460) snapshots rules/balls/stats, runs 15 checks,
  restores state and writes JSON into `#selftest`. `window.SNOOKER` (3559) exposes the
  live objects and several mutating helpers.

## 4. Decisions and constraints

- **Three static files, no bundler.** `index.html` + `style.css` + `script.js` are the
  delivery format. Do not introduce npm, modules or a build step without a product
  decision; there is no pipeline to fall back on.
- **Libraries are pinned by CDN URL, not vendored.** `index.html:347–351` loads Three.js
  r128, OrbitControls r128 and Cannon 0.6.2 with no SRI. Changing any version requires
  re-running the self-test, a real break and the screenshots.
- **The network dependency is real.** The three script CDNs are required on a cold load;
  Google Fonts (Cormorant Garamond, Inter) only affects typography. Do not describe the
  game as offline-capable.
- **Metres are the world unit.** Table, ball, pocket and spot constants come from real
  dimensions; the balls are intentionally 60 mm instead of 52.5 mm for legibility. Do not
  "correct" the ball size without re-checking the rack, pockets and snap framing.
- **Physics and rules are separate layers.** Cannon decides where balls go;
  `resolveShot()` decides what the stroke means. Keep the referee callable with plain
  `{potted, firstContact, cuePotted}` objects — the self-test depends on that shape.
- **`rules` is the single source of truth for the turn.** Do not push score, break,
  ball-on or current-player changes directly from the HUD or AI; go through
  `resolveShot()` and `updateUI()`.
- **Counters live in `endShot`/`resolveShot`.** `stats.totalPots` increments only for
  scored pots; `matchesPlayed` increments in `finishFrame()`; `framesPlayed` in
  `newFrame(count)`. Avoid ad-hoc stat writes.
- **Storage keys are versioned contracts:** `snooker3d_stats_v1`, `snooker3d_muted`,
  `snooker3d_font_scale`, `snooker3d_rulings_v1`. Stats/rulings are sanitised and capped
  (120 rulings). A schema change needs migration or a new key.
- **Frame state is deliberately not saved.** Only career, rulings, mute and font size
  persist. Do not add autosave of the table without designing reset and resume.
- **One mouse, three tools.** Aim edits the line, Scene owns OrbitControls, Shot freezes
  the line and charges. Preserve the rule that camera movement can never change the shot.
- **Audio is gesture-gated.** `Audio.unlock()` runs on the first pointer/touch/key action
  and on Strike; browsers block otherwise.
- **The debug handle ships.** `window.SNOOKER` exposes mutators (`takeShot`, `newFrame`,
  `finishFrame`, `resolveShot`, `respotBall`). Treat it as a test surface and do not add
  privileged behaviour behind it.
- **Docs-only changes should not touch the three source files.** Pages serves `main`
  directly; there is no staging build.

## 5. Known issues

- **No offline mode.** Three.js, OrbitControls, Cannon and Google Fonts are remote. If a
  script CDN is blocked the boot error explains it, but the game cannot run. The script
  tags have no `integrity` attribute.
- **WebGL failure is raw.** With `--disable-gpu` the loader shows
  "Error creating WebGL context." and the self-test panel prints a `BOOT ERROR` stack;
  there is no friendly recovery card or fallback renderer. Verified on Chromium headless.
- **No CI or full test suite.** `?selftest=1` runs 15 checks in the browser; it does not
  cover a real break, AI play, export/import, modals, touch or long frames. The 15 checks
  do snapshot and restore `rules`, `balls` and `stats`.
- **Only Chromium headless was verified for this release.** Safari, Firefox, Edge, real
  iOS/Android, touch gestures, HiDPI and screen-reader output are unverified.
- **The debug handle is public.** `window.SNOOKER` can mutate a live frame from the
  console; `?selftest=1` displays its JSON in a normally hidden panel.
- **Frame progress is lost on reload.** Career stats, rulings, mute and font scale
  persist; the table, score, break and frame number do not. Reloading always starts
  Frame 01.
- **Accessibility is partial.** Buttons, live regions and the canvas label are present,
  and keyboard shortcuts exist, but the spin pad is a canvas pointer target, aiming is
  pointer-centric, and modals have `aria-modal` without a focus trap. No screen-reader
  pass was run.
- **AI quality is heuristic, not proven.** The opponent scores ghost-ball pots with path
  checks and a safety fallback; it was not exhaustively tested for every layout.
- **`STATE.md` is a historical receipt.** It records the first build (341-line
  `index.html`, 15/15 self-tests, earlier end-to-end runs). The current `index.html` is
  353 lines / 20,872 bytes; this documentation release re-verified 15/15 plus one real
  break, not every earlier claim.
- **A code comment is wrong.** `app.highlightType` is documented inline as "true = keep
  the Scene camera framing" (`script.js:83`); it actually holds the ball-guide colour
  type. The behaviour is correct; the comment is stale.

## 6. Continuity

- Live: <https://somphol.github.io/snooker-3d/> (HTTP 200 at the time of writing).
- Pages: `main` branch, repository root, `.nojekyll` present, no Actions workflow.
- Repository: <https://github.com/somphol/snooker-3d>.
- Local master copy: `~/Projects/snooker-3d`.
- Initial build: commit `2123378` "Build The Mahogany Room: a complete 3D snooker game".
- Aim tools and camera revision: commit `d7a4aed` "Add Aim, Scene and Shot mouse tools".
- Ball guide, text size and ruling history: commit `941c3c7`.
- Last source/state commit before the documentation release: `9383e9c` "docs: add
  complete repository documentation and community files".
- Documentation release: the commit adding this file and `docs/`.
- Author: Somphol Boonjing, MIT. Three.js, Cannon.js and OrbitControls are MIT; fonts are
  SIL OFL. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
