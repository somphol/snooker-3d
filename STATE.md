# Build State

| Field | Value |
| --- | --- |
| Project | The Mahogany Room · 3D Snooker (`snooker-3d`) |
| Started | 2026-10-31 23:45:05 UTC |
| Packaged | 2026-11-01 01:56:19 UTC |
| Duration | **2h 11m 14s** (7,874 seconds) |
| Harness | OpenCode 2.2.5 |
| Model | DeepSeek V4.1 Flash (`opencode-go/deepseek-v4.1-flash`) |
| Session | `ses_e6ba5bd0cffeNxKRA16F47omGg` |
| Repository | <https://github.com/somphol/snooker-3d> |
| Live demo | <https://somphol.github.io/snooker-3d/> |

## Token usage

| Metric | Tokens |
| --- | ---: |
| Input | 978,002 |
| Output | 177,185 |
| Reasoning | 323,948 |
| **Total (input + output + reasoning)** | **1,479,135** |
| Cache read | 81,874,048 |
| Cache write | 1,277 |
| Total including cache | 83,354,460 |

> Snapshot taken from the OpenCode session record when the project was packaged at 2026-11-01 01:56:19 UTC. The final commit, push, Pages check and closing response happen outside this snapshot, so the live session totals will be marginally higher. Total cost reported by the session: **$0.00**.

## What was built

- A complete 22-ball 3D snooker game in three modular files:
  - `index.html` — 16,630 bytes, 307 lines
  - `style.css` — 35,557 bytes, 1,281 lines
  - `script.js` — 127,082 bytes, 3,383 lines
- A 12 ft × 6 ft table: procedural mahogany, baize, brass pocket rims, six pockets, baulk line, D, spots, legs, nameplate, hanging lamps and a club-room backdrop.
- Cannon.js ball physics at 120 Hz with sub-stepping: ball–ball momentum transfer, cushion restitution, cloth friction, custom rolling resistance, pocket capture and off-table recovery.
- **60 mm balls** (slightly oversized for visibility) with saturated colours, a stronger emissive lift, a neutral key light, darker baize, a white Fresnel rim and a dark contour ring, so every colour — including the black — reads against the cloth.
- **Three exclusive mouse tools**:
  - **Aim** — relative drag for fine aim, eased click-to-line, wheel nudge, Shift for ultra-fine, and double-click/padlock to pin the line.
  - **Scene** — drag to orbit and wheel/pinch to zoom, with the shot line untouched; switching Scene → Aim/Shot **preserves the exact camera framing and shot angle**.
  - **Shot** — freeze the line, hold anywhere on the cloth to charge, release to strike; a quick click is ignored; the tool returns to Aim after the shot.
- **Recentre** (the circular-arrow icon) or clicking the active **Aim** button returns from a kept Scene framing to the low behind-cue view.
- A **stable aim camera**: it holds its angle while you aim and only follows the cue ball's position, so moving the mouse can never swing the table.
- Full shot control: power slider, hold-to-charge, draggable cue-ball spin pad, elevation, fine nudge, one-mouse Strike and a 3D cue with strike animation.
- Aim assist: dotted cue path, ghost ball at contact, object-ball line, cue-ball tangent, and an amber warning when the first ball is not on.
- Referee: reds and colours, free-colour phase after the last red, clearance order, colour respotting, cue-ball respotting, 4–7 point fouls, break tracking, 147 support, respotted-black tie-break and frame completion.
- A persistent **Referee's call** panel explains every score and foul: **who scored or fouled, why, the penalty value, any respots, whose turn it is and the score**. The same explanation appears in the toast and foul banner.
- AI opponent that searches ghost-ball pots over every pocket, validates paths, falls back to a same-side safety, and plays with small human error.
- Career statistics in `localStorage`: matches, frames, Player One/Two/Computer wins, high break, centuries and total pots, with tested JSON export and import.
- Responsive desktop, portrait and mobile layouts; the portrait HUD exposes the three tools, the Referee's call, spin, charge and Strike.
- Synthesised Web Audio for cue, ball, cushion, pocket and foul sounds; no audio assets.

## Verification

- **15/15** in-browser self-tests pass (`?selftest=1`): ball count, rack geometry, aim guide, legal red, colour respot, wrong-ball foul, miss foul, scratch, clearance black and the free-colour phase.
- Headless Chrome end-to-end runs verified:
  - a legal break with the auto-aim finding an edge red around the pink,
  - a red pot with the correct score, turn and Referee's call,
  - a blue pot and respot,
  - a scratch with a four-point penalty and cue respot in the D,
  - follow vs. screw,
  - an AI break, its first contact and its foul handling,
  - hold-to-charge and release-to-strike,
  - stats export to `snooker_3d_stats.json` and import back into a cleared career,
  - the victory modal and new-frame flow,
  - the Aim / Scene / Shot mouse tools,
  - **Scene → Aim with camera delta 0, target delta 0 and aim delta 0**,
  - Scene → Shot keeps the framing; recentre returns to the cue view,
  - **Referee's call explanations**:
    - **1 point to Player One — red potted. Break 1; now on a colour. Player One stays at the table. Score 1–0.**
    - **Foul by Player One — blue (5) was struck first, but red was on. 5 points to Player Two (the blue is worth 5). Player Two to the table. Score 0–5.**
    - **Foul by Player One — the cue ball was potted. 4 points to Player Two (minimum penalty). Cue ball respotted in the D. Player Two to the table. Score 0–4.**
  - a clean pot with the larger 60 mm balls,
  - the saturated colour / rim / contour pass.
- **0** console errors in the final local load and **0** on the live GitHub Pages load.
- Screenshots rendered at 1600 × 1000 (desktop) and 390 × 844 @2× (portrait).
- Live page: <https://somphol.github.io/snooker-3d/> (verified serving the 22-ball game).

## Credits

Built with [OpenCode](https://opencode.ai) 2.2.5 and **DeepSeek V4.1 Flash** (`opencode-go/deepseek-v4.1-flash`) in a single agent session. The game code, table geometry, procedural textures, physics tuning, referee, AI, HUD, audio synthesis, tests and documentation were generated for this project.

Runtime libraries: [Three.js](https://threejs.org/) r128 (MIT), [Cannon.js](https://schteppe.github.io/cannon.js/) 0.6.2 (MIT), [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) (MIT), and the **Cormorant Garamond** / **Inter** families from Google Fonts (SIL OFL). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
