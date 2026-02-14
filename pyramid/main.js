/**
 * ピラミッドソリティア・メインロジック
 * 
 * 構造:
 * - Cardクラス: カード1枚のデータと描画を担当
 * - Gameクラス: ゲーム全体の進行管理、状態管理
 */

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

        // オーバーレイ隠し（念の為）
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
        const H_STEP = 14; // 横の間隔(%)
        const V_STEP = 50; // 縦の間隔(px)

        const xPercent = 50 + (col - row / 2) * H_STEP;
        const yPx = row * V_STEP;

        card.element.style.left = `${xPercent}%`;
        card.element.style.top = `${yPx}px`;
        card.element.style.transform = `translate(-50%, 0)`;
        card.element.style.zIndex = row + 1;
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

        // 2. 山札の表示更新
        if (this.stock.length > 0) {
            this.stockPile.style.visibility = 'visible';
            this.stockPile.classList.remove('empty');
        } else {
            this.stockPile.style.visibility = 'hidden';
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
        if (this.stock.length === 0) return;

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

        // 山札があるうちはまだ手詰まりではない
        if (this.stock.length > 0) return;

        // 有効な手があるか？
        if (this.hasValidMoves()) return;

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
