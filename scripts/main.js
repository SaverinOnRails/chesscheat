// Chesscheat content script.
//
// Runs in the page's main world ("world": "MAIN" in manifest.json) so it can use
// chess.com's own board component: `wc-chess-board.game` hands us the exact FEN
// (castling rights, en passant square and side to move included) and its markings
// API draws the arrow. If that object is missing (a browser without main-world
// support, or a chess.com change) the script falls back to reading the pieces
// straight out of the DOM, which is what earlier versions always did.
//
// The engine is the Stockfish 19 build shipped in engine/ (scripts/bridge.js tells this
// script where to find it). chess.com's own hosted Stockfish worker is kept as a fallback
// for when the bundled one cannot be loaded.
(() => {
  'use strict';

  if (window.__chesscheatLoaded) return;
  window.__chesscheatLoaded = true;

  // Bundled engine (engine/ in the extension, web-accessible to chess.com pages). A
  // main-world script cannot ask chrome.runtime for the extension's URL, so
  // scripts/bridge.js writes the base URL into this attribute on <html>.
  const BRIDGE_ATTRIBUTE = 'data-chesscheat-engine-base';
  const BUNDLED_ENGINE = { script: 'stockfish-19-lite-single.js', wasm: 'stockfish-19-lite-single.wasm' };
  // Fallback: the Stockfish worker chess.com serves to its own visitors. The hash in the
  // file name changes on some chess.com deploys, which is why it is no longer the first choice.
  const ENGINE_URL = '/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js';
  const DEFAULT_DEPTH = 15;
  const MIN_DEPTH = 1;
  const MAX_DEPTH = 30;
  const ENGINE_LOAD_TIMEOUT_MS = 15000;
  const DOM_SETTLE_MS = 200; // chess.com animates moves for ~180 ms
  const SAFETY_POLL_MS = 1000; // catches anything the observer misses, and board replacement
  const PANEL_POLL_MS = 500; // chess.com is a single-page app: re-attach the panel as needed
  const COLOUR_OWN = '#e5342b';
  const COLOUR_OPPONENT = '#48c1f9';
  const FLASH_MS = 700; // how long a key-triggered flash of the move stays on the board
  const SETTINGS_KEY = 'chesscheat.settings';
  const DEFAULT_SETTINGS = { depth: DEFAULT_DEPTH, hidden: false, key: '`' };

  const FILES = 'abcdefgh';
  const squareCode = (square) => `${FILES.indexOf(square[0]) + 1}${square[1]}`; // "e4" -> "54"
  const colourFromOrientation = (board) => (board.classList.contains('flipped') ? 'b' : 'w');

  // ---------------------------------------------------------------------------
  // Reading the position
  // ---------------------------------------------------------------------------

  function readPositionFromApi(board) {
    const game = board.game;
    if (!game || typeof game.getFEN !== 'function') return null;
    try {
      const fen = game.getFEN();
      const fields = typeof fen === 'string' ? fen.split(' ') : [];
      if (fields.length < 2) return null;
      const playingAs = typeof game.getPlayingAs === 'function' ? game.getPlayingAs() : 0;
      return {
        fen,
        turn: fields[1],
        playingAs: playingAs === 1 ? 'w' : playingAs === 2 ? 'b' : colourFromOrientation(board),
        gameOver: typeof game.isGameOver === 'function' && Boolean(game.isGameOver()),
        source: 'api',
      };
    } catch (error) {
      return null;
    }
  }

  // Map of "fileRank" codes ("54" = e4) to piece codes ("wp"), read from the piece elements.
  function readGrid(board) {
    const grid = {};
    for (const element of board.querySelectorAll('.piece')) {
      let piece = null;
      let square = null;
      for (const cls of element.classList) {
        if (/^[wb][pnbrqk]$/.test(cls)) piece = cls;
        else if (/^square-[1-8][1-8]$/.test(cls)) square = cls.slice(7);
      }
      if (piece && square) grid[square] = piece;
    }
    return grid;
  }

  function placementFromGrid(grid) {
    const rows = [];
    for (let rank = 8; rank >= 1; rank--) {
      let row = '';
      let empty = 0;
      for (let file = 1; file <= 8; file++) {
        const piece = grid[`${file}${rank}`];
        if (!piece) {
          empty += 1;
          continue;
        }
        if (empty) {
          row += empty;
          empty = 0;
        }
        row += piece[0] === 'w' ? piece[1].toUpperCase() : piece[1];
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join('/');
  }

  // A king and rook still on their home squares are assumed to be able to castle.
  function castlingFromGrid(grid) {
    let rights = '';
    if (grid['51'] === 'wk') {
      if (grid['81'] === 'wr') rights += 'K';
      if (grid['11'] === 'wr') rights += 'Q';
    }
    if (grid['58'] === 'bk') {
      if (grid['88'] === 'br') rights += 'k';
      if (grid['18'] === 'br') rights += 'q';
    }
    return rights || '-';
  }

  // chess.com marks the last move with two highlight squares; the moved piece sits on one of them.
  function lastMoverFromHighlights(board, grid) {
    for (const element of board.querySelectorAll('.highlight:not(.cheat-highlight)')) {
      const cls = [...element.classList].find((c) => /^square-[1-8][1-8]$/.test(c));
      const piece = cls && grid[cls.slice(7)];
      if (piece) return piece[0];
    }
    return null;
  }

  function enPassantSquare(previous, grid, changed) {
    for (const square of changed) {
      const piece = grid[square];
      if (!piece || piece[1] !== 'p') continue;
      const file = square[0];
      const fileLetter = FILES[Number(file) - 1];
      if (piece === 'wp' && square[1] === '4' && previous[`${file}2`] === 'wp' && !grid[`${file}2`]) return `${fileLetter}3`;
      if (piece === 'bp' && square[1] === '5' && previous[`${file}7`] === 'bp' && !grid[`${file}7`]) return `${fileLetter}6`;
    }
    return '-';
  }

  // Fallback used when the board's game object is unavailable. Side to move is tracked
  // by watching which colour moved between reads.
  function readPositionFromDom(board, state) {
    const grid = readGrid(board);
    const pieces = Object.values(grid);
    if (!pieces.includes('wk') || !pieces.includes('bk')) return null;

    const changed = state.grid
      ? Object.keys({ ...state.grid, ...grid }).filter((sq) => state.grid[sq] !== grid[sq])
      : [];
    let { turn, ep } = state;
    if (!state.grid || changed.length > 4) {
      // First read, or a jump to a different position: ask chess.com's last-move highlight.
      turn = lastMoverFromHighlights(board, grid) === 'w' ? 'b' : 'w';
      ep = '-';
    } else if (changed.length > 0) {
      // One move was played: whichever colour now occupies a changed square made it.
      const mover = changed.map((sq) => grid[sq]).find(Boolean);
      if (mover) turn = mover[0] === 'w' ? 'b' : 'w';
      ep = enPassantSquare(state.grid, grid, changed);
    }
    Object.assign(state, { grid, turn, ep });

    return {
      fen: `${placementFromGrid(grid)} ${turn} ${castlingFromGrid(grid)} ${ep} 0 1`,
      turn,
      playingAs: colourFromOrientation(board),
      gameOver: false,
      source: 'dom',
    };
  }

  const readPosition = (board, domState) => readPositionFromApi(board) || readPositionFromDom(board, domState);

  function sanFor(board, move) {
    try {
      const game = board.game;
      const legal = game && typeof game.getLegalMoves === 'function' ? game.getLegalMoves() : null;
      if (!Array.isArray(legal)) return null;
      const from = move.slice(0, 2);
      const to = move.slice(2, 4);
      const promotion = move.slice(4, 5).toLowerCase();
      const found = legal.find(
        (m) => m.from === from && m.to === to && (!promotion || String(m.promotion || '').toLowerCase() === promotion),
      );
      return found && found.san ? found.san : null;
    } catch (error) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Engine: one UCI worker, one search at a time
  // ---------------------------------------------------------------------------

  function parseInfo(line) {
    const tokens = line.split(/\s+/);
    const info = {};
    for (let i = 1; i < tokens.length; i++) {
      switch (tokens[i]) {
        case 'depth':
          info.depth = Number(tokens[++i]);
          break;
        case 'multipv':
          info.multipv = Number(tokens[++i]);
          break;
        case 'score':
          info.scoreType = tokens[++i];
          info.score = Number(tokens[++i]);
          break;
        case 'pv':
          info.move = tokens[i + 1];
          i = tokens.length;
          break;
        case 'string':
          return null;
        default:
          break;
      }
    }
    if (!info.depth || !info.move || (info.multipv && info.multipv !== 1)) return null;
    return info;
  }

  // Engine sources in order of preference. `open` returns a Worker, or a promise of one,
  // that speaks UCI over postMessage. A source that fails before answering `isready` is
  // dropped for the next one.
  const ENGINE_SOURCES = [
    { name: 'Stockfish 19', note: 'bundled', open: openBundledEngine },
    { name: "chess.com's Stockfish", note: 'fallback', open: () => new Worker(ENGINE_URL) },
  ];

  // A page may not construct a Worker from an extension URL, so the loader script is
  // fetched and started from a blob: URL instead. Stockfish.js takes the location of its
  // .wasm file from the worker URL's fragment (it reads self.location.hash), which lets
  // the worker fetch the wasm straight from the extension.
  async function openBundledEngine() {
    const base = document.documentElement.getAttribute(BRIDGE_ATTRIBUTE);
    if (!base) throw new Error('the extension did not provide its engine URL (scripts/bridge.js)');
    const response = await fetch(base + BUNDLED_ENGINE.script);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${BUNDLED_ENGINE.script}`);
    // When the .wasm file cannot be fetched, Stockfish.js neither throws nor answers: its
    // load promise just stays pending. Rethrow such rejections so they reach the Worker's
    // error event and the next source is tried at once instead of after the load timeout.
    const bootstrap = "self.addEventListener('unhandledrejection', (event) => { throw event.reason; });\n";
    const blobUrl = URL.createObjectURL(new Blob([bootstrap, await response.text()], { type: 'text/javascript' }));
    const worker = new Worker(`${blobUrl}#${encodeURIComponent(base + BUNDLED_ENGINE.wasm)}`);
    const release = () => URL.revokeObjectURL(blobUrl);
    worker.addEventListener('message', release, { once: true });
    worker.addEventListener('error', release, { once: true });
    return worker;
  }

  class Engine {
    constructor(sources, handlers) {
      this.handlers = handlers;
      this.sources = [...sources];
      this.failures = []; // why each earlier source was given up on
      this.source = null;
      this.worker = null;
      this.disposed = false;
      this.ready = false;
      this.searching = false;
      this.pending = null; // request to run once the current search has stopped
      this.discard = false; // drop the next bestmove: the search was cancelled
      this.current = null;
      this.loadTimer = null;
      this.openNext();
    }

    openNext() {
      const source = this.sources.shift();
      if (!source) {
        this.handlers.onError(`No engine could be started. ${this.failures.join(' ')}`);
        return;
      }
      this.source = source;
      new Promise((resolve) => resolve(source.open())).then(
        (worker) => (this.disposed ? worker.terminate() : this.attach(worker)),
        (error) => this.fail(error && error.message ? error.message : String(error)),
      );
    }

    attach(worker) {
      this.worker = worker;
      worker.onerror = (event) => this.fail(event.message || 'the worker could not be loaded');
      worker.onmessage = (event) => this.handle(String(event.data));
      this.loadTimer = setTimeout(
        () => this.fail(`no answer within ${ENGINE_LOAD_TIMEOUT_MS / 1000} seconds`),
        ENGINE_LOAD_TIMEOUT_MS,
      );
      this.send('uci');
    }

    // Before the engine has answered, a failure means "try the next source". After that it
    // ends the session, as before: a replacement engine would not know the current search.
    fail(reason) {
      if (this.disposed) return;
      clearTimeout(this.loadTimer);
      if (this.worker) this.worker.terminate();
      this.worker = null;
      if (this.ready) {
        this.handlers.onError(`${this.source.name} stopped working: ${reason.replace(/\.$/, "")}.`);
        return;
      }
      this.failures.push(`${this.source.name} (${this.source.note}) failed: ${reason.replace(/\.$/, "")}.`);
      this.openNext();
    }

    send(command) {
      if (this.worker) this.worker.postMessage(command);
    }

    analyse(request) {
      this.discard = false;
      if (!this.ready) {
        this.pending = request;
        return;
      }
      if (this.searching) {
        this.pending = request;
        this.send('stop');
        return;
      }
      this.start(request);
    }

    cancel() {
      this.pending = null;
      if (this.searching) {
        this.discard = true;
        this.send('stop');
      }
    }

    start(request) {
      this.current = request;
      this.pending = null;
      this.searching = true;
      this.send(`position fen ${request.fen}`);
      this.send(`go depth ${request.depth}`);
    }

    handle(line) {
      if (line === 'uciok') {
        this.send('ucinewgame');
        this.send('isready');
        return;
      }
      if (line === 'readyok') {
        if (this.ready) return;
        this.ready = true;
        clearTimeout(this.loadTimer);
        this.handlers.onReady(this.source, this.failures);
        if (this.pending) this.start(this.pending);
        return;
      }
      if (line.startsWith('info ')) {
        if (!this.searching || this.pending || this.discard) return; // belongs to a search we no longer want
        const info = parseInfo(line);
        if (info) this.handlers.onInfo(this.current, info);
        return;
      }
      if (line.startsWith('bestmove')) {
        if (!this.searching) return;
        const finished = this.current;
        const discard = this.discard;
        this.searching = false;
        this.discard = false;
        if (this.pending) {
          this.start(this.pending); // the position moved on while we searched
          return;
        }
        if (!discard) this.handlers.onBestMove(finished, line.split(/\s+/)[1]);
      }
    }

    terminate() {
      this.disposed = true;
      clearTimeout(this.loadTimer);
      if (this.worker) this.worker.terminate();
      this.worker = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Settings, kept in localStorage on chess.com so they survive reloads
  // ---------------------------------------------------------------------------

  const settings = { ...DEFAULT_SETTINGS };

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (Number.isFinite(stored.depth)) {
        settings.depth = Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, Math.round(stored.depth)));
      }
      if (typeof stored.hidden === 'boolean') settings.hidden = stored.hidden;
      if (typeof stored.key === 'string' && stored.key) settings.key = stored.key;
    } catch (error) {
      // no storage or unreadable settings: keep the defaults
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      // storage unavailable: settings last for this page only
    }
  }

  // ---------------------------------------------------------------------------
  // Panel
  // ---------------------------------------------------------------------------

  const ui = { panel: null, button: null, depth: null, hidden: null, key: null, status: null, engine: null, capturing: false };

  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'cheat-panel';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Start Hack';
    button.addEventListener('click', () => (session ? stop() : start()));

    const label = document.createElement('label');
    label.append('Depth ');
    const depth = document.createElement('input');
    depth.type = 'number';
    depth.min = String(MIN_DEPTH);
    depth.max = String(MAX_DEPTH);
    depth.step = '1';
    depth.value = String(settings.depth);
    depth.title = `Search depth. ${DEFAULT_DEPTH} answers within a second or two; 20 and above can take much longer.`;
    depth.addEventListener('change', onDepthChange);
    label.append(depth);

    const hiddenLabel = document.createElement('label');
    const hidden = document.createElement('input');
    hidden.type = 'checkbox';
    hidden.checked = settings.hidden;
    hidden.title = 'Draw nothing on the board until you press the flash key.';
    hidden.addEventListener('change', onHiddenChange);
    hiddenLabel.append(hidden, ' Hide until key');

    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'cheat-key';
    key.title = 'Press this key during a game to flash the best move on the board for a moment. Click to change it.';
    key.addEventListener('click', beginKeyCapture);

    const status = document.createElement('span');
    status.className = 'cheat-status';
    status.textContent = 'Idle';

    const engine = document.createElement('span');
    engine.className = 'cheat-engine';

    panel.append(button, label, hiddenLabel, key, status, engine);
    Object.assign(ui, { panel, button, depth, hidden, key, status, engine });
    renderKeyButton();
  }

  function ensurePanel() {
    const main = document.querySelector('.board-layout-main');
    if (!main) return;
    if (!ui.panel) buildPanel();
    if (!main.contains(ui.panel)) main.prepend(ui.panel);
  }

  function setStatus(text, isError = false) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.toggle('error', isError);
  }

  // Names the engine that answered; highlighted when it was not the first choice.
  function showEngine(source, failures = []) {
    if (!ui.engine) return;
    ui.engine.textContent = source ? `${source.name} (${source.note})` : '';
    ui.engine.classList.toggle('fallback', Boolean(source) && failures.length > 0);
    ui.engine.title = failures.join(' ');
  }

  function currentDepth() {
    const value = Math.round(Number(ui.depth.value));
    return Number.isFinite(value) ? Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, value)) : DEFAULT_DEPTH;
  }

  function onDepthChange() {
    settings.depth = currentDepth();
    ui.depth.value = String(settings.depth);
    saveSettings();
    if (session) checkPosition(true);
  }

  function onHiddenChange() {
    settings.hidden = ui.hidden.checked;
    saveSettings();
    if (!session) return;
    clearPersistent();
    if (!settings.hidden && session.best) session.persistent = drawMove(session.best.move, session.best.own);
    if (session.lastResult) report(session.lastResult);
  }

  function keyLabel(key) {
    if (key === ' ') return 'Space';
    return key.length === 1 ? key.toUpperCase() : key;
  }

  function renderKeyButton() {
    if (!ui.key) return;
    ui.key.textContent = ui.capturing ? 'Press a key…' : `Flash: ${keyLabel(settings.key)}`;
    ui.key.classList.toggle('capturing', ui.capturing);
  }

  function beginKeyCapture() {
    ui.capturing = true;
    renderKeyButton();
    ui.key.blur(); // so the chosen key is not also read as a click on this button
  }

  // UCI scores are from the side to move; show them from White's side like chess.com's eval bar.
  function formatEval(info, turn) {
    const sign = turn === 'w' ? 1 : -1;
    if (info.scoreType === 'mate') {
      const mate = info.score * sign;
      if (mate === 0) return '#';
      return mate > 0 ? `+M${mate}` : `-M${-mate}`;
    }
    if (info.scoreType !== 'cp') return '';
    const pawns = (info.score * sign) / 100;
    return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
  }

  // ---------------------------------------------------------------------------
  // Session: watch the board, drive the engine, draw the result
  // ---------------------------------------------------------------------------

  let session = null;

  function start() {
    const board = document.querySelector('wc-chess-board');
    if (!board) {
      setStatus('No chess board on this page. Open a game first.', true);
      return;
    }
    session = {
      board,
      engine: null,
      observer: null,
      pollTimer: null,
      settleTimer: null,
      lastFen: null,
      lastInfo: null,
      lastResult: null, // what the status line currently reports, for re-rendering
      best: null, // latest move from the engine: { move, own, key }
      persistent: null, // drawing handle for the move kept on the board
      flash: null, // drawing handle for a key-triggered flash
      flashTimer: null,
      sanCache: {},
      domState: { grid: null, turn: 'w', ep: '-' },
    };
    ui.button.textContent = 'Stop Hack';
    ui.button.classList.add('running');
    setStatus('Loading engine…');
    session.engine = new Engine(ENGINE_SOURCES, {
      onReady: (source, failures) => {
        showEngine(source, failures);
        checkPosition(true);
      },
      onInfo,
      onBestMove,
      onError: (message) =>
        setTimeout(() => {
          stop();
          setStatus(message, true);
        }, 0),
    });
    observeBoard(board);
    session.pollTimer = setInterval(() => {
      const current = document.querySelector('wc-chess-board');
      if (current && current !== session.board) {
        clearMarks();
        session.board = current;
        session.domState = { grid: null, turn: 'w', ep: '-' };
        observeBoard(current);
      }
      checkPosition();
    }, SAFETY_POLL_MS);
  }

  function stop() {
    if (!session) return;
    clearMarks();
    if (session.observer) session.observer.disconnect();
    clearInterval(session.pollTimer);
    clearTimeout(session.settleTimer);
    if (session.engine) session.engine.terminate();
    session = null;
    ui.button.textContent = 'Start Hack';
    ui.button.classList.remove('running');
    setStatus('Stopped');
    showEngine(null);
  }

  function observeBoard(board) {
    if (session.observer) session.observer.disconnect();
    session.observer = new MutationObserver(scheduleCheck);
    session.observer.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function scheduleCheck() {
    if (!session) return;
    clearTimeout(session.settleTimer);
    session.settleTimer = setTimeout(() => checkPosition(), DOM_SETTLE_MS);
  }

  function checkPosition(force = false) {
    if (!session || !session.engine) return;
    const position = readPosition(session.board, session.domState);
    if (!position) {
      setStatus('Waiting for the board to load…');
      return;
    }
    if (!force && position.fen === session.lastFen) return;
    session.lastFen = position.fen;
    session.lastInfo = null;
    session.sanCache = {};
    clearMarks();
    if (position.gameOver) {
      session.engine.cancel();
      setStatus('Game over.');
      return;
    }
    const depth = currentDepth();
    session.engine.analyse({ ...position, depth });
    setStatus(`${position.turn === position.playingAs ? 'Your move' : "Opponent's move"} · thinking to depth ${depth}…`);
  }

  function onInfo(request, info) {
    if (!session || request.fen !== session.lastFen) return;
    session.lastInfo = info;
    showMove(info.move, request);
    report({ request, move: info.move, info, progress: `depth ${info.depth}/${request.depth}` });
  }

  function onBestMove(request, move) {
    if (!session || request.fen !== session.lastFen) return;
    if (!/^[a-h][1-8][a-h][1-8]/.test(move || '')) {
      clearMarks();
      setStatus('No legal moves here (checkmate or stalemate).');
      return;
    }
    showMove(move, request);
    report({ request, move, info: session.lastInfo, progress: `depth ${request.depth} done` });
  }

  function report(result) {
    session.lastResult = result;
    setStatus(describe(result));
  }

  function describe({ request, move, info, progress }) {
    const own = request.turn === request.playingAs;
    const evalText = info ? formatEval(info, request.turn) : '';
    const tail = `${evalText ? ` · ${evalText}` : ''} · ${progress}`;
    if (settings.hidden) {
      return `${own ? 'Your move' : "Opponent's move"} · press ${keyLabel(settings.key)} to flash${tail}`;
    }
    if (!(move in session.sanCache)) session.sanCache[move] = sanFor(session.board, move);
    const san = session.sanCache[move];
    const label = own ? 'Your best move' : "Opponent's likely reply";
    return `${label}: ${san ? `${san} (${move})` : move}${tail}`;
  }

  // Remembers the latest move and, unless the board is kept hidden, keeps it drawn.
  function showMove(move, request) {
    const own = request.turn === request.playingAs;
    const key = `${move.slice(0, 4)}|${own}`;
    if (session.best && session.best.key === key) return;
    session.best = { move, own, key };
    clearPersistent();
    if (!settings.hidden) session.persistent = drawMove(move, own);
  }

  // Shows the latest move on the board for a moment: the flash key.
  function flash() {
    if (!session || !session.best) return;
    clearFlash();
    const { move, own } = session.best;
    // With the arrow already on the board the flash adds the squares only: chess.com keys
    // arrows by their squares, so drawing the same arrow twice would remove it with the flash.
    session.flash = drawMove(move, own, { arrow: !session.persistent, squares: true });
    session.flashTimer = setTimeout(clearFlash, FLASH_MS);
  }

  // Draws a move on the board and returns a handle for clearDrawn(). The arrow uses
  // chess.com's own markings when available; otherwise, or when asked, the from and to
  // squares are coloured instead.
  function drawMove(move, own, { arrow = true, squares = false } = {}) {
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const color = own ? COLOUR_OWN : COLOUR_OPPONENT;
    const handle = { markingKeys: [], elements: [] };
    let needSquares = squares;
    if (arrow) {
      const markings = session.board.game && session.board.game.markings;
      let drawn = false;
      if (markings && typeof markings.addOne === 'function') {
        try {
          const markingKey = markings.addOne({ type: 'arrow', data: { from, to, color, opacity: 0.85 } });
          if (markingKey) {
            handle.markingKeys.push(markingKey);
            drawn = true;
          }
        } catch (error) {
          // fall through to plain highlight squares
        }
      }
      if (!drawn) needSquares = true;
    }
    if (needSquares) {
      for (const [square, opacity] of [
        [from, 0.45],
        [to, 0.7],
      ]) {
        const element = document.createElement('div');
        element.className = `highlight cheat-highlight square-${squareCode(square)}`;
        element.style.cssText = `background-color:${color};opacity:${opacity};pointer-events:none`;
        session.board.appendChild(element);
        handle.elements.push(element);
      }
    }
    return handle;
  }

  function clearDrawn(handle) {
    if (!handle) return;
    const markings = session && session.board.game && session.board.game.markings;
    for (const key of handle.markingKeys) {
      try {
        if (markings) markings.removeOne(key);
      } catch (error) {
        // already gone
      }
    }
    for (const element of handle.elements) element.remove();
  }

  function clearPersistent() {
    clearDrawn(session.persistent);
    session.persistent = null;
  }

  function clearFlash() {
    if (!session) return;
    clearTimeout(session.flashTimer);
    session.flashTimer = null;
    clearDrawn(session.flash);
    session.flash = null;
  }

  function clearMarks() {
    if (!session) return;
    clearPersistent();
    clearFlash();
    session.best = null;
  }

  // ---------------------------------------------------------------------------
  // Flash key
  // ---------------------------------------------------------------------------

  function isTypingTarget(target) {
    if (!(target instanceof Element)) return false;
    return target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null;
  }

  function onKeyDown(event) {
    if (ui.capturing) {
      event.preventDefault();
      event.stopPropagation();
      ui.capturing = false;
      if (event.key !== 'Escape' && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        settings.key = event.key;
        saveSettings();
        if (session && session.lastResult) report(session.lastResult);
      }
      renderKeyButton();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isTypingTarget(event.target)) return;
    const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const wanted = settings.key.length === 1 ? settings.key.toLowerCase() : settings.key;
    if (pressed !== wanted) return;
    event.preventDefault();
    event.stopPropagation();
    flash();
  }

  document.addEventListener('keydown', onKeyDown, true);

  loadSettings();
  ensurePanel();
  setInterval(ensurePanel, PANEL_POLL_MS);
})();
