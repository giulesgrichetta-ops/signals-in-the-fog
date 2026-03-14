/* ===================================================
   SIGNALS IN THE FOG
   A narrative Battleship game
   Inspired by Ichigo from Tomorrow, and Tomorrow, and Tomorrow
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

  /* ---- Narrative Text (Ichigo-themed) ---- */
  var TEXT = {
    playerMiss: [
      'The torpedo vanishes into the deep, finding nothing.',
      'Silence follows. The water swallows the signal whole.',
      'The wave closes over the strike. Only foam remains.',
      'Ichigo watches the ripple fade. Nothing there.'
    ],
    playerHit: [
      'A signal fractures the silence beneath the waves.',
      'Something stirs in the water. Contact.',
      'The ocean shudders. Ichigo has found something.',
      'A tremor rises from below. The water darkens.'
    ],
    playerSunk: [
      'Something large slips beneath the water and is gone.',
      'A vessel breaks apart in the deep. The sea claims it.',
      'The signal collapses. A ghost descends into the current.'
    ],
    aiMiss: [
      'A torpedo passes through your waters like a lost thought.',
      'The enemy searches blindly through the fog.',
      'Their signal finds nothing. The fleet holds its breath.'
    ],
    aiHit: [
      'A distant strike tears through your hull.',
      'Your vessel shudders. They found you through the fog.',
      'Impact. The enemy has drawn blood from Ichigo\'s fleet.'
    ],
    aiSunk: [
      'One of your vessels vanishes beneath the surface.',
      'Ichigo\'s fleet grows smaller. The fog feels closer.',
      'A ship is lost. The water closes where it was.'
    ],
    aiScan: [
      'Enemy signals scanning the water...'
    ],
    crowded: 'The water is full of echoes. Every strike has left its mark.',
    studying: 'The enemy seems to be studying Ichigo\'s patterns.',
    exposed: 'Your search pattern is no longer private. They are learning.'
  };

  /* ---- State ---- */
  var state;

  function freshState() {
    return {
      phase: 'start',
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

  /* ---- DOM References ---- */
  var $departure = document.getElementById('scene-departure');
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
  var $rBoard = document.getElementById('replay-board');
  var $rCap = document.getElementById('replay-caption');

  /* ---- Screen Management ---- */
  function showScreen(el) {
    var all = [$departure, $game, $end];
    all.forEach(function (s) {
      if (s.classList.contains('visible')) {
        s.style.opacity = '0';
        (function (scr) {
          setTimeout(function () {
            scr.classList.remove('visible');
            scr.style.opacity = '';
          }, 800);
        })(s);
      }
    });
    setTimeout(function () {
      el.classList.add('visible');
    }, 900);
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
    logMsg('Ichigo\'s fleet awaits orders. The fog surrounds you.', 'system');

    showScreen($game);
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
      $eLine1.textContent = 'The ocean grows quiet.';
      $eLine2.textContent = 'No signals remain. Ichigo drifts in silence.';
    } else {
      $eLine1.textContent = 'Ichigo\'s fleet disappears beneath the fog.';
      $eLine2.textContent = 'The water closes. Only memory remains.';
    }

    $eLine1.className = 'end-line delay-1';
    $eLine2.className = 'end-line delay-2';
    var rs = document.querySelector('.replay-section');
    if (rs) rs.className = 'replay-section delay-3';

    $btnRestart.style.display = 'none';
    showScreen($end);

    setTimeout(function () {
      startReplay(result);
    }, 2500);
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
          $rCap.textContent = 'Ichigo returns to quiet waters.';
        } else {
          $rCap.textContent = 'The water still holds its memory.';
        }
        $btnRestart.style.display = 'inline-block';
        $btnRestart.style.opacity = '0';
        setTimeout(function () {
          $btnRestart.style.transition = 'opacity 1s ease';
          $btnRestart.style.opacity = '1';
        }, 50);
      }, log.length * interval + 1200);
    }, 3000);
  }

  /* ---- Event Listeners ---- */
  $btnStart.addEventListener('click', function () {
    startGame();
  });

  $btnRestart.addEventListener('click', function () {
    $btnRestart.style.display = 'none';
    startGame();
  });

})();
