/**
 * BrainCheck MVP Logic
 * - Color Logic: Stroop test based
 * - Storage: LocalStorage (Last 7 days)
 * - Tottori motif included
 */

// --- Constants & Config ---
const CONFIG = {
    totalQuestions: 10,
    timeLimitPerQuestion: 5000, // ms
    perfectScore: 100, // 10 points * 10
};

// Colors definition: ID, Label (JP), Hex
const COLORS = [
    { id: 'red', label: '赤', hex: '#e74c3c' },
    { id: 'blue', label: '青', hex: '#3498db' },
    { id: 'yellow', label: '黄', hex: '#f1c40f' }, // 文字色は黒にするなどの配慮が必要だが今回は背景色として扱う
    { id: 'green', label: '緑', hex: '#2ecc71' }
];

// --- Theme Configuration ---
const THEMES = {
    0: { id: 'random', label: 'バラエティ' }, // Sunday
    1: { id: 'simple', label: 'シンプルカラー' }, // Monday
    2: { id: 'tottori', label: '鳥取テーマ' }, // Tuesday
    3: { id: 'char_mix', label: '文字ゆらぎ' }, // Wednesday
    4: { id: 'daily', label: '日常ワード' }, // Thursday
    5: { id: 'speed', label: 'スピード脳' }, // Friday
    6: { id: 'emotion', label: '感情ワード' } // Saturday
};

// Word Sets for Themes
// Word Sets for Themes (Expanded with Tottori)
const WORD_SETS = {
    simple: [
        { text: '赤', type: 'color', associatedId: 'red' },
        { text: '青', type: 'color', associatedId: 'blue' },
        { text: '黄', type: 'color', associatedId: 'yellow' },
        { text: '緑', type: 'color', associatedId: 'green' },
        // Tottori Mix
        { text: 'カニ', type: 'object', associatedId: 'red' },
        { text: '梨', type: 'object', associatedId: 'yellow' },
        { text: '大山', type: 'object', associatedId: 'green' },
        { text: '海', type: 'object', associatedId: 'blue' }
    ],
    tottori: [
        // Red
        { text: 'カニ', type: 'object', associatedId: 'red' },
        { text: 'スイカ', type: 'object', associatedId: 'red' }, // Daiei Watermelon
        { text: '赤瓦', type: 'object', associatedId: 'red' },
        // Yellow
        { text: '梨', type: 'object', associatedId: 'yellow' },
        { text: '砂丘', type: 'object', associatedId: 'yellow' },
        { text: 'カレー', type: 'object', associatedId: 'yellow' }, // Consumption ranking
        // Green
        { text: '大山', type: 'object', associatedId: 'green' },
        { text: 'ネギ', type: 'object', associatedId: 'green' }, // Yonago Negi
        { text: '山', type: 'object', associatedId: 'green' },
        // Blue
        { text: '日本海', type: 'object', associatedId: 'blue' },
        { text: '星空', type: 'object', associatedId: 'blue' }, // Hoshitori Pref
        { text: '空', type: 'object', associatedId: 'blue' },
    ],
    char_mix: [
        { text: 'あか', type: 'color', associatedId: 'red' },
        { text: 'アオ', type: 'color', associatedId: 'blue' },
        { text: 'きいろ', type: 'color', associatedId: 'yellow' },
        { text: 'ミドリ', type: 'color', associatedId: 'green' },
    ],
    daily: [
        { text: 'カニ', type: 'object', associatedId: 'red' }, // Keep Tottori elements high freq
        { text: '信号', type: 'object', associatedId: 'blue' },
        { text: 'バナナ', type: 'object', associatedId: 'yellow' },
        { text: '葉っぱ', type: 'object', associatedId: 'green' },
        { text: '梨', type: 'object', associatedId: 'yellow' },
    ],
    emotion: [
        { text: '怒り', type: 'object', associatedId: 'red' },
        { text: '冷静', type: 'object', associatedId: 'blue' },
        { text: '元気', type: 'object', associatedId: 'yellow' },
        { text: '癒し', type: 'object', associatedId: 'green' },
    ]
};

const COMMENTS = {
    s: ['神懸かってる！', '脳年齢20代！？', 'キレッキレです'],
    a: ['素晴らしい！', '冴えてますね', 'ナイス判断力'],
    b: ['いい感じ！', 'まずまずです', '平常運転ですね'],
    c: ['お疲れ気味？', '深呼吸しましょう', 'もう一回！']
};

// --- Question Types & Logic ---
// --- Question Types & Logic ---
const QUESTION_TYPES = {
    COLOR: 'color',     // 3 questions
    MATH: 'math',       // 3 questions
    MEMORY: 'memory',   // 2 questions
    SEQUENCE: 'sequence'// 2 questions
};

// ...



const GUIDE_TEXTS = {
    color: '文字の意味ではなく「色」を選んでください',
    math: '計算結果を選んでください', // Updated
    memory: '一瞬表示される内容を覚えてください',
    sequence: '次にくる数字を選んでください' // Updated
};

// --- State Management ---
let state = {
    currentQuestion: 0, // 0-indexed internally, display 1-based
    questionQueue: [],  // Array of { type, data }
    score: 0,
    startTime: 0,
    endTime: 0,
    questionStartTime: 0,
    timerId: null,
    isProcessing: false,
    theme: null,
    currentAnswer: null
};

// --- DOM Elements ---
const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
    history: document.getElementById('history-screen')
};

const ui = {
    questionCount: document.getElementById('question-count'),
    timerBar: document.getElementById('timer-bar'),
    problemText: document.getElementById('problem-text'),
    choices: document.querySelectorAll('.choice-btn'),
    // Start Screen
    themeDisplay: document.getElementById('theme-display'),

    // Game Screen
    questionGuide: document.getElementById('question-guide'),

    // Result
    resultDate: document.getElementById('result-date'),
    resultScore: document.getElementById('result-score'),
    resultTime: document.getElementById('result-time'),
    resultRank: document.getElementById('result-rank'),
    resultComment: document.getElementById('result-comment'),
    resultTitle: document.getElementById('result-title'), // Need to ensure this exists or use fallback
    resultTheme: document.getElementById('result-theme'),

    // History
    historyList: document.getElementById('history-list')
};

// --- Event Listeners ---
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('back-to-title-btn').addEventListener('click', () => switchScreen('start'));
document.getElementById('history-btn').addEventListener('click', showHistory);
document.getElementById('back-btn').addEventListener('click', () => switchScreen('result'));

ui.choices.forEach(btn => {
    btn.addEventListener('click', (e) => handleAnswer(e.target.dataset.color || e.target.closest('.choice-btn').dataset.color));

    // Safari touch delay fix
    btn.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Prevents delay and double firing
        btn.click();
    }, { passive: false });
});

// --- Core Functions ---

// --- Theme Logic ---
const BRAIN_THEMES = [
    '大人の余裕',
    '冷静力チェック',
    'イライラ耐性',
    '落ち着き勝負',
    '感情に流されない力',
    'ブレない心',
    '瞬時の判断'
];

function getTodayTheme() {
    // Determine theme based on day of month to rotate through list
    const day = new Date().getDate();
    const themeLabel = BRAIN_THEMES[day % BRAIN_THEMES.length];
    return { id: 'tottori', label: themeLabel };
}

function getWordList(themeId) {
    if (themeId === 'random') {
        // Merge all lists
        let all = [];
        Object.values(WORD_SETS).forEach(list => all = all.concat(list));
        return all;
    }
    if (themeId === 'speed') {
        // Use Simple + Daily for speed mode
        return WORD_SETS['simple'].concat(WORD_SETS['daily']);
    }
    return WORD_SETS[themeId] || WORD_SETS['simple'];
}

function switchScreen(screenId) {
    // Hide all
    Object.values(screens).forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none'; // Force hide
    });

    // Show target
    const target = screens[screenId];
    target.style.display = 'flex'; // Reset display
    // Force reflow
    void target.offsetWidth;
    target.classList.add('active');

    // Update theme display on start screen
    if (screenId === 'start') {
        const theme = getTodayTheme();
        if (ui.themeDisplay) ui.themeDisplay.textContent = `今日のテーマ：${theme.label}`;
    }
}

function generateQuestionQueue() {
    // Distribution: Color:4, Math:2, Sequence:2, Memory:2
    const pool = [
        ...Array(4).fill(QUESTION_TYPES.COLOR),
        ...Array(2).fill(QUESTION_TYPES.MATH),
        ...Array(2).fill(QUESTION_TYPES.MEMORY),
        ...Array(2).fill(QUESTION_TYPES.SEQUENCE)
    ];

    let queue = [];
    let attempts = 0;

    while (attempts < 100) {
        // Shuffle pool
        const shuffled = [...pool].sort(() => Math.random() - 0.5);

        // Check constraints: No 3 consecutive same types
        let valid = true;
        for (let i = 2; i < shuffled.length; i++) {
            if (shuffled[i] === shuffled[i - 1] && shuffled[i] === shuffled[i - 2]) {
                valid = false;
                break;
            }
        }

        if (valid) {
            queue = shuffled;
            break;
        }
        attempts++;
    }

    // If failed to find valid sort (unlikely), just use shuffled
    if (queue.length === 0) queue = pool.sort(() => Math.random() - 0.5);

    return queue.map(type => ({ type }));
}

function startGame() {
    // Determine Theme
    state.theme = getTodayTheme();

    // Reset State
    state.currentQuestion = 0;
    state.score = 0;
    state.startTime = Date.now();
    state.isProcessing = false;

    // Safety: Regeneration of question queue
    try {
        state.questionQueue = generateQuestionQueue();
    } catch (e) {
        console.error("Queue Generation Failed", e);
        // Fallback queue
        state.questionQueue = Array(10).fill({ type: QUESTION_TYPES.COLOR });
    }

    // Theme Time Limit (Base)
    state.baseTimeLimit = state.theme.id === 'speed' ? 3000 : CONFIG.timeLimitPerQuestion;

    switchScreen('game');
    nextQuestion();
}

function nextQuestion() {
    state.currentQuestion++;

    if (state.currentQuestion > CONFIG.totalQuestions) {
        endGame();
        return;
    }

    // Update UI
    ui.questionCount.textContent = `${state.currentQuestion} / ${CONFIG.totalQuestions}`;
    state.isProcessing = false;

    // Safety check for queue
    if (!state.questionQueue || state.questionQueue.length === 0) {
        state.questionQueue = generateQuestionQueue();
    }

    // Bounds check
    const qIndex = state.currentQuestion - 1;
    if (qIndex < 0 || qIndex >= state.questionQueue.length) {
        // Should not happen if totalQuestions matches queue length, but fallback
        console.error("Queue index out of bounds", qIndex);
        return endGame();
    }

    const qType = state.questionQueue[qIndex].type;


    const GUIDE_TEXTS = {
        color: '文字の意味ではなく「色」を選んでください',
        math: '計算結果を選んでください',
        memory: '一瞬表示される内容を覚えてください',
        sequence: '次にくる数字を選んでください'
    };

    // ...
    // Clear previous specific UI adjustments
    ui.problemText.style.fontSize = '';
    ui.problemText.textContent = ''; // Explicitly clear
    ui.choices.forEach(btn => {
        btn.textContent = '';
        btn.className = 'choice-btn'; // reset classes
        // RESET ALL INLINE STYLES (Critical for switching between Math/Color/Memory)
        btn.style.cssText = '';
        btn.style.visibility = 'visible';
        btn.style.pointerEvents = 'auto';
    });

    // Set Guide Text
    if (ui.questionGuide) {
        ui.questionGuide.textContent = GUIDE_TEXTS[qType] || '';
    }

    // Dispatch generation based on type
    if (qType === QUESTION_TYPES.COLOR) generateColorProblem();
    else if (qType === QUESTION_TYPES.MATH) generateMathProblem();
    else if (qType === QUESTION_TYPES.MEMORY) generateMemoryProblem();
    else if (qType === QUESTION_TYPES.SEQUENCE) generateSequenceProblem();

    // Start Timer
    resetTimerBar();
    startTimer();
}

// --- Generators ---

function generateColorProblem() {
    const targetColor = getRandomElement(COLORS);
    const wordList = getWordList(state.theme.id);

    let text, colorHex;
    const isMatch = Math.random() < 0.3;

    if (isMatch) {
        const matching = wordList.filter(w => w.associatedId === targetColor.id);
        const w = matching.length > 0 ? getRandomElement(matching) : { text: targetColor.label };
        text = w.text;
    } else {
        const conflict = wordList.filter(w => w.associatedId !== targetColor.id);
        const w = conflict.length > 0 ? getRandomElement(conflict) : getRandomElement(wordList);
        text = w.text;
    }
    colorHex = targetColor.hex;

    ui.problemText.textContent = text;
    ui.problemText.style.color = colorHex;
    ui.problemText.style.fontSize = '64px'; // Large for color
    state.currentAnswer = targetColor.id;

    // Buttons: Color names
    const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5);    // Hide all
    Object.values(screens).forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none'; // Force hide
    });

    // Show target
    const target = screens['game']; // Assuming 'game' is the current screen for questions
    target.style.display = 'flex'; // Reset display
    // Force reflow
    void target.offsetWidth;
    target.classList.add('active');
    ui.choices.forEach((btn, i) => {
        const c = shuffledColors[i]; // Use index to map 4 buttons
        if (c) {
            btn.textContent = c.label;
            btn.dataset.color = c.id;
            btn.classList.add(`bg-${c.id}`);
        }
    });
}

// --- New Generators ---
const TOTTORI_SHOP_ITEMS = [
    { name: '二十世紀梨', price: 300, unit: '個' },
    { name: '白バラコーヒー', price: 150, unit: '本' },
    { name: '砂丘らっきょう', price: 500, unit: '袋' },
    { name: 'とうふちくわ', price: 200, unit: '本' },
    { name: '打吹公園だんご', price: 600, unit: '箱' },
    { name: 'カニ汁', price: 400, unit: '杯' },
    { name: 'モサエビ', price: 100, unit: '尾' },
    { name: '牛骨ラーメン', price: 800, unit: '杯' },
    { name: 'すなば珈琲', price: 450, unit: '杯' },
    { name: '因幡の白うさぎ', price: 150, unit: '個' },
    { name: '大山どり唐揚', price: 100, unit: '個' },
    { name: 'あごちくわ', price: 250, unit: '本' },
    { name: 'いただき', price: 200, unit: '個' },
    { name: 'ねばりっこ', price: 600, unit: '本' }
];

function generateMathProblem() {
    // Shopping Calculation: (Price A x Qty) + (Price B x Qty)

    // Pick 2 unique items
    const shuffled = [...TOTTORI_SHOP_ITEMS].sort(() => Math.random() - 0.5);
    const item1 = shuffled[0];
    const item2 = shuffled[1];

    // Quantities (1-3 to keep mental math manageable within 5 sec)
    const qty1 = Math.floor(Math.random() * 3) + 1;
    const qty2 = Math.floor(Math.random() * 3) + 1;

    const ans = (item1.price * qty1) + (item2.price * qty2);

    // Format Text
    // Use smaller font for longer text
    ui.problemText.style.fontSize = '24px';
    ui.problemText.style.lineHeight = '1.4';

    ui.problemText.innerHTML = `
        <span style="color:#2c3e50;">${item1.name}</span><span style="font-size:0.8em">(${item1.price}円)</span> × ${qty1}${item1.unit}<br>
        + <span style="color:#2c3e50;">${item2.name}</span><span style="font-size:0.8em">(${item2.price}円)</span> × ${qty2}${item2.unit}
    `;

    state.currentAnswer = `${ans}円`;

    if (ui.questionGuide) ui.questionGuide.textContent = '合計金額を計算してください';

    // Choices
    const wrongs = new Set();
    while (wrongs.size < 3) {
        // Generate wrong answers relative to correct answer (e.g. +/- 50, 100, 200)
        // Or create calculation errors (wrong price, wrong qty)
        const diff = (Math.floor(Math.random() * 5) + 1) * 50 * (Math.random() < 0.5 ? 1 : -1); // Steps of 50
        const w = ans + diff;
        if (w > 0 && w !== ans) wrongs.add(`${w}円`);
    }

    const choices = [`${ans}円`, ...wrongs].sort(() => Math.random() - 0.5);
    setupTextChoices(choices);
}

// --- New Generators ---
function generateSequenceProblem() {
    // Sequence: 2, 4, 6, ?
    // Types: Arithmetic (+n), Geometric (*n) - minimal

    const diff = Math.floor(Math.random() * 4) + 1; // +1 to +4
    const start = Math.floor(Math.random() * 10) + 1;
    const seq = [start, start + diff, start + diff * 2];
    const ans = start + diff * 3;

    ui.problemText.textContent = `${seq.join(' → ')} → ?`;
    ui.problemText.style.color = '#333';
    ui.problemText.style.fontSize = '48px';
    state.currentAnswer = String(ans);

    const wrongs = new Set();
    while (wrongs.size < 3) {
        let w = ans + (Math.floor(Math.random() * 6) - 3);
        if (w !== ans && w > 0) wrongs.add(w);
    }
    const choices = [ans, ...wrongs].sort(() => Math.random() - 0.5);
    setupTextChoices(choices);
}

function generateMemoryProblem() {
    // Memory Hard Mode: Remember Word AND Color

    // 1. Setup Content
    const items = ['カニ', '梨', '砂丘', '大山', '星空', 'スイカ', 'ラッキョウ', '白バラ', '鬼太郎'];
    const targetItem = getRandomElement(items);

    const colors = [
        { id: 'red', label: '赤', hex: '#E74C3C' },
        { id: 'blue', label: '青', hex: '#3498DB' },
        { id: 'yellow', label: '黄', hex: '#F1C40F' },
        { id: 'green', label: '緑', hex: '#2ECC71' }
    ];
    const targetColor = getRandomElement(colors);

    // 2. Display Phase
    ui.problemText.textContent = targetItem;
    ui.problemText.style.color = targetColor.hex;
    ui.problemText.style.fontSize = '56px';

    // Hint text? Maybe "覚えろ！" but keep it minimal to increase tension
    if (ui.questionGuide) ui.questionGuide.textContent = '内容と色を覚えてください';

    // Disable buttons
    ui.choices.forEach(b => {
        b.style.visibility = 'hidden';
        b.style.pointerEvents = 'none';
    });

    // 3. Question Phase (Delayed)
    setTimeout(() => {
        if (state.currentQuestion > CONFIG.totalQuestions) return;

        // Hide problem
        ui.problemText.textContent = "???";
        ui.problemText.style.color = '#333';

        // Decide Question Type: Word (50%) or Color (50%)
        const askColor = Math.random() < 0.5;

        if (askColor) {
            // Ask for Color
            if (ui.questionGuide) ui.questionGuide.textContent = 'さっきの文字の「色」は？';
            state.currentAnswer = targetColor.id;

            // Show Color Choices
            const shuffledColors = [...colors].sort(() => Math.random() - 0.5);
            ui.choices.forEach((btn, i) => {
                const c = shuffledColors[i];
                btn.textContent = c.label;
                btn.dataset.color = c.id;
                // Specific styling for Color choices (colored buttons)
                btn.style.backgroundColor = c.hex;
                btn.style.color = 'white';
                if (c.id === 'yellow') btn.style.color = '#333'; // Contrast
                btn.style.border = 'none';
            });

        } else {
            // Ask for Word
            if (ui.questionGuide) ui.questionGuide.textContent = 'さっきの「言葉」は？';
            state.currentAnswer = targetItem;

            // Show Word Choices
            const wrongs = new Set();
            while (wrongs.size < 3) {
                const w = getRandomElement(items);
                if (w !== targetItem) wrongs.add(w);
            }
            const choices = [targetItem, ...wrongs].sort(() => Math.random() - 0.5);
            setupTextChoices(choices);
        }

        // Re-enable buttons
        ui.choices.forEach(b => {
            b.style.visibility = 'visible';
            b.style.pointerEvents = 'auto';
        });

    }, 1000); // 1 sec memorization
}

function setupTextChoices(values) {
    ui.choices.forEach((btn, i) => {
        if (values[i] !== undefined) {
            btn.textContent = values[i];
            btn.dataset.color = values[i]; // reusing data-color as answer key
            // Style: Neutral
            btn.style.backgroundColor = '#ecf0f1';
            btn.style.color = '#2c3e50';
            btn.style.border = '2px solid #bdc3c7';
        }
    });
}

// Animation Helper (replace old single function logic)
// (Problem rendering is done in generators)

function handleAnswer(selectedColorId) {
    if (state.isProcessing) return;
    state.isProcessing = true;
    clearInterval(state.timerId);

    const isCorrect = selectedColorId === state.currentAnswer;

    if (isCorrect) {
        state.score += 10;
        // Visual Feedback (Subtle)
    } else {
        // Shake effect
        document.body.classList.add('shake');
        setTimeout(() => document.body.classList.remove('shake'), 400);
    }

    // Wait a bit before next question
    setTimeout(nextQuestion, 200);
}

function startTimer() {
    state.questionStartTime = Date.now();
    ui.timerBar.style.width = '100%';

    state.timerId = setInterval(() => {
        const elapsed = Date.now() - state.questionStartTime;
        const remaining = state.timeLimit - elapsed;
        const percent = Math.max(0, (remaining / state.timeLimit) * 100);

        ui.timerBar.style.width = `${percent}%`;

        if (remaining <= 0) {
            clearInterval(state.timerId);
            handleAnswer('timeout'); // Force wrong answer
        }
    }, 50); // 20fps update is enough for bar
}

function resetTimerBar() {
    ui.timerBar.style.transition = 'none';
    ui.timerBar.style.width = '100%';
    // Force reflow
    void ui.timerBar.offsetWidth;
    ui.timerBar.style.transition = 'width 0.1s linear';
}

function endGame() {
    state.endTime = Date.now();
    const totalTime = ((state.endTime - state.startTime) / 1000).toFixed(1);

    // Calc Rank
    let rank = 'C';
    let commentList = COMMENTS.c;

    if (state.score >= 100) {
        if (totalTime < 25) { rank = 'S'; commentList = COMMENTS.s; }
        else { rank = 'A'; commentList = COMMENTS.a; }
    } else if (state.score >= 80) {
        rank = 'A'; commentList = COMMENTS.a;
    } else if (state.score >= 60) {
        rank = 'B'; commentList = COMMENTS.b;
    }

    const randomComment = getRandomElement(commentList);

    // Render Result
    const now = new Date();
    ui.resultDate.textContent = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    ui.resultScore.innerHTML = `${state.score}<span>点</span>`;
    ui.resultTime.textContent = `${totalTime}s`;
    ui.resultRank.textContent = rank;
    ui.resultComment.textContent = randomComment;

    // Show Theme on Result
    if (ui.resultTheme) {
        ui.resultTheme.textContent = `今日の脳テーマ：${state.theme.label}`;
    } else {
        // Fallback if element not in HTML yet, prepend to card
        const themeEl = document.createElement('div');
        themeEl.textContent = `今日の脳テーマ：${state.theme.label}`;
        themeEl.style.fontSize = '14px';
        themeEl.style.color = '#7f8c8d';
        themeEl.style.marginTop = '8px';
        themeEl.style.marginBottom = '4px';
        themeEl.style.fontWeight = 'bold'; // Slightly emphasized based on request
        document.getElementById('result-card').insertBefore(themeEl, ui.resultTitle);
        ui.resultTheme = themeEl;
    }

    // Show Score Difference
    showScoreDiff(state.score);

    saveHistory(state.score, totalTime, now.toISOString(), state.theme.label);

    // SDK Record
    if (typeof GameParkSDK !== 'undefined') {
        // Brain check score is vital, high reward
        GameParkSDK.recordGameResult(state.score * 5, 2.0);
    }

    switchScreen('result');
}

// --- History Logic ---
function saveHistory(score, time, dateStr, themeLabel) {
    const key = 'braincheck_history';
    let history = JSON.parse(localStorage.getItem(key) || '[]');

    // Fallback for theme
    // If saving from old version or manual call, themeLabel might be undefined.
    // However, we just added themeLabel to the signature above.

    // Use themeLabel directly as 'theme' property in object
    const theme = themeLabel || 'Daily';

    history.unshift({ score, time, date: dateStr, theme });

    // Keep last 7
    if (history.length > 7) {
        history = history.slice(0, 7);
    }

    localStorage.setItem(key, JSON.stringify(history));
}

function showHistory() {
    const key = 'braincheck_history';
    const history = JSON.parse(localStorage.getItem(key) || '[]');

    ui.historyList.innerHTML = '';

    if (history.length === 0) {
        ui.historyList.innerHTML = '<li class="history-item">履歴はありません</li>';
    } else {
        history.forEach(item => {
            const date = new Date(item.date);
            const dateDisplay = `${date.getMonth() + 1}/${date.getDate()}`;
            const themeDisplay = item.theme ? `<span style="font-size:10px; color:#999; display:block;">${item.theme}</span>` : '';

            const li = document.createElement('li');
            li.className = 'history-item';
            // Use flexbox or span structure as updated previously
            // Check if we need to completely replace innerHTML logic to be safe
            // The previous tool call might have been slightly off or partial.
            // Let's ensure the innerHTML is clean.
            const themeText = item.theme || 'Daily';
            const themeHtml = `<span style="display:block; font-size:10px; color:#95a5a6; margin-top:2px;">${themeText}</span>`;

            li.innerHTML = `
                <div style="text-align:left;">
                    <div style="font-weight:bold; color:#7f8c8d;">${dateDisplay}</div>
                    ${themeHtml}
                </div>
                <div style="text-align:right;">
                    <span style="font-size:14px; margin-right:8px; color:#7f8c8d;">${item.time}s</span>
                    <span class="history-score" style="font-size:18px; color:#2c3e50;">${item.score}点</span>
                </div>
            `;
            ui.historyList.appendChild(li);
        });
    }

    switchScreen('history');
}


// --- Utilities ---
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- Tutorial / Help Logic ---
const TUTORIAL_KEY = 'braincheck_hasSeenHelp';
const uiHelp = {
    card: document.getElementById('help-card'),
    closeBtn: document.getElementById('help-close'),
    toggleCheck: document.getElementById('help-toggle-check'),
    openBtn: document.getElementById('help-btn')
};

function initTutorial() {
    const hasSeen = localStorage.getItem(TUTORIAL_KEY);

    if (!hasSeen) {
        // First time: Show card, hide button
        uiHelp.card.style.display = 'block';
        uiHelp.openBtn.style.display = 'none';
    } else {
        // Returned: Hide card, show button if needed (currently hidden based on user feedback)
        uiHelp.card.style.display = 'none';
        uiHelp.openBtn.style.display = 'none'; // Keep hidden for now
    }

    // Checkbox state (visual only, logic is on close)
    uiHelp.toggleCheck.checked = true; // Default to check for "Don't show next time"
}

function closeTutorial() {
    if (uiHelp.toggleCheck.checked) {
        localStorage.setItem(TUTORIAL_KEY, 'true');
    }
    uiHelp.card.style.display = 'none';
    uiHelp.openBtn.style.display = 'inline-block';
}

function openTutorial() {
    uiHelp.card.style.display = 'block';
    uiHelp.openBtn.style.display = 'none';
}

if (uiHelp.closeBtn) uiHelp.closeBtn.addEventListener('click', closeTutorial);
if (uiHelp.openBtn) uiHelp.openBtn.addEventListener('click', openTutorial);

// --- Score Difference Logic ---
function showScoreDiff(currentScore) {
    const resultDiffEl = document.getElementById('result-diff');
    if (!resultDiffEl) return;

    // User requested simpler logic using "lastScore" key
    const lastScore = localStorage.getItem("lastScore");

    if (lastScore !== null) {
        const diff = currentScore - Number(lastScore);

        if (diff > 0) {
            resultDiffEl.textContent = `前回より +${diff}点`;
            resultDiffEl.className = "result-diff diff-plus";
        } else if (diff < 0) {
            resultDiffEl.textContent = `前回より ${diff}点`;
            resultDiffEl.className = "result-diff diff-minus";
        } else {
            resultDiffEl.textContent = "前回より ±0点";
            resultDiffEl.className = "result-diff";
        }
    } else {
        resultDiffEl.textContent = "前回より：はじめての挑戦";
        resultDiffEl.className = 'result-diff diff-new';
    }

    // Save strictly the number
    localStorage.setItem("lastScore", currentScore);
}

// --- Init ---
console.log("BrainCheck initialized.");
initTutorial();
// Update theme display on load
const startTheme = getTodayTheme();
if (ui.themeDisplay) ui.themeDisplay.textContent = `今日のテーマ：${startTheme.label}`;
