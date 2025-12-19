// --- CONFIGURATION AND GLOBAL VARIABLES ---
var hackRunning = false;
var globalDepth = 15; // KEEP A VALUE BETWEEN 10-18 FOR GOOD RESULTS
var currentFen = "";
var engine = new Worker("/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js");
var observer = null;

// Engine Configuration
engine.postMessage("uci");
engine.postMessage("setoption name Threads value 4"); // THREADS FOR BETTER PERFORMANCE
engine.postMessage("setoption name Hash value 64");
engine.postMessage("isready");

const charMap = { "a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7, "h": 8 };

// --- HELPER FUNCTIONS ---

function getFenString() {
    let fen = "";
    for (var i = 8; i >= 1; i--) {
        let empty = 0;
        for (var j = 1; j <= 8; j++) {
            let position = `${j}${i}`;
            let square = document.querySelector(`.piece.square-${position}`);
            
            let pieceCode = null;
            if (square && square.classList) {
                for (let cls of square.classList) {
                    if (cls.length === 2 && /^[wb][prnbqk]$/.test(cls)) {
                        pieceCode = cls;
                        break;
                    }
                }
            }
            if (!pieceCode) {
                empty++;
            } else {
                if (empty > 0) {
                    fen += empty;
                    empty = 0;
                }
                let color = pieceCode[0];
                let type = pieceCode[1];
                fen += (color === "w") ? type.toUpperCase() : type;
            }
        }
        if (empty > 0) fen += empty;
        if (i > 1) fen += "/";
    }
    return fen;
}

function analyzePosition() {
    if (!hackRunning) return;

    const chessboard = document.querySelector("wc-chess-board");
    if (!chessboard) return;

    let playerColor = chessboard.classList.contains("flipped") ? "b" : "w";
    let fen = getFenString();
    fen += ` ${playerColor} - - 0 1`;

    if (fen !== currentFen) {
        currentFen = fen;
        removeHighlights();
        
        // Reset Text UI
        updateInfoUI("Calculating...", "...");
        
        engine.postMessage("stop");
        engine.postMessage(`position fen ${fen}`);
        engine.postMessage(`go depth ${globalDepth}`);
    }
}

function removeHighlights() {
    document.querySelectorAll(".cheat-highlight").forEach(el => el.remove());
}

function drawBestMove(bestMove) {
    if (!hackRunning || !bestMove) return;

    const chessboard = document.querySelector("wc-chess-board");
    if (!chessboard) return;

    removeHighlights();

    let fromFile = charMap[bestMove[0]];
    let fromRank = bestMove[1];
    let toFile = charMap[bestMove[2]];
    let toRank = bestMove[3];

    let fromSq = `${fromFile}${fromRank}`;
    let toSq = `${toFile}${toRank}`;

    const createDiv = (sq) => {
        let d = document.createElement("div");
        d.className = `highlight cheat-highlight square-${sq}`;
        d.style.backgroundColor = "rgba(0, 255, 0, 0.5)"; // Green
        return d;
    };

    chessboard.appendChild(createDiv(fromSq));
    chessboard.appendChild(createDiv(toSq));
}

// Update the Button and a new Score label
function updateInfoUI(moveText, scoreText) {
    let btn = document.getElementById("hack_button");
    let scoreLbl = document.getElementById("hack_score");
    
    if(btn) btn.innerHTML = moveText;
    if(scoreLbl && scoreText) scoreLbl.innerHTML = scoreText;
}

// --- ENGINE LISTENER (With Score Parsing) ---

engine.onmessage = function(event) {
    let msg = event.data;
    
    // 1. Parse Score (Evaluation)
    if (msg.startsWith("info") && msg.includes("score")) {
        let scoreDisplay = "";
        
        // Check for Mate
        if (msg.includes("mate")) {
            let mateMatch = msg.match(/mate (-?\d+)/);
            if (mateMatch) scoreDisplay = `Mate in ${mateMatch[1]}`;
        } 
        // Check for Centipawns (cp)
        else if (msg.includes("cp")) {
            let cpMatch = msg.match(/cp (-?\d+)/);
            if (cpMatch) {
                let score = parseInt(cpMatch[1]) / 100;
                scoreDisplay = (score > 0 ? "+" : "") + score.toFixed(2);
            }
        }
        
        if (scoreDisplay) updateInfoUI(null, `Eval: ${scoreDisplay}`);
    }

    // 2. Parse Best Move
    if (msg.startsWith("bestmove")) {
        let move = msg.split(" ")[1];
        if (move && move !== "(none)") {
            drawBestMove(move);
            updateInfoUI(`Best: ${move}`, null);
        }
    }
};

// --- CONTROLS AND UI ---

function toggleHack(btn) {
    if (hackRunning) {
        // STOP
        hackRunning = false;
        
        // Disconnect Observer
        if(observer) observer.disconnect();
        
        engine.postMessage("stop");
        removeHighlights();
        
        btn.innerHTML = "Start Hack";
        btn.style.background = "";
        btn.style.color = "";
        if(document.getElementById("hack_score")) document.getElementById("hack_score").innerHTML = "";
    } else {
        // START
        hackRunning = true;
        currentFen = ""; 
        
        btn.innerHTML = "Init...";
        btn.style.background = "#2b8a3e";
        btn.style.color = "white";
        
        // 1. Analyze immediately
        analyzePosition();
        
        // 2. Setup MutationObserver (Replaces setInterval)
        const boardElement = document.querySelector("wc-chess-board");
        if(boardElement) {
            observer = new MutationObserver((mutations) => {
                // Determine if relevant DOM changes occurred
                let shouldUpdate = false;
                for (let mutation of mutations) {
                    // We care about attributes (classes changing on squares) or childList (pieces moving)
                    if (mutation.type === 'attributes' || mutation.type === 'childList') {
                        shouldUpdate = true;
                        break;
                    }
                }
                if(shouldUpdate) analyzePosition();
            });
            
            // Watch for changes in the entire subtree of the board
            observer.observe(boardElement, { 
                attributes: true, 
                childList: true, 
                subtree: true 
            });
        } else {
            alert("Board not found! Are you in a game?");
            hackRunning = false;
        }
    }
}

function initUI() {
    if(document.getElementById("hack_ui_container")) document.getElementById("hack_ui_container").remove();

    let container = document.createElement("div");
    container.id = "hack_ui_container";
    container.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom:10px; padding: 5px;";

    let input = document.createElement("input");
    input.type = "number";
    input.value = globalDepth;
    input.min = 8;
    input.max = 25;
    input.style.cssText = "width: 50px; padding: 5px; border-radius: 4px; border: 1px solid #ccc;";
    input.onchange = (e) => { globalDepth = parseInt(e.target.value); };

    let btn = document.createElement("button");
    btn.id = "hack_button";
    btn.innerHTML = "Start Hack";
    btn.className = "ui_v5-button-component ui_v5-button-primary";
    btn.style.cssText = "flex-grow: 1; font-weight: bold;"; 
    btn.onclick = () => toggleHack(btn);
    
    // New Label for Score
    let scoreLbl = document.createElement("span");
    scoreLbl.id = "hack_score";
    scoreLbl.style.cssText = "color: #fff; font-weight: bold; min-width: 80px; text-align: right;";
    scoreLbl.innerHTML = "";

    container.appendChild(input);
    container.appendChild(btn);
    container.appendChild(scoreLbl);

    let main = document.querySelector(".board-layout-main");
    if (main) {
        main.prepend(container);
    }
}

initUI();
