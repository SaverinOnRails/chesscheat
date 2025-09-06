//this is quite possibly the most disgusting piece of code i've ever written.
var hackRunning = false;
var globalDepth = 15;
function main() {
  const chessboard = document.querySelector("wc-chess-board");
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
  const engine = new Worker("/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js")
  engine.postMessage(`position fen ${fen_string}`)
  engine.postMessage('go wtime 300000 btime 300000 winc 2000 binc 2000');
  engine.postMessage("go depth ${globalDepth}")
  //listen for when moves are made 
  var getPlays = setInterval(() => {
    let new_fen_string = getFenString()
    new_fen_string += ` ${player_colour}`
    if (new_fen_string != fen_string) {
      fen_string = new_fen_string
      engine.postMessage(`position fen ${fen_string}`)
      engine.postMessage('go wtime 300000 btime 300000 winc 2000 binc 2000');
      console.log(globalDepth);
      engine.postMessage("go depth ${globalDepth}")
    }
  })
  engine.onmessage = function(event) {
    if (event.data.startsWith('bestmove')) {
      const bestMove = event.data.split(' ')[1];
      // Use the best move in your application
      char_map = { "a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7, "h": 8 }
      console.log('Best move:', bestMove);
      document.getElementById("best-move").innerHTML = ` Bestmove is ${bestMove} at depth ${globalDepth}. Tap to stop`
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
  //try to stop hack
  document.getElementById("hack_button").onclick = () => {
    if (hackRunning == false) {
      startHack(document.getElementById("hack_button"));
      return;
    }
    //stop listening for moves effectively stoping stockfish
    clearInterval(getPlays);
    //delete all cheat squares
    document.querySelectorAll(".cheat-highlight").forEach((element) => {
      element.remove();
    });
    //set hackRunning to false;
    hackRunning = false;
    document.getElementById("hack_button").innerHTML = "Start Hack Again";
    return { status: "false" }

  }
  return { status: true }

}
function startHack(element) {
  console.log(hackRunning);
  if (hackRunning == true) {
    return;
  }
  hackRunning = true;
  element.innerHTML = "Please Wait.."
  element.disabled = true
  //wait until chessboard content is probably loaded
  let hack = main()
  if (hack.status == true) {
    element.disabled = false;
    element.innerHTML = `Hack running. <span id = 'best-move'>Calculating Best move. Tap to stop</span>`
  }
  else {
    element.innerHTML = "Start Hack"
    element.disabled = false
    alert(hack.error)
  }
}
var button = document.createElement("button");
var input = document.createElement("input");
input.value = globalDepth;
input.placeholder = "Depth, choose anywhere under 40. Very high values can cause your browser to leak and freeze."
button.className = "ui_v5-button-component ui_v5-button-primary ui_v5-button-large ui_v5-button-full"
button.innerHTML = "Start Hack"
input.addEventListener("input", function() {
  globalDepth = this.value; //i dont care
})
//start hack when button is clicked
button.id = "hack_button";
button.onclick = () => { startHack(button) }
let main_body = document.querySelector(".board-layout-main")
main_body.prepend(input);
main_body.prepend(button)
