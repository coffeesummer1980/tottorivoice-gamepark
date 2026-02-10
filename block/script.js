// Game Constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 15;
const BALL_Radius = 8;

// Images
const yuikunImg = new Image();
yuikunImg.src = 'yuikun.png';
const yukarinImg = new Image();
yukarinImg.src = 'yukarin.png';

let canvas, ctx;
let logicalWidth, logicalHeight;
let gameState = 'START'; // START, PLAYING, GAME_OVER, GAME_CLEAR
let currentLevel = 'easy';
let currentImage = '';
let backgroundImage = new Image();

// Game State Object
let state = {
    paddle: {
        x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
        y: CANVAS_HEIGHT - 50,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        speed: 7
    },
    balls: [], // Array of balls
    blocks: [],
    score: 0
};

// Difficulty Configurations
const DIFFICULTIES = {
    easy: {
        rows: 5,
        cols: 6,
        ballSpeed: 4,
        img: 'sakyu.jpg'
    },
    normal: {
        rows: 8,
        cols: 8,
        ballSpeed: 6,
        img: 'shirakabe.jpg'
    },
    hard: {
        rows: 12,
        cols: 10,
        ballSpeed: 8,
        img: 'daisen.jpg'
    }
};

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameClearScreen = document.getElementById('game-clear-screen');
const scoreDisplay = document.getElementById('score-display');
const diffButtons = document.querySelectorAll('.diff-btn');
const retryBtn = document.getElementById('retry-btn');
const clearImagePreview = document.getElementById('clear-image-preview');

// Initialization
window.addEventListener('load', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupControls();
    gameLoop();
});


// Setup Difficulty Selection
diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        const img = btn.dataset.img; // Get image directly from button data
        startGame(level, img);
    });
});

retryBtn.addEventListener('click', () => {
    // Retry same level? Or go back to menu?
    // Let's retry same level.
    // Need to hide game over screen
    gameOverScreen.classList.remove('active'); // Hide overlay
    // But we need to re-init game state.
    // We don't have 'currentImage' set by retry button explicitly, 
    // but 'startGame' uses 'currentLevel'. 
    // Wait, startGame takes (level, img).
    // Let's store currentImg when starting.
    startGame(currentLevel, currentImage);
});



function resizeCanvas() {
    const container = document.getElementById('game-container');
    const dpr = window.devicePixelRatio || 1;

    logicalWidth = container.offsetWidth;
    logicalHeight = container.offsetHeight;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    ctx.scale(dpr, dpr);

    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    // Adjust paddle Y
    state.paddle.y = logicalHeight - 50;

    // Adjust waiting ball
    const firstBall = state.balls[0];
    if (firstBall && !firstBall.active) {
        firstBall.y = state.paddle.y - firstBall.radius - 2;
    }
}

function startGame(level, imgObj) {
    currentLevel = level;
    // Handle image passing: could be string or object from previous state
    // If called from button, it's string.
    // However, DIFFICULTIES defines default img.
    // But user might want specific one?
    // Let's use the one from button mapping if available, otherwise config.
    // Wait, button data-img is hardcoded in HTML.

    let imgSrc = '';
    if (typeof imgObj === 'string') {
        imgSrc = imgObj;
    } else {
        imgSrc = DIFFICULTIES[level].img;
    }
    currentImage = imgSrc; // Store for retry

    // Load Image
    backgroundImage.src = imgSrc;
    backgroundImage.onload = () => {
        // Only start game loop logic once image is loaded?
        // Or just let it render.
    };

    // Reset State
    const config = DIFFICULTIES[level];
    state.score = 0;
    scoreDisplay.innerText = `Blocks: 0`;

    // Paddle
    state.paddle.width = logicalWidth / 4; // Responsive paddle width
    state.paddle.x = logicalWidth / 2 - state.paddle.width / 2;

    // Balls (Array)
    state.balls = [{
        x: logicalWidth / 2,
        y: state.paddle.y - 20,
        vx: 0,
        vy: -config.ballSpeed,
        radius: BALL_Radius,
        active: false,
        baseSpeed: config.ballSpeed
    }];

    // Generate Blocks
    createBlocks(config.rows, config.cols);

    // UI
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameClearScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
}

function createBlocks(rows, cols) {
    state.blocks = [];
    const padding = 0; // No gap
    const offsetTop = 60;
    // Calculate block area height for image drawing
    state.blockArea = {
        x: 0,
        y: offsetTop,
        width: logicalWidth,
        height: 0 // Will clearly set below
    };

    const blockWidth = logicalWidth / cols;
    const blockHeight = (logicalHeight * 0.4) / rows; // Use top 40% of screen for blocks

    state.blockArea.height = rows * blockHeight;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // Determine Type
            let type = 'normal';
            const rand = Math.random();
            if (rand < 0.03) type = 'yukarin'; // 3% Yukarin (Super Rare)
            else if (rand < 0.10) type = 'yuikun'; // 10% Yuikun (Rare)

            state.blocks.push({
                x: c * blockWidth,
                y: offsetTop + r * blockHeight,
                width: blockWidth,
                height: blockHeight,
                status: 1,
                type: type
            });
        }
    }
    scoreDisplay.innerText = `Blocks: ${state.blocks.length}`;
}

// Controls
function setupControls() {
    const container = document.getElementById('game-container');

    // Mouse/Touch Move
    const movePaddle = (clientX) => {
        if (gameState !== 'PLAYING') return;

        const rect = container.getBoundingClientRect();
        const relativeX = clientX - rect.left;

        let newX = relativeX - state.paddle.width / 2;

        // Clamp
        if (newX < 0) newX = 0;
        if (newX + state.paddle.width > logicalWidth) newX = logicalWidth - state.paddle.width;

        state.paddle.x = newX;

        // Move ball with paddle if not active
        const firstBall = state.balls[0];
        if (firstBall && !firstBall.active) {
            firstBall.x = state.paddle.x + state.paddle.width / 2;
        }
    };

    container.addEventListener('mousemove', (e) => movePaddle(e.clientX));
    container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        movePaddle(e.touches[0].clientX);
    }, { passive: false });

    // Click/Tap to Launch
    const launchBall = () => {
        if (gameState === 'PLAYING') {
            const firstBall = state.balls[0];
            if (firstBall && !firstBall.active) {
                firstBall.active = true;
                const config = DIFFICULTIES[currentLevel];
                firstBall.vx = (Math.random() > 0.5 ? 1 : -1) * config.ballSpeed * 0.7;
            }
        }
    };

    container.addEventListener('mousedown', launchBall);
    container.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent double firing
        launchBall();
    });
}

// Game Loop
function gameLoop() {
    if (gameState === 'PLAYING') {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (state.balls.length === 0) {
        gameOver();
        return;
    }

    let ballsToAdd = [];

    state.balls.forEach((ball) => {
        if (!ball.active) return;

        // Move
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall Collision
        if (ball.x + ball.radius > logicalWidth || ball.x - ball.radius < 0) {
            ball.vx = -ball.vx;
            if (ball.x + ball.radius > logicalWidth) ball.x = logicalWidth - ball.radius;
            if (ball.x - ball.radius < 0) ball.x = ball.radius;
        }
        if (ball.y - ball.radius < 0) {
            ball.vy = -ball.vy;
            ball.y = ball.radius;
        }

        // Paddle Collision
        if (
            ball.y + ball.radius > state.paddle.y &&
            ball.y - ball.radius < state.paddle.y + state.paddle.height &&
            ball.x > state.paddle.x &&
            ball.x < state.paddle.x + state.paddle.width
        ) {
            ball.vy = -Math.abs(ball.vy);
            const hitPoint = ball.x - (state.paddle.x + state.paddle.width / 2);
            ball.vx += hitPoint * 0.15;
        }

        // Block Collision
        state.blocks.forEach(block => {
            if (block.status === 1) {
                if (
                    ball.x > block.x &&
                    ball.x < block.x + block.width &&
                    ball.y > block.y &&
                    ball.y < block.y + block.height
                ) {
                    ball.vy = -ball.vy;
                    block.status = 0;
                    state.score++;

                    // Item Effect
                    if (block.type === 'yuikun') {
                        ballsToAdd.push(createBall(ball.x, ball.y, ball.baseSpeed));
                        showToast('🐣 ゆいくん分裂！');
                    } else if (block.type === 'yukarin') {
                        for (let i = 0; i < 4; i++) ballsToAdd.push(createBall(ball.x, ball.y, ball.baseSpeed));
                        showToast('🎀 ゆかりんフィーバー！');
                    }
                }
            }
        });
    });

    // Add new balls
    state.balls.push(...ballsToAdd);

    // Remove dead balls
    state.balls = state.balls.filter(b => {
        return !b.active || b.y - b.radius < logicalHeight;
    });

    // Paddle Move for inactive ball
    const firstBall = state.balls[0];
    if (firstBall && !firstBall.active) {
        firstBall.x = state.paddle.x + state.paddle.width / 2;
    }

    if (state.balls.length === 0) {
        gameOver();
    }

    const activeBlocks = state.blocks.filter(b => b.status === 1).length;
    scoreDisplay.innerText = `Remaining: ${activeBlocks}`;

    if (activeBlocks === 0) {
        gameClear();
    }
}

function createBall(x, y, speed) {
    return {
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * speed * 1.5,
        vy: -speed,
        radius: BALL_Radius,
        active: true,
        baseSpeed: speed
    };
}

function draw() {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // Background Image
    if (backgroundImage.complete && state.blockArea) {
        ctx.drawImage(backgroundImage,
            state.blockArea.x, state.blockArea.y,
            state.blockArea.width, state.blockArea.height
        );
    }

    // Active Blocks
    state.blocks.forEach(block => {
        if (block.status === 1) {
            ctx.fillStyle = '#87CEEB';
            if (block.type === 'yuikun') ctx.fillStyle = '#C5E1A5'; // Light Green
            if (block.type === 'yukarin') ctx.fillStyle = '#F48FB1'; // Pink

            ctx.fillRect(block.x, block.y, block.width, block.height);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(block.x, block.y, block.width, block.height);

            // Draw Item Icon (Centered & Aspect Ratio Preserved)
            let img = null;
            if (block.type === 'yuikun' && yuikunImg.complete) img = yuikunImg;
            if (block.type === 'yukarin' && yukarinImg.complete) img = yukarinImg;

            if (img) {
                // Max size within block (80% of block size)
                const maxW = block.width * 0.8;
                const maxH = block.height * 0.8;
                const imgRatio = img.width / img.height;

                let drawW = maxW;
                let drawH = drawW / imgRatio;

                // Adjust if height exceeds max
                if (drawH > maxH) {
                    drawH = maxH;
                    drawW = drawH * imgRatio;
                }

                // Center position
                const drawX = block.x + (block.width - drawW) / 2;
                const drawY = block.y + (block.height - drawH) / 2;

                ctx.drawImage(img, drawX, drawY, drawW, drawH);
            }
        }
    });

    // Paddle
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.roundRect(state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height, 10);
    ctx.fill();

    // Balls
    state.balls.forEach(ball => {
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#BF360C';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    });
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'absolute';
    toast.style.top = '20%';
    toast.style.left = '50%';
    toast.style.transform = 'translate(-50%, -50%)';
    toast.style.background = 'rgba(255, 152, 0, 0.9)'; // Orange
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '1.2rem';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '100';
    toast.style.animation = 'pop 0.5s ease-out';
    toast.style.whiteSpace = 'nowrap';
    document.getElementById('game-container').appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function getBlockColor(y) {
    // Return color based on Y position (Visual flair)
    // Tottori theme colors? Sand, Sea, Pear?
    // Let's use standard breakout colors for visibility against photo.
    // But blocks must be OPAQUE.
    return '#87CEEB'; // Sky Blue
}

function gameOver() {
    gameState = 'GAME_OVER';
    gameOverScreen.classList.add('active');

    // SDK Record
    if (typeof GameParkSDK !== 'undefined') {
        GameParkSDK.recordGameResult(state.score * 10, 0.5); // 1 block = 10 pts
    }
}

function gameClear() {
    gameState = 'GAME_CLEAR';
    gameClearScreen.classList.add('active');
    // Set preview image
    clearImagePreview.style.backgroundImage = `url(${currentImage})`;

    // SDK Record
    if (typeof GameParkSDK !== 'undefined') {
        const bonus = (currentLevel === 'hard' ? 1000 : (currentLevel === 'normal' ? 500 : 300));
        GameParkSDK.recordGameResult((state.score * 10) + bonus, 1.0);
    }
}
