# Testing

## Status of this release

| Evidence | When | Result |
| --- | --- | --- |
| Local self-test (`?selftest=1`) | 2026-11-03 | **15 / 15 passed** |
| Live Pages self-test | 2026-11-03 | **15 / 15 passed** |
| Local initial state | 2026-11-03 | **22 balls, 15 reds, 6 colours, cue**, Frame 01, 0–0, red on |
| Real break (scripted shot through physics) | 2026-11-03 | **red potted, 1–0, break 1, colour on, 14 reds, 21 active** |
| Referee call for that break | 2026-11-03 | **"1 point to Player One — red potted… Score 1–0."** |
| Console exceptions, fresh load and break | 2026-11-03 | **0** |
| A+ text scaling and reload | 2026-11-03 | **1.20** before and after reload |
| Desktop screenshot, 1600 × 1000 | 2026-11-03 | **1,266,949-byte PNG** |
| Post-break screenshot, 1600 × 913 | 2026-11-03 | **1,110,365-byte PNG** |
| Phone emulation, 390 × 844 | 2026-11-03 | **229,669-byte PNG**, scrollWidth 390, no overflow |
| Live Pages probe (`curl`) | 2026-11-03 | **200** |
| Local vs live `index.html` (SHA-1) | 2026-11-03 | **match** (`1c3064ba…`) |
| CDN probes (Three, Orbit, Cannon, fonts) | 2026-11-03 | **200 / 200 / 200 / 200** |
| No-GPU negative control | 2026-11-03 | **"Error creating WebGL context."** and `BOOT ERROR` |
| Full AI frame, export/import files, 147, tie-break | — | **Not re-verified** this release |
| Safari / Firefox / Edge / real touch / screen reader | — | **Not verified** |
| CI | — | **None exists** in this repository |

The documentation commit changes Markdown only; `index.html`, `style.css` and `script.js`
are untouched.

## 1. Commands

```bash
cd ~/Projects/snooker-3d

# run
python3 -m http.server 8000          # http://localhost:8000/
open index.html                      # classic scripts, but server preferred

# self-test (macOS headless WebGL)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --use-angle=metal --mute-audio \
  --virtual-time-budget=12000 --timeout=30000 \
  --dump-dom "http://localhost:8000/?selftest=1" > /tmp/snooker-dom.html

grep -o '"passed": *[0-9]*' /tmp/snooker-dom.html
grep -o '"total": *[0-9]*' /tmp/snooker-dom.html

# live probe and source match
curl -s -o /dev/null -w '%{http_code}\n' https://somphol.github.io/snooker-3d/
shasum index.html
curl -sL https://raw.githubusercontent.com/somphol/snooker-3d/main/index.html | shasum

# desktop frame
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --use-angle=metal --mute-audio \
  --virtual-time-budget=10000 --timeout=25000 --window-size=1600,1000 \
  --screenshot=/tmp/snooker.png "http://localhost:8000/"
```

### Console-driven checks

The game exposes `window.SNOOKER` (rules, balls, app, camera, and several helpers). With
Chrome started using `--remote-debugging-port=9229 --user-data-dir=/tmp/snooker-profile`,
attach with the DevTools Protocol and evaluate:

```js
// initial state
({ balls: SNOOKER.balls.length, rules: SNOOKER.rules, phase: SNOOKER.app.phase })

// run the built-in checks again
SNOOKER.runSelfTests()

// strike with the current aim and default 55% power
SNOOKER.takeShot()

// after the balls settle
({
  phase: SNOOKER.app.phase,
  scores: SNOOKER.rules.scores,
  break: SNOOKER.rules.break,
  ballOn: SNOOKER.rules.ballOn,
  reds: SNOOKER.rules.redsRemaining,
  active: SNOOKER.balls.filter(b => b.active).length,
  call: document.getElementById('last-call-text').textContent
})
```

The observed result was:

```text
before:  phase "aiming", 22 balls, rules {scores:[0,0], ballOn:"red", redsRemaining:15}
shot:    phase "rolling"
after:   phase "aiming", scores [1,0], break 1, ballOn "color", reds 14, active 21
call:    "1 point to Player One — red potted. Break 1; now on a colour.
          Player One stays at the table. Score 1–0."
errors:  0
```

This exercises Cannon, pocket capture, `resolveShot`, the ruling text and the HUD update
in one real stroke. It is not a substitute for playing a frame.

### Phone layout

```js
await send('Emulation.setDeviceMetricsOverride',
  { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
```

Measured after boot: `innerWidth 390`, `scrollWidth 390`, no horizontal overflow;
`.scoreboard` 10–380, `#btn-shoot` 201–369. The capture is 390 × 844.

### Negative control

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --mute-audio \
  --virtual-time-budget=10000 --timeout=25000 \
  --dump-dom "http://localhost:8150/?selftest=1" > /tmp/snooker-nogpu.html
```

The dump was 21,323 bytes and contained:

```text
loader note:  Error creating WebGL context.
self-test:    BOOT ERROR: Error: Error creating WebGL context.
```

There is no fallback renderer.

## 2. Results (2026-11-03)

### Self-test (local and live)

```text
15 / 15 passed
```

| # | Check |
| ---: | --- |
| 1 | 22 balls on the table |
| 2 | 15 reds |
| 3 | 6 colours |
| 4 | cue ball present |
| 5 | all balls inside cushions |
| 6 | aim guide dotted line built |
| 7 | spin pad present |
| 8 | renderer and canvas present |
| 9 | legal red scores 1, stays at table, ball-on colour, 14 reds |
| 10 | colour after red scores 5 and respots |
| 11 | wrong ball first is a 5-point foul |
| 12 | missing everything is a 4-point foul |
| 13 | scratch is a foul, cue respotted |
| 14 | clearance black scores 7 and ends colours |
| 15 | last red gone, missed colour keeps colour-on |

The suite snapshots `rules`, `balls`, `stats`, `frameHigh` and `centuryThisBreak` and
restores them afterwards. The live URL produced the same 15/15 in a 22,781-byte DOM.

### Initial state

```text
balls 22 · reds 15 · colours 6 · cue present
rules { scores: [0,0], current: 0, break: 0, ballOn: "red",
        redsRemaining: 15, frameOver: false }
phase "aiming" · tool "aim" · frame 01
loader class "loader is-done"
```

### Real break

The stall-free scripted shot above produced a legal red, a 1–0 score, a break of 1, the
colour-on state, 14 reds remaining, 21 active balls and the expected Referee's call. The
HUD in the post-break capture shows **Ball on: Any colour**, **Reds left: 14**, **Points
left: 146**, **Break 1** and the call text.

### Text scaling and persistence

Two A+ clicks moved `SNOOKER.app.fontScale` from 1.0 to 1.2, wrote
`snooker3d_font_scale = "1.20"`, and a reload restored scale 1.2 and CSS `--fs: 1.20`.

### Screenshots

| View | Size | Observed |
| --- | --- | --- |
| Desktop after load, 1600 × 1000 | 1,266,949 bytes | full table, scoreboard, shot controls, 22 balls |
| After a red pot, 1600 × 913 | 1,110,365 bytes | 1–0, break 1, colour on, call panel |
| Phone, 390 × 844 | 229,669 bytes | portrait scoreboard/table/shot panel, no overflow |

The repository screenshots are older, larger captures from the 2026-10-31 build.

## 3. Manual matrix

| Area | Check | Status |
| --- | --- | --- |
| Boot | Loader clears; Frame 01 racks 22 balls | Verified headless |
| Scoreboard | Frame, scores, break, ball-on, reds, points left | Verified at 0 and after a red |
| Aim | Relative drag, click-to-aim, wheel nudge, pin | Code paths; gesture not measured |
| Scene | Orbit/zoom, preserve framing on return | Code paths; gesture not measured |
| Shot | Hold-to-charge, release, Strike button | Scripted `takeShot` verified; pointer gesture not |
| Physics | Ball–ball, cushions, cloth drag, pockets | One real break potted a red; full-frame feel not measured |
| Spin | Follow/screw/english and swerve | Code inspection; not measured |
| Referee | Reds, colours, clearance, fouls, respots | 15 self-test scenarios |
| Referee | Real break integration and call text | Verified |
| AI | Legal target choice, pot search, safety, strike | Not run this release |
| Frame end | Result modal, tie-break, new frame | Not run this release |
| Ball guide | Highlight all of a colour, dim potted colours | Code inspection; not clicked headless |
| Text size | A−/A+ range and reload persistence | Verified |
| Rulings | Last-call panel, history modal, 120 cap, clear | Code inspection; not clicked headless |
| Career | Stats persist, export/import files | Persistence code present; file round-trip not re-run |
| Audio | Cue, ball, cushion, pocket, foul | Context and calls exist; quality not measured |
| Mobile | 390 × 844 layout and Strike reachability | Verified in emulation |
| Reload | Frame resets to 01; career/settings persist | Code inspection; font persistence verified |

## 4. Failure triage

- **Loader stalls or reports a missing library** — check the three script CDNs and the
  console. The boot check requires `THREE`, `CANNON` and `THREE.OrbitControls`.
- **"Error creating WebGL context."** — no WebGL. Use a hardware-accelerated browser; on
  macOS headless add `--use-angle=metal`.
- **Aim does not move** — confirm the Aim tool is active, the phase is `aiming`, and it is
  a human turn (AI mode blocks input on Player Two's turn).
- **Shot button does nothing** — the balls may still be rolling/settling, the frame may
  be over, or it is the AI's turn.
- **A pot scores nothing** — check `rules.ballOn`, `firstContact` and the potted types in
  the Referee's call. A wrong first ball or multiple colours is a foul.
- **A colour does not return** — `findFreeSpot` tries own spot, highest free colour spot,
  then the centre line; check the table is not congested.
- **No sounds** — the AudioContext needs a gesture; click/press once, then check mute.
- **Stats or rulings missing** — check `localStorage` availability and the versioned keys;
  private mode may block writes.
- **Import rejected** — the file must be valid JSON; the importer accepts the wrapper or a
  bare stats object and sanitises every field.

## 5. Not verified

- A complete two-player frame, including clearance, result modal, new frame and tie-break.
- AI play quality, its first contact, safety choice and foul handling in live frames.
- Exporting a real `snooker_3d_stats.json` download and importing it back into a cleared
  book (the earlier STATE.md claims this; it was not re-run).
- Ball-guide highlights, ruling-history modal and clear action by pointer.
- Spin (follow/screw/english), elevation hop and cue strike animation feel.
- Audio mix and the foul/win cues.
- Safari, Firefox, Edge, real iOS/Android, touch gestures, HiDPI and screen-reader output.
- Long-session stability and frame rate on low-end GPUs.
- The 147 path, century counter and respotted-black tie-break end to end.
