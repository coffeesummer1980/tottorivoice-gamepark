// --- Constants ---
const SHUFFLE_CARD_IMG = 'shuffle_icon.png';
const IMAGE_LIST = [
    'fumufumu.jpeg',
    'ageru.jpeg',
    'ureshi.jpeg',
    'yatta.jpeg',
    'love.jpeg',
    'IMG_0453.PNG',
    'IMG_0454.PNG',
    'IMG_0455.PNG',
    'IMG_0456.PNG',
    'IMG_0457.PNG',
    'IMG_0458.PNG'
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
        cardGrid.style.gridTemplateColumns = 'repeat(5, 1fr)'; // 25 cards
    } else if (level === 'easy') {
        cardGrid.style.gridTemplateColumns = 'repeat(3, 1fr)'; // 9 cards
    } else {
        cardGrid.style.gridTemplateColumns = 'repeat(4, 1fr)'; // 17 cards
    }

    // Generate Cards
    generateCards(currentPairs);

    // Start Timer
    startTimer();
}

function generateCards(pairCount) {
    // 1. Select random images for pairs
    const selectedImages = [];
    const shuffledImages = [...IMAGE_LIST].sort(() => Math.random() - 0.5);

    for (let i = 0; i < pairCount; i++) {
        selectedImages.push(shuffledImages[i % shuffledImages.length]);
    }

    // Create deck with normal pairs
    let deck = [];
    selectedImages.forEach(img => {
        deck.push({ img: img, type: 'normal' });
        deck.push({ img: img, type: 'normal' });
    });

    // Add ONE Shuffle Card
    deck.push({ img: SHUFFLE_CARD_IMG, type: 'shuffle' });

    // 3. Shuffle the deck
    deck.sort(() => Math.random() - 0.5);

    // 4. Render to DOM
    cardGrid.innerHTML = '';

    deck.forEach((item, index) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.image = item.img;
        card.dataset.type = item.type;
        card.dataset.index = index;

        card.innerHTML = `
            <div class="card-face card-back"></div>
            <div class="card-face card-front">
                <img src="${item.img}" class="card-img" alt="card">
            </div>
        `;

        card.addEventListener('click', () => handleCardClick(card));
        cardGrid.appendChild(card);
    });
}

function handleCardClick(card) {
    if (isLocked) return;
    if (card.classList.contains('flipped')) return; // Already flipped
    if (card.classList.contains('matched')) return;

    // Flip the card
    flipCard(card);

    // Check if it's the shuffle card
    if (card.dataset.type === 'shuffle') {
        // It's the shuffle card!
        card.classList.add('matched'); // Treat as matched/cleared so it doesn't flip back
        triggerShuffleEffect();
        return; // Don't proceed to pair matching
    }

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

function triggerShuffleEffect() {
    // Show toast or alert
    showToast('🌀 シャッフル発動！ 🌀');

    setTimeout(() => {
        shuffleRemainingCards();
    }, 500); // Wait a bit after match animation
}

function shuffleRemainingCards() {
    // Get all cards that are NOT matched and NOT flipped (hidden cards)
    // Actually, flipped cards are empty [] by now.
    // So just get all cards without .matched class.

    const allCards = Array.from(cardGrid.children);
    const hiddenCards = allCards.filter(card => !card.classList.contains('matched'));

    if (hiddenCards.length <= 1) return; // Nothing to shuffle

    // We want to keep the matched cards in place? 
    // Or shuffle EVERYTHING that is remaining into remaining spots?
    // User said "hidden cards will be shuffled".
    // Usually this means they swap positions.

    // 1. Get current positions (DOM order) of hidden cards.
    // 2. Shuffle distinct hidden cards DOM elements.
    // 3. Re-insert them? 
    // CSS Grid places items by DOM order.
    // So if I move DOM elements around, they move in grid.
    // BUT, matched cards are taking up slots (visually transparent or visible?).
    // They are visible (.matched just adds animation/opacity).
    // So matched cards should stay where they are.
    // Hidden cards should swap positions with OTHER hidden cards.

    // Algorithm:
    // 1. Identify all Current Hidden Cards.
    // 2. Record their current indices in the DOM (0 to N-1).
    // 3. Shuffle the array of hidden cards.
    // 4. Put them back into the recorded indices.

    const slots = []; // [index, element]
    hiddenCards.forEach(card => {
        const index = Array.from(cardGrid.children).indexOf(card);
        slots.push({ index: index, card: card });
    });

    // Shuffle the cards array only
    const shuffledCards = slots.map(s => s.card).sort(() => Math.random() - 0.5);

    // Put them back
    // We need to be careful not to mess up the order while inserting.
    // We can use replaceChild if we do it one by one? 
    // Or gather all grid children, replace the hidden ones in the array, then re-append all?

    const newGridState = Array.from(cardGrid.children); // Copy current state

    slots.forEach((slot, i) => {
        // slot.index is where a hidden card WAS.
        // We put shuffledCards[i] there.
        newGridState[slot.index] = shuffledCards[i];
    });

    // Render new state
    // To avoid flicker, maybe we can just re-order DOM.
    // cardGrid.innerHTML = ''; newGridState.forEach... -> this clears event listeners?
    // No, appendChild moves existing nodes without losing listeners.

    newGridState.forEach(card => {
        cardGrid.appendChild(card);
    });

    // Add a spin animation to all cards to show shuffle happened?
    hiddenCards.forEach(card => {
        card.animate([
            { transform: 'scale(1) rotate(0deg)' },
            { transform: 'scale(0.8) rotate(10deg)' },
            { transform: 'scale(1) rotate(0deg)' }
        ], {
            duration: 300,
            easing: 'ease-out'
        });
    });
}

// Helper for toast
function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'absolute';
    toast.style.top = '50%';
    toast.style.left = '50%';
    toast.style.transform = 'translate(-50%, -50%)';
    toast.style.background = 'rgba(255, 152, 0, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '15px 30px';
    toast.style.borderRadius = '50px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '1000';
    toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    toast.style.pointerEvents = 'none';
    toast.innerText = msg;

    gameScreen.appendChild(toast);

    toast.animate([
        { opacity: 0, transform: 'translate(-50%, -40%)' },
        { opacity: 1, transform: 'translate(-50%, -50%)', offset: 0.1 },
        { opacity: 1, transform: 'translate(-50%, -50%)', offset: 0.9 },
        { opacity: 0, transform: 'translate(-50%, -60%)' }
    ], {
        duration: 2000,
        fill: 'forwards'
    });

    setTimeout(() => toast.remove(), 2000);
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
