<h1>Chess Cheat</h1>
<p>Chess cheat utilizes the stockfish engine and the power of your computer to show you the best move to make in any chess.com game. It guarantees you wins in atleast 90% of games you play and can greatly help you improve your chess skills.

<i>Note: this project was developed for learning purposes, I do not condone or encourage cheating in games and this project should help you get better at chess. Non fair play might result in your chess.com account being suspended if you do not use wisely. </i>
<br>


https://user-images.githubusercontent.com/71329328/221189107-244544b0-8070-4ee3-973f-c4c9bfa15067.mp4


<h1>How to install:</h1>
First clone this repo if you have git installed on your machine:
<code>
git clone https://github.com/Eugenenoble2005/chesscheat.git
</code>

If you do not have git installed, you may download this repo as a zip by following this link:
<a href = "https://github.com/Eugenenoble2005/chesscheat/archive/refs/heads/master.zip">Zip Download</a>

<h3>Chrome / Edge / Brave</h3>
Visit 'chrome://extensions'. Enable developer mode by clicking the toggle at the top right. Click 'Load Unpacked' and select the folder where you have cloned or extracted the repo. Activate the extension and done.

<h3>Firefox</h3>
Visit 'about:debugging#/runtime/this-firefox', click 'Load Temporary Add-on…' and pick the <code>manifest.json</code> file inside the folder.

There is nothing to build or install with npm: the engine ships inside the extension (see <i>Engine</i> below).

<h1>How to use:</h1>
Open any game on chess.com. A small panel appears above the board.
<ul>
  <li><b>Start Hack</b> loads the engine and analyses the board. The panel shows the move, the evaluation (from White's point of view, like chess.com's own eval bar) and the search depth as the engine deepens. Click again to stop.</li>
  <li>A <b>red arrow</b> is the best move for you. A <b>blue arrow</b> is the reply the engine expects from your opponent while they are thinking.</li>
  <li><b>Depth</b> controls how deep the engine searches. 15 answers within a second or two; 20 takes several seconds; 25 and above can take minutes per move. Changing it re-analyses the current position.</li>
  <li><b>Flash key</b> (default <code>`</code>, the key left of 1): press it during a game to flash the best move on the board for a moment. Click the <b>Flash</b> button in the panel to pick another key.</li>
  <li><b>Hide until key</b> keeps the board clean: no arrow is drawn and the panel does not name the move. The flash key shows it on demand.</li>
  <li>Depth, the flash key and the hide setting are remembered between page loads.</li>
</ul>

<h1>How it works:</h1>
<ul>
  <li>The position is read from chess.com's own board component (<code>wc-chess-board.game</code>), so castling rights, en passant and the side to move are exact. If that object is unavailable the extension falls back to reading the pieces from the page, as earlier versions did. The precise mode needs a browser that supports main-world content scripts: Chrome 111+, Firefox 128+.</li>
  <li>Moves are detected with a MutationObserver on the board instead of polling, and each new position stops the running search before starting the next one, so stale results are never drawn.</li>
  <li>Loading the engine: the main-world content script cannot see the extension's own URL and may not start a Worker from one. <code>scripts/bridge.js</code>, an ordinary (isolated-world) content script, writes the URL of the <code>engine/</code> folder onto the <code>&lt;html&gt;</code> element; <code>scripts/main.js</code> fetches the engine's loader from there (<code>engine/*</code> is listed under <code>web_accessible_resources</code> for chess.com), starts it as a <code>blob:</code> Worker and passes the <code>.wasm</code> file's URL in the worker URL's fragment, which is where Stockfish.js looks for it. The WebAssembly is compiled inside that page worker, so the extension needs no <code>content_security_policy</code> entry.</li>
</ul>

<h1>Engine:</h1>
The extension ships its own copy of <a href="https://github.com/nmrugg/stockfish.js">Stockfish.js</a> 19, the "lite, single-threaded" WebAssembly build: a small neural network, and no SharedArrayBuffer or cross-origin isolation needed, so it runs on chess.com as it is. It does not depend on any file hosted by chess.com. The files, unchanged from the <a href="https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1">v19.0.1 release</a>, are:
<ul>
  <li><code>engine/stockfish-19-lite-single.js</code>: the loader and UCI glue, run as a Web Worker.</li>
  <li><code>engine/stockfish-19-lite-single.wasm</code>: the engine itself (about 1.8 MB).</li>
  <li><code>engine/COPYING.txt</code> and <code>engine/AUTHORS.txt</code>: its licence text and credits.</li>
</ul>
<b>Licence:</b> Stockfish and Stockfish.js are released under the GNU General Public License, version 3 (GPL-3.0). The engine files are redistributed here unmodified under that licence; the full text is in <code>engine/COPYING.txt</code>. The extension is distributed together with the engine, so the package as a whole has to be distributed under GPL-compatible terms.
<br><br>
If the bundled engine cannot be loaded, the extension falls back to the Stockfish worker chess.com serves to its own visitors (<code>ENGINE_URL</code> in <code>scripts/main.js</code>: a Stockfish 10 asm.js build whose hashed file name chess.com changes on some deploys, which is why it is no longer the first choice). The panel names the engine that answered; a yellow label means the fallback is in use, and hovering it shows why the bundled engine failed.
<br><br>
To update the engine, download a <code>stockfish-&lt;version&gt;-lite-single.js</code> and <code>.wasm</code> pair from a <a href="https://github.com/nmrugg/stockfish.js/releases">Stockfish.js release</a> into <code>engine/</code> and change the file names in <code>BUNDLED_ENGINE</code> in <code>scripts/main.js</code>. Any single-threaded Stockfish.js build works; the multi-threaded ones need cross-origin isolation, which chess.com's pages do not have.
