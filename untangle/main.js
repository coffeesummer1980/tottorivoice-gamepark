/**
 * 星座Untangleパズル
 * main.js
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const resetBtn = document.getElementById('reset-btn');
const nextBtn = document.getElementById('next-btn');
const clearOverlay = document.getElementById('clear-overlay');

// 画面サイズ設定
let width, height;
function resize() {
    // 最小サイズを保証して0除算などを防ぐ
    width = Math.max(window.innerWidth, 320);
    height = Math.max(window.innerHeight, 320);

    canvas.width = width;
    canvas.height = height;

    // スマホなど高解像度対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}
window.addEventListener('resize', resize);
resize();

// ==========================================
// ゲームデータ
// ==========================================

// 星クラス
class Star {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 16; // タップ判定サイズ
        this.visualRadius = 8; // 表示サイズ
        this.isDragging = false;
        this.color = '#ffffff';
    }

    draw(ctx) {
        // 光彩（ぼかし）
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.visualRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();

        // ドラッグ中の強調
        if (this.isDragging) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();
        }

        ctx.shadowBlur = 0; // リセット
    }
}

// 接続定義 (平面グラフになるように設定)
// 今回は「家」のような形状 + α で構成
// 6ノード
const levelEdges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // 外周
    [0, 2], [0, 3], // 内部線
    [3, 5]          // 内部線
];

let stars = [];
let draggingStar = null;
let isGameClear = false;

// ==========================================
// 初期化
// ==========================================
function initGame() {
    stars = [];
    draggingStar = null;
    isGameClear = false;

    // オーバーレイを隠す
    clearOverlay.classList.remove('visible');

    // 星をランダム配置
    // 画面中央を中心にある程度散らばらせる
    const centerX = width / 2;
    const centerY = height / 2;
    // 画面端に行き過ぎないように調整
    const range = Math.min(width, height) * 0.35;

    for (let i = 0; i < 6; i++) {
        // 完全ランダム配置 (計算やループなしで即時開始)
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * range;

        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;

        stars.push(new Star(i, x, y));
    }

    // クリア判定はdrawループで行うが、
    // 万が一最初からクリア状態でも即座にゲーム開始されるようにする
    // 「思考」ループは一切なし
}

// ==========================================
// 交差判定ロジック
// ==========================================

// 2つの線分 (p1-p2) と (p3-p4) が交差しているか判定
// 端点の共有は交差とみなさない
function getLineIntersection(p1, p2, p3, p4) {
    // 端点が共有されているかチェック（隣接している場合は交差ではない）
    if (p1 === p3 || p1 === p4 || p2 === p3 || p2 === p4) {
        return false;
    }

    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (det === 0) {
        return false; // 平行
    }

    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

// 全てのエッジの交差状態をチェック
function checkIntersections() {
    if (stars.length === 0) return { edgeStates: [], totalIntersections: 0 };

    const edgeStates = levelEdges.map(() => false);
    let totalIntersections = 0;

    for (let i = 0; i < levelEdges.length; i++) {
        for (let j = i + 1; j < levelEdges.length; j++) {
            const e1 = levelEdges[i];
            const e2 = levelEdges[j];

            const s1 = stars[e1[0]];
            const s2 = stars[e1[1]];
            const s3 = stars[e2[0]];
            const s4 = stars[e2[1]];

            // 安全策：星が存在しない場合はスキップ
            if (!s1 || !s2 || !s3 || !s4) continue;

            if (getLineIntersection(s1, s2, s3, s4)) {
                edgeStates[i] = true;
                edgeStates[j] = true;
                totalIntersections++;
            }
        }
    }

    return { edgeStates, totalIntersections };
}

// ==========================================
// 描画ループ & 更新
// ==========================================

function draw() {
    // 背景クリア
    ctx.clearRect(0, 0, width, height);

    // 交差チェック
    const { edgeStates, totalIntersections } = checkIntersections();

    // クリア判定
    if (totalIntersections === 0 && !isGameClear && !draggingStar && stars.length > 0) {
        // ドラッグ中でなく、交差ゼロならクリア
        gameClear();
    }

    // --- エッジの描画 ---
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (let i = 0; i < levelEdges.length; i++) {
        const e = levelEdges[i];
        const s1 = stars[e[0]];
        const s2 = stars[e[1]];
        if (!s1 || !s2) continue; // 安全策

        const isIntersecting = edgeStates[i];

        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);

        if (isGameClear) {
            // クリア時は黄色/金色
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 10;
        } else if (isIntersecting) {
            // 交差時は赤
            ctx.strokeStyle = '#ff5252';
            ctx.shadowColor = '#ff5252';
            ctx.shadowBlur = 5;
        } else {
            // 通常時は薄い白
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.shadowBlur = 0;
        }

        ctx.stroke();
        // Shadowリセット
        ctx.shadowBlur = 0;
    }

    // --- 星の描画 ---
    for (const star of stars) {
        star.draw(ctx);
    }

    requestAnimationFrame(draw);
}

// ==========================================
// イベントハンドリング
// ==========================================

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function handleStart(e) {
    if (isGameClear) return;
    // タッチ操作のデフォルト動作（スクロールなど）を防ぐ
    if (e.cancelable) e.preventDefault();

    const pos = getPointerPos(e);

    // クリック位置に近い星を探す（逆順で描画手前のものを優先）
    for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        const dx = pos.x - s.x;
        const dy = pos.y - s.y;
        // 半径より少し広めに判定
        if (dx * dx + dy * dy < (s.radius * 2.5) ** 2) {
            draggingStar = s;
            s.isDragging = true;
            break;
        }
    }
}

function handleMove(e) {
    if (!draggingStar) return;
    if (e.cancelable) e.preventDefault();

    const pos = getPointerPos(e);
    draggingStar.x = pos.x;
    draggingStar.y = pos.y;

    // 画面外に出ないように制限
    const margin = 20;
    if (draggingStar.x < margin) draggingStar.x = margin;
    if (draggingStar.x > width - margin) draggingStar.x = width - margin;
    if (draggingStar.y < margin + 50) draggingStar.y = margin + 50; // ヘッダー分確保
    if (draggingStar.y > height - margin) draggingStar.y = height - margin;
}

function handleEnd(e) {
    if (draggingStar) {
        draggingStar.isDragging = false;
        draggingStar = null;
    }
}

// マウスイベント
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

// タッチイベント
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);

// ==========================================
// ゲームクリア処理
// ==========================================
function gameClear() {
    isGameClear = true;
    console.log("Game Clear!");

    // クリア表示
    setTimeout(() => {
        clearOverlay.classList.add('visible');
    }, 500);
}

// ==========================================
// ボタンイベント
// ==========================================
resetBtn.addEventListener('click', initGame);
nextBtn.addEventListener('click', initGame);

// ゲーム開始
initGame();
draw();
