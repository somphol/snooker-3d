# Architecture

`snooker-3d` is a static Three.js + Cannon.js game in three source files. This map covers
the parts that control behaviour: the physics world, the shot lifecycle, the referee, the
AI and the HUD. It is not a file dump.

## 1. File map

| File | Lines | Contents |
| --- | ---: | --- |
| `index.html` | 353 | head/meta/fonts (1–32), stage/vignette/grain (33–36), loader (37–47), top bar (48–81), scoreboard (82–148), shot controls (149–224), status/toast/banner (225–246), modals (247–344), self-test panel (345), CDN scripts (347–352) |
| `style.css` | 1,439 | base/vars (1–91), loading (92–171), top bar (172–259), panels (260–340), scoreboard (341–632), controls (633–898), status/toast/banner (899–1038), modals (1039–1245), ruling history (1246–1307), responsive/reduced motion (1308–1439) |
| `script.js` | 3,589 | 16 numbered sections, listed below |
| `favicon.svg` | — | house crest |
| `docs/social-card.png` | — | 1200 × 630 link preview |

`script.js` section map:

| § | Lines | Subject |
| ---: | --- | --- |
| 01 | 11–70 | constants: table, ball, pocket, shot, storage keys |
| 02 | 71–196 | `app`, `rules`, career stats, storage helpers |
| 03 | 197–267 | DOM references |
| 04 | 268–376 | Web Audio synthesis |
| 05 | 377–1005 | Three.js scene, textures, lights, room, table, cue, aim guide |
| 06 | 1006–1242 | Cannon world, balls, contact materials, pocket hooks |
| 07 | 1243–1419 | referee engine |
| 08 | 1420–1962 | aiming, cue, pointer tools, camera |
| 09 | 1963–2641 | charge, shot, physics step, pockets, end of shot, respots, frame finish |
| 10 | 2642–2751 | AI opponent |
| 11 | 2752–2824 | frame reset, turn UI, mode switch |
| 12 | 2825–3115 | HUD, ball guide, spin pad, toasts, banner |
| 13 | 3116–3201 | modals, stats export/import |
| 14 | 3202–3272 | render loop |
| 15 | 3273–3457 | bindings and boot |
| 16 | 3458–3589 | self-test, `window.SNOOKER`, DOMContentLoaded |

## 2. Runtime state

```js
app = {
  phase: 'aiming',       // loading | aiming | rolling | settling | gameover
  mode: '2p',            // 2p | ai
  cameraMode: 'aim',     // aim | orbit
  tool: 'aim',           // aim | scene | shot
  aimAngle, aimTarget, aimCamAngle, aimFree, aimLocked,
  power, charging, chargeStart, chargePrevPower,
  spin: {x, y}, elevation, soundOn, fontScale,
  frameNo, breakOff, frameHigh, centuryThisBreak,
  shot, aiThinking, shake
}

rules = {
  scores: [0, 0], current: 0, break: 0,
  ballOn: 'red',        // red | color | yellow…black | null
  redsRemaining: 15, frameOver: false
}
```

`app` is at `script.js:74`, `rules` at 102, `stats` at 111. Other module values:
`balls[]`, `cueBall`, `rulingHistory`, `stats`, and the Three/Cannon handles
(`scene`, `camera`, `renderer`, `controls`, `world`, `ballPhys`, `clothPhys`,
`cushionPhys`).

| Value | Persisted? | Key |
| --- | --- | --- |
| `stats` | yes | `snooker3d_stats_v1` |
| `rulingHistory` | yes, last 120 | `snooker3d_rulings_v1` |
| mute flag | yes | `snooker3d_muted` (`'1'` = muted) |
| font scale (0.85–1.3) | yes | `snooker3d_font_scale` |
| `app`, `rules`, `balls`, frame state | no | reload starts Frame 01 |

`loadStats()` (129), `sanitiseStats()` (143) and `saveStats()` (160) defend the career
book; readings are clamped to non-negative integers and a high break is capped at 147.
`loadRulings()` (2308) filters the stored array and `saveRulings()` (2327) keeps the last
`RULINGS_MAX = 120`.

## 3. Physics model

`initPhysics()` (`script.js:1008`) creates one Cannon world:

| Property | Value |
| --- | --- |
| gravity | `(0, -9.82, 0)` |
| broadphase | `SAPBroadphase` |
| solver | 24 iterations, tolerance 0.001 |
| ball–ball | friction 0.055, restitution 0.955 |
| ball–cloth | friction 0.42, restitution 0.03 |
| ball–cushion | friction 0.32, restitution 0.72 |
| fixed step | `1 / 120` s |

The bed is a finite static box; four long cushion boxes and two end cushions match the
rendered rails. `buildBalls()` (1188) creates 15 reds in a triangle plus the six colours
and cue ball. `createBall()` (1120) attaches the mesh, body, outline, rim shader, ball
guide ring/halo and collision listener.

`stepPhysics(dt)` (2074) calls `world.step(1/120, dt, steps)` with 1–6 substeps, then:

- applies cloth deceleration `(0.24 + speed·0.045 + hurry)·dt` to balls on the bed;
- decays angular velocity below 0.1 m/s;
- adds a small side-spin swerve to the cue ball for ~1.7 s after the strike;
- copies body transforms to meshes.

`checkPockets()` (2118) captures a ball when its centre enters a pocket mouth
(`POCKET_CAPTURE`, radii 0.061/0.064) or leaves the playing area by 0.02 m.
`potBall()` (2137) removes the body, records the pot on `app.shot`, and starts the sink
animation. `ballsAtRest()` (2175) waits for `maxV < 0.024` and `maxW < 3.2`.

## 4. Shot lifecycle and aiming

```text
Aim tool:  drag / click / wheel / nudge → app.aimTarget
Scene:     OrbitControls owns the mouse
Shot:      pointerdown on cloth → startCharge()
           pointerup → releaseCharge() → takeShot()

takeShot(): phase = rolling
            velocity = dir · (MIN + power/100 · (MAX-MIN))
            angularVelocity = roll + top spin + side spin
            elevation > 18° adds a small vertical hop
tick():     stepPhysics → checkPockets → ballsAtRest → endShot()
endShot():  resolveShot() → respots → ruling → updateUI → aiming
```

Key functions:

- `updateAimGuide()` (1430) — dotted cue path, ghost ball, object-ball line, tangent
  line; amber when the first ball is not legal.
- `updateCue()` (1540) / `updateCueStrike()` (1557) — cue placement and jab animation.
- `setTool()` (1869) — Aim/Scene/Shot, preserving the Scene camera framing on return.
- `setCameraMode()` (1909) — aim vs orbit, restores `_orbitPos`/`_orbitTarget`.
- `updateAimCamera()` (1941) — holds the camera angle while following the cue ball; the
  mouse cannot swing the table.
- `startCharge()` (1965), `releaseCharge()` (1976), `updateCharge()` (1995) — hold-to-
  charge power.
- `takeShot()` (2013) — freezes `aimAngle = aimTarget`, fires, hides the guide and starts
  the jab.
- `endShot()` (2398) — stops all bodies, calls the referee, respots, writes the call,
  handles the tie-break and returns to `aiming`.

`drawSpinPad()` (2999) maps the cue-ball contact dot to `app.spin` (`x` side, `y` top/
back). `app.elevation` is set by the range input and only lifts the cue ball above 18°.

## 5. Referee

`resolveShot(shot)` (`script.js:1299`) is the rules core. It accepts
`{potted, firstContact, cuePotted}` and mutates `rules`.

**Ball-on model** — `rules.ballOn` is `red`, `color`, a specific clearance colour, or
`null` at frame end. Helpers:

- `legalTargets()` (1245) — active reds, any active colour, or the one clearance colour.
- `isLegalType(type)` (1255) — the same test by type name.
- `lowestActiveColor()` (1261) — next colour in clearance order.
- `valueOfOn()` (1273) — value of the nominated clearance colour, else 0.
- `ballOnAfterTurn()` (1277) — red if reds remain, otherwise colour/clearance continuity.

**Legal stroke**

| Situation | Points | Next ball-on | Respot |
| --- | ---: | --- | --- |
| Red(s) potted | 1 per red | `color` | none |
| One colour after a red | 2–7 | red, or lowest colour if no reds | that colour |
| Clearance colour | 2–7 | next lowest colour | none |
| Nothing potted | 0 | turn passes, break reset | none |

**Fouls** — cue potted, no ball struck, wrong ball first, wrong colour potted, more than
one colour, red during clearance, colour when red on. Penalty is
`clamp(max(4, value of ball on, value of first contact, value of potted balls), 4, 7)`.
The opponent receives the points, the break resets, the turn changes, colours are
respotted and the cue ball returns to the D. `describeRuling()` (2216) turns the result
into the plain-English **Referee's call** stored by `setLastCall()` (2203).

**Respots** — `respotBall()` (2485) first tries the ball's own spot, then the highest free
colour spot, then slides along the centre line (`findFreeSpot`, 2518). A scratched cue
ball is replaced inside the D (`respotCueBall`, 2539).

**Frame end** — `finishFrame()` (2572) marks `frameOver`, picks the winner, increments
the career wins and matches, saves stats, announces the score and opens the result modal.
A level score after the last colour respots the black and gives the opponent the
tie-break (`endShot`, 2398–2470).

## 6. AI

`scheduleAI()` (2644) waits 1.1 s, then `aiChooseShot()` (2674):

1. `legalTargets()` gives every legal object ball.
2. For each target and each pocket, compute the ghost-ball point (`2R` behind the target
   along the pocket line), reject cuts below `cos 0.32`, and check both paths with
   `pathClear()` (2657).
3. Score = `value·2.2 + min(3, 1.6/(distance+0.2)) + cut·1.8 − pocketDistance·0.4`.
4. Apply random aim error (0.028 rad scaled by distance), choose power from the required
   speed, add a little top spin.
5. If no pot exists, aim at a same-side red (or nearest colour) as a safety.

It then places the aim camera, updates the HUD and strikes after 850 ms. There is no
search over multiple shots and no safety/escape planning beyond the single contact.

## 7. UI, ball guide, stats

`updateUI()` (2827) writes scores, active-player rows, break, high break, reds left,
points left, wins, frame number and mode. `pointsRemaining()` (2864) is
`reds·8 + active colour values (+7 while on a colour)`.

- `updateBallGuide()` (2874) dims chips whose colour is off the table and toggles the
  selected highlight; `updateBallHighlights()` (2908) pulses rings/halos on matching balls.
- `updateStatus()` (2934) writes the bottom status pill; `updateShootAvailability()`
  (2968) disables controls during AI turns/rolling.
- `drawSpinPad()` (2999) and `spinFromEvent()` (3060) handle the canvas spin control.
- `toast()` (3093) and `banner()` (3101) are the two feedback layers.
- `openModal()` (3118) / `closeModal()` (3127) drive Rules, Rulings, Stats and Result.
- `exportStats()` (3152) writes the `{app, version, exportedAt, stats}` wrapper to
  `snooker_3d_stats.json`; `importStatsFile()` (3172) accepts the wrapper or a bare stats
  object and runs it through `sanitiseStats()`.

The render loop `tick()` (3204) caps `dt`, advances physics while rolling, updates pot
animations, cue, aim camera, highlights, HUD and shake, and renders.

## 8. Data flow

```text
pointer / button / key
        ↓
setTool → aim | scene | shot
        ↓
startCharge / releaseCharge → takeShot()
        ↓
phase = rolling → tick() → stepPhysics(1/120) → checkPockets() → ballsAtRest()
        ↓
endShot() → resolveShot(shot)
        ├─ foul / pot / miss → scores, break, current, ballOn, respot[]
        ├─ respotBall / respotCueBall
        ├─ describeRuling → setLastCall → history → localStorage
        ├─ updateUI → HUD + ball guide + status
        └─ finishFrame if colours cleared
```

## 9. Change guide

| To change… | Touch | Watch out for |
| --- | --- | --- |
| Table/ball dimensions | constants 14–52, `buildTable`, `buildBalls` | pockets, spots, rack, camera framing and self-test bounds assume them |
| Physics feel | contact materials, `stepPhysics`, `MAX_SHOT_SPEED` | re-run a real break and check balls settle |
| Aim guide | `buildAimGuide`, `updateAimGuide` | ghost/tangent lines must agree with `takeShot` |
| Camera/tools | `setTool`, `setCameraMode`, `updateAimCamera` | Scene → Aim must preserve framing; aim must never move the camera angle |
| Referee rules | `resolveShot`, `ballOnAfterTurn`, `describeRuling` | update the 15 self-test scenarios and a real frame |
| Respots | `findFreeSpot`, `respotBall`, `respotCueBall` | own spot → highest free → centre line; cue in D |
| AI | `aiChooseShot`, `pathClear` | it must never choose an illegal first contact |
| HUD/ball guide | `updateUI`, `updateBallGuide`, `updateStatus` | keep AI-turn and rolling disabled states coherent |
| Persistence | stats/rulings/mute/font keys and sanitisers | versioned keys; no frame autosave |
| Stats export/import | `exportStats`, `importStatsFile` | wrapper or bare object; sanitise every field |
| Mobile | CSS 1308–1439, `isNarrow` | 390 × 844 fit; controls must not cover the Strike button |
| Test surface | `runSelfTests`, `window.SNOOKER` | snapshot/restore rules/balls/stats after checks |

Keep the app static: three files, CDN libraries, no build server, no backend, no
analytics. A change that needs any of those is a product decision, not a refactor.
