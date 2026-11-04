# Deployment

Hosted on **GitHub Pages**, served straight from `main` as a static site. There is no
build artifact, package manager, backend or CI workflow: the committed files are what is
served.

- Live URL: <https://somphol.github.io/snooker-3d/>
- Repository: <https://github.com/somphol/snooker-3d>
- Source branch: `main`, folder `/` (repository root)
- Entry file: `index.html`
- Runtime network calls: **Three.js r128, OrbitControls r128, Cannon.js 0.6.2 and Google
  Fonts** (see §3)

## 1. Deploy a change

```bash
cd ~/Projects/snooker-3d

# 1. verify locally
python3 -m http.server 8000          # http://localhost:8000/
#    run the matrix in docs/TESTING.md

# 2. commit and push
git add -A
git commit -m "…"
git push origin main
```

Pages rebuilds on push, usually within a minute. Confirm:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://somphol.github.io/snooker-3d/
```

Re-check that the served document is the committed one:

```bash
shasum index.html
curl -sL https://raw.githubusercontent.com/somphol/snooker-3d/main/index.html | shasum
```

At the documentation release both hashes were
`1c3064baa19552cbbdc9ba41463289f6321a2097`.

## 2. Repository settings that matter

| Setting | Value | Why |
| --- | --- | --- |
| Pages source | Deploy from a branch → `main` → `/ (root)` | the app lives at the root |
| Custom domain | none | default `*.github.io` host |
| Enforce HTTPS | on | default certificate |
| Actions | none required | no workflow exists in `.github/workflows/` |

`.nojekyll` is committed. Keep it: it stops Jekyll from processing the site and keeps the
publish path a plain static copy. The app uses classic `<script>` tags, so MIME handling is
simple; `index.html`, `style.css` and `script.js` are served as their normal types.

## 3. Files that are published

Everything in the repository root is public, including documentation and screenshots:

- `index.html` — club-room HUD, scoreboard, shot controls, modals
- `style.css` — mahogany/brass design system and responsive layout
- `script.js` — Three.js scene, Cannon physics, referee, AI, UI
- `favicon.svg` — house crest
- `screenshot.png`, `screenshot-orbit.png`, `screenshot-guide.png`,
  `screenshot-rulings.png`, `screenshot-stats.png`, `screenshot-victory.png`,
  `screenshot-mobile.png` — README images, about 5.6 MB total
- `docs/social-card.png` — 1200 × 630 Open Graph / Twitter preview
- `README.md`, `CHANGELOG.md`, `AGENTS.md`, `docs/*.md`
- `STATE.md`, `state.json` — historical build receipt
- `THIRD_PARTY_NOTICES.md`, `LICENSE`
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- `robots.txt`, `sitemap.xml`
- `.github/` issue templates, pull-request template and CODEOWNERS

There is no secrets file, no environment variable and no runtime configuration.

**Runtime network dependencies.** These are real requests on every cold load:

| Request | Host | Purpose |
| --- | --- | --- |
| `three.min.js` r128 | `cdnjs.cloudflare.com` | Three.js core |
| `OrbitControls.js` r128 | `cdn.jsdelivr.net` | Scene camera |
| `cannon.min.js` 0.6.2 | `cdnjs.cloudflare.com` | rigid-body physics |
| Google Fonts stylesheet | `fonts.googleapis.com` | Cormorant Garamond, Inter |
| Font files | `fonts.gstatic.com` | the same two families |

The script tags have no `integrity` attribute. If a script CDN is unreachable the boot
check throws and the loader reports the missing library; if only fonts fail, the browser
falls back to system faces. Do not describe the game as offline-capable.

## 4. Rollback

Pages serves the current `main`, so rolling back is a normal history operation:

```bash
git revert <bad-commit>          # preferred: keeps history
git push origin main
```

or, for an immediate local reset:

```bash
git reset --hard <good-commit>
git push --force-with-lease origin main
```

Force-pushing rewrites published history; prefer `git revert` unless the bad commit
contains something that must not remain public.

## 5. Caching

At the time of writing the live document returned:

```text
cache-control: max-age=600
etag: "6ae76b59-5188"
last-modified: Sun, 01 Nov 2026 16:39:53 GMT
```

A browser may keep an old `index.html` for up to ten minutes. After a deploy, hard-refresh
(Shift-Reload) or check in a private window. There is no service worker and no offline
cache to invalidate. Pages serves ETags, so conditional requests are cheap.

## 6. Local preview versus production

Classic scripts usually run from `file://`, but a local server is the supported preview:

```bash
python3 -m http.server 8000
open http://localhost:8000/
```

Reasons to use HTTP: `localStorage` origins are more predictable, font and CDN requests
behave as they do in production, and the canvas/pointer behaviour is easier to test.
`?selftest=1` runs the 15 checks after boot; the result is written into the hidden
`#selftest` panel.

## 7. Platform requirements

- A browser with **WebGL**, Canvas 2D, Web Audio and `localStorage`. Chrome/Chromium was
  verified; Safari, Firefox, Edge and real mobile devices are unverified for this release.
- A network connection on first load for the three script CDNs and Google Fonts. There is
  no local copy of Three.js or Cannon.js.
- On macOS headless Chrome, WebGL needs `--use-angle=metal`. With `--disable-gpu` the page
  reports **"Error creating WebGL context."** and prints a `BOOT ERROR` stack in the
  self-test panel; there is no alternate renderer.
- Real touch input, pinch zoom, HiDPI scaling and screen-reader output are unverified.
- No install, service worker or manifest; there is nothing to add to a home screen.
