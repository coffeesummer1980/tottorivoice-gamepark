// --- Constants ---
const IMAGE_LIST = [
    'simple.png',
    'fumufumu.jpeg',
    'ageru.jpeg',
    'ureshi.jpeg',
    'yatta.jpeg',
    'love.jpeg',
    'IMG_0453.PNG',
    'IMG_0454.PNG', // Lv.8 (big)
    'IMG_0455.PNG', // Lv.9
    'IMG_0456.PNG', // Lv.10
    'IMG_0457.PNG',
    'IMG_0458.PNG',
    'アイコン.png'
];

const DIFFICULTY_CONFIG = {
    easy: { pairs: 4, label: '初級' },
    normal: { pairs: 8, label: '中級' },
    hard: { pairs: 12, label: '上級' }
};

// --- State ---
let currentLevel = 'easy';
let currentPairs = 4;
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let isLocked = false;
let startTime = 0;
let timerInterval = null;
let missCount = 0; // Number of incorrect matches

// --- DOM Elements ---
const difficultyScreen = document.getElementById('difficulty-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const cardGrid = document.getElementById('card-grid');
const timeDisplay = document.getElementById('time-display');
const pairsLeftDisplay = document.getElementById('pairs-left');
const retryBtn = document.getElementById('retry-btn');
const giveUpBtn = document.getElementById('give-up-btn');
const missCountDisplay = document.getElementById('miss-count');
const rankBadge = document.getElementById('rank-badge');
const finalTimeDisplay = document.getElementById('final-time');

// --- Initialization ---
function init() {
    setupDifficultyButtons();
    retryBtn.addEventListener('click', () => resetGame(true));
    giveUpBtn.addEventListener('click', confirmGiveUp);
}

function setupDifficultyButtons() {
    const btns = document.querySelectorAll('.diff-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            startGame(level);
        });
    });
}

function startGame(level) {
    currentLevel = level;
    currentPairs = DIFFICULTY_CONFIG[level].pairs;

    // Switch screens
    difficultyScreen.classList.remove('active');
    gameScreen.classList.add('active');
    resultScreen.classList.remove('active');

    // Reset state
    flippedCards = [];
    matchedPairs = 0;
    missCount = 0;
    isLocked = false;
    pairsLeftDisplay.textContent = currentPairs;

    // Set grid columns based on level
    cardGrid.setAttribute('data-level', level);
    if (level === 'hard') {
        cardGrid.style.gridTemplateColumns = 'repeat(4, 1fr)'; // 6x4 = 24 cards
    } else {
        cardGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    }

    // Generate Cards
    generateCards(currentPairs);

    // Start Timer
    startTimer();
}

function generateCards(pairCount) {
    // 1. Select random images for pairs
    const selectedImages = [];
    // Shuffle image list first to get random set each time
    const shuffledImages = [...IMAGE_LIST].sort(() => Math.random() - 0.5);

    for (let i = 0; i < pairCount; i++) {
        // Use modulo if we ask for more pairs than images (unlikely here but safe)
        selectedImages.push(shuffledImages[i % shuffledImages.length]);
    }

    // 2. Double them to make pairs
    const deck = [...selectedImages, ...selectedImages];

    // 3. Shuffle the deck
    deck.sort(() => Math.random() - 0.5);

    // 4. Render to DOM
    cardGrid.innerHTML = '';

    deck.forEach((imgSrc, index) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.image = imgSrc;
        card.dataset.index = index;

        // Inner HTML safely escaping? Filenames are safe here.
        // Front is the image, Back is the pattern
        // We use a container to flip.
        // Initial state is Back visible (not flipped).

        // To flip, we add 'flipped' class which rotates Y 180deg.
        // Since we want Back to be visible initially, let's say 0deg is Back?
        // Actually standard is: Front(0deg), Back(180deg). If we wait for flip to show front.

        // Let's adopt: 
        // .card has transform-style: preserve-3d
        // .card-face is absolute.
        // front face (image) is rotated 180deg.
        // back face (green) is 0deg.
        // When .card is flipped (rotateY 180deg), front becomes 0deg effective (visible).

        card.innerHTML = `
            <div class="card-face card-back"></div>
            <div class="card-face card-front">
                <img src="${imgSrc}" class="card-img" alt="card">
            </div>
        `;

        card.addEventListener('click', () => handleCardClick(card));
        cardGrid.appendChild(card);
    });
}

function handleCardClick(card) {
    if (isLocked) return;
    if (card.classList.contains('flipped')) return; // Already flipped or matched
    if (card.classList.contains('matched')) return;

    // Flip the card
    flipCard(card);
    flippedCards.push(card);

    if (flippedCards.length === 2) {
        // Check for match
        checkForMatch();
    }
}

function flipCard(card) {
    card.classList.add('flipped');
}

function unflipCard(card) {
    card.classList.remove('flipped');
}

function checkForMatch() {
    isLocked = true;

    const [card1, card2] = flippedCards;
    const img1 = card1.dataset.image;
    const img2 = card2.dataset.image;

    if (img1 === img2) {
        // Match!
        handleMatch(card1, card2);
    } else {
        // No Match
        handleMiss(card1, card2);
    }
}

function handleMatch(card1, card2) {
    matchedPairs++;
    pairsLeftDisplay.textContent = currentPairs - matchedPairs;

    // Add visual effect
    setTimeout(() => {
        card1.classList.add('matched');
        card2.classList.add('matched');
        flippedCards = [];
        isLocked = false;

        // Check Game Over
        if (matchedPairs === currentPairs) {
            gameClear();
        }
    }, 500);
}

function handleMiss(card1, card2) {
    missCount++;

    setTimeout(() => {
        unflipCard(card1);
        unflipCard(card2);
        flippedCards = [];
        isLocked = false;
    }, 1000); // Wait 1 sec before flipping back
}

// --- Timer ---
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    timeDisplay.textContent = `${m}:${s}`;
}

function stopTimer() {
    clearInterval(timerInterval);
}

// --- Game End ---
function gameClear() {
    stopTimer();

    setTimeout(() => {
        gameScreen.classList.remove('active');
        resultScreen.classList.add('active');

        // Show Stats
        finalTimeDisplay.textContent = timeDisplay.textContent;
        missCountDisplay.textContent = missCount;

        // Rank Logic
        const rank = calculateRank();
        rankBadge.textContent = rank;

        // Simple confetti or effect could go here
    }, 800);
}

function calculateRank() {
    // Simple logic based on miss count per pair ratio
    // Perfect: 0 misses
    // Good: misses < pairs / 2
    // OK: misses < pairs
    // Bad: misses >= pairs

    if (missCount === 0) return '神';
    if (missCount <= Math.ceil(currentPairs / 4)) return 'S';
    if (missCount <= Math.ceil(currentPairs / 2)) return 'A';
    if (missCount <= currentPairs) return 'B';
    return 'C';
}

function resetGame(toDifficultySelect = false) {
    stopTimer();
    timeDisplay.textContent = '00:00';

    if (toDifficultySelect) {
        resultScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        difficultyScreen.classList.add('active');
    } else {
        // Restart same level
        startGame(currentLevel);
    }
}

function confirmGiveUp() {
    if (confirm('ゲームを終了して最初の画面に戻りますか？')) {
        resetGame(true);
    }
}

// Start
init();
