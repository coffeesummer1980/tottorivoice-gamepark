/**
 * game-park-sdk.js
 * 
 * ゆいくんゲームパーク共通のユーザーデータ管理SDK
 * - レベル、経験値(XP)、コインの管理
 * - セーブ/ロード機能 (localStorage)
 * - UI表示機能
 */

const GameParkSDK = (function () {
    // --- Constants ---
    const STORAGE_KEY = 'tottori_game_park_data_v1';

    // --- Level System ---
    // 累計XPからレベルを算出する計算式 (2次関数的におそくなる)
    // Lv.n になるための必要累積XP = 500 * n * (n - 1)
    // Lv.1: 0
    // Lv.2: 1000
    // Lv.3: 3000
    // Lv.4: 6000
    // Lv.5: 10000
    // ...
    // Lv.10: 45000
    // Lv.50: 1,225,000

    function getLevelFromXP(xp) {
        // 逆算: 500x^2 - 500x - XP = 0 の正の解
        // ax^2 + bx + c = 0 -> x = (-b + sqrt(b^2 - 4ac)) / 2a
        // 500n^2 - 500n - xp = 0
        // n^2 - n - (xp/500) = 0
        // n = (1 + sqrt(1 + 4 * (xp/500))) / 2
        const n = (1 + Math.sqrt(1 + 4 * (xp / 500))) / 2;
        return Math.floor(n);
    }

    function getRequiredXPForLevel(lv) {
        return 500 * lv * (lv - 1);
    }

    const MAX_COINS_PER_DAY = 500;
    const LOGIN_BONUS = 10;

    // --- State ---
    let state = {
        xp: 0,       // 累計経験値
        level: 1,    // 現在のレベル
        coins: 0,    // 所持コイン
        dailyCoins: 0, // 今日の獲得コイン
        lastCoinDate: '', // 最後にコインを獲得した日付 (YYYY-MM-DD)
        lastLoginDate: '', // 最後にログインボーナスを受け取った日付
    };

    // --- Private Methods ---

    function getTodayString() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function checkDailyCoinReset() {
        const today = getTodayString();
        if (state.lastCoinDate !== today) {
            state.dailyCoins = 0;
            state.lastCoinDate = today;
        }
    }

    function checkLoginBonus() {
        const today = getTodayString();
        if (state.lastLoginDate !== today) {
            state.lastLoginDate = today;
            state.coins += LOGIN_BONUS;
            saveData();
            updateUI();
            showToast(`ログインボーナス！ ${LOGIN_BONUS}G を獲得しました🎁`, 'level-up');
        }
    }

    // --- Private Methods ---

    function loadData() {
        const json = localStorage.getItem(STORAGE_KEY);
        if (json) {
            try {
                const loaded = JSON.parse(json);
                state = { ...state, ...loaded };

                // データ整合性チェック: レベルをXPから再計算する（ルール変更対応）
                const correctLevel = getLevelFromXP(state.xp);
                if (state.level !== correctLevel) {
                    state.level = correctLevel;
                }
            } catch (e) {
                console.error("GameParkSDK: Failed to load data", e);
            }
        }
    }

    function saveData() {
        state.lastPlayed = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function updateLevel() {
        const computedLevel = getLevelFromXP(state.xp);

        if (computedLevel > state.level) {
            // レベルアップ！
            const levelDiff = computedLevel - state.level;
            state.level = computedLevel;
            showToast(`LEVEL UP! Lv.${state.level} になりました！`, 'level-up');
        }
    }

    function showToast(message, type = 'info') {
        // 簡易トースト通知
        const toast = document.createElement('div');
        toast.className = `gp-toast gp-toast-${type}`;
        toast.textContent = message;

        // スタイル
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: type === 'level-up' ? '#FFD700' : '#333',
            color: type === 'level-up' ? '#000' : '#fff',
            padding: '12px 24px',
            borderRadius: '50px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: '9999',
            fontWeight: 'bold',
            fontSize: '16px',
            opacity: '0',
            transition: 'opacity 0.3s, transform 0.3s'
        });

        document.body.appendChild(toast);

        // Animation
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Public Methods ---

    /**
     * ゲーム終了時などに呼び出す
     * @param {number} earnedXP - 獲得経験値
     * @param {number} baseCoins - 獲得予定のコイン（上限到達前）
     */
    function recordGameResult(earnedXP, baseCoins = 0) {
        if (earnedXP <= 0 && baseCoins <= 0) return;

        // XP加算
        state.xp += earnedXP;

        // 日付が変わっていればコイン獲得限度をリセット
        checkDailyCoinReset();

        // コイン加算 (1日の上限チェック)
        let actualEarnedCoins = 0;
        let limitReachedMsg = "";

        if (baseCoins > 0) {
            if (state.dailyCoins < MAX_COINS_PER_DAY) {
                // 上限までの残り枠
                const remainingLimit = MAX_COINS_PER_DAY - state.dailyCoins;
                // 実際に獲得できるコインは、基本コイン数か、残り枠の小さい方
                actualEarnedCoins = Math.min(baseCoins, remainingLimit);

                state.coins += actualEarnedCoins;
                state.dailyCoins += actualEarnedCoins;

                if (state.dailyCoins >= MAX_COINS_PER_DAY) {
                    limitReachedMsg = " (本日の上限500Gに達しました)";
                }
            } else {
                limitReachedMsg = " (本日の上限到達済)";
            }
        }

        if (actualEarnedCoins > 0) {
            showToast(`+${earnedXP} XP / +${actualEarnedCoins} G 獲得！${limitReachedMsg}`);
        } else {
            showToast(`+${earnedXP} XP 獲得！${limitReachedMsg}`);
        }

        updateLevel();
        saveData();
        updateUI(); // UIがあれば更新
    }

    /**
     * コインを消費する
     */
    function spendCoins(amount) {
        if (state.coins >= amount) {
            state.coins -= amount;
            saveData();
            updateUI();
            return true;
        }
        return false;
    }

    /**
     * 交換証明コード生成
     */
    function generateProofCode(length = 8) {
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return `TTV-${result}`;
    }

    /**
     * ユーザー情報を取得
     */
    /**
     * ユーザー情報を取得
     */
    function getUserInfo() {
        const currentLvLimit = getRequiredXPForLevel(state.level); // 現在のレベルの開始XP (例: Lv1なら0)
        const nextLvLimit = getRequiredXPForLevel(state.level + 1); // 次のレベルの開始XP (例: Lv2なら1000)

        // 進捗率 = (現在XP - 現在Lv開始XP) / (次Lv開始XP - 現在Lv開始XP)
        const progress = Math.max(0, Math.min(100,
            ((state.xp - currentLvLimit) / (nextLvLimit - currentLvLimit)) * 100
        ));

        return {
            level: state.level,
            xp: state.xp,
            coins: state.coins,
            rankName: getRankName(state.level),
            nextLevelProgress: progress
        };
    }

    function getRankName(lv) {
        if (lv >= 99) return "名誉鳥取県民";
        if (lv >= 80) return "鳥取アンバサダー";
        if (lv >= 60) return "鳥取マスター";
        if (lv >= 50) return "鳥取エキスパート";
        if (lv >= 40) return "鳥取オタク";
        if (lv >= 30) return "鳥取マニア";
        if (lv >= 20) return "鳥取ウォッチャー";
        if (lv >= 10) return "鳥取ファン";
        if (lv >= 5) return "鳥取リピーター";
        return "鳥取観光客";
    }

    /**
     * ヘッダーなどにステータスバーを表示する
     * @param {string} containerSelector - 挿入先のセレクタ (例: '#game-status-bar')
     */
    function renderStatusBar(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        // 1. Render Status Bar in the container
        if (!container.querySelector('.gp-status-content')) {
            container.innerHTML = `
                <div class="gp-status-content" style="
                    background: rgba(255, 255, 255, 0.95); 
                    border-radius: 16px;
                    padding: 12px 20px; 
                    display: flex; 
                    flex-direction: column;
                    gap: 10px;
                    font-size: 1rem;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    backdrop-filter: blur(5px);
                    border: 2px solid #fff;
                    position: relative;
                ">
                    <!-- Top Row: Level & Coins -->
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div class="gp-level-info" style="display: flex; align-items: center; gap: 8px;">
                            <span class="gp-level-badge" style="
                                background: var(--primary-color, #FF8C00); 
                                color: #fff; 
                                padding: 2px 10px; 
                                border-radius: 12px; 
                                font-weight: 900; 
                                font-size: 0.9rem;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            ">Lv.<span id="gp-disp-level">1</span></span>
                            <span id="gp-disp-rank" style="font-weight: bold; color: #333; font-size: 1rem;">観光客</span>
                            <button id="gp-rank-info-btn" style="
                                background: #eee; border: none; border-radius: 50%; width: 20px; height: 20px; 
                                font-size: 12px; color: #666; cursor: pointer; display: flex; align-items: center; justify-content: center;
                            ">?</button>
                        </div>

                        <div class="gp-coin-info" style="display: flex; align-items: center; gap: 4px; font-weight: 900; color: #FFD700; font-size: 1.2rem; text-shadow: 1px 1px 0 rgba(0,0,0,0.1);">
                            <span class="material-icons-round" style="font-size: 1.4rem;">monetization_on</span>
                            <span id="gp-disp-coins" style="color: #333;">0</span>
                            <button id="gp-coin-shop-btn" style="
                                background: #FFF9C4; border: 1px solid #FFD700; border-radius: 50%; width: 24px; height: 24px; 
                                margin-left: 8px;
                                color: #FBC02D; cursor: pointer; display: flex; align-items: center; justify-content: center;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s;
                            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                <span class="material-icons-round" style="font-size: 16px;">store</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Bottom Row: Progress -->
                    <div class="gp-progress-area" style="width: 100%;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #777; margin-bottom: 4px; font-weight: bold;">
                            <span>EXP <span id="gp-next-rank-info" style="font-weight: normal; margin-left: 8px;">次のランクまであと ...</span></span>
                            <span>本日の獲得コイン： <span id="gp-disp-daily-coins">0</span> / 500 G</span>
                        </div>
                        <div style="background: #e0e0e0; height: 10px; border-radius: 5px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                            <div id="gp-disp-bar" style="background: linear-gradient(90deg, #4CAF50, #81C784); width: 0%; height: 100%; transition: width 0.5s;"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. Render Modals directly in Body (Rank & Shop)

        // --- Rank Modal ---
        let rankModal = document.getElementById('gp-rank-modal');
        if (!rankModal) {
            rankModal = document.createElement('div');
            rankModal.id = 'gp-rank-modal';
            Object.assign(rankModal.style, {
                display: 'none',
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                zIndex: '999999',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)'
            });

            rankModal.innerHTML = `
                <div style="
                    background: #fff; border-radius: 20px; padding: 24px; width: 90%; max-width: 320px; 
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3); position: relative; animation: gpModalPop 0.3s ease;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 12px;">
                        <h4 style="margin: 0; color: #333; font-size: 1.1rem; font-weight: 900;">👑 ランク一覧</h4>
                        <button class="gp-modal-close" style="background: none; border: none; font-size: 1.5rem; color: #999; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                    </div>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.95rem; color: #444; display: flex; flex-direction: column; gap: 8px;">
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #fafafa; border-radius: 8px;"><span>Lv.1〜</span> <strong>鳥取観光客</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #f0f8ff; border-radius: 8px;"><span>Lv.5〜</span> <strong>鳥取リピーター</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #e6f7ff; border-radius: 8px;"><span>Lv.10〜</span> <strong>鳥取ファン</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #e0f2f1; border-radius: 8px;"><span>Lv.20〜</span> <strong>鳥取ウォッチャー</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #fff0f5; border-radius: 8px;"><span>Lv.30〜</span> <strong>鳥取マニア</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #fce4ec; border-radius: 8px;"><span>Lv.40〜</span> <strong style="color: #d81b60;">鳥取オタク</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #f3e5f5; border-radius: 8px; border: 1px solid silver;"><span>Lv.50〜</span> <strong style="color: #8e24aa;">鳥取エキスパート</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #fffacd; border-radius: 8px; border: 1px solid gold;"><span>Lv.60〜</span> <strong style="color: #ff8c00;">鳥取マスター</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #fff8e1; border-radius: 8px; border: 1px solid orange;"><span>Lv.80〜</span> <strong style="color: #ff6f00;">鳥取アンバサダー</strong></li>
                        <li style="display: flex; justify-content: space-between; padding: 6px; background: #fff; border-radius: 8px; border: 2px solid red;"><span>Lv.99</span> <strong style="color: red;">名誉鳥取県民</strong></li>
                    </ul>
                </div>
            `;
            document.body.appendChild(rankModal);

            // Close logic
            rankModal.onclick = (e) => { if (e.target === rankModal) rankModal.style.display = 'none'; };
            rankModal.querySelector('.gp-modal-close').onclick = () => rankModal.style.display = 'none';
        }

        // --- Shop Modal ---
        let shopModal = document.getElementById('gp-shop-modal');
        if (!shopModal) {
            shopModal = document.createElement('div');
            shopModal.id = 'gp-shop-modal';
            Object.assign(shopModal.style, {
                display: 'none',
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                zIndex: '999999',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)'
            });

            // Shop Items Data
            const shopItems = [
                { id: 'item_wallpaper', icon: 'wallpaper', name: '特製スマホ壁紙等', price: 2500, desc: 'まずはここから！何が当たるかお楽しみ' },
                { id: 'item_voice', icon: 'graphic_eq', name: 'ゆかりん等のボイス', price: 10000, desc: 'いろんなボイスをご用意！' },
                { id: 'item_namecall', icon: 'record_voice_over', name: '動画でお名前読み上げ権', price: 10000, desc: 'メッセージを添えて読み上げます' },
                { id: 'item_char', icon: 'badge', name: 'あなたをキャラ化します', price: 50000, desc: 'ゆかりん・みやっちテイストのイラストに！' }
            ];

            const itemsHtml = shopItems.map(item => `
                <div style="display: flex; flex-direction: column; background: #fff; padding: 12px; border-radius: 12px; border: 1px solid #eee; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <div style="background: #FFF9C4; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #FBC02D; margin-right: 12px; flex-shrink: 0;">
                            <span class="material-icons-round">${item.icon}</span>
                        </div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: bold; font-size: 0.95rem; color: #333;">${item.name}</div>
                            <div style="font-size: 0.75rem; color: #888; margin-top: 2px;">${item.desc}</div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #eee; padding-top: 8px;">
                        <div style="font-weight: 900; color: #FF8C00; font-size: 1rem;">
                            ${item.price.toLocaleString()} <span style="font-size: 0.75rem;">G</span>
                        </div>
                        <button class="gp-buy-btn" data-item-id="${item.id}" data-item-price="${item.price}" data-item-name="${item.name}" style="
                            background: #4CAF50; color: white; border: none; padding: 6px 16px; border-radius: 20px; 
                            font-size: 0.85rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;
                            box-shadow: 0 2px 5px rgba(76, 175, 80, 0.3); transition: background 0.2s;
                        ">
                            <span class="material-icons-round" style="font-size: 14px;">shopping_cart_checkout</span> 交換
                        </button>
                    </div>
                </div>
            `).join('');

            shopModal.innerHTML = `
                <div style="
                    background: #fff; border-radius: 20px; padding: 24px; width: 90%; max-width: 320px; 
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3); position: relative; animation: gpModalPop 0.3s ease;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 12px;">
                        <h4 style="margin: 0; color: #333; font-size: 1.1rem; font-weight: 900;">🪙 コイン交換所</h4>
                        <button class="gp-modal-close" style="background: none; border: none; font-size: 1.5rem; color: #999; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                    </div>
                    <div style="margin-bottom: 15px; font-size: 0.85rem; color: #666; background: #E8F5E9; padding: 8px 12px; border-radius: 8px;">
                        貯めたコインでアイテムと交換！<br>
                        <span style="font-size: 0.75rem;">※現在はプレビュー表示です</span>
                    </div>
                    <div style="max-height: 400px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin;">
                        ${itemsHtml}
                    </div>
                </div>
                <style>
                    @keyframes gpModalPop { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                    .gp-buy-btn:hover { background: #43A047 !important; }
                    .gp-buy-btn:disabled { background: #ccc !important; cursor: not-allowed !important; box-shadow: none !important; }
                </style>
            `;
            document.body.appendChild(shopModal);

            // Close logic
            shopModal.onclick = (e) => { if (e.target === shopModal) shopModal.style.display = 'none'; };
            shopModal.querySelector('.gp-modal-close').onclick = () => shopModal.style.display = 'none';

            // Buy Button Logic
            const buyButtons = shopModal.querySelectorAll('.gp-buy-btn');
            buyButtons.forEach(btn => {
                btn.onclick = (e) => {
                    const price = parseInt(btn.dataset.itemPrice, 10);
                    const name = btn.dataset.itemName;

                    if (state.coins < price) {
                        alert(`「${name}」を交換するにはコインが足りません。\n（所持：${state.coins.toLocaleString()}G / 必要：${price.toLocaleString()}G）`);
                        return;
                    }

                    if (confirm(`【${name}】\n${price.toLocaleString()}G を消費して交換しますか？\n\n※「OK」を押すと公式LINEが立ち上がり、アイテム受け取り用のメッセージが表示されます。そのまま送信してください。`)) {
                        // コイン消費
                        if (spendCoins(price)) {
                            // 交換証明コード生成
                            const proofCode = generateProofCode();
                            const currentLvl = state.level;

                            // LINEに送るメッセージを構築 (LINE公式アカウントのリンク)
                            const message = `ゲームパークでアイテムを交換するよ！\n\n【交換アイテム】\n${name}\n\n【交換証明コード】\n${proofCode}\n\n【プレイヤー情報】\nLv.${currentLvl}\n\n※このメッセージをそのまま送信してください😊`;

                            // LINE URL（LINE公式に送れるよう、URLパラメータやLINE URLスキームで飛ばす）
                            const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;

                            alert(`交換が完了しました！\n\n証明コード：${proofCode}\n\n※公式LINEが開きますので、自動入力されたメッセージをそのまま送信してください。運営から手動でアイテムをお届けします。`);

                            // モーダルを閉じてLINEを開く
                            shopModal.style.display = 'none';
                            window.open(lineUrl, '_blank');
                        }
                    }
                };
            });
        }

        // Setup Open Events
        const btnRankOpen = container.querySelector('#gp-rank-info-btn');
        if (btnRankOpen && rankModal) {
            btnRankOpen.onclick = (e) => { e.stopPropagation(); rankModal.style.display = 'flex'; };
        }

        const btnShopOpen = container.querySelector('#gp-coin-shop-btn');
        if (btnShopOpen && shopModal) {
            btnShopOpen.onclick = (e) => { e.stopPropagation(); shopModal.style.display = 'flex'; };
        }

        updateUI();

        // Welcome Toast & Login Bonus
        setTimeout(() => {
            showToast('ゲームパークへようこそ！', 'info');
            setTimeout(checkLoginBonus, 1500);
        }, 500);
    }

    function getNextRankLevel(currentLv) {
        const levels = [5, 10, 20, 30, 40, 50, 60, 80, 99];
        for (const lv of levels) {
            if (currentLv < lv) return lv;
        }
        return null; // Master
    }

    function updateUI() {
        const info = getUserInfo();

        const elLevel = document.getElementById('gp-disp-level');
        const elRank = document.getElementById('gp-disp-rank');
        const elBar = document.getElementById('gp-disp-bar');
        const elCoins = document.getElementById('gp-disp-coins');
        const elDailyCoins = document.getElementById('gp-disp-daily-coins');
        const elNextRank = document.getElementById('gp-next-rank-info');

        if (elLevel) elLevel.textContent = info.level;
        if (elRank) elRank.textContent = info.rankName;
        if (elBar) elBar.style.width = `${info.nextLevelProgress}%`;
        if (elCoins) elCoins.textContent = info.coins.toLocaleString();

        checkDailyCoinReset();
        if (elDailyCoins) elDailyCoins.textContent = state.dailyCoins.toLocaleString();

        if (elNextRank) {
            const nextLv = getNextRankLevel(info.level);
            if (nextLv) {
                // Next rank name
                const nextRankName = getRankName(nextLv);
                const levelsLeft = nextLv - info.level;
                elNextRank.textContent = `あとLv.${levelsLeft}で「${nextRankName}」`;
            } else {
                elNextRank.textContent = `最高ランク到達！`;
            }
        }

        const shopModal = document.getElementById('gp-shop-modal');
        if (shopModal) {
            const buyButtons = shopModal.querySelectorAll('.gp-buy-btn');
            buyButtons.forEach(btn => {
                const price = parseInt(btn.dataset.itemPrice, 10);
                if (info.coins < price) {
                    btn.style.opacity = '0.5';
                    btn.querySelector('span.material-icons-round').textContent = 'lock';
                } else {
                    btn.style.opacity = '1';
                    btn.querySelector('span.material-icons-round').textContent = 'shopping_cart_checkout';
                }
            });
        }
    }

    // 初期化
    loadData();

    return {
        recordGameResult,
        getUserInfo,
        renderStatusBar,
        // デバッグ用
        debugAddXP: (val) => { state.xp += val; updateLevel(); saveData(); updateUI(); }
    };

})();
