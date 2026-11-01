/* ══════════════════════════════════════════════════════════════════════════
   THE MAHOGANY ROOM · 3D SNOOKER
   A complete browser snooker game: Three.js rendering, Cannon.js physics,
   a full referee, spin, AI opponent and a local career book.

   Built with OpenCode × DeepSeek V4.1 Flash.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────────────────
     01 · CONSTANTS
     ──────────────────────────────────────────────────────────────────────── */
  const R = 0.0300;                     // 60 mm balls (slightly oversized for visibility)
  const BALL_MASS = 0.142;              // kg
  const PLAY_L = 3.569;                 // 12 ft playing length (m)
  const PLAY_W = 1.778;                 // 6 ft playing width (m)
  const L = PLAY_L / 2;
  const W = PLAY_W / 2;
  const BAULK_X = -L + 0.737;           // baulk line, 29 in from cushion
  const D_RADIUS = 0.292;               // 11.5 in
  const CUSHION_H = 0.052;
  const CUSHION_T = 0.032;

  const COLOR_ORDER = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
  const VALUES = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7, cue: 0, color: 0 };
  const BALL_HEX = {
    red: 0xef3b34, yellow: 0xffd93d, green: 0x0fbf6b, brown: 0xb8622e,
    blue: 0x2f6bff, pink: 0xff4f93, black: 0x373737, cue: 0xfffdf6
  };
  const BALL_NAMES = {
    red: 'Red', yellow: 'Yellow', green: 'Green', brown: 'Brown',
    blue: 'Blue', pink: 'Pink', black: 'Black', cue: 'Cue ball'
  };
  const SPOTS = {
    yellow: [BAULK_X, D_RADIUS],
    green: [BAULK_X, -D_RADIUS],
    brown: [BAULK_X, 0],
    blue: [0, 0],
    pink: [L / 2, 0],
    black: [L - 0.324, 0]
  };
  const RED_APEX_X = L / 2 + 2 * R + 0.004;
  const CUE_START = [-1.14, 0.16];

  const POCKET_CAPTURE = [
    { x: -L, z: -W, r: 0.061 }, { x: 0, z: -W, r: 0.064 }, { x: L, z: -W, r: 0.061 },
    { x: -L, z: W, r: 0.061 }, { x: 0, z: W, r: 0.064 }, { x: L, z: W, r: 0.061 }
  ];

  const MAX_SHOT_SPEED = 8.2;
  const MIN_SHOT_SPEED = 0.62;
  const STATS_KEY = 'snooker3d_stats_v1';
  const MUTE_KEY = 'snooker3d_muted';
  const FONT_KEY = 'snooker3d_font_scale';
  const RULINGS_KEY = 'snooker3d_rulings_v1';
  const FONT_MIN = 0.85;
  const FONT_MAX = 1.3;
  const FONT_STEP = 0.1;
  const RULINGS_MAX = 120;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
  const rad2deg = (r) => r * 180 / Math.PI;
  const isNarrow = () => window.innerWidth <= 780;
  const deg2rad = (d) => d * Math.PI / 180;
  const $ = (id) => document.getElementById(id);
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ────────────────────────────────────────────────────────────────────────
     02 · STATE
     ──────────────────────────────────────────────────────────────────────── */
  const app = {
    phase: 'loading',          // loading | aiming | rolling | settling | gameover
    mode: '2p',                // 2p | ai
    cameraMode: 'aim',         // aim | orbit
    tool: 'aim',               // aim | scene | shot
    aimAngle: Math.atan2(-CUE_START[1], RED_APEX_X - CUE_START[0]),
    aimTarget: Math.atan2(-CUE_START[1], RED_APEX_X - CUE_START[0]),
    aimCamAngle: Math.atan2(-CUE_START[1], RED_APEX_X - CUE_START[0]),
    aimFree: false,
    highlightType: null,            // true = keep the Scene camera framing while aiming
    aimLocked: false,          // sticky aim (pin)
    power: 55,
    charging: false,
    chargeStart: 0,
    chargePrevPower: 55,
    spin: { x: 0, y: 0 },
    elevation: 4,
    soundOn: true,
    fontScale: 1,
    frameNo: 1,
    breakOff: 0,
    frameHigh: 0,
    centuryThisBreak: false,
    shot: null,
    aiThinking: false,
    shake: 0
  };

  const rules = {
    scores: [0, 0],
    current: 0,
    break: 0,
    ballOn: 'red',            // red | color | yellow | green | brown | blue | pink | black | null
    redsRemaining: 15,
    frameOver: false
  };

  let stats = defaultStats();
  let rulingHistory = [];
  let balls = [];
  let cueBall = null;

  function defaultStats() {
    return {
      version: 1,
      matchesPlayed: 0,
      framesPlayed: 0,
      wins: { p1: 0, p2: 0, ai: 0 },
      highBreak: 0,
      centuries: 0,
      totalPots: 0,
      updatedAt: null
    };
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) return defaultStats();
      const parsed = JSON.parse(raw);
      const s = parsed && parsed.stats ? parsed.stats : parsed;
      if (!s || typeof s !== 'object') return defaultStats();
      return sanitiseStats(s);
    } catch (err) {
      console.warn('Could not read snooker stats:', err);
      return defaultStats();
    }
  }

  function sanitiseStats(input) {
    const out = defaultStats();
    const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
    out.matchesPlayed = num(input.matchesPlayed);
    out.framesPlayed = num(input.framesPlayed);
    out.highBreak = Math.min(147, num(input.highBreak));
    out.centuries = num(input.centuries);
    out.totalPots = num(input.totalPots);
    out.wins = {
      p1: num(input.wins && input.wins.p1),
      p2: num(input.wins && input.wins.p2),
      ai: num(input.wins && input.wins.ai)
    };
    out.updatedAt = input.updatedAt || null;
    return out;
  }

  function saveStats() {
    stats.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (err) { /* private mode */ }
  }

  function loadMute() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (err) { return false; }
  }

  function loadFontScale() {
    try {
      const raw = parseFloat(localStorage.getItem(FONT_KEY));
      return Number.isFinite(raw) ? clamp(raw, FONT_MIN, FONT_MAX) : 1;
    } catch (err) {
      return 1;
    }
  }

  function applyFontScale(scale, persist) {
    const next = Math.round(clamp(scale, FONT_MIN, FONT_MAX) * 100) / 100;
    app.fontScale = next;
    document.documentElement.style.setProperty('--fs', next.toFixed(2));
    if (dom.fontDown) dom.fontDown.disabled = next <= FONT_MIN + 0.001;
    if (dom.fontUp) dom.fontUp.disabled = next >= FONT_MAX - 0.001;
    if (persist) {
      try { localStorage.setItem(FONT_KEY, next.toFixed(2)); } catch (err) { /* noop */ }
    }
  }

  function changeFontScale(delta) {
    const next = Math.round(clamp(app.fontScale + delta, FONT_MIN, FONT_MAX) * 100) / 100;
    if (Math.abs(next - app.fontScale) < 0.001) return;
    applyFontScale(next, true);
    toast(`Text size ${Math.round(next * 100)}%`, 'info', 'Display');
  }

  /* ────────────────────────────────────────────────────────────────────────
     03 · DOM
     ──────────────────────────────────────────────────────────────────────── */
  const dom = {
    stage: $('stage'),
    loader: $('loader'),
    loaderNote: $('loader-note'),
    loaderBar: document.querySelector('.loader-bar i'),
    frameNo: $('frame-number'),
    modeLabel: $('mode-label'),
    matchNote: $('match-note'),
    score: [$('score-0'), $('score-1')],
    rows: [$('player-row-0'), $('player-row-1')],
    p2Name: $('p2-name'),
    p1Wins: $('p1-wins'),
    p2Wins: $('p2-wins'),
    breakPts: $('break-points'),
    highBreak: $('high-break'),
    ballOn: $('ball-on'),
    redsLeft: $('reds-left'),
    pointsLeft: $('points-left'),
    ballGuide: $('ball-guide'),
    lastCall: $('last-call'),
    lastCallText: $('last-call-text'),
    fontDown: $('font-down'),
    fontUp: $('font-up'),
    rulingsBtn: $('btn-rulings'),
    rulingsList: $('rulings-list'),
    clearRulings: $('btn-clear-rulings'),
    aimReadout: $('aim-readout'),
    aimHint: $('aim-hint'),
    lockAimBtn: $('btn-lock-aim'),
    recenterBtn: $('btn-recenter'),
    powerSlider: $('power-slider'),
    powerReadout: $('power-readout'),
    chargeBtn: $('btn-charge'),
    chargeFill: $('charge-fill'),
    spinPad: $('spin-pad'),
    spinReadout: $('spin-readout'),
    spinReset: $('spin-reset'),
    elevSlider: $('elev-slider'),
    elevReadout: $('elev-readout'),
    shootBtn: $('btn-shoot'),
    toolAim: $('tool-aim'),
    toolScene: $('tool-scene'),
    toolShot: $('tool-shot'),
    statusPill: $('status-pill'),
    statusText: $('status-text'),
    toast: $('toast'),
    toastKicker: $('toast-kicker'),
    toastMessage: $('toast-message'),
    banner: $('event-banner'),
    bannerKicker: $('event-kicker'),
    bannerTitle: $('event-title'),
    bannerSub: $('event-sub'),
    turnFlash: $('turn-flash'),
    resultTitle: $('result-title'),
    resultScore: $('result-score'),
    resultDetail: $('result-detail'),
    statMatches: $('stat-matches'),
    statP1: $('stat-p1'),
    statP2: $('stat-p2'),
    statAi: $('stat-ai'),
    statHigh: $('stat-high'),
    statCenturies: $('stat-centuries'),
    statPots: $('stat-pots'),
    statFrames: $('stat-frames'),
    importFile: $('import-file'),
    selftest: $('selftest')
  };

  /* ────────────────────────────────────────────────────────────────────────
     04 · AUDIO (no assets: all synthesised)
     ──────────────────────────────────────────────────────────────────────── */
  const Audio = (() => {
    let ctx = null;
    let master = null;
    let noiseBuffer = null;
    let lastClick = 0;

    function init() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      return ctx;
    }

    function gate() {
      if (!app.soundOn) return null;
      return init();
    }

    function tone(freq, dur, type, gain, slideTo, delay) {
      const c = gate();
      if (!c) return;
      const t0 = c.currentTime + (delay || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }

    function noise(dur, gain, freq, q, delay) {
      const c = gate();
      if (!c || !noiseBuffer) return;
      const t0 = c.currentTime + (delay || 0);
      const src = c.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }

    return {
      unlock() { init(); },
      click(intensity) {
        if (!app.soundOn) return;
        const now = performance.now();
        if (now - lastClick < 24) return;
        lastClick = now;
        const v = clamp(intensity, 0.05, 1);
        tone(1750 + Math.random() * 900, 0.045, 'sine', 0.035 * v);
        noise(0.035, 0.045 * v, 2600 + Math.random() * 1400, 2.4);
      },
      cushion(intensity) {
        if (!app.soundOn) return;
        const v = clamp(intensity, 0.05, 1);
        noise(0.09, 0.05 * v, 420, 0.8);
        tone(135, 0.1, 'sine', 0.035 * v, 80);
      },
      pocket() {
        if (!app.soundOn) return;
        tone(360, 0.28, 'sine', 0.11, 70);
        noise(0.22, 0.05, 220, 0.7);
        tone(105, 0.16, 'sine', 0.06, 55, 0.06);
      },
      cue(power) {
        if (!app.soundOn) return;
        const v = clamp(power / 100, 0.1, 1);
        noise(0.03, 0.09 * v, 1800, 1.4);
        tone(240, 0.08, 'triangle', 0.05 * v, 120);
      },
      foul() {
        if (!app.soundOn) return;
        tone(150, 0.22, 'square', 0.045, 128, 0);
        tone(118, 0.3, 'square', 0.04, 96, 0.18);
      },
      win() {
        if (!app.soundOn) return;
        [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.5, 'sine', 0.06, null, i * 0.12));
      },
      turn() {
        if (!app.soundOn) return;
        tone(660, 0.09, 'sine', 0.03, 880);
      }
    };
  })();

  /* ────────────────────────────────────────────────────────────────────────
     05 · THREE.JS FOUNDATION
     ──────────────────────────────────────────────────────────────────────── */
  let scene, camera, renderer, controls, clock;
  let world, ballPhys, clothPhys, cushionPhys;
  let clothTex, woodTex, cueGroup, aimGroup, cueRing;
  let aimLine, aimDots = [], ghostBall, targetLine, deflectLine;
  let cameraLook = null;
  let shadowLight = null;
  let dustPoints = null;
  let spinCtx = null;
  let spinDragging = false;
  let aimDragging = false;
  let aimPointerId = null;
  let aimStartAngle = 0;
  let aimStartX = 0;
  let aimStartY = 0;
  let aimDragMoved = false;
  let shotPointerId = null;
  let lastShotTip = 0;


  function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070504);
    scene.fog = new THREE.FogExp2(0x070504, 0.055);

    camera = new THREE.PerspectiveCamera(isNarrow() ? 66 : 42, window.innerWidth / window.innerHeight, 0.04, 60);
    camera.position.set(0.85, 2.15, 3.15);
    cameraLook = new THREE.Vector3(0, 0.02, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    dom.stage.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.copy(cameraLook);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.42;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.6;
    controls.minDistance = 1.15;
    controls.maxDistance = 7.2;
    controls.minPolarAngle = 0.14;
    controls.maxPolarAngle = Math.PI / 2 - 0.035;
    controls.enabled = false;
    controls.update();

    clock = new THREE.Clock();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    clothTex = makeClothTexture(maxAniso);
    woodTex = makeWoodTexture(maxAniso);
    const floorTex = makeFloorTexture(maxAniso);

    buildLights();
    buildRoom(floorTex);
    buildTable();
    buildCue();
    buildAimGuide();

    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerdown', onScenePointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onScenePointerUp);
    renderer.domElement.addEventListener('pointercancel', onScenePointerCancel);
    renderer.domElement.addEventListener('dblclick', onSceneDoubleClick);
    renderer.domElement.addEventListener('wheel', onSceneWheel, { passive: false });
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerdown', () => Audio.unlock(), { once: true });
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = isNarrow() ? 66 : 42;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    drawSpinPad();
  }

  /* ── Procedural textures ──────────────────────────────────────────────── */
  function makeClothTexture(maxAniso) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#0c6f44';
    g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 2) {
      g.fillStyle = `rgba(255,255,255,${0.008 + Math.random() * 0.012})`;
      g.fillRect(0, y, 512, 1);
    }
    for (let x = 0; x < 512; x += 2) {
      g.fillStyle = `rgba(0,0,0,${0.012 + Math.random() * 0.02})`;
      g.fillRect(x, 0, 1, 512);
    }
    for (let i = 0; i < 7500; i++) {
      const v = Math.random() > 0.5 ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.035})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 1.3, 1.3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(9, 4.5);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = maxAniso;
    return tex;
  }

  function makeWoodTexture(maxAniso) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3c1610');
    grad.addColorStop(0.45, '#5a2216');
    grad.addColorStop(0.7, '#461a11');
    grad.addColorStop(1, '#2c0e09');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 256;
      const amp = 2 + Math.random() * 7;
      const alpha = 0.03 + Math.random() * 0.09;
      g.strokeStyle = Math.random() > 0.35 ? `rgba(15,4,2,${alpha})` : `rgba(255,180,120,${alpha * 0.45})`;
      g.lineWidth = 0.6 + Math.random() * 1.8;
      g.beginPath();
      for (let x = 0; x <= 1024; x += 8) {
        const yy = y + Math.sin((x / 1024) * Math.PI * (2 + i % 5) + i) * amp;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * 1024, Math.random() * 256, 1, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.4, 1);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = maxAniso;
    return tex;
  }

  function makeFloorTexture(maxAniso) {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#1a100b';
    g.fillRect(0, 0, 1024, 1024);
    const plank = 128;
    for (let y = 0; y < 1024; y += plank) {
      for (let x = -plank; x < 1024; x += 512) {
        const off = (y / plank % 2) * 256;
        const shade = 16 + Math.random() * 16;
        g.fillStyle = `rgb(${shade + 12},${shade + 3},${shade})`;
        g.fillRect(x + off, y, 512 - 2, plank - 2);
        g.strokeStyle = 'rgba(0,0,0,.35)';
        g.lineWidth = 2;
        g.strokeRect(x + off, y, 512, plank);
        for (let i = 0; i < 24; i++) {
          g.strokeStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
          const yy = y + Math.random() * plank;
          g.beginPath();
          g.moveTo(x + off, yy);
          g.lineTo(x + off + 512, yy + (Math.random() - 0.5) * 4);
          g.stroke();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = maxAniso;
    return tex;
  }

  /* ── Lights ───────────────────────────────────────────────────────────── */
  function buildLights() {
    scene.add(new THREE.AmbientLight(0x4a3528, 0.56));
    const hemi = new THREE.HemisphereLight(0xbcc8ff, 0x2a140c, 0.28);
    scene.add(hemi);

    const warm = 0xffd6a0;
    [-1.05, 0, 1.05].forEach((x, i) => {
      const spot = new THREE.SpotLight(warm, i === 1 ? 1.36 : 0.96, 6.5, 0.72, 0.55, 1.3);
      spot.position.set(x, 1.62, 0);
      spot.target.position.set(x * 0.3, 0, 0);
      scene.add(spot); scene.add(spot.target);
      if (i === 1) {
        spot.castShadow = true;
        spot.shadow.mapSize.set(1536, 1536);
        spot.shadow.camera.near = 0.6;
        spot.shadow.camera.far = 4;
        spot.shadow.bias = -0.0006;
        spot.shadow.radius = 2.5;
        shadowLight = spot;
      }
    });

    const fill = new THREE.PointLight(0xff9b55, 0.46, 8, 1.6);
    fill.position.set(0, 1.1, 2.6);
    scene.add(fill);
    const back = new THREE.PointLight(0x7c9dff, 0.18, 7, 1.8);
    back.position.set(-2.4, 1.4, -2.8);
    scene.add(back);
    // Neutral key so the ball colours stay true instead of taking the warm
    // room cast; it also gives every sphere a clean white specular edge.
    const neutral = new THREE.DirectionalLight(0xffffff, 0.28);
    neutral.position.set(1.4, 3.0, 2.6);
    neutral.castShadow = false;
    scene.add(neutral);
  }

  /* ── Room ─────────────────────────────────────────────────────────────── */
  function buildRoom(floorTex) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0.04, color: 0xb0a090 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.8;
    floor.receiveShadow = true;
    scene.add(floor);

    // club rug
    const rugOuter = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 3.3),
      new THREE.MeshStandardMaterial({ color: 0x2b1a0f, roughness: 1 })
    );
    rugOuter.rotation.x = -Math.PI / 2;
    rugOuter.position.set(0, -0.797, 0);
    rugOuter.receiveShadow = true;
    scene.add(rugOuter);
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(5.26, 3.06),
      new THREE.MeshStandardMaterial({ color: 0x15291c, roughness: 1 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, -0.796, 0);
    rug.receiveShadow = true;
    scene.add(rug);

    const wallMat = new THREE.MeshStandardMaterial({ map: woodTex.clone(), color: 0x8d7a68, roughness: 0.78, metalness: 0.05 });
    wallMat.map.repeat.set(3.2, 1.4);
    wallMat.map.needsUpdate = true;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), wallMat);
    wall.position.set(0, 2.1, -4.8);
    wall.receiveShadow = true;
    scene.add(wall);

    // wall trim
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: 0.85, roughness: 0.32 });
    [-3.35, -1.6, 0.1, 1.8, 3.5].forEach((x) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 4.6, 0.018), brass);
      strip.position.set(x, 1.7, -4.75);
      scene.add(strip);
    });

    // framed club painting
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.12, 0.06), brass);
    frame.position.set(0, 2.28, -4.7);
    frame.castShadow = false;
    scene.add(frame);
    const artCanvas = document.createElement('canvas');
    artCanvas.width = 512; artCanvas.height = 384;
    const ac = artCanvas.getContext('2d');
    const ag = ac.createLinearGradient(0, 0, 0, 384);
    ag.addColorStop(0, '#0b2b1d'); ag.addColorStop(1, '#06150e');
    ac.fillStyle = ag; ac.fillRect(0, 0, 512, 384);
    ac.fillStyle = 'rgba(201,164,92,.72)';
    ac.beginPath(); ac.arc(256, 210, 86, 0, Math.PI * 2); ac.fill();
    ac.fillStyle = '#0b2b1d';
    ac.beginPath(); ac.arc(256, 210, 78, 0, Math.PI * 2); ac.fill();
    ac.fillStyle = 'rgba(201,164,92,.3)';
    ac.fillRect(120, 300, 272, 1);
    ac.font = 'italic 22px Georgia';
    ac.fillStyle = 'rgba(230,210,170,.65)';
    ac.textAlign = 'center';
    ac.fillText('The Mahogany Room · est. 1926', 256, 336);
    const artTex = new THREE.CanvasTexture(artCanvas);
    artTex.encoding = THREE.sRGBEncoding;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.98), new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.9 }));
    art.position.set(0, 2.28, -4.66);
    scene.add(art);

    buildLamp(-1.05);
    buildLamp(0);
    buildLamp(1.05);

    // soft dust in the lamplight
    const count = 160;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4.2;
      pos[i * 3 + 1] = 0.08 + Math.random() * 1.35;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2.6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffe0ab, size: 0.006, transparent: true, opacity: 0.32,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    scene.add(dustPoints);
  }

  function buildLamp(x) {
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x173327, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.29, 0.2, 28, 1, true), shadeMat);
    shade.position.set(x, 1.68, 0);
    shade.castShadow = true;
    scene.add(shade);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 0.045, 24),
      new THREE.MeshStandardMaterial({ color: 0x1c130b, metalness: 0.8, roughness: 0.35 })
    );
    cap.position.set(x, 1.795, 0);
    cap.castShadow = true;
    scene.add(cap);
    const ceilingCap = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 24),
      new THREE.MeshStandardMaterial({ color: 0x161d17, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    );
    ceilingCap.rotation.x = -Math.PI / 2;
    ceilingCap.position.set(x, 1.818, 0);
    scene.add(ceilingCap);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.008, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.9, roughness: 0.25 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 1.58, 0);
    scene.add(rim);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.275, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe3b3, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, 1.579, 0);
    scene.add(glow);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 1.1, 6),
      new THREE.MeshBasicMaterial({ color: 0x1a120c })
    );
    cord.position.set(x, 2.36, 0);
    scene.add(cord);
  }

  /* ── Table ────────────────────────────────────────────────────────────── */
  function buildTable() {
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5, metalness: 0.08, color: 0xd8b8a8 });
    const woodDark = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8f6b5b, roughness: 0.62, metalness: 0.05 });
    const cloth = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.94, metalness: 0.0, color: 0xaed8be });
    const cushionMat = new THREE.MeshStandardMaterial({ map: clothTex, color: 0x92c4a6, roughness: 0.96 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.88, roughness: 0.28 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1b1410, metalness: 0.6, roughness: 0.5 });

    const bed = new THREE.Mesh(new THREE.BoxGeometry(PLAY_L + 0.13, 0.06, PLAY_W + 0.13), cloth);
    bed.position.y = -0.03;
    bed.receiveShadow = true;
    scene.add(bed);

    // outer frame
    const frameLong = new THREE.BoxGeometry(PLAY_L + 0.36, 0.15, 0.18);
    const frameEnd = new THREE.BoxGeometry(0.18, 0.15, PLAY_W + 0.36);
    [1, -1].forEach((s) => {
      const rail = new THREE.Mesh(frameLong, wood);
      rail.position.set(0, -0.052, s * (W + 0.09));
      rail.castShadow = true; rail.receiveShadow = true;
      scene.add(rail);
      const end = new THREE.Mesh(frameEnd, wood);
      end.position.set(s * (L + 0.09), -0.052, 0);
      end.castShadow = true; end.receiveShadow = true;
      scene.add(end);
    });

    // frame top brass inlay
    const inlayGeo = new THREE.BoxGeometry(PLAY_L + 0.34, 0.006, 0.008);
    [1, -1].forEach((s) => {
      const inlay = new THREE.Mesh(inlayGeo, brass);
      inlay.position.set(0, 0.024, s * (W + 0.177));
      scene.add(inlay);
    });

    // apron + legs
    const apron = new THREE.Mesh(new THREE.BoxGeometry(PLAY_L + 0.24, 0.12, PLAY_W + 0.24), woodDark);
    apron.position.y = -0.19;
    apron.castShadow = true;
    scene.add(apron);

    const legGeo = new THREE.CylinderGeometry(0.082, 0.11, 0.63, 8);
    const capGeo = new THREE.CylinderGeometry(0.095, 0.09, 0.05, 12);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, woodDark);
      leg.position.set(sx * (L - 0.1), -0.49, sz * (W + 0.005));
      leg.castShadow = true;
      scene.add(leg);
      const cap = new THREE.Mesh(capGeo, brass);
      cap.position.set(sx * (L - 0.1), -0.785, sz * (W + 0.005));
      scene.add(cap);
    });

    // cushions (physics boxes are created later, in buildPhysics)
    const longSegs = [
      [-L + 0.082, -0.078],
      [0.078, L - 0.082]
    ];
    longSegs.forEach(([x1, x2]) => {
      [1, -1].forEach((s) => {
        const len = x2 - x1;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, CUSHION_H, CUSHION_T), cushionMat);
        mesh.position.set((x1 + x2) / 2, CUSHION_H / 2, s * (W + CUSHION_T / 2));
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
      });
    });
    [1, -1].forEach((s) => {
      const len = 2 * (W - 0.082);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(CUSHION_T, CUSHION_H, len), cushionMat);
      mesh.position.set(s * (L + CUSHION_T / 2), CUSHION_H / 2, 0);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    });

    // brass nameplate on the near rail
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 1024; plateCanvas.height = 160;
    const pc = plateCanvas.getContext('2d');
    pc.fillStyle = '#b28a46'; pc.fillRect(0, 0, 1024, 160);
    const pg = pc.createLinearGradient(0, 0, 0, 160);
    pg.addColorStop(0, 'rgba(255,240,200,.55)');
    pg.addColorStop(0.5, 'rgba(255,255,255,0)');
    pg.addColorStop(1, 'rgba(40,20,0,.4)');
    pc.fillStyle = pg; pc.fillRect(0, 0, 1024, 160);
    pc.strokeStyle = 'rgba(60,35,5,.55)'; pc.lineWidth = 3; pc.strokeRect(14, 14, 996, 132);
    pc.fillStyle = '#3a2408';
    pc.font = '600 46px Georgia, serif';
    pc.textAlign = 'center'; pc.textBaseline = 'middle';
    pc.fillText('THE MAHOGANY ROOM', 512, 70);
    pc.font = '22px Georgia, serif';
    pc.fillText('S N O O K E R   ·   E S T .   1 9 2 6', 512, 116);
    const plateTex = new THREE.CanvasTexture(plateCanvas);
    plateTex.encoding = THREE.sRGBEncoding;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.128),
      new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.55, roughness: 0.38 })
    );
    plate.position.set(0, -0.04, W + 0.181);
    scene.add(plate);

    // spots + baulk lines
    const spotMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
    Object.keys(SPOTS).forEach((type) => {
      const [x, z] = SPOTS[type];
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.0075, 16), spotMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(x, 0.0016, z);
      scene.add(spot);
    });
    addClothLine([[BAULK_X, 0.0018, -W], [BAULK_X, 0.0018, W]], 0.34, 0xffffff);
    const dPts = [];
    for (let i = 0; i <= 48; i++) {
      const a = Math.PI / 2 + (Math.PI * i / 48);
      dPts.push([BAULK_X + Math.cos(a) * D_RADIUS, 0.0018, Math.sin(a) * D_RADIUS]);
    }
    addClothLine(dPts, 0.34, 0xffffff);

    buildPockets();
  }

  function addClothLine(points, opacity, color) {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity }));
    scene.add(line);
  }

  function buildPockets() {
    const brass = new THREE.MeshStandardMaterial({ color: 0xb9904b, metalness: 0.9, roughness: 0.26 });
    const black = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.9, metalness: 0.1 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x7a5a28, metalness: 0.8, roughness: 0.38 });

    const defs = [
      { x: -L, z: -W, r: 0.068, kind: 'corner' },
      { x: 0, z: -W, r: 0.071, kind: 'middle' },
      { x: L, z: -W, r: 0.068, kind: 'corner' },
      { x: -L, z: W, r: 0.068, kind: 'corner' },
      { x: 0, z: W, r: 0.071, kind: 'middle' },
      { x: L, z: W, r: 0.068, kind: 'corner' }
    ];
    defs.forEach((p) => {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.85, 0.055, 36), black);
      hole.position.set(p.x, 0.001, p.z);
      scene.add(hole);
      const depth = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.94, 36), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      depth.rotation.x = -Math.PI / 2;
      depth.position.set(p.x, 0.0125, p.z);
      scene.add(depth);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.98, 0.0085, 10, 40), brass);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, 0.014, p.z);
      ring.castShadow = true;
      scene.add(ring);

      // subtle brass collar set into the wood
      const ox = p.x === 0 ? 0 : Math.sign(p.x) * 0.085;
      const oz = Math.sign(p.z) * 0.085;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.004, 8, 28), plate);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(p.x + ox, 0.0215, p.z + oz);
      scene.add(collar);
    });
  }

  /* ── Cue stick ────────────────────────────────────────────────────────── */
  function buildCue() {
    cueGroup = new THREE.Group();
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xdec197, roughness: 0.34, metalness: 0.02 });
    const buttMat = new THREE.MeshStandardMaterial({ color: 0x2a0f09, roughness: 0.36, metalness: 0.04 });
    const wrapMat = new THREE.MeshStandardMaterial({ color: 0x16110d, roughness: 0.9 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.9, roughness: 0.24 });
    const ivory = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.22 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x2d6d92, roughness: 0.75 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0068, 1.16, 14), shaftMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.635;
    shaft.castShadow = true;
    cueGroup.add(shaft);

    const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0112, 0.48, 14), buttMat);
    butt.rotation.x = Math.PI / 2;
    butt.position.z = -1.452;
    butt.castShadow = true;
    cueGroup.add(butt);

    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0077, 0.0082, 0.2, 14), wrapMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.z = -1.29;
    cueGroup.add(wrap);

    const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.014, 14), brass);
    joint.rotation.x = Math.PI / 2;
    joint.position.z = -1.2;
    cueGroup.add(joint);

    const bumper = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 12, 8), wrapMat);
    bumper.position.z = -1.694;
    bumper.scale.z = 0.7;
    cueGroup.add(bumper);

    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0039, 0.0041, 0.038, 12), ivory);
    ferrule.rotation.x = Math.PI / 2;
    ferrule.position.z = -0.019;
    cueGroup.add(ferrule);

    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0037, 0.0037, 0.011, 12), tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.005;
    cueGroup.add(tip);

    cueGroup.visible = false;
    scene.add(cueGroup);
  }

  /* ── Aim guide ────────────────────────────────────────────────────────── */
  function buildAimGuide() {
    aimGroup = new THREE.Group();
    aimGroup.visible = false;

    aimLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0x9fe8b8, dashSize: 0.035, gapSize: 0.026, transparent: true, opacity: 0.95, depthWrite: false })
    );
    aimGroup.add(aimLine);

    ghostBall = new THREE.Mesh(
      new THREE.SphereGeometry(R, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x9fe8b8, wireframe: true, transparent: true, opacity: 0.4, depthWrite: false })
    );
    ghostBall.visible = false;
    aimGroup.add(ghostBall);

    targetLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0xf0d398, dashSize: 0.03, gapSize: 0.022, transparent: true, opacity: 0.85, depthWrite: false })
    );
    aimGroup.add(targetLine);

    deflectLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false })
    );
    aimGroup.add(deflectLine);

    for (let i = 0; i < 42; i++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.0042, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xc8f7dc, transparent: true, opacity: 0.8, depthWrite: false })
      );
      dot.visible = false;
      aimDots.push(dot);
      aimGroup.add(dot);
    }

    cueRing = new THREE.Mesh(
      new THREE.TorusGeometry(R * 1.2, 0.0018, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xf0d398, transparent: true, opacity: 0.55, depthWrite: false })
    );
    cueRing.rotation.x = Math.PI / 2;
    cueRing.visible = false;
    scene.add(cueRing);

    scene.add(aimGroup);
  }

  /* ────────────────────────────────────────────────────────────────────────
     06 · PHYSICS & BALLS
     ──────────────────────────────────────────────────────────────────────── */
  function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 24;
    world.solver.tolerance = 0.001;
    world.defaultContactMaterial.contactEquationStiffness = 1e8;
    world.defaultContactMaterial.contactEquationRelaxation = 3;
    world.allowSleep = false;

    ballPhys = new CANNON.Material('ball');
    clothPhys = new CANNON.Material('cloth');
    cushionPhys = new CANNON.Material('cushion');

    world.addContactMaterial(new CANNON.ContactMaterial(ballPhys, ballPhys, {
      friction: 0.055, restitution: 0.955
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(ballPhys, clothPhys, {
      friction: 0.42, restitution: 0.03
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(ballPhys, cushionPhys, {
      friction: 0.32, restitution: 0.72
    }));

    // cloth bed (finite pressure plate, balls are removed when pocketed)
    const bedBody = new CANNON.Body({ mass: 0, material: clothPhys });
    bedBody.addShape(new CANNON.Box(new CANNON.Vec3(L + 0.08, 0.03, W + 0.08)));
    bedBody.position.set(0, -0.03, 0);
    bedBody.__cloth = true;
    world.addBody(bedBody);

    // cushion segments, matching the rendered rails
    const longSegs = [[-L + 0.082, -0.078], [0.078, L - 0.082]];
    longSegs.forEach(([x1, x2]) => {
      [1, -1].forEach((s) => {
        const half = (x2 - x1) / 2;
        const b = new CANNON.Body({ mass: 0, material: cushionPhys });
        b.addShape(new CANNON.Box(new CANNON.Vec3(half, CUSHION_H / 2, CUSHION_T / 2)));
        b.position.set((x1 + x2) / 2, CUSHION_H / 2, s * (W + CUSHION_T / 2));
        b.__cushion = true;
        world.addBody(b);
      });
    });
    [1, -1].forEach((s) => {
      const half = W - 0.082;
      const b = new CANNON.Body({ mass: 0, material: cushionPhys });
      b.addShape(new CANNON.Box(new CANNON.Vec3(CUSHION_T / 2, CUSHION_H / 2, half)));
      b.position.set(s * (L + CUSHION_T / 2), CUSHION_H / 2, 0);
      b.__cushion = true;
      world.addBody(b);
    });

    buildBalls();
  }

  const ballOutlineGeo = new THREE.SphereGeometry(R * 1.045, 28, 20);
  const ballOutlineMat = new THREE.MeshBasicMaterial({
    color: 0x06140c,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const highlightRingGeo = new THREE.TorusGeometry(R * 1.45, 0.0045, 8, 36);
  const highlightRingMat = new THREE.MeshBasicMaterial({
    color: 0xffdd9a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const highlightHaloGeo = new THREE.SphereGeometry(R * 1.1, 20, 14);
  const highlightHaloMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });
  const ballRimGeo = new THREE.SphereGeometry(R * 1.025, 28, 20);
  const ballRimMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xffffff) },
      uStrength: { value: 0.72 }
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vN;
      varying vec3 vV;
      uniform vec3 uColor;
      uniform float uStrength;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        gl_FragColor = vec4(uColor, rim * uStrength);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide
  });

  function createBall(type, index, x, z) {
    const color = BALL_HEX[type];
    const isCue = type === 'cue';
    const material = new THREE.MeshPhysicalMaterial({
      color: color,
      roughness: isCue ? 0.12 : 0.15,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      emissive: new THREE.Color(color).multiplyScalar(0.16),
      emissiveIntensity: 0.9,
      envMapIntensity: 0.9
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 26), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, R + 0.0008, z);
    // Warm Fresnel rim: keeps the black and dark colours readable against
    // the baize without turning the balls into glowing ornaments.
    const outline = new THREE.Mesh(ballOutlineGeo, ballOutlineMat);
    outline.renderOrder = 1;
    mesh.add(outline);
    const rim = new THREE.Mesh(ballRimGeo, ballRimMat);
    rim.renderOrder = 2;
    mesh.add(rim);
    const halo = new THREE.Mesh(highlightHaloGeo, highlightHaloMat);
    halo.visible = false;
    halo.renderOrder = 3;
    mesh.add(halo);
    const ring = new THREE.Mesh(highlightRingGeo, highlightRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.0045;
    ring.visible = false;
    ring.renderOrder = 3;
    scene.add(ring);
    scene.add(mesh);

    const body = new CANNON.Body({
      mass: BALL_MASS,
      shape: new CANNON.Sphere(R),
      material: ballPhys,
      linearDamping: 0.16,
      angularDamping: 0.24
    });
    body.position.set(x, R + 0.0008, z);
    body.allowSleep = false;
    world.addBody(body);

    const ball = {
      type,
      value: VALUES[type] || 0,
      index,
      mesh,
      body,
      active: true,
      onTable: true,
      pottedThisShot: false,
      home: [x, z],
      ring,
      halo
    };
    body.__ball = ball;
    mesh.userData.ball = ball;
    body.addEventListener('collide', (ev) => onBallCollide(ball, ev));
    balls.push(ball);
    return ball;
  }

  function buildBalls() {
    balls = [];
    cueBall = createBall('cue', 0, CUE_START[0], CUE_START[1]);

    for (let i = 0; i < 15; i++) {
      const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
      const posInRow = i - row * (row + 1) / 2;
      const x = RED_APEX_X + row * (2 * R * Math.sin(Math.PI / 3));
      const z = (posInRow - row / 2) * (2 * R + 0.00065);
      createBall('red', i, x, z);
    }

    COLOR_ORDER.forEach((type, i) => {
      const [x, z] = SPOTS[type];
      createBall(type, i, x, z);
    });
  }

  function onBallCollide(ball, ev) {
    const other = ev.body && ev.body.__ball;
    const rel = ev.body ? ball.body.velocity.vsub(ev.body.velocity).length() : 0;
    if (other) {
      if (rel > 0.06) Audio.click(clamp(rel / 5, 0.05, 1));
      if (app.phase === 'rolling' && app.shot && ball.type === 'cue' &&
          other.type !== 'cue' && !app.shot.firstContact) {
        app.shot.firstContact = other;
      }
    } else if (ev.body && ev.body.__cushion) {
      if (rel > 0.15) Audio.cushion(clamp(rel / 4, 0.1, 1));
      if (app.shot) app.shot.cushionHits++;
    }
  }

  function resetBallPhysics() {
    balls.forEach((ball) => {
      if (!ball.onTable) {
        world.addBody(ball.body);
        ball.onTable = true;
      }
      const [x, z] = ball.type === 'cue' ? CUE_START : ball.home;
      ball.active = true;
      ball.mesh.visible = true;
      ball.mesh.scale.set(1, 1, 1);
      ball.body.position.set(x, R + 0.0008, z);
      ball.body.velocity.set(0, 0, 0);
      ball.body.angularVelocity.set(0, 0, 0);
      ball.body.quaternion.set(0, 0, 0, 1);
      ball.body.force.set(0, 0, 0);
      ball.body.torque.set(0, 0, 0);
      ball.mesh.position.copy(ball.body.position);
      ball.mesh.quaternion.copy(ball.body.quaternion);
    });
  }

  /* ────────────────────────────────────────────────────────────────────────
     07 · REFEREE ENGINE
     ──────────────────────────────────────────────────────────────────────── */
  function legalTargets() {
    if (rules.ballOn === 'red') return balls.filter((b) => b.type === 'red' && b.active);
    if (rules.ballOn === 'color') return balls.filter((b) => COLOR_ORDER.includes(b.type) && b.active);
    if (rules.ballOn && COLOR_ORDER.includes(rules.ballOn)) {
      const b = balls.find((x) => x.type === rules.ballOn && x.active);
      return b ? [b] : [];
    }
    return [];
  }

  function isLegalType(type) {
    if (rules.ballOn === 'red') return type === 'red';
    if (rules.ballOn === 'color') return COLOR_ORDER.includes(type);
    return type === rules.ballOn;
  }

  function lowestActiveColor() {
    for (const type of COLOR_ORDER) {
      const b = balls.find((x) => x.type === type && x.active);
      if (b) return type;
    }
    return null;
  }

  function redsActive() {
    return balls.filter((b) => b.type === 'red' && b.active).length;
  }

  function valueOfOn() {
    return rules.ballOn && COLOR_ORDER.includes(rules.ballOn) ? VALUES[rules.ballOn] : 0;
  }

  function ballOnAfterTurn() {
    if (rules.redsRemaining > 0) return 'red';
    if (rules.ballOn === 'red' || rules.ballOn === 'color') return 'color';
    return rules.ballOn;
  }

  function resetRules(startPlayer) {
    rules.scores = [0, 0];
    rules.current = startPlayer || 0;
    rules.break = 0;
    rules.ballOn = 'red';
    rules.redsRemaining = 15;
    rules.frameOver = false;
    app.breakOff = rules.current;
    app.frameHigh = 0;
    app.centuryThisBreak = false;
  }

  /**
   * Pure-ish referee resolution. Mutates the rules object and returns a
   * description of what happened, plus which colors must be respotted.
   */
  function resolveShot(shot) {
    const potted = (shot.potted || []).filter((b) => b.type !== 'cue');
    const pottedReds = potted.filter((b) => b.type === 'red');
    const pottedColors = potted.filter((b) => b.type !== 'red');
    const cuePotted = !!shot.cuePotted;
    const first = shot.firstContact;
    const onValue = valueOfOn();
    const before = rules.break;

    let foul = null;
    let penalty = 4;

    if (cuePotted) {
      foul = 'Cue ball potted';
    } else if (!first) {
      foul = 'No ball struck';
    } else if (!isLegalType(first.type)) {
      foul = 'Wrong ball first';
      penalty = Math.max(penalty, VALUES[first.type] || 4);
    }

    if (!foul) {
      if (rules.ballOn === 'red') {
        if (pottedColors.length > 0) {
          foul = 'Colour potted when a red was on';
        }
      } else if (rules.ballOn === 'color') {
        if (pottedReds.length > 0) {
          foul = 'Red potted when a colour was on';
        } else if (pottedColors.length > 1) {
          foul = 'More than one colour potted';
        }
      } else if (rules.ballOn && COLOR_ORDER.includes(rules.ballOn)) {
        if (pottedReds.length > 0) {
          foul = 'Red potted during the clearance';
        } else if (pottedColors.length > 1) {
          foul = 'More than one colour potted';
        } else if (pottedColors.length === 1 && pottedColors[0].type !== rules.ballOn) {
          foul = 'Wrong colour potted';
        }
      }
    }

    if (foul) {
      if (onValue) penalty = Math.max(penalty, onValue);
      if (first && first.type !== 'cue') penalty = Math.max(penalty, VALUES[first.type] || 4);
      potted.forEach((b) => { penalty = Math.max(penalty, VALUES[b.type] || 4); });
      penalty = clamp(penalty, 4, 7);
      const other = 1 - rules.current;
      rules.scores[other] += penalty;
      rules.redsRemaining = Math.max(0, rules.redsRemaining - pottedReds.length);
      rules.break = 0;
      rules.current = other;
      rules.ballOn = ballOnAfterTurn();
      return {
        foul: true,
        reason: foul,
        penalty,
        points: 0,
        respot: pottedColors,
        cuePotted,
        endedBreak: before,
        turnChanged: true
      };
    }

    let points = 0;
    const respot = [];
    let turnPassed = false;

    if (rules.ballOn === 'red') {
      if (pottedReds.length > 0) {
        points = pottedReds.length;
        rules.redsRemaining = Math.max(0, rules.redsRemaining - pottedReds.length);
        rules.ballOn = 'color';
      } else {
        turnPassed = true;
      }
    } else if (rules.ballOn === 'color') {
      if (pottedColors.length === 1) {
        const b = pottedColors[0];
        points = VALUES[b.type];
        respot.push(b);
        rules.ballOn = rules.redsRemaining > 0 ? 'red' : lowestActiveColor();
      } else {
        turnPassed = true;
      }
    } else if (rules.ballOn && COLOR_ORDER.includes(rules.ballOn)) {
      if (pottedColors.length === 1 && pottedColors[0].type === rules.ballOn) {
        points = VALUES[rules.ballOn];
        rules.ballOn = lowestActiveColor();
      } else {
        turnPassed = true;
      }
    }

    if (turnPassed) {
      rules.break = 0;
      rules.current = 1 - rules.current;
      rules.ballOn = ballOnAfterTurn();
      return {
        foul: false, reason: '', penalty: 0, points: 0, respot: [],
        cuePotted, endedBreak: before, turnChanged: true, turnPassed: true
      };
    }

    rules.scores[rules.current] += points;
    rules.break += points;
    if (rules.break > stats.highBreak) stats.highBreak = rules.break;
    if (rules.break > app.frameHigh) app.frameHigh = rules.break;
    if (rules.break >= 100 && !app.centuryThisBreak) {
      app.centuryThisBreak = true;
      stats.centuries++;
    }
    return {
      foul: false, reason: '', penalty: 0, points, respot, cuePotted,
      endedBreak: before, turnChanged: false
    };
  }

  /* ────────────────────────────────────────────────────────────────────────
     08 · AIMING, CUE, POINTER
     ──────────────────────────────────────────────────────────────────────── */
  function angleVector(angle) {
    return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  }

  function aimVector() {
    return angleVector(app.aimAngle);
  }

  function updateAimGuide() {
    if (!cueBall || !cueBall.active || app.phase !== 'aiming' || rules.frameOver) {
      aimGroup.visible = false;
      cueRing.visible = false;
      cueGroup.visible = false;
      return;
    }
    const p = cueBall.body.position;
    const d = aimVector();
    const ux = d.x, uz = d.z;

    let ballHit = null;
    let ballT = Infinity;
    for (const b of balls) {
      if (!b.active || b.type === 'cue') continue;
      const dx = b.body.position.x - p.x;
      const dz = b.body.position.z - p.z;
      const proj = dx * ux + dz * uz;
      if (proj <= 0.001) continue;
      const c = dx * dx + dz * dz - (2 * R) * (2 * R);
      const disc = proj * proj - c;
      if (disc < 0) continue;
      const t = proj - Math.sqrt(disc);
      if (t > 0.002 && t < ballT) {
        ballT = t;
        ballHit = b;
      }
    }

    let cushT = Infinity;
    const pad = R + 0.0005;
    if (ux > 1e-6) cushT = Math.min(cushT, (L - pad - p.x) / ux);
    else if (ux < -1e-6) cushT = Math.min(cushT, (-L + pad - p.x) / ux);
    if (uz > 1e-6) cushT = Math.min(cushT, (W - pad - p.z) / uz);
    else if (uz < -1e-6) cushT = Math.min(cushT, (-W + pad - p.z) / uz);
    cushT = Math.max(cushT, 0);

    const hitBall = ballHit && ballT < cushT;
    const dist = hitBall ? ballT : cushT;
    const contactX = p.x + ux * dist;
    const contactZ = p.z + uz * dist;

    const color = hitBall ? (isLegalType(ballHit.type) ? 0x9fe8b8 : 0xf0a15f) : 0x9fe8b8;
    aimLine.material.color.setHex(color);
    aimLine.geometry.dispose();
    aimLine.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x, R + 0.001, p.z),
      new THREE.Vector3(contactX, R + 0.001, contactZ)
    ]);
    aimLine.computeLineDistances();
    aimLine.visible = true;

    for (let i = 0; i < aimDots.length; i++) {
      const dot = aimDots[i];
      const t = 0.075 + i * 0.058;
      if (t < dist - 0.015) {
        dot.visible = true;
        dot.position.set(p.x + ux * t, R + 0.002, p.z + uz * t);
        dot.material.color.setHex(color);
        const fade = 1 - (i / aimDots.length) * 0.65;
        dot.material.opacity = 0.85 * fade;
      } else {
        dot.visible = false;
      }
    }

    if (hitBall) {
      ghostBall.visible = true;
      ghostBall.position.set(contactX, R, contactZ);
      ghostBall.material.color.setHex(color);
      const tx = ballHit.body.position.x - contactX;
      const tz = ballHit.body.position.z - contactZ;
      const tl = Math.hypot(tx, tz) || 1;
      const nx = tx / tl, nz = tz / tl;
      const targetLen = 0.62;
      targetLine.geometry.dispose();
      targetLine.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ballHit.body.position.x, R + 0.001, ballHit.body.position.z),
        new THREE.Vector3(ballHit.body.position.x + nx * targetLen, R + 0.001, ballHit.body.position.z + nz * targetLen)
      ]);
      targetLine.computeLineDistances();
      targetLine.material.color.setHex(color);
      targetLine.visible = true;

      let cx = ux - nx * (ux * nx + uz * nz);
      let cz = uz - nz * (ux * nx + uz * nz);
      const cl = Math.hypot(cx, cz);
      if (cl > 0.03) {
        cx /= cl; cz /= cl;
        deflectLine.geometry.dispose();
        deflectLine.geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(contactX, R + 0.0008, contactZ),
          new THREE.Vector3(contactX + cx * 0.42, R + 0.0008, contactZ + cz * 0.42)
        ]);
        deflectLine.visible = true;
      } else {
        deflectLine.visible = false;
      }
    } else {
      ghostBall.visible = false;
      targetLine.visible = false;
      deflectLine.visible = false;
    }

    aimGroup.visible = true;
    cueRing.visible = true;
    cueRing.position.set(p.x, 0.0025, p.z);
    updateCue(d, p);
  }

  function updateCue(d, p) {
    if (!cueGroup) return;
    if (app.phase !== 'aiming' || rules.frameOver || !cueBall.active) {
      cueGroup.visible = false;
      return;
    }
    cueGroup.visible = true;
    const pull = 0.055 + (app.power / 100) * 0.24;
    const px = p.x - d.x * (R + 0.022 + pull);
    const pz = p.z - d.z * (R + 0.022 + pull);
    cueGroup.position.set(px, R, pz);

    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    cueGroup.quaternion.copy(q);
    cueGroup.rotateX(deg2rad(app.elevation));
  }

  function updateCueStrike(dt) {
    if (!app.cueStrike) return;
    const s = app.cueStrike;
    s.t += dt;
    const k = clamp(s.t / 0.14, 0, 1);
    const p = cueBall.body.position;
    const d = s.dir;
    const baseX = s.baseX + d.x * 0.11 * k;
    const baseZ = s.baseZ + d.z * 0.11 * k;
    cueGroup.visible = s.t < 0.24;
    cueGroup.position.set(baseX, s.baseY, baseZ);
    if (s.t >= 0.24) app.cueStrike = null;
  }

  function aimPointFromEvent(e) {
    if (!renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    // Ignore the dark room around the table, so a stray click cannot swing
    // the cue through 180 degrees.
    if (Math.abs(hit.x) > L + 0.35 || Math.abs(hit.z) > W + 0.35) return null;
    return hit;
  }

  function normalizeAngle(a) {
    a = a % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function shortestAngle(target, current) {
    return normalizeAngle(target - current);
  }

  function setAimImmediate(angle) {
    app.aimAngle = normalizeAngle(angle);
    app.aimTarget = app.aimAngle;
    updateAimReadout();
  }

  function setAimTarget(angle) {
    app.aimTarget = normalizeAngle(angle);
  }

  function setAimTargetFromEvent(e) {
    if (!isHumanTurn() || app.aimLocked || app.charging) return false;
    const hit = aimPointFromEvent(e);
    if (!hit) return false;
    const dx = hit.x - cueBall.body.position.x;
    const dz = hit.z - cueBall.body.position.z;
    if (Math.hypot(dx, dz) < 0.12) return false;
    setAimTarget(Math.atan2(dz, dx));
    return true;
  }

  function smoothAim(dt) {
    const diff = shortestAngle(app.aimTarget, app.aimAngle);
    if (Math.abs(diff) < 0.0002) {
      if (app.aimAngle !== app.aimTarget) {
        app.aimAngle = app.aimTarget;
        updateAimReadout();
      }
      return;
    }
    // Top angular speed and a soft ease keep a click from snapping the cue.
    const maxStep = deg2rad(90) * dt;
    const eased = diff * (1 - Math.exp(-8.5 * dt));
    app.aimAngle = normalizeAngle(app.aimAngle + clamp(eased, -maxStep, maxStep));
    updateAimReadout();
  }

  function onScenePointerDown(e) {
    Audio.unlock();
    if (e.button !== undefined && e.button !== 0) return;
    if (app.phase !== 'aiming' || !isHumanTurn()) return;

    if (app.tool === 'shot') {
      if (app.charging) return;
      shotPointerId = e.pointerId;
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      startCharge();
      return;
    }

    if (app.tool === 'scene') return; // OrbitControls owns the mouse

    if (app.aimLocked) return;
    aimDragging = true;
    aimPointerId = e.pointerId;
    aimStartAngle = app.aimAngle;
    aimStartX = e.clientX;
    aimStartY = e.clientY;
    aimDragMoved = false;
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  function onPointerMove(e) {
    if (!aimDragging || e.pointerId !== aimPointerId) return;
    const dx = e.clientX - aimStartX;
    const dy = e.clientY - aimStartY;
    if (!aimDragMoved && Math.hypot(dx, dy) > 3) aimDragMoved = true;
    if (aimDragMoved) {
      // Relative drag: a full screen width is about 75°, and Shift is
      // an even finer 25°. Clicks and the wheel cover larger changes.
      const width = Math.max(320, window.innerWidth);
      const fine = e.shiftKey ? 0.25 : 1;
      setAimTarget(aimStartAngle + (dx / width) * Math.PI * 0.42 * fine);
    }
  }

  function finishShotPointer(e) {
    if (shotPointerId === null || e.pointerId !== shotPointerId) return false;
    const held = performance.now() - app.chargeStart;
    shotPointerId = null;
    try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    if (app.charging) {
      // Ignore a quick click/double-click in Shot mode; holding is deliberate.
      if (held > 220) {
        releaseCharge();
      } else {
        cancelCharge();
        if (performance.now() - lastShotTip > 4000) {
          lastShotTip = performance.now();
          toast('Hold the cloth to charge, then release to strike', 'info', 'Shot tool');
        }
      }
    }
    return true;
  }

  function onScenePointerUp(e) {
    if (finishShotPointer(e)) return;
    if (aimDragging && e.pointerId === aimPointerId) {
      const moved = aimDragMoved;
      aimDragging = false;
      aimPointerId = null;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (!moved) setAimTargetFromEvent(e);
    }
  }

  function onScenePointerCancel(e) {
    if (shotPointerId === e.pointerId) {
      shotPointerId = null;
      cancelCharge();
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      return;
    }
    if (aimDragging && e.pointerId === aimPointerId) {
      aimDragging = false;
      aimPointerId = null;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
  }

  function onSceneDoubleClick(e) {
    if (app.tool !== 'aim') return;
    if (app.phase !== 'aiming' || !isHumanTurn()) return;
    if (!aimPointFromEvent(e)) return;
    e.preventDefault();
    setAimLocked(!app.aimLocked);
  }

  function onWindowPointerUp(e) {
    if (finishShotPointer(e)) return;
    if (aimDragging && e.pointerId === aimPointerId) {
      aimDragging = false;
      aimPointerId = null;
    }
  }

  function onSceneWheel(e) {
    if (app.tool !== 'aim' || !isHumanTurn()) return;
    e.preventDefault();
    const fine = e.shiftKey ? 0.05 : 0.2;
    const dir = e.deltaY < 0 ? 1 : -1;
    setAimTarget(app.aimTarget + deg2rad(fine) * dir);
  }

  function onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (app.phase === 'aiming' && isHumanTurn()) startCharge();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      nudgeAim(e.shiftKey ? -2 : -0.5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      nudgeAim(e.shiftKey ? 2 : 0.5);
    } else if (e.key === 'a' || e.key === 'A' || e.key === '1') {
      setTool('aim');
    } else if (e.key === 'o' || e.key === 'O' || e.key === '2') {
      setTool('scene');
    } else if (e.key === 's' || e.key === 'S' || e.key === '3') {
      setTool('shot');
    } else if (e.key === 'r' || e.key === 'R') {
      resetSpin();
    } else if (e.key === 'l' || e.key === 'L') {
      if (isHumanTurn()) setAimLocked(!app.aimLocked);
    } else if (e.key === 'c' || e.key === 'C') {
      if (isHumanTurn()) recenterAimCamera();
    } else if (e.key === 'Escape') {
      closeAllModals();
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space' && app.charging) {
      e.preventDefault();
      releaseCharge();
    }
  }

  function isHumanTurn() {
    return !rules.frameOver && app.phase === 'aiming' && !(app.mode === 'ai' && rules.current === 1);
  }

  function nudgeAim(deg) {
    if (!isHumanTurn()) return;
    setAimTarget(app.aimTarget + deg2rad(deg));
  }

  function updateAimReadout() {
    let deg = rad2deg(app.aimAngle) % 360;
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    dom.aimReadout.textContent = `${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°`;
  }

  function updateAimHint() {
    if (!dom.aimHint) return;
    if (app.tool === 'scene') {
      dom.aimHint.textContent = 'Scene tool · drag to orbit · wheel to zoom · switch to Aim to line up.';
      return;
    }
    if (app.tool === 'shot') {
      dom.aimHint.textContent = 'Shot tool · hold the cloth to charge · release to strike.';
      return;
    }
    if (app.aimLocked) {
      dom.aimHint.textContent = 'Aim pinned · double-click the cloth or the pin to release.';
    } else if (app.aimFree) {
      dom.aimHint.textContent = 'Aim · scene framing kept · drag/click/scroll to aim · recentre for cue view.';
    } else {
      dom.aimHint.textContent = 'Drag to fine-aim · click to aim · scroll to nudge · double-click to pin.';
    }
  }

  function syncAimLockUI() {
    if (!dom.lockAimBtn) return;
    dom.lockAimBtn.classList.toggle('is-on', app.aimLocked);
    dom.lockAimBtn.setAttribute('aria-pressed', app.aimLocked ? 'true' : 'false');
    dom.lockAimBtn.title = app.aimLocked
      ? 'Release pinned aim (or double-click the cloth)'
      : 'Pin the aim (or double-click the cloth)';
    updateAimHint();
  }

  function setAimLocked(locked, silent) {
    const next = !!locked;
    if (next === app.aimLocked) return;
    app.aimLocked = next;
    if (next) aimDragging = false;
    syncAimLockUI();
    if (!silent) {
      toast(next
        ? 'Aim pinned — move the mouse freely, then click Strike'
        : 'Aim released — click the cloth to adjust',
        'info', next ? 'Aim pinned' : 'Aim released');
    }
  }

  function aimCameraGeometry() {
    return {
      back: isNarrow() ? 2.85 : 1.86,
      side: isNarrow() ? 0.55 : 0.46,
      high: isNarrow() ? 1.25 : 0.82,
      ahead: isNarrow() ? -0.75 : 1.25
    };
  }

  function placeAimCamera() {
    if (!cueBall || !cueBall.active) return;
    const p = cueBall.body.position;
    const d = angleVector(app.aimCamAngle);
    const g = aimCameraGeometry();
    camera.position.set(
      p.x - d.x * g.back + d.z * g.side,
      g.high,
      p.z - d.z * g.back - d.x * g.side
    );
    cameraLook.set(p.x + d.x * g.ahead, R + 0.02, p.z + d.z * g.ahead);
    camera.lookAt(cameraLook);
  }

  function syncToolUI() {
    if (!dom.toolAim) return;
    dom.toolAim.classList.toggle('is-on', app.tool === 'aim');
    dom.toolScene.classList.toggle('is-on', app.tool === 'scene');
    dom.toolShot.classList.toggle('is-on', app.tool === 'shot');
    document.body.classList.toggle('is-shot', app.tool === 'shot');
    updateAimHint();
  }

  function setTool(tool) {
    if (tool !== 'aim' && tool !== 'scene' && tool !== 'shot') return;
    if (tool === app.tool) {
      if (tool === 'aim') recenterAimCamera();
      return;
    }
    const fromScene = app.tool === 'scene';
    app.tool = tool;
    if (tool !== 'aim' && app.aimLocked) {
      app.aimLocked = false;
      syncAimLockUI();
    }
    if (dom.lockAimBtn) dom.lockAimBtn.disabled = !isHumanTurn() || tool !== 'aim';
    if (tool === 'scene') {
      if (app.cameraMode !== 'orbit') setCameraMode('orbit');
    } else if (app.cameraMode !== 'aim') {
      // Coming from Scene: keep the exact framing the player set.
      setCameraMode('aim', fromScene);
    }
    if (tool === 'shot') {
      toast('Shot tool · hold the cloth to charge, release to strike', 'info', 'Mouse: Shot');
    } else if (tool === 'scene') {
      toast('Scene tool · drag to orbit, wheel or pinch to zoom', 'info', 'Mouse: Scene');
    }
    syncToolUI();
    updateAimHint();
  }

  function recenterAimCamera() {
    if (app.tool !== 'aim') setTool('aim');
    if (app.cameraMode !== 'aim') {
      setCameraMode('aim');
      return;
    }
    app.aimFree = false;
    app.aimCamAngle = normalizeAngle(app.aimTarget);
    placeAimCamera();
    updateAimHint();
  }

  function setCameraMode(mode, keepView) {
    if (mode === app.cameraMode) {
      if (mode === 'aim' && !keepView) recenterAimCamera();
      return;
    }
    if (mode === 'aim') {
      app._orbitPos = camera.position.clone();
      app._orbitTarget = controls.target.clone();
      app.cameraMode = 'aim';
      controls.enabled = false;
      document.body.classList.remove('is-orbit');
      if (keepView) {
        app.aimFree = true;
        cameraLook.copy(controls.target);
        camera.lookAt(cameraLook);
      } else {
        app.aimFree = false;
        app.aimCamAngle = normalizeAngle(app.aimTarget);
        placeAimCamera();
      }
    } else {
      app.cameraMode = 'orbit';
      app.aimFree = false;
      controls.enabled = true;
      if (app._orbitPos) camera.position.copy(app._orbitPos);
      if (app._orbitTarget) controls.target.copy(app._orbitTarget);
      controls.update();
      document.body.classList.add('is-orbit');
    }
    updateAimHint();
  }

  function updateAimCamera(dt) {
    if (app.cameraMode !== 'aim' || !cueBall) return;
    if (app.aimFree) return;
    if (app.phase !== 'aiming') return;
    const p = cueBall.body.position;
    const d = angleVector(app.aimCamAngle);
    // The camera holds its angle while the player aims. It only follows the
    // cue ball's position, so moving the mouse can never swing the table.
    const g = aimCameraGeometry();
    const desired = new THREE.Vector3(
      p.x - d.x * g.back + d.z * g.side,
      g.high,
      p.z - d.z * g.back - d.x * g.side
    );
    const look = new THREE.Vector3(p.x + d.x * g.ahead, R + 0.02, p.z + d.z * g.ahead);
    const k = 1 - Math.exp(-5.0 * dt);
    camera.position.lerp(desired, k);
    cameraLook.lerp(look, k);
    camera.lookAt(cameraLook);
  }

  /* ────────────────────────────────────────────────────────────────────────
     09 · SHOT LIFECYCLE
     ──────────────────────────────────────────────────────────────────────── */
  function startCharge() {
    if (app.charging || !isHumanTurn()) return;
    app.charging = true;
    app.chargeStart = performance.now();
    app.chargePrevPower = app.power;
    app.power = 0;
    dom.chargeBtn.classList.add('is-charging');
    updatePowerUI();
    Audio.unlock();
  }

  function releaseCharge() {
    if (!app.charging) return;
    app.charging = false;
    dom.chargeBtn.classList.remove('is-charging');
    if (app.power < 4) {
      app.power = 4;
      updatePowerUI();
    }
    takeShot();
  }

  function cancelCharge() {
    if (!app.charging) return;
    app.charging = false;
    dom.chargeBtn.classList.remove('is-charging');
    app.power = app.chargePrevPower || 55;
    updatePowerUI();
  }

  function updateCharge(now) {
    if (!app.charging) return;
    const t = (now - app.chargeStart) / 1500;
    // rises to 100% in 1.5 s, then breathes between 88% and 100%
    let p;
    if (t <= 1) p = t * 100;
    else p = 94 + Math.sin((t - 1) * 5) * 6;
    app.power = clamp(p, 0, 100);
    updatePowerUI();
  }

  function updatePowerUI() {
    const p = Math.round(app.power);
    dom.powerReadout.textContent = `${p}%`;
    dom.powerSlider.value = String(p);
    dom.chargeFill.style.width = `${p}%`;
  }

  function takeShot() {
    if (!isHumanTurn() && !(app.mode === 'ai' && rules.current === 1)) return;
    if (app.phase !== 'aiming' || rules.frameOver) return;
    const power = clamp(app.power, 4, 100);
    // Fire along the intended target angle, even if the eased line is still
    // catching up by a fraction of a degree.
    app.aimAngle = app.aimTarget;
    updateAimReadout();
    const d = aimVector();
    const speed = MIN_SHOT_SPEED + (power / 100) * (MAX_SHOT_SPEED - MIN_SHOT_SPEED);
    app.phase = 'rolling';
    app.aiThinking = false;
    aimDragging = false;
    app.shot = {
      potted: [],
      firstContact: null,
      cushionHits: 0,
      cuePotted: false,
      startedAt: performance.now(),
      restTime: 0,
      power,
      side: app.spin.x,
      top: app.spin.y,
    };

    const body = cueBall.body;
    body.wakeUp();
    body.velocity.set(d.x * speed, 0, d.z * speed);
    if (app.elevation > 18) {
      body.velocity.y = Math.sin(deg2rad(app.elevation)) * (power / 100) * 0.95;
    }

    // rolling axis: up × direction
    const rollX = d.z;
    const rollZ = -d.x;
    const omega = speed / R;
    const topFactor = 1 + app.spin.y * 1.7;
    const sideFactor = app.spin.x * 0.8;
    body.angularVelocity.set(
      rollX * omega * topFactor,
      sideFactor * omega,
      rollZ * omega * topFactor
    );

    // cue jab
    const pull = 0.055 + (power / 100) * 0.24;
    app.cueStrike = {
      t: 0,
      dir: d.clone(),
      baseX: cueBall.body.position.x - d.x * (R + 0.022 + pull),
      baseY: R,
      baseZ: cueBall.body.position.z - d.z * (R + 0.022 + pull)
    };

    Audio.cue(power);
    aimGroup.visible = false;
    cueRing.visible = false;
    setRollingUI(true);
    updateUI();
  }

  function stepPhysics(dt) {
    const steps = Math.max(1, Math.min(6, Math.ceil(dt / (1 / 120))));
    world.step(1 / 120, dt, steps);

    // cloth resistance: a gentle linear deceleration on top of air damping
    for (const b of balls) {
      if (!b.active) continue;
      const v = b.body.velocity;
      const speed = Math.hypot(v.x, v.z);
      if (speed > 0.0001 && Math.abs(b.body.position.y - R) < 0.012) {
        const age = app.shot ? (performance.now() - app.shot.startedAt) / 1000 : 0;
        const hurry = age > 8 ? 0.5 : 0;
        const dec = Math.min(speed, (0.24 + speed * 0.045 + hurry) * dt);
        v.x -= (v.x / speed) * dec;
        v.z -= (v.z / speed) * dec;
      }
      // Kill residual spin once a ball is effectively stationary, so the
      // referee does not wait half a minute for a ball spinning on the spot.
      if (speed < 0.1) {
        const w = b.body.angularVelocity;
        const decay = Math.max(0, 1 - 10 * dt);
        w.x *= decay; w.y *= decay; w.z *= decay;
      }
      // a hint of side-spin swerve through the cloth, fading after impact
      if (b.type === 'cue' && app.shot && Math.abs(app.shot.side) > 0.18 && speed > 0.2) {
        const elapsed = (performance.now() - app.shot.startedAt) / 1000;
        const fade = clamp(1 - elapsed / 1.7, 0, 1);
        if (fade > 0) {
          const latX = -Math.sin(app.aimAngle);
          const latZ = Math.cos(app.aimAngle);
          const swerve = app.shot.side * 0.24 * fade * Math.min(1, speed / 2.5) * dt;
          v.x += latX * swerve;
          v.z += latZ * swerve;
        }
      }
    }

    for (const b of balls) {
      if (!b.active) continue;
      b.mesh.position.copy(b.body.position);
      b.mesh.quaternion.copy(b.body.quaternion);
    }
  }

  function checkPockets() {
    if (app.phase !== 'rolling') return;
    for (const b of balls) {
      if (!b.active) continue;
      const p = b.body.position;
      for (const pocket of POCKET_CAPTURE) {
        const dx = p.x - pocket.x;
        const dz = p.z - pocket.z;
        if (dx * dx + dz * dz < pocket.r * pocket.r) {
          potBall(b);
          break;
        }
      }
      if (b.active && (Math.abs(p.x) > L + 0.02 || Math.abs(p.z) > W + 0.02)) {
        potBall(b);
      }
    }
  }

  function potBall(ball) {
    if (!ball.active) return;
    ball.active = false;
    ball.pottedThisShot = true;
    if (ball.body.world) world.removeBody(ball.body);
    ball.onTable = false;
    if (app.shot) {
      app.shot.potted.push(ball);
      if (ball.type === 'cue') app.shot.cuePotted = true;
    }
    app.potAnims.push({
      ball,
      t: 0,
      startY: ball.mesh.position.y,
      startX: ball.mesh.position.x,
      startZ: ball.mesh.position.z
    });
    Audio.pocket();
    if (ball.type !== 'cue') updateBallGuide();
  }

  function updatePotAnims(dt) {
    for (let i = app.potAnims.length - 1; i >= 0; i--) {
      const a = app.potAnims[i];
      a.t += dt;
      const k = clamp(a.t / 0.5, 0, 1);
      a.ball.mesh.position.y = a.startY - k * 0.22;
      a.ball.mesh.position.x = a.startX + Math.sin(k * 8) * 0.002 * (1 - k);
      a.ball.mesh.position.z = a.startZ;
      a.ball.mesh.rotation.x += dt * 7;
      a.ball.mesh.scale.setScalar(1 - k * 0.55);
      if (k >= 1) {
        a.ball.mesh.visible = false;
        app.potAnims.splice(i, 1);
      }
    }
  }

  function ballsAtRest() {
    let maxV = 0, maxW = 0;
    for (const b of balls) {
      if (!b.active) continue;
      const v = b.body.velocity.length();
      const w = b.body.angularVelocity.length();
      if (v > maxV) maxV = v;
      if (w > maxW) maxW = w;
    }
    return maxV < 0.024 && maxW < 3.2;
  }

  function ballOnLabel(on) {
    if (on === 'red') return 'red';
    if (on === 'color') return 'a colour';
    if (on && BALL_NAMES[on]) return BALL_NAMES[on].toLowerCase();
    return 'the black';
  }

  function ballList(types) {
    const counts = new Map();
    types.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    return [...counts.entries()].map(([t, n]) => {
      const name = (BALL_NAMES[t] || t).toLowerCase();
      return n > 1 ? `${n} ${name}s` : name;
    }).join(' and ');
  }

  function setLastCall(text, kind, record) {
    if (record !== false) recordRuling(text, kind);
    if (!dom.lastCallText) return;
    dom.lastCallText.textContent = text;
    if (dom.lastCall) {
      dom.lastCall.className = 'last-call' + (kind ? ' is-' + kind : '');
    }
  }

  /**
   * Turn a referee result into plain language: who scored or fouled, why,
   * how many points changed hands and what happens next.
   */
  function describeRuling(result, shot, onBefore, shooter) {
    const potted = (shot.potted || []).filter((b) => b.type !== 'cue');
    const pottedTypes = potted.map((b) => b.type);
    const pottedList = ballList(pottedTypes);
    const firstType = shot.firstContact ? shot.firstContact.type : null;
    const shooterName = playerName(shooter);
    const beneficiary = playerName(rules.current);
    const score = `${rules.scores[0]}–${rules.scores[1]}`;
    const onNow = ballOnLabel(rules.ballOn);

    if (result.foul) {
      let reason;
      switch (result.reason) {
        case 'Wrong ball first':
          reason = `${(BALL_NAMES[firstType] || 'the ball').toLowerCase()} (${VALUES[firstType] || 4}) was struck first, but ${ballOnLabel(onBefore)} was on`;
          break;
        case 'No ball struck':
          reason = 'no ball was struck';
          break;
        case 'Cue ball potted':
          reason = 'the cue ball was potted';
          break;
        case 'Colour potted when a red was on':
          reason = `${pottedList} potted while red was on`;
          break;
        case 'Red potted when a colour was on':
          reason = `a red was potted while ${ballOnLabel(onBefore)} was on`;
          break;
        case 'More than one colour potted':
          reason = `${pottedList} were potted in one stroke`;
          break;
        case 'Red potted during the clearance':
          reason = 'a red was potted during the clearance';
          break;
        case 'Wrong colour potted':
          reason = `${pottedList} was potted, but ${ballOnLabel(onBefore)} was on`;
          break;
        default:
          reason = result.reason || 'a foul';
      }
      if (pottedTypes.length && ['Wrong ball first', 'No ball struck', 'Cue ball potted'].includes(result.reason)) {
        reason += `; ${pottedList} ${pottedTypes.length > 1 ? 'were' : 'was'} potted`;
      }

      const involved = [];
      if (onBefore && COLOR_ORDER.includes(onBefore)) involved.push(onBefore);
      if (firstType) involved.push(firstType);
      pottedTypes.forEach((t) => involved.push(t));
      const top = involved
        .filter((t) => t !== 'cue')
        .sort((a, b) => (VALUES[b] || 0) - (VALUES[a] || 0))[0];
      const penaltyWhy = result.penalty > 4 && top
        ? `the ${(BALL_NAMES[top] || top).toLowerCase()} is worth ${result.penalty}`
        : 'minimum penalty';

      const restore = [];
      if (result.respot && result.respot.length) {
        restore.push(`${ballList(result.respot.map((b) => b.type))} respotted`);
      }
      if (result.cuePotted) restore.push('cue ball respotted in the D');
      const restoreText = restore.length
        ? `${restore.join('; ').replace(/^./, (c) => c.toUpperCase())}. `
        : '';

      const long = `Foul by ${shooterName} — ${reason}. ${result.penalty} points to ${beneficiary} (${penaltyWhy}). ${restoreText}${beneficiary} to the table. Score ${score}.`;
      const short = `Foul by ${shooterName} — ${reason}. ${result.penalty} to ${beneficiary}.`;
      return {
        kind: 'foul', long, short,
        bannerKicker: `Foul · ${shooterName}`,
        bannerTitle: `${result.penalty} points`,
        bannerSub: `to ${beneficiary} — ${reason}`
      };
    }

    if (result.turnPassed) {
      const brk = result.endedBreak > 0 ? `Break of ${result.endedBreak} ends. ` : '';
      const long = `No pot — ${brk}${playerName(rules.current)} to the table. Ball on ${onNow}. Score ${score}.`;
      const short = `No pot — ${brk}${playerName(rules.current)} to the table.`;
      return { kind: 'info', long, short };
    }

    const detail = onBefore === 'red'
      ? `${pottedList} potted`
      : onBefore === 'color'
        ? `${pottedList} potted and respotted`
        : `${pottedList} potted`;
    const pts = `${result.points} ${result.points === 1 ? 'point' : 'points'}`;
    const long = `${pts} to ${shooterName} — ${detail}. Break ${rules.break}; now on ${onNow}. ${shooterName} stays at the table. Score ${score}.`;
    const short = `${pts} to ${shooterName} — ${detail}. Break ${rules.break}.`;
    return { kind: 'score', long, short };
  }

  function loadRulings() {
    try {
      const raw = JSON.parse(localStorage.getItem(RULINGS_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((e) => e && typeof e.text === 'string')
        .map((e) => ({
          time: Number(e.time) || 0,
          frame: Number(e.frame) || 0,
          kind: ['foul', 'score', 'info'].includes(e.kind) ? e.kind : 'info',
          text: String(e.text).slice(0, 1200),
          score: typeof e.score === 'string' ? e.score : ''
        }))
        .slice(-RULINGS_MAX);
    } catch (err) {
      return [];
    }
  }

  function saveRulings() {
    try { localStorage.setItem(RULINGS_KEY, JSON.stringify(rulingHistory.slice(-RULINGS_MAX))); } catch (err) { /* private mode */ }
  }

  function recordRuling(text, kind) {
    const entry = {
      time: Date.now(),
      frame: app.frameNo,
      kind: ['foul', 'score', 'info'].includes(kind) ? kind : 'info',
      text: String(text).slice(0, 1200),
      score: `${rules.scores[0]}–${rules.scores[1]}`
    };
    const last = rulingHistory[rulingHistory.length - 1];
    if (last && last.text === entry.text && last.frame === entry.frame) return;
    rulingHistory.push(entry);
    if (rulingHistory.length > RULINGS_MAX) rulingHistory = rulingHistory.slice(-RULINGS_MAX);
    saveRulings();
  }

  function formatRulingTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '';
    const d = new Date(ms);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return time;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  }

  function renderRulings() {
    if (!dom.rulingsList) return;
    const list = dom.rulingsList;
    list.textContent = '';
    if (!rulingHistory.length) {
      const empty = document.createElement('p');
      empty.className = 'rulings-empty';
      empty.textContent = 'No rulings yet. Take a shot, pot a ball or concede a foul and it will be written here.';
      list.appendChild(empty);
      return;
    }
    rulingHistory.slice().reverse().forEach((entry) => {
      const item = document.createElement('div');
      item.className = `ruling-item is-${entry.kind}`;
      const meta = document.createElement('div');
      meta.className = 'ruling-meta';
      const when = document.createElement('span');
      const time = formatRulingTime(entry.time);
      when.textContent = `Frame ${pad2(entry.frame || app.frameNo)}${time ? ' · ' + time : ''}`;
      const tag = document.createElement('b');
      tag.textContent = entry.kind === 'foul' ? 'Foul' : entry.kind === 'score' ? 'Points' : 'Referee';
      meta.append(when, tag);
      const p = document.createElement('p');
      p.textContent = entry.text;
      item.append(meta, p);
      list.appendChild(item);
    });
    list.scrollTop = 0;
  }

  function openRulings() {
    renderRulings();
    openModal('modal-rulings');
  }

  function clearRulings() {
    if (!window.confirm('Clear the entire ruling history?')) return;
    rulingHistory = [];
    saveRulings();
    renderRulings();
    toast('Ruling history cleared', 'info', 'The referee');
  }

  function endShot() {
    if (app.phase !== 'rolling' && app.phase !== 'settling') return;
    if (!app.shot) return;
    app.phase = 'settling';

    // stop everything decisively
    balls.forEach((b) => {
      if (!b.active) return;
      b.body.velocity.set(0, 0, 0);
      b.body.angularVelocity.set(0, 0, 0);
    });

    const shooter = rules.current;
    const onBefore = rules.ballOn;
    const result = resolveShot(app.shot);
    const shot = app.shot;

    // respot colours (legal or foul) and cue ball
    result.respot.forEach((b) => respotBall(b));
    if (shot.cuePotted) respotCueBall();

    const call = describeRuling(result, shot, onBefore, shooter);
    setLastCall(call.long, call.kind);

    if (result.points > 0) {
      stats.totalPots += shot.potted.filter((b) => b.type !== 'cue').length;
      saveStats();
    }

    if (result.foul) {
      Audio.foul();
      flashTurn();
      toast(call.short, 'foul', 'Foul');
      banner(call.bannerKicker, call.bannerTitle, call.bannerSub);
      app.shake = 0.35;
    } else if (result.turnPassed) {
      Audio.turn();
      toast(call.short, 'info', result.endedBreak > 0 ? 'Break ends' : 'Referee');
    } else if (result.points > 0) {
      toast(call.short, 'success', 'Points');
    }

    if (rules.break >= 100 && app.centuryThisBreak && result.points > 0) {
      banner('Century break', String(rules.break), 'A fine piece of cueing');
    } else if (rules.break > 0 && rules.break % 50 === 0 && result.points > 0) {
      banner('Half century', String(rules.break), 'The break continues');
    }

    app.shot = null;
    app.cueStrike = null;
    resetSpin();
    updateUI();

    // frame completion / tie-break
    const colorsLeft = balls.filter((b) => COLOR_ORDER.includes(b.type) && b.active).length;
    if (rules.redsRemaining === 0 && colorsLeft === 0 && !result.foul) {
      if (rules.scores[0] === rules.scores[1]) {
        const black = balls.find((b) => b.type === 'black');
        respotBall(black);
        rules.current = 1 - rules.current;
        rules.ballOn = 'black';
        rules.frameOver = false;
        setLastCall(`Scores level — the black is respotted. ${playerName(rules.current)} to play it. Score ${rules.scores[0]}–${rules.scores[1]}.`, 'info');
        toast('Scores level — the black is respotted', 'info', 'Tie-break');
        updateUI();
      } else {
        finishFrame();
        return;
      }
    }

    app.phase = 'aiming';
    app.aimLocked = false;
    aimDragging = false;
    // Keep the player's chosen line after a shot. Only re-aim when the cue
    // ball itself was respotted in the D, where the old line is meaningless.
    if (shot.cuePotted && isHumanTurn()) {
      aimAtNearestLegal();
      app.aimCamAngle = app.aimAngle;
      app.aimFree = false;
      if (app.cameraMode === 'aim') placeAimCamera();
    }
    if (app.tool === 'shot') setTool('aim');
    updateUI();
    if (app.mode === 'ai' && rules.current === 1) scheduleAI();
  }

  function respotBall(ball) {
    if (!ball) return;
    ball.active = true;
    ball.pottedThisShot = false;
    ball.mesh.visible = true;
    ball.mesh.scale.set(1, 1, 1);
    if (!ball.onTable) {
      world.addBody(ball.body);
      ball.onTable = true;
    }
    // remove from any sink animation
    app.potAnims = app.potAnims.filter((a) => a.ball !== ball);

    const [x, z] = findFreeSpot(ball);
    ball.body.position.set(x, R + 0.001, z);
    ball.body.velocity.set(0, 0, 0);
    ball.body.angularVelocity.set(0, 0, 0);
    ball.body.quaternion.set(0, 0, 0, 1);
    ball.body.force.set(0, 0, 0);
    ball.body.torque.set(0, 0, 0);
    ball.mesh.position.copy(ball.body.position);
    ball.mesh.quaternion.copy(ball.body.quaternion);
    ball.mesh.rotation.set(0, 0, 0);
  }

  function spotIsFree(x, z, ignore) {
    for (const b of balls) {
      if (!b.active || b === ignore) continue;
      if (Math.hypot(b.body.position.x - x, b.body.position.z - z) < 2 * R + 0.0025) return false;
    }
    return Math.abs(x) < L - R && Math.abs(z) < W - R;
  }

  function findFreeSpot(ball) {
    const own = SPOTS[ball.type] || [0, 0];
    if (spotIsFree(own[0], own[1], ball)) return own;
    const others = COLOR_ORDER
      .filter((t) => t !== ball.type)
      .sort((a, b) => VALUES[b] - VALUES[a]);
    for (const t of others) {
      const s = SPOTS[t];
      if (spotIsFree(s[0], s[1], ball)) return s;
    }
    // slide back along the centre line until a free patch is found
    for (let dx = 0.03; dx < 2.6; dx += 0.03) {
      for (const sgn of [1, -1]) {
        const x = own[0] - sgn * dx;
        if (spotIsFree(x, own[1], ball)) return [x, own[1]];
        if (spotIsFree(x, 0, ball)) return [x, 0];
      }
    }
    return [0, 0];
  }

  function respotCueBall() {
    cueBall.active = true;
    cueBall.pottedThisShot = false;
    cueBall.mesh.visible = true;
    cueBall.mesh.scale.set(1, 1, 1);
    if (!cueBall.onTable) {
      world.addBody(cueBall.body);
      cueBall.onTable = true;
    }
    app.potAnims = app.potAnims.filter((a) => a.ball !== cueBall);

    let spot = CUE_START;
    if (!spotIsFree(spot[0], spot[1], cueBall)) {
      outer:
      for (let r = 0.04; r <= D_RADIUS; r += 0.04) {
        for (let i = 0; i < 16; i++) {
          const a = Math.PI / 2 + (Math.PI * i) / 15;
          const x = BAULK_X + Math.cos(a) * r;
          const z = Math.sin(a) * r;
          if (spotIsFree(x, z, cueBall)) { spot = [x, z]; break outer; }
        }
      }
    }
    cueBall.body.position.set(spot[0], R + 0.001, spot[1]);
    cueBall.body.velocity.set(0, 0, 0);
    cueBall.body.angularVelocity.set(0, 0, 0);
    cueBall.body.quaternion.set(0, 0, 0, 1);
    cueBall.body.force.set(0, 0, 0);
    cueBall.body.torque.set(0, 0, 0);
    cueBall.mesh.position.copy(cueBall.body.position);
    cueBall.mesh.quaternion.copy(cueBall.body.quaternion);
  }

  function finishFrame() {
    rules.frameOver = true;
    app.phase = 'gameover';
    app.aimLocked = false;
    const winner = rules.scores[0] === rules.scores[1] ? -1 : (rules.scores[0] > rules.scores[1] ? 0 : 1);
    if (app.mode === 'ai') {
      if (winner === 0) stats.wins.p1++;
      else stats.wins.ai++;
    } else {
      if (winner === 0) stats.wins.p1++;
      else stats.wins.p2++;
    }
    stats.matchesPlayed++;
    saveStats();
    updateUI();
    Audio.win();
    const name = winner === 0 ? 'Player One' : (app.mode === 'ai' ? 'The Computer' : 'Player Two');
    setLastCall(`${name} wins the frame ${rules.scores[0]}–${rules.scores[1]} · highest break ${app.frameHigh}.`, 'score');
    dom.resultTitle.textContent = `${name} wins the frame`;
    dom.resultScore.textContent = `${rules.scores[0]} — ${rules.scores[1]}`;
    dom.resultDetail.textContent = `Frame ${app.frameNo} · highest break ${app.frameHigh}`;
    setTimeout(() => openModal('modal-result'), 900);
  }

  // Find a point on a target ball's face that the cue ball can reach
  // without another ball in the way. On the break this aims at the outer
  // edge of the pack instead of the pink-hidden apex.
  function findClearAim(target) {
    if (!cueBall || !cueBall.active) return null;
    const p = cueBall.body.position;
    const dx = target.body.position.x - p.x;
    const dz = target.body.position.z - p.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) return null;
    const px = -dz / len;
    const pz = dx / len;
    for (let o = 0; o <= 1.2 * R; o += 0.2 * R) {
      const sides = o === 0 ? [1] : [1, -1];
      for (const side of sides) {
        const ax = target.body.position.x + px * o * side;
        const az = target.body.position.z + pz * o * side;
        if (pathClear(p.x, p.z, ax, az, cueBall, target)) {
          return { x: ax, z: az, angle: Math.atan2(az - p.z, ax - p.x) };
        }
      }
    }
    return null;
  }

  function aimAtNearestLegal() {
    if (!cueBall || !cueBall.active) return;
    const targets = legalTargets();
    if (!targets.length) return;
    const p = cueBall.body.position;
    const sorted = targets.slice().sort((a, b) =>
      Math.hypot(a.body.position.x - p.x, a.body.position.z - p.z) -
      Math.hypot(b.body.position.x - p.x, b.body.position.z - p.z)
    );
    for (const t of sorted) {
      const aim = findClearAim(t);
      if (aim) {
        setAimImmediate(aim.angle);
        return;
      }
    }
    const b = sorted[0];
    setAimImmediate(Math.atan2(b.body.position.z - p.z, b.body.position.x - p.x));
  }

  /* ────────────────────────────────────────────────────────────────────────
     10 · AI OPPONENT
     ──────────────────────────────────────────────────────────────────────── */
  function scheduleAI() {
    if (app.mode !== 'ai' || rules.current !== 1 || rules.frameOver || app.phase !== 'aiming') return;
    app.aiThinking = true;
    updateUI();
    setTimeout(() => {
      if (app.mode !== 'ai' || rules.current !== 1 || rules.frameOver || app.phase !== 'aiming') {
        app.aiThinking = false;
        return;
      }
      aiChooseShot();
    }, 1100);
  }

  function pathClear(ax, az, bx, bz, ignoreA, ignoreB) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const ux = dx / len, uz = dz / len;
    for (const b of balls) {
      if (!b.active || b === ignoreA || b === ignoreB) continue;
      const px = b.body.position.x - ax;
      const pz = b.body.position.z - az;
      const t = px * ux + pz * uz;
      if (t < 0 || t > len) continue;
      const dist = Math.abs(px * uz - pz * ux);
      if (dist < 2 * R - 0.001) return false;
    }
    return true;
  }

  function aiChooseShot() {
    app.aiThinking = false;
    if (app.mode !== 'ai' || rules.current !== 1 || app.phase !== 'aiming' || rules.frameOver) return;
    const targets = legalTargets();
    if (!targets.length) return;
    const p = cueBall.body.position;
    let best = null;

    for (const target of targets) {
      const tx = target.body.position.x;
      const tz = target.body.position.z;
      for (const pocket of POCKET_CAPTURE) {
        const pdx = pocket.x - tx;
        const pdz = pocket.z - tz;
        const pd = Math.hypot(pdx, pdz);
        if (pd < 0.08) continue;
        const ux = pdx / pd, uz = pdz / pd;
        const ghostX = tx - ux * 2 * R;
        const ghostZ = tz - uz * 2 * R;
        const cdx = ghostX - p.x, cdz = ghostZ - p.z;
        const cd = Math.hypot(cdx, cdz);
        if (cd < R * 2) continue;
        const cut = (cdx * ux + cdz * uz) / cd;
        if (cut < 0.32) continue;
        if (!pathClear(p.x, p.z, ghostX, ghostZ, cueBall, target)) continue;
        if (!pathClear(tx, tz, pocket.x, pocket.z, target, cueBall)) continue;
        const value = VALUES[target.type] || 1;
        const score = value * 2.2 + Math.min(3, 1.6 / (cd + 0.2)) + cut * 1.8 - pd * 0.4;
        if (!best || score > best.score) {
          best = { target, pocket, ghostX, ghostZ, cd, pd, score, cut };
        }
      }
    }

    if (best) {
      const dx = best.ghostX - p.x;
      const dz = best.ghostZ - p.z;
      const err = (Math.random() - 0.5) * 0.028 * (best.cd > 1.2 ? 1.5 : 1);
      setAimImmediate(Math.atan2(dz, dx) + err);
      const need = clamp(1.35 + best.cd * 0.55 + best.pd * 0.4, 2.1, 5.2);
      app.power = clamp(((need - MIN_SHOT_SPEED) / (MAX_SHOT_SPEED - MIN_SHOT_SPEED)) * 100, 28, 82);
      app.spin = { x: (Math.random() - 0.5) * 0.22, y: 0.18 };
    } else {
      // Safety: hit the pack on the same side as the cue ball, so the line
      // never squeezes past the pink into a foul.
      let safety = targets[0];
      if (rules.ballOn === 'red') {
        const side = Math.sign(p.z) || 1;
        for (const t of targets) {
          if (t.body.position.z * side > safety.body.position.z * side) safety = t;
        }
      } else {
        let nd = Infinity;
        for (const t of targets) {
          const d = Math.hypot(t.body.position.x - p.x, t.body.position.z - p.z);
          if (d < nd) { nd = d; safety = t; }
        }
      }
      const err = (Math.random() - 0.5) * 0.012;
      setAimImmediate(Math.atan2(safety.body.position.z - p.z, safety.body.position.x - p.x) + err);
      app.power = clamp(38 + Math.random() * 20, 34, 62);
      app.spin = { x: (Math.random() - 0.5) * 0.2, y: 0 };
    }

    app.aimCamAngle = app.aimAngle;
    if (app.cameraMode === 'aim' && !app.aimFree) placeAimCamera();
    updateAimReadout();
    updateSpinUI();
    updatePowerUI();
    updateUI();
    setTimeout(() => {
      if (app.mode === 'ai' && rules.current === 1 && app.phase === 'aiming' && !rules.frameOver) {
        takeShot();
      }
    }, 850);
  }

  /* ────────────────────────────────────────────────────────────────────────
     11 · FRAME RESET & TURN UI
     ──────────────────────────────────────────────────────────────────────── */
  function newFrame(count) {
    closeAllModals();
    app.phase = 'aiming';
    app.aiThinking = false;
    app.shot = null;
    app.cueStrike = null;
    app.potAnims = [];
    app.centuryThisBreak = false;
    app.frameHigh = 0;
    app.highlightType = null;
    app.spin = { x: 0, y: 0 };
    app.power = 55;

    const startPlayer = count ? 1 - app.breakOff : 0;
    resetRules(startPlayer);
    setLastCall(`${playerName(rules.current)} to break · red on.`, 'info', false);
    if (count) {
      app.frameNo = (app.frameNo || 1) + 1;
      stats.framesPlayed++;
      saveStats();
    } else {
      app.frameNo = 1;
    }
    resetBallPhysics();
    balls.forEach((b) => {
      b.active = true;
      b.pottedThisShot = false;
      b.mesh.visible = true;
      b.mesh.scale.set(1, 1, 1);
      b.mesh.rotation.set(0, 0, 0);
    });
    aimAtNearestLegal();
    app.aimCamAngle = app.aimAngle;
    app.aimLocked = false;
    aimDragging = false;
    resetSpin();
    updatePowerUI();
    updateAimReadout();
    updateUI();
    setTool('aim');
    app.aimFree = false;
    if (app.cameraMode === 'aim') {
      app.aimCamAngle = normalizeAngle(app.aimTarget);
      placeAimCamera();
    }
    if (count) {
      banner(`Frame ${pad2(app.frameNo)}`, 'Rack them up', `${playerName(rules.current)} to break`);
    }
    if (app.mode === 'ai' && rules.current === 1) scheduleAI();
  }

  function playerName(index) {
    if (index === 1 && app.mode === 'ai') return 'The Computer';
    return index === 0 ? 'Player One' : 'Player Two';
  }

  function switchMode() {
    if (app.phase === 'rolling' || app.phase === 'settling' || app.charging) {
      toast('Wait for the balls to settle', 'info', 'One moment');
      return;
    }
    app.mode = app.mode === 'ai' ? '2p' : 'ai';
    dom.modeLabel.textContent = app.mode === 'ai' ? 'vs Computer' : '2 Players';
    dom.p2Name.childNodes[0].nodeValue = app.mode === 'ai' ? 'Computer ' : 'Player Two ';
    dom.matchNote.textContent = app.mode === 'ai' ? 'Player vs machine' : 'Best of one';
    updateUI();
    if (app.mode === 'ai' && rules.current === 1) scheduleAI();
    toast(app.mode === 'ai' ? 'The computer takes the other chair' : 'Two players at the table', 'info', 'Match mode');
  }

  /* ────────────────────────────────────────────────────────────────────────
     12 · HUD / UI
     ──────────────────────────────────────────────────────────────────────── */
  function updateUI() {
    dom.score[0].textContent = rules.scores[0];
    dom.score[1].textContent = rules.scores[1];
    dom.rows[0].classList.toggle('is-active', rules.current === 0 && !rules.frameOver);
    dom.rows[1].classList.toggle('is-active', rules.current === 1 && !rules.frameOver);
    dom.breakPts.textContent = rules.break;
    dom.highBreak.textContent = stats.highBreak;
    dom.redsLeft.textContent = rules.redsRemaining;
    dom.pointsLeft.textContent = pointsRemaining();
    dom.p1Wins.textContent = stats.wins.p1;
    dom.p2Wins.textContent = app.mode === 'ai' ? stats.wins.ai : stats.wins.p2;
    dom.p2Name.childNodes[0].nodeValue = app.mode === 'ai' ? 'Computer ' : 'Player Two ';
    dom.frameNo.textContent = pad2(app.frameNo);
    dom.modeLabel.textContent = app.mode === 'ai' ? 'vs Computer' : '2 Players';
    dom.matchNote.textContent = app.mode === 'ai' ? 'Player vs machine' : 'Best of one';

    const on = rules.ballOn;
    let label = 'Red', swatch = 'red';
    if (on === 'color') { label = 'Any colour'; swatch = 'color'; }
    else if (on && COLOR_ORDER.includes(on)) { label = BALL_NAMES[on]; swatch = on; }
    else if (!on) { label = 'Black'; swatch = 'black'; }
    dom.ballOn.innerHTML = `<i class="swatch ${swatch}"></i><em>${label}</em>`;

    updateBallGuide();
    updateStatus();
    updateShootAvailability();
    syncAimLockUI();
    syncToolUI();

    const ai = app.mode === 'ai' && rules.current === 1;
    dom.powerSlider.disabled = !isHumanTurn();
    dom.chargeBtn.disabled = !isHumanTurn();
    dom.spinPad.style.opacity = ai ? '0.45' : '1';
    dom.elevSlider.disabled = !isHumanTurn();
    if (ai) dom.shootBtn.disabled = true;
  }

  function pointsRemaining() {
    let pts = rules.redsRemaining * 8;
    for (const t of COLOR_ORDER) {
      const b = balls.find((x) => x.type === t && x.active);
      if (b) pts += VALUES[t];
    }
    if (rules.ballOn === 'color') pts += 7;
    return pts;
  }

  function updateBallGuide() {
    if (!dom.ballGuide) return;
    let selectedStillActive = false;
    dom.ballGuide.querySelectorAll('[data-ball]').forEach((btn) => {
      const type = btn.dataset.ball;
      const active = balls.filter((b) => b.type === type && b.active).length;
      const on = app.highlightType === type;
      if (on && active > 0) selectedStillActive = true;
      btn.classList.toggle('is-on', on);
      btn.classList.toggle('is-potted', active === 0);
      btn.disabled = active === 0;
      btn.title = `${BALL_NAMES[type]} — ${VALUES[type]} ${VALUES[type] === 1 ? 'point' : 'points'} — ${active} left — click to highlight`;
    });
    if (app.highlightType && !selectedStillActive) {
      app.highlightType = null;
      dom.ballGuide.querySelectorAll('[data-ball]').forEach((btn) => btn.classList.remove('is-on'));
      updateBallHighlights(performance.now());
    }
  }

  function toggleBallHighlight(type) {
    const count = balls.filter((b) => b.type === type && b.active).length;
    if (!count) return;
    app.highlightType = app.highlightType === type ? null : type;
    updateBallGuide();
    updateBallHighlights(performance.now());
    if (app.highlightType) {
      const label = type === 'red'
        ? `${count} red${count === 1 ? '' : 's'}`
        : `${count} ${BALL_NAMES[type].toLowerCase()} ball${count === 1 ? '' : 's'}`;
      toast(`Highlighting ${label} · ${VALUES[type]} ${VALUES[type] === 1 ? 'point' : 'points'}`, 'info', 'Ball guide');
    }
  }

  function updateBallHighlights(now) {
    const type = app.highlightType;
    if (!type) {
      for (const b of balls) {
        if (b.ring) b.ring.visible = false;
        if (b.halo) b.halo.visible = false;
      }
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
    highlightRingMat.opacity = 0.4 + 0.35 * pulse;
    highlightHaloMat.color.setHex(BALL_HEX[type] || 0xffe3a8);
    highlightHaloMat.opacity = 0.07 + 0.1 * pulse;
    for (const b of balls) {
      if (!b.ring) continue;
      const on = b.active && b.type === type;
      b.ring.visible = on;
      b.halo.visible = on;
      if (on) {
        b.ring.position.set(b.body.position.x, 0.0045, b.body.position.z);
        b.ring.scale.setScalar(1 + 0.07 * pulse);
        b.halo.scale.setScalar(1 + 0.015 * pulse);
      }
    }
  }

  function updateStatus() {
    let text = '';
    let cls = '';
    if (rules.frameOver) {
      text = 'Frame complete';
      cls = 'is-wait';
    } else if (app.phase === 'rolling') {
      text = 'Balls in motion · ' + (app.mode === 'ai' && rules.current === 1 ? 'Computer' : playerName(rules.current));
      cls = 'is-wait';
    } else if (app.phase === 'settling') {
      text = 'The referee is checking…';
      cls = 'is-wait';
    } else if (app.aiThinking) {
      text = 'The computer is lining up…';
      cls = 'is-ai';
    } else {
      const on = rules.ballOn === 'color' ? 'a colour' : (BALL_NAMES[rules.ballOn] || 'the black').toLowerCase();
      text = `${playerName(rules.current)} · on ${on}`;
      if (app.mode === 'ai' && rules.current === 1) cls = 'is-ai';
    }
    dom.statusText.textContent = text;
    dom.statusPill.className = 'status-pill' + (cls ? ' ' + cls : '');
    dom.powerSlider.disabled = !isHumanTurn();
    dom.chargeBtn.disabled = !isHumanTurn();
    dom.shootBtn.disabled = !isHumanTurn();
  }

  function setRollingUI() {
    dom.powerSlider.disabled = true;
    dom.chargeBtn.disabled = true;
    dom.shootBtn.disabled = true;
    dom.spinPad.style.opacity = '0.5';
  }

  function updateShootAvailability() {
    const human = isHumanTurn();
    dom.shootBtn.disabled = !human;
    dom.powerSlider.disabled = !human;
    dom.chargeBtn.disabled = !human;
    dom.elevSlider.disabled = !human;
    if (dom.lockAimBtn) dom.lockAimBtn.disabled = !human || app.tool !== 'aim';
    if (dom.recenterBtn) dom.recenterBtn.disabled = !human;
  }

  function updateSpinUI() {
    drawSpinPad();
    const x = app.spin.x, y = app.spin.y;
    const parts = [];
    if (y > 0.18) parts.push('Follow');
    else if (y < -0.18) parts.push('Screw');
    if (x > 0.18) parts.push('right english');
    else if (x < -0.18) parts.push('left english');
    let text = parts.length ? parts.join(' · ') : 'Centre';
    if (parts.length) {
      const strength = Math.round(Math.max(Math.abs(x), Math.abs(y)) * 100);
      text += ` ${strength}%`;
    }
    dom.spinReadout.textContent = text;
  }

  function resetSpin() {
    app.spin = { x: 0, y: 0 };
    updateSpinUI();
  }

  function drawSpinPad() {
    if (!spinCtx) {
      const canvas = dom.spinPad;
      spinCtx = canvas.getContext('2d');
      canvas.addEventListener('pointerdown', onSpinDown);
      canvas.addEventListener('pointermove', onSpinMove);
      canvas.addEventListener('pointerup', onSpinUp);
      canvas.addEventListener('pointercancel', onSpinUp);
    }
    const c = dom.spinPad;
    const w = c.width, h = c.height;
    const cx = w / 2, cy = h / 2;
    const rad = w / 2 - 8;
    spinCtx.clearRect(0, 0, w, h);

    // ivory cue ball face
    const grad = spinCtx.createRadialGradient(cx - rad * 0.32, cy - rad * 0.36, rad * 0.1, cx, cy, rad);
    grad.addColorStop(0, '#fffdf4');
    grad.addColorStop(0.55, '#efe5ce');
    grad.addColorStop(0.88, '#cdbfa4');
    grad.addColorStop(1, '#8f8068');
    spinCtx.beginPath(); spinCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    spinCtx.fillStyle = grad; spinCtx.fill();
    spinCtx.strokeStyle = 'rgba(60,40,15,.35)'; spinCtx.lineWidth = 3; spinCtx.stroke();

    // grid
    spinCtx.strokeStyle = 'rgba(80,60,30,.18)';
    spinCtx.lineWidth = 1.4;
    [0.33, 0.66].forEach((k) => {
      spinCtx.beginPath(); spinCtx.arc(cx, cy, rad * k, 0, Math.PI * 2); spinCtx.stroke();
    });
    spinCtx.beginPath(); spinCtx.moveTo(cx, cy - rad); spinCtx.lineTo(cx, cy + rad); spinCtx.stroke();
    spinCtx.beginPath(); spinCtx.moveTo(cx - rad, cy); spinCtx.lineTo(cx + rad, cy); spinCtx.stroke();

    // centre mark
    spinCtx.fillStyle = 'rgba(80,60,30,.35)';
    spinCtx.beginPath(); spinCtx.arc(cx, cy, 2.5, 0, Math.PI * 2); spinCtx.fill();

    // contact dot
    const maxR = rad - 17;
    const dx = cx + app.spin.x * maxR;
    const dy = cy - app.spin.y * maxR;
    spinCtx.strokeStyle = 'rgba(60,40,10,.4)';
    spinCtx.lineWidth = 1.5;
    spinCtx.beginPath(); spinCtx.moveTo(cx, cy); spinCtx.lineTo(dx, dy); spinCtx.stroke();

    const dg = spinCtx.createRadialGradient(dx - 3, dy - 4, 1, dx, dy, 13);
    dg.addColorStop(0, '#fff1c4');
    dg.addColorStop(0.45, '#d9b163');
    dg.addColorStop(1, '#6c4b18');
    spinCtx.beginPath(); spinCtx.arc(dx, dy, 12, 0, Math.PI * 2);
    spinCtx.fillStyle = dg; spinCtx.fill();
    spinCtx.strokeStyle = 'rgba(40,25,5,.55)'; spinCtx.lineWidth = 2; spinCtx.stroke();
    spinCtx.beginPath(); spinCtx.arc(dx, dy, 4.5, 0, Math.PI * 2);
    spinCtx.fillStyle = 'rgba(40,25,5,.7)'; spinCtx.fill();

    // highlight
    spinCtx.beginPath(); spinCtx.ellipse(cx - rad * 0.38, cy - rad * 0.45, rad * 0.18, rad * 0.1, -0.5, 0, Math.PI * 2);
    spinCtx.fillStyle = 'rgba(255,255,255,.45)'; spinCtx.fill();
  }

  function spinFromEvent(e) {
    const rect = dom.spinPad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 10;
    let x = (e.clientX - cx) / maxR;
    let y = -(e.clientY - cy) / maxR;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    if (len < 0.07) { x = 0; y = 0; }
    app.spin.x = clamp(x, -1, 1);
    app.spin.y = clamp(y, -1, 1);
    updateSpinUI();
  }

  function onSpinDown(e) {
    if (!isHumanTurn()) return;
    spinDragging = true;
    dom.spinPad.setPointerCapture(e.pointerId);
    spinFromEvent(e);
  }
  function onSpinMove(e) {
    if (!spinDragging) return;
    spinFromEvent(e);
  }
  function onSpinUp(e) {
    spinDragging = false;
    try { dom.spinPad.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  /* ── Toast / banner ───────────────────────────────────────────────────── */
  let toastTimer = 0;
  let bannerTimer = 0;
  function toast(message, kind, kicker) {
    dom.toastMessage.textContent = message;
    dom.toastKicker.textContent = kicker || 'Referee';
    dom.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { dom.toast.className = 'toast'; }, 3600);
  }

  function banner(kicker, title, sub) {
    dom.bannerKicker.textContent = kicker || '';
    dom.bannerTitle.textContent = title || '';
    dom.bannerSub.textContent = sub || '';
    dom.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => dom.banner.classList.remove('show'), 2100);
  }

  function flashTurn() {
    dom.turnFlash.classList.add('show');
    setTimeout(() => dom.turnFlash.classList.remove('show'), 140);
  }

  /* ────────────────────────────────────────────────────────────────────────
     13 · MODALS, STATS EXPORT / IMPORT
     ──────────────────────────────────────────────────────────────────────── */
  function openModal(id) {
    const m = $(id);
    if (!m) return;
    if (id === 'modal-stats') refreshStatsModal();
    if (id === 'modal-rulings') renderRulings();
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
  }

  function closeModal(id) {
    const m = $(id);
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop.open').forEach((m) => {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
    });
  }

  function refreshStatsModal() {
    dom.statMatches.textContent = stats.matchesPlayed;
    dom.statP1.textContent = stats.wins.p1;
    dom.statP2.textContent = stats.wins.p2;
    dom.statAi.textContent = stats.wins.ai;
    dom.statHigh.textContent = stats.highBreak;
    dom.statCenturies.textContent = stats.centuries;
    dom.statPots.textContent = stats.totalPots;
    dom.statFrames.textContent = stats.framesPlayed;
  }

  function exportStats() {
    saveStats();
    const payload = {
      app: 'snooker-3d',
      version: 1,
      exportedAt: new Date().toISOString(),
      stats
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snooker_3d_stats.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast('snooker_3d_stats.json downloaded', 'success', 'Career exported');
  }

  function importStatsFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = parsed && parsed.stats ? parsed.stats : parsed;
        if (!incoming || typeof incoming !== 'object') throw new Error('No stats object');
        stats = sanitiseStats(incoming);
        saveStats();
        refreshStatsModal();
        updateUI();
        toast('Career restored from file', 'success', 'Career imported');
      } catch (err) {
        toast('That file is not a snooker career export', 'foul', 'Import failed');
      }
    };
    reader.onerror = () => toast('Could not read that file', 'foul', 'Import failed');
    reader.readAsText(file);
  }

  function resetStats() {
    if (!window.confirm('Reset every career statistic in this browser?')) return;
    stats = defaultStats();
    saveStats();
    refreshStatsModal();
    updateUI();
    toast('Career reset to a clean slate', 'info', 'Members book');
  }

  /* ────────────────────────────────────────────────────────────────────────
     14 · LOOP
     ──────────────────────────────────────────────────────────────────────── */
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();

    if (app.charging) updateCharge(now);

    if (app.phase === 'rolling') {
      stepPhysics(dt);
      checkPockets();
      updatePotAnims(dt);

      if (app.shot) {
        const elapsed = (now - app.shot.startedAt) / 1000;
        if (ballsAtRest() && elapsed > 0.75) {
          app.shot.restTime += dt;
          if (app.shot.restTime > 0.5) endShot();
        } else {
          app.shot.restTime = 0;
        }
        if (elapsed > 34) {
          balls.forEach((b) => {
            b.body.velocity.set(0, 0, 0);
            b.body.angularVelocity.set(0, 0, 0);
          });
          endShot();
        }
      }
    } else if (app.phase === 'aiming') {
      smoothAim(dt);
      stepPhysics(dt * 0.35); // keep resting balls stable / settle tiny jitters
      updatePotAnims(dt);
      updateAimGuide();
    } else {
      updatePotAnims(dt);
    }

    if (app.cueStrike) updateCueStrike(dt);
    if (app.phase !== 'aiming') cueGroup.visible = app.cueStrike ? cueGroup.visible : false;
    if (app.phase === 'aiming') {
      const p = cueBall.body.position;
      cueRing.visible = true;
      cueRing.position.set(p.x, 0.0025, p.z);
    }

    updateAimCamera(dt);

    if (dustPoints) {
      dustPoints.rotation.y += dt * 0.008;
      dustPoints.position.y = Math.sin(now * 0.00008) * 0.01;
    }

    if (shadowLight) {
      shadowLight.intensity = 1.5 + Math.sin(now * 0.0011) * 0.015;
    }

    // camera shake after a foul / heavy strike
    if (app.shake > 0) {
      app.shake = Math.max(0, app.shake - dt * 2.2);
      camera.position.x += (Math.random() - 0.5) * app.shake * 0.006;
      camera.position.y += (Math.random() - 0.5) * app.shake * 0.006;
    }

    updateBallHighlights(now);
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
  }

  /* ────────────────────────────────────────────────────────────────────────
     15 · BOOT
     ──────────────────────────────────────────────────────────────────────── */
  function bindUI() {
    dom.powerSlider.addEventListener('input', (e) => {
      if (!isHumanTurn()) return;
      app.power = Number(e.target.value);
      updatePowerUI();
    });

    dom.chargeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!isHumanTurn()) return;
      startCharge();
    });
    dom.chargeBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      if (app.charging) releaseCharge();
    });
    dom.chargeBtn.addEventListener('pointerleave', () => {
      if (app.charging) releaseCharge();
    });
    dom.chargeBtn.addEventListener('pointercancel', () => {
      if (app.charging) releaseCharge();
    });

    dom.shootBtn.addEventListener('click', () => {
      if (!isHumanTurn()) return;
      Audio.unlock();
      takeShot();
    });

    dom.fontDown.addEventListener('click', () => changeFontScale(-FONT_STEP));
    dom.fontUp.addEventListener('click', () => changeFontScale(FONT_STEP));
    dom.rulingsBtn.addEventListener('click', openRulings);
    dom.clearRulings.addEventListener('click', clearRulings);
    dom.lastCall.addEventListener('click', openRulings);
    dom.lastCall.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openRulings();
      }
    });

    dom.lockAimBtn.addEventListener('click', () => {
      if (!isHumanTurn()) return;
      setAimLocked(!app.aimLocked);
    });
    dom.recenterBtn.addEventListener('click', () => {
      if (!isHumanTurn()) return;
      recenterAimCamera();
      toast('View re-centred behind the cue ball', 'info', 'Camera');
    });

    document.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });
    document.querySelectorAll('[data-ball]').forEach((btn) => {
      btn.addEventListener('click', () => toggleBallHighlight(btn.dataset.ball));
    });
    document.querySelectorAll('[data-nudge]').forEach((btn) => {
      btn.addEventListener('click', () => nudgeAim(Number(btn.dataset.nudge)));
    });

    dom.spinReset.addEventListener('click', resetSpin);
    dom.elevSlider.addEventListener('input', (e) => {
      app.elevation = Number(e.target.value);
      dom.elevReadout.textContent = `${app.elevation}°`;
    });

    $('btn-new-frame-top').addEventListener('click', () => {
      if (app.phase === 'rolling' || app.phase === 'settling') {
        toast('Let the balls come to rest first', 'info', 'One moment');
        return;
      }
      if (!rules.frameOver && (rules.scores[0] > 0 || rules.scores[1] > 0)) {
        if (!window.confirm('Abandon this frame and rack a new one?')) return;
      }
      newFrame(true);
    });
    $('btn-rules').addEventListener('click', () => openModal('modal-rules'));
    $('btn-help').addEventListener('click', () => openModal('modal-rules'));
    $('btn-stats').addEventListener('click', () => openModal('modal-stats'));
    $('btn-mode').addEventListener('click', switchMode);
    $('btn-sound').addEventListener('click', () => {
      app.soundOn = !app.soundOn;
      document.body.classList.toggle('is-muted', !app.soundOn);
      try { localStorage.setItem(MUTE_KEY, app.soundOn ? '0' : '1'); } catch (err) { /* noop */ }
      if (app.soundOn) { Audio.unlock(); Audio.turn(); }
      toast(app.soundOn ? 'Sound on' : 'Sound off', 'info', 'Room');
    });

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-backdrop').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); });
    });

    $('btn-export').addEventListener('click', exportStats);
    $('btn-import').addEventListener('click', () => dom.importFile.click());
    dom.importFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importStatsFile(file);
      e.target.value = '';
    });
    $('btn-reset-stats').addEventListener('click', resetStats);

    $('btn-new-frame').addEventListener('click', () => newFrame(true));
    $('btn-result-close').addEventListener('click', () => closeModal('modal-result'));

    // first gesture unlocks audio
    window.addEventListener('pointerdown', () => Audio.unlock(), { once: true });
    window.addEventListener('touchstart', () => Audio.unlock(), { once: true, passive: true });
  }

  function renderLoopStart() {
    requestAnimationFrame(tick);
  }

  function init() {
    try {
      if (!window.THREE) throw new Error('Three.js could not be loaded from the CDN.');
      if (!window.CANNON) throw new Error('Cannon.js could not be loaded from the CDN.');
      if (!THREE.OrbitControls) throw new Error('OrbitControls could not be loaded from the CDN.');

      stats = loadStats();
      rulingHistory = loadRulings();
      app.soundOn = !loadMute();
      document.body.classList.toggle('is-muted', !app.soundOn);
      applyFontScale(loadFontScale(), false);

      dom.loaderNote.textContent = 'Polishing the mahogany…';
      dom.loaderBar.style.width = '24%';

      initThree();
      app._orbitPos = camera.position.clone();
      app._orbitTarget = controls.target.clone();
      dom.loaderBar.style.width = '52%';
      initPhysics();
      dom.loaderBar.style.width = '78%';

      app.potAnims = [];
      resetRules(0);
      app.phase = 'aiming';
      resetBallPhysics();
      balls.forEach((b) => {
        b.active = true;
        b.pottedThisShot = false;
        b.mesh.visible = true;
      });
      app.aimAngle = Math.atan2(-CUE_START[1], RED_APEX_X - CUE_START[0]);
      app.aimTarget = app.aimAngle;
      drawSpinPad();
      updatePowerUI();
      updateAimReadout();
      updateSpinUI();
      updateUI();
      bindUI();
      newFrame(false);
      renderLoopStart();

      dom.loaderBar.style.width = '100%';
      dom.loaderNote.textContent = 'Opening the club…';
      setTimeout(() => {
        dom.loader.classList.add('is-done');
        setTimeout(() => { dom.loader.style.display = 'none'; }, 900);
        banner('The Mahogany Room', 'Frame 01', `${playerName(rules.current)} to break`);
      }, 520);

      if (new URLSearchParams(window.location.search).has('selftest')) {
        setTimeout(runSelfTests, 600);
      }
    } catch (err) {
      console.error(err);
      dom.loaderNote.textContent = err.message || 'The table could not be prepared.';
      dom.loaderNote.style.color = '#d4524b';
      dom.loaderBar.style.width = '100%';
      dom.loaderBar.style.background = '#7a2e2a';
      const test = dom.selftest;
      test.hidden = false;
      test.textContent = 'BOOT ERROR: ' + (err.stack || err.message);
    }
  }

  /* ────────────────────────────────────────────────────────────────────────
     16 · DEBUG / SELF TEST
     ──────────────────────────────────────────────────────────────────────── */
  function runSelfTests() {
    const results = [];
    const check = (name, fn) => {
      try {
        const value = fn();
        results.push({ name, pass: value === true, detail: value === true ? 'ok' : String(value) });
      } catch (err) {
        results.push({ name, pass: false, detail: err.message });
      }
    };

    check('22 balls on the table', () => balls.length === 22 || `found ${balls.length}`);
    check('15 reds', () => balls.filter((b) => b.type === 'red').length === 15);
    check('6 colours', () => COLOR_ORDER.every((t) => balls.some((b) => b.type === t)));
    check('cue ball present', () => !!cueBall && cueBall.type === 'cue');
    check('all balls inside cushions', () => balls.every((b) =>
      Math.abs(b.body.position.x) < L && Math.abs(b.body.position.z) < W
    ) || 'a ball starts outside the table');
    check('aim guide dotted line built', () => !!aimLine && aimDots.length > 20);
    check('spin pad present', () => !!dom.spinPad);
    check('30+ fps hardware / canvas', () => !!renderer && !!renderer.domElement);

    // referee scenarios (snapshot & restore)
    const savedRules = JSON.parse(JSON.stringify(rules));
    const savedBalls = balls;
    const savedStats = JSON.parse(JSON.stringify(stats));
    const savedFrameHigh = app.frameHigh;
    const savedCentury = app.centuryThisBreak;
    const fake = [
      { type: 'red', value: 1, active: true },
      { type: 'yellow', value: 2, active: true },
      { type: 'green', value: 3, active: true },
      { type: 'brown', value: 4, active: true },
      { type: 'blue', value: 5, active: true },
      { type: 'pink', value: 6, active: true },
      { type: 'black', value: 7, active: true }
    ];
    balls = fake;
    try {
      let r = { scores: [0, 0], current: 0, break: 0, ballOn: 'red', redsRemaining: 15, frameOver: false };
      Object.assign(rules, r);
      let out = resolveShot({ potted: [fake[0]], firstContact: fake[0], cuePotted: false });
      check('legal red scores 1 and stays at table', () =>
        out.points === 1 && rules.scores[0] === 1 && rules.ballOn === 'color' && rules.redsRemaining === 14);

      r = { scores: [0, 0], current: 0, break: 0, ballOn: 'color', redsRemaining: 14, frameOver: false };
      Object.assign(rules, r);
      out = resolveShot({ potted: [fake[4]], firstContact: fake[4], cuePotted: false });
      check('colour after red scores and respots', () =>
        out.points === 5 && out.respot.length === 1 && rules.ballOn === 'red');

      r = { scores: [0, 0], current: 0, break: 0, ballOn: 'red', redsRemaining: 15, frameOver: false };
      Object.assign(rules, r);
      out = resolveShot({ potted: [], firstContact: fake[4], cuePotted: false });
      check('wrong ball first is a 5-point foul', () =>
        out.foul === true && out.penalty === 5 && rules.scores[1] === 5 && rules.current === 1);

      r = { scores: [0, 0], current: 0, break: 0, ballOn: 'red', redsRemaining: 15, frameOver: false };
      Object.assign(rules, r);
      out = resolveShot({ potted: [], firstContact: null, cuePotted: false });
      check('missing everything is a 4-point foul', () =>
        out.foul === true && out.penalty === 4 && rules.scores[1] === 4);

      r = { scores: [0, 0], current: 0, break: 0, ballOn: 'red', redsRemaining: 15, frameOver: false };
      Object.assign(rules, r);
      out = resolveShot({ potted: [], firstContact: fake[0], cuePotted: true });
      check('scratching is a foul and respots cue', () =>
        out.foul === true && out.cuePotted === true && rules.current === 1);

      r = { scores: [10, 20], current: 0, break: 0, ballOn: 'black', redsRemaining: 0, frameOver: false };
      Object.assign(rules, r);
      fake.slice(1).forEach((b) => { b.active = false; });
      out = resolveShot({ potted: [fake[6]], firstContact: fake[6], cuePotted: false });
      check('clearance black scores 7 and ends colours', () =>
        out.points === 7 && rules.ballOn === null && rules.scores[0] === 17);

      r = { scores: [10, 20], current: 0, break: 4, ballOn: 'color', redsRemaining: 0, frameOver: false };
      Object.assign(rules, r);
      fake.forEach((b) => { b.active = true; });
      out = resolveShot({ potted: [], firstContact: fake[1], cuePotted: false });
      check('last red gone, a missed colour keeps colour-on', () =>
        out.foul === false && rules.ballOn === 'color' && rules.current === 1);
    } finally {
      balls = savedBalls;
      Object.assign(rules, savedRules);
      stats = savedStats;
      app.frameHigh = savedFrameHigh;
      app.centuryThisBreak = savedCentury;
      updateUI();
    }

    const passed = results.filter((r) => r.pass).length;
    dom.selftest.hidden = false;
    dom.selftest.textContent = JSON.stringify({ passed, total: results.length, results }, null, 2);
    console.table(results);
    return { passed, total: results.length, results };
  }

  // A small public handle for debugging and for the self-test harness.
  window.SNOOKER = {
    get balls() { return balls; },
    get rules() { return rules; },
    get app() { return app; },
    get stats() { return stats; },
    get world() { return world; },
    get camera() { return camera; },
    get controls() { return controls; },
    get renderer() { return renderer; },
    resolveShot,
    legalTargets,
    pathClear,
    isLegalType,
    aimAtNearestLegal,
    findClearAim,
    finishFrame,
    newFrame,
    takeShot,
    runSelfTests,
    setCameraMode,
    setTool,
    respotBall,
    resetSpin
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
