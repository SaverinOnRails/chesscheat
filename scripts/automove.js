let autoMoveEnabled = false
let lastBestMove = null

function executeMove(from, to) {
    const board = document.querySelector('wc-chess-board')
    if (!board) return

    const fromSquare = board.querySelector(`.square-${from}`)
    const toSquare = board.querySelector(`.square-${to}`)
    
    if (!fromSquare || !toSquare) return

    const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0
    })

    const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0
    })

    fromSquare.dispatchEvent(mouseDownEvent)
    setTimeout(() => {
        toSquare.dispatchEvent(mouseUpEvent)
    }, 50)
}

function initAutoMove() {
    window.addEventListener('keydown', event => {
        if (event.key === 'Control') {
            autoMoveEnabled = !autoMoveEnabled
            const statusElement = document.getElementById('automove-status')
            if (statusElement) {
                statusElement.textContent = autoMoveEnabled ? 'AUTOMOVE ON' : 'AUTOMOVE OFF'
                statusElement.style.backgroundColor = autoMoveEnabled ? 'rgba(0,255,0,0.7)' : 'rgba(255,0,0,0.7)'
            }
        }
    })

    const statusDiv = document.createElement('div')
    statusDiv.id = 'automove-status'
    statusDiv.style.position = 'fixed'
    statusDiv.style.bottom = '20px'
    statusDiv.style.right = '20px'
    statusDiv.style.padding = '10px'
    statusDiv.style.background = 'rgba(255,0,0,0.7)'
    statusDiv.style.color = 'white'
    statusDiv.style.borderRadius = '5px'
    statusDiv.style.zIndex = '9999'
    statusDiv.textContent = 'AUTOMOVE OFF'
    document.body.appendChild(statusDiv)

    setInterval(checkBestMove, 100)
}

function checkBestMove() {
    if (!autoMoveEnabled || !window.hackRunning) return

    const bestMoveElement = document.getElementById('best-move')
    if (!bestMoveElement) return

    const bestMoveText = bestMoveElement.textContent
    const moveMatch = bestMoveText.match(/Bestmove is ([a-h][1-8][a-h][1-8])/)
    
    if (!moveMatch) return
    
    const currentMove = moveMatch[1]
    if (currentMove === lastBestMove) return
    
    lastBestMove = currentMove

    const charMap = {a:1, b:2, c:3, d:4, e:5, f:6, g:7, h:8}
    const from = `${charMap[currentMove[0]]}${currentMove[1]}`
    const to = `${charMap[currentMove[2]]}${currentMove[3]}`

    const moveDelay = Math.floor(Math.random() * (2000 - 800 + 1)) + 800
    
    setTimeout(() => {
        if (autoMoveEnabled && window.hackRunning) {
            executeMove(from, to)
        }
    }, moveDelay)
}

window.addEventListener('load', initAutoMove)

function updateEngineConfig() {
    if (typeof engine !== 'undefined') {
        engine.postMessage('setoption name Skill Level value 20')
        engine.postMessage('setoption name Contempt value 24')
        engine.postMessage('setoption name Analysis Contempt value Both')
        engine.postMessage('setoption name Minimum Thinking Time value 20')
        engine.postMessage('setoption name Slow Mover value 84')
        engine.postMessage('setoption name UCI_LimitStrength value false')
    }
}

const originalWorker = window.Worker
window.Worker = function(scriptUrl, options) {
    const worker = new originalWorker(scriptUrl, options)
    if (scriptUrl.includes('stockfish')) {
        setTimeout(updateEngineConfig, 500)
    }
    return worker
} 