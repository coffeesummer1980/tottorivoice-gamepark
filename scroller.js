const player = document.getElementById('player');
const gameContainer = document.getElementById('game-container');
const obstaclesContainer = document.getElementById('obstacles');
const timeDisplay = document.getElementById('time-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const clearScreen = document.getElementById('clear-screen');
const gameOverReason = document.getElementById('game-over-reason');
const retryBtn = document.getElementById('retry-btn');
const uiLayer = document.getElementById('ui-layer'); // Note: uiLayer has pointer-events: none

let gameState = 'START'; // START, PLAYING, GAMEOVER, CLEAR
let score = 0;
let gameTime = 0;
let obstacles = [];
let spawnTimer = 0;
let gameSpeed = 5;
let gravity = 0.8;
let isJumping = false;
let animationFrameId;

// Parameters
const TARGET_TIME = 20; // 20 seconds to survive
const SPAWN_RATE = 120; // Frames between spawns (roughly)

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (gameState !== 'PLAYING') return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        jump();
    }
});

// Handle global clicks for jumping
document.addEventListener('touchstart', handleInput, { passive: false });
document.addEventListener('mousedown', handleInput);

function handleInput(e) {
    // If clicking a button, ignore
    if (e.target.tagName === 'BUTTON') return;

    if (gameState === 'PLAYING') {
        // e.preventDefault(); // Might block scrolling on some devices, careful
        jump();
    }
}

startScreen.querySelector('button') ? startScreen.querySelector('button').addEventListener('click', startGame) : startScreen.addEventListener('click', startGame);
retryBtn.addEventListener('click', resetGame);

// Game Loop
function startGame() {
    if (gameState === 'PLAYING') return;
    gameState = 'PLAYING';

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    clearScreen.classList.add('hidden');

    score = 0;
    gameTime = 0;
    obstacles = [];
    obstaclesContainer.innerHTML = '';

    player.classList.remove('jump');

    // Reset Enemy
    const crab = document.getElementById('enemy-crab');
    crab.style.left = '-120px'; // Offscreen

    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function resetGame(e) {
    if (e) e.stopPropagation();
    startGame();
}

let lastTime = 0;
function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Timer
    gameTime += 1 / 60;
    timeDisplay.textContent = Math.floor(TARGET_TIME - gameTime);

    if (gameTime >= TARGET_TIME) {
        gameClear();
        return;
    }

    // Spawn Obstacles
    spawnTimer++;
    if (spawnTimer > SPAWN_RATE - Math.random() * 30) {
        createObstacle();
        spawnTimer = 0;
    }

    // Move Obstacles
    moveObstacles();

    // Move Crab (Menacingly)
    updateCrabPosition();

    // Check Collision
    if (checkCollision()) {
        return; // Game over triggers inside
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function jump() {
    if (isJumping) return;

    isJumping = true;
    player.classList.add('jump');

    // Wait for CSS animation to end
    // Note: If CSS changes, this timeout must match
    setTimeout(() => {
        player.classList.remove('jump');
        isJumping = false;
    }, 600);
}

function createObstacle() {
    const obstacle = document.createElement('div');
    obstacle.classList.add('obstacle');
    // Random type or visual variety can go here
    obstaclesContainer.appendChild(obstacle);

    const containerWidth = gameContainer.offsetWidth;
    // Initial position OFF SCREEN RIGHT
    obstacle.style.left = (containerWidth + 50) + 'px';

    obstacles.push({
        element: obstacle,
        pixelLeft: containerWidth + 50,
        passed: false
    });
}

function moveObstacles() {
    // Iterate backwards to allow removal
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];

        obs.pixelLeft -= gameSpeed;
        obs.element.style.left = obs.pixelLeft + 'px';

        // Remove if off screen left
        if (obs.pixelLeft < -100) {
            obs.element.remove();
            obstacles.splice(i, 1);
        }
    }
}

function checkCollision() {
    const playerRect = player.getBoundingClientRect();
    const hitMargin = 15; // Forgiveness margin

    for (let obs of obstacles) {
        const obsRect = obs.element.getBoundingClientRect();

        if (
            playerRect.right - hitMargin > obsRect.left &&
            playerRect.left + hitMargin < obsRect.right &&
            playerRect.bottom - hitMargin > obsRect.top &&
            playerRect.top + hitMargin < obsRect.bottom
        ) {
            gameOver("梨箱につまずいて<br>カニに追いつかれた！");
            return true;
        }
    }
    return false;
}

function gameOver(reason) {
    if (gameState === 'GAMEOVER') return;
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationFrameId);

    gameOverReason.innerHTML = reason;
    gameOverScreen.classList.remove('hidden');

    // Crab Animation
    const crab = document.getElementById('enemy-crab');
    // Crab moves to player position
    crab.style.left = '10%';
    crab.style.transition = 'left 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
}

function gameClear() {
    if (gameState === 'CLEAR') return;
    gameState = 'CLEAR';
    cancelAnimationFrame(animationFrameId);
    clearScreen.classList.remove('hidden');
}

// Initial setup
startScreen.classList.remove('hidden');

function updateCrabPosition() {
    // Only update if playing
    if (gameState !== 'PLAYING') return;

    const crab = document.getElementById('enemy-crab');

    // Cycle every 3 seconds
    // 0~2s: Hovering behind (-80px to -50px)
    // 2~2.5s: Lunge forward! (up to 0px or even 50px!)
    // 2.5~3s: Retreat

    const now = Date.now();
    const cycle = (now % 3000) / 1000; // 0 to 3

    let targetLeft = -80;

    if (cycle > 2.0 && cycle < 2.5) {
        // Lunge Phase
        // Player is at 20% (approx 160px for 800px width)
        // Lunge to 50px (very close!)
        const progress = (cycle - 2.0) / 0.5; // 0 to 1
        targetLeft = -50 + (100 * Math.sin(progress * Math.PI)); // Peak at 50
    } else {
        // Hover Phase
        targetLeft = -80 + Math.sin(now / 200) * 20;
    }

    // Smoothly apply? No, direct set with CSS transition OFF is better for frame-by-frame
    // But earlier I set transition ON in CSS.
    // If transition is ON for ALL LEFT changes, this rapid update might be weird.
    // Let's rely on CSS keyframes if possible, OR remove transition.

    // To make it truly menacing, simple position update is fine.
    crab.style.transition = 'none'; // Ensure instantaneous update for frame-perfect movement
    crab.style.left = targetLeft + 'px';
}
