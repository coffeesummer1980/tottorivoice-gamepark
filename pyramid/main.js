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

        this.isProcessing = false; // 操作ロック用フラグ

        // DOM要素
        this.pyramidContainer = document.getElementById('pyramid-container');
        this.stockPile = document.getElementById('stock-pile');
        this.wastePileContainer = document.querySelector('.waste-pile-container'); // コンテナが必要
        this.cardCountSpan = document.getElementById('card-count');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.clearOverlay = document.getElementById('clear-overlay');
        this.overlayNewGameBtn = document.getElementById('overlay-new-game-btn');

        // wasteパイルのプレースホルダー
        this.wastePlaceholder = document.getElementById('waste-pile');

        // wasteパイルのプレースホルダー
        this.wastePlaceholder = document.getElementById('waste-pile');

        // 応援用要素
        this.yukarinBubble = document.getElementById('yukarin-bubble');
        this.miyacchiBubble = document.getElementById('miyacchi-bubble');

        this.init();
    }

    init() {
        this.bindEvents();
        this.startNewGame();
    }

    bindEvents() {
        this.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.overlayNewGameBtn.addEventListener('click', () => {
            this.clearOverlay.classList.add('hidden');
            this.startNewGame();
        });

        // 山札クリック
        this.stockPile.addEventListener('click', () => this.drawCard());

        // ピラミッド・コンテナへの委譲イベント（生成されたカード用）
        // ただし、カードは絶対配置されるので、カード自体にイベントリスナーを追加する方が確実
        // ここではグローバルなクリックハンドラとして実装
    }

    startNewGame() {
        this.clearOverlay.classList.add('hidden');
        this.deck = this.createDeck();
        this.shuffleDeck();

        // 状態リセット
        this.pyramid = [];
        this.stock = [];
        this.waste = [];
        this.selectedCards = [];
        this.pyramidContainer.innerHTML = '';

        // waste表示エリアのクリア（プレースホルダー以外を削除）
        // 現在表示されているカードを取り除く
        const currentWasteCard = this.wastePileContainer.querySelector('.card');
        if (currentWasteCard) currentWasteCard.remove();

        // カードを配る
        this.dealCards();

        // 残りを山札へ
        this.stock = [...this.deck];

        this.updateView();
        this.updateCardCount(); // 初回表示更新
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
        // ピラミッドは7段
        // 1段目: 1枚
        // ...
        // 7段目: 7枚
        // 合計28枚

        let cardIndex = 0;
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

    /**
     * カードの配置計算 (レスポンシブ対応のため % や calc を使用)
     */
    positionCard(card, row, col) {
        // カードの幅・高さ
        // CSS変数から取得するのが理想だが、ここでは相対位置で計算する
        // ピラミッドの中央揃えにする

        // 下にいくほど行の幅が広がる。
        // 行の中心 = コンテナの中心

        const cardWidth = 60; // 仮想的な基準幅
        const cardHeight = 84;
        const gapX = 10;
        const gapY = -40; // 重ねる量

        // row行のカード全体の幅
        const rowWidth = (row + 1) * cardWidth + row * gapX;

        // コンテナの中心からのオフセット
        // 50% を中心として、そこから rowWidth / 2 を引いた位置が左端
        // そこに col * (cardWidth + gapX) を足す

        // CSS変数を使うスタイルに変更
        // left: calc(50% - (row_width / 2) + col_offset)

        // 簡易的に：各カードの中心位置を計算して配置
        // 1段目(row=0)は中央。
        // col=0 の位置は?

        // カード中心のX座標(%) = 50 + (col - row/2) * H_STEP
        // H_STEPはカード幅に応じた適当な％
        const H_STEP = 14; // 横の間隔(%)
        const V_STEP = 50; // 縦の間隔(px) ※CSS変数と合わせるべきだがJSで制御

        const xPercent = 50 + (col - row / 2) * H_STEP;
        const yPx = row * V_STEP; // 上からの距離

        card.element.style.left = `${xPercent}%`;
        card.element.style.top = `${yPx}px`;

        // 中心基準にするため、transformでずらす
        card.element.style.transform = `translate(-50%, 0)`;

        // z-index調整（下段が上に来る必要はないが、重なり順序制御）
        card.element.style.zIndex = row + 1;
    }

    /**
     * 状態更新と再描画（主に選択可否の計算）
     */
    updateView() {
        // 1. ピラミッドの選択可否判定
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.pyramid[row].length; col++) {
                const card = this.pyramid[row][col];
                if (!card) continue; // 消去済み

                // 選択可能かチェック
                // 条件: 下の段(row+1)の col と col+1 にカードがない
                let isBlocked = false;

                if (row < 6) { // 最下段以外
                    const leftChild = this.pyramid[row + 1][col];
                    const rightChild = this.pyramid[row + 1][col + 1];

                    if (leftChild || rightChild) {
                        isBlocked = true;
                    }
                }

                card.isSelectable = !isBlocked;
                card.render(); // クラス更新
            }
        }

        // 2. 山札の表示更新
        if (this.stock.length > 0) {
            this.stockPile.style.visibility = 'visible';
            this.stockPile.classList.remove('empty');
            // 一番上のカードを裏向きで表示（見た目だけ）
        } else {
            // 山札切れ→リセット（一周のみなら非表示、再利用ならリセットアイコン等）
            // ピラミッドソリティアの標準ルールでは、山札使い切りで詰みか、
            // 何度でも回せるか、回数制限ありかバリエーションあり。
            // ユーザー要件では「ストックが尽きて動けない場合はNew Game」なので、使い切りとする。
            // しかし視覚的に「なくなった」ことを示す。
            this.stockPile.style.visibility = 'hidden';
        }

        // 3. 捨て札の表示更新
        // 既存の表示済みカードを削除
        const oldWaste = this.wastePileContainer.querySelector('.card');
        if (oldWaste) oldWaste.remove();

        if (this.waste.length > 0) {
            const topWaste = this.waste[this.waste.length - 1];
            topWaste.isFaceUp = true;
            topWaste.isSelectable = true; // 捨て札は常に選択可能
            const el = topWaste.render();

            // 捨て札クリックイベント
            // ※重要: 要素を作り直すのでイベントも再設定
            // 既存のリスナーを削除する手間を省くため、ここではonclickプロパティ上書きは避け、
            // 新規要素なのでaddEventListenerでOK
            el.onclick = null; // 安全策
            el.addEventListener('click', () => this.onCardClick(topWaste, 'waste'));

            // 配置調整
            el.style.position = 'absolute';
            el.style.left = '0';
            el.style.top = '0';
            el.style.transform = 'none'; // ピラミッド用のtransform解除
            el.style.zIndex = 10;

            this.wastePileContainer.appendChild(el);
        }

        this.updateCardCount();
    }

    /**
     * 山札をめくる
     */
    /**
     * 山札をめくる
     */
    drawCard() {
        if (this.isProcessing) return;
        if (this.stock.length === 0) {
            // 山札が空の場合
            return;
        }

        // 選択状態の解除（山札めくると選択リセット）
        if (this.selectedCards.length > 0) {
            [...this.selectedCards].forEach(c => this.deselectCard(c));
        }

        const card = this.stock.pop();
        this.waste.push(card);
        this.updateView();
    }

    /**
     * カードクリック時の処理
     */
    onCardClick(card, location, row, col) {
        if (this.isProcessing) return;
        if (!card.isSelectable) return;

        // 既に選択済みのカードをタップ -> 解除
        if (card.isSelected) {
            this.deselectCard(card);
            return;
        }

        // K(=13)は単体で消える
        if (card.number === 13) {
            this.removeCard(card, location, row, col);

            // 特定の効果音や演出を入れるならここ
            return;
        }

        // 選択処理
        this.selectCard(card, location, row, col);
    }

    selectCard(card, location, row, col) {
        card.isSelected = true;

        // 参照情報を付与しておく
        card._location = location;
        card._row = row;
        card._col = col;

        this.selectedCards.push(card);
        card.render(); // 表示更新

        // カードが2枚選択されたら判定
        if (this.selectedCards.length === 2) {
            this.checkPair();
        }
    }

    deselectCard(card) {
        card.isSelected = false;

        // 配列から削除
        this.selectedCards = this.selectedCards.filter(c => c.id !== card.id);

        card.render();
    }

    checkPair() {
        this.isProcessing = true; // 操作ブロック

        const c1 = this.selectedCards[0];
        const c2 = this.selectedCards[1];

        if (c1.number + c2.number === 13) {
            // マッチ成立！
            // 少し遅延させて消すとわかりやすい
            setTimeout(() => {
                this.removeCard(c1, c1._location, c1._row, c1._col);
                this.removeCard(c2, c2._location, c2._row, c2._col);
                this.selectedCards = [];
                // removeCard内でisProcessing解除される

                // 応援メッセージ
                this.showCheerMessage();
            }, 200);
        } else {
            // マッチ不成立
            setTimeout(() => {
                this.deselectCard(c1);
                this.deselectCard(c2);
                this.isProcessing = false; // 解除
            }, 300);
        }
    }

    removeCard(card, location, row, col) {
        // データから削除
        if (location === 'pyramid') {
            // 配列の該当箇所をnullにする（順序維持のためspliceはダメ）
            this.pyramid[row][col] = null;
        } else if (location === 'waste') {
            // 捨て札から削除
            // this.waste はスタック構造。一番上が消えるはず。
            // ただし「選択中に山札めくって下に埋もれた」ケースは考慮必要だが、
            // 今回のUIルールではめくるとwasteの一番上しか触れないので大丈夫。
            // 念のためIDチェック
            const index = this.waste.findIndex(c => c.id === card.id);
            if (index !== -1) {
                this.waste.splice(index, 1);
            }
        }

        // 選択リストから除外
        this.selectedCards = this.selectedCards.filter(c => c.id !== card.id);

        // DOM削除アニメーション
        card.element.style.transform = 'scale(0) rotate(180deg)';
        card.element.style.opacity = '0';

        setTimeout(() => {
            if (card.element.parentNode) {
                card.element.parentNode.removeChild(card.element);
            }
            this.updateView(); // 画面更新（下のカードが選択可能になるかも）
            this.checkWinCondition();
            this.isProcessing = false; // 解除
        }, 300);
    }

    showCheerMessage() {
        // ランダムにキャラ選択 (0: ゆかりん, 1: みやっち)
        const chara = Math.random() < 0.5 ? 'yukarin' : 'miyacchi';
        const message = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];

        let bubble;
        if (chara === 'yukarin') {
            bubble = this.yukarinBubble;
        } else {
            bubble = this.miyacchiBubble;
        }

        if (bubble) {
            bubble.textContent = message;
            bubble.classList.remove('hidden');

            // 数秒後に隠す
            // 既存のタイマーがあればクリアしたいが、簡易的に上書き
            setTimeout(() => {
                bubble.classList.add('hidden');
            }, 2000);
        }
    }

    updateCardCount() {
        // ピラミッドに残っている枚数をカウント
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
            // クリア！
            setTimeout(() => {
                this.clearOverlay.classList.remove('hidden');
                // 花吹雪などの演出があればここ
            }, 500);
        }
    }
}

// ゲーム開始
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});
