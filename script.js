/* ===================================================
   SIGNALS IN THE FOG
   Ichigo protects Hoshima from the Wako fleet
   Inspired by Tomorrow, and Tomorrow, and Tomorrow
   =================================================== */

(function () {
  'use strict';

  var GRID = 10;
  var SHIPS = [
    { name: 'Carrier',    len: 5 },
    { name: 'Battleship', len: 4 },
    { name: 'Cruiser',    len: 3 },
    { name: 'Submarine',  len: 3 },
    { name: 'Destroyer',  len: 2 }
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

  function placeAllShips(board) {
    var ships = [];
    for (var s = 0; s < SHIPS.length; s++) {
      var placed = false;
      for (var att = 0; att < 1000 && !placed; att++) {
        var dir = Math.random() < 0.5 ? 'h' : 'v';
        var x = Math.floor(Math.random() * GRID);
        var y = Math.floor(Math.random() * GRID);
        if (canPlace(board, x, y, SHIPS[s].len, dir)) {
          var coords = doPlace(board, x, y, SHIPS[s].len, dir, s);
          ships.push({
            name: SHIPS[s].name,
            len: SHIPS[s].len,
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

  /* ---- Ambient Ocean Audio (Web Audio API) ---- */
  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    startAmbient();
  }

  function startAmbient() {
    if (!audioCtx) return;

    // Deep ocean drone - low frequency
    var droneOsc = audioCtx.createOscillator();
    var droneGain = audioCtx.createGain();
    var droneFilter = audioCtx.createBiquadFilter();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 55;
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 120;
    droneGain.gain.value = 0;
    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    droneOsc.start();
    droneGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 3);
    ambientNodes.push(droneOsc, droneGain, droneFilter);

    // Second harmonic drone
    var drone2 = audioCtx.createOscillator();
    var drone2Gain = audioCtx.createGain();
    drone2.type = 'sine';
    drone2.frequency.value = 82;
    drone2Gain.gain.value = 0;
    drone2.connect(drone2Gain);
    drone2Gain.connect(audioCtx.destination);
    drone2.start();
    drone2Gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 4);
    ambientNodes.push(drone2, drone2Gain);

    // White noise filtered to sound like ocean wash
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
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;
    noiseFilter.Q.value = 1;

    var noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0;

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    whiteNoise.start();
    noiseGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 5);
    ambientNodes.push(whiteNoise, noiseFilter, noiseGain);

    // Modulate the noise gain to simulate waves
    var waveLFO = audioCtx.createOscillator();
    var waveLFOGain = audioCtx.createGain();
    waveLFO.type = 'sine';
    waveLFO.frequency.value = 0.12; // slow wave rhythm
    waveLFOGain.gain.value = 0.03;
    waveLFO.connect(waveLFOGain);
    waveLFOGain.connect(noiseGain.gain);
    waveLFO.start();
    ambientNodes.push(waveLFO, waveLFOGain);
  }

  function stopAmbient() {
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

  /* ---- DOM References ---- */
  var $s1 = document.getElementById('screen-1');
  var $s2 = document.getElementById('screen-2');
  var $s3 = document.getElementById('screen-3');
  var $s4 = document.getElementById('screen-4');
  var $game = document.getElementById('game-screen');
  var $end = document.getElementById('end-screen');
  var $btnStart = document.getElementById('btn-start');
  var $btnRestart = document.getElementById('btn-restart');
  var $pBoard = document.getElementById('player-board');
  var $aBoard = document.getElementById('ai-board');
  var $pFleet = document.getElementById('player-fleet');
  var $aFleet = document.getElementById('ai-fleet');
  var $status = document.getElementById('status-bar');
  var $log = document.getElementById('log');
  var $sonar = document.getElementById('sonar');
  var $eLine1 = document.getElementById('end-line-1');
  var $eLine2 = document.getElementById('end-line-2');
  var $eLine3 = document.getElementById('end-line-3');
  var $rBoard = document.getElementById('replay-board');
  var $rCap = document.getElementById('replay-caption');

  var introScreens = [$s1, $s2, $s3, $s4];
  var allScreens = [$s1, $s2, $s3, $s4, $game, $end];

  /* ---- Intro Sequence ---- */
  function runIntroSequence() {
    // Screen 1: The Village
    showIntroScreen($s1, [
      { sel: '.s1-1', delay: 500 },
      { sel: '.s1-2', delay: 2000 },
      { sel: '.s1-3', delay: 3000 },
      { sel: '.s1-4', delay: 4000 },
      { sel: '.s1-6', delay: 6500 }
    ], 9500, function () {
      // Screen 2: The Threat
      showIntroScreen($s2, [
        { sel: '.s2-1', delay: 500 },
        { sel: '.s2-3', delay: 3000 },
        { sel: '.s2-4', delay: 4200 },
        { sel: '.s2-6', delay: 6500 },
        { sel: '.s2-7', delay: 8000 }
      ], 11000, function () {
        // Screen 3: Ichigo
        showIntroScreen($s3, [
          { sel: '.ichigo-silhouette', delay: 300 },
          { sel: '.s3-1', delay: 1500 },
          { sel: '.s3-3', delay: 3500 },
          { sel: '.s3-4', delay: 4500 },
          { sel: '.s3-6', delay: 6500 },
          { sel: '.s3-8', delay: 9000 },
          { sel: '.s3-9', delay: 10200 }
        ], 13000, function () {
          // Screen 4: Mission
          showIntroScreen($s4, [
            { sel: '.s4-1', delay: 500 },
            { sel: '.s4-2', delay: 2000 },
            { sel: '.s4-3', delay: 3500 },
            { sel: '.s4-4', delay: 5500 }
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

    // Reveal items one by one
    items.forEach(function (item) {
      setTimeout(function () {
        var el = screen.querySelector(item.sel);
        if (el) el.classList.add('show');
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

  function renderPlayer() {
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        var cell = getCell($pBoard, x, y);
        var d = state.playerBoard[y][x];
        cell.className = 'cell';
        if (d.ship !== -1 && !d.hit) cell.classList.add('ship-cell');
        if (d.hit && d.ship !== -1) cell.classList.add('ship-cell', 'player-hit');
        if (d.hit && d.ship === -1) cell.classList.add('player-miss');
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
      t.textContent = s.name;
      $pFleet.appendChild(t);
    });
    $aFleet.innerHTML = '';
    state.aiShips.forEach(function (s) {
      var t = document.createElement('span');
      t.className = 'ship-tag' + (s.sunk ? ' sunk' : '');
      t.textContent = s.sunk ? s.name : '???';
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

  /* ---- Game Start ---- */
  function startGame() {
    state = freshState();
    state.phase = 'playing';

    state.playerShips = placeAllShips(state.playerBoard);
    state.aiShips = placeAllShips(state.aiBoard);

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

    $status.textContent = 'Your move, Ichigo.';
    $status.className = 'status-bar';
    logMsg('Ichigo watches the fog. The Wako fleet is out there.', 'system');

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

      if (ship.hits >= ship.len) {
        ship.sunk = true;
        logMsg(pick(TEXT.playerSunk), 'player');
        renderAi();
        renderFleet();
        if (allSunk(state.aiShips)) {
          state.phase = 'ended';
          setTimeout(function () { endGame('victory'); }, 1200);
          return;
        }
      } else {
        logMsg(pick(TEXT.playerHit), 'player');
      }
    } else {
      cell.classList.add('miss', 'fresh');
      setTimeout(function () { cell.classList.remove('fresh'); }, 1300);
      state.battleLog.push({ x: x, y: y, result: 'miss', who: 'player' });
      logMsg(pick(TEXT.playerMiss), 'player');
    }

    renderFleet();

    if (!state.flagCrowded && Object.keys(state.playerFired).length > 40) {
      state.flagCrowded = true;
      logMsg(TEXT.crowded, 'narrative');
    }

    $status.textContent = 'Enemy scanning...';
    $status.className = 'status-bar enemy';

    $sonar.classList.remove('sweep');
    void $sonar.offsetWidth;
    $sonar.classList.add('sweep');

    setTimeout(function () {
      logMsg(pick(TEXT.aiScan), 'system');
    }, 200);

    setTimeout(function () {
      aiTurn();
    }, 1000);
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

      state.aiMode = 'hunt';
      addAdjacent(target.x, target.y);
      state.battleLog.push({ x: target.x, y: target.y, result: 'hit', who: 'ai' });

      if (ship.hits >= ship.len) {
        ship.sunk = true;
        state.aiQueue = state.aiQueue.filter(function (q) {
          return !state.aiFired[coordKey(q.x, q.y)];
        });
        if (state.aiQueue.length === 0) state.aiMode = 'search';
        logMsg(pick(TEXT.aiSunk), 'enemy');
        renderFleet();
        if (allSunk(state.playerShips)) {
          state.phase = 'ended';
          renderPlayer();
          setTimeout(function () { endGame('defeat'); }, 1200);
          return;
        }
      } else {
        logMsg(pick(TEXT.aiHit), 'enemy');
      }
    } else {
      cell.className = 'cell player-miss';
      state.battleLog.push({ x: target.x, y: target.y, result: 'miss', who: 'ai' });
      logMsg(pick(TEXT.aiMiss), 'enemy');
      if (state.aiQueue.length === 0) state.aiMode = 'search';
    }

    renderPlayer();
    renderFleet();

    state.playerTurn = true;
    $status.textContent = 'Your move, Ichigo.';
    $status.className = 'status-bar';
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
    if (result === 'victory') {
      $eLine1.textContent = 'The remaining ships turn away.';
      $eLine2.textContent = 'The fog grows quiet again.';
      $eLine3.textContent = 'Hoshima will see the sunrise.';
    } else {
      $eLine1.textContent = 'The enemy sails continue past you.';
      $eLine2.textContent = 'Far away, lanterns flicker in Hoshima.';
      $eLine3.textContent = 'The sea is no longer enough to protect it.';
    }

    $eLine1.classList.remove('show');
    $eLine2.classList.remove('show');
    $eLine3.classList.remove('show');
    var rs = document.querySelector('.replay-section');
    if (rs) rs.classList.remove('show');

    $btnRestart.style.display = 'none';
    showEndScreen();

    setTimeout(function () { $eLine1.classList.add('show'); }, 1000);
    setTimeout(function () { $eLine2.classList.add('show'); }, 2500);
    setTimeout(function () { $eLine3.classList.add('show'); }, 4000);
    setTimeout(function () {
      if (rs) rs.classList.add('show');
      startReplay(result);
    }, 5500);
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
  $btnStart.addEventListener('click', function () {
    initAudio();
    startGame();
  });

  $btnRestart.addEventListener('click', function () {
    $btnRestart.style.display = 'none';
    startGame();
  });

  /* ---- Launch intro sequence ---- */
  state = freshState();
  runIntroSequence();

})();
