let currentGrid = null;
let currentDifficulty = 'easy';
let playerPos = { r: 0, c: 0 };
let playerPath = [];
let totalEmptyCells = 0;
let N = 5;

// Audio
const moveSnd = document.getElementById('move-snd');
const clearSnd = document.getElementById('clear-snd');
const failSnd = document.getElementById('fail-snd');

function playSound(snd) {
    if (!snd) return;
    snd.currentTime = 0;
    snd.play().catch(e => console.log('Audio autoplay blocked', e));
}

function showMenu() {
    document.getElementById('dialog-overlay').classList.remove('active');
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
}

function stopDefault(e) { e.preventDefault(); }

function startGame(diff) {
    currentDifficulty = diff;
    if (diff === 'easy') { N = 5; document.getElementById('level-display').innerText = '初級'; }
    else if (diff === 'normal') { N = 7; document.getElementById('level-display').innerText = '中級'; }
    else if (diff === 'hard') { N = 9; document.getElementById('level-display').innerText = '上級'; }

    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    nextLevel();
}

function nextLevel() {
    document.getElementById('dialog-overlay').classList.remove('active');
    currentGrid = generateLevel(N);
    setupBoard();
}

function restartLevel() {
    // Reset path but keep the same grid
    playerPath = [];

    // Find S
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (currentGrid[r][c] === 'S') {
                playerPos = { r, c };
            }
            let cellEl = document.getElementById(`cell-${r}-${c}`);
            if (cellEl) {
                cellEl.classList.remove('visited');
                cellEl.innerHTML = getCellContent(currentGrid[r][c]);
            }
        }
    }

    playerPath.push({ r: playerPos.r, c: playerPos.c });
    document.getElementById(`cell-${playerPos.r}-${playerPos.c}`).classList.add('visited');
    updatePlayerVisual();
}

function setupBoard() {
    const board = document.getElementById('game-board');
    board.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${N}, 1fr)`;

    // Cell size calculation hint for CSS
    document.documentElement.style.setProperty('--grid-size', N);

    board.innerHTML = '';
    totalEmptyCells = 0;
    playerPath = [];

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            let val = currentGrid[r][c];
            if (val !== 'x') totalEmptyCells++;

            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${r}-${c}`;

            if (val === 'S') {
                playerPos = { r, c };
            } else if (val === 'x') {
                cell.setAttribute('data-type', 'obstacle');
            } else if (val === 'G') {
                cell.setAttribute('data-type', 'goal');
            }

            cell.innerHTML = getCellContent(val);
            board.appendChild(cell);
        }
    }

    playerPath.push({ r: playerPos.r, c: playerPos.c });
    document.getElementById(`cell-${playerPos.r}-${playerPos.c}`).classList.add('visited');
    updatePlayerVisual();
}

function getCellContent(val) {
    if (val === 'x') {
        return `<div class="obstacle-sprite"></div>`;
    }
    return '';
}

function updatePlayerVisual() {
    // Remove player sprite from all cells
    document.querySelectorAll('.player-sprite').forEach(el => el.remove());

    // Add to current cell
    let currentCell = document.getElementById(`cell-${playerPos.r}-${playerPos.c}`);
    if (currentCell) {
        let p = document.createElement('div');
        p.className = 'player-sprite';
        currentCell.appendChild(p);
    }
}

function handleMove(dir) {
    if (document.getElementById('dialog-overlay').classList.contains('active')) return;

    let dr = 0, dc = 0;
    if (dir === 'up') dr = -1;
    if (dir === 'down') dr = 1;
    if (dir === 'left') dc = -1;
    if (dir === 'right') dc = 1;

    let nr = playerPos.r + dr;
    let nc = playerPos.c + dc;

    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return; // out of bounds

    let val = currentGrid[nr][nc];
    if (val === 'x') return; // obstacle

    // Check backwards movement (Undo)
    if (playerPath.length > 1) {
        let lastPos = playerPath[playerPath.length - 2];
        if (nr === lastPos.r && nc === lastPos.c) {
            // Undo!
            let curr = playerPath.pop();
            let currCell = document.getElementById(`cell-${curr.r}-${curr.c}`);
            currCell.classList.remove('visited');
            playerPos = { r: nr, c: nc };
            updatePlayerVisual();
            playSound(moveSnd);
            return;
        }
    }

    // Has it been visited?
    let alreadyVisited = playerPath.some(p => p.r === nr && p.c === nc);
    if (alreadyVisited) return; // Cannot cross visited cells unless undoing

    // Valid forward move
    playerPos = { r: nr, c: nc };
    playerPath.push({ r: nr, c: nc });
    let cellEl = document.getElementById(`cell-${nr}-${nc}`);
    cellEl.classList.add('visited');
    updatePlayerVisual();
    playSound(moveSnd);

    // Check win
    if (val === 'G') {
        if (playerPath.length === totalEmptyCells) {
            // WIN!
            setTimeout(() => {
                playSound(clearSnd);
                document.getElementById('dialog-overlay').classList.add('active');
            }, 300);
        } else {
            // Reached goal but missed cells!
            setTimeout(() => {
                playSound(failSnd);
                alert("あれれ？まだ通っていないマスがあるよ！やりなおしてみよう！");
            }, 300);
        }
    } else {
        // Automatically check if stuck (no valid moves left)
        // If they can't move anywhere, we might optionally alert them, but they can manually undo.
    }
}

let showingHint = false;
function showHint() {
    if (showingHint || document.getElementById('dialog-overlay').classList.contains('active')) return;
    showingHint = true;

    if (!window.solutionPath) { showingHint = false; return; }

    let correctSoFar = 0;
    let isCorrectPath = true;

    for (let i = 0; i < playerPath.length; i++) {
        if (i < window.solutionPath.length &&
            playerPath[i].r === window.solutionPath[i].r &&
            playerPath[i].c === window.solutionPath[i].c) {
            correctSoFar = i + 1;
        } else {
            isCorrectPath = false;
            break;
        }
    }

    if (!isCorrectPath) {
        alert("ヒント：どこかで通る順番を間違えているみたいです。「やり直す」ボタンか、間違えたところまで戻ってみてね！");
        showingHint = false;
        return;
    }

    let stepsToShow = 5; // Show next 5 steps
    let hintCells = [];
    for (let i = correctSoFar; i < correctSoFar + stepsToShow && i < window.solutionPath.length; i++) {
        let hr = window.solutionPath[i].r;
        let hc = window.solutionPath[i].c;
        let cellEl = document.getElementById(`cell-${hr}-${hc}`);
        if (cellEl) {
            cellEl.classList.add('hinted');
            hintCells.push(cellEl);
        }
    }

    if (hintCells.length === 0) {
        showingHint = false;
        return;
    }

    setTimeout(() => {
        hintCells.forEach(cell => cell.classList.remove('hinted'));
        showingHint = false;
    }, 2000);
}


// Generate Level logic (Random Walk)
function generateLevel(N) {
    let numObstacles;
    // Obstacle count based on difficulty
    if (N === 5) numObstacles = 2; // 初級
    else if (N === 7) numObstacles = 5; // 中級
    else if (N === 9) numObstacles = 10; // 上級

    let targetCount = N * N - numObstacles;
    let maxAttempts = 50000;

    for (let att = 0; att < maxAttempts; att++) {
        let grid = Array.from({ length: N }, () => Array(N).fill('x'));
        let visited = Array.from({ length: N }, () => Array(N).fill(false));
        let path = [];
        let r = 0, c = 0; // Start top-left

        visited[r][c] = true;
        path.push({ r, c });
        grid[r][c] = '0'; // '0' means open path

        while (path.length < targetCount) {
            let dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            let valid = [];
            for (let [dr, dc] of dirs) {
                let nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < N && nc >= 0 && nc < N && !visited[nr][nc]) {
                    // Count unvisited neighbors to prioritize paths with fewer options (Warnsdorff's rule)
                    let deg = 0;
                    for (let [dr2, dc2] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                        let nnr = nr + dr2, nnc = nc + dc2;
                        if (nnr >= 0 && nnr < N && nnc >= 0 && nnc < N && !visited[nnr][nnc]) {
                            deg++;
                        }
                    }
                    valid.push({ r: nr, c: nc, deg: deg });
                }
            }

            if (valid.length === 0) break; // stuck

            // Sort by degree ascending. Add randomness for equal degrees.
            valid.sort((a, b) => {
                if (a.deg !== b.deg) return a.deg - b.deg;
                return Math.random() - 0.5;
            });

            let next = valid[0];
            // 20% explore second best option if available to increase randomness
            if (valid.length > 1 && Math.random() < 0.2) next = valid[1];

            visited[next.r][next.c] = true;
            path.push({ r: next.r, c: next.c });
            r = next.r; c = next.c;
            grid[r][c] = '0';
        }

        if (path.length === targetCount) {
            window.solutionPath = path;
            grid[0][0] = 'S';
            let endNode = path[path.length - 1];
            grid[endNode.r][endNode.c] = 'G';
            return grid;
        }
    }

    // Fallback if no path is found
    console.warn("Could not generate complex level, returning fallback");
    let grid = Array.from({ length: N }, () => Array(N).fill('x')); // rest are obstacles
    for (let r = 0; r < N; r++) { for (let c = 0; c < N; c++) grid[r][c] = '0'; }
    grid[0][0] = 'S';
    grid[N - 1][N - 1] = 'G';
    return grid;
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { stopDefault(e); handleMove('up'); }
    if (e.key === 'ArrowDown') { stopDefault(e); handleMove('down'); }
    if (e.key === 'ArrowLeft') { stopDefault(e); handleMove('left'); }
    if (e.key === 'ArrowRight') { stopDefault(e); handleMove('right'); }
});

// Swipe controls
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

window.addEventListener('touchend', (e) => {
    // Only detect swipe on game board area
    if (!document.getElementById('game-screen').classList.contains('active')) return;
    if (e.target.closest('button')) return; // ignore button clicks

    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;

    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) handleMove('right');
        else if (dx < -30) handleMove('left');
    } else {
        if (dy > 30) handleMove('down');
        else if (dy < -30) handleMove('up');
    }
}, { passive: false });

// Prevent rubber-banding on iOS
document.body.addEventListener('touchmove', function (e) {
    if (e.target.closest('.game-board')) e.preventDefault();
}, { passive: false });
