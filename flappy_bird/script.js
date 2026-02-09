// Game Constants (Default Normal)
let GRAVITY = 0.4;
let JUMP = -7;
let PIPE_SPEED = 3;
let PIPE_SPAWN_INTERVAL = 1500;
let PIPE_GAP = 160;
const BIRD_SIZE = 45;
const HITBOX_PADDING = 10; // Pixels to shrink collision box

// Difficulty Settings
const DIFFICULTIES = {
    // New Easy: Very slow, wide gap, floaty
    easy: { gravity: 0.25, jump: -5.5, speed: 2.0, gap: 230, interval: 2200 },
    // Normal: Previous Easy
    normal: { gravity: 0.35, jump: -6.5, speed: 2.5, gap: 190, interval: 1800 },
    // Hard: Previous Normal
    hard: { gravity: 0.45, jump: -7.5, speed: 3.5, gap: 160, interval: 1500 }
};

// Game State
let canvas, ctx;
let logicalWidth, logicalHeight;
let lastTime = 0;
let score = 0;
let gameState = 'START';
let particles = [];
let currentDifficulty = 'normal';

// Objects
let bird = {
    x: 50,
    y: 0,
    velocity: 0,
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    rotation: 0
};

let pipes = [];

// Images
const birdImg = new Image();
birdImg.src = 'yuikun.png';

const bossImg = new Image();
bossImg.src = 'boss_crow.png';

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScore = document.getElementById('final-score');
// const startBtn = document.getElementById('start-btn'); // Removing single start button
const retryBtn = document.getElementById('retry-btn');
const difficultyBtns = document.querySelectorAll('.diff-btn');

// Game Settings
const WIN_SCORE = 15;
let boss = null;

// Init
window.addEventListener('load', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupDifficultyButtons();
    resetGame();
    gameLoop(0);
});

function setupDifficultyButtons() {
    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const level = btn.dataset.level;
            startGame(level);
        });
    });
}

// Controls
function jump() {
    if (gameState === 'PLAYING' || gameState === 'BOSS_FIGHT') {
        bird.velocity = JUMP;
        createParticles(bird.x, bird.y + bird.height / 2);
    } else if (gameState === 'START') {
        // Can't jump in start screen naturally unless hidden button
    }
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') jump();
});
window.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    jump();
});
window.addEventListener('mousedown', jump);
// startBtn.addEventListener('click', (e) => {
//     e.stopPropagation(); // prevent double trigger
//     startGame();
// });
retryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetGame();
    // Show start screen again to pick difficulty? Or retry same difficulty?
    // Usually retry means same difficulty.
    // So we need to modify resetGame to NOT show start screen if we want instant retry.
    // Or just go back to title.
    // Let's make "Retry" restart the SAME difficulty immediately.
    startGame(currentDifficulty);
});


function resizeCanvas() {
    const container = document.getElementById('game-container');
    const dpr = window.devicePixelRatio || 1;

    logicalWidth = container.offsetWidth;
    logicalHeight = container.offsetHeight;

    // Set actual canvas size (resolution)
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    // Scale context to match
    ctx.scale(dpr, dpr);

    // Style size (display size) remains the same
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
}

function startGame(level = 'normal') {
    currentDifficulty = level;

    // Apply Difficulty Settings
    const settings = DIFFICULTIES[level] || DIFFICULTIES.normal;
    GRAVITY = settings.gravity;
    JUMP = settings.jump;
    PIPE_SPEED = settings.speed;
    PIPE_GAP = settings.gap;
    PIPE_SPAWN_INTERVAL = settings.interval;

    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    document.getElementById('game-clear-screen').classList.remove('active'); // Hide clear screen

    bird.y = logicalHeight / 2;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes = [];
    boss = null;
    score = 0;
    scoreDisplay.innerText = 0;
    lastTime = performance.now();

    lastPipeSpawn = performance.now() + 2000;
}

function resetGame() {
    gameState = 'START';
    startScreen.classList.add('active');
    gameOverScreen.classList.remove('active');
    document.getElementById('game-clear-screen').classList.remove('active');

    bird.y = logicalHeight / 2;
    bird.velocity = 0;
    scoreDisplay.innerText = '';
}

function gameOver() {
    gameState = 'GAME_OVER';
    gameOverScreen.classList.add('active');
    finalScore.innerText = score;
}

function gameClear() {
    gameState = 'GAME_CLEAR';
    document.getElementById('game-clear-screen').classList.add('active');
}

let lastPipeSpawn = 0;

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Use logical dimensions for clearRect (since ctx is scaled)
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    if (gameState === 'PLAYING' || gameState === 'BOSS_FIGHT') {
        update(deltaTime, timestamp);
    }

    draw();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime, timestamp) {
    // Bird Physics
    bird.velocity += GRAVITY;
    bird.y += bird.velocity;

    // Rotation logic
    bird.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (bird.velocity * 0.1)));

    // Floor Collision
    if (bird.y + bird.height > logicalHeight) {
        bird.y = logicalHeight - bird.height;
        gameOver();
    }
    // Ceiling Collision
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }

    // --- STATE: PLAYING ---
    if (gameState === 'PLAYING') {
        // Pipe Spawning (Stop if reached WIN_SCORE)
        if (score < WIN_SCORE) {
            if (timestamp - lastPipeSpawn > PIPE_SPAWN_INTERVAL) {
                spawnPipe();
                lastPipeSpawn = timestamp;
            }
        }
        // If pipes are gone and score reached, enter Boss Fight
        else if (pipes.length === 0 && !boss) {
            spawnBoss();
        }

        // Pipe Logic
        updatePipes();
    }

    // --- STATE: BOSS FIGHT ---
    if (gameState === 'BOSS_FIGHT') {
        updateBoss(timestamp);
    }

    // Update Particles
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
    });
    particles = particles.filter(p => p.life > 0);
}

function updatePipes() {
    pipes.forEach((pipe, index) => {
        pipe.x -= PIPE_SPEED;

        // Collision Check (Shrunk Hitbox)
        // Bird Hitbox
        const bx = bird.x + HITBOX_PADDING;
        const by = bird.y + HITBOX_PADDING;
        const bw = bird.width - HITBOX_PADDING * 2;
        const bh = bird.height - HITBOX_PADDING * 2;

        if (
            bx < pipe.x + pipe.width &&
            bx + bw > pipe.x &&
            (by < pipe.topHeight || by + bh > pipe.bottomY)
        ) {
            gameOver();
        }

        // Scoring
        if (!pipe.passed && bird.x > pipe.x + pipe.width) {
            score++;
            scoreDisplay.innerText = score;
            pipe.passed = true;
        }
    });

    // Remove old pipes
    pipes = pipes.filter(p => p.x + p.width > 0);
}

function spawnBoss() {
    gameState = 'BOSS_FIGHT';
    showToast('⚠️ BOSS APPEARING! ⚠️');
    boss = {
        x: logicalWidth + 100,
        y: logicalHeight / 2 - 50,
        width: 100,
        height: 100,
        speed: 2,
        angle: 0
    };
}

function updateBoss(timestamp) {
    if (!boss) return;

    // Boss Movement: Left + Sine Wave
    boss.x -= boss.speed;
    // Increased amplitude for challenge
    boss.y = (logicalHeight / 2 - 50) + Math.sin(timestamp / 200) * 120;

    // Collision Check
    const bx = bird.x + HITBOX_PADDING;
    const by = bird.y + HITBOX_PADDING;
    const bw = bird.width - HITBOX_PADDING * 2;
    const bh = bird.height - HITBOX_PADDING * 2;

    // Boss Hitbox (slightly smaller than image)
    const bossPadding = 15;
    const bossX = boss.x + bossPadding;
    const bossY = boss.y + bossPadding;
    const bossW = boss.width - bossPadding * 2;
    const bossH = boss.height - bossPadding * 2;

    if (
        bx < bossX + bossW &&
        bx + bw > bossX &&
        by < bossY + bossH &&
        by + bh > bossY
    ) {
        gameOver();
    }

    // Win Check (Passed Boss)
    if (bird.x > boss.x + boss.width) {
        gameClear();
    }
}

function spawnPipe() {
    const minHeight = 50;
    const maxGapY = logicalHeight - minHeight - PIPE_GAP;
    const gapY = Math.floor(Math.random() * (maxGapY - minHeight + 1)) + minHeight;

    const pipe = {
        x: logicalWidth,
        topHeight: gapY,
        bottomY: gapY + PIPE_GAP,
        width: 60,
        passed: false
    };
    pipes.push(pipe);
}

function draw() {
    // Draw Bird
    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate(bird.rotation);

    if (birdImg.complete) {
        ctx.drawImage(birdImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
    } else {
        ctx.fillStyle = '#FF9800';
        ctx.fillRect(-bird.width / 2, -bird.height / 2, bird.width, bird.height);
    }
    ctx.restore();

    // Draw Pipes
    ctx.fillStyle = '#4CAF50';
    pipes.forEach(pipe => {
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
        ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, logicalHeight - pipe.bottomY);
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(pipe.x - 2, pipe.topHeight - 20, pipe.width + 4, 20);
        ctx.fillRect(pipe.x - 2, pipe.bottomY, pipe.width + 4, 20);
        ctx.fillStyle = '#4CAF50';
    });

    // Draw Boss
    if (boss && bossImg.complete) {
        ctx.drawImage(bossImg, boss.x, boss.y, boss.width, boss.height);
    }

    // Draw Particles
    ctx.fillStyle = '#FFF';
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Floor
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(0, logicalHeight - 10, logicalWidth, 10);
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'absolute';
    toast.style.top = '20%';
    toast.style.left = '50%';
    toast.style.transform = 'translate(-50%, -50%)';
    toast.style.background = 'rgba(255, 0, 0, 0.8)';
    toast.style.color = '#fff';
    toast.style.padding = '15px 30px';
    toast.style.borderRadius = '50px';
    toast.style.fontSize = '1.5rem';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '100';
    toast.style.animation = 'pop 0.5s ease-out';
    document.getElementById('game-container').appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function createParticles(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            size: Math.random() * 5 + 2
        });
    }
}
