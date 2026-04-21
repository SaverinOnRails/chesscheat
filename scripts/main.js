//this is quite possibly the most disgusting piece of code i've ever written.
var hackRunning = false;
var globalDepth = 15;
var lastBestMove = "";
var lastSuggestedUci = "";
/** When true, each fresh engine bestmove is played automatically (same as N) on your turn. */
var automoveEnabled = false;

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function createUI() {
  if (document.getElementById("chesscheat-root")) return;

  const host = document.createElement("div");
  host.id = "chesscheat-root";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.right = "16px";
  host.style.bottom = "16px";
  host.style.zIndex = "2147483647";

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    :host{
      /* DESIGN.md tokens */
      --cc-blue: #0071e3; /* Apple Blue */
      --cc-bgLight: #f5f5f7;
      --cc-textLight: #1d1d1f;
      --cc-textLightSecondary: rgba(0, 0, 0, 0.8);
      --cc-textLightTertiary: rgba(0, 0, 0, 0.48);
      --cc-shadowCard: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;
      --cc-btnLightBg: #fafafc;
      --cc-btnLightBorder: rgba(0, 0, 0, 0.04);
      --cc-overlay: rgba(210, 210, 215, 0.64);
    }
    @media (prefers-color-scheme: dark){
      :host{
        --cc-bgLight: #272729; /* Dark surface */
        --cc-textLight: #ffffff;
        --cc-textLightSecondary: #ffffff;
        --cc-textLightTertiary: rgba(255, 255, 255, 0.66);
        --cc-btnLightBg: #1d1d1f; /* Primary Dark */
        --cc-btnLightBorder: transparent;
        --cc-shadowCard: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;
      }
    }

    .panel{
      font-family: "SF Pro Text", "SF Pro Icons", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: var(--cc-textLight);
      background: var(--cc-bgLight);
      border: none; /* borders are rare */
      box-shadow: var(--cc-shadowCard);
      border-radius: 8px;
      width: 220px;
      overflow: hidden;
    }
    .header{
      display:flex;
      align-items:center;
      justify-content: space-between;
      padding: 10px 10px 8px;
    }
    .title{
      display:flex;
      gap:8px;
      align-items:center;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.224px;
    }
    .hint{
      margin-left: auto;
      font-size: 12px;
      font-weight: 400;
      letter-spacing: -0.12px;
      color: var(--cc-textLightTertiary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    .spinner{
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 2px solid rgba(0,0,0,0.12);
      border-top-color: var(--cc-blue);
      animation: cc-spin 0.9s linear infinite;
      display: none;
    }
    .spinner.on{ display: inline-block; }
    @keyframes cc-spin { to { transform: rotate(360deg); } }
    .body{ padding: 0 10px 10px; display:flex; flex-direction:column; gap: 8px; }
    .row{ display:flex; align-items:center; justify-content: space-between; gap: 10px; }
    .label{ font-size: 14px; color: var(--cc-textLightSecondary); letter-spacing: -0.224px; }
    .value{ font-size: 14px; color: var(--cc-textLight); font-variant-numeric: tabular-nums; letter-spacing: -0.224px; }
    .slider{
      position: relative;
      width: 100%;
      height: 24px;
      display:flex;
      align-items:center;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .sliderTrack{
      position: relative;
      width: 100%;
      height: 8px;
      background: rgba(0,0,0,0.14);
      border-radius: 980px;
      overflow: hidden;
    }
    .sliderFill{
      position:absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0%;
      background: var(--cc-blue);
      border-radius: 980px;
    }
    .sliderThumb{
      position:absolute;
      top: 50%;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: #ffffff;
      box-shadow: rgba(0, 0, 0, 0.22) 0px 3px 12px 0px;
      border: 1px solid rgba(0,0,0,0.08);
    }
    @media (prefers-color-scheme: dark){
      .sliderTrack{ background: rgba(255,255,255,0.24); }
      .sliderThumb{
        background: #ffffff;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: rgba(0, 0, 0, 0.40) 0px 6px 16px 0px;
      }
    }
    .slider:focus-visible .sliderThumb{
      outline: 2px solid var(--cc-blue);
      outline-offset: 2px;
    }
    .actions{ display:flex; gap: 10px; }
    button{
      appearance: none;
      border: 3px solid var(--cc-btnLightBorder); /* Filter/Search button spec */
      background: var(--cc-btnLightBg);
      color: var(--cc-textLightSecondary);
      border-radius: 11px;
      padding: 5px 10px;
      font-size: 13px;
      font-weight: 400;
      line-height: 1.29;
      letter-spacing: -0.224px;
      cursor: pointer;
      user-select: none;
    }
    button:hover{ filter: brightness(1.02); }
    button:active{ filter: brightness(0.98); }
    button[disabled]{ opacity: 0.6; cursor: not-allowed; }
    .primary{
      border: 1px solid transparent;
      background: var(--cc-blue);
      color: #ffffff;
      border-radius: 8px;
    }
    .primary:hover{ filter: brightness(1.05); }
    .primary:focus-visible{ outline: 2px solid var(--cc-blue); outline-offset: 2px; }
    button:focus-visible{ outline: 2px solid var(--cc-blue); outline-offset: 2px; }
  `;

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="header">
      <div class="title">
        <span>Chesscheat</span>
        <span class="spinner" id="cc-spinner" aria-hidden="true"></span>
        <span class="hint" id="cc-hint"></span>
      </div>
    </div>
    <div class="body" id="cc-body">
      <div class="row">
        <div class="label">Depth</div>
        <div class="value"><span id="cc-depth-value">15</span></div>
      </div>
      <div
        class="slider"
        id="cc-depth"
        role="slider"
        aria-label="Depth"
        aria-valuemin="1"
        aria-valuemax="40"
        aria-valuenow="15"
        tabindex="0"
      >
        <div class="sliderTrack">
          <div class="sliderFill" id="cc-depth-fill"></div>
        </div>
        <div class="sliderThumb" id="cc-depth-thumb"></div>
      </div>
      <div class="actions">
        <button class="primary" id="cc-toggle" type="button">Start</button>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  document.documentElement.appendChild(host);

  const depthEl = shadow.getElementById("cc-depth");
  const depthValEl = shadow.getElementById("cc-depth-value");
  const depthFillEl = shadow.getElementById("cc-depth-fill");
  const depthThumbEl = shadow.getElementById("cc-depth-thumb");
  const spinnerEl = shadow.getElementById("cc-spinner");
  const hintEl = shadow.getElementById("cc-hint");
  const toggleBtn = shadow.getElementById("cc-toggle");
  const bodyEl = shadow.getElementById("cc-body");

  let lastMoveText = "";
  const setHint = (text) => {
    if (!hintEl) return;
    hintEl.textContent = text || "";
  };
  const setMove = (bestMove) => {
    lastMoveText = bestMove ? `Move: ${bestMove}` : "";
    // Only show move immediately if we're not currently loading.
    if (!spinnerEl?.classList.contains("on")) setHint(lastMoveText);
  };
  const setLoading = (isLoading) => {
    if (!spinnerEl) return;
    spinnerEl.classList.toggle("on", Boolean(isLoading));
    if (isLoading) {
      setHint("Loading…");
    } else {
      setHint(lastMoveText);
    }
  };
  const syncDepth = (value) => {
    globalDepth = clampInt(value, 1, 40, globalDepth);
    depthValEl.textContent = String(globalDepth);
    const pct = ((globalDepth - 1) / (40 - 1)) * 100;
    if (depthFillEl) depthFillEl.style.width = `${pct}%`;
    if (depthThumbEl) depthThumbEl.style.left = `${pct}%`;
    if (depthEl) depthEl.setAttribute("aria-valuenow", String(globalDepth));
  };

  syncDepth(globalDepth);

  function updateDepthFromClientX(clientX) {
    const rect = depthEl.getBoundingClientRect();
    const x = Math.min(rect.right, Math.max(rect.left, clientX));
    const t = rect.width <= 1 ? 0 : (x - rect.left) / rect.width;
    const raw = 1 + t * (40 - 1);
    const snapped = Math.round(raw);
    syncDepth(snapped);
  }

  function onPointerDown(e) {
    depthEl.setPointerCapture?.(e.pointerId);
    updateDepthFromClientX(e.clientX);
  }
  function onPointerMove(e) {
    if (!depthEl.hasPointerCapture?.(e.pointerId)) return;
    updateDepthFromClientX(e.clientX);
  }
  function onPointerUp(e) {
    if (depthEl.hasPointerCapture?.(e.pointerId)) depthEl.releasePointerCapture?.(e.pointerId);
  }

  depthEl.addEventListener("pointerdown", onPointerDown);
  depthEl.addEventListener("pointermove", onPointerMove);
  depthEl.addEventListener("pointerup", onPointerUp);
  depthEl.addEventListener("pointercancel", onPointerUp);

  depthEl.addEventListener("keydown", (e) => {
    const key = e.key;
    if (key === "ArrowLeft" || key === "ArrowDown") {
      e.preventDefault();
      syncDepth(globalDepth - 1);
    } else if (key === "ArrowRight" || key === "ArrowUp") {
      e.preventDefault();
      syncDepth(globalDepth + 1);
    } else if (key === "Home") {
      e.preventDefault();
      syncDepth(1);
    } else if (key === "End") {
      e.preventDefault();
      syncDepth(40);
    }
  });

  toggleBtn.addEventListener("click", () => {
    if (!hackRunning) {
      setLoading(true);
      toggleBtn.disabled = true;
      toggleBtn.textContent = "Start";
      const result = startHack({
        setLoading,
        setHint,
        setToggleText: (t) => (toggleBtn.textContent = t),
        setToggleDisabled: (d) => (toggleBtn.disabled = d),
      });
      if (result?.status !== true) {
        setLoading(false);
        setHint("");
        toggleBtn.textContent = "Start";
        toggleBtn.disabled = false;
      }
      return;
    }

    // If already running, clicking toggles off.
    stopHack({ setLoading, setToggleText: (t) => (toggleBtn.textContent = t) });
  });

  return {
    setLoading,
    setHint,
    setMove,
    setToggleText: (t) => (toggleBtn.textContent = t),
    setToggleDisabled: (d) => (toggleBtn.disabled = d),
  };
}

let ui = null;
let engine = null;
let getPlays = null;

const CC_ARROW_ANCHOR_CLASS = "cheat-anchor";

function stopHack(uiApi) {
  if (getPlays) clearInterval(getPlays);
  getPlays = null;
  if (engine) engine.terminate?.();
  engine = null;
  lastBestMove = "";
  lastSuggestedUci = "";
  automoveEnabled = false;
  document.querySelectorAll(".cheat-highlight").forEach((element) => element.remove());
  document.querySelectorAll(`.${CC_ARROW_ANCHOR_CLASS}`).forEach((element) => element.remove());
  hackRunning = false;
  if (uiApi) {
    uiApi.setLoading?.(false);
    uiApi.setHint?.("");
    uiApi.setToggleText("Start");
  }
  return { status: true };
}

function main() {
  let chessboard = document.querySelector("wc-chess-board");
  if (!chessboard) {
    return { status: false, error: "Couldn't find chessboard. Open a live game on chess.com first." };
  }
  const getMyColour = () => (chessboard.classList.contains("flipped") ? "b" : "w");

  //generate FEN string from board,
  function getFenString() {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
    const pieces = chessboard.querySelectorAll(".piece");
    for (const p of pieces) {
      if (!(p instanceof HTMLElement)) continue;
      const classes = Array.from(p.classList);
      const squareClass = classes.find((c) => c.startsWith("square-"));
      if (!squareClass) continue;
      const sq = squareClass.slice("square-".length);
      if (sq.length < 2) continue;
      const file = Number.parseInt(sq[0], 10);
      const rank = Number.parseInt(sq[1], 10);
      if (!Number.isFinite(file) || !Number.isFinite(rank)) continue;
      if (file < 1 || file > 8 || rank < 1 || rank > 8) continue;

      const code = classes.find((c) => c.length === 2);
      if (!code) continue;
      const fenChar = code[0] === "w" ? code[1].toUpperCase() : code[1];
      board[8 - rank][file - 1] = fenChar;
    }

    let fen = "";
    for (let r = 0; r < 8; r++) {
      if (r > 0) fen += "/";
      let empties = 0;
      for (let f = 0; f < 8; f++) {
        const v = board[r][f];
        if (!v) {
          empties++;
        } else {
          if (empties) fen += String(empties);
          empties = 0;
          fen += v;
        }
      }
      if (empties) fen += String(empties);
    }
    return fen;
  }

  function isProbablyPlacementOnlyFen(firstField) {
    return /^[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+\/[pnbrqkPNBRQK1-8]+$/.test(
      firstField || "",
    );
  }

  function tryParseValidatedFullFen(raw) {
    const s = (raw || "").trim();
    if (!s) return null;
    const parts = s.split(/\s+/);
    if (parts.length < 2) return null;
    if (!isProbablyPlacementOnlyFen(parts[0])) return null;
    if (parts[1] !== "w" && parts[1] !== "b") return null;
    // Minimal Stockfish compatibility: ensure 6 fields exist.
    if (parts.length === 2) return `${parts[0]} ${parts[1]} - - 0 1`;
    if (parts.length === 3) return `${parts[0]} ${parts[1]} ${parts[2]} - 0 1`;
    if (parts.length === 4) return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} 0 1`;
    if (parts.length === 5) return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]} 1`;
    return s;
  }

  function collectFenCandidates() {
    const candidates = [];
    const push = (v) => {
      if (typeof v === "string") {
        const t = v.trim();
        if (t) candidates.push(t);
      }
    };

    try {
      push(chessboard.fen);
    } catch {
      // ignore
    }
    try {
      push(chessboard.game?.fen);
      push(chessboard.board?.fen);
      push(chessboard.chessboard?.fen);
    } catch {
      // ignore
    }

    push(chessboard.getAttribute?.("fen"));
    push(chessboard.getAttribute?.("data-fen"));
    push(chessboard.getAttribute?.("position"));

    return candidates;
  }

  function readValidatedFullFenFromBoard() {
    for (const c of collectFenCandidates()) {
      const full = tryParseValidatedFullFen(c);
      if (full) return full;
    }
    return null;
  }

  function getClockSideToMove() {
    const el = document.querySelector(".clock-player-turn");
    if (!(el instanceof HTMLElement)) return "";
    if (el.classList.contains("clock-white") || el.closest?.(".clock-white")) return "w";
    if (el.classList.contains("clock-black") || el.closest?.(".clock-black")) return "b";
    // Some layouts embed color deeper; walk a little.
    const p = el.closest("[class*='clock-white'], [class*='clock-black']");
    if (p instanceof HTMLElement) {
      const cls = String(p.className || "");
      if (cls.includes("clock-white")) return "w";
      if (cls.includes("clock-black")) return "b";
    }
    return "";
  }

  function inferSideToMoveFromMoveListCount() {
    const nodes = document.querySelectorAll(".move-list-move");
    if (!nodes || !nodes.length) return "";
    // Each half-move typically adds a node; 0 moves => white to move.
    return nodes.length % 2 === 0 ? "w" : "b";
  }

  function isStandardStartPlacement(placement) {
    return (
      placement ===
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
    );
  }

  function getSideToMoveHintForPlacement(placement) {
    const full = readValidatedFullFenFromBoard();
    if (full) {
      const stm = full.split(/\s+/)[1];
      return { stm, confident: true, full };
    }

    const clock = getClockSideToMove();
    if (clock) return { stm: clock, confident: true, full: null };

    const ml = inferSideToMoveFromMoveListCount();
    // When the move list rendered, side-to-move parity is usually reliable on chess.com.
    if (ml) return { stm: ml, confident: true, full: null };

    if (isStandardStartPlacement(placement)) {
      return { stm: "w", confident: true, full: null };
    }

    // Unknown side-to-move: still run analysis, but don't hard-block the extension.
    return { stm: "w", confident: false, full: null };
  }

  function getStockfishFenFromPlacement(placement) {
    const hint = getSideToMoveHintForPlacement(placement);
    if (hint.full) return hint.full;
    return `${placement} ${hint.stm} - - 0 1`;
  }

  function getTurnInfo() {
    const placement = getFenString();
    const hint = getSideToMoveHintForPlacement(placement);
    const my = getMyColour();
    const result = !hint.confident
      ? { myTurn: true, confident: false, stm: hint.stm }
      : { myTurn: hint.stm === my, confident: true, stm: hint.stm };

    return result;
  }

  function isMyTurn() {
    return getTurnInfo().myTurn;
  }

  function getOrCreateAnchor(which) {
    const id = `cc-anchor-${which}`;
    let anchor = chessboard.querySelector(`:scope > div#${id}.${CC_ARROW_ANCHOR_CLASS}`);
    if (anchor && anchor.closest("wc-chess-board") !== chessboard) anchor = null;
    if (anchor && !document.contains(anchor)) anchor = null;
    if (anchor) return anchor;

    anchor = document.createElement("div");
    anchor.id = id;
    // Use chess.com highlight positioning so `square-XY` does the work.
    anchor.className = `highlight ${CC_ARROW_ANCHOR_CLASS}`;
    anchor.style.background = "transparent";
    anchor.style.opacity = "0";
    anchor.style.pointerEvents = "none";
    chessboard.appendChild(anchor);
    return anchor;
  }

  function setAnchorSquare(anchor, squarePosition) {
    // Remove any prior square-* class then apply the new one.
    Array.from(anchor.classList).forEach((c) => {
      if (c.startsWith("square-")) anchor.classList.remove(c);
    });
    anchor.classList.add(`square-${squarePosition}`);
  }

  function getCenterClientPoint(el) {
    const elRect = el.getBoundingClientRect();
    const x = (elRect.left + elRect.right) / 2;
    const y = (elRect.top + elRect.bottom) / 2;
    return { x, y };
  }

  function dispatchMouseLikeEvent(type, target, point, button) {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: point.x,
        clientY: point.y,
        button,
        buttons: button === 2 ? 2 : 1,
      }),
    );
  }

  function dispatchPointerLikeEvent(type, target, point, button) {
    try {
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          clientX: point.x,
          clientY: point.y,
          button,
          buttons: button === 2 ? 2 : 1,
        }),
      );
    } catch {
      // Some environments disallow PointerEvent construction; mouse events still help.
    }
  }

  function elementAt(point) {
    return document.elementFromPoint(point.x, point.y) || chessboard;
  }

  function drawChessComBuiltInArrow(fromSquare, toSquare) {
    const aFrom = getOrCreateAnchor("from");
    const aTo = getOrCreateAnchor("to");
    setAnchorSquare(aFrom, fromSquare);
    setAnchorSquare(aTo, toSquare);

    const fromPt = getCenterClientPoint(aFrom);
    const toPt = getCenterClientPoint(aTo);

    const fromEl = elementAt(fromPt);
    const toEl = elementAt(toPt);

    // Simulate chess.com right-click drag arrow gesture.
    dispatchPointerLikeEvent("pointerdown", fromEl, fromPt, 2);
    dispatchMouseLikeEvent("mousedown", fromEl, fromPt, 2);

    dispatchPointerLikeEvent("pointermove", toEl, toPt, 2);
    dispatchMouseLikeEvent("mousemove", toEl, toPt, 2);

    dispatchPointerLikeEvent("pointerup", toEl, toPt, 2);
    dispatchMouseLikeEvent("mouseup", toEl, toPt, 2);
  }

  function doSuggestedMoveUci(uciMove) {
    const move = (uciMove || "").trim();
    if (move.length < 4 || move === "(none)") return false;
    const fileMap = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
    const arr = move.split("");
    const fromSquare = `${fileMap[arr[0]]}${arr[1]}`;
    const toSquare = `${fileMap[arr[2]]}${arr[3]}`;

    const aFrom = getOrCreateAnchor("from");
    const aTo = getOrCreateAnchor("to");
    setAnchorSquare(aFrom, fromSquare);
    setAnchorSquare(aTo, toSquare);

    const fromPt = getCenterClientPoint(aFrom);
    const toPt = getCenterClientPoint(aTo);
    const fromEl = elementAt(fromPt);
    const toEl = elementAt(toPt);

    // Simulate a normal left-click drag move (matches how users move pieces).
    dispatchPointerLikeEvent("pointerdown", fromEl, fromPt, 0);
    dispatchMouseLikeEvent("mousedown", fromEl, fromPt, 0);
    dispatchPointerLikeEvent("pointermove", toEl, toPt, 0);
    dispatchMouseLikeEvent("mousemove", toEl, toPt, 0);
    dispatchPointerLikeEvent("pointerup", toEl, toPt, 0);
    dispatchMouseLikeEvent("mouseup", toEl, toPt, 0);
    // Some chess.com boards also rely on click events for selection.
    dispatchMouseLikeEvent("click", fromEl, fromPt, 0);
    dispatchMouseLikeEvent("click", toEl, toPt, 0);
    return true;
  }

  function tryPlayAutomove(uci) {
    if (!hackRunning || !automoveEnabled) return;
    const m = (uci || "").trim();
    if (m.length < 4 || m === "(none)") return;
    if (!document.contains(chessboard)) {
      const nextBoard = document.querySelector("wc-chess-board");
      if (!nextBoard) return;
      chessboard = nextBoard;
    }
    doSuggestedMoveUci(m);
  }

  /**
   * Engine `bestmove` runs outside a user gesture; a short deferral avoids stacking with draw/layout.
   * Do NOT use this for the `A` key — play synchronously there so transient user activation matches `N`.
   */
  function queueAutomove(uci) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        tryPlayAutomove(uci);
      }, 0);
    });
  }

  function onGlobalKeydown(e) {
    if (!hackRunning) return;
    if (e.defaultPrevented) return;
    const t = e.target;
    if (t instanceof HTMLElement) {
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
    }
    if (e.key === "a" || e.key === "A") {
      e.preventDefault();
      automoveEnabled = !automoveEnabled;
      if (automoveEnabled) {
        const pendingUci = lastBestMove;
        ui?.setHint?.(pendingUci ? `Auto · Move: ${pendingUci}` : "Auto");
        if (pendingUci) {
          if (!document.contains(chessboard)) {
            const nextBoard = document.querySelector("wc-chess-board");
            if (nextBoard) chessboard = nextBoard;
          }
          removeChessComDrawnArrows();
          tryPlayAutomove(pendingUci);
        }
      } else {
        ui?.setMove?.(lastBestMove || "");
      }
      return;
    }
    if (e.key === "n" || e.key === "N") {
      if (!lastBestMove) return;
      if (!document.contains(chessboard)) {
        const nextBoard = document.querySelector("wc-chess-board");
        if (!nextBoard) return;
        chessboard = nextBoard;
      }
      e.preventDefault();
      doSuggestedMoveUci(lastBestMove);
    }
  }

  document.addEventListener("keydown", onGlobalKeydown, { capture: true });

  function pieceCodeOnSquare(squareNum) {
    const el = chessboard.querySelector(`.piece.square-${squareNum}`);
    if (!(el instanceof HTMLElement)) return null;
    return Array.from(el.classList).find((c) => c.length === 2) || null;
  }

  function uciStillMatchesBoard(uci) {
    const m = (uci || "").trim();
    if (m.length < 4) return false;
    const fileMap = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
    const fromSq = `${fileMap[m[0]]}${m[1]}`;
    const toSq = `${fileMap[m[2]]}${m[3]}`;
    const fromPiece = pieceCodeOnSquare(fromSq);
    const toPiece = pieceCodeOnSquare(toSq);
    if (!fromPiece) return false;
    // After the suggested move, the moving piece should be on `to` with same color/type.
    return toPiece === fromPiece;
  }

  function uciFromSquareNum(uci) {
    const m = (uci || "").trim();
    if (m.length < 4) return "";
    const fileMap = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
    return `${fileMap[m[0]]}${m[1]}`;
  }

  function removeChessComDrawnArrows() {
    // chess.com user arrows are SVG elements; they commonly include `arrow` in class names.
    // This avoids dispatching Escape (which can interfere with premove UI).
    const root = document.contains(chessboard) ? chessboard : document.querySelector("wc-chess-board");
    if (!root) return;
    root.querySelectorAll("svg [class*='arrow'], svg .arrow, g[class*='arrow']").forEach((el) => {
      try {
        el.remove();
      } catch {
        // ignore
      }
    });
  }

  let fen_string = getStockfishFenFromPlacement(getFenString());
  /** Piece placement (first FEN field) when we last sent `go` — stale bestmoves must match this. */
  let placementAtGoStart = getFenString();
  engine = new Worker("/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js")
  // Try to get some early responsiveness signals from Stockfish.
  engine.postMessage("uci");
  engine.postMessage("isready");
  engine.postMessage(`position fen ${fen_string}`)
  engine.postMessage(`go depth ${globalDepth}`)

  // Move detection: observe board DOM changes rather than polling every 250ms.
  let pending = 0;
  let suppressAnalysisMyTurn = false;
  let baselinePlacementFen = getFenString();
  let prevIsMyTurn = getTurnInfo().myTurn;
  let suppressSnapshotPlacement = "";
  /** After we play a suggested move, the board may not expose reliable clocks; freeze until pieces change again. */
  let awaitingOpponentReply = false;
  let placementAfterOurMove = "";
  const scheduleRecalc = () => {
    if (pending) window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      pending = 0;
      if (!document.contains(chessboard)) {
        const nextBoard = document.querySelector("wc-chess-board");
        if (!nextBoard) return;
        chessboard = nextBoard;
      }
      const placementNow = getFenString();

      if (awaitingOpponentReply) {
        if (placementNow === placementAfterOurMove) {
          removeChessComDrawnArrows();
          lastBestMove = "";
          lastSuggestedUci = "";
          try {
            engine.postMessage("stop");
          } catch {
            // ignore
          }
          if (ui) {
            ui.setLoading(false);
            ui.setMove?.("");
          }
          const silentFen = getStockfishFenFromPlacement(placementNow);
          if (silentFen !== fen_string) fen_string = silentFen;
          prevIsMyTurn = getTurnInfo().myTurn;
          return;
        }
        awaitingOpponentReply = false;
        placementAfterOurMove = "";
        suppressAnalysisMyTurn = false;
        lastSuggestedUci = "";
        lastBestMove = "";
        removeChessComDrawnArrows();
        baselinePlacementFen = placementNow;
      }

      const turn = getTurnInfo();
      const myTurnNow = turn.myTurn;
      if (turn.confident && myTurnNow !== prevIsMyTurn) {
        // New turn phase: reset suppression baseline.
        suppressAnalysisMyTurn = false;
        awaitingOpponentReply = false;
        placementAfterOurMove = "";
        baselinePlacementFen = getFenString();
        prevIsMyTurn = myTurnNow;
      }

      const opponentTurn = turn.confident && !myTurnNow;

      // We already executed the suggested move (piece left the `from` square): wait for opponent
      // before any new analysis, even if clocks / move-list turn hints are flaky.
      if (
        !awaitingOpponentReply &&
        suppressAnalysisMyTurn &&
        (lastSuggestedUci || "").trim().length >= 4
      ) {
        const fromN = uciFromSquareNum(lastSuggestedUci);
        if (fromN && !pieceCodeOnSquare(fromN)) {
          awaitingOpponentReply = true;
          placementAfterOurMove = placementNow;
          suppressAnalysisMyTurn = false;
          lastBestMove = "";
          lastSuggestedUci = "";
          removeChessComDrawnArrows();
          try {
            engine.postMessage("stop");
          } catch {
            // ignore
          }
          if (ui) {
            ui.setLoading(false);
            ui.setMove?.("");
          }
          const silentFen = getStockfishFenFromPlacement(placementNow);
          if (silentFen !== fen_string) fen_string = silentFen;
          prevIsMyTurn = turn.myTurn;
          return;
        }
      }

      // If suppression is active, clear it when the board changes in a way that invalidates the
      // last suggested UCI match. This catches opponent replies even when clocks/move-list aren't scrapable.
      if (suppressAnalysisMyTurn) {
        const placementChanged = Boolean(suppressSnapshotPlacement) && placementNow !== suppressSnapshotPlacement;
        const uci = (lastSuggestedUci || "").trim();
        const mismatch =
          placementChanged &&
          uci.length >= 4 &&
          !uciStillMatchesBoard(uci);
        if (mismatch) {
          suppressAnalysisMyTurn = false;
          lastSuggestedUci = "";
          baselinePlacementFen = placementNow;
        }
      }

      // If it's not our turn, board DOM can still change due to premove UI.
      // Still update `fen_string` silently so that when it becomes our turn again,
      // `nextFen !== fen_string` and we actually schedule a new search.
      if (opponentTurn) {
        awaitingOpponentReply = false;
        placementAfterOurMove = "";
        removeChessComDrawnArrows();
        lastBestMove = "";
        lastSuggestedUci = "";
        try {
          engine.postMessage("stop");
        } catch {
          // ignore
        }
        if (ui) {
          ui.setLoading(false);
          ui.setMove?.("");
        }
        const silentFen = getStockfishFenFromPlacement(placementNow);
        if (silentFen !== fen_string) fen_string = silentFen;
        return;
      }

      const suggestedFromSq = lastSuggestedUci ? uciFromSquareNum(lastSuggestedUci) : "";
      const suggestedFromEmpty = Boolean(suggestedFromSq) && !pieceCodeOnSquare(suggestedFromSq);
      if (
        suppressAnalysisMyTurn &&
        placementNow !== baselinePlacementFen &&
        lastSuggestedUci &&
        suggestedFromEmpty &&
        !uciStillMatchesBoard(lastSuggestedUci)
      ) {
        // User changed the board on their turn after we showed a suggestion (e.g. they moved).
        // Don't keep re-analyzing / re-drawing until opponent replies.
        removeChessComDrawnArrows();
        lastBestMove = "";
        lastSuggestedUci = "";
        try {
          engine.postMessage("stop");
        } catch {
          // ignore
        }
        if (ui) {
          ui.setLoading(false);
          ui.setMove?.("");
        }
        return;
      }

      const nextFen = getStockfishFenFromPlacement(placementNow);
      if (nextFen === fen_string) return;
      if (suppressAnalysisMyTurn) {
        return;
      }
      fen_string = nextFen;
      baselinePlacementFen = placementNow;
      placementAtGoStart = placementNow;
      engine.postMessage(`position fen ${fen_string}`);
      if (ui) ui.setLoading(true);
      engine.postMessage(`go depth ${globalDepth}`);
    }, 120);
  };

  const observer = new MutationObserver((mutations) => {
    // Only react to changes that plausibly move/add/remove pieces.
    for (const m of mutations) {
      if (m.type === "attributes") {
        const t = m.target;
        if (t instanceof HTMLElement && t.classList.contains("piece")) {
          scheduleRecalc();
          return;
        }
        continue;
      }
      if (m.type === "childList") {
        const nodes = [...m.addedNodes, ...m.removedNodes];
        for (const n of nodes) {
          if (!(n instanceof HTMLElement)) continue;
          if (n.classList?.contains("piece") || n.querySelector?.(".piece")) {
            scheduleRecalc();
            return;
          }
        }
      }
    }
  });
  observer.observe(chessboard, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  // Fallback: periodic check in case chess.com mutates outside observed subtree.
  getPlays = setInterval(scheduleRecalc, 5000);
  engine.onmessage = function(event) {
    if (typeof event.data === "string") {
      if (event.data === "uciok" || event.data === "readyok") {
        // Keep UI minimal; spinner indicates activity.
      } else if (event.data.startsWith("info ")) {
        // Ignore depth/progress updates (user wants minimal UI).
      }
    }
    if (event.data.startsWith('bestmove')) {
      const bestMove = event.data.split(' ')[1];
      // Use the best move in your application
      char_map = { "a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7, "h": 8 }
      const move = (bestMove || "").trim();
      const placementNow = getFenString();
      if (move.length >= 4 && move !== "(none)" && placementNow !== placementAtGoStart) {
        // Board changed while Stockfish was thinking — do not apply a stale line.
        return;
      }
      lastBestMove = move;
      const turnNow = getTurnInfo();
      if (turnNow.confident && !turnNow.myTurn) {
        // Ignore results when we're confident it's not our turn.
        lastBestMove = "";
        return;
      }
      if (awaitingOpponentReply) {
        lastBestMove = "";
        return;
      }
      if (suppressAnalysisMyTurn) {
        lastBestMove = "";
        return;
      }
      const fromSqNum =
        move.length >= 4 && move !== "(none)" ? uciFromSquareNum(move) : "";
      if (fromSqNum && !pieceCodeOnSquare(fromSqNum)) {
        // Suggestion no longer legal on the live board (e.g. user moved during calculation).
        lastBestMove = "";
        return;
      }
      if (ui) {
        ui.setLoading(false);
        ui.setToggleText("Stop");
        ui.setMove?.(move);
        if (automoveEnabled) {
          ui.setHint?.(`Auto · Move: ${move}`);
        }
      }

      // Draw chess.com-like arrow overlay for the best move.
      if (!document.contains(chessboard)) {
        const nextBoard = document.querySelector("wc-chess-board");
        if (!nextBoard) return;
        chessboard = nextBoard;
      }
      document.querySelectorAll(".cheat-highlight").forEach((element) => element.remove());
      if (move.length < 4 || move === "(none)") return;
      const bestMove_array = move.split("");
      const initial_position = `${char_map[bestMove_array[0]]}${bestMove_array[1]}`;
      const final_position = `${char_map[bestMove_array[2]]}${bestMove_array[3]}`;
      if (!automoveEnabled) {
        drawChessComBuiltInArrow(initial_position, final_position);
      }
      lastSuggestedUci = move;
      suppressAnalysisMyTurn = true;
      baselinePlacementFen = getFenString();
      suppressSnapshotPlacement = baselinePlacementFen;
      if (automoveEnabled) {
        queueAutomove(move);
      }
    }
  }
  return { status: true }

}

function startHack(uiApi) {
  if (hackRunning == true) {
    return;
  }
  hackRunning = true;
  ui = uiApi || ui;
  // Allow passing state through the UI API object.
  if (ui && ui.lastMoveText === undefined) ui.lastMoveText = "";
  ui?.setToggleText("Starting…");
  ui?.setToggleDisabled(true);
  ui?.setLoading?.(true);
  ui?.setHint?.("");
  //wait until chessboard content is probably loaded
  let hack = main()
  if (hack.status == true) {
    ui?.setToggleDisabled(false);
    ui?.setToggleText("Stop");
  }
  else {
    hackRunning = false;
    ui?.setToggleText("Start");
    ui?.setToggleDisabled(false);
    ui?.setLoading?.(false);
    ui?.setHint?.("");
    return { status: false, error: hack.error };
  }
  return { status: true };
}

// Mount UI on every chess.com page; it will only start when user clicks Start.
createUI();
