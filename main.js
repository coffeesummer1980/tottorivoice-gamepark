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
    wallThickness: 20, // 壁の厚さ
    deadLineY: 150, // ゲームオーバーライン（上からの距離）
};

// キャラクターデータ（レベル定義）
const BALL_LEVELS = [
    { level: 1, radius: 22, score: 0, img: './画像/simple.png' },
    { level: 2, radius: 30, score: 2, img: './画像/fumufumu.jpeg' },
    { level: 3, radius: 38, score: 4, img: './画像/ageru.jpeg' },
    { level: 4, radius: 46, score: 8, img: './画像/ureshi.jpeg' },
    { level: 5, radius: 56, score: 16, img: './画像/yatta.jpeg' },
    { level: 6, radius: 68, score: 32, img: './画像/love.jpeg' },
    { level: 7, radius: 81, score: 64, img: './画像/IMG_0453.PNG' },
    { level: 8, radius: 95, score: 128, img: './画像/IMG_0454.PNG' },
    { level: 9, radius: 110, score: 256, img: './画像/IMG_0455.PNG' },
    { level: 10, radius: 130, score: 512, img: './画像/IMG_0456.PNG' },
    { level: 11, radius: 150, score: 1000, img: './画像/アイコン.png' },
];

// ステート変数
let engine, render, runner;
let currentScore = 0;
let nextBallLevel = 0; // 次に落ちるボールのインデックス (0~4)
let isGameOver = false;
let canDrop = true; // 連続投下防止フラグ
let previewBall = null; // 落下位置ガイド用のボール（今回は簡易的に非表示の要素で管理）
let gameOverTimer = 0; // デッドライン判定用タイマー

// DOM要素
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const nextBallPreviewEl = document.getElementById('next-ball-preview');
const gameOverScreen = document.getElementById('game-over-screen');
const retryBtn = document.getElementById('retry-btn');
const container = document.getElementById('canvas-container');

// 初期化
function init() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Matter.js エンジン作成
    engine = Engine.create();

    // カスタム描画用のCanvas作成
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    container.innerHTML = ''; // クリア
    container.appendChild(canvas);

    // Retina対応（高解像度化）
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // 壁の作成
    createWalls(width, height);

    // イベントリスナー設定
    setupEvents();

    // 最初のNextボール設定
    setNextBall();

    // ランナー作成と実行
    runner = Runner.create();
    Runner.run(runner, engine);

    // 衝突検知
    Events.on(engine, 'collisionStart', handleCollision);

    // 画像プリロード用キャッシュ
    const imgCache = {};
    BALL_LEVELS.forEach(b => {
        const img = new Image();
        img.src = b.img;
        imgCache[b.img] = img;
    });

    // カスタム描画ループ
    (function renderLoop() {
        const bodies = Composite.allBodies(engine.world);

        // 背景クリア
        ctx.clearRect(0, 0, width, height);

        // デッドライン描画（点線）
        ctx.beginPath();
        ctx.moveTo(0, CONFIG.deadLineY);
        ctx.lineTo(width, CONFIG.deadLineY);
        // 赤色、点線
        if (gameOverTimer > 0) {
            // 警告中は太く
            ctx.lineWidth = 4;
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(Date.now() / 100) * 0.5})`; // 点滅
        } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        }
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]); // 点線リセット

        // ボディの描画
        for (let i = 0; i < bodies.length; i += 1) {
            const body = bodies[i];

            if (body.render.visible === false) {
                continue;
            }

            ctx.save();
            ctx.translate(body.position.x, body.position.y);
            ctx.rotate(body.angle);

            // 壁（四角形）の描画
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
            }
            // ボール（円形・画像）の描画
            else {
                const r = body.circleRadius;
                const sprite = body.render.sprite;

                // 丸く切り抜くためのパス
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, 2 * Math.PI);
                ctx.closePath();

                ctx.save();
                ctx.clip(); // 切り抜き実行

                // ★ここで白背景を描く（透過PNG対策）
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                if (sprite && sprite.texture) {
                    const img = imgCache[sprite.texture];
                    if (img && img.complete && img.naturalWidth !== 0) {
                        // 画像描画
                        const w = img.width * sprite.xScale;
                        const h = img.height * sprite.yScale;
                        ctx.drawImage(img, -w / 2, -h / 2, w, h);
                    } else {
                        // 画像ロード前
                        ctx.fillStyle = '#ffecb3';
                        ctx.fill();
                    }
                } else {
                    ctx.fillStyle = '#ffecb3';
                    ctx.fill();
                }
                ctx.restore(); // クリップ解除

                // 枠線
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

// 壁の作成（U字型）
function createWalls(width, height) {
    const ground = Bodies.rectangle(width / 2, height, width, CONFIG.wallThickness * 2, {
        isStatic: true,
        render: { fillStyle: '#8d6e63' }
    });

    // 天井が高すぎるとボールが抜けることがあるので、壁を目一杯伸ばす
    // スマホなど縦長画面に対応するためheightを基準に
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

// 衝突処理（進化）
function handleCollision(event) {
    if (isGameOver) return;

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

// ボール生成関数
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

    // 画像サイズに合わせてスケールを更新
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
    return ball;
}

// 次のボールを設定
function setNextBall() {
    nextBallLevel = Math.floor(Math.random() * 5);
    const ballData = BALL_LEVELS[nextBallLevel];
    nextBallPreviewEl.innerHTML = `<img src="${ballData.img}" alt="Next">`;
}

// イベント設定
function setupEvents() {
    // Canvas領域以外でも反応しないように、ターゲットをcanvasに限定したいが
    // タッチ判定を広くとるならcontainerイベントのままで。
    // ただし進化リストのスクロールを阻害しないように注意が必要。

    // PC
    container.addEventListener('mousedown', handleInput);

    // Mobile: container内のtouchのみpreventDefaultする
    // これにより進化リストのスクロールは生きる
    container.addEventListener('touchstart', handleInput, { passive: false });

    retryBtn.addEventListener('click', resetGame);
    gameOverScreen.addEventListener('click', resetGame);

    // 進化リスト生成
    generateEvolutionList();
}

function generateEvolutionList() {
    const listContainer = document.getElementById('evo-list-content');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    BALL_LEVELS.forEach((ball, index) => {
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

        // 矢印
        if (index < BALL_LEVELS.length - 1) {
            const arrowDiv = document.createElement('div');
            arrowDiv.className = 'evo-arrow';
            // PC版は縦並びなので下向き▼、スマホ版はCssで回転させて右向き▶にする
            arrowDiv.innerHTML = '▼';
            listContainer.appendChild(arrowDiv);
        }
    });

    // CSSでスマホ表示時に矢印の向きやレイアウトを変える想定
}


function handleInput(e) {
    if (isGameOver || !canDrop) return;

    // ターゲットがコントロール類なら無視
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

    // クリック位置がコンテナ外（EvolutionListなど）を含む場合のY座標チェック
    // container内イベントなのでxはcontainer内の相対座標になるが
    // 一応範囲チェック

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
}

function resetGame() {
    location.reload(); // Matter.jsのリセットが面倒なのでリロードで対応（ステート完全初期化）
    /*
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
    // 描画ループを再開する仕組みが必要（isGameOverで止めている場合）
    */
}

// ゲームオーバー判定（毎秒実行）
setInterval(() => {
    if (isGameOver) return;

    const balls = Composite.allBodies(engine.world).filter(b => b.label.startsWith('ball_'));
    let isDanger = false;

    for (let ball of balls) {
        // デッドラインを超えているか
        if (ball.position.y < CONFIG.deadLineY) {
            // かつ静止に近い状態
            if (Math.abs(ball.velocity.y) < 0.2 && Math.abs(ball.velocity.x) < 0.2) {
                isDanger = true;
                break;
            }
        }
    }

    if (isDanger) {
        gameOverTimer += 1; // 1秒経過
        console.log("Danger count:", gameOverTimer);
        if (gameOverTimer >= 3) { // 3秒続いたらアウト
            showGameOver();
        }
    } else {
        gameOverTimer = 0; // 解消されたらリセット
    }
}, 1000);

function showGameOver() {
    isGameOver = true;
    finalScoreEl.textContent = currentScore;
    gameOverScreen.classList.remove('hidden');
    // 描画ループは requestAnimationFrame 内で isGameOver チェックして止まる
}

// 起動
window.onload = init;
