/**
 * 設定・定数
 */
const FPS = 60;
const VIDEO_PATH_BASE = './videos/'; // 動画ファイルのベースパス

/**
 * 1. シーンデータ定義
 * ここに訓練内容を記述していく
 */
const SCENARIO_DATA = [
    {
        type: 'midGuard',
        params: {
            successVideo: '2xko-warwick-mid-wakeup-front-fail.mp4',
            failVideo: '2xko-warwick-mid-wakeup-front-fail.mp4', // 失敗動画（最初に再生される）
            judgeStartF: 20, // 発生20F
            judgeEndF: 25    // インパクト瞬間
        }
    },
    {
        type: 'lowGuard',
        params: {
            initialVideo: '2xko-warwick-mid-wakeup-front-fail.mp4' // 成功時はそのまま再生終了、失敗時は即カットなど
        }
    },
    {
        type: 'okiMove', // 移動起き攻め（投げ抜け）
        params: {
            successVideo: '2xko-warwick-mid-wakeup-front-fail.mp4',
            failVideo: '2xko-warwick-mid-wakeup-front-fail.mp4',
            judgeStartF: 30,
            judgeEndF: 40
        }
    },
    {
        type: 'okiStay', // その場起き（打撃暴れ）
        params: {
            successVideo: '2xko-warwick-mid-wakeup-front-fail.mp4',
            failVideo: '2xko-warwick-mid-wakeup-front-fail.mp4',
            judgeStartF: 30,
            judgeEndF: 40
        }
    }
];

/**
 * グローバル状態管理
 */
const videoEl = document.getElementById('mainVideo');
const feedbackEl = document.getElementById('feedback');
let currentSceneIndex = 0;
let activeAbortController = null; // 現在のシーンのイベント解除用
let isProcessing = false; // 多重判定防止フラグ

/**
 * UI要素の参照（DOMキャッシュ）
 */
const uiElements = {
    startScreen: document.getElementById('startScreen'),
    guardUI: document.getElementById('guardUI'),
    okiUI: document.getElementById('okiUI'),
    stickArea: document.getElementById('stickArea'),
    guardBtn: document.getElementById('guardBtn'),
    attackBtn: document.getElementById('attackBtn'),
    throwBtn: document.getElementById('throwBtn')
};

// 全UIを非表示にするヘルパー
function hideAllUI() {
    Object.values(uiElements).forEach(el => {
        if (el.classList.contains('ui-group')) el.classList.add('hidden');
    });
    feedbackEl.classList.add('hidden');
}

/**
 * 動画制御共通関数
 */
function playVideo(filename, loop = false) {
    if (!filename) return;
    // DOM再生成せずsrcのみ書き換え
    videoEl.src = VIDEO_PATH_BASE + filename;
    videoEl.loop = loop;
    videoEl.currentTime = 0;
    // iPhoneでの再生にはユーザーアクションが必要だが、
    // アプリ開始時のStartボタンクリックで権限を得ている想定
    videoEl.play().catch(e => console.error('Video Play Error:', e));
}

function getCurrentFrame() {
    return Math.floor(videoEl.currentTime * FPS);
}

/**
 * 成功・失敗・遷移の共通処理
 */
async function handleSuccess(nextVideoPath, signal) {
    if (isProcessing || signal.aborted) return;
    isProcessing = true;

    // イベントリスナーを即座に解除
    activeAbortController.abort();

    showFeedback("SUCCESS!");

    if (nextVideoPath) {
        // 成功動画へ即切り替え
        playVideo(nextVideoPath);
        // 動画終了を待って次へ
        videoEl.onended = () => {
            videoEl.onended = null;
            nextScene();
        };
    } else {
        // 動画切り替えがない場合は現在動画の終了を待つ
        videoEl.onended = () => {
            videoEl.onended = null;
            nextScene();
        };
    }
}

async function handleFail(nextVideoPath, signal) {
    if (isProcessing || signal.aborted) return;
    isProcessing = true;

    // イベント解除
    activeAbortController.abort();

    showFeedback("FAIL...");

    if (nextVideoPath) {
        // 別の失敗演出がある場合
        playVideo(nextVideoPath);
    }
    
    // 失敗動画（または現在の動画）が最後まで再生されたら次へ
    videoEl.onended = () => {
        videoEl.onended = null;
        nextScene();
    };
}

function showFeedback(text) {
    feedbackEl.textContent = text;
    feedbackEl.style.color = text === "SUCCESS!" ? "#0f0" : "#f00";
    feedbackEl.classList.remove('hidden');
}

function nextScene() {
    currentSceneIndex = (currentSceneIndex + 1) % SCENARIO_DATA.length;
    runScene(currentSceneIndex);
}

/**
 * 2. シーン初期化関数群 (initファクトリ)
 */

// 共通: フレーム監視ループを作るヘルパー
function startFrameLoop(callback, signal) {
    const loop = () => {
        if (signal.aborted) return;
        callback(getCurrentFrame());
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

// シーン1: 中下段ガード（中段）
function initMidGuard({ successVideo, failVideo, judgeStartF, judgeEndF }, signal) {
    uiElements.guardUI.classList.remove('hidden');
    playVideo(failVideo);

    let startY = 0;
    const touchZone = uiElements.stickArea;

    // タッチ開始位置記録
    touchZone.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    }, { signal, passive: true });

    // フレーム監視
    startFrameLoop((f) => {
        // 判定時間外に操作したら失敗？（今回はシンプルに時間内判定のみ実装）
        // 厳密には「ガード方向に入れっぱなし」判定も必要だが、ここでは「フリック反応」を見る
    }, signal);

    // タッチ移動（フリック判定）
    touchZone.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        const diffY = currentY - startY;
        const currentF = getCurrentFrame();

        // 上方向フリック (閾値 -30px)
        if (diffY < -30) {
            if (currentF >= judgeStartF && currentF <= judgeEndF) {
                handleSuccess(successVideo, signal);
            } else if (currentF < judgeStartF) {
                // 早すぎた場合
                handleFail(null, signal);
            }
        }
    }, { signal, passive: true });

    // 判定終了時間を過ぎたら失敗確定
    startFrameLoop((f) => {
        if (f > judgeEndF && !isProcessing) {
            handleFail(null, signal);
        }
    }, signal);
}

// シーン2: 中下段ガード（下段） - 押しっぱなし判定
function initLowGuard({ initialVideo }, signal) {
    uiElements.guardUI.classList.remove('hidden');
    // このシーンは「成功動画」への切り替えはなく、
    // 攻撃動画(initialVideo)をガードしきったら(最後まで再生されたら)成功とする
    playVideo(initialVideo);

    const guardBtn = uiElements.guardBtn;
    let isHolding = false;
    let hasFailed = false;

    guardBtn.addEventListener('touchstart', () => { isHolding = true; }, { signal, passive: true });
    guardBtn.addEventListener('touchend', () => { isHolding = false; }, { signal, passive: true });

    // 監視ループ
    startFrameLoop((f) => {
        if (hasFailed) return;

        // 動画再生中（例えば5F以降）にボタンを離していたら失敗
        if (f > 5 && !videoEl.paused && !videoEl.ended) {
            if (!isHolding) {
                hasFailed = true;
                handleFail(null, signal); // 失敗扱い、動画はそのまま流すか停止するか
            }
        }
    }, signal);

    // 動画終了イベントをリッスン（最後まで耐えたら成功）
    videoEl.onended = () => {
        if (!hasFailed) {
            handleSuccess(null, signal); // 次のシーンへ
        }
    };
}

// シーン3: 起き攻め（移動起き - 投げ抜け）
function initOkiMove({ successVideo, failVideo, judgeStartF, judgeEndF }, signal) {
    uiElements.okiUI.classList.remove('hidden');
    playVideo(failVideo);

    // 投げボタン
    uiElements.throwBtn.addEventListener('touchstart', () => {
        const f = getCurrentFrame();
        if (f >= judgeStartF && f <= judgeEndF) {
            handleSuccess(successVideo, signal);
        } else {
            handleFail(null, signal);
        }
    }, { signal, passive: true });

    // 攻撃ボタン（即失敗）
    uiElements.attackBtn.addEventListener('touchstart', () => {
        handleFail(null, signal);
    }, { signal, passive: true });

    // 時間切れ監視
    startFrameLoop((f) => {
        if (f > judgeEndF && !isProcessing) {
            handleFail(null, signal);
        }
    }, signal);
}

// シーン4: 起き攻め（その場起き - 暴れ）
function initOkiStay({ successVideo, failVideo, judgeStartF, judgeEndF }, signal) {
    uiElements.okiUI.classList.remove('hidden');
    playVideo(failVideo);

    // 攻撃ボタン（正解）
    uiElements.attackBtn.addEventListener('touchstart', () => {
        const f = getCurrentFrame();
        if (f >= judgeStartF && f <= judgeEndF) {
            handleSuccess(successVideo, signal);
        } else {
            handleFail(null, signal);
        }
    }, { signal, passive: true });

    // 投げボタン（即失敗）
    uiElements.throwBtn.addEventListener('touchstart', () => {
        handleFail(null, signal);
    }, { signal, passive: true });

    // 時間切れ監視
    startFrameLoop((f) => {
        if (f > judgeEndF && !isProcessing) {
            handleFail(null, signal);
        }
    }, signal);
}

/**
 * シーン実行管理
 */
const SCENE_HANDLERS = {
    'midGuard': initMidGuard,
    'lowGuard': initLowGuard,
    'okiMove': initOkiMove,
    'okiStay': initOkiStay
};

function runScene(index) {
    // 前のシーンのイベントリスナーを全て破棄
    if (activeAbortController) {
        activeAbortController.abort();
    }
    // 新しいコントローラー生成
    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;

    isProcessing = false;
    hideAllUI();

    const sceneData = SCENARIO_DATA[index];
    const handler = SCENE_HANDLERS[sceneData.type];

    if (handler) {
        console.log(`Starting Scene: ${sceneData.type}`);
        // 分割代入でparamsを渡す
        handler(sceneData.params, signal);
    } else {
        console.error('Unknown scene type:', sceneData.type);
    }
}

/**
 * アプリ起動
 */
document.getElementById('startBtn').addEventListener('click', () => {
    // 最初のユーザー操作で動画再生権限を確保
    videoEl.play().then(() => {
        videoEl.pause();
        videoEl.currentTime = 0;
        document.getElementById('startScreen').classList.add('hidden');
        runScene(0);
    }).catch(e => alert('動画再生エラー: ' + e));
});
