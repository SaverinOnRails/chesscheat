//this is quite possibly the most disgusting piece of code i've ever written.
var hackRunning = false;
var globalDepth = 15;

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

function stopHack(uiApi) {
  if (getPlays) clearInterval(getPlays);
  getPlays = null;
  if (engine) engine.terminate?.();
  engine = null;
  document.querySelectorAll(".cheat-highlight").forEach((element) => element.remove());
  hackRunning = false;
  if (uiApi) {
    uiApi.setLoading?.(false);
    uiApi.setHint?.("");
    uiApi.setToggleText("Start");
  }
  return { status: true };
}

function main() {
  const chessboard = document.querySelector("wc-chess-board");
  if (!chessboard) {
    return { status: false, error: "Couldn't find chessboard. Open a live game on chess.com first." };
  }
  var player_colour = chessboard.classList.contains("flipped") ? "b" : "w";
  //generate FEN string from board,
  function getFenString() {
    let fen_string = ""
    for (var i = 8; i >= 1; i--) {
      for (var j = 1; j <= 8; j++) {
        let position = `${j}${i}`
        //for every new row on the chessboard
        if (j == 1 && i != 8) {
          fen_string += "/"
        }
        let piece_in_position = document.querySelectorAll(`.piece.square-${position}`)[0]?.classList ?? null
        //get piece name by shortest class
        if (piece_in_position != null) {
          for (var item of piece_in_position.values()) {
            if (item.length == 2) {
              piece_in_position = item
            }
          }
        }
        //if position is empty
        if (piece_in_position == null) {
          //if previous position is empty, sum up numbers
          let previous_char = fen_string.split("").pop()
          if (!isNaN(Number(previous_char))) {
            fen_string = fen_string.substring(0, fen_string.length - 1)
            fen_string += Number(previous_char) + 1
          }
          else {
            fen_string += "1"
          }
        }
        else if (piece_in_position?.split("")[0] == "b") {
          fen_string += piece_in_position.split("")[1]
        }
        else if (piece_in_position?.split("")[0] == "w") {
          fen_string += piece_in_position.split("")[1].toUpperCase()
        }

      }
    }
    return fen_string
  }
  let fen_string = getFenString()
  fen_string += ` ${player_colour}`
  console.log(fen_string)
  engine = new Worker("/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js")
  // Try to get some early responsiveness signals from Stockfish.
  engine.postMessage("uci");
  engine.postMessage("isready");
  engine.postMessage(`position fen ${fen_string}`)
  engine.postMessage("go wtime 300000 btime 300000 winc 2000 binc 2000");
  engine.postMessage(`go depth ${globalDepth}`)
  //listen for when moves are made 
  getPlays = setInterval(() => {
    let new_fen_string = getFenString()
    new_fen_string += ` ${player_colour}`
    if (new_fen_string != fen_string) {
      fen_string = new_fen_string
      engine.postMessage(`position fen ${fen_string}`)
      engine.postMessage("go wtime 300000 btime 300000 winc 2000 binc 2000");
      console.log(globalDepth);
      if (ui) {
        ui.setLoading(true);
      }
      engine.postMessage(`go depth ${globalDepth}`)
    }
  }, 250)
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
      console.log('Best move:', bestMove);
      if (ui) {
        ui.setLoading(false);
        ui.setToggleText("Stop");
        ui.setMove?.(bestMove);
      }
      //create cheat squares on the board
      previous_cheat_squares = document.querySelectorAll(".cheat-highlight").forEach((element) => {
        //remove all previous cheat squares
        element.remove()
      })
      bestMove_array = bestMove.split("")
      initial_position = `${char_map[bestMove_array[0]]}${bestMove_array[1]}`
      final_position = `${char_map[bestMove_array[2]]}${bestMove_array[3]}`

      initial_highlight = document.createElement("div");
      initial_highlight.className = `highlight cheat-highlight square-${initial_position}`
      initial_highlight.style = "background:red;opacity:0.5"

      final_highlight = document.createElement("div");
      final_highlight.className = `highlight cheat-highlight square-${final_position}`
      final_highlight.style = "background:red;opacity:0.5"
      chessboard.appendChild(initial_highlight)
      chessboard.appendChild(final_highlight)
    }
  }
  return { status: true }

}

function startHack(uiApi) {
  console.log(hackRunning);
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
