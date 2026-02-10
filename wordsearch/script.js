const WORD_DATA = [
    "とっとり", "さきゅう", "らっきょう", "かに", "なし",
    "だいせん", "しろうさぎ", "にじっせいき", "すなば", "きたろう",
    "みずきしげる", "いなば", "わかさ", "ちず", "ほうき",
    "くらよし", "よなご", "さかいみなと", "うらどめ", "はわい",
    "まつばがに", "もさえび", "とうふちくわ", "ぎゅうこつ", "おしどり"
];

const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";

const CONFIG = {
    easy: { size: 5, words: 5 },
    medium: { size: 7, words: 7 },
    hard: { size: 9, words: 10 }
};

let currentLevel = 'easy';
let grid = [];
let targetWords = [];
let foundWords = [];
let isSelecting = false;
let startCell = null; // {r, c}
let currentSelectionIndices = []; // Array of {r, c}

// Character Interaction
const PRAISE_MESSAGES = ["すごい！", "その調子！", "やったね！", "さっすが〜！", "天才かも！？", "見つけたね！"];
let reactionTimeout = null;

// DOM Elements
const gridElement = document.getElementById('game-grid');
const wordListElement = document.getElementById('word-list');
const diffButtons = document.querySelectorAll('.diff-btn');
const modal = document.getElementById('clear-modal');
const restartBtn = document.getElementById('restart-btn');
const yuikunImg = document.getElementById('yuikun-img');
const yuikunText = document.getElementById('yuikun-text');

// Initialize Game
function initGame(level) {
    try {
        currentLevel = level;
        foundWords = [];
        isSelecting = false;
        currentSelectionIndices = [];
        startCell = null;

        // UI Reset
        modal.classList.add('hidden');
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none'; // Ensure underlying clicks work

        gridElement.innerHTML = '';
        wordListElement.innerHTML = '';

        // Update buttons
        diffButtons.forEach(btn => {
            if (btn.dataset.level === level) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const { size, words } = CONFIG[level];

        // Select random words candidates
        const candidates = selectRandomWords(words, size);

        // Generate Grid and get ONLY words that were successfully placed
        const result = generateGrid(size, candidates);
        grid = result.grid;
        // Important: Update targetWords to only include successfully placed words
        targetWords = result.placedWords;

        // Render Grid
        renderGrid(size);

        // Render Word List
        renderWordList();

    } catch (e) {
        console.error("Game Initialization Error:", e);
        // Fallback or alert if critical
    }
}

function selectRandomWords(count, size) {
    // Shuffle copy of data
    const shuffled = [...WORD_DATA].sort(() => 0.5 - Math.random());
    // Filter words that roughly fit (length <= size)
    const candidates = shuffled.filter(w => w.length <= size);
    // Provide a few more candidates than needed in case placement fails, but slice to requested count for now
    // We will rely on generateGrid to filter out failed placements
    return candidates.slice(0, count);
}

function generateGrid(size, words) {
    // Initialize empty grid
    let newGrid = Array(size).fill(null).map(() => Array(size).fill(null));
    let placedWords = [];

    // Place words
    for (const word of words) {
        let placed = false;
        let attempts = 0;
        // Try up to 100 times to place a word
        while (!placed && attempts < 100) {
            placed = tryPlaceWord(newGrid, word, size);
            attempts++;
        }
        if (placed) {
            placedWords.push(word);
        } else {
            console.warn(`Could not place word: ${word}`);
            // Logic improvement: if a word fails, maybe try another candidate?
            // For now, simply exclude it from the game to prevent un-winnable state.
        }
    }

    // Fill empty cells
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (newGrid[r][c] === null) {
                newGrid[r][c] = HIRAGANA[Math.floor(Math.random() * HIRAGANA.length)];
            }
        }
    }
    return { grid: newGrid, placedWords: placedWords };
}

function tryPlaceWord(grid, word, size) {
    // 8 directions: [dr, dc]
    const directions = [
        [0, 1],   // Right
        [1, 0],   // Down
        [1, 1],   // Diagonal Down-Right
        [1, -1],  // Diagonal Down-Left
        [0, -1],  // Left
        [-1, 0],  // Up
        [-1, -1], // Diagonal Up-Left
        [-1, 1]   // Diagonal Up-Right
    ];

    // Shuffle directions to avoid bias
    const shuffledDirs = directions.sort(() => 0.5 - Math.random());

    for (const [dr, dc] of shuffledDirs) {
        // Try random positions for this direction
        for (let attempt = 0; attempt < 10; attempt++) {
            const rStart = Math.floor(Math.random() * size);
            const cStart = Math.floor(Math.random() * size);

            // Check bounds
            const rEnd = rStart + dr * (word.length - 1);
            const cEnd = cStart + dc * (word.length - 1);

            if (rEnd >= 0 && rEnd < size && cEnd >= 0 && cEnd < size) {
                // Check overlaps
                let fits = true;
                for (let i = 0; i < word.length; i++) {
                    const r = rStart + dr * i;
                    const c = cStart + dc * i;
                    if (grid[r][c] !== null && grid[r][c] !== word[i]) {
                        fits = false;
                        break;
                    }
                }

                if (fits) {
                    // Place it
                    for (let i = 0; i < word.length; i++) {
                        grid[rStart + dr * i][cStart + dc * i] = word[i];
                    }
                    return true;
                }
            }
        }
    }

    return false;
}

function renderGrid(size) {
    gridElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    // Generate cells
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.textContent = grid[r][c];
            cell.dataset.r = r;
            cell.dataset.c = c;
            gridElement.appendChild(cell);
        }
    }
}

function renderWordList() {
    wordListElement.innerHTML = '';
    targetWords.forEach(word => {
        const li = document.createElement('li');
        li.textContent = word;
        li.classList.add('word-item');
        li.dataset.word = word;
        if (foundWords.includes(word)) {
            li.classList.add('found');
        }
        wordListElement.appendChild(li);
    });
}

// Global Event Listeners for Dragging
// We use 'pointer' events which cover both mouse and touch.

// 1. Start on grid
gridElement.addEventListener('pointerdown', (e) => {
    if (!e.target.classList.contains('cell')) return;

    // Prevent default browser behavior (text selection etc)
    // EXCEPT if we are zooming etc, but usually good for games
    e.preventDefault();

    isSelecting = true;
    startCell = {
        r: parseInt(e.target.dataset.r),
        c: parseInt(e.target.dataset.c)
    };
    highlightSelection([startCell]);

    // Capture pointer
    if (e.target.setPointerCapture) {
        try {
            e.target.setPointerCapture(e.pointerId);
        } catch (err) {
            // Ignore capture failure
        }
    }
});

// 2. Move anywhere (to handle dragging outside cell but generally within window)
window.addEventListener('pointermove', (e) => {
    if (!isSelecting || !startCell) return;
    e.preventDefault();

    // Identify element under pointer
    const target = document.elementFromPoint(e.clientX, e.clientY);

    // If target is null or not a cell, we keep selection but don't update if far away?
    // Actually, we should just project from startCell.

    if (target && target.classList.contains('cell')) {
        const currentR = parseInt(target.dataset.r);
        const currentC = parseInt(target.dataset.c);

        // Calculate cells to highlight based on snapping to 8 directions
        const cells = calculateSnappedSelection(startCell, { r: currentR, c: currentC });
        highlightSelection(cells);
    }
});

// 3. End anywhere
window.addEventListener('pointerup', (e) => {
    if (isSelecting) {
        isSelecting = false;
        checkSelection();
        startCell = null;
        currentSelectionIndices = [];
        // Clear visual 'selected' state
        document.querySelectorAll('.cell.selected').forEach(el => el.classList.remove('selected'));

        // Release capture if needed (automatic usually)
    }
});

// 4. Prevent scrolling on touch
gridElement.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });


function calculateSnappedSelection(start, end) {
    const dr = end.r - start.r;
    const dc = end.c - start.c;

    if (dr === 0 && dc === 0) return [start];

    // Determine angle in degrees
    const angle = Math.atan2(dr, dc) * (180 / Math.PI);

    // Snap to nearest 45 degrees
    // 0, 45, 90, 135, 180, -135, -90, -45
    const snappedAngle = Math.round(angle / 45) * 45;

    // Convert back to step direction
    const rad = snappedAngle * (Math.PI / 180);
    const stepC = Math.round(Math.cos(rad));
    const stepR = Math.round(Math.sin(rad));

    // Length is max absolute diff.
    const len = Math.max(Math.abs(dr), Math.abs(dc));

    const cells = [];
    const size = CONFIG[currentLevel].size;

    for (let i = 0; i <= len; i++) {
        const r = start.r + i * stepR;
        const c = start.c + i * stepC;

        if (r >= 0 && r < size && c >= 0 && c < size) {
            cells.push({ r, c });
        } else {
            break;
        }
    }

    return cells;
}

function highlightSelection(cells) {
    // Remove previous selection
    document.querySelectorAll('.cell.selected').forEach(el => el.classList.remove('selected'));

    currentSelectionIndices = cells;
    cells.forEach(pos => {
        const el = document.querySelector(`.cell[data-r="${pos.r}"][data-c="${pos.c}"]`);
        if (el) el.classList.add('selected');
    });
}

function checkSelection() {
    if (currentSelectionIndices.length === 0) return;

    const word = currentSelectionIndices.map(pos => grid[pos.r][pos.c]).join('');

    if (targetWords.includes(word) && !foundWords.includes(word)) {
        foundWords.push(word);

        // Mark as found
        currentSelectionIndices.forEach((pos, index) => {
            const el = document.querySelector(`.cell[data-r="${pos.r}"][data-c="${pos.c}"]`);
            if (el) {
                el.classList.add('found');
                el.style.animationDelay = `${index * 0.1}s`;
            }
        });

        // Update list
        const wordItem = document.querySelector(`.word-item[data-word="${word}"]`);
        if (wordItem) wordItem.classList.add('found');

        playReaction();
        checkWinCondition();
    }
}

function checkWinCondition() {
    if (foundWords.length === targetWords.length) {
        setTimeout(() => {
            showClearModal();
        }, 800);
    }
}

function showClearModal() {
    // Safety check for UI elements
    const stars = modal.querySelector('.stars');
    if (stars) {
        stars.style.animation = 'none';
        stars.offsetHeight;
        stars.style.animation = 'bounce 2s infinite';
    }

    modal.classList.remove('hidden');
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto'; // Re-enable clicks

    // SDK Record
    if (typeof GameParkSDK !== 'undefined') {
        const bonus = (currentLevel === 'hard' ? 500 : (currentLevel === 'medium' ? 300 : 100));
        GameParkSDK.recordGameResult(bonus, 0.5);
    }
}

// Button Listeners
diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        initGame(level);
    });
});

// Use onclick to prevent multiple listeners if script re-runs (though unlikely here)
if (restartBtn) {
    restartBtn.onclick = () => {
        initGame(currentLevel);
    };
}

// Character Reaction
function playReaction() {
    if (reactionTimeout) clearTimeout(reactionTimeout);

    // Random message
    const message = PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)];
    const textEl = document.getElementById('yuikun-text');
    if (textEl) textEl.textContent = message;

    // Check if image element exists
    const imgEl = document.getElementById('yuikun-img');
    if (imgEl) {
        // Random happy image
        const happyImages = ["yatta.jpeg", "ureshi.jpeg", "love.jpeg"];
        const randomImg = happyImages[Math.floor(Math.random() * happyImages.length)];

        // simple image switch
        imgEl.src = `images/${randomImg}`;

        // Trigger jump animation
        imgEl.classList.remove("character-jump");
        void imgEl.offsetWidth; // trigger reflow
        imgEl.classList.add("character-jump");
    }

    // Reset after delay
    reactionTimeout = setTimeout(() => {
        const textEl = document.getElementById('yuikun-text');
        const imgEl = document.getElementById('yuikun-img');
        if (textEl) textEl.textContent = "いっしょに探そう！";
        if (imgEl) {
            imgEl.src = "images/fumufumu.jpeg";
            imgEl.classList.remove("character-jump");
        }
    }, 2000);
}

// Start game
initGame('easy');
