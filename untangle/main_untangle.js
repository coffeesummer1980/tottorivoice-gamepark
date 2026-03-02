/**
 * 星座Untangleパズル (Refined Version)
 * main.js
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const ghostCanvas = document.getElementById('ghostCanvas');
const ghostCtx = ghostCanvas.getContext('2d');

const resetBtn = document.getElementById('reset-btn');
const releaseBtn = document.getElementById('release-btn');
const nextBtn = document.getElementById('next-btn');
const clearOverlay = document.getElementById('clear-overlay');

// ==========================================
// データ定義
// ==========================================

// 星クラス
class Star {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 8;        // 表示サイズ
        this.hitRadius = 30;    // ゆいくんが掴める距離判定
        this.color = '#ffffff';
    }
}

// ゆいくんクラス
class Yui {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.radius = 24;   // ゆいくんのサイズ
        this.holdingNode = null; // つかんでいる星
        this.isDragging = false; // プレイヤーがゆいくんを操作中か
    }

    update(targetX, targetY, width, height) {
        // 画面外制限
        const margin = this.radius;
        this.x = Math.max(margin, Math.min(width - margin, targetX));
        this.y = Math.max(margin, Math.min(height - margin, targetY));

        // 星を持っているなら星も移動
        if (this.holdingNode) {
            this.holdingNode.x = this.x;
            this.holdingNode.y = this.y + 15; // 少し下にぶら下げる
        }
    }
}

// レベルデータ（初級：家のような形）
const templateNodes = [
    { x: 0.5, y: 0.2 },  // 0: 屋根上
    { x: 0.2, y: 0.4 },  // 1: 屋根左
    { x: 0.8, y: 0.4 },  // 2: 屋根右
    { x: 0.2, y: 0.8 },  // 3: 床左
    { x: 0.8, y: 0.8 },  // 4: 床右
    { x: 0.5, y: 0.6 },  // 5: 中心
    { x: 0.5, y: 0.9 },   // 6: 床下
    { x: 0.2, y: 0.2 },   // 7: 左上装飾
];
const templateEdges = [
    [0, 1], [0, 2],         // 屋根
    [1, 3], [2, 4],         // 壁
    [3, 6], [6, 4],         // 床
    [1, 5], [2, 5], [3, 5], [4, 5], // 中心への集中線
    [1, 7], [0, 7]          // 装飾
];

let stars = [];
let yui = new Yui();
let isGameClear = false;

// ==========================================
// 画面サイズ・設定
// ==========================================
let width, height;
let ghostW = 120, ghostH = 120;

function resize() {
    width = Math.max(window.innerWidth, 320);
    height = Math.max(window.innerHeight, 320);

    // Main Canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // Ghost Canvas
    const ghostContainer = document.getElementById('ghost-container');
    if (ghostContainer) {
        const rect = ghostContainer.getBoundingClientRect();
        ghostW = rect.width;
        ghostH = rect.height;
        ghostCanvas.width = ghostW * dpr;
        ghostCanvas.height = ghostH * dpr;
        ghostCtx.scale(dpr, dpr);

        // リサイズ時に再描画
        drawGhost();
    }
}
window.addEventListener('resize', resize);


// ==========================================
// ロジック関数
// ==========================================

function initGame() {
    isGameClear = false;
    clearOverlay.classList.remove('visible');
    releaseBtn.style.display = 'none';

    // 星の初期化（ランダム配置）
    stars = [];
    const centerX = width / 2;
    const centerY = height / 2;
    const spawnRange = Math.min(width, height) * 0.4;

    for (let i = 0; i < templateNodes.length; i++) {
        // ランダム位置
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * spawnRange * 0.8;
        const sx = centerX + Math.cos(angle) * dist;
        const sy = centerY + Math.sin(angle) * dist;

        stars.push(new Star(i, sx, sy));
    }

    // ゆいくん初期化
    yui = new Yui();
    yui.x = centerX;
    yui.y = centerY;

    // ゴースト描画
    drawGhost();

    // 描画ループ開始確認（重複防止はしていないが、requestAnimationFrameの仕組み上、
    // 既存のループを止める仕組みが必要だが、ここではシンプルにブラウザに任せる）
}

// 線分交差判定
function getLineIntersection(p1, p2, p3, p4) {
    if (p1.id === p3.id || p1.id === p4.id || p2.id === p3.id || p2.id === p4.id) return false;

    // バウンディングボックス判定
    if (Math.max(p1.x, p2.x) < Math.min(p3.x, p4.x) ||
        Math.min(p1.x, p2.x) > Math.max(p3.x, p4.x) ||
        Math.max(p1.y, p2.y) < Math.min(p3.y, p4.y) ||
        Math.min(p1.y, p2.y) > Math.max(p3.y, p4.y)) return false;

    const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
    if (det === 0) return false;

    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

function checkIntersections() {
    let intersectionCount = 0;
    const edgeState = new Array(templateEdges.length).fill(false);

    for (let i = 0; i < templateEdges.length; i++) {
        for (let j = i + 1; j < templateEdges.length; j++) {
            const e1 = templateEdges[i];
            const e2 = templateEdges[j];
            const s1 = stars[e1[0]];
            const s2 = stars[e1[1]];
            const s3 = stars[e2[0]];
            const s4 = stars[e2[1]];

            if (getLineIntersection(s1, s2, s3, s4)) {
                edgeState[i] = true;
                edgeState[j] = true;
                intersectionCount++;
            }
        }
    }
    return { count: intersectionCount, edgeState };
}

// 星をつかむ判定（自動）
function checkAutoGrab() {
    if (yui.holdingNode) return; // 既に持っている

    let closest = null;
    let minD = Infinity;

    for (const star of stars) {
        const dx = yui.x - star.x;
        const dy = yui.y - star.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        // 当たり判定内
        if (d < star.hitRadius) {
            if (d < minD) {
                minD = d;
                closest = star;
            }
        }
    }

    if (closest) {
        yui.holdingNode = closest;
        releaseBtn.style.display = 'flex'; // block -> flex for centering
    }
}

// 星を離す
function releaseStar() {
    if (yui.holdingNode) {
        yui.holdingNode = null;
        releaseBtn.style.display = 'none';

        // 離した瞬間にクリア判定
        const { count } = checkIntersections();
        if (count === 0 && !isGameClear) {
            gameClear();
        }
    }
}

function gameClear() {
    isGameClear = true;
    setTimeout(() => {
        clearOverlay.classList.add('visible');
    }, 300);
}

// ==========================================
// 描画関連
// ==========================================

// ゆいくん描画関数
function renderYui(ctx, x, y, r) {
    // 将来的には画像へ差し替え

    // 体（鳥っぽい円）
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.fillStyle = '#4facfe'; // 鳥っぽい水色
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 目
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.25, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // くちばし
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.15, y + r * 0.1);
    ctx.lineTo(x + r * 0.15, y + r * 0.1);
    ctx.lineTo(x, y + r * 0.4);
    ctx.fill();

    // つかんでいる時エフェクト
    if (yui.holdingNode) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// 見本（ゴースト）描画
function drawGhost() {
    ghostCtx.clearRect(0, 0, ghostW, ghostH);

    // 余白
    const pad = 20;
    const w = ghostW - pad * 2;
    const h = ghostH - pad * 2;

    // 線を描画
    ghostCtx.strokeStyle = 'rgba(255, 255, 200, 0.5)';
    ghostCtx.lineWidth = 2;
    ghostCtx.lineCap = 'round';

    for (const edge of templateEdges) {
        const n1 = templateNodes[edge[0]];
        const n2 = templateNodes[edge[1]];

        ghostCtx.beginPath();
        ghostCtx.moveTo(pad + n1.x * w, pad + n1.y * h);
        ghostCtx.lineTo(pad + n2.x * w, pad + n2.y * h);
        ghostCtx.stroke();
    }

    // ノード（小さめ）
    ghostCtx.fillStyle = '#ffebd7';
    for (const n of templateNodes) {
        ghostCtx.beginPath();
        ghostCtx.arc(pad + n.x * w, pad + n.y * h, 3, 0, Math.PI * 2);
        ghostCtx.fill();
    }
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    // 交差判定
    const { count, edgeState } = checkIntersections();

    // 線を描画
    ctx.lineCap = 'round';
    for (let i = 0; i < templateEdges.length; i++) {
        const e = templateEdges[i];
        const s1 = stars[e[0]];
        const s2 = stars[e[1]];
        if (!s1 || !s2) continue;

        ctx.lineWidth = 3;
        if (isGameClear) {
            ctx.strokeStyle = '#ffd700'; // クリア: ゴールド
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffd700';
        } else if (edgeState[i]) {
            ctx.strokeStyle = '#ff5252'; // 交差: 赤
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#ff5252';
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; // 通常: 白
            ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
    }
    ctx.shadowBlur = 0; // reset

    // 星を描画
    for (const s of stars) {
        // 本体
        ctx.fillStyle = s.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'white';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // つかまれているか？
        if (yui.holdingNode === s) {
            ctx.strokeStyle = '#4facfe';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ゆいくん描画
    renderYui(ctx, yui.x, yui.y, yui.radius);

    requestAnimationFrame(draw);
}

// ==========================================
// 入力イベント
// ==========================================

function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - r.left, y: cy - r.top };
}

function onDown(e) {
    if (isGameClear) return;
    const pos = getPos(e);

    // ゆいくん判定 (少し広めに)
    const dx = pos.x - yui.x;
    const dy = pos.y - yui.y;
    const distSq = dx * dx + dy * dy;

    // 操作開始
    // 画面全体どこでもタップしたらそこにゆいくんが向かう仕様にする？
    // それともゆいくんをドラッグ？
    // 仕様：「ゆいくんをドラッグして動かす」
    // つまりゆいくんの上に指を置く必要がある。
    if (distSq < (yui.radius * 3) ** 2) {
        yui.isDragging = true;
    }
}

function onMove(e) {
    if (!yui.isDragging) return;
    if (e.cancelable) e.preventDefault();

    const pos = getPos(e);
    yui.update(pos.x, pos.y, width, height);

    // 移動中に自動でつかむ
    checkAutoGrab();
}

function onUp(e) {
    yui.isDragging = false;
}

canvas.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);

canvas.addEventListener('touchstart', onDown, { passive: false });
window.addEventListener('touchmove', onMove, { passive: false });
window.addEventListener('touchend', onUp);

// ボタン類
resetBtn.addEventListener('click', initGame);
nextBtn.addEventListener('click', initGame);
releaseBtn.addEventListener('click', releaseStar);

// 初期実行（resize後に）
resize();
initGame();
draw();
