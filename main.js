// Matter.js モジュールのエイリアス
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Composite = Matter.Composite,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Events = Matter.Events,
    World = Matter.World;

// ゲーム設定
const CONFIG = {
    wallThickness: 20,
    deadLineY: 80, // ラインを上げて猶予を増やす (120 -> 80)
};

// キャラクターデータ
const BALL_LEVELS = [
    { level: 1, radius: 22, score: 0, img: './画像/simple.png' },
    { level: 2, radius: 30, score: 2, img: './画像/fumufumu-Photoroom.png' },
    { level: 3, radius: 38, score: 4, img: './画像/ageru-Photoroom.png' },
    { level: 4, radius: 46, score: 8, img: './画像/ureshi.jpeg' },
    { level: 5, radius: 56, score: 16, img: './画像/yatta-Photoroom.png' },
    { level: 6, radius: 68, score: 32, img: './画像/love-Photoroom.png' },
    { level: 7, radius: 81, score: 64, img: './画像/IMG_0453.PNG' },
    { level: 8, radius: 95, score: 128, img: './画像/IMG_0454.PNG' },
    { level: 9, radius: 110, score: 256, img: './画像/IMG_0455.PNG' },
    { level: 10, radius: 130, score: 512, img: './画像/IMG_0456.PNG' },
    { level: 11, radius: 150, score: 1000, img: './画像/アイコン.png' },
];

// ミッション定義
const MISSIONS = [
    { id: 'mission_100', text: '初めの一歩 (100pt)', check: (score, balls) => score >= 100 },
    { id: 'mission_lv5', text: 'プチシンカ (Lv.5作成)', check: (score, balls) => balls.some(b => b.label.includes('ball_5')) },
    { id: 'mission_500', text: '脱・初心者 (500pt)', check: (score, balls) => score >= 500 },
    { id: 'mission_lv8', text: 'ベテラン (Lv.8作成)', check: (score, balls) => balls.some(b => b.label.includes('ball_8')) },
    { id: 'mission_1500', text: '名人 (1500pt)', check: (score, balls) => score >= 1500 },
    { id: 'mission_lv11', text: 'GAME CLEAR (Lv.11作成)', check: (score, balls) => balls.some(b => b.label.includes('ball_11')) }
];

// ステート変数
let engine, render, runner;
let currentScore = 0;
let nextBallLevel = 0;
let isGameOver = false;
let canDrop = true;
let gameOverTimer = 0;
let gameState = 'TITLE'; // TITLE, PLAYING, GAMEOVER

// DOM要素
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const nextBallPreviewEl = document.getElementById('next-ball-preview');
const gameOverScreen = document.getElementById('game-over-screen');
const titleScreen = document.getElementById('title-screen');
const retryBtn = document.getElementById('retry-btn');
const titleBtn = document.getElementById('title-btn');
const startBtn = document.getElementById('start-btn');
const container = document.getElementById('canvas-container');
const toastContainer = document.getElementById('toast-container');
const missionListEl = document.getElementById('mission-list');

// 初期化
function init() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    engine = Engine.create();

    // Canvas作成
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    container.innerHTML = '';
    container.appendChild(canvas);

    // Retina対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    createWalls(width, height);
    setupEvents();
    setNextBall();
    updateMissionDisplay(); // タイトル画面のミッションリスト更新

    // 描画ループ開始
    startRenderLoop(ctx, width, height);

    // Runner開始（物理演算）
    runner = Runner.create();
    Runner.run(runner, engine);

    Events.on(engine, 'collisionStart', handleCollision);

    // 画像プリロード
    preloadImages();
}

const imgCache = {};
function preloadImages() {
    BALL_LEVELS.forEach(b => {
        const img = new Image();
        img.src = b.img;
        imgCache[b.img] = img;
    });
}

function startRenderLoop(ctx, width, height) {
    (function renderLoop() {
        const bodies = Composite.allBodies(engine.world);

        ctx.clearRect(0, 0, width, height);

        // デッドライン描画
        ctx.beginPath();
        ctx.moveTo(0, CONFIG.deadLineY);
        ctx.lineTo(width, CONFIG.deadLineY);
        if (gameOverTimer > 0) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(Date.now() / 100) * 0.5})`;
        } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        }
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);

        // ボディ描画
        for (let i = 0; i < bodies.length; i += 1) {
            const body = bodies[i];
            if (body.render.visible === false) continue;

            ctx.save();
            ctx.translate(body.position.x, body.position.y);
            ctx.rotate(body.angle);

            if (!body.label.startsWith('ball_')) {
                ctx.beginPath();
                const vertices = body.vertices;
                ctx.moveTo(vertices[0].x - body.position.x, vertices[0].y - body.position.y);
                for (let j = 1; j < vertices.length; j += 1) {
                    ctx.lineTo(vertices[j].x - body.position.x, vertices[j].y - body.position.y);
                }
                ctx.closePath();
                ctx.fillStyle = body.render.fillStyle;
                ctx.fill();
            } else {
                const r = body.circleRadius;
                const sprite = body.render.sprite;

                ctx.beginPath();
                ctx.arc(0, 0, r, 0, 2 * Math.PI);
                ctx.closePath();
                ctx.save();
                ctx.clip();

                ctx.fillStyle = '#ffffff';
                ctx.fill();

                if (sprite && sprite.texture) {
                    const img = imgCache[sprite.texture];
                    if (img && img.complete && img.naturalWidth !== 0) {
                        const w = img.width * sprite.xScale;
                        const h = img.height * sprite.yScale;
                        ctx.drawImage(img, -w / 2, -h / 2, w, h);
                    } else {
                        ctx.fillStyle = '#ffecb3';
                        ctx.fill();
                    }
                }
                ctx.restore();

                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();
        }

        if (!isGameOver) {
            requestAnimationFrame(renderLoop);
        }
    })();
}

function createWalls(width, height) {
    const ground = Bodies.rectangle(width / 2, height, width, CONFIG.wallThickness * 2, {
        isStatic: true,
        render: { fillStyle: '#8d6e63' }
    });

    const wallHeight = height * 2;

    const leftWall = Bodies.rectangle(0, height / 2, CONFIG.wallThickness, wallHeight, {
        isStatic: true,
        render: { fillStyle: '#8d6e63' }
    });

    const rightWall = Bodies.rectangle(width, height / 2, CONFIG.wallThickness, wallHeight, {
        isStatic: true,
        render: { fillStyle: '#8d6e63' }
    });

    World.add(engine.world, [ground, leftWall, rightWall]);
}

function handleCollision(event) {
    if (gameState !== 'PLAYING') return;

    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        if (bodyA.label.startsWith('ball_') && bodyB.label.startsWith('ball_')) {
            const levelA = parseInt(bodyA.label.split('_')[1]);
            const levelB = parseInt(bodyB.label.split('_')[1]);

            if (levelA === levelB && levelA < BALL_LEVELS.length) {
                if (bodyA.isRemoved || bodyB.isRemoved) continue;

                bodyA.isRemoved = true;
                bodyB.isRemoved = true;

                const newX = (bodyA.position.x + bodyB.position.x) / 2;
                const newY = (bodyA.position.y + bodyB.position.y) / 2;

                World.remove(engine.world, [bodyA, bodyB]);

                const nextLevel = levelA + 1;
                const nextBallData = BALL_LEVELS.find(b => b.level === nextLevel);

                if (nextBallData) {
                    addScore(nextBallData.score);
                    createBall(newX, newY, nextLevel - 1, false);
                }
            }
        }
    }
}

function createBall(x, y, index, isSensor = false) {
    const ballData = BALL_LEVELS[index];
    if (!ballData) return;

    const r = ballData.radius;

    const ball = Bodies.circle(x, y, r, {
        label: `ball_${ballData.level}`,
        restitution: 0.3,
        friction: 0.1,
        density: 0.04,
        isSensor: isSensor,
        render: {
            sprite: {
                texture: ballData.img,
                xScale: 1,
                yScale: 1
            }
        }
    });

    const img = new Image();
    img.src = ballData.img;
    img.onload = () => {
        const scale = (r * 2) / Math.max(img.width, img.height);
        ball.render.sprite.xScale = scale;
        ball.render.sprite.yScale = scale;
    };
    if (img.complete && img.naturalWidth > 0) {
        const scale = (r * 2) / Math.max(img.width, img.height);
        ball.render.sprite.xScale = scale;
        ball.render.sprite.yScale = scale;
    }

    World.add(engine.world, ball);

    // ボール生成時にもミッションチェック（Lv.11作成など）
    setTimeout(checkMissions, 100);

    return ball;
}

function setNextBall() {
    nextBallLevel = Math.floor(Math.random() * 5);
    const ballData = BALL_LEVELS[nextBallLevel];
    nextBallPreviewEl.innerHTML = `<img src="${ballData.img}" alt="Next">`;
}

function setupEvents() {
    container.addEventListener('mousedown', handleInput);
    container.addEventListener('touchstart', handleInput, { passive: false });

    startBtn.addEventListener('click', startGame);
    retryBtn.addEventListener('click', resetGame);
    titleBtn.addEventListener('click', () => location.reload()); // タイトルへはリロード

    // 進化リスト生成
    generateEvolutionList();
}

function generateEvolutionList() {
    const listContainer = document.getElementById('evo-list-content');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    BALL_LEVELS.forEach((ball) => {
        const item = document.createElement('div');
        item.className = 'evo-item';

        item.innerHTML = `
            <div class="evo-img">
                <img src="${ball.img}" alt="Lv.${ball.level}">
            </div>
            <div class="evo-info">
                <div>Lv.${ball.level}</div>
                <div>${ball.score}pt</div>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function startGame() {
    titleScreen.classList.add('hidden');
    gameState = 'PLAYING';
}

function handleInput(e) {
    if (gameState !== 'PLAYING' || isGameOver || !canDrop) return;

    if (e.target.closest('button') || e.target.closest('#evolution-container')) return;

    e.preventDefault();

    const rect = container.getBoundingClientRect();
    let clientX = e.clientX;

    if (e.type === 'touchstart') {
        if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
        }
    }

    const x = clientX - rect.left;
    const y = 50;

    // 壁の判定
    const clampedX = Math.max(CONFIG.wallThickness + BALL_LEVELS[nextBallLevel].radius,
        Math.min(x, container.clientWidth - CONFIG.wallThickness - BALL_LEVELS[nextBallLevel].radius));

    dropBall(clampedX, y);
}

function dropBall(x, y) {
    canDrop = false;
    createBall(x, y, nextBallLevel);
    setTimeout(() => {
        setNextBall();
        canDrop = true;
    }, 500);
}

function addScore(val) {
    currentScore += val;
    scoreEl.textContent = currentScore;
    checkMissions();
}

function checkMissions() {
    const stored = JSON.parse(localStorage.getItem('torivo_missions') || '{}');
    const balls = Composite.allBodies(engine.world);
    let updated = false;

    MISSIONS.forEach(mission => {
        if (!stored[mission.id]) {
            if (mission.check(currentScore, balls)) {
                stored[mission.id] = true;
                showToast(`ミッション達成！ ${mission.text}`);
                updated = true;
            }
        }
    });

    if (updated) {
        localStorage.setItem('torivo_missions', JSON.stringify(stored));
        updateMissionDisplay();
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🎉</span><span>${msg}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function updateMissionDisplay() {
    const stored = JSON.parse(localStorage.getItem('torivo_missions') || '{}');
    missionListEl.innerHTML = '';

    MISSIONS.forEach(m => {
        const li = document.createElement('li');
        li.className = 'mission-item' + (stored[m.id] ? ' cleared' : '');
        li.innerHTML = stored[m.id] ? `✅ ${m.text}` : `⬜ ${m.text}`;
        missionListEl.appendChild(li);
    });
}

function resetGame() {
    // リロードせずリセット
    const allBodies = Composite.allBodies(engine.world);
    const balls = allBodies.filter(b => b.label.startsWith('ball_'));
    World.remove(engine.world, balls);

    currentScore = 0;
    scoreEl.textContent = 0;
    isGameOver = false;
    gameOverTimer = 0;
    gameOverScreen.classList.add('hidden');
    canDrop = true;
    setNextBall();
    gameState = 'PLAYING';
}

// ゲームオーバー判定
setInterval(() => {
    if (gameState !== 'PLAYING' || isGameOver) return;

    const balls = Composite.allBodies(engine.world).filter(b => b.label.startsWith('ball_'));
    let isDanger = false;

    for (let ball of balls) {
        if (ball.position.y < CONFIG.deadLineY) {
            if (Math.abs(ball.velocity.y) < 0.2 && Math.abs(ball.velocity.x) < 0.2) {
                isDanger = true;
                break;
            }
        }
    }

    if (isDanger) {
        gameOverTimer += 1;
        if (gameOverTimer >= 3) {
            showGameOver();
        }
    } else {
        gameOverTimer = 0;
    }
}, 1000);

function showGameOver() {
    isGameOver = true;
    gameState = 'GAMEOVER';
    finalScoreEl.textContent = currentScore;

    // SDK連携: スコアとコインを保存
    if (typeof GameParkSDK !== 'undefined') {
        // スイカゲームはスコアが高くなりやすいので調整 (0.5倍)
        GameParkSDK.recordGameResult(Math.floor(currentScore * 0.5), Math.floor((currentScore * 0.5) * 0.2));
    }
    gameOverScreen.classList.remove('hidden');
}

window.onload = init;
