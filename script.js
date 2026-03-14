/* ===================================================
   SIGNALS IN THE FOG
   A narrative Battleship game
   =================================================== */

(function () {
  'use strict';

  // --- Constants ---
  const GRID_SIZE = 10;
  const SHIPS = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 },
  ];

  // --- Narrative Text ---
  const NARRATIVE = {
    miss: [
      'The torpedo disappears beneath the waves.',
      'Silence follows. Nothing found.',
      'The signal fades into deep water.',
      'Only the sound of the ocean returns.',
    ],
    hit: [
      'A signal fractures the silence.',
      'Something stirs beneath the surface.',
      'Contact. A muffled tremor rises.',
      'The water darkens at the point of impact.',
    ],
    sunk: [
      'Something large slips beneath the water.',
      'A vessel breaks apart in the deep.',
      'The signal collapses. A ship is gone.',
    ],
    enemyMiss: [
      'A torpedo passes harmlessly through your waters.',
      'The enemy searches blindly.',
      'Their signal finds nothing.',
    ],
    enemyHit: [
      'A distant strike tears through your fleet.',
      'Your hull shudders. They found you.',
      'Impact. The enemy has drawn blood.',
    ],
    enemySunk: [
      'One of your vessels vanishes from the surface.',
      'Your fleet grows smaller.',
      'A ship is lost to the fog.',
    ],
    aiThinking: [
      'Scanning surface patterns...',
      'Calculating probability...',
      'Interpreting signal echoes...',
      'Analyzing drift patterns...',
    ],
    aiLaunch: 'Launching torpedo.',
    crowdedOcean: 'The water is full of echoes.',
    enemyStudying: 'The enemy seems to be studying your signals.',
    patternExposed: 'Your search pattern is no longer private.',
  };

  // --- Game State ---
  let gameState = {
    phase: 'intro', // intro, placement, playing, ended
    playerBoard: null,
    enemyBoard: null,
    playerShips: [],
    enemyShips: [],
    placementIndex: 0,
    placementOrientation: 'horizontal', // horizontal or vertical
    isPlayerTurn: true,
    battleLog: [],
    turnCount: 0,
    playerShotMap: createEmptyGrid(0),
    aiMode: 'search', // search or hunt
    aiHitQueue: [],
    aiFiredSet: new Set(),
    playerFiredSet: new Set(),
    memoryGrid: createEmptyGrid(null),
    enemyMemoryGrid: createEmptyGrid(null),
    mirrorBiasActive: false,
    crowdedMessageShown: false,
    studyingMessageShown: false,
    patternMessageShown: false,
  };

  // --- Utility Functions ---

  function createEmptyGrid(defaultValue) {
    const grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      grid[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        grid[y][x] = typeof defaultValue === 'object' && defaultValue !== null
          ? { ...defaultValue }
          : defaultValue;
      }
    }
    return grid;
  }

  function createBoard() {
    const board = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      board[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        board[y][x] = {
          hasShip: false,
          shipIndex: -1,
          hit: false,
        };
      }
    }
    return board;
  }

  function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function coordKey(x, y) {
    return x + ',' + y;
  }

  function isValidCell(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
  }

  function canPlaceShip(board, x, y, size, orientation) {
    for (let i = 0; i < size; i++) {
      const cx = orientation === 'horizontal' ? x + i : x;
      const cy = orientation === 'vertical' ? y + i : y;
      if (!isValidCell(cx, cy)) return false;
      if (board[cy][cx].hasShip) return false;
    }
    return true;
  }

  function placeShip(board, x, y, size, orientation, shipIndex) {
    const cells = [];
    for (let i = 0; i < size; i++) {
      const cx = orientation === 'horizontal' ? x + i : x;
      const cy = orientation === 'vertical' ? y + i : y;
      board[cy][cx].hasShip = true;
      board[cy][cx].shipIndex = shipIndex;
      cells.push({ x: cx, y: cy });
    }
    return cells;
  }

  function placeShipsRandomly(board) {
    const ships = [];
    for (let i = 0; i < SHIPS.length; i++) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 500) {
        const orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        if (canPlaceShip(board, x, y, SHIPS[i].size, orientation)) {
          const cells = placeShip(board, x, y, SHIPS[i].size, orientation, i);
          ships.push({
            name: SHIPS[i].name,
            size: SHIPS[i].size,
            cells: cells,
            hits: 0,
            sunk: false,
          });
          placed = true;
        }
        attempts++;
      }
    }
    return ships;
  }

  function isShipSunk(ship) {
    return ship.hits >= ship.size;
  }

  function allShipsSunk(ships) {
    return ships.every(function (s) { return s.sunk; });
  }

  // --- DOM References ---
  const screens = {
    intro: document.getElementById('intro-screen'),
    placement: document.getElementById('placement-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen'),
  };

  const btnBegin = document.getElementById('btn-begin');
  const btnRandomPlace = document.getElementById('btn-random-place');
  const btnDrift = document.getElementById('btn-drift');
  const placementGridEl = document.getElementById('placement-grid');
  const playerGridEl = document.getElementById('player-grid');
  const enemyGridEl = document.getElementById('enemy-grid');
  const replayGridEl = document.getElementById('replay-grid');
  const messageFeed = document.getElementById('message-feed');
  const turnIndicator = document.getElementById('turn-indicator');
  const currentShipName = document.getElementById('current-ship-name');
  const currentShipSize = document.getElementById('current-ship-size');
  const sonarLine = document.getElementById('sonar-line');
  const endText = document.getElementById('end-text');
  const replayStatus = document.getElementById('replay-status');
  const playerFleetStatus = document.getElementById('player-fleet-status');
  const enemyFleetStatus = document.getElementById('enemy-fleet-status');

  // --- Screen Transitions ---

  function switchScreen(from, to) {
    var fromEl = screens[from];
    var toEl = screens[to];

    fromEl.classList.add('fading-out');
    setTimeout(function () {
      fromEl.classList.remove('active', 'fading-out');
      toEl.classList.add('fading-in');
      toEl.classList.add('active');
      setTimeout(function () {
        toEl.classList.remove('fading-in');
      }, 50);
    }, 800);
  }

  // --- Grid Rendering ---

  function buildGridCells(gridEl, onClick, isEnemy) {
    gridEl.innerHTML = '';
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.x = x;
        cell.dataset.y = y;
        if (isEnemy) {
          cell.classList.add('hoverable');
        }
        if (onClick) {
          cell.addEventListener('click', function () {
            onClick(x, y, cell);
          });
        }
        gridEl.appendChild(cell);
      }
    }
  }

  function getCellEl(gridEl, x, y) {
    return gridEl.children[y * GRID_SIZE + x];
  }

  function renderPlayerBoard() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = getCellEl(playerGridEl, x, y);
        const data = gameState.playerBoard[y][x];

        // Reset classes
        cell.className = 'cell';

        if (data.hasShip && !data.hit) {
          cell.classList.add('ship');
        }
        if (data.hit && data.hasShip) {
          cell.classList.add('ship', 'player-hit');
        }
        if (data.hit && !data.hasShip) {
          cell.classList.add('player-miss');
        }
      }
    }
  }

  function renderEnemyBoard() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = getCellEl(enemyGridEl, x, y);
        const memory = gameState.memoryGrid[y][x];

        // Reset classes keeping hoverable
        cell.className = 'cell';

        if (memory === null) {
          cell.classList.add('hoverable');
        } else if (memory.result === 'miss') {
          if (memory.intensity > 0.05) {
            cell.classList.add('miss-memory');
            cell.style.setProperty('--memory-intensity', memory.intensity);
          } else {
            cell.classList.add('miss-memory');
            cell.style.setProperty('--memory-intensity', '0.05');
          }
        } else if (memory.result === 'hit') {
          cell.classList.add('hit-settled');
          cell.style.setProperty('--memory-intensity', Math.max(0.4, memory.intensity));
        } else if (memory.result === 'sunk') {
          cell.classList.add('hit-settled');
          cell.style.setProperty('--memory-intensity', 0.8);
        }

        // Sunk ship ink bleed on adjacent cells
        if (memory && memory.sunkAdjacent) {
          cell.classList.add('sunk-adjacent');
        }
      }
    }
  }

  function updateFleetStatus() {
    playerFleetStatus.innerHTML = '';
    enemyFleetStatus.innerHTML = '';

    gameState.playerShips.forEach(function (ship) {
      const indicator = document.createElement('span');
      indicator.className = 'ship-indicator' + (ship.sunk ? ' sunk' : '');
      indicator.innerHTML = '<span class="ship-dot"></span>' + ship.name;
      playerFleetStatus.appendChild(indicator);
    });

    gameState.enemyShips.forEach(function (ship) {
      const indicator = document.createElement('span');
      indicator.className = 'ship-indicator' + (ship.sunk ? ' sunk' : '');
      indicator.innerHTML = '<span class="ship-dot"></span>' + (ship.sunk ? ship.name : '???');
      enemyFleetStatus.appendChild(indicator);
    });
  }

  // --- Memory Decay ---

  function decayMemory() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const mem = gameState.memoryGrid[y][x];
        if (mem !== null && mem.result === 'miss') {
          mem.intensity *= 0.97;
        }
      }
    }

    // Check if ocean is crowded
    if (!gameState.crowdedMessageShown) {
      let firedCount = gameState.playerFiredSet.size;
      if (firedCount > 40) {
        gameState.crowdedMessageShown = true;
        addFeedMessage(NARRATIVE.crowdedOcean, 'narrative-msg');
      }
    }
  }

  // --- Message Feed ---

  function addFeedMessage(text, className) {
    const msg = document.createElement('div');
    msg.className = 'feed-message ' + (className || '');
    msg.textContent = text;
    messageFeed.appendChild(msg);
    messageFeed.scrollTop = messageFeed.scrollHeight;
  }

  // --- Ship Placement ---

  function initPlacement() {
    gameState.playerBoard = createBoard();
    gameState.playerShips = [];
    gameState.placementIndex = 0;
    gameState.placementOrientation = 'horizontal';

    updatePlacementUI();
    buildGridCells(placementGridEl, onPlacementClick, false);
    placementGridEl.addEventListener('mousemove', onPlacementHover);
    placementGridEl.addEventListener('mouseleave', clearPlacementPreview);
  }

  function updatePlacementUI() {
    if (gameState.placementIndex < SHIPS.length) {
      const ship = SHIPS[gameState.placementIndex];
      currentShipName.textContent = ship.name;
      currentShipSize.textContent = '(' + ship.size + ' cells)';
    }
  }

  function clearPlacementPreview() {
    var cells = placementGridEl.querySelectorAll('.cell');
    cells.forEach(function (c) {
      c.classList.remove('preview', 'preview-invalid');
    });
  }

  function onPlacementHover(e) {
    var target = e.target.closest('.cell');
    if (!target) return;
    clearPlacementPreview();

    if (gameState.placementIndex >= SHIPS.length) return;

    var x = parseInt(target.dataset.x);
    var y = parseInt(target.dataset.y);
    var ship = SHIPS[gameState.placementIndex];
    var valid = canPlaceShip(gameState.playerBoard, x, y, ship.size, gameState.placementOrientation);

    for (var i = 0; i < ship.size; i++) {
      var cx = gameState.placementOrientation === 'horizontal' ? x + i : x;
      var cy = gameState.placementOrientation === 'vertical' ? y + i : y;
      if (isValidCell(cx, cy)) {
        var cell = getCellEl(placementGridEl, cx, cy);
        cell.classList.add(valid ? 'preview' : 'preview-invalid');
      }
    }
  }

  function onPlacementClick(x, y) {
    if (gameState.placementIndex >= SHIPS.length) return;

    var ship = SHIPS[gameState.placementIndex];
    if (!canPlaceShip(gameState.playerBoard, x, y, ship.size, gameState.placementOrientation)) return;

    var cells = placeShip(gameState.playerBoard, x, y, ship.size, gameState.placementOrientation, gameState.placementIndex);
    gameState.playerShips.push({
      name: ship.name,
      size: ship.size,
      cells: cells,
      hits: 0,
      sunk: false,
    });

    // Render placed ship
    cells.forEach(function (c) {
      var cellEl = getCellEl(placementGridEl, c.x, c.y);
      cellEl.classList.remove('preview');
      cellEl.classList.add('ship');
    });

    gameState.placementIndex++;

    if (gameState.placementIndex >= SHIPS.length) {
      // All ships placed, start game after brief delay
      setTimeout(startGame, 600);
    } else {
      updatePlacementUI();
    }
  }

  function randomPlacePlayer() {
    gameState.playerBoard = createBoard();
    gameState.playerShips = placeShipsRandomly(gameState.playerBoard);
    gameState.placementIndex = SHIPS.length;

    // Render all ships on placement grid
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        var cellEl = getCellEl(placementGridEl, x, y);
        cellEl.className = 'cell';
        if (gameState.playerBoard[y][x].hasShip) {
          cellEl.classList.add('ship');
        }
      }
    }

    setTimeout(startGame, 800);
  }

  // --- Game Start ---

  function startGame() {
    // Set up enemy board
    gameState.enemyBoard = createBoard();
    gameState.enemyShips = placeShipsRandomly(gameState.enemyBoard);
    gameState.phase = 'playing';
    gameState.isPlayerTurn = true;
    gameState.battleLog = [];
    gameState.turnCount = 0;
    gameState.playerShotMap = createEmptyGrid(0);
    gameState.aiMode = 'search';
    gameState.aiHitQueue = [];
    gameState.aiFiredSet = new Set();
    gameState.playerFiredSet = new Set();
    gameState.memoryGrid = createEmptyGrid(null);
    gameState.enemyMemoryGrid = createEmptyGrid(null);
    gameState.mirrorBiasActive = false;
    gameState.crowdedMessageShown = false;
    gameState.studyingMessageShown = false;
    gameState.patternMessageShown = false;

    // Build game grids
    buildGridCells(playerGridEl, null, false);
    buildGridCells(enemyGridEl, onEnemyCellClick, true);

    renderPlayerBoard();
    updateFleetStatus();

    switchScreen('placement', 'game');
    addFeedMessage('Your fleet awaits orders.', 'system-msg');

    turnIndicator.textContent = 'Your move';
    turnIndicator.classList.remove('enemy-turn');
  }

  // --- Player Attack ---

  function onEnemyCellClick(x, y) {
    if (gameState.phase !== 'playing') return;
    if (!gameState.isPlayerTurn) return;

    var key = coordKey(x, y);
    if (gameState.playerFiredSet.has(key)) return;

    gameState.playerFiredSet.add(key);
    gameState.isPlayerTurn = false;

    // Update shot heatmap for AI mirroring
    gameState.playerShotMap[y][x] += 1;

    // Check for mirror bias activation
    if (!gameState.mirrorBiasActive && gameState.turnCount > 15) {
      gameState.mirrorBiasActive = true;
    }

    var cell = gameState.enemyBoard[y][x];
    cell.hit = true;

    gameState.turnCount++;

    if (cell.hasShip) {
      var ship = gameState.enemyShips[cell.shipIndex];
      ship.hits++;

      // Animate hit
      var cellEl = getCellEl(enemyGridEl, x, y);
      cellEl.className = 'cell hit';

      if (isShipSunk(ship)) {
        ship.sunk = true;

        // Record sunk in memory
        ship.cells.forEach(function (c) {
          gameState.memoryGrid[c.y][c.x] = { result: 'sunk', intensity: 1.0 };
        });

        // Ink bleed on adjacent cells
        ship.cells.forEach(function (c) {
          var neighbors = [
            { x: c.x - 1, y: c.y }, { x: c.x + 1, y: c.y },
            { x: c.x, y: c.y - 1 }, { x: c.x, y: c.y + 1 },
          ];
          neighbors.forEach(function (n) {
            if (isValidCell(n.x, n.y)) {
              var mem = gameState.memoryGrid[n.y][n.x];
              if (mem === null) {
                gameState.memoryGrid[n.y][n.x] = { result: 'miss', intensity: 0.1, sunkAdjacent: true };
              } else {
                mem.sunkAdjacent = true;
              }
            }
          });
        });

        gameState.battleLog.push({ x: x, y: y, result: 'sunk', turn: gameState.turnCount, player: 'player' });
        addFeedMessage(randomPick(NARRATIVE.sunk), 'player-msg');

        if (allShipsSunk(gameState.enemyShips)) {
          setTimeout(function () { endGame('victory'); }, 1200);
          renderEnemyBoard();
          updateFleetStatus();
          return;
        }
      } else {
        gameState.memoryGrid[y][x] = { result: 'hit', intensity: 1.0 };
        gameState.battleLog.push({ x: x, y: y, result: 'hit', turn: gameState.turnCount, player: 'player' });
        addFeedMessage(randomPick(NARRATIVE.hit), 'player-msg');
      }
    } else {
      gameState.memoryGrid[y][x] = { result: 'miss', intensity: 0.5 };
      gameState.battleLog.push({ x: x, y: y, result: 'miss', turn: gameState.turnCount, player: 'player' });

      // Animate miss
      var cellElMiss = getCellEl(enemyGridEl, x, y);
      cellElMiss.className = 'cell miss';

      addFeedMessage(randomPick(NARRATIVE.miss), 'player-msg');
    }

    decayMemory();
    renderEnemyBoard();
    updateFleetStatus();

    // AI turn
    turnIndicator.textContent = 'Enemy scanning...';
    turnIndicator.classList.add('enemy-turn');

    setTimeout(function () {
      aiTurn();
    }, 1200);
  }

  // --- AI Logic ---

  function aiTurn() {
    if (gameState.phase !== 'playing') return;

    // Show sonar sweep
    sonarLine.classList.remove('active');
    void sonarLine.offsetWidth; // Force reflow
    sonarLine.classList.add('active');

    // Show thinking messages
    var thinkingMessages = [
      randomPick(NARRATIVE.aiThinking),
      randomPick(NARRATIVE.aiThinking.filter(function (m) { return m !== thinkingMessages; })),
      NARRATIVE.aiLaunch,
    ];

    // Show mirror bias narrative
    if (gameState.mirrorBiasActive && !gameState.studyingMessageShown && gameState.turnCount > 20) {
      gameState.studyingMessageShown = true;
      addFeedMessage(NARRATIVE.enemyStudying, 'narrative-msg');
    }
    if (gameState.mirrorBiasActive && !gameState.patternMessageShown && gameState.turnCount > 35) {
      gameState.patternMessageShown = true;
      addFeedMessage(NARRATIVE.patternExposed, 'narrative-msg');
    }

    var delay = 0;
    addFeedMessage(thinkingMessages[0], 'system-msg');
    delay += 600;

    setTimeout(function () {
      addFeedMessage(NARRATIVE.aiLaunch, 'system-msg');
    }, delay);

    delay += 500;

    setTimeout(function () {
      executeAiShot();
    }, delay);
  }

  function executeAiShot() {
    var target = getAiTarget();
    if (!target) return;

    var key = coordKey(target.x, target.y);
    gameState.aiFiredSet.add(key);

    var cell = gameState.playerBoard[target.y][target.x];
    cell.hit = true;

    gameState.turnCount++;

    if (cell.hasShip) {
      var ship = gameState.playerShips[cell.shipIndex];
      ship.hits++;

      // Switch to hunt mode
      gameState.aiMode = 'hunt';

      // Add adjacent cells to hunt queue
      var neighbors = [
        { x: target.x - 1, y: target.y },
        { x: target.x + 1, y: target.y },
        { x: target.x, y: target.y - 1 },
        { x: target.x, y: target.y + 1 },
      ];
      neighbors.forEach(function (n) {
        if (isValidCell(n.x, n.y) && !gameState.aiFiredSet.has(coordKey(n.x, n.y))) {
          // Avoid duplicates in queue
          var alreadyQueued = gameState.aiHitQueue.some(function (q) {
            return q.x === n.x && q.y === n.y;
          });
          if (!alreadyQueued) {
            gameState.aiHitQueue.push(n);
          }
        }
      });

      if (isShipSunk(ship)) {
        ship.sunk = true;

        // Remove queued cells that belong to this sunk ship
        // and remove cells adjacent to the sunk ship that are no longer useful
        gameState.aiHitQueue = gameState.aiHitQueue.filter(function (q) {
          return !gameState.aiFiredSet.has(coordKey(q.x, q.y));
        });

        if (gameState.aiHitQueue.length === 0) {
          gameState.aiMode = 'search';
        }

        gameState.battleLog.push({ x: target.x, y: target.y, result: 'sunk', turn: gameState.turnCount, player: 'enemy' });
        addFeedMessage(randomPick(NARRATIVE.enemySunk), 'enemy-msg');

        if (allShipsSunk(gameState.playerShips)) {
          renderPlayerBoard();
          updateFleetStatus();
          setTimeout(function () { endGame('defeat'); }, 1200);
          return;
        }
      } else {
        gameState.battleLog.push({ x: target.x, y: target.y, result: 'hit', turn: gameState.turnCount, player: 'enemy' });
        addFeedMessage(randomPick(NARRATIVE.enemyHit), 'enemy-msg');
      }
    } else {
      gameState.battleLog.push({ x: target.x, y: target.y, result: 'miss', turn: gameState.turnCount, player: 'enemy' });
      addFeedMessage(randomPick(NARRATIVE.enemyMiss), 'enemy-msg');

      // If we're in hunt mode and miss, remove this from queue consideration
      // but stay in hunt mode if there are still targets
      if (gameState.aiHitQueue.length === 0) {
        gameState.aiMode = 'search';
      }
    }

    renderPlayerBoard();
    updateFleetStatus();

    // Player's turn again
    gameState.isPlayerTurn = true;
    turnIndicator.textContent = 'Your move';
    turnIndicator.classList.remove('enemy-turn');
  }

  function getAiTarget() {
    // Hunt mode: try adjacent cells of known hits
    if (gameState.aiMode === 'hunt' && gameState.aiHitQueue.length > 0) {
      while (gameState.aiHitQueue.length > 0) {
        var target = gameState.aiHitQueue.shift();
        var key = coordKey(target.x, target.y);
        if (!gameState.aiFiredSet.has(key) && isValidCell(target.x, target.y)) {
          return target;
        }
      }
      // Queue exhausted, fall back to search
      gameState.aiMode = 'search';
    }

    // Search mode with mirror bias
    var candidates = [];
    for (var y = 0; y < GRID_SIZE; y++) {
      for (var x = 0; x < GRID_SIZE; x++) {
        if (!gameState.aiFiredSet.has(coordKey(x, y))) {
          var weight = 1;

          // Checkerboard pattern preference for efficiency
          if ((x + y) % 2 === 0) {
            weight += 0.5;
          }

          // Mirror bias: favor cells where the player fires often
          if (gameState.mirrorBiasActive) {
            weight += gameState.playerShotMap[y][x] * 0.3;
          }

          candidates.push({ x: x, y: y, weight: weight });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Weighted random selection
    var totalWeight = candidates.reduce(function (sum, c) { return sum + c.weight; }, 0);
    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < candidates.length; i++) {
      cumulative += candidates[i].weight;
      if (roll <= cumulative) {
        return candidates[i];
      }
    }

    return candidates[candidates.length - 1];
  }

  // --- End Game ---

  function endGame(result) {
    gameState.phase = 'ended';

    if (result === 'victory') {
      endText.innerHTML =
        '<p>The ocean grows quiet.</p>' +
        '<p>No signals remain.</p>';
    } else {
      endText.innerHTML =
        '<p>The last echo fades from your fleet.</p>' +
        '<p>The fog closes.</p>';
    }

    switchScreen('game', 'end');

    // Build replay grid
    buildGridCells(replayGridEl, null, false);

    // Start Signal Archive replay after transition
    setTimeout(function () {
      startReplay(result);
    }, 3000);
  }

  // --- Signal Archive Replay ---

  function startReplay(result) {
    replayStatus.textContent = 'The fog begins to lift...';

    setTimeout(function () {
      replayStatus.textContent = 'The ocean remembers everything.';
    }, 1500);

    setTimeout(function () {
      var log = gameState.battleLog;
      var delay = 0;
      var interval = Math.max(150, Math.min(350, 3000 / (log.length || 1)));

      log.forEach(function (move, i) {
        setTimeout(function () {
          renderReplayMove(move);
          replayStatus.textContent = 'Signal ' + (i + 1) + ' of ' + log.length;
        }, i * interval);
      });

      // Show final text after replay
      setTimeout(function () {
        if (result === 'victory') {
          replayStatus.textContent = 'Only the quiet ocean.';
        } else {
          replayStatus.textContent = 'The water still holds its memory.';
        }
        btnDrift.style.display = '';
        btnDrift.style.opacity = '0';
        setTimeout(function () {
          btnDrift.style.opacity = '1';
          btnDrift.style.transition = 'opacity 1s ease';
        }, 50);
      }, log.length * interval + 1000);
    }, 3000);
  }

  function renderReplayMove(move) {
    var cell = getCellEl(replayGridEl, move.x, move.y);
    if (move.result === 'miss') {
      cell.classList.add('miss-memory');
      cell.style.setProperty('--memory-intensity', '0.3');
    } else if (move.result === 'hit' || move.result === 'sunk') {
      cell.classList.add('hit-settled');
      cell.style.setProperty('--memory-intensity', '0.7');
    }

    // Color differently for player vs enemy moves
    if (move.player === 'enemy') {
      cell.style.borderLeft = '1px solid rgba(74, 127, 170, 0.3)';
    }
  }

  // --- Restart ---

  function restartGame() {
    // Reset state
    gameState.phase = 'placement';

    // Clear feed
    messageFeed.innerHTML = '<div class="feed-header">--- SIGNAL LOG ---</div>';

    btnDrift.style.display = 'none';

    switchScreen('end', 'placement');
    initPlacement();
  }

  // --- Event Listeners ---

  btnBegin.addEventListener('click', function () {
    gameState.phase = 'placement';
    switchScreen('intro', 'placement');
    initPlacement();
  });

  btnRandomPlace.addEventListener('click', function () {
    randomPlacePlayer();
  });

  btnDrift.addEventListener('click', function () {
    restartGame();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'r' || e.key === 'R') {
      if (gameState.phase === 'placement') {
        gameState.placementOrientation =
          gameState.placementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        clearPlacementPreview();
      }
    }
  });

})();
