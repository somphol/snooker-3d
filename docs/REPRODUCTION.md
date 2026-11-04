# Reproduction book

How to rebuild **The Mahogany Room · 3D Snooker** from scratch, or re-verify that a
rebuild matches the published release. Read [ARCHITECTURE.md](ARCHITECTURE.md) first for
the file and function map.

> **The source is the truth.** `main` at HEAD is the release. There is no bundle, package
> manager or tagged version. Rebuild only when the files are unavailable or you
> deliberately want a variant.

## 1. What is being reproduced

A static, three-file 3D snooker game:

- **Table** — 3.569 m × 1.778 m playing area in metres; mahogany frame, brass pocket
  rims, baize, baulk line, D, six spots, legs, lamps and a club-room backdrop.
- **Twenty-two balls** — cue, 15 reds racked in a triangle, and yellow, green, brown,
  blue, pink and black on their spots. Balls are 60 mm diameter for legibility.
- **Physics** — Cannon.js 0.6.2 at a 120 Hz fixed step: ball–ball momentum, cushion
  restitution, cloth friction, rolling resistance, side-spin swerve, pocket capture and
  off-table recovery.
- **Aiming** — Aim/Scene/Shot mouse tools, dotted cue path, ghost ball, object-ball line,
  cue-ball tangent, amber illegal-first-ball warning, power slider, hold-to-charge,
  cue-ball spin pad and elevation.
- **Referee** — reds/colours, free-colour phase after the last red, clearance order,
  colour and cue respotting, scratches, wrong-ball first contact, misses, illegal pots,
  4–7 point penalties, break tracking, 147 and a respotted-black tie-break.
- **Rulings** — a plain-English call for every stroke and a history of the last 120 calls.
- **AI** — ghost-ball pot search over legal targets and pockets, path checks, power from
  distance, small aiming error and a safety fallback.
- **Career book** — matches, frames, wins by player/computer, high break, centuries and
  total pots, persisted and exportable/importable as `snooker_3d_stats.json`.
- **UI** — live scoreboard, ball-on, reds left, points left, ball guide with point values
  and highlights, A−/A+ text scaling, responsive portrait layout.
- **Audio** — synthesised cue, ball, cushion, pocket and foul sounds.
- **Delivery** — `index.html` + `style.css` + `script.js`; Three.js r128, OrbitControls
  and Cannon 0.6.2 from CDNs; no build, backend, analytics or offline mode.

## 2. Requirements matrix

| # | Requirement | Implementation | Where |
| ---: | --- | --- | --- |
| 1 | 22 balls, 15 reds, six colours, cue | `buildBalls`, `createBall`, rack positions | `script.js` |
| 2 | Correct table proportions and pockets | constants 14–52, `buildTable`, `buildPockets` | `script.js` |
| 3 | Rigid-body physics with cloth and cushions | `initPhysics`, `stepPhysics` | `script.js` |
| 4 | Pocket capture and off-table recovery | `checkPockets`, `potBall` | `script.js` |
| 5 | Aim/Scene/Shot tools | `setTool`, `setCameraMode`, pointer handlers | `script.js` |
| 6 | Aim guide, ghost ball and legal warning | `buildAimGuide`, `updateAimGuide` | `script.js` |
| 7 | Power, hold-to-charge, spin and elevation | `startCharge`, `takeShot`, `drawSpinPad` | `script.js` |
| 8 | Referee: reds, colours, clearance | `resolveShot`, `ballOnAfterTurn`, `lowestActiveColor` | `script.js` |
| 9 | Fouls, penalties and respots | `resolveShot`, `respotBall`, `respotCueBall` | `script.js` |
| 10 | Frame finish and black tie-break | `endShot`, `finishFrame` | `script.js` |
| 11 | AI opponent | `scheduleAI`, `aiChooseShot`, `pathClear` | `script.js` |
| 12 | Ruling text and 120-entry history | `describeRuling`, `setLastCall`, `recordRuling`, `renderRulings` | `script.js` |
| 13 | Career stats persistence and export/import | `loadStats`, `saveStats`, `exportStats`, `importStatsFile` | `script.js` |
| 14 | Ball guide with points and highlights | `updateBallGuide`, `toggleBallHighlight` | `script.js`, `index.html` |
| 15 | Interface text scaling | `applyFontScale`, `changeFontScale` | `script.js` |
| 16 | Synthesised audio | `Audio` section 04 | `script.js` |
| 17 | Responsive desktop/portrait layout | CSS 1308–1439, `isNarrow` | `style.css`, `script.js` |
| 18 | Built-in regression check | `runSelfTests` (`?selftest=1`) | `script.js` |
| 19 | Static Pages delivery | root files, `.nojekyll`, CDN scripts | repository root |

## 3. Build order

1. **Shell** — head/meta/fonts, loader, top bar, scoreboard, shot controls, status,
   modals, self-test panel. Keep `#stage` as the only WebGL surface.
2. **Theme** — mahogany/brass design system, scoreboard, controls, modals, responsive
   breakpoints at 1180/980/780 and reduced motion.
3. **Three foundation** — renderer, scene, camera, OrbitControls, lights, textures,
   room, table, pockets, cue and aim guide.
4. **Physics** — Cannon world, contact materials, cloth bed, six cushion boxes, 22 ball
   bodies, pocket hooks and reset.
5. **Aim and camera** — Aim/Scene/Shot tools, relative drag, click-to-aim, wheel nudge,
   sticky pin, stable aim camera and recentre.
6. **Shot lifecycle** — power, charge, spin pad, elevation, cue jab, fixed-step physics,
   pocket capture, sink animations and rest detection.
7. **Referee** — ball-on state, `resolveShot`, fouls, penalties, respots, clearance,
   frame finish and tie-break.
8. **Ruling text** — plain-English calls, last-call panel, history storage and modal.
9. **AI** — ghost-ball search, path checks, power/spin choice, error and safety.
10. **HUD** — score, break, ball-on, reds left, points left, ball guide, status, toasts
    and banners.
11. **Career book** — load/sanitise/save, stats modal, export/import and reset.
12. **Audio** — cue, ball, cushion, pocket, foul, turn and win synthesis.
13. **Verification and docs** — self-test, real break, screenshots, README, this set.

## 4. Acceptance checks

A rebuild is done when all of these pass:

1. `python3 -m http.server 8000` serves the page; the loader clears and Frame 01 is
   racked with 22 balls, 15 reds and six colours.
2. `?selftest=1` reports **15 / 15** and the panel lists the same checks: ball count,
   rack, aim guide, spin pad, and the ten referee scenarios.
3. A real break with the default aim and 55% power strikes a red, leaves 21 balls on the
   table, and produces a valid call such as **"1 point to Player One — red potted. Break
   1; now on a colour. Player One stays at the table. Score 1–0."**
4. Potting a colour after a red scores 2–7, respots the colour and returns to red.
5. Wrong-ball first contact, a miss, a scratch and an illegal pot each award at least
   four points to the opponent and explain why.
6. Scratching respots the cue ball inside the D; colours respot on their own spot, then
   the highest free spot, then the nearest free centre-line point.
7. Clearing the colours ends the frame and opens the result card; a level score respots
   the black for a tie-break.
8. Aim/Scene/Shot behave exclusively; Scene → Aim and Scene → Shot preserve the camera
   framing, and recentre returns behind the cue.
9. The ball guide highlights every active ball of the chosen colour and dims a colour
   that is off the table.
10. A−/A+ scales the interface between 0.85 and 1.30 and the value survives a reload.
11. Career stats survive a reload, export to `snooker_3d_stats.json`, and import back
    into a cleared book.
12. Rulings survive a reload, cap at 120, and can be cleared.
13. At 390 × 844 the document has no horizontal overflow and the Strike button is
    reachable.
14. The live `index.html` SHA-1 matches the local file.
15. No uncaught exceptions during boot or a self-test run.

Record what you actually ran in [TESTING.md](TESTING.md), including the gaps.

## 5. Provenance

| Item | Value |
| --- | --- |
| Initial build | `2123378` "Build The Mahogany Room: a complete 3D snooker game" |
| Aim/Scene/Shot tools | `d7a4aed` "Add Aim, Scene and Shot mouse tools" |
| Ball guide, text size, rulings | `941c3c7` "Add ball guide, text size and ruling history" |
| Repository docs and community files | `9383e9c` "docs: add complete repository documentation and community files" |
| Release docs | this commit (`AGENTS.md` + `docs/`) |
| Three.js | r128, MIT, cdnjs |
| OrbitControls | r128, MIT, jsDelivr |
| Cannon.js | 0.6.2, MIT, cdnjs |
| Fonts | Cormorant Garamond, Inter, Google Fonts, SIL OFL 1.1 |
| Author | Somphol Boonjing, MIT |

There is no tagged release and no build artefact. `CHANGELOG.md` is the change record;
`STATE.md` / `state.json` are the 2026-10-31 build receipt and are not regenerated by
later commits.
