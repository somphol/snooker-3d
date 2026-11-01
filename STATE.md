# Build State

| Field | Value |
| --- | --- |
| Project | The Mahogany Room · 3D Snooker (`snooker-3d`) |
| Started | 2026-10-31 23:45:05 UTC |
| Packaged | 2026-11-01 00:15:53 UTC |
| Duration | **30m 47s** (1,847 seconds) |
| Harness | OpenCode 2.2.5 |
| Model | DeepSeek V4.1 Flash (`opencode-go/deepseek-v4.1-flash`) |
| Session | `ses_e6ba5bd0cffeNxKRA16F47omGg` |
| Repository | <https://github.com/somphol/snooker-3d> |
| Live demo | <https://somphol.github.io/snooker-3d/> |

## Token usage

| Metric | Tokens |
| --- | ---: |
| Input | 412,246 |
| Output | 94,638 |
| Reasoning | 134,617 |
| **Total (input + output + reasoning)** | **641,501** |
| Cache read | 14,969,856 |
| Cache write | 1,277 |
| Total including cache | 15,612,634 |

> Snapshot taken from the OpenCode session record when the project was packaged at 2026-11-01 00:15:53 UTC. The final commit, push, Pages check and closing response happen outside this snapshot, so the live session totals will be marginally higher. Total cost reported by the session: **$0.00**.

## What was built

- A complete 22-ball 3D snooker game in three modular files:
  - `index.html` — 15,058 bytes, 289 lines
  - `style.css` — 33,684 bytes, 1,221 lines
  - `script.js` — 108,851 bytes, 2,859 lines
- A 12 ft × 6 ft table: procedural mahogany, baize, brass pocket rims, six pockets, baulk line, D, spots, legs, nameplate, hanging lamps and a club-room backdrop.
- Cannon.js ball physics at a fixed 120 Hz with sub-stepping: ball–ball momentum transfer, cushion restitution, cloth friction, custom rolling resistance, pocket capture and off-table recovery.
- Full cue control: Orbit table / Aim lock cameras, pointer aiming, fine nudge, power slider, hold-to-charge meter, draggable cue-ball spin pad, elevation and a 3D cue with strike animation.
- Aim assist: dotted cue path, ghost ball at contact, object-ball line, cue-ball tangent, and amber warning when the first ball is not on.
- Referee: reds and colours, free-colour phase after the last red, clearance order, colour respotting, cue-ball respotting, 4–7 point fouls, break tracking, 147 support, respotted-black tie-break and frame completion.
- AI opponent that searches ghost-ball pots over every pocket, validates paths, falls back to a same-side safety, and plays with small human error.
- Career statistics in `localStorage`: matches, frames, Player One/Two/Computer wins, high break, centuries and total pots, with tested JSON export and import.
- Responsive desktop, portrait and mobile layouts; the portrait HUD exposes all shot controls including fine aim, spin and charge.
- Synthesised Web Audio for cue, ball, cushion, pocket and foul sounds; no audio assets.

## Verification

- **15/15** in-browser self-tests pass (`?selftest=1`): ball count, rack geometry, aim guide, legal red, colour respot, wrong-ball foul, miss foul, scratch, clearance black and the free-colour phase.
- Headless Chrome end-to-end runs verified:
  - a legal break with the auto-aim finding an edge red around the pink,
  - a red pot with the correct score and turn,
  - a blue pot and respot,
  - a scratch with a four-point penalty and cue respot in the D,
  - follow vs. screw (the follow cue ball finished further forward than the screw cue ball),
  - an AI break, its first contact and its foul handling,
  - hold-to-charge and release-to-strike,
  - stats export to `snooker_3d_stats.json` and import back into a cleared career,
  - the victory modal and new-frame flow.
- **0** console errors in the final local load and **0** on the live GitHub Pages load.
- Screenshots rendered at 1600 × 1000 (desktop) and 390 × 844 @2× (portrait).
- Live page: <https://somphol.github.io/snooker-3d/> (verified serving the 22-ball game).

## Credits

Built with [OpenCode](https://opencode.ai) 2.2.5 and **DeepSeek V4.1 Flash** (`opencode-go/deepseek-v4.1-flash`) in a single agent session. The game code, table geometry, procedural textures, physics tuning, referee, AI, HUD, audio synthesis, tests and documentation were generated for this project.

Runtime libraries: [Three.js](https://threejs.org/) r128 (MIT), [Cannon.js](https://schteppe.github.io/cannon.js/) 0.6.2 (MIT), [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) (MIT), and the **Cormorant Garamond** / **Inter** families from Google Fonts (SIL OFL). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
