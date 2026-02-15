/**
 * ピラミッドソリティア・メインロジック
 * 
 * 構造:
 * - Cardクラス: カード1枚のデータと描画を担当
 * - Gameクラス: ゲーム全体の進行管理、状態管理
 */

window.onerror = function (message, source, lineno, colno, error) {
    alert('Global Error: ' + message + '\nLine: ' + lineno);
};

// 定数定義
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
    { num: 1, label: 'A' }, { num: 2, label: '2' }, { num: 3, label: '3' },
    { num: 4, label: '4' }, { num: 5, label: '5' }, { num: 6, label: '6' },
    { num: 7, label: '7' }, { num: 8, label: '8' }, { num: 9, label: '9' },
    { num: 10, label: '10' }, { num: 11, label: 'J' }, { num: 12, label: 'Q' },
    { num: 13, label: 'K' }
];

const SUIT_IMG_MAP = {
    '♠': 'assets/yuikun_spade.png',
    '♥': 'assets/yuikun_heart.png',
    '♦': 'assets/yuikun_diamond.png',
    '♣': 'assets/yuikun_club.png'
};

const CHEER_MESSAGES = [
    "ナイス！", "いい感じ！", "すごいすごい！", "その調子！",
    "やる〜！", "完璧！", "天才かも！？", "ファイト！"
];

/* -------------------------------------------------------------------------- */
/*                                 Card Class                                 */
/* -------------------------------------------------------------------------- */
class Card {
    constructor(suit, rankObj, id) {
        this.suit = suit;
        this.number = rankObj.num;
        this.label = rankObj.label;
        this.id = id; // ユニークID
        this.element = null; // DOM要素の参照

        // 将来的な拡張用プロパティ
        this.imageKey = null; // 画像ファイル名等
        this.themeId = 'default'; // テーマ切り替え用

        this.isFaceUp = false;
        this.isSelectable = false;
        this.isSelected = false;
    }

    /**
     * カードのDOM要素を生成または更新して返す
     * 将来的にここを修正して画像表示に切り替え可能
     */
    render() {
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.classList.add('card');
            this.element.dataset.id = this.id;

            // カードの内部構造を作成
            this.topLeft = document.createElement('div');
            this.topLeft.className = 'card-pip card-top-left';

            this.center = document.createElement('div');
            this.center.className = 'card-pip card-center';

            this.bottomRight = document.createElement('div');
            this.bottomRight.className = 'card-pip card-bottom-right';

            this.element.appendChild(this.topLeft);
            this.element.appendChild(this.center);
            this.element.appendChild(this.bottomRight);

            // クリックイベントはGameクラスで委譲またはここでバインド
            // 今回はGameクラスで一括管理するため、ここでは設定しない
        }

        // 状態に応じたクラスの着脱
        if (this.isFaceUp) {
            this.element.classList.remove('back');
            this.element.dataset.suit = this.suit;
            this.element.dataset.number = this.number;

            // 中身の描画（画像ベース）
            // スートごとに異なるゆいくん画像を表示
            const imgSrc = SUIT_IMG_MAP[this.suit];
            const imgTag = `<img src="${imgSrc}" class="suit-img">`;

            this.topLeft.innerHTML = `${this.label}<br>${imgTag}`;
            this.center.innerHTML = `${imgTag}`; // 中央に大きく
            // 画像サイズ少し大きめに
            this.center.querySelector('img').style.width = '42px';
            this.center.querySelector('img').style.height = '42px';

            this.bottomRight.innerHTML = `${this.label}<br>${imgTag}`;

            // 色の設定（赤/黒）
            if (this.suit === '♥' || this.suit === '♦') {
                this.element.style.color = '#c0392b';
            } else {
                this.element.style.color = '#2c3e50';
            }
        } else {
            this.element.classList.add('back');
            this.topLeft.textContent = '';
            this.center.textContent = '';
            this.bottomRight.textContent = '';
        }

        if (this.isSelected) {
            this.element.classList.add('selected');
        } else {
            this.element.classList.remove('selected');
        }

        // 選択不可の視覚効果（任意）
        if (!this.isSelectable && this.isFaceUp) {
            this.element.classList.add('disabled');
        } else {
            this.element.classList.remove('disabled');
        }

        return this.element;
    }
}

/* -------------------------------------------------------------------------- */
/*                                Game Class                                  */
/* -------------------------------------------------------------------------- */
class Game {
    constructor() {
        this.deck = [];
        this.pyramid = []; // 2次元配列: pyramid[row][col]
        this.stock = [];
        this.waste = [];
        this.selectedCards = []; // 選択中のカード（最大2枚）
        this.score = 0; // 残り枚数として表示

        this.gameState = 'START'; // START, PLAYING, CLEAR, GAMEOVER
        this.isProcessing = false; // 操作ロック用フラグ

        // DOM要素
        this.pyramidContainer = document.getElementById('pyramid-container');
        this.stockPile = document.getElementById('stock-pile');
        this.wastePileContainer = document.querySelector('.waste-pile-container');
        this.cardCountSpan = document.getElementById('card-count');
        this.newGameBtn = document.getElementById('new-game-btn');

        // Overlays
        this.startOverlay = document.getElementById('start-overlay');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        this.clearOverlay = document.getElementById('clear-overlay');

        // Buttons
        this.startBtn = document.getElementById('start-btn');
        this.retryBtn = document.getElementById('retry-btn');
        this.overlayNewGameBtn = document.getElementById('overlay-new-game-btn');

        // wasteパイルのプレースホルダー
        this.wastePlaceholder = document.getElementById('waste-pile');

        // 応援・ヒント用要素
        this.yukarinBubble = document.getElementById('yukarin-bubble');
        this.miyacchiBubble = document.getElementById('miyacchi-bubble');

        // キャラクターボックス（クリック用）
        this.yukarinBox = document.querySelector('.character-box.left');
        this.miyacchiBox = document.querySelector('.character-box.right');

        this.init();
    }

    init() {
        this.bindEvents();
        // 最初はスタート画面を表示
        this.startOverlay.classList.remove('hidden');
    }

    bindEvents() {
        this.newGameBtn.addEventListener('click', () => this.confirmNewGame());

        this.startBtn.addEventListener('click', () => {
            this.startOverlay.classList.add('hidden');
            this.startNewGame();
        });

        this.retryBtn.addEventListener('click', () => {
            this.gameOverOverlay.classList.add('hidden');
            this.startNewGame();
        });

        this.overlayNewGameBtn.addEventListener('click', () => {
            this.clearOverlay.classList.add('hidden');
            this.startNewGame();
        });

        // 山札クリック
        this.stockPile.addEventListener('click', () => this.drawCard());

        // キャラクタークリック（ヒント機能）
        this.yukarinBox.addEventListener('click', () => this.showHint());
        this.miyacchiBox.addEventListener('click', () => this.cheerMiyacchi(true));
    }

    confirmNewGame() {
        if (confirm('新しいゲームを始めますか？')) {
            this.startNewGame();
        }
    }

    startNewGame() {
        this.gameState = 'PLAYING';

        // 即座に開始（ソルバー廃止）
        this.deck = this.createDeck();
        this.shuffleDeck();

        // 状態リセット
        this.pyramid = [];
        this.stock = [];
        this.waste = [];
        this.selectedCards = [];
        this.pyramidContainer.innerHTML = '';

        // waste表示エリアのクリア
        const currentWasteCard = this.wastePileContainer.querySelector('.card');
        if (currentWasteCard) currentWasteCard.remove();

        // オーバーレイ隠し
        this.startOverlay.classList.add('hidden');
        this.gameOverOverlay.classList.add('hidden');
        this.clearOverlay.classList.add('hidden');

        // カードを配る
        this.dealCards();

        // 残りを山札へ
        this.stock = [...this.deck];

        this.updateView();
        this.updateCardCount();
    }

    // 配列シャッフル用ヘルパー
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // ソルバー（簡易シミュレーション）
    isSolvable(deck) {
        // デッキをコピーしてシミュレーション用の状態を作成
        // 注意: Cardオブジェクトの参照を切る必要はないが、配列は別にする
        // シミュレーションではカードの数値(number)だけ分かれば良い

        const cardValues = deck.map(c => c.number);

        // ピラミッド構築（28枚）
        // 0段目: 1枚 (idx 0)
        // 1段目: 2枚 (idx 1-2)
        // ...
        // 6段目: 7枚 (idx 21-27)
        // 合計: 28枚
        // 配列の最後から取り出して配置するため、deckの末尾28枚がピラミッド
        // 取り出し順序: row0-col0 -> row1-col0 -> row1-col1 ...
        // dealCardsの実装を見ると:
        // row=0..6, col=0..row { deck.pop() }
        // つまり、deckの最後がrow0、その前がrow1...
        // 逆順でシミュレートする必要がある

        let simPyramid = []; // [row][col] -> value
        let deckIdx = cardValues.length - 1;

        for (let row = 0; row < 7; row++) {
            simPyramid[row] = [];
            for (let col = 0; col <= row; col++) {
                simPyramid[row][col] = cardValues[deckIdx--];
            }
        }

        // 残りが山札（stock）
        // stockは配列として保持（deckの残り）
        // 実際のゲームでは stock = [...deck] (popした後)
        let simStock = cardValues.slice(0, deckIdx + 1);

        // ソルバー実行
        return this.solveRecursive(simPyramid, simStock, [], 0);
    }

    // 再帰探索（深さ制限・訪問済み管理あり）
    solveRecursive(pyramid, stock, waste, depth) {
        // ゴール判定: ピラミッドが空ならクリア
        let pyramidCount = 0;
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < pyramid[r].length; c++) {
                if (pyramid[r][c] !== null) pyramidCount++;
            }
        }
        if (pyramidCount === 0) return true;

        // 深さ制限（探索爆発防止）
        if (depth > 100) return false;

        // 状態ハッシュ（簡易）
        // 本当はSetで訪問済みチェックすべきだが、ピラミッドの状態とWasteの状態がキー
        // 今回は単純なDFSで、最初に見つけた勝ち筋を返す

        // 有効な手を探す
        // 1. ピラミッドの選択可能カードリスト
        let activePyramidCards = [];
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < pyramid[r].length; c++) {
                if (pyramid[r][c] === null) continue;

                // ブロック判定
                let isBlocked = false;
                if (r < 6) {
                    const left = pyramid[r + 1][c];
                    const right = pyramid[r + 1][c + 1];
                    if (left !== null || right !== null) isBlocked = true;
                }

                if (!isBlocked) {
                    activePyramidCards.push({ val: pyramid[r][c], r: r, c: c, loc: 'p' });
                }
            }
        }

        let wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;
        let activeCards = [...activePyramidCards];
        if (wasteTop !== null) {
            activeCards.push({ val: wasteTop, loc: 'w' });
        }

        // 手の候補
        // A. K(13)の除去
        for (let c of activeCards) {
            if (c.val === 13) {
                // 実行して次へ
                let nextPyramid = this.clonePyramid(pyramid);
                let nextWaste = [...waste];
                let nextStock = [...stock];

                if (c.loc === 'p') nextPyramid[c.r][c.c] = null;
                else nextWaste.pop();

                if (this.solveRecursive(nextPyramid, nextStock, nextWaste, depth + 1)) return true;
            }
        }

        // B. ペア除去 (合計13)
        // 組み合わせ: P-P, P-W
        // W-Wは無い（Wasteの一番上しか使えないため）

        // P-P
        for (let i = 0; i < activePyramidCards.length; i++) {
            for (let j = i + 1; j < activePyramidCards.length; j++) {
                if (activePyramidCards[i].val + activePyramidCards[j].val === 13) {
                    let nextPyramid = this.clonePyramid(pyramid);
                    let nextWaste = [...waste];
                    let nextStock = [...stock];

                    let c1 = activePyramidCards[i];
                    let c2 = activePyramidCards[j];
                    nextPyramid[c1.r][c1.c] = null;
                    nextPyramid[c2.r][c2.c] = null;

                    if (this.solveRecursive(nextPyramid, nextStock, nextWaste, depth + 1)) return true;
                }
            }
        }

        // P-W
        if (wasteTop !== null) {
            for (let i = 0; i < activePyramidCards.length; i++) {
                if (activePyramidCards[i].val + wasteTop === 13) {
                    let nextPyramid = this.clonePyramid(pyramid);
                    let nextWaste = [...waste];
                    let nextStock = [...stock];

                    let c1 = activePyramidCards[i];
                    nextPyramid[c1.r][c1.c] = null;
                    nextWaste.pop();

                    if (this.solveRecursive(nextPyramid, nextStock, nextWaste, depth + 1)) return true;
                }
            }
        }

        // C. ドロー (Stock -> Waste)
        if (stock.length > 0) {
            let nextPyramid = this.clonePyramid(pyramid);
            let nextWaste = [...waste];
            let nextStock = [...stock];

            let card = nextStock.pop();
            nextWaste.push(card);

            if (this.solveRecursive(nextPyramid, nextStock, nextWaste, depth + 1)) return true;
        }

        return false;
    }

    clonePyramid(pyramid) {
        return pyramid.map(row => [...row]);
    }

    createDeck() {
        let deck = [];
        let id = 0;
        for (let suit of SUITS) {
            for (let rank of RANKS) {
                deck.push(new Card(suit, rank, id++));
            }
        }
        return deck;
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        for (let row = 0; row < 7; row++) {
            this.pyramid[row] = [];
            for (let col = 0; col <= row; col++) {
                let card = this.deck.pop();
                card.isFaceUp = true;

                // カードにクリックイベントを設定
                card.render().addEventListener('click', () => this.onCardClick(card, 'pyramid', row, col));

                // 画面に追加
                this.pyramidContainer.appendChild(card.element);
                this.pyramid[row].push(card);

                // 位置設定
                this.positionCard(card, row, col);
            }
        }
    }

    positionCard(card, row, col) {
        const H_STEP = 14;
        const V_STEP = 50;

        const xPercent = 50 + (col - row / 2) * H_STEP;
        const yPx = row * V_STEP;

        card.element.style.left = `${xPercent}%`;
        card.element.style.top = `${yPx}px`;
        card.element.style.transform = `translate(-50%, 0)`;
        card.element.style.zIndex = 100 + row; // Z-Indexを大幅に上げて手前に表示
        card.element.style.opacity = '1'; // 強制的に不透明
        card.element.style.display = 'flex'; // 強制的に表示
    }

    updateView() {
        // 1. ピラミッドの選択可否判定
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.pyramid[row].length; col++) {
                const card = this.pyramid[row][col];
                if (!card) continue;

                let isBlocked = false;
                if (row < 6) {
                    const leftChild = this.pyramid[row + 1][col];
                    const rightChild = this.pyramid[row + 1][col + 1];
                    if (leftChild || rightChild) {
                        isBlocked = true;
                    }
                }

                card.isSelectable = !isBlocked;
                card.render();
            }
        }

        // 2. 山札の表示更新（リサイクル対応）
        this.stockPile.classList.remove('back', 'refresh', 'empty');
        this.stockPile.innerHTML = '';

        if (this.stock.length > 0) {
            this.stockPile.style.visibility = 'visible';
            this.stockPile.classList.add('back');
        } else if (this.waste.length > 0) {
            // 山札切れだが捨て札がある場合 -> リサイクル可能
            this.stockPile.style.visibility = 'visible';
            this.stockPile.classList.add('refresh');
            // CSSでアイコン表示
        } else {
            // 完全な切れ
            this.stockPile.style.visibility = 'hidden';
            this.stockPile.classList.add('empty');
        }

        // 3. 捨て札の表示更新
        const oldWaste = this.wastePileContainer.querySelector('.card');
        if (oldWaste) oldWaste.remove();

        if (this.waste.length > 0) {
            const topWaste = this.waste[this.waste.length - 1];
            topWaste.isFaceUp = true;
            topWaste.isSelectable = true;
            const el = topWaste.render();

            el.onclick = null;
            el.addEventListener('click', () => this.onCardClick(topWaste, 'waste'));

            el.style.position = 'absolute';
            el.style.left = '0';
            el.style.top = '0';
            el.style.transform = 'none';
            el.style.zIndex = 10;

            this.wastePileContainer.appendChild(el);
        }

        this.updateCardCount();

        // 手詰まり判定
        if (this.gameState === 'PLAYING') {
            this.checkGameOver();
        }
    }

    drawCard() {
        if (this.isProcessing || this.gameState !== 'PLAYING') return;

        // 山札切れ時のリサイクル処理
        if (this.stock.length === 0) {
            if (this.waste.length > 0) {
                // 捨て札を山札に戻してシャッフル
                this.stock = [...this.waste];
                this.waste = [];
                this.shuffleArray(this.stock); // シャッフルしてランダム性を追加

                // 全てのカードを裏向きにする等の処理はCardクラスのrenderで処理されるが、
                // 次にdrawされた時にisFaceUp=trueになる。
                // stock内では特にフラグを戻す必要はないが、念のため
                this.stock.forEach(c => {
                    c.isFaceUp = false;
                    c.isSelected = false;
                });

                this.updateView();
                this.cheerMiyacchi(true); // リセット合図
            }
            return;
        }

        // 選択状態の解除
        if (this.selectedCards.length > 0) {
            [...this.selectedCards].forEach(c => this.deselectCard(c));
        }

        const card = this.stock.pop();
        this.waste.push(card);
        this.updateView();
    }

    onCardClick(card, location, row, col) {
        if (this.isProcessing || this.gameState !== 'PLAYING') return;
        if (!card.isSelectable) return;

        // ヒントハイライトがあれば消す
        this.clearHintHighlights();

        if (card.isSelected) {
            this.deselectCard(card);
            return;
        }

        // K(=13)は単体で消える
        if (card.number === 13) {
            this.removeCard(card, location, row, col);
            return;
        }

        this.selectCard(card, location, row, col);
    }

    selectCard(card, location, row, col) {
        card.isSelected = true;
        card._location = location;
        card._row = row;
        card._col = col;

        this.selectedCards.push(card);
        card.render();

        if (this.selectedCards.length === 2) {
            this.checkPair();
        }
    }

    deselectCard(card) {
        card.isSelected = false;
        this.selectedCards = this.selectedCards.filter(c => c.id !== card.id);
        card.render();
    }

    checkPair() {
        this.isProcessing = true;
        const c1 = this.selectedCards[0];
        const c2 = this.selectedCards[1];

        if (c1.number + c2.number === 13) {
            setTimeout(() => {
                this.removeCard(c1, c1._location, c1._row, c1._col);
                this.removeCard(c2, c2._location, c2._row, c2._col);
                this.selectedCards = [];
                // removeCard内でisProcessing解除される

                // 応援メッセージ
                this.cheerMiyacchi(true); // 成功時は高確率で褒める
            }, 200);
        } else {
            setTimeout(() => {
                this.deselectCard(c1);
                this.deselectCard(c2);
                this.isProcessing = false;
                this.sayMessage('miyacchi', 'うーん、違うかも？');
            }, 300);
        }
    }

    removeCard(card, location, row, col) {
        if (location === 'pyramid') {
            this.pyramid[row][col] = null;
        } else if (location === 'waste') {
            const index = this.waste.findIndex(c => c.id === card.id);
            if (index !== -1) {
                this.waste.splice(index, 1);
            }
        }

        this.selectedCards = this.selectedCards.filter(c => c.id !== card.id);

        card.element.style.transform = 'scale(0) rotate(180deg)';
        card.element.style.opacity = '0';

        setTimeout(() => {
            if (card.element.parentNode) {
                card.element.parentNode.removeChild(card.element);
            }
            this.updateView();
            // checkWinConditionはupdateView後のcheckGameOver内で兼ねてもいいが、
            // 勝敗判定は即座に行いたいのでここで呼ぶ
            this.checkWinCondition();
            this.isProcessing = false;
        }, 300);
    }

    updateCardCount() {
        let count = 0;
        for (let row of this.pyramid) {
            for (let card of row) {
                if (card) count++;
            }
        }
        this.cardCountSpan.textContent = count;
        this.score = count;
    }

    checkWinCondition() {
        if (this.score === 0) {
            this.gameState = 'CLEAR';
            setTimeout(() => {
                this.clearOverlay.classList.remove('hidden');
            }, 500);
        }
    }

    // 手詰まり判定
    checkGameOver() {
        if (this.gameState !== 'PLAYING') return;

        // 1. 現在の盤面で打てる手があるか？
        if (this.hasValidMoves()) return;

        // 2. 山札・捨て札の中に、盤面のカードを消せる（またはKである）カードがあるか？
        // リサイクル可能なので、埋もれているカードも全て候補とする
        if (this.canDeckHelp()) return;

        // 手詰まり確定
        this.gameState = 'GAMEOVER';
        setTimeout(() => {
            this.sayMessage('miyacchi', 'もう動かせないみたい…');
            this.gameOverOverlay.classList.remove('hidden');
        }, 1000);
    }

    // 有効手があるかチェック
    hasValidMoves() {
        // 選択可能な全カードリストを作成
        let activeCards = [];

        // ピラミッド上の選択可能カード
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.pyramid[row].length; col++) {
                const c = this.pyramid[row][col];
                if (c && c.isSelectable) activeCards.push(c);
            }
        }

        // 捨て札の一番上
        if (this.waste.length > 0) {
            activeCards.push(this.waste[this.waste.length - 1]);
        }

        // K(13)があるか？
        if (activeCards.some(c => c.number === 13)) return true;

        // ペアがあるか？
        for (let i = 0; i < activeCards.length; i++) {
            for (let j = i + 1; j < activeCards.length; j++) {
                if (activeCards[i].number + activeCards[j].number === 13) {
                    return true;
                }
            }
        }

        return false;
    }

    // デッキ（山札＋捨て札）の中に助けになるカードがあるか判定
    canDeckHelp() {
        // 全ての持ち札（山札＋捨て札）
        const allDeckCards = [...this.stock, ...this.waste];
        const deckRanks = new Set(allDeckCards.map(c => c.number));

        // 1. K(13) があれば単体で消せるのでOK
        if (deckRanks.has(13)) return true;

        // 2. ピラミッド上の選択可能カードとペアになる数値があるか
        const exposedPyramidCards = [];
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.pyramid[row].length; col++) {
                const c = this.pyramid[row][col];
                if (c && c.isSelectable) {
                    exposedPyramidCards.push(c);
                }
            }
        }

        for (const pCard of exposedPyramidCards) {
            const target = 13 - pCard.number;
            if (deckRanks.has(target)) return true;
        }

        return false;
    }

    // ヒント機能（ゆかりん担当）
    showHint() {
        if (this.gameState !== 'PLAYING') return;

        this.clearHintHighlights();

        // 1. K(13)があればそれを教える
        let activeCards = this.getAllActiveCards();
        let kings = activeCards.filter(c => c.number === 13);

        if (kings.length > 0) {
            // ピラミッド上のKを優先
            let pyramidKing = kings.find(c => this.isCardInPyramid(c));
            let target = pyramidKing || kings[0];

            this.highlightCard(target);
            this.sayMessage('yukarin', 'これが消せるよ！');
            return;
        }

        // 2. ペアを探す
        for (let i = 0; i < activeCards.length; i++) {
            for (let j = i + 1; j < activeCards.length; j++) {
                if (activeCards[i].number + activeCards[j].number === 13) {
                    this.highlightCard(activeCards[i]);
                    this.highlightCard(activeCards[j]);
                    this.sayMessage('yukarin', 'このペアで13になるよ！');
                    return;
                }
            }
        }

        // 3. ペアが見つからない場合
        if (this.stock.length > 0) {
            this.sayMessage('yukarin', '山札をめくってみよう！');
        } else if (this.waste.length > 0) {
            this.sayMessage('yukarin', '山札(空)をタップしてリセット！');
        } else {
            this.sayMessage('yukarin', 'うーん、厳しいかも…');
        }
    }

    getAllActiveCards() {
        let activeCards = [];
        // ピラミッド
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.pyramid[row].length; col++) {
                const c = this.pyramid[row][col];
                if (c && c.isSelectable) activeCards.push(c);
            }
        }
        // 捨て札
        if (this.waste.length > 0) {
            activeCards.push(this.waste[this.waste.length - 1]);
        }
        return activeCards;
    }

    isCardInPyramid(card) {
        // 簡易判定：location情報を持たせていない場合もあるが、waste配列に含まれていなければピラミッド
        return !this.waste.includes(card);
    }

    highlightCard(card) {
        if (card.element) {
            card.element.classList.add('hint-highlight');
        }
    }

    clearHintHighlights() {
        const highlighted = document.querySelectorAll('.hint-highlight');
        highlighted.forEach(el => el.classList.remove('hint-highlight'));
    }

    sayMessage(chara, msg) {
        const bubble = chara === 'yukarin' ? this.yukarinBubble : this.miyacchiBubble;
        bubble.textContent = msg;
        bubble.classList.remove('hidden');

        // アニメーション再開のためにクラスを付け直すなどの工夫もできるが、今回はシンプルに
        setTimeout(() => {
            bubble.classList.add('hidden');
        }, 3000);
    }

    // 応援・リアクション（みやっち担当）
    cheerMiyacchi(force = false) {
        if (!force && Math.random() > 0.4) return; // 頻度調整

        const messages = [
            "ナイス！", "いい感じ！", "すごいすごい！", "その調子！",
            "やる〜！", "完璧！", "天才かも！？", "ファイト！"
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        this.sayMessage('miyacchi', msg);
    }
}

// ゲーム開始
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});
