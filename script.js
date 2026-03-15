/* ===================================================
   SIGNALS IN THE FOG
   Ichigo protects Hoshima from the Wako fleet
   Inspired by Tomorrow, and Tomorrow, and Tomorrow
   =================================================== */

(function () {
  'use strict';

  var GRID = 10;
  var SHIPS = [
    { name: 'Takeda\'s Trawler',  len: 5 },
    { name: 'The Kaze Maru',      len: 4 },
    { name: 'Hana\'s Skiff',      len: 3 },
    { name: 'The Silent Drum',     len: 3 },
    { name: 'Ichigo\'s Raft',     len: 2 }
  ];

  // Wako enemy fleet names (for display when sunk)
  var ENEMY_SHIPS = [
    { name: 'Black Tide',      len: 5 },
    { name: 'Iron Fang',       len: 4 },
    { name: 'Crimson Wake',    len: 3 },
    { name: 'Ghost Sail',      len: 3 },
    { name: 'Shadow Oar',      len: 2 }
  ];

  /* ---- Narrative Text (Wako fleet theme) ---- */
  var TEXT = {
    playerMiss: [
      'The torpedo sinks into empty water.',
      'Nothing there. The fog swallows the signal.',
      'The strike finds only silence beneath the surface.',
      'Ichigo watches the ripple vanish. The sea keeps its secrets.'
    ],
    playerHit: [
      'Wood splinters in the fog.',
      'A Wako hull cracks. Contact.',
      'The ocean shudders — something is wounded out there.',
      'A signal of impact echoes through the mist.'
    ],
    playerSunk: [
      'The Wako vessel slips beneath the waves.',
      'One enemy ship descends into the current. Gone.',
      'The hull breaks apart in the deep. The sea claims it.'
    ],
    aiMiss: [
      'An enemy torpedo passes through your waters harmlessly.',
      'The Wako search blindly through the fog.',
      'Their signal finds nothing. Ichigo\'s fleet holds steady.'
    ],
    aiHit: [
      'A strike tears through your hull.',
      'Impact. The Wako have found Ichigo through the mist.',
      'Your vessel shudders. They are closing in.'
    ],
    aiSunk: [
      'One of Ichigo\'s vessels vanishes beneath the surface.',
      'Your fleet grows smaller. The fog presses closer.',
      'A ship is lost. Hoshima\'s defense weakens.'
    ],
    aiScan: [
      'Enemy signals scanning the water...'
    ],
    crowded: 'The water is full of echoes. Every strike has left its mark.',
    studying: 'The Wako seem to be studying Ichigo\'s patterns.',
    exposed: 'Your search pattern is no longer hidden. They are learning.'
  };

  /* ---- State ---- */
  var state;
  var audioCtx = null;
  var ambientNodes = [];

  function freshState() {
    return {
      phase: 'intro',
      playerBoard: makeBoard(),
      aiBoard: makeBoard(),
      playerShips: [],
      aiShips: [],
      playerTurn: true,
      turnCount: 0,
      battleLog: [],
      aiMode: 'search',
      aiQueue: [],
      aiFired: {},
      playerFired: {},
      playerHeat: makeGrid(0),
      mirrorActive: false,
      flagCrowded: false,
      flagStudying: false,
      flagExposed: false
    };
  }

  function makeGrid(val) {
    var g = [];
    for (var y = 0; y < GRID; y++) {
      g[y] = [];
      for (var x = 0; x < GRID; x++) g[y][x] = val;
    }
    return g;
  }

  function makeBoard() {
    var b = [];
    for (var y = 0; y < GRID; y++) {
      b[y] = [];
      for (var x = 0; x < GRID; x++) {
        b[y][x] = { ship: -1, hit: false };
      }
    }
    return b;
  }

  function coordKey(x, y) { return x + ',' + y; }
  function inBounds(x, y) { return x >= 0 && x < GRID && y >= 0 && y < GRID; }

  function canPlace(board, x, y, len, dir) {
    for (var i = 0; i < len; i++) {
      var cx = dir === 'h' ? x + i : x;
      var cy = dir === 'v' ? y + i : y;
      if (!inBounds(cx, cy) || board[cy][cx].ship !== -1) return false;
    }
    return true;
  }

  function doPlace(board, x, y, len, dir, idx) {
    var coords = [];
    for (var i = 0; i < len; i++) {
      var cx = dir === 'h' ? x + i : x;
      var cy = dir === 'v' ? y + i : y;
      board[cy][cx].ship = idx;
      coords.push({ x: cx, y: cy });
    }
    return coords;
  }

  function placeAllShips(board, shipList) {
    var list = shipList || SHIPS;
    var ships = [];
    for (var s = 0; s < list.length; s++) {
      var placed = false;
      for (var att = 0; att < 1000 && !placed; att++) {
        var dir = Math.random() < 0.5 ? 'h' : 'v';
        var x = Math.floor(Math.random() * GRID);
        var y = Math.floor(Math.random() * GRID);
        if (canPlace(board, x, y, list[s].len, dir)) {
          var coords = doPlace(board, x, y, list[s].len, dir, s);
          ships.push({
            name: list[s].name,
            len: list[s].len,
            coords: coords,
            hits: 0,
            sunk: false
          });
          placed = true;
        }
      }
    }
    return ships;
  }

  function allSunk(ships) {
    for (var i = 0; i < ships.length; i++) {
      if (!ships[i].sunk) return false;
    }
    return true;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ---- Ambient Ocean Audio + Melody (Web Audio API) ---- */
  var melodyTimer = null;

  var audioStarted = false;

  function initAudio() {
    if (audioStarted) return;
    // iOS Safari: AudioContext MUST be created inside a user gesture handler
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return;
      }
    }
    // iOS Safari: resume() must be called synchronously in the gesture handler
    var p = audioCtx.resume();
    // iOS Safari: play a silent buffer synchronously to "warm up" the context
    try {
      var silentBuffer = audioCtx.createBuffer(1, 1, 22050);
      var source = audioCtx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (e) { /* ignore */ }
    // Start audio immediately if context is already running
    function doStart() {
      if (audioStarted) return;
      audioStarted = true;
      startAmbient();
      startMelody();
    }
    if (audioCtx.state === 'running') {
      doStart();
    } else {
      // Wait for resume promise
      if (p && p.then) {
        p.then(doStart);
      }
      // Also listen for statechange as fallback
      audioCtx.addEventListener('statechange', function () {
        if (audioCtx.state === 'running') doStart();
      });
      // Poll as last resort
      var polls = 0;
      var pi = setInterval(function () {
        polls++;
        if (audioCtx && audioCtx.state === 'running') {
          doStart();
          clearInterval(pi);
        }
        if (polls > 30) clearInterval(pi);
      }, 200);
    }
  }

  function startAmbient() {
    if (!audioCtx) return;

    // Master gain for all ambient sounds
    var masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
    masterGain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.5);
    ambientNodes.push(masterGain);

    // Pad drone - mid frequency, audible on all speakers
    var padOsc = audioCtx.createOscillator();
    var padGain = audioCtx.createGain();
    padOsc.type = 'sine';
    padOsc.frequency.value = 220; // A3 - audible on laptop speakers
    padGain.gain.value = 0.12;
    padOsc.connect(padGain);
    padGain.connect(masterGain);
    padOsc.start();
    ambientNodes.push(padOsc, padGain);

    // Second pad - perfect fifth above
    var pad2 = audioCtx.createOscillator();
    var pad2Gain = audioCtx.createGain();
    pad2.type = 'sine';
    pad2.frequency.value = 330; // E4
    pad2Gain.gain.value = 0.06;
    pad2.connect(pad2Gain);
    pad2Gain.connect(masterGain);
    pad2.start();
    ambientNodes.push(pad2, pad2Gain);

    // Slow vibrato on pads for shimmer
    var vibrato = audioCtx.createOscillator();
    var vibGain = audioCtx.createGain();
    vibrato.type = 'sine';
    vibrato.frequency.value = 0.3;
    vibGain.gain.value = 3;
    vibrato.connect(vibGain);
    vibGain.connect(padOsc.frequency);
    vibrato.start();
    ambientNodes.push(vibrato, vibGain);

    // White noise filtered as ocean wash
    var bufferSize = 2 * audioCtx.sampleRate;
    var noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var output = noiseBuffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    var whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    var noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 0.5;

    var noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.15;

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    whiteNoise.start();
    ambientNodes.push(whiteNoise, noiseFilter, noiseGain);

    // Wave-like volume modulation on noise
    var waveLFO = audioCtx.createOscillator();
    var waveLFOGain = audioCtx.createGain();
    waveLFO.type = 'sine';
    waveLFO.frequency.value = 0.08;
    waveLFOGain.gain.value = 0.08;
    waveLFO.connect(waveLFOGain);
    waveLFOGain.connect(noiseGain.gain);
    waveLFO.start();
    ambientNodes.push(waveLFO, waveLFOGain);
  }

  // Japanese pentatonic melody (A minor pentatonic / In scale)
  // Notes: A4, C5, D5, E5, G5, A5
  var MELODY_NOTES = [440, 523.25, 587.33, 659.25, 783.99, 880];

  function playNote(freq, duration, delayTime) {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var env = audioCtx.createGain();
    var filter = audioCtx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    env.gain.value = 0;

    osc.connect(filter);
    filter.connect(env);
    env.connect(audioCtx.destination);

    var startT = audioCtx.currentTime + delayTime;
    var fadeIn = 0.3;
    var sustain = duration * 0.5;
    var fadeOut = duration * 0.5;

    env.gain.setValueAtTime(0, startT);
    env.gain.linearRampToValueAtTime(0.25, startT + fadeIn);
    env.gain.setValueAtTime(0.25, startT + fadeIn + sustain);
    env.gain.linearRampToValueAtTime(0, startT + fadeIn + sustain + fadeOut);

    osc.start(startT);
    osc.stop(startT + fadeIn + sustain + fadeOut + 0.1);
  }

  function playMelodyPhrase() {
    if (!audioCtx) return;

    // Pick 3-5 random notes from the pentatonic scale
    var noteCount = 3 + Math.floor(Math.random() * 3);
    var delay = 0;

    for (var i = 0; i < noteCount; i++) {
      var noteIdx = Math.floor(Math.random() * MELODY_NOTES.length);
      var freq = MELODY_NOTES[noteIdx];
      var dur = 1.5 + Math.random() * 2.5; // 1.5-4 seconds per note
      playNote(freq, dur, delay);
      delay += dur * 0.6 + Math.random() * 0.5; // slight overlap between notes
    }

    // Schedule next phrase after this one finishes + pause
    var nextDelay = (delay + 2 + Math.random() * 4) * 1000;
    melodyTimer = setTimeout(function () {
      playMelodyPhrase();
    }, nextDelay);
  }

  function startMelody() {
    // Play a single clear note immediately so user hears something right away
    playNote(440, 3, 0);    // A4
    playNote(659.25, 3, 0.8); // E5
    // Then start looping melody phrases
    melodyTimer = setTimeout(function () {
      playMelodyPhrase();
    }, 3000);
  }

  function stopAmbient() {
    if (melodyTimer) {
      clearTimeout(melodyTimer);
      melodyTimer = null;
    }
    ambientNodes.forEach(function (n) {
      try { n.stop(); } catch (e) { /* ignore */ }
      try { n.disconnect(); } catch (e) { /* ignore */ }
    });
    ambientNodes = [];
    if (audioCtx) {
      try { audioCtx.close(); } catch (e) { /* ignore */ }
      audioCtx = null;
    }
  }

  /* ---- Device Mode ---- */
  var isMobileMode = false;

  /* ---- DOM References ---- */
  var $sDevice = document.getElementById('screen-device');
  var $s0 = document.getElementById('screen-0');
  var $s1 = document.getElementById('screen-1');
  var $s2 = document.getElementById('screen-2');
  var $s3 = document.getElementById('screen-3');
  var $s4 = document.getElementById('screen-4');
  var $game = document.getElementById('game-screen');
  var $end = document.getElementById('end-screen');
  var $sTut = document.getElementById('screen-tutorial');
  var $sPlace = document.getElementById('placement-screen');
  var $btnStart = document.getElementById('btn-start');
  var $btnBeginBattle = document.getElementById('btn-begin-battle');
  var $btnConfirmFleet = document.getElementById('btn-confirm-fleet');
  var $btnRestart = document.getElementById('btn-restart');
  var $endTitle = document.getElementById('end-title');
  var $btnMobileRotate = document.getElementById('btn-mobile-rotate');
  var $btnDeviceMobile = document.getElementById('btn-device-mobile');
  var $btnDeviceDesktop = document.getElementById('btn-device-desktop');
  var $mobileDir = document.getElementById('mobile-direction');
  var $placeBoard = document.getElementById('placement-board');
  var $placeShipName = document.getElementById('placement-ship-name');
  var $placeHint = document.getElementById('placement-hint');
  var $placeQueue = document.getElementById('placement-queue');
  var $pBoard = document.getElementById('player-board');
  var $aBoard = document.getElementById('ai-board');
  var $pFleet = document.getElementById('player-fleet');
  var $aFleet = document.getElementById('ai-fleet');
  var $status = document.getElementById('status-bar');
  var $log = document.getElementById('log');
  var $sonar = document.getElementById('sonar');
  var $endLines = document.getElementById('end-lines');
  var $callout = document.getElementById('callout');
  var $legendFleet = document.getElementById('legend-fleet');

  var allScreens = [$sDevice, $s0, $s1, $s2, $s3, $s4, $sTut, $sPlace, $game, $end];

  /* ---- Ship Placement State ---- */
  var placementDir = 'h';
  var placementIdx = 0;
  var placementBoard = null;
  var placementShips = [];
  var lastHoverX = -1;
  var lastHoverY = -1;
  // Mobile preview state: tap once to preview, tap same cell again to confirm
  var mobilePreviewX = -1;
  var mobilePreviewY = -1;
  var mobilePreviewActive = false;

  /* ---- Typewriter Effect ---- */
  function typeLine(element, delay) {
    if (!delay) delay = 25;
    var text = element.textContent;
    element.textContent = '';
    element.classList.add('show');
    var chars = text.split('');
    for (var i = 0; i < chars.length; i++) {
      (function (idx) {
        var span = document.createElement('span');
        span.className = 'typewriter-char';
        span.textContent = chars[idx];
        span.style.animationDelay = (idx * delay) + 'ms';
        element.appendChild(span);
      })(i);
    }
  }

  /* ---- Sound Effects (Web Audio API) ---- */
  function playTaikoDrum() {
    if (!audioCtx) return;
    // Taiko: low frequency burst with fast decay
    var osc = audioCtx.createOscillator();
    var osc2 = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    var gain2 = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 80;
    osc2.type = 'triangle';
    osc2.frequency.value = 60;

    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
    gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

    // Add noise burst for the "hit" texture
    var noiseLen = audioCtx.sampleRate * 0.15;
    var noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
    var noiseData = noiseBuf.getChannelData(0);
    for (var i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.4;
    var noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuf;
    var noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    var noiseFilt = audioCtx.createBiquadFilter();
    noiseFilt.type = 'lowpass';
    noiseFilt.frequency.value = 400;

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    noiseNode.connect(noiseFilt);
    noiseFilt.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    osc.start();
    osc2.start();
    noiseNode.start();
    osc.stop(audioCtx.currentTime + 1.5);
    osc2.stop(audioCtx.currentTime + 1.0);
  }

  function playShipHitSound() {
    if (!audioCtx) return;
    // Impact: sharp noise burst + low thud
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);

    // Noise burst
    var noiseLen = audioCtx.sampleRate * 0.1;
    var noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
    var noiseData = noiseBuf.getChannelData(0);
    for (var i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1);
    var noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuf;
    var noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    noiseNode.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseNode.start();
  }

  function triggerScreenShake() {
    document.body.classList.add('hit-shake');
    setTimeout(function () {
      document.body.classList.remove('hit-shake');
    }, 300);
  }

  /* ---- HIT / SUNK Callout ---- */
  function showCallout(text, type) {
    if (!$callout) return;
    $callout.textContent = text;
    $callout.className = 'callout';
    if (type === 'hit') $callout.classList.add('callout-hit');
    if (type === 'sunk') $callout.classList.add('callout-sunk');
    if (type === 'miss') $callout.classList.add('callout-miss');
    // Force reflow
    void $callout.offsetWidth;
    $callout.classList.add('callout-show');
    setTimeout(function () {
      $callout.classList.remove('callout-show');
      $callout.classList.add('callout-fade');
    }, 600);
    setTimeout(function () {
      $callout.className = 'callout';
    }, 1200);
  }

  /* ---- Legend Fleet ---- */
  function renderLegendFleet() {
    if (!$legendFleet) return;
    $legendFleet.innerHTML = '';
    for (var i = 0; i < state.playerShips.length; i++) {
      var ship = state.playerShips[i];
      var div = document.createElement('div');
      div.className = 'legend-ship';
      if (ship.sunk) div.classList.add('legend-sunk-ship');
      var bar = document.createElement('span');
      bar.className = 'legend-ship-bar';
      bar.style.width = (ship.len * 8) + 'px';
      var name = document.createElement('span');
      name.textContent = ship.name + ' (' + ship.len + ')';
      div.appendChild(bar);
      div.appendChild(name);
      $legendFleet.appendChild(div);
    }
  }

  /* ---- Intro Sequence ---- */
  function runIntroSequence() {
    // Screen 1: The Village
    showIntroScreen($s1, [
      { sel: '.s1-1', delay: 500, type: true },
      { sel: '.s1-2', delay: 2500, type: true },
      { sel: '.s1-3', delay: 4500, type: true },
      { sel: '.s1-4', delay: 6500, type: true },
      { sel: '.s1-6', delay: 9000, type: true }
    ], 12000, function () {
      // Screen 2: The Threat
      showIntroScreen($s2, [
        { sel: '.s2-1', delay: 500, type: true },
        { sel: '.s2-3', delay: 3000, type: true },
        { sel: '.s2-4', delay: 4500, type: true },
        { sel: '.s2-6', delay: 7000, type: true },
        { sel: '.s2-7', delay: 9000, type: true }
      ], 12000, function () {
        // Screen 3: Ichigo (with taiko drum)
        showIntroScreen($s3, [
          { sel: '.ichigo-silhouette', delay: 300 },
          { sel: '.s3-1', delay: 1500, type: true, sound: 'taiko' },
          { sel: '.s3-3', delay: 3500, type: true },
          { sel: '.s3-4', delay: 5000, type: true },
          { sel: '.s3-6', delay: 7000, type: true },
          { sel: '.s3-7', delay: 8500, type: true },
          { sel: '.s3-8', delay: 10500, type: true },
          { sel: '.s3-9', delay: 12000, type: true },
          { sel: '.s3-10', delay: 13500, type: true }
        ], 16000, function () {
          // Screen 4: Mission
          showIntroScreen($s4, [
            { sel: '.s4-1', delay: 500, type: true },
            { sel: '.s4-2', delay: 3000, type: true },
            { sel: '.s4-3', delay: 4500, type: true },
            { sel: '.s4-4', delay: 6000, type: true },
            { sel: '.s4-5', delay: 8000 }
          ], null, null); // No auto-advance; button click starts game
        });
      });
    });
  }

  function showIntroScreen(screen, items, autoAdvanceMs, nextFn) {
    // Hide all screens
    allScreens.forEach(function (s) {
      s.classList.remove('visible');
      s.classList.remove('fading');
    });

    // Show this screen
    screen.classList.add('visible');

    // Reveal items one by one (with optional typewriter + sound)
    items.forEach(function (item) {
      setTimeout(function () {
        var el = screen.querySelector(item.sel);
        if (!el) return;
        if (item.type && el.tagName === 'P') {
          typeLine(el, 30);
        } else {
          el.classList.add('show');
        }
        if (item.sound === 'taiko') {
          playTaikoDrum();
        }
      }, item.delay);
    });

    // Auto-advance to next screen
    if (autoAdvanceMs && nextFn) {
      setTimeout(function () {
        screen.classList.add('fading');
        setTimeout(function () {
          screen.classList.remove('visible');
          screen.classList.remove('fading');
          nextFn();
        }, 1500);
      }, autoAdvanceMs);
    }
  }

  function hideAllScreens() {
    allScreens.forEach(function (s) {
      s.classList.remove('visible');
      s.classList.remove('fading');
    });
  }

  function showGameScreen() {
    hideAllScreens();
    setTimeout(function () {
      $game.classList.add('visible');
    }, 300);
  }

  function showEndScreen() {
    hideAllScreens();
    setTimeout(function () {
      $end.classList.add('visible');
    }, 300);
  }

  /* ---- Grid Rendering ---- */
  function buildCells(container) {
    container.innerHTML = '';
    for (var i = 0; i < GRID * GRID; i++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(i % GRID);
      cell.dataset.y = String(Math.floor(i / GRID));
      container.appendChild(cell);
    }
  }

  function getCell(container, x, y) {
    return container.children[y * GRID + x];
  }

  /* Determine what part of the ship a cell is (bow, body, stern) and direction */
  function getShipPart(ships, shipIdx, x, y) {
    if (shipIdx === -1) return null;
    var ship = ships[shipIdx];
    if (!ship || !ship.coords) return null;
    var coords = ship.coords;
    var idx = -1;
    for (var i = 0; i < coords.length; i++) {
      if (coords[i].x === x && coords[i].y === y) { idx = i; break; }
    }
    if (idx === -1) return null;
    // Determine direction
    var dir = 'h';
    if (coords.length > 1 && coords[0].x === coords[1].x) dir = 'v';
    var part = 'body';
    if (idx === 0) part = 'bow';
    if (idx === coords.length - 1) part = 'stern';
    return { part: part, dir: dir, shipIdx: shipIdx };
  }

  function renderPlayer() {
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        var cell = getCell($pBoard, x, y);
        var d = state.playerBoard[y][x];
        cell.className = 'cell';
        if (d.ship !== -1) {
          cell.classList.add('ship-cell');
          var info = getShipPart(state.playerShips, d.ship, x, y);
          if (info) {
            cell.classList.add('ship-' + info.part, 'ship-' + info.dir);
            if (state.playerShips[d.ship].sunk) cell.classList.add('ship-sunk');
          }
          if (d.hit) {
            cell.classList.add('player-hit');
            // Add red pin element if not already present
            if (!cell.querySelector('.hit-pin')) {
              var pin = document.createElement('div');
              pin.className = 'hit-pin';
              cell.appendChild(pin);
            }
          }
        } else if (d.hit) {
          cell.classList.add('player-miss');
        }
      }
    }
  }

  function renderAi() {
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        var cell = getCell($aBoard, x, y);
        var d = state.aiBoard[y][x];
        var ky = coordKey(x, y);
        cell.className = 'cell';
        if (state.playerFired[ky]) {
          cell.classList.add('fired');
          if (d.ship !== -1) {
            cell.classList.add(state.aiShips[d.ship].sunk ? 'sunk-cell' : 'hit');
          } else {
            cell.classList.add('miss');
          }
        }
      }
    }
  }

  function renderFleet() {
    $pFleet.innerHTML = '';
    state.playerShips.forEach(function (s) {
      var t = document.createElement('span');
      t.className = 'ship-tag' + (s.sunk ? ' sunk' : '');
      t.textContent = s.name + ' (' + s.len + ')';
      $pFleet.appendChild(t);
    });
    $aFleet.innerHTML = '';
    state.aiShips.forEach(function (s) {
      var t = document.createElement('span');
      t.className = 'ship-tag' + (s.sunk ? ' sunk' : '');
      var remaining = s.len - s.hits;
      if (s.sunk) {
        t.textContent = s.name + ' (SUNK)';
      } else {
        t.textContent = s.name + ' (' + remaining + '/' + s.len + ')';
      }
      $aFleet.appendChild(t);
    });
  }

  /* ---- Message Log ---- */
  function logMsg(text, cls) {
    var el = document.createElement('div');
    el.className = 'log-entry ' + (cls || '');
    el.textContent = text;
    $log.appendChild(el);
    $log.scrollTop = $log.scrollHeight;
  }

  /* ---- Ship Placement Screen ---- */
  function showPlacementScreen() {
    hideAllScreens();
    placementIdx = 0;
    placementDir = 'h';
    placementBoard = makeBoard();
    placementShips = [];

    buildCells($placeBoard);
    $btnConfirmFleet.style.display = 'none';
    updatePlacementUI();

    // Add click handlers to placement cells
    for (var i = 0; i < $placeBoard.children.length; i++) {
      (function (cell) {
        cell.addEventListener('click', function () {
          placementClick(parseInt(cell.dataset.x, 10), parseInt(cell.dataset.y, 10));
        });
        cell.addEventListener('mouseenter', function () {
          placementHover(parseInt(cell.dataset.x, 10), parseInt(cell.dataset.y, 10));
        });
        cell.addEventListener('mouseleave', function () {
          clearPlacementGhost();
        });
      })($placeBoard.children[i]);
    }

    setTimeout(function () {
      $sPlace.classList.add('visible');
    }, 300);
  }

  function updatePlacementUI() {
    if (placementIdx < SHIPS.length) {
      var ship = SHIPS[placementIdx];
      $placeShipName.textContent = 'Placing: ' + ship.name + ' (' + ship.len + ' squares)';
      var rotateHint = isMobileMode ? 'Tap ROTATE to change direction' : 'Press R to rotate';
      $placeHint.textContent = 'Tap a square to place \u00b7 ' + rotateHint;
      if ($mobileDir && isMobileMode) {
        $mobileDir.textContent = 'Direction: ' + (placementDir === 'h' ? 'Horizontal \u2192' : 'Vertical \u2193');
      }
    } else {
      $placeShipName.textContent = 'All vessels positioned.';
      $placeHint.textContent = 'Your fleet is ready to sail.';
    }

    // Update ship queue display
    $placeQueue.innerHTML = '';
    for (var i = 0; i < SHIPS.length; i++) {
      var tag = document.createElement('span');
      var isPlaced = i < placementIdx;
      tag.className = 'ship-tag' + (isPlaced ? ' placed' : '') + (i === placementIdx ? ' placing' : '');
      tag.textContent = SHIPS[i].name;
      if (isPlaced) {
        tag.title = 'Click to reposition';
        tag.style.cursor = 'pointer';
        (function(idx) {
          tag.addEventListener('click', function() {
            removePlacedShip(idx);
          });
        })(i);
      }
      $placeQueue.appendChild(tag);
    }
  }

  function placementHover(x, y) {
    lastHoverX = x;
    lastHoverY = y;
    clearPlacementGhost();
    if (placementIdx >= SHIPS.length) return;
    var len = SHIPS[placementIdx].len;
    var valid = canPlace(placementBoard, x, y, len, placementDir);
    for (var i = 0; i < len; i++) {
      var cx = placementDir === 'h' ? x + i : x;
      var cy = placementDir === 'v' ? y + i : y;
      if (inBounds(cx, cy)) {
        var cell = getCell($placeBoard, cx, cy);
        cell.classList.add(valid ? 'ghost-valid' : 'ghost-invalid');
      }
    }
  }

  function refreshPlacementGhost() {
    if (lastHoverX >= 0 && lastHoverY >= 0) {
      placementHover(lastHoverX, lastHoverY);
    }
  }

  function clearPlacementGhost() {
    for (var i = 0; i < $placeBoard.children.length; i++) {
      $placeBoard.children[i].classList.remove('ghost-valid', 'ghost-invalid');
    }
  }

  /* ---- Remove a placed ship to reposition it ---- */
  function removePlacedShip(shipIndex) {
    // Remove ship from board
    var ship = placementShips[shipIndex];
    if (!ship) return;
    for (var i = 0; i < ship.coords.length; i++) {
      placementBoard[ship.coords[i].y][ship.coords[i].x].ship = -1;
    }
    // Remove from ships array
    placementShips.splice(shipIndex, 1);
    // Re-index remaining ships on board
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        var s = placementBoard[y][x].ship;
        if (s > shipIndex) {
          placementBoard[y][x].ship = s - 1;
        }
      }
    }
    // Set placementIdx to the removed ship's position so it can be re-placed
    placementIdx = shipIndex;
    $btnConfirmFleet.style.display = 'none';
    updatePlacementUI();
    renderPlacementBoard();
    refreshPlacementGhost();
  }

  function confirmPlacement(x, y) {
    var ship = SHIPS[placementIdx];
    var coords = doPlace(placementBoard, x, y, ship.len, placementDir, placementIdx);
    placementShips.push({
      name: ship.name,
      len: ship.len,
      coords: coords,
      hits: 0,
      sunk: false
    });

    if (audioCtx) {
      playNote(MELODY_NOTES[placementIdx % MELODY_NOTES.length], 1.5, 0);
    }

    renderPlacementBoard();
    placementIdx++;
    mobilePreviewX = -1;
    mobilePreviewY = -1;
    mobilePreviewActive = false;
    updatePlacementUI();
    clearPlacementGhost();

    if (placementIdx >= SHIPS.length) {
      $btnConfirmFleet.style.display = 'inline-block';
      $btnConfirmFleet.classList.remove('show');
      setTimeout(function () {
        $btnConfirmFleet.classList.add('show');
      }, 50);
    }
  }

  function placementClick(x, y) {
    if (placementIdx >= SHIPS.length) return;
    var ship = SHIPS[placementIdx];
    if (!canPlace(placementBoard, x, y, ship.len, placementDir)) return;

    if (isMobileMode) {
      // Mobile: tap-to-preview, tap-again-to-confirm
      if (mobilePreviewActive && mobilePreviewX === x && mobilePreviewY === y) {
        // Second tap on same cell = confirm placement
        confirmPlacement(x, y);
      } else {
        // First tap or new cell = show preview
        mobilePreviewX = x;
        mobilePreviewY = y;
        mobilePreviewActive = true;
        clearPlacementGhost();
        placementHover(x, y);
        // Update hint to tell user to tap again
        $placeHint.textContent = 'Tap again to place \u00b7 Tap ROTATE to change direction';
      }
    } else {
      // Desktop: click to place immediately (has hover preview)
      confirmPlacement(x, y);
    }
  }

  function renderPlacementBoard() {
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        var cell = getCell($placeBoard, x, y);
        cell.className = 'cell';
        if (placementBoard[y][x].ship !== -1) {
          cell.classList.add('ship-cell');
          var info = getShipPart(placementShips, placementBoard[y][x].ship, x, y);
          if (info) {
            cell.classList.add('ship-' + info.part, 'ship-' + info.dir);
          }
        }
      }
    }
  }

  /* ---- Game Start ---- */
  function startGame() {
    state = freshState();
    state.phase = 'playing';

    // Use player's manually placed ships
    state.playerBoard = placementBoard;
    state.playerShips = placementShips;
    state.aiShips = placeAllShips(state.aiBoard, ENEMY_SHIPS);

    buildCells($pBoard);
    buildCells($aBoard);

    for (var i = 0; i < $aBoard.children.length; i++) {
      (function (cell) {
        cell.addEventListener('click', function () {
          playerFire(parseInt(cell.dataset.x, 10), parseInt(cell.dataset.y, 10));
        });
      })($aBoard.children[i]);
    }

    $log.innerHTML = '';
    renderPlayer();
    renderAi();
    renderFleet();

    $status.textContent = '\u2014 YOUR TURN \u2014 Click a square on Wako\'s Fleet.';
    $status.className = 'status-bar your-turn';
    logMsg('Ichigo and the fishermen of Hoshima watch the fog. The Wako fleet is out there.', 'system');
    renderLegendFleet();

    showGameScreen();
  }

  /* ---- Player Fire ---- */
  function playerFire(x, y) {
    if (state.phase !== 'playing' || !state.playerTurn) return;
    var ky = coordKey(x, y);
    if (state.playerFired[ky]) return;

    state.playerFired[ky] = true;
    state.playerTurn = false;
    state.turnCount++;
    state.playerHeat[y][x]++;

    if (!state.mirrorActive && state.turnCount > 15) {
      state.mirrorActive = true;
    }

    var d = state.aiBoard[y][x];
    d.hit = true;
    var cell = getCell($aBoard, x, y);
    cell.classList.add('fired');

    if (d.ship !== -1) {
      var ship = state.aiShips[d.ship];
      ship.hits++;
      cell.classList.add('hit', 'fresh');
      setTimeout(function () { cell.classList.remove('fresh'); }, 1600);
      state.battleLog.push({ x: x, y: y, result: 'hit', who: 'player' });
      playShipHitSound();
      triggerScreenShake();

      if (ship.hits >= ship.len) {
        ship.sunk = true;
        showCallout('Wako\'s Fleet: Hit & Sunk!', 'sunk');
        logMsg(pick(TEXT.playerSunk), 'player');
        renderAi();
        renderFleet();
        if (allSunk(state.aiShips)) {
          state.phase = 'ended';
          // Cinematic victory log sequence before end screen
          setTimeout(function () { logMsg('Direct hit.', 'finale'); }, 800);
          setTimeout(function () { logMsg('Wood splinters in the fog.', 'finale'); }, 2200);
          setTimeout(function () { logMsg('The final Wako vessel slips beneath the tide.', 'finale'); }, 4000);
          setTimeout(function () { logMsg('The sea grows quiet.', 'finale'); }, 6000);
          setTimeout(function () { endGame('victory'); }, 8000);
          return;
        }
      } else {
        showCallout('Wako\'s Fleet: Successful Hit!', 'hit');
        logMsg(pick(TEXT.playerHit), 'player');
      }
    } else {
      cell.classList.add('miss', 'fresh');
      setTimeout(function () { cell.classList.remove('fresh'); }, 1300);
      state.battleLog.push({ x: x, y: y, result: 'miss', who: 'player' });
      showCallout('Wako\'s Fleet: Miss!', 'miss');
      logMsg(pick(TEXT.playerMiss), 'player');
    }

    renderFleet();
    renderLegendFleet();

    if (!state.flagCrowded && Object.keys(state.playerFired).length > 40) {
      state.flagCrowded = true;
      logMsg(TEXT.crowded, 'narrative');
    }

    // Disable clicking on AI board during enemy turn
    $aBoard.classList.add('disabled');
    $status.textContent = 'Enemy scanning...';
    $status.className = 'status-bar enemy';

    $sonar.classList.remove('sweep');
    void $sonar.offsetWidth;
    $sonar.classList.add('sweep');

    setTimeout(function () {
      logMsg(pick(TEXT.aiScan), 'system');
    }, 400);

    setTimeout(function () {
      $status.textContent = '— ENEMY TURN —';
      $status.className = 'status-bar enemy-turn';
    }, 1200);

    setTimeout(function () {
      aiTurn();
    }, 2200);
  }

  /* ---- AI Turn ---- */
  function aiTurn() {
    if (state.phase !== 'playing') return;

    if (state.mirrorActive && !state.flagStudying && state.turnCount > 20) {
      state.flagStudying = true;
      logMsg(TEXT.studying, 'narrative');
    }
    if (state.mirrorActive && !state.flagExposed && state.turnCount > 35) {
      state.flagExposed = true;
      logMsg(TEXT.exposed, 'narrative');
    }

    var target = getAiTarget();
    if (!target) {
      state.playerTurn = true;
      return;
    }

    var ky = coordKey(target.x, target.y);
    state.aiFired[ky] = true;
    state.turnCount++;

    var d = state.playerBoard[target.y][target.x];
    d.hit = true;
    var cell = getCell($pBoard, target.x, target.y);

    if (d.ship !== -1) {
      var ship = state.playerShips[d.ship];
      ship.hits++;
      cell.className = 'cell ship-cell player-hit fresh';
      setTimeout(function () { cell.classList.remove('fresh'); }, 1600);
      playShipHitSound();
      triggerScreenShake();

      state.aiMode = 'hunt';
      addAdjacent(target.x, target.y);
      state.battleLog.push({ x: target.x, y: target.y, result: 'hit', who: 'ai' });

      if (ship.hits >= ship.len) {
        ship.sunk = true;
        state.aiQueue = state.aiQueue.filter(function (q) {
          return !state.aiFired[coordKey(q.x, q.y)];
        });
        if (state.aiQueue.length === 0) state.aiMode = 'search';
        showCallout('Ichigo\'s Fleet: Hit & Sunk!', 'sunk');
        logMsg(pick(TEXT.aiSunk), 'enemy');
        renderFleet();
        renderLegendFleet();
        if (allSunk(state.playerShips)) {
          state.phase = 'ended';
          renderPlayer();
          // Cinematic defeat log sequence before end screen
          setTimeout(function () { logMsg('The fog swallows the last of your fleet.', 'finale'); }, 800);
          setTimeout(function () { logMsg('The Wako sails pass beyond the horizon.', 'finale'); }, 2500);
          setTimeout(function () { logMsg('For a moment, the sea is silent.', 'finale'); }, 4500);
          setTimeout(function () { endGame('defeat'); }, 6500);
          return;
        }
      } else {
        showCallout('Ichigo\'s Fleet: Successful Hit!', 'hit');
        logMsg(pick(TEXT.aiHit), 'enemy');
      }
    } else {
      cell.className = 'cell player-miss';
      state.battleLog.push({ x: target.x, y: target.y, result: 'miss', who: 'ai' });
      showCallout('Ichigo\'s Fleet: Miss!', 'miss');
      logMsg(pick(TEXT.aiMiss), 'enemy');
      if (state.aiQueue.length === 0) state.aiMode = 'search';
    }

    renderPlayer();
    renderFleet();
    renderLegendFleet();

    // Brief pause so player can see AI result before their turn resumes
    setTimeout(function () {
      state.playerTurn = true;
      $aBoard.classList.remove('disabled');
      $status.textContent = '— YOUR TURN — Click a square on Wako\'s Fleet.';
      $status.className = 'status-bar your-turn';
    }, 1200);
  }

  function addAdjacent(x, y) {
    var dirs = [
      { x: x - 1, y: y },
      { x: x + 1, y: y },
      { x: x, y: y - 1 },
      { x: x, y: y + 1 }
    ];
    dirs.forEach(function (d) {
      if (!inBounds(d.x, d.y)) return;
      if (state.aiFired[coordKey(d.x, d.y)]) return;
      var dup = state.aiQueue.some(function (q) {
        return q.x === d.x && q.y === d.y;
      });
      if (!dup) state.aiQueue.push(d);
    });
  }

  function getAiTarget() {
    if (state.aiMode === 'hunt') {
      while (state.aiQueue.length > 0) {
        var t = state.aiQueue.shift();
        if (!state.aiFired[coordKey(t.x, t.y)] && inBounds(t.x, t.y)) return t;
      }
      state.aiMode = 'search';
    }

    var candidates = [];
    var totalWeight = 0;
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        if (state.aiFired[coordKey(x, y)]) continue;
        var w = 1;
        if ((x + y) % 2 === 0) w += 0.5;
        if (state.mirrorActive) w += state.playerHeat[y][x] * 0.3;
        candidates.push({ x: x, y: y, w: w });
        totalWeight += w;
      }
    }

    if (candidates.length === 0) return null;

    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < candidates.length; i++) {
      cumulative += candidates[i].w;
      if (roll <= cumulative) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  /* ---- End Game ---- */
  function endGame(result) {
    var lines = [];
    if (result === 'victory') {
      lines = [
        'The remaining Wako ships turn away.',
        'The fog grows quiet again.',
        'Hoshima will see the sunrise.'
      ];
    } else {
      lines = [
        'Ichigo.',
        'The fog swallows the last of your fleet.',
        'The Wako sails pass beyond the horizon.',
        'For a moment, the sea is silent.',
        'Far away, the lanterns of Hoshima still glow in the night.',
        'They do not know how fiercely you fought for them.',
        'The tide turns.',
        'But the sea remembers.'
      ];
    }

    // Set victory/defeat title
    $endTitle.textContent = result === 'victory' ? 'VICTORY! YOU WON' : 'DEFEATED! YOU LOST';
    $endTitle.className = 'end-title ' + (result === 'victory' ? 'victory' : 'defeat');

    // Build end lines dynamically
    $endLines.innerHTML = '';
    lines.forEach(function (text, i) {
      var p = document.createElement('p');
      p.className = 'end-line' + (i === lines.length - 1 ? ' end-line-last' : '');
      p.textContent = text;
      $endLines.appendChild(p);
    });

    $btnRestart.style.display = 'none';
    showEndScreen();

    // Show title first with scale-in animation
    setTimeout(function () {
      $endTitle.classList.add('show');
    }, 400);

    // Stagger line reveals
    var allEndLines = $endLines.querySelectorAll('.end-line');
    var baseDelay = 1800;
    var perLine = 1800;
    for (var i = 0; i < allEndLines.length; i++) {
      (function (el, delay) {
        setTimeout(function () { el.classList.add('show'); }, delay);
      })(allEndLines[i], baseDelay + i * perLine);
    }

    // Show "Return to the Sea" button after all lines are revealed
    var totalDelay = baseDelay + lines.length * perLine + 1000;
    setTimeout(function () {
      $btnRestart.style.display = 'inline-block';
      $btnRestart.style.opacity = '0';
      $btnRestart.classList.remove('show');
      setTimeout(function () {
        $btnRestart.classList.add('show');
      }, 50);
    }, totalDelay);
  }

  /* ---- Signal Archive Replay ---- */
  function startReplay(result) {
    buildCells($rBoard);
    $rCap.textContent = 'The fog begins to lift...';

    setTimeout(function () {
      $rCap.textContent = 'The ocean remembers everything.';
    }, 1500);

    setTimeout(function () {
      var log = state.battleLog;
      var interval = Math.max(150, Math.min(350, 5000 / Math.max(log.length, 1)));

      for (var i = 0; i < log.length; i++) {
        (function (move, idx) {
          setTimeout(function () {
            var cell = getCell($rBoard, move.x, move.y);
            if (move.result === 'miss') {
              cell.classList.add('miss');
            } else {
              cell.classList.add('hit');
            }
            if (move.who === 'ai') {
              cell.style.borderLeft = '2px solid rgba(74, 127, 170, 0.4)';
            }
            $rCap.textContent = 'Signal ' + (idx + 1) + ' of ' + log.length;
          }, idx * interval);
        })(log[i], i);
      }

      setTimeout(function () {
        if (result === 'victory') {
          $rCap.textContent = 'Hoshima is safe. The sea remembers.';
        } else {
          $rCap.textContent = 'The water still holds its memory.';
        }
        $btnRestart.style.display = 'inline-block';
        $btnRestart.style.opacity = '0';
        $btnRestart.classList.remove('show');
        setTimeout(function () {
          $btnRestart.classList.add('show');
        }, 50);
      }, log.length * interval + 1200);
    }, 3000);
  }

  /* ---- Event Listeners ---- */

  /* ---- Device Selection ---- */
  function selectDevice(mode) {
    isMobileMode = (mode === 'mobile');
    if (isMobileMode) {
      document.body.classList.add('mobile-mode');
    } else {
      document.body.classList.remove('mobile-mode');
    }
    // Transition to Screen 0
    $sDevice.classList.add('fading');
    setTimeout(function () {
      $sDevice.classList.remove('visible');
      $sDevice.classList.remove('fading');
      $s0.classList.add('visible');
    }, 800);
  }

  $btnDeviceMobile.addEventListener('click', function () {
    selectDevice('mobile');
  });
  $btnDeviceMobile.addEventListener('touchend', function (e) {
    e.preventDefault();
    selectDevice('mobile');
  });
  $btnDeviceDesktop.addEventListener('click', function () {
    selectDevice('desktop');
  });

  // Screen 0: Click/touch anywhere to start audio + intro
  var screen0Handled = false;
  function handleScreen0Start() {
    if (screen0Handled) return;
    screen0Handled = true;
    // iOS Safari: initAudio MUST run synchronously inside the gesture handler
    initAudio();
    $s0.classList.add('fading');
    setTimeout(function () {
      $s0.classList.remove('visible');
      $s0.classList.remove('fading');
      runIntroSequence();
    }, 1200);
  }
  // Use both click (desktop) and touchend (mobile) — touchend is the most
  // reliable gesture type for iOS Safari audio unlocking
  $s0.addEventListener('click', handleScreen0Start);
  $s0.addEventListener('touchend', handleScreen0Start);

  // Fallback: keep retrying audio unlock on ANY user interaction
  // This catches cases where the first gesture didn't fully unlock audio
  function retryAudioUnlock() {
    if (!audioStarted) {
      initAudio();
    }
  }
  document.addEventListener('touchend', retryAudioUnlock, { passive: true });
  document.addEventListener('click', retryAudioUnlock);

  $btnStart.addEventListener('click', function () {
    showTutorial();
  });

  $btnBeginBattle.addEventListener('click', function () {
    showPlacementScreen();
  });

  $btnConfirmFleet.addEventListener('click', function () {
    startGame();
  });

  // Mobile rotate button
  var rotateDebounce = false;
  function doRotate() {
    if (rotateDebounce) return;
    if (placementIdx < SHIPS.length && $sPlace.classList.contains('visible')) {
      rotateDebounce = true;
      placementDir = placementDir === 'h' ? 'v' : 'h';

      // Visual feedback flash
      $btnMobileRotate.classList.add('rotate-flash');
      $btnMobileRotate.classList.remove('rotate-pulse');
      setTimeout(function () {
        $btnMobileRotate.classList.remove('rotate-flash');
        $btnMobileRotate.classList.add('rotate-pulse');
      }, 200);

      // Update direction indicator
      if ($mobileDir) {
        $mobileDir.textContent = 'Direction: ' + (placementDir === 'h' ? 'Horizontal \u2192' : 'Vertical \u2193');
      }

      updatePlacementUI();
      // If mobile preview is active, re-show ghost in new direction
      if (isMobileMode && mobilePreviewActive && mobilePreviewX >= 0) {
        clearPlacementGhost();
        var ship = SHIPS[placementIdx];
        if (ship && canPlace(placementBoard, mobilePreviewX, mobilePreviewY, ship.len, placementDir)) {
          placementHover(mobilePreviewX, mobilePreviewY);
          $placeHint.textContent = 'Tap again to place \u00b7 Tap ROTATE to change direction';
        } else {
          // New direction doesn't fit here — clear preview
          mobilePreviewActive = false;
          mobilePreviewX = -1;
          mobilePreviewY = -1;
          placementHover(mobilePreviewX, mobilePreviewY);
        }
      } else {
        refreshPlacementGhost();
      }
      if (audioCtx) {
        playNote(587.33, 0.5, 0);
      }
      setTimeout(function () { rotateDebounce = false; }, 250);
    }
  }

  // Prevent ghost clicks — use touchstart for immediate response on iOS
  $btnMobileRotate.addEventListener('touchstart', function (e) {
    e.preventDefault();
    e.stopPropagation();
    doRotate();
  }, { passive: false });
  $btnMobileRotate.addEventListener('click', function (e) {
    // Only fire on non-touch devices (desktop testing mobile mode)
    if (!('ontouchstart' in window)) {
      doRotate();
    }
  });

  // Keyboard handler for rotation during placement
  document.addEventListener('keydown', function (e) {
    if (e.key === 'r' || e.key === 'R') {
      doRotate();
    }
  });

  $btnRestart.addEventListener('click', function () {
    $btnRestart.style.display = 'none';
    showPlacementScreen();
  });

  /* ---- Tutorial Screen ---- */
  function showTutorial() {
    hideAllScreens();
    $sTut.classList.add('visible');

    // Reveal sections one by one with staggered timing
    var sections = [
      { sel: '.tut-title', delay: 400 },
      { sel: '.tut-s1', delay: 1500 },
      { sel: '.tut-s2', delay: 3500 },
      { sel: '.tut-s3', delay: 5500 },
      { sel: '.tut-s4', delay: 8000 },
      { sel: '.tut-s5', delay: 10000 },
      { sel: '.tut-btn', delay: 11500 }
    ];

    sections.forEach(function (item) {
      setTimeout(function () {
        var el = $sTut.querySelector(item.sel);
        if (el) el.classList.add('show');
      }, item.delay);
    });
  }

  /* ---- Show Device Selection Screen ---- */
  state = freshState();

})();
