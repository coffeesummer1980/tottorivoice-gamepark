/**
 * ゆかりんぱっくんゲーム（ゼロから作り直し版）
 * 
 * ■ 設計方針
 *   - 全ての画像を事前にロードし、連想配列（imageMap）に格納
 *   - draw()時は imageMap から取得するだけ（毎フレーム new Image しない）
 *   - ステータスバーはCSSクラス「playing」で非表示制御
 *   - アイテム生成はフレームカウンタベースで確実に制御
 */

// ============================================
// 画像パス定義（英語ファイル名のみ使用）
// ============================================
const IMAGE_PATHS = {
    playerNormal: 'characters/normal.png',
    playerEating: 'characters/eating.png',
    playerHappy: 'characters/happy.png',
    playerDamage: 'characters/damage.png',
    food1: 'tottorifood/22688827.png',
    food2: 'tottorifood/25697136.png',
    food3: 'tottorifood/2633445.png',
    food4: 'tottorifood/27188544.png',
    food5: 'tottorifood/470916.png',
    poison: 'tottorifood/mushroom_poison.png'
};

const FOOD_KEYS = ['food1', 'food2', 'food3', 'food4', 'food5'];

// ============================================
// ゲーム設定
// ============================================
const CONFIG = {
    playerBottomRatio: 0.85,
    playerWidthRatio: 0.22,
    foodSizeRatio: 0.12,
    baseSpeed: 2.0,
    spawnFrames: 90,       // 何フレームごとにアイテム生成
    levelUpEvery: 5,        // 何個食べたらレベルアップ
};

// ============================================
// グローバル変数
// ============================================
const imageMap = {};               // ロード済み画像を格納
let canvas, ctx;
let animFrameId = null;
let frameCount = 0;

let gameState = 'loading';         // loading | title | playing | gameover
let score = 0;
let level = 1;
let eatenCount = 0;
let spawnCount = 0;                // 生成したアイテムの総数
let poisonShownInLevel1 = false;   // レベル1で毒キノコを出したかどうか

// プレイヤー
const player = {
    x: 0, y: 0, w: 0, h: 0,
    targetX: 0,
    face: 'playerNormal',
    faceTimer: 0
};

// 落下アイテム配列
let items = [];

// ============================================
// 画像ロード（Promise ベース）
// ============================================
function loadAllImages() {
    const entries = Object.entries(IMAGE_PATHS);
    let loaded = 0;
    const total = entries.length;

    return new Promise((resolve, reject) => {
        entries.forEach(([key, path]) => {
            const img = new Image();
            img.onload = () => {
                imageMap[key] = img;
                loaded++;
                console.log(`画像ロード完了 (${loaded}/${total}): ${key}`);
                if (loaded === total) {
                    resolve();
                }
            };
            img.onerror = () => {
                console.error(`画像ロード失敗: ${key} (${path})`);
                // ロード失敗してもゲームは動くようにする
                imageMap[key] = null;
                loaded++;
                if (loaded === total) {
                    resolve();
                }
            };
            img.src = path;
        });
    });
}

// ============================================
// 初期化
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // SDK初期化
    if (typeof GameParkSDK !== 'undefined') {
        GameParkSDK.renderStatusBar('#game-status-bar');
    }

    // キャンバスサイズ設定
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 入力設定
    setupInput();

    // 画像を全部ロード
    await loadAllImages();
    console.log('全画像ロード完了！', Object.keys(imageMap));

    // タイトル画面へ
    gameState = 'title';
    setupPlayerSize();

    // ボタンイベント
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('retry-btn').addEventListener('click', startGame);
});

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    setupPlayerSize();
}

function setupPlayerSize() {
    player.w = canvas.width * CONFIG.playerWidthRatio;
    // アスペクト比をnormal画像から取得
    const normalImg = imageMap['playerNormal'];
    if (normalImg) {
        player.h = player.w * (normalImg.height / normalImg.width);
    } else {
        player.h = player.w; // フォールバック
    }
    // キャラを画面下端に配置し、上部40%（顔）だけ見えるようにする
    // player.h の 60% が画面外に出る位置
    player.y = canvas.height - player.h * 0.45;
    if (!player.x) {
        player.x = (canvas.width - player.w) / 2;
        player.targetX = player.x;
    }
}

// ============================================
// 入力処理
// ============================================
function setupInput() {
    function getX(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        return clientX - rect.left;
    }

    function onMove(e) {
        if (gameState !== 'playing') return;
        const x = getX(e);
        // 画面上の座標をキャンバス内部座標に変換
        const scaleX = canvas.width / canvas.getBoundingClientRect().width;
        player.targetX = (x * scaleX) - player.w / 2;
        // 範囲制限
        player.targetX = Math.max(0, Math.min(canvas.width - player.w, player.targetX));
    }

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
}

// ============================================
// ゲーム開始
// ============================================
function startGame() {
    score = 0;
    level = 1;
    eatenCount = 0;
    spawnCount = 0;
    poisonShownInLevel1 = false;
    items = [];
    frameCount = 0;
    gameState = 'playing';

    player.x = (canvas.width - player.w) / 2;
    player.targetX = player.x;
    player.face = 'playerNormal';
    player.faceTimer = 0;

    // UI切り替え
    document.getElementById('score-val').textContent = '0';
    document.getElementById('score-display').classList.remove('hidden');
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');

    // ステータスバーを隠す
    const sb = document.getElementById('game-status-bar');
    if (sb) sb.classList.add('playing');

    // ゲームループ開始
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(loop);
}

// ============================================
// ゲームループ
// ============================================
function loop() {
    if (gameState !== 'playing') return;

    update();
    draw();

    animFrameId = requestAnimationFrame(loop);
}

// ============================================
// 更新処理
// ============================================
function update() {
    frameCount++;

    // --- プレイヤー移動（イージング） ---
    player.x += (player.targetX - player.x) * 0.25;

    // --- 表情タイマー ---
    if (player.faceTimer > 0) {
        player.faceTimer--;
        if (player.faceTimer <= 0) {
            player.face = 'playerNormal';
        }
    }

    // --- アイテム生成 ---
    // レベル1では画面上にアイテムが0個の時だけ生成（チュートリアル的）
    if (level === 1) {
        if (items.length === 0) {
            spawnItem();
        }
    } else {
        // レベル2以降はフレームカウンタベースで定期的に生成
        const interval = Math.max(20, CONFIG.spawnFrames - level * 5);
        if (frameCount % interval === 0) {
            spawnItem();
        }
    }

    // --- アイテム移動＆判定 ---
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += item.speed;
        item.angle += item.spin;

        // 当たり判定（中心同士の距離）
        const ix = item.x + item.size / 2;
        const iy = item.y + item.size / 2;
        const px = player.x + player.w / 2;
        // 当たり判定は見えている部分（顔の中心）で行う
        const visibleTop = player.y;
        const visibleH = player.h * 0.4;
        const py = visibleTop + visibleH / 2;
        const dist = Math.hypot(ix - px, iy - py);
        const hitRange = (player.w + item.size) * 0.35;

        if (dist < hitRange) {
            onCatch(item);
            items.splice(i, 1);
            continue;
        }

        // 画面外（下に落ちた）
        if (item.y > canvas.height + item.size) {
            items.splice(i, 1);
        }
    }
}

// ============================================
// アイテム生成
// ============================================
function spawnItem() {
    spawnCount++;
    let isPoison = false;

    if (level === 1) {
        // レベル1の3個目だけ毒キノコ（1回限り）
        if (spawnCount === 3 && !poisonShownInLevel1) {
            isPoison = true;
            poisonShownInLevel1 = true;
        } else {
            isPoison = false;
        }
    } else {
        isPoison = Math.random() < (0.1 + level * 0.02);
    }

    const size = canvas.width * CONFIG.foodSizeRatio;
    const speed = CONFIG.baseSpeed * (1 + level * 0.08) * (0.8 + Math.random() * 0.4);

    let imgKey;
    if (isPoison) {
        imgKey = 'poison';
    } else {
        imgKey = FOOD_KEYS[Math.floor(Math.random() * FOOD_KEYS.length)];
    }

    items.push({
        type: isPoison ? 'poison' : 'food',
        imgKey: imgKey,
        x: Math.random() * (canvas.width - size),
        y: -size,
        size: size,
        speed: speed,
        angle: 0,
        spin: (Math.random() - 0.5) * 0.06
    });
}

// ============================================
// キャッチ処理
// ============================================
function onCatch(item) {
    if (item.type === 'poison') {
        doGameOver();
        return;
    }

    // 食べた！
    score += 10 * level;
    eatenCount++;
    document.getElementById('score-val').textContent = score;

    // 表情変更
    player.face = 'playerEating';
    player.faceTimer = 30; // 30フレーム（約0.5秒）

    // レベルアップ
    if (eatenCount % CONFIG.levelUpEvery === 0) {
        level++;
    }
}

// ============================================
// ゲームオーバー
// ============================================
function doGameOver() {
    gameState = 'gameover';
    player.face = 'playerDamage';

    // 最後の描画
    draw();

    // SDK記録
    if (typeof GameParkSDK !== 'undefined') {
        GameParkSDK.recordGameResult(score);
    }

    // ステータスバー再表示
    const sb = document.getElementById('game-status-bar');
    if (sb) sb.classList.remove('playing');

    // スコア表示を隠す
    document.getElementById('score-display').classList.add('hidden');

    // 少し間を置いてゲームオーバー画面表示
    setTimeout(() => {
        document.getElementById('final-score').textContent = score;

        let msg = 'ドンマイ！次はいける！';
        if (score >= 1000) {
            msg = '伝説の爆食い！！🎉';
        } else if (score >= 500) {
            msg = 'すごい！お腹いっぱい！😋';
        } else if (score >= 200) {
            msg = 'なかなかやるね！🍱';
        }
        document.getElementById('result-message').textContent = msg;
        document.getElementById('gameover-screen').classList.remove('hidden');
    }, 800);
}

// ============================================
// 描画処理
// ============================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- プレイヤー描画（顔だけ表示、服は画面外） ---
    const playerImg = imageMap[player.face];
    if (playerImg) {
        // キャンバスの下端を超えないようクリッピング
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.clip();
        ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
        ctx.restore();
    } else {
        // フォールバック（ピンクの丸）
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + player.h * 0.2, player.w / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- アイテム描画 ---
    for (const item of items) {
        const img = imageMap[item.imgKey];

        ctx.save();
        ctx.translate(item.x + item.size / 2, item.y + item.size / 2);
        ctx.rotate(item.angle);

        if (img) {
            ctx.drawImage(img, -item.size / 2, -item.size / 2, item.size, item.size);
        } else {
            // フォールバック（色付きの丸）
            ctx.beginPath();
            ctx.arc(0, 0, item.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = item.type === 'poison' ? '#9C27B0' : '#FF9800';
            ctx.fill();
        }

        ctx.restore();
    }
}
