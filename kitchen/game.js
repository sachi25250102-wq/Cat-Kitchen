/* 小满食堂 —— 前端主控。
   负责：菜单与弹层、键盘/鼠标/触屏输入、帧循环、失焦暂停、结算与升级界面、音效触发。
   游戏规则全部在 engine.js / session.js 里：这里只读 game.state，所有变化都走 session 和 game 的方法。 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  if (!window.KitchenMenu || !window.KitchenEngine || !window.KitchenSession || !window.KitchenStage) {
    const fatal = document.createElement('p');
    fatal.className = 'fatal';
    fatal.textContent = '游戏文件没有加载完整。请解压完整的游戏文件夹，再打开 index.html。';
    document.body.appendChild(fatal);
    return;
  }

  const session = window.KitchenSession.createSession();
  const game = session.game;
  const state = game.state; // 只读；引用稳定，内部数组和对象可能被替换，所以每次都重新读取
  const menu = window.KitchenMenu;
  const RECIPES = {};
  menu.RECIPES.forEach((recipe) => { RECIPES[recipe.id] = recipe; });
  const UPGRADE_KEYS = Object.keys(window.KitchenSession.UPGRADE_DEFS);
  const sfx = window.KitchenSfx || { unlock() {}, setEnabled() {}, play() {}, setSizzle() {} };
  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const stage = window.KitchenStage.create($('stageCanvas'), { calm: Boolean(motionQuery && motionQuery.matches) });
  const sharedRankUrl = getSharedRankUrl();
  const sharedIds = new Map();
  const confirmedRanks = new Map();
  const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
  const NICKNAME_KEY = 'xiaoman-kitchen:shared-nickname';

  const el = {
    game: $('game'), play: $('play'), stage: $('stage'), title: $('titleScreen'),
    titleTags: $('titleTags'), ledger: $('ledger'),
    hudDay: $('hudDay'), hudTime: $('hudTime'), hudTimeWrap: $('hudTimeWrap'), hudTimeUnit: $('hudTimeUnit'),
    hudCoins: $('hudCoins'), hudScore: $('hudScore'), hudCombo: $('hudCombo'), hudComboWrap: $('hudComboWrap'),
    btnPause: $('btnPause'), btnHelpHud: $('btnHelpHud'), btnSoundHud: $('btnSoundHud'), soundHudIcon: $('soundHudIcon'),
    cueChop: $('cueChop'), cueHeat: $('cueHeat'), heatNeedle: $('heatNeedle'),
    pestBtn: $('pestBtn'), pestFill: $('pestFill'), floats: $('floats'), banner: $('banner'), bannerText: $('bannerText'),
    tickets: $('tickets'), feedback: $('feedback'), pad: $('pad'), actionLabel: $('actionLabel'), activeRecipe: $('activeRecipe'),
    titleArt: $('titleArt'), btnStart: $('btnStart'), startText: $('startText'), startNote: $('startNote'),
    btnPractice: $('btnPractice'), btnHelp: $('btnHelp'), btnSound: $('btnSound'), soundNote: $('soundNote'), btnReset: $('btnReset'),
    recScore: $('recScore'), recCombo: $('recCombo'), recServed: $('recServed'), recWallet: $('recWallet'), storageNote: $('storageNote'),
    veil: $('veil'), pauseSheet: $('pauseSheet'), helpSheet: $('helpSheet'), billSheet: $('billSheet'), confirmSheet: $('confirmSheet'),
    pauseNote: $('pauseNote'), btnResume: $('btnResume'), resumeText: $('resumeText'), btnRestartShift: $('btnRestartShift'),
    restartNote: $('restartNote'), btnHelpPause: $('btnHelpPause'), btnSoundPause: $('btnSoundPause'), soundNotePause: $('soundNotePause'),
    btnLeave: $('btnLeave'), leaveText: $('leaveText'), leaveNote: $('leaveNote'), btnHelpClose: $('btnHelpClose'),
    tallyServed: $('tallyServed'), tallyStars: $('tallyStars'), tallyNext: $('tallyNext'),
    billTitle: $('billTitle'), billStars: $('billStars'), billHint: $('billHint'), billLines: $('billLines'),
    billIncome: $('billIncome'), billWallet: $('billWallet'), shop: $('shop'), shopList: $('shopList'),
    finale: $('finale'), finaleLines: $('finaleLines'), billStorageNote: $('billStorageNote'),
    btnNextDay: $('btnNextDay'), btnBillRestart: $('btnBillRestart'), btnBillTitle: $('btnBillTitle'),
    confirmText: $('confirmText'), btnConfirmOk: $('btnConfirmOk'), btnConfirmCancel: $('btnConfirmCancel'),
    cueServe: $('cueServe'), dualPots: $('dualPots'), btnAction: $('btnAction'),
    riceBoard: $('riceBoard'), riceCount: $('riceCount'), riceRefill: $('riceRefill'),
    feedPest: $('feedPest'), helperNote: $('helperNote'),
    workbench: $('workbench'), comboPanel: $('comboPanel'), comboDishes: $('comboDishes'), comboHint: $('comboHint'),
    tastePanel: $('tastePanel'), tasteRequest: $('tasteRequest'), tasteIngredient: $('tasteIngredient'),
    tasteMethod: $('tasteMethod'), confirmTaste: $('confirmTaste'), openRecipeBook: $('openRecipeBook'),
    bentoPanel: $('bentoPanel'), bentoGrid: $('bentoGrid'), bentoPieces: $('bentoPieces'), bentoHint: $('bentoHint'),
    rotateBento: $('rotateBento'), removeBento: $('removeBento'), clearBento: $('clearBento'), serveBento: $('serveBento'),
    practiceSheet: $('practiceSheet'), btnPracticeDays: $('btnPracticeDays'), practiceOptions: $('practiceOptions'),
    btnPracticeClose: $('btnPracticeClose'), recipeSheet: $('recipeSheet'), recipeList: $('recipeList'),
    helpRecipeBook: $('helpRecipeBook'), btnRecipeClose: $('btnRecipeClose'),
    btnLeaderboard: $('btnLeaderboard'), btnBillLeaderboard: $('btnBillLeaderboard'),
    leaderboardSheet: $('leaderboardSheet'), rankDaily: $('rankDaily'), rankCampaign: $('rankCampaign'),
    rankRows: $('rankRows'), rankTable: $('rankTable'), rankEmpty: $('rankEmpty'), btnLeaderboardClose: $('btnLeaderboardClose'),
    leaderboardTitle: $('leaderboardTitle'), rankScope: $('rankScope'), rankLocal: $('rankLocal'), rankShared: $('rankShared'),
    rankStatus: $('rankStatus'), rankRetry: $('rankRetry'), rankSubmitForm: $('rankSubmitForm'),
    rankNickname: $('rankNickname'), btnSubmitScore: $('btnSubmitScore'), rankSubmitStatus: $('rankSubmitStatus'),
    billDailyRank: $('billDailyRank'), billCampaignRank: $('billCampaignRank'), billCampaignResult: $('billCampaignResult'),
    toast: $('toast')
  };

  const SHEETS = { pause: el.pauseSheet, help: el.helpSheet, bill: el.billSheet, confirm: el.confirmSheet,
    practice: el.practiceSheet, recipes: el.recipeSheet, leaderboard: el.leaderboardSheet };
  const CN_DIGIT = ['零', '一', '二', '三', '四', '五'];
  const PAUSE_NOTE = '营业时间、火候和订单都停住了。';
  const AWAY_NOTE = '窗口切走了，已自动暂停。准备好了再继续。';

  // session 返回的 reason → 给玩家看的话
  const REASONS = {
    'busy': '营业还在进行。先暂停，再选择重新开始或回到菜单。',
    'unsettled-shift': '刚结束的营业还没结算，先看结算。',
    'campaign-complete': '五天营业已经全部完成，可以重新开始五天。',
    'invalid-day': '请选择第 1 到第 5 天。',
    'settlement-pending': '上一天的结算还没处理，先看结算。',
    'not-finished': '营业还没结束，现在不能结算。',
    'practice': '练习模式不记收入。',
    'unknown-upgrade': '没有这项升级。',
    'not-in-settlement': '打烊结算时才能添置升级。',
    'max-level': '这项升级已经满级。',
    'insufficient-coins': '金币不够，再营业一天攒一攒。',
    'invalid-sound': '声音设置没有保存成功。'
  };

  // 飘字位置：舞台宽高的百分比，对应 stage.js 里的摆位
  const SPOT = {
    board: [20.8, 61], pan: [65, 58], tray: [82, 63], pest: [38.7, 64], chef: [55, 26], orders: [88, 30]
  };

  const CODE_TOKENS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'action', KeyF: 'shoo', Escape: 'pause', KeyP: 'pause', KeyH: 'help', KeyM: 'sound',
    KeyQ: 'pot0', KeyE: 'pot1', KeyG: 'feed', KeyR: 'rotate',
    Digit1: 'order0', Numpad1: 'order0', Digit2: 'order1', Numpad2: 'order1', Digit3: 'order2', Numpad3: 'order2'
  };
  // 没有 code 的按键事件（部分虚拟键盘、脚本派发）按 key 兜底
  const KEY_TOKENS = {
    ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
    ' ': 'action', Spacebar: 'action', f: 'shoo', Escape: 'pause', Esc: 'pause', p: 'pause', h: 'help', '?': 'help', m: 'sound',
    '1': 'order0', '2': 'order1', '3': 'order2', q: 'pot0', e: 'pot1', g: 'feed', r: 'rotate'
  };
  const DIRECTIONS = { up: true, down: true, left: true, right: true };

  const ui = {
    screen: 'title',     // title | play
    sheets: [],          // 弹层栈，最后一个显示在最上面
    last: performance.now(),
    resumeAfterHelp: false,
    ending: false,
    confirm: null,
    billSummary: null,
    rankSummary: null,
    rankScope: 'local',
    rankKind: 'daily',
    rankRequest: 0,
    rankPosting: false,
    rankPostError: '',
    lowTick: -1,
    shown: {},
    titleLayout: null,
    billTimer: 0,
    toastTimer: 0,
    bannerTimer: 0,
    workOrder: null,
    bentoPiece: null,
    bentoRotation: 0
  };
  const ticketEls = new Map();
  let tiles = [];
  let prev = snapshot();

  /* ---------- 小工具 ---------- */

  function snapshot() {
    return { burned: state.stats.burned, missed: state.missed, pest: Boolean(state.pest),
      served: state.served, coins: state.coins, recipeId: selectedRecipeId() };
  }

  function setText(node, value, key) {
    if (ui.shown[key] === value) return;
    ui.shown[key] = value;
    node.textContent = value;
  }

  function setData(name, value) {
    if (el.game.dataset[name] !== value) el.game.dataset[name] = value;
  }

  function restartAnimation(node, className) {
    node.classList.remove(className);
    void node.offsetWidth; // 强制回流，让同一个动画可以重播
    node.classList.add(className);
  }

  function blurActive() {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') active.blur();
  }

  function selectedOrder() {
    return state.orders.find((ticket) => ticket.id === state.selectedId);
  }

  function selectedRecipeId() {
    return state.recipeId || selectedOrder()?.recipeId || null;
  }

  function availableRecipes() {
    return (state.availableRecipeIds || []).map((id) => RECIPES[id]);
  }

  function canServe(order) {
    if (!order || state.step !== 'ready') return false;
    if (order.kind === 'bento') return order.bento.complete;
    if (order.kind === 'combo') return order.dishes.every((dish) => dish.status === 'ready' && dish.warmth > 0);
    return true;
  }

  function toast(text) {
    el.toast.textContent = text;
    el.toast.hidden = false;
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2800);
  }

  function toastReason(reason) {
    toast(REASONS[reason] || '这一步没有成功，请再试一次。');
    sfx.play('deny');
  }

  function showBanner(text) {
    el.bannerText.textContent = text;
    restartAnimation(el.banner, 'is-on');
    clearTimeout(ui.bannerTimer);
    ui.bannerTimer = setTimeout(() => el.banner.classList.remove('is-on'), 1600);
  }

  function float(text, spot, tone) {
    const node = document.createElement('span');
    node.className = 'float';
    node.dataset.tone = tone || '';
    node.textContent = text;
    node.style.left = (spot[0] + (Math.random() - 0.5) * 3).toFixed(1) + '%';
    node.style.top = spot[1] + '%';
    el.floats.appendChild(node);
    node.addEventListener('animationend', () => node.remove());
    setTimeout(() => node.remove(), 1500);
    while (el.floats.childElementCount > 8) el.floats.firstElementChild.remove();
  }

  function flashKey(token) {
    const selector = DIRECTIONS[token] ? '[data-dir="' + token + '"]' : '[data-act="' + token + '"]';
    const key = el.pad.querySelector(selector);
    if (!key) return;
    key.classList.add('is-down');
    setTimeout(() => key.classList.remove('is-down'), 110);
  }

  /* ---------- 画面与弹层 ---------- */

  function applyInert() {
    const covered = ui.sheets.length > 0;
    el.play.inert = covered || ui.screen !== 'play';
    el.title.inert = covered || ui.screen !== 'title';
  }

  function setScreen(name) {
    ui.screen = name;
    el.game.dataset.screen = name;
    applyInert();
  }

  function topSheet() {
    return ui.sheets.length ? ui.sheets[ui.sheets.length - 1] : null;
  }

  function renderSheets(moveFocus) {
    const top = topSheet();
    Object.keys(SHEETS).forEach((name) => { SHEETS[name].hidden = name !== top; });
    el.veil.hidden = !top;
    applyInert();
    if (!top || moveFocus === false) return;
    // 日结单不默认聚焦任何按钮：打烊那一刻玩家多半还在连按空格，不能让它顺手点掉“开始下一天”。
    const sheet = SHEETS[top];
    (sheet.querySelector('[data-autofocus]:not([hidden])') || sheet).focus({ preventScroll: true });
    sheet.scrollTop = 0;
  }

  function pushSheet(name) {
    ui.sheets = ui.sheets.filter((item) => item !== name);
    ui.sheets.push(name);
    renderSheets();
  }

  function dropSheet(name, returnFocus) {
    ui.sheets = ui.sheets.filter((item) => item !== name);
    renderSheets(!returnFocus);
    if (returnFocus) returnFocus.focus({ preventScroll: true });
    else if (!ui.sheets.length && ui.screen === 'title') el.btnStart.focus({ preventScroll: true });
  }

  /* ---------- 标题画面 ---------- */

  function refreshSound(on) {
    [el.btnSound, el.btnSoundPause, el.btnSoundHud].forEach((button) => button.setAttribute('aria-pressed', String(on)));
    el.soundNote.textContent = on ? '已开启' : '已关闭';
    el.soundNotePause.textContent = on ? '已开启' : '已关闭';
    el.soundHudIcon.setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
    el.btnSoundHud.setAttribute('aria-label', on ? '声音，现在是开启' : '声音，现在是关闭');
  }

  function refreshTitle() {
    const profile = session.profile;
    if (profile.summary) {
      el.startText.textContent = '查看结算';
      el.startNote.textContent = profile.completed ? '五天圆满' : '第' + CN_DIGIT[profile.day] + '天';
    } else {
      el.startText.textContent = '开店营业';
      el.startNote.textContent = '第' + CN_DIGIT[profile.day] + '天';
    }
    const touched = profile.day > 1 || profile.wallet > 0 || Boolean(profile.summary) ||
      UPGRADE_KEYS.some((key) => profile.upgrades[key] > 0);
    el.btnReset.hidden = !touched;
    el.recScore.textContent = String(profile.bestScore);
    el.recCombo.textContent = String(profile.bestCombo);
    el.recServed.textContent = String(profile.totalServed);
    el.recWallet.textContent = String(profile.wallet);
    el.storageNote.hidden = session.storageAvailable;
    refreshSound(profile.sound);
    measure(); // 木札数量变了，猫厨师的站位跟着重算
  }

  function showTitle() {
    clearTimeout(ui.billTimer);
    ui.ending = false;
    ui.resumeAfterHelp = false;
    ui.sheets = [];
    setScreen('title');
    renderSheets(false);
    refreshTitle();
    sfx.setSizzle(0);
    el.btnStart.focus({ preventScroll: true });
  }

  // 招牌：把系统宋体画在小画布上再按阈值取点，放大后就是和厨房同一风格的像素字。
  function drawTitleArt() {
    const canvas = el.titleArt;
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) { canvas.hidden = true; return; }
    try {
      const w = canvas.width;
      const h = canvas.height;
      const scratch = document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      const pen = scratch.getContext('2d', { willReadFrequently: true });
      const family = getComputedStyle(document.documentElement).getPropertyValue('--font-title').trim() || 'serif';
      pen.font = '900 28px ' + family;
      pen.textAlign = 'center';
      pen.textBaseline = 'middle';
      pen.fillStyle = '#000';
      const chars = ['小', '满', '食', '堂'];
      const cell = (w - 4) / chars.length;
      chars.forEach((char, index) => pen.fillText(char, 2 + cell * (index + 0.5), h / 2 + 1));
      const source = pen.getImageData(0, 0, w, h).data;
      const mask = new Uint8Array(w * h);
      let lit = 0;
      for (let i = 0; i < mask.length; i++) {
        if (source[i * 4 + 3] > 96) { mask[i] = 1; lit += 1; }
      }
      if (lit < 60) { canvas.hidden = true; return; } // 没有可用的中文字体
      const image = ctx.createImageData(w, h);
      const put = (x, y, r, g, b) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const at = (y * w + x) * 4;
        image.data[at] = r; image.data[at + 1] = g; image.data[at + 2] = b; image.data[at + 3] = 255;
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) if (mask[y * w + x]) put(x + 1, y + 1, 152, 57, 45);
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) if (mask[y * w + x]) put(x, y, 255, 241, 210);
      }
      ctx.putImageData(image, 0, 0);
    } catch (_error) {
      canvas.hidden = true;
    }
  }

  /* ---------- 开店、练习、离开 ---------- */

  function begin(result) {
    if (result.ok) { enterPlay(); return true; }
    toastReason(result.reason);
    if (result.reason === 'settlement-pending') {
      const summary = session.profile.summary;
      if (summary) openBill(summary);
    } else if (result.reason === 'unsettled-shift') {
      const settled = session.settleDay();
      if (settled.ok) openBill(settled.summary);
    } else if (ui.screen === 'title') refreshTitle();
    return false;
  }

  function enterPlay() {
    clearTimeout(ui.billTimer);
    ui.ending = false;
    ui.resumeAfterHelp = false;
    ui.sheets = [];
    setScreen('play');
    renderSheets(false);
    blurActive();
    stage.emit('reset');
    ticketEls.forEach((ticket) => ticket.li.remove());
    ticketEls.clear();
    ui.shown = {};
    ui.lowTick = -1;
    ui.workOrder = null;
    el.play.scrollTop = 0;
    prev = snapshot();
    if (state.pest) stage.emit('pestIn', { kind: state.pest.kind });
    ui.last = performance.now();
    measure();
    renderDom();
    showBanner('第 ' + state.day + ' 天 ' + (state.practice ? '练习' : '开店'));
    sfx.play('dayStart');
  }

  function onStart() {
    const summary = session.profile.summary;
    if (summary) { openBill(summary); return; }
    begin(session.startDay());
  }

  function restartShift() {
    const practice = state.practice;
    const day = state.day;
    session.leave();
    begin(practice ? session.startPractice(day) : session.startDay());
  }

  function leaveShift() {
    session.leave();
    showTitle();
  }

  /* ---------- 暂停与帮助 ---------- */

  function setPauseTexts(note) {
    const practice = state.practice;
    el.pauseNote.textContent = note || PAUSE_NOTE;
    el.resumeText.textContent = practice ? '继续练习' : '继续营业';
    el.restartNote.textContent = practice ? '练习重来' : '今天重来';
    el.leaveText.textContent = practice ? '结束练习' : '回到菜单';
    el.leaveNote.textContent = practice ? '回到菜单' : '放弃今天';
  }

  // 暂停和恢复都重置帧时间戳，暂停期间不会攒下时间。
  function pauseGame() {
    if (ui.screen !== 'play' || state.phase !== 'playing') return false;
    advance(performance.now());
    if (state.phase !== 'playing') return false;
    game.pause();
    ui.last = performance.now();
    sfx.setSizzle(0);
    return true;
  }

  function openPause(note) {
    if (!pauseGame()) return;
    ui.resumeAfterHelp = false;
    setPauseTexts(note);
    ui.sheets = ['pause'];
    renderSheets();
  }

  function resumeGame() {
    if (state.phase !== 'paused') return;
    ui.sheets = [];
    renderSheets(false);
    blurActive();
    ui.last = performance.now();
    game.resume();
    prev = snapshot();
  }

  function openHelp() {
    if (topSheet() === 'help') return;
    if (pauseGame()) ui.resumeAfterHelp = true; // 打开前正在营业：关闭帮助后直接继续
    pushSheet('help');
  }

  function closeHelp() {
    const resume = ui.resumeAfterHelp && ui.sheets.length === 1 && state.phase === 'paused';
    ui.resumeAfterHelp = false;
    if (resume) { resumeGame(); return; }
    dropSheet('help');
  }

  function openRecipes() {
    if (pauseGame()) ui.resumeAfterHelp = true;
    const recipes = ui.screen === 'play' ? availableRecipes() : menu.RECIPES;
    el.recipeList.replaceChildren();
    recipes.forEach((recipe) => {
      const item = document.createElement('li');
      item.dataset.recipe = recipe.id;
      const icon = document.createElement('canvas');
      icon.width = icon.height = 64;
      icon.setAttribute('aria-hidden', 'true');
      if (window.KitchenArt) window.KitchenArt.drawDish(icon.getContext('2d'), recipe.id, 0, 0);
      const text = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = recipe.name;
      const detail = document.createElement('small');
      detail.textContent = [recipe.ingredient, recipe.method, ...recipe.tags, ...(recipe.usesRice ? ['需米饭'] : [])].join(' · ');
      text.append(name, detail);
      item.append(icon, text);
      el.recipeList.appendChild(item);
    });
    pushSheet('recipes');
  }

  function closeRecipes() {
    if (ui.resumeAfterHelp && ui.sheets.length === 1 && state.phase === 'paused') {
      ui.resumeAfterHelp = false;
      resumeGame();
    } else dropSheet('recipes');
  }

  // 失焦或切出页面：营业中就暂停，回来后由玩家自己点继续。
  function onAway() {
    if (ui.screen !== 'play') return;
    if (state.phase === 'playing') {
      openPause(AWAY_NOTE);
    } else if (state.phase === 'paused' && ui.resumeAfterHelp) {
      ui.resumeAfterHelp = false;
      setPauseTexts(AWAY_NOTE);
      ui.sheets = ['pause', ...ui.sheets];
      renderSheets(false);
    }
  }

  function askConfirm(text, okLabel, action) {
    ui.confirm = action;
    el.confirmText.textContent = text;
    el.btnConfirmOk.textContent = okLabel;
    pushSheet('confirm');
  }

  function answerConfirm(accepted) {
    const action = ui.confirm;
    ui.confirm = null;
    dropSheet('confirm');
    if (accepted && action) action();
  }

  function dismissTop() {
    const top = topSheet();
    if (top === 'pause') resumeGame();
    else if (top === 'help') closeHelp();
    else if (top === 'recipes') closeRecipes();
    else if (top === 'practice') dropSheet('practice');
    else if (top === 'leaderboard') closeLeaderboard();
    else if (top === 'confirm') answerConfirm(false);
  }

  function toggleSound() {
    const next = !session.profile.sound;
    const result = session.setSound(next);
    if (!result.ok) { toastReason(result.reason); return; }
    sfx.setEnabled(next);
    refreshSound(next);
    if (next) sfx.play('click');
    el.storageNote.hidden = session.storageAvailable;
    if (ui.screen === 'play' && !ui.sheets.length) blurActive(); // 焦点不留在 HUD 按钮上，回车不会误触
  }

  /* ---------- 结算与升级 ---------- */

  function fillLines(list, rows) {
    list.textContent = '';
    rows.forEach((row) => {
      const line = document.createElement('div');
      const label = document.createElement('dt');
      const value = document.createElement('dd');
      label.textContent = row[0];
      value.textContent = row[1];
      line.append(label, value);
      list.appendChild(line);
    });
  }

  function renderShop(wallet) {
    el.shopList.textContent = '';
    UPGRADE_KEYS.forEach((key) => {
      const offer = session.getUpgradeOffer(key);
      if (!offer) return;
      const item = document.createElement('li');
      item.className = 'shop-item';

      const info = document.createElement('div');
      info.className = 'shop-info';
      const name = document.createElement('h4');
      name.textContent = offer.name;
      const pips = document.createElement('span');
      pips.className = 'pips';
      pips.setAttribute('role', 'img');
      pips.setAttribute('aria-label', '等级 ' + offer.level + '，最高 3');
      for (let i = 0; i < 3; i++) {
        const pip = document.createElement('i');
        if (i < offer.level) pip.className = 'is-on';
        pips.appendChild(pip);
      }
      name.appendChild(pips);
      const description = document.createElement('p');
      description.textContent = offer.description + (offer.maxed ? '' : ' 下一级 ' + offer.nextCost + ' 金币。');
      info.append(name, description);

      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'btn btn-buy';
      buy.dataset.key = key;
      buy.disabled = !offer.canBuy;
      if (offer.maxed) buy.textContent = '已满级';
      else if (offer.canBuy) buy.textContent = '购买 ' + offer.nextCost + ' 金币';
      else buy.textContent = '还差 ' + Math.max(0, offer.nextCost - wallet) + ' 金币';
      buy.setAttribute('aria-label', offer.name + '：' + buy.textContent);

      item.append(info, buy);
      el.shopList.appendChild(item);
    });
  }

  function entryForSummary(kind, summary) {
    const id = kind === 'campaign' ? summary?.campaignEntryId : summary?.dailyEntryId;
    return session.getLeaderboard(kind).find((row) => row.id === id);
  }

  function pointsLabel(points) {
    return points.toLocaleString('zh-CN') + ' 分';
  }

  function scoreAndRank(entry, fallback) {
    return entry ? pointsLabel(entry.score) + ' · 第 ' + entry.rank + ' 名' : pointsLabel(fallback) + ' · 暂无排名';
  }

  function renderBill() {
    const summary = ui.billSummary;
    const profile = session.profile;
    const done = profile.completed;

    el.billTitle.textContent = done ? '五天营业圆满结束' : '第 ' + summary.day + ' 天打烊';
    el.billStars.textContent = '';
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      star.textContent = '★';
      if (i < summary.stars) star.className = 'is-on';
      el.billStars.appendChild(star);
    }
    el.billStars.setAttribute('aria-label', '今日评价 ' + summary.stars + ' 星，满分 3 星');
    el.billHint.textContent = summary.stars >= 3 ? '出餐满 10 道，三星到手。'
      : summary.served >= 5 ? '出餐满 10 道就是三星，今天还差 ' + (10 - summary.served) + ' 道。'
        : '出餐满 5 道两星，满 10 道三星。';

    const daily = entryForSummary('daily', summary);
    const campaign = done ? entryForSummary('campaign', summary) : null;
    el.billDailyRank.textContent = scoreAndRank(daily, summary.score);
    el.billCampaignResult.hidden = !campaign;
    el.billCampaignRank.textContent = campaign ? scoreAndRank(campaign) : '';

    fillLines(el.billLines, [
      ['出餐', summary.served + ' 道'],
      ['客人离开', summary.missed + ' 位'],
      ['最高连击', String(summary.bestCombo)],
      ['完美火候', summary.stats.perfect + ' 次'],
      ['糊锅', summary.stats.burned + ' 次'],
      ['赶走小馋鬼', summary.stats.pests + ' 次']
    ]);
    el.billIncome.textContent = '+' + summary.coins + ' 金币';
    el.billWallet.textContent = profile.wallet + ' 金币';

    el.shop.hidden = done;
    el.finale.hidden = !done;
    if (done) {
      fillLines(el.finaleLines, [
        ['历史最高分', String(profile.bestScore)],
        ['历史最高连击', String(profile.bestCombo)],
        ['累计出餐', profile.totalServed + ' 道'],
        ['剩余金币', String(profile.wallet)]
      ]);
    } else renderShop(profile.wallet);

    el.btnNextDay.hidden = done;
    el.btnNextDay.textContent = '开始第 ' + (summary.day + 1) + ' 天';
    el.btnBillRestart.hidden = !done;
    el.btnBillRestart.classList.toggle('btn-main', done);
    el.billStorageNote.hidden = session.storageAvailable;
  }

  function openBill(summary) {
    clearTimeout(ui.billTimer);
    ui.billSummary = summary;
    renderBill();
    ui.sheets = ['bill'];
    renderSheets();
  }

  /* ---------- 本机与共享排行榜 ---------- */

  function getSharedRankUrl() {
    const config = document.querySelector('meta[name="xiaoman-shared-leaderboard"]');
    if (!config?.content || !/^https?:$/.test(window.location.protocol)) return null;
    try {
      const url = new URL(config.content, window.location.href);
      return url.origin === window.location.origin ? url.href : null;
    } catch { return null; }
  }

  function readRankPreference(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function saveRankPreference(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* 存储关闭时保留本页内的成绩 ID */ }
  }

  function makeRankId() {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  }

  function sharedId(kind, localId, create = false) {
    if (localId == null) return null;
    const saved = session.getLeaderboardSubmissionId?.(kind, localId);
    if (UUID_PATTERN.test(saved || '')) return saved;
    const key = 'xiaoman-kitchen:shared-id:' + kind + ':' + localId;
    if (sharedIds.has(key)) return sharedIds.get(key);
    let id = readRankPreference(key);
    if (!UUID_PATTERN.test(id || '')) {
      if (!create) return null;
      id = makeRankId();
      saveRankPreference(key, id);
    }
    sharedIds.set(key, id);
    return id;
  }

  function rankEntryId(kind) {
    return kind === 'campaign' ? ui.rankSummary?.campaignEntryId : ui.rankSummary?.dailyEntryId;
  }

  function renderRankRows(rows, kind, currentId, extra = null) {
    const campaign = kind === 'campaign';
    const shared = ui.rankScope === 'shared';
    const visible = rows.slice(0, 10);
    const current = visible.find((row) => row.id === currentId) || rows.find((row) => row.id === currentId) || extra;
    if (current && !visible.some((row) => row.id === current.id)) visible.push(current);
    el.rankRows.replaceChildren();
    el.rankTable.hidden = !visible.length;
    el.rankTable.setAttribute('aria-label', campaign ? '五天总分排行' : '单日得分排行');
    el.rankTable.tHead.rows[0].cells[1].textContent = shared ? '玩家' : '营业场次';
    el.rankEmpty.hidden = Boolean(visible.length);
    if (shared) {
      el.rankEmpty.textContent = campaign ? '还没有共享五天总分。完成五天营业后可以提交。' : '还没有共享单日成绩。打烊后可以提交。';
    } else {
      el.rankEmpty.textContent = campaign ? '还没有五天总分记录。完成一次五天营业就会上榜。'
        : '还没有单日记录。完成一天营业就会上榜。';
    }

    visible.forEach((row) => {
      const tr = el.rankRows.insertRow();
      tr.dataset.entryId = String(row.id);
      tr.dataset.rank = String(row.rank);
      tr.insertCell().textContent = '第 ' + row.rank + ' 名';
      const attempt = tr.insertCell();
      const shift = campaign ? '五天营业' : '第 ' + row.day + ' 天';
      if (shared) {
        const nickname = document.createElement('strong');
        nickname.textContent = row.nickname;
        const day = document.createElement('small');
        day.textContent = shift;
        attempt.append(nickname, day);
      } else attempt.textContent = shift + ' · #' + row.id;
      if (row === current) {
        tr.setAttribute('aria-current', 'true');
        const marker = document.createElement('span');
        marker.className = 'rank-current';
        marker.textContent = '本局';
        if (shared) attempt.lastElementChild.appendChild(marker);
        else attempt.appendChild(marker);
      }
      tr.insertCell().textContent = pointsLabel(row.score);
    });
  }

  async function requestRank(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      let response;
      try { response = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal }); }
      catch { throw new Error('连不上共享排行榜，请稍后重试。'); }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(typeof data?.error === 'string' ? data.error : '共享排行榜暂时不可用，请稍后重试。');
      }
      return data;
    } finally { clearTimeout(timer); }
  }

  function validSharedRow(row, kind) {
    return Boolean(row && typeof row.id === 'string' && UUID_PATTERN.test(row.id) && row.kind === kind &&
      Number.isInteger(row.day) && Number.isInteger(row.score) && Number.isInteger(row.served) &&
      Number.isInteger(row.rank) && row.rank > 0 && typeof row.nickname === 'string');
  }

  function setRankStatus(message, retry = false) {
    el.rankStatus.textContent = message;
    el.rankStatus.hidden = !message;
    el.rankRetry.hidden = !retry;
  }

  function presentRankKinds() {
    return ['daily', 'campaign'].filter((kind) => rankEntryId(kind) != null);
  }

  function renderSubmitState() {
    const kinds = presentRankKinds();
    el.rankSubmitForm.hidden = ui.rankScope !== 'shared' || !kinds.length;
    if (el.rankSubmitForm.hidden) return;
    const confirmed = kinds.map((kind) => confirmedRanks.get(sharedId(kind, rankEntryId(kind)))).filter(Boolean);
    // The service accepts a five-day result only together with its final daily result.
    const complete = confirmed.length === kinds.length || confirmed.some((row) => row.kind === 'campaign');
    const success = confirmed.length ? '已提交 · ' + confirmed.map((row) =>
      (row.kind === 'campaign' ? '五天总分' : '单日') + '第 ' + row.rank + ' 名').join(' · ') : '';
    const message = complete ? success : ui.rankPostError || success;
    el.rankSubmitStatus.textContent = message;
    el.rankSubmitStatus.hidden = !message;
    if (complete) el.rankNickname.value = confirmed[0].nickname;
    el.rankNickname.disabled = ui.rankPosting || complete;
    el.btnSubmitScore.disabled = ui.rankPosting || complete;
    el.btnSubmitScore.textContent = ui.rankPosting ? '提交中…' : complete ? '已提交' : '提交本局成绩';
  }

  async function loadSharedRank(kind, request) {
    const id = sharedId(kind, rankEntryId(kind));
    const url = new URL(sharedRankUrl);
    url.searchParams.set('kind', kind);
    if (id) url.searchParams.set('entryId', id);
    el.rankRows.replaceChildren();
    el.rankTable.hidden = true;
    el.rankEmpty.hidden = true;
    setRankStatus('正在加载共享排行榜…');
    try {
      const data = await requestRank(url);
      if (request !== ui.rankRequest) return;
      const current = data.current;
      if (!Array.isArray(data.rows) || !data.rows.every((row) => validSharedRow(row, kind)) ||
          (current != null && (current.id !== id || !validSharedRow(current, kind)))) {
        throw new Error('共享排行榜暂时不可用，请稍后重试。');
      }
      if (current) confirmedRanks.set(current.id, current);
      setRankStatus('');
      renderRankRows(data.rows, kind, id, current);
      renderSubmitState();
    } catch (error) {
      if (request === ui.rankRequest) setRankStatus(error.message, true);
    }
  }

  async function submitRank(event) {
    event.preventDefault();
    if (!sharedRankUrl || el.rankSubmitForm.hidden || ui.rankPosting || el.btnSubmitScore.disabled) return;
    const summary = ui.rankSummary;
    const nickname = el.rankNickname.value.trim().normalize('NFC');
    const length = Array.from(nickname).length;
    if (length < 1 || length > 16) {
      ui.rankPostError = '请输入 1–16 个字符的昵称。';
      renderSubmitState();
      el.rankNickname.focus();
      return;
    }
    ui.rankPosting = true;
    ui.rankPostError = '';
    renderSubmitState();
    let submitted = false;
    try {
      const entries = presentRankKinds().map((kind) => {
        const row = entryForSummary(kind, summary);
        return row && { id: sharedId(kind, row.id, true), kind, day: row.day, score: row.score, served: row.served };
      }).filter(Boolean);
      if (!entries.length) throw new Error('这张日结单没有可提交的成绩。');
      const data = await requestRank(sharedRankUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname, entries })
      });
      if (!Array.isArray(data.entries) || data.entries.length !== entries.length || !entries.every((expected) =>
        data.entries.some((row) => validSharedRow(row, expected.kind) && row.id === expected.id &&
          row.day === expected.day && row.score === expected.score && row.served === expected.served))) {
        throw new Error('暂时无法确认提交结果，请重试。');
      }
      data.entries.forEach((row) => confirmedRanks.set(row.id, row));
      saveRankPreference(NICKNAME_KEY, data.entries[0].nickname);
      if (ui.rankSummary === summary) el.rankNickname.value = data.entries[0].nickname;
      submitted = true;
    } catch (error) {
      if (ui.rankSummary === summary) ui.rankPostError = error.message;
    } finally {
      ui.rankPosting = false;
      renderSubmitState();
      if (submitted && topSheet() === 'leaderboard' && ui.rankScope === 'shared' && ui.rankSummary === summary) renderLeaderboard(ui.rankKind);
    }
  }

  function renderLeaderboard(kind, scope = ui.rankScope) {
    const campaign = kind === 'campaign';
    const shared = scope === 'shared' && Boolean(sharedRankUrl);
    ui.rankScope = shared ? 'shared' : 'local';
    ui.rankKind = kind;
    ui.rankRequest += 1;
    el.leaderboardTitle.textContent = shared ? '共享排行榜' : '本机排行榜';
    el.rankLocal.setAttribute('aria-pressed', String(!shared));
    el.rankShared.setAttribute('aria-pressed', String(shared));
    el.rankDaily.setAttribute('aria-pressed', String(!campaign));
    el.rankCampaign.setAttribute('aria-pressed', String(campaign));
    el.rankDaily.toggleAttribute('data-autofocus', !campaign);
    el.rankCampaign.toggleAttribute('data-autofocus', campaign);
    renderSubmitState();
    if (shared) loadSharedRank(kind, ui.rankRequest);
    else {
      setRankStatus('');
      renderRankRows(session.getLeaderboard(kind), kind, rankEntryId(kind));
    }
  }

  function openLeaderboard(fromBill) {
    ui.rankSummary = fromBill ? ui.billSummary : null;
    ui.rankPostError = '';
    if (fromBill && sharedRankUrl) el.rankNickname.value = readRankPreference(NICKNAME_KEY) || '';
    renderLeaderboard(ui.rankSummary?.campaignEntryId != null ? 'campaign' : 'daily', sharedRankUrl ? 'shared' : 'local');
    pushSheet('leaderboard');
  }

  function closeLeaderboard() {
    const opener = ui.rankSummary ? el.btnBillLeaderboard : el.btnLeaderboard;
    ui.rankSummary = null;
    ui.rankRequest += 1;
    dropSheet('leaderboard', opener);
  }

  function buyUpgrade(key) {
    const result = session.buyUpgrade(key);
    if (result.ok) {
      sfx.play('coin');
      toast(result.offer.name + '升到 ' + result.offer.level + ' 级。');
    } else toastReason(result.reason);
    renderBill();
    const again = el.shopList.querySelector('[data-key="' + key + '"]:not(:disabled)');
    (again || el.billSheet).focus({ preventScroll: true });
  }

  // 正式营业结束：先结算入账，再展示日结单。
  function endDay() {
    ui.ending = true;
    sfx.setSizzle(0);
    const result = session.settleDay();
    sfx.play('dayEnd');
    showBanner('打烊啦');
    ui.billTimer = setTimeout(() => {
      if (result.ok) { openBill(result.summary); return; }
      toastReason(result.reason);
      leaveShift();
    }, 1300);
  }

  /* ---------- 时钟 ---------- */

  // 单次推进最多 1 秒：页面被冻结或电脑休眠后回来，不会一口气吃掉整天的营业时间。
  function advance(now) {
    if (now <= ui.last) return;
    const seconds = Math.min(1, (now - ui.last) / 1000);
    ui.last = now;
    if (ui.screen !== 'play' || state.phase !== 'playing') return;
    game.tick(seconds);
    detect();
  }

  // 由时间推动的事件：糊锅、订单超时、小馋鬼出现或得手、打烊。
  // 每帧都对比一次真实状态，所以不管时间是谁推进的（包括联调时直接调 game.tick），界面都跟得上。
  function detect() {
    if (ui.screen !== 'play') return;
    if (state.stats.burned > prev.burned) {
      stage.emit('burn');
      sfx.play('burn');
      float('糊锅了', SPOT.pan, 'bad');
    }
    if (state.missed > prev.missed) {
      sfx.play('expire');
      float('客人走了', SPOT.orders, 'bad');
    }
    if (state.served > prev.served) showServed(prev.recipeId, state.coins - prev.coins, true);
    const pestNow = Boolean(state.pest);
    if (pestNow && !prev.pest) {
      stage.emit('pestIn', { kind: state.pest.kind });
      sfx.play('pestIn');
    } else if (!pestNow && prev.pest) {
      if (state.phase === 'playing') {
        stage.emit('pestSteal');
        sfx.play('steal');
        float('被偷吃了', SPOT.pest, 'bad');
      } else stage.emit('pestGone');
    }
    if (!state.practice && state.phase === 'playing' && state.timeLeft <= 10) {
      const second = Math.ceil(state.timeLeft);
      if (second !== ui.lowTick) { ui.lowTick = second; sfx.play('tick'); }
    }
    prev = snapshot();
    if (state.phase === 'summary' && !ui.ending) endDay();
  }

  /* ---------- 玩家操作：键盘、鼠标和触屏共用入口 ---------- */

  function ready() {
    if (ui.screen !== 'play' || ui.sheets.length || state.phase !== 'playing') return false;
    advance(performance.now()); // 把时间推到按键这一刻，火候判定更准
    return state.phase === 'playing';
  }

  function doSelect(id) {
    if (!ready()) return;
    const before = state.selectedId;
    game.selectOrder(id);
    if (state.selectedId !== before) sfx.play('select');
    else if (id !== before) sfx.play('deny');
    prev = snapshot();
    renderDom();
  }

  function doInput(direction) {
    if (!ready()) return;
    flashKey(direction);
    if (state.step !== 'chop') return;
    const before = state.progress;
    game.input(direction);
    if (state.step === 'cook' || state.step === 'waiting') {
      sfx.play('chop');
      if (state.step === 'cook') {
        stage.emit('toPan');
        sfx.play('toPan');
      }
    } else if (state.progress > before) {
      stage.emit('chop');
      sfx.play('chop');
    } else {
      stage.emit('wrong');
      sfx.play('wrong');
      restartAnimation(el.cueChop, 'is-wrong');
      float('切错了', SPOT.board, 'bad');
    }
    prev = snapshot();
    renderDom();
  }

  function doAction() {
    if (!ready()) return;
    flashKey('action');
    const step = state.step;
    const heat = state.heat;
    const coins = state.coins;
    const served = state.served;
    const order = selectedOrder();
    const recipeId = order?.kind === 'bento' && step === 'ready' ? 'bento' : selectedRecipeId();
    const dishIndex = state.selectedDish;
    game.action();
    if (step === 'cook') {
      const dish = order?.dishes?.[dishIndex];
      showPotResult(dish ? dish.status === 'ready' : state.step === 'ready', dish?.grade || state.grade, heat);
    }
    if (state.served > served) showServed(recipeId, state.coins - coins, step === 'cook');
    else if (step === 'waiting' && state.step === 'cook') {
      stage.emit('toPan');
      sfx.play('toPan');
    } else if (step !== 'cook' && step !== 'ready') sfx.play('deny');
    prev = snapshot();
    renderDom();
  }

  function showPotResult(success, grade, heat) {
    if (success) {
      const perfect = grade === 'perfect';
      stage.emit(perfect ? 'perfect' : 'good');
      sfx.play(perfect ? 'perfect' : 'good');
      float(perfect ? '完美火候' : '火候不错', SPOT.pan, perfect ? 'gold' : 'good');
    } else {
      stage.emit('miss');
      sfx.play('miss');
      restartAnimation(el.cueHeat, 'is-wrong');
      float(heat < 0.42 ? '还没熟' : '火大了', SPOT.pan, 'bad');
    }
  }

  function showServed(recipeId, coins, helper) {
    stage.emit('serve', { recipeId });
    sfx.play('serve');
    float((helper ? '麻雀送餐 · ' : '') + '+' + coins + ' 金币', SPOT.tray, 'gold');
    if (state.combo >= 2) float('连击 ×' + state.combo, SPOT.chef, 'good');
  }

  function doFinishPot(index) {
    if (!ready() || state.pots.length < 2) return;
    const pot = state.pots[index];
    if (!pot) return;
    const dish = state.orders.find((order) => order.id === pot.orderId)?.dishes[pot.dishIndex];
    const success = game.finishPot(index);
    showPotResult(success, dish?.grade, pot.heat);
    if (state.served > prev.served) showServed(pot.recipeId, state.coins - prev.coins, true);
    prev = snapshot();
    renderDom();
  }

  function doSelectDish(index) {
    if (!ready()) return;
    if (game.selectDish(index)) sfx.play('select');
    renderDom();
  }

  function doChooseTaste() {
    if (!ready() || !el.tasteIngredient.value || !el.tasteMethod.value) return;
    sfx.play(game.chooseTaste(el.tasteIngredient.value, el.tasteMethod.value) ? 'select' : 'deny');
    renderDom();
  }

  function doFeed() {
    if (!ready() || el.feedPest.hidden || el.feedPest.disabled) return;
    if (game.feedPest()) {
      stage.emit('pestGone');
      sfx.play('coin');
      float('麻雀来帮忙', SPOT.pest, 'good');
    } else sfx.play('deny');
    prev = snapshot();
    renderDom();
  }

  function doShoo() {
    if (!ready()) return;
    flashKey('shoo');
    if (!state.pest) return;
    game.shoo();
    if (!state.pest) {
      stage.emit('pestShoo');
      sfx.play('shoo');
      float('+2 金币', SPOT.pest, 'gold');
    }
    prev = snapshot();
    renderDom();
  }

  function runToken(token) {
    if (DIRECTIONS[token]) doInput(token);
    else if (token === 'action') doAction();
    else if (token === 'shoo') doShoo();
    else if (token === 'feed') doFeed();
    else if (token === 'rotate') rotatePiece();
    else if (token === 'pot0' || token === 'pot1') doFinishPot(Number(token.slice(3)));
    else if (token.indexOf('order') === 0) {
      const order = state.orders[Number(token.slice(5))]; // 1/2/3 先取当前第几张订单的真实 id
      if (order) doSelect(order.id);
    }
  }

  /* ---------- 键盘 ---------- */

  function keyToken(event) {
    if (event.code && CODE_TOKENS[event.code]) return CODE_TOKENS[event.code];
    const key = event.key || '';
    return KEY_TOKENS[key.length === 1 ? key.toLowerCase() : key] || null;
  }

  function onButton(target) {
    return Boolean(target && target.closest && target.closest('button, a, input, select, textarea'));
  }

  function nativeGameControl(target, token) {
    if (!target || !target.closest) return false;
    return Boolean(target.closest('select') && token !== 'pause' ||
      token === 'action' && !canServe(selectedOrder()) &&
      target.closest('.workbench button, .dual-pots button, .rice-board button'));
  }

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    sfx.unlock();
    const token = keyToken(event);
    const scrolls = DIRECTIONS[token] || token === 'action';

    if (ui.sheets.length) {
      if (token === 'pause' && (event.key === 'Escape' || event.key === 'Esc' || event.code === 'Escape')) {
        event.preventDefault();
        if (!event.repeat) dismissTop();
      }
      return;
    }

    if (ui.screen === 'title') {
      if (scrolls && !onButton(event.target)) event.preventDefault();
      if (event.repeat) return;
      if (token === 'help') openHelp();
      else if (token === 'sound') toggleSound();
      return;
    }

    if (nativeGameControl(event.target, token)) return;
    // 营业画面：方向键和空格不让页面滚动，长按产生的重复事件一律忽略。
    if (scrolls || token === 'pause') event.preventDefault();
    if (event.repeat || !token) return;
    if (token === 'pause') openPause();
    else if (token === 'help') openHelp();
    else if (token === 'sound') toggleSound();
    else runToken(token);
  }

  function onKeyUp(event) {
    // 空格松开时浏览器会“点击”当前聚焦的按钮；营业中空格只用来出锅和出餐。
    if (ui.screen === 'play' && !ui.sheets.length && keyToken(event) === 'action' &&
        !nativeGameControl(event.target, 'action')) event.preventDefault();
  }

  /* ---------- 鼠标与触屏 ---------- */

  // 按下即响应（不等松开）；键盘或读屏触发的 click（detail 为 0）也接住，同一次点按不会触发两回。
  function bindPress(node, handler) {
    node.addEventListener('pointerdown', (event) => {
      if (event.button > 0) return;
      sfx.unlock();
      handler(event);
    });
    node.addEventListener('click', (event) => {
      if (event.detail === 0) handler(event);
    });
  }

  function bindClick(node, handler) {
    node.addEventListener('click', () => {
      sfx.unlock();
      sfx.play('click');
      handler();
    });
  }

  /* ---------- 每帧把真实状态写到界面 ---------- */

  function makeTicket(order) {
    const li = document.createElement('li');
    li.className = 'ticket is-new';
    li.dataset.id = String(order.id);
    li.dataset.kind = order.kind || 'single';
    li.innerHTML =
      '<button type="button" class="ticket-btn">' +
        '<span class="ticket-head"><span class="ticket-key"></span><span class="ticket-name"></span></span>' +
        '<span class="ticket-price"></span>' +
        '<span class="ticket-seq" aria-hidden="true"></span>' +
        '<span class="ticket-detail" hidden></span>' +
        '<canvas class="ticket-dish" width="64" height="64" aria-hidden="true"></canvas>' +
        '<span class="ticket-wait"><span class="ticket-wait-bar"><span class="ticket-wait-fill"></span></span>' +
        '<span class="ticket-wait-text"></span></span>' +
        '<span class="ticket-stamp" aria-hidden="true">制作中</span>' +
      '</button>';
    return {
      li: li, button: li.querySelector('.ticket-btn'), key: li.querySelector('.ticket-key'),
      name: li.querySelector('.ticket-name'), price: li.querySelector('.ticket-price'), sequence: li.querySelector('.ticket-seq'),
      detail: li.querySelector('.ticket-detail'), canvas: li.querySelector('.ticket-dish'),
      fill: li.querySelector('.ticket-wait-fill'), text: li.querySelector('.ticket-wait-text'),
      index: -1, seconds: null, mood: '', selected: null
    };
  }

  function renderTicketLabel(ticket, order) {
    const recipe = RECIPES[order.recipeId];
    const combo = order.kind === 'combo';
    const taste = order.kind === 'taste';
    const bento = order.kind === 'bento';
    const dishes = order.dishes || [];
    const names = dishes.map((dish) => RECIPES[dish.recipeId]?.name).filter(Boolean);
    const title = combo ? '双拼订单' : taste ? '口味订单' : bento ? '便当订单' : recipe.name;
    const detail = combo ? names.join(' + ') : taste ? (recipe?.name || order.taste.text)
      : bento ? (order.bento.complete ? '已装好' : '主菜和配菜') : '';
    const labelKey = [title, detail, order.recipeId, ticket.index].join(':');
    if (ticket.labelKey === labelKey) return;
    ticket.labelKey = labelKey;
    ticket.name.textContent = title;
    ticket.detail.hidden = !detail;
    ticket.detail.textContent = detail;
    ticket.price.textContent = combo || taste || bento ? '' : recipe.price + ' 金币';
    ticket.price.hidden = !ticket.price.textContent;
    ticket.sequence.hidden = !recipe || combo || taste || bento;
    ticket.sequence.innerHTML = ticket.sequence.hidden ? '' : recipe.sequence.map((direction) =>
      '<i data-arrow="' + direction + '"><svg><use href="#i-arrow"/></svg></i>').join('');
    ticket.button.setAttribute('aria-label', ['订单 ' + (ticket.index + 1), title, detail, ticket.price.textContent].filter(Boolean).join('，'));
    const ctx = ticket.canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    if (!window.KitchenArt) return;
    if (combo) dishes.forEach((dish, index) => window.KitchenArt.drawDish(ctx, dish.recipeId, 32 * index, 16, 32));
    else if (bento || recipe) window.KitchenArt.drawDish(ctx, bento ? 'bento' : recipe.id, 0, 0, 64);
  }

  function renderTickets() {
    const orders = state.orders;
    const orderKey = orders.map((order) => order.id).join(',');
    if (ui.shown.orderKey !== orderKey) {
      ui.shown.orderKey = orderKey;
      const alive = new Set();
      orders.forEach((order, index) => {
        let ticket = ticketEls.get(order.id);
        if (!ticket) {
          ticket = makeTicket(order);
          ticketEls.set(order.id, ticket);
        }
        alive.add(order.id);
        if (ticket.index !== index) {
          ticket.index = index;
          ticket.key.textContent = String(index + 1);
        }
        el.tickets.appendChild(ticket.li); // 按当前顺序重新排好
      });
      ticketEls.forEach((ticket, id) => {
        if (alive.has(id)) return;
        ticket.li.remove();
        ticketEls.delete(id);
      });
    }
    orders.forEach((order) => {
      const ticket = ticketEls.get(order.id);
      if (!ticket) return;
      renderTicketLabel(ticket, order);
      const selected = order.id === state.selectedId;
      if (ticket.selected !== selected) {
        ticket.selected = selected;
        ticket.li.classList.toggle('is-selected', selected);
        ticket.button.setAttribute('aria-pressed', String(selected));
      }
      if (state.practice) {
        if (ticket.seconds !== -1) {
          ticket.seconds = -1;
          ticket.text.textContent = '不限时';
          ticket.fill.style.transform = 'scaleX(1)';
        }
        return;
      }
      const ratio = order.maxPatience > 0 ? Math.max(0, Math.min(1, order.patience / order.maxPatience)) : 0;
      ticket.fill.style.transform = 'scaleX(' + ratio.toFixed(3) + ')';
      const seconds = Math.ceil(order.patience);
      if (ticket.seconds !== seconds) {
        ticket.seconds = seconds;
        ticket.text.textContent = seconds + ' 秒';
      }
      const mood = ratio < 0.25 ? 'urgent' : ratio < 0.5 ? 'tense' : 'calm';
      if (ticket.mood !== mood) {
        ticket.mood = mood;
        ticket.li.dataset.mood = mood;
      }
    });
  }

  // 订单夹下面的小纸条：今天出了几道、离下一颗星还差几道（星级规则见 backend-api.md）。
  function renderTally() {
    const key = (state.practice ? 'p' : 'd') + state.served;
    if (ui.shown.tally === key) return;
    ui.shown.tally = key;
    const served = state.served;
    const stars = served >= 10 ? 3 : served >= 5 ? 2 : served > 0 ? 1 : 0;
    el.tallyServed.textContent = String(served);
    Array.prototype.forEach.call(el.tallyStars.children, (star, index) => {
      star.classList.toggle('is-on', !state.practice && index < stars);
    });
    el.tallyStars.setAttribute('aria-label', state.practice ? '练习不计星' : '目前 ' + stars + ' 星');
    el.tallyNext.textContent = state.practice ? '练习不计星，慢慢练手。'
      : stars === 0 ? '出餐 1 道拿到第一颗星。'
        : stars === 1 ? '再出 ' + (5 - served) + ' 道升两星。'
          : stars === 2 ? '再出 ' + (10 - served) + ' 道升三星。'
            : '三星到手，继续冲分。';
  }

  function renderCue() {
    const sequenceKey = state.selectedId + ':' + state.sequence.join(',');
    let rebuilt = false;
    if (ui.shown.sequenceKey !== sequenceKey) {
      ui.shown.sequenceKey = sequenceKey;
      el.cueChop.innerHTML = state.sequence.map((direction) =>
        '<span class="tile" data-arrow="' + direction + '"><svg><use href="#i-arrow"/></svg></span>').join('');
      tiles = Array.prototype.slice.call(el.cueChop.children);
      rebuilt = true;
    }
    const progressKey = state.step + ':' + state.progress;
    if (rebuilt || ui.shown.progressKey !== progressKey) {
      ui.shown.progressKey = progressKey;
      tiles.forEach((tile, index) => {
        tile.classList.toggle('is-done', index < state.progress);
        tile.classList.toggle('is-next', state.step === 'chop' && index === state.progress);
      });
    }
    const heat = state.step === 'cook' || state.step === 'ready' ? state.heat : 0;
    const left = (heat * 100).toFixed(2) + '%';
    if (ui.shown.needle !== left) {
      ui.shown.needle = left;
      el.heatNeedle.style.left = left;
    }
  }

  function createWorkControls() {
    for (let index = 0; index < 2; index += 1) {
      const pot = document.createElement('button');
      pot.type = 'button';
      pot.className = 'pot-control';
      pot.dataset.pot = String(index);
      pot.innerHTML = '<span class="pot-title"><kbd>' + (index === 0 ? 'Q' : 'E') + '</kbd>' +
        '<b></b><small></small></span><span class="heat-track" aria-hidden="true">' +
        '<i class="heat-zone heat-good"></i><i class="heat-zone heat-perfect"></i>' +
        '<i class="heat-burn"></i><i class="heat-needle"></i></span>';
      pot.addEventListener('click', () => doFinishPot(index));
      el.dualPots.appendChild(pot);

      const dish = document.createElement('button');
      dish.type = 'button';
      dish.className = 'counter-btn combo-dish';
      dish.dataset.dish = String(index);
      dish.innerHTML = '<strong></strong><small></small>';
      dish.addEventListener('click', () => doSelectDish(index));
      el.comboDishes.appendChild(dish);
    }

    const box = menu.BENTO;
    for (let y = 0; y < box.height; y += 1) {
      for (let x = 0; x < box.width; x += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'bento-cell';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        if (x === box.reserved.x && y === box.reserved.y) {
          cell.dataset.reserved = 'true';
          cell.disabled = true;
        }
        cell.addEventListener('click', () => placePiece(x, y));
        cell.addEventListener('focus', () => previewPiece(x, y));
        cell.addEventListener('pointerenter', () => previewPiece(x, y));
        el.bentoGrid.appendChild(cell);
      }
    }
    el.bentoGrid.addEventListener('pointerleave', () => previewPiece());
    el.bentoGrid.addEventListener('focusout', () => previewPiece());
    box.pieces.forEach((piece) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'counter-btn bento-piece';
      button.dataset.piece = piece.id;
      button.style.setProperty('--piece-color', piece.color);
      button.innerHTML = '<span class="piece-shape" aria-hidden="true"></span><span></span>';
      button.lastElementChild.textContent = piece.name;
      button.addEventListener('click', () => {
        if (!ready()) return;
        ui.bentoPiece = piece.id;
        const placed = selectedOrder()?.bento?.placements.find((entry) => entry.pieceId === piece.id);
        ui.bentoRotation = placed?.rotation || 0;
        previewPiece();
        renderDom();
      });
      el.bentoPieces.appendChild(button);
    });
  }

  function renderPots() {
    const dual = state.pots.length > 1;
    setData('dual', dual ? '1' : '0');
    el.dualPots.hidden = !dual;
    if (!dual) return;
    Array.from(el.dualPots.children).forEach((button, index) => {
      const pot = state.pots[index];
      const name = pot ? RECIPES[pot.recipeId].name : '空锅';
      const heat = pot?.heat || 0;
      const label = !pot ? '待下锅' : heat < 0.42 ? '加热中' : heat < 0.52 ? '可出锅'
        : heat <= 0.62 ? '完美' : heat <= 0.72 ? '可出锅' : '过火';
      const band = !pot ? 'empty' : heat < 0.42 ? 'cold' : heat > 0.72 ? 'hot'
        : heat >= 0.52 && heat <= 0.62 ? 'perfect' : 'good';
      const active = Boolean(pot && pot.orderId === state.selectedId && pot.dishIndex === state.selectedDish);
      button.disabled = !pot || state.phase !== 'playing';
      button.dataset.heatBand = band;
      button.dataset.heat = String(heat);
      button.dataset.active = String(active);
      setText(button.querySelector('b'), (index === 0 ? '左锅 · ' : '右锅 · ') + name, 'potName' + index);
      setText(button.querySelector('small'), label, 'potLabel' + index);
      button.querySelector('.heat-needle').style.left = (heat * 100).toFixed(2) + '%';
      const aria = [index === 0 ? '左锅 Q' : '右锅 E', name, label, Math.floor(heat * 100) + '%'].join('，');
      if (ui.shown['potAria' + index] !== aria) {
        ui.shown['potAria' + index] = aria;
        button.setAttribute('aria-label', aria);
      }
    });
  }

  function renderRice() {
    el.riceBoard.hidden = state.rice === null;
    if (el.riceBoard.hidden) return;
    setText(el.riceCount, '米饭 ' + state.rice + '/' + state.riceCapacity, 'riceCount');
    setText(el.riceRefill, state.riceRefill ? Math.ceil(state.riceRefill) + ' 秒补 1 份' : '已盛满', 'riceRefill');
    el.feedPest.hidden = state.pest?.kind !== 'sparrow' || Boolean(state.helper);
    el.feedPest.disabled = !state.rice || state.phase !== 'playing';
    el.helperNote.hidden = !state.helper;
  }

  function renderCombo(order) {
    Array.from(el.comboDishes.children).forEach((button, index) => {
      const dish = order.dishes[index];
      const name = RECIPES[dish.recipeId].name;
      const status = dish.status === 'chop' ? '待切菜' : dish.status === 'waiting' ? '待下锅'
        : dish.status === 'cook' ? '锅中' : '保温 ' + Math.ceil(dish.warmth) + ' 秒';
      button.dataset.status = dish.status;
      button.dataset.cooling = String(dish.status === 'ready' && dish.warmth < 4);
      button.setAttribute('aria-pressed', String(state.selectedDish === index));
      setText(button.firstElementChild, name, 'dishName' + index);
      setText(button.lastElementChild, status, 'dishStatus' + index);
    });
    setText(el.comboHint, canServe(order) ? '两道都热着，按空格出餐。' : '点菜名切换，两道都热着才能出餐。', 'comboHint');
  }

  function fillChoices(select, recipes, field) {
    select.replaceChildren(new Option('请选择', ''));
    const values = new Set(recipes.map((recipe) => recipe[field]));
    values.forEach((value) => select.add(new Option(value, value)));
  }

  function renderTaste(order) {
    const key = order.id + ':' + state.day;
    if (ui.shown.tasteKey !== key) {
      ui.shown.tasteKey = key;
      const recipes = availableRecipes();
      fillChoices(el.tasteIngredient, recipes, 'ingredient');
      fillChoices(el.tasteMethod, recipes, 'method');
      el.tasteRequest.textContent = '客人说：“' + order.taste.text + '”';
    }
    el.confirmTaste.disabled = !el.tasteIngredient.value || !el.tasteMethod.value;
  }

  function previewPiece(x, y) {
    const order = selectedOrder();
    const preview = ui.bentoPiece && order?.bento && Number.isInteger(x)
      ? menu.bentoCells(ui.bentoPiece, ui.bentoRotation).map(([dx, dy]) => [x + dx, y + dy]) : [];
    const fits = preview.length && menu.placeBento(order.bento.placements, ui.bentoPiece, x, y, ui.bentoRotation);
    Array.from(el.bentoGrid.children).forEach((cell) => {
      const marked = preview.some(([cx, cy]) => Number(cell.dataset.x) === cx && Number(cell.dataset.y) === cy);
      cell.classList.toggle('is-preview', Boolean(marked && fits));
      cell.classList.toggle('is-blocked', Boolean(marked && !fits));
    });
  }

  function rotatePiece() {
    if (!ready() || el.bentoPanel.hidden || !ui.bentoPiece) return;
    ui.bentoRotation = (ui.bentoRotation + 1) % 4;
    previewPiece();
    renderDom();
  }

  function placePiece(x, y) {
    if (!ready() || !ui.bentoPiece || el.bentoPanel.hidden) return;
    const order = selectedOrder();
    const served = state.served;
    const coins = state.coins;
    if (game.placeBento(ui.bentoPiece, x, y, ui.bentoRotation)) {
      const next = menu.BENTO.pieces.find((piece) => !order.bento.placements.some((entry) => entry.pieceId === piece.id));
      if (next) { ui.bentoPiece = next.id; ui.bentoRotation = 0; }
      sfx.play('chop');
      if (state.served > served) showServed('bento', state.coins - coins, true);
    } else sfx.play('deny');
    previewPiece();
    prev = snapshot();
    renderDom();
  }

  function renderBento(order) {
    const placements = order.bento.placements;
    const key = JSON.stringify([order.id, ui.bentoPiece, ui.bentoRotation, placements]);
    if (ui.shown.bentoKey === key) return;
    ui.shown.bentoKey = key;
    const pieces = menu.BENTO.pieces;
    Array.from(el.bentoGrid.children).forEach((cell) => {
      const x = Number(cell.dataset.x);
      const y = Number(cell.dataset.y);
      const placed = placements.find((entry) => entry.cells.some(([cx, cy]) => cx === x && cy === y));
      const piece = pieces.find((entry) => entry.id === placed?.pieceId);
      const reserved = cell.disabled;
      const label = reserved ? '甜点' : piece?.name || '空格';
      cell.dataset.filled = String(Boolean(piece));
      cell.style.setProperty('--cell-fill', piece?.color || '');
      cell.textContent = reserved ? '甜点' : piece ? (placed.cells[0][0] === x && placed.cells[0][1] === y ? piece.name[0] : '▪') : '·';
      cell.setAttribute('aria-label', '第 ' + (y + 1) + ' 行第 ' + (x + 1) + ' 列，' + label);
    });
    Array.from(el.bentoPieces.children).forEach((button) => {
      const piece = pieces.find((entry) => entry.id === button.dataset.piece);
      const placed = placements.find((entry) => entry.pieceId === piece.id);
      const selected = piece.id === ui.bentoPiece;
      const rotation = selected ? ui.bentoRotation : placed?.rotation || 0;
      button.dataset.placed = String(Boolean(placed));
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', piece.name + (placed ? '，已放入' : '，待摆放') + '，旋转 ' + rotation * 90 + ' 度');
      const shape = button.firstElementChild;
      shape.replaceChildren();
      menu.bentoCells(piece.id, rotation).forEach(([x, y]) => {
        const pixel = document.createElement('i');
        pixel.style.gridArea = (y + 1) + ' / ' + (x + 1);
        shape.appendChild(pixel);
      });
    });
    const selected = pieces.find((piece) => piece.id === ui.bentoPiece);
    el.bentoHint.textContent = order.bento.complete ? '装好了，可以出餐。'
      : '已装 ' + placements.length + '/' + pieces.length + ' 份。' + (selected ? '将' + selected.name + '放到格中。' : '先选一道菜。');
    el.rotateBento.disabled = !selected;
    el.removeBento.disabled = !placements.some((entry) => entry.pieceId === ui.bentoPiece);
    el.clearBento.disabled = !placements.length;
    el.serveBento.disabled = !order.bento.complete;
  }

  function renderWorkbench(order) {
    const combo = order?.kind === 'combo';
    const taste = order?.kind === 'taste' && state.step === 'taste';
    const bento = order?.kind === 'bento' && (state.step === 'bento' || state.step === 'ready');
    el.comboPanel.hidden = !combo;
    el.tastePanel.hidden = !taste;
    el.bentoPanel.hidden = !bento;
    el.workbench.hidden = !(combo || taste || bento);
    setData('work', combo ? 'combo' : taste ? 'taste' : bento ? 'bento' : 'none');
    if (combo) renderCombo(order);
    if (taste) renderTaste(order);
    if (!bento) return;
    if (ui.workOrder !== order.id) {
      ui.workOrder = order.id;
      ui.bentoPiece = menu.BENTO.pieces.find((piece) => !order.bento.placements.some((entry) => entry.pieceId === piece.id))?.id || menu.BENTO.pieces[0].id;
      ui.bentoRotation = 0;
    }
    renderBento(order);
  }

  function renderDom() {
    setData('phase', state.phase);
    setData('step', state.step);
    setData('pest', state.pest ? '1' : '0');
    if (ui.screen !== 'play') return;

    const day = '第 ' + state.day + ' 天';
    setText(el.hudDay, state.practice ? (state.day === 1 ? '练习' : '练习 · ' + day) : day, 'day');
    setText(el.hudTime, state.practice ? '∞' : String(Math.ceil(state.timeLeft)), 'time');
    setText(el.hudCoins, String(state.coins), 'coins');
    setText(el.hudScore, String(state.score), 'score');
    setText(el.hudCombo, '×' + state.combo, 'combo');
    if (el.hudTimeUnit.hidden !== state.practice) el.hudTimeUnit.hidden = state.practice;
    if (el.hudComboWrap.hidden !== state.combo < 2) el.hudComboWrap.hidden = state.combo < 2;
    const low = !state.practice && state.timeLeft <= 10 && state.phase === 'playing';
    if (ui.shown.low !== low) {
      ui.shown.low = low;
      el.hudTimeWrap.classList.toggle('is-low', low);
    }
    const label = state.practice ? '练习中，时间不限' : '剩余 ' + Math.ceil(state.timeLeft) + ' 秒';
    if (ui.shown.timeLabel !== label) {
      ui.shown.timeLabel = label;
      el.hudTimeWrap.setAttribute('aria-label', label);
    }

    const order = selectedOrder();
    const serve = canServe(order);
    const action = state.step === 'ready' ? (serve ? '出餐' : '下一道') : state.step === 'waiting' ? '下锅' : '出锅';
    setText(el.actionLabel, action, 'action');
    el.btnAction.disabled = state.step === 'bento' || state.step === 'taste';
    el.cueServe.hidden = !serve;
    const activeRecipe = RECIPES[selectedRecipeId()];
    el.activeRecipe.hidden = !activeRecipe || state.day === 1;
    if (activeRecipe) setText(el.activeRecipe, '正在做 · ' + activeRecipe.name, 'activeRecipe');

    // feedback.id 变了才更新，读屏不会逐帧重读同一句话
    if (ui.shown.feedbackId !== state.feedback.id) {
      ui.shown.feedbackId = state.feedback.id;
      el.feedback.textContent = state.feedback.text;
      el.feedback.dataset.tone = state.feedback.tone;
      restartAnimation(el.feedback, 'is-fresh');
    }

    renderTickets();
    renderCue();
    renderTally();
    renderPots();
    renderRice();
    renderWorkbench(order);

    const pestOn = Boolean(state.pest) && (state.phase === 'playing' || state.phase === 'paused');
    if (el.pestBtn.hidden === pestOn) el.pestBtn.hidden = !pestOn;
    if (pestOn) el.pestFill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, state.pest.remaining / 5)).toFixed(3) + ')';
  }

  // 标题画面里厨房画布是“铺满裁切”的，这里把木札和底栏的屏幕位置换算回画布坐标，
  // 告诉舞台猫厨师该站哪儿：右边够宽就站在柜台后面，不够就站到柜台上、木札下方。
  function titleLayout() {
    const box = el.stage.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const scale = Math.max(box.width / window.KitchenStage.WIDTH, box.height / window.KitchenStage.HEIGHT);
    const offsetX = box.left + (box.width - window.KitchenStage.WIDTH * scale) / 2;
    const offsetY = box.top + (box.height - window.KitchenStage.HEIGHT * scale) / 2;
    const tags = el.titleTags.getBoundingClientRect();
    const ledger = el.ledger.getBoundingClientRect();
    const room = box.right - tags.right;
    if (room >= 330 * scale) {
      const x = (tags.right + room / 2 - offsetX) / scale;
      return { behind: true, x: Math.min(window.KitchenStage.WIDTH - 200, x) };
    }
    const feet = Math.min(938, (ledger.top - offsetY) / scale - 8);
    const top = (tags.bottom - offsetY) / scale + 12;
    return {
      behind: false,
      x: (box.left + box.width / 2 - offsetX) / scale,
      feet: feet,
      scale: Math.max(1.3, Math.min(2.6, (feet - top) / 136))
    };
  }

  function measure() {
    const width = el.stage.clientWidth;
    if (width) el.stage.style.setProperty('--u', (width / 100).toFixed(3) + 'px');
    ui.titleLayout = ui.screen === 'title' ? titleLayout() : null;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    advance(now);
    detect();
    renderDom();
    const pots = state.pots.filter(Boolean);
    const cooking = ui.screen === 'play' && state.phase === 'playing' && pots.length > 0;
    sfx.setSizzle(cooking ? 0.3 + Math.max(...pots.map((pot) => pot.heat)) * 0.7 : 0);
    const order = selectedOrder();
    stage.draw({
      mode: ui.screen === 'title' ? 'title' : 'play',
      step: state.phase === 'menu' ? 'select' : state.step,
      progress: state.progress,
      total: state.sequence.length,
      heat: state.heat,
      grade: state.grade,
      recipeId: selectedRecipeId(),
      pots: state.pots,
      readyDishes: order?.bento?.complete ? ['bento']
        : (order?.kind === 'combo' ? order.dishes.filter((dish) => dish.status === 'ready').map((dish) => dish.recipeId) : []),
      helper: state.helper,
      paused: state.phase === 'paused',
      title: ui.titleLayout
    }, now);
  }

  /* ---------- 事件绑定 ---------- */

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onAway);
  window.addEventListener('pagehide', onAway);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onAway();
    ui.last = performance.now();
  });

  bindPress(el.pad, (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (event.type === 'pointerdown') event.preventDefault();
    runToken(button.dataset.dir || button.dataset.act);
  });
  el.pad.addEventListener('contextmenu', (event) => event.preventDefault());

  bindPress(el.tickets, (event) => {
    const item = event.target.closest('.ticket');
    if (!item) return;
    if (event.type === 'pointerdown') event.preventDefault();
    const order = state.orders.find((entry) => String(entry.id) === item.dataset.id);
    if (order) doSelect(order.id);
  });

  bindPress(el.pestBtn, (event) => {
    if (event.type === 'pointerdown') event.preventDefault();
    doShoo();
  });

  bindClick(el.btnStart, onStart);
  bindClick(el.btnPractice, () => begin(session.startPractice()));
  bindClick(el.btnPracticeDays, () => pushSheet('practice'));
  bindClick(el.btnLeaderboard, () => openLeaderboard(false));
  bindClick(el.btnBillLeaderboard, () => openLeaderboard(true));
  bindClick(el.rankDaily, () => renderLeaderboard('daily'));
  bindClick(el.rankCampaign, () => renderLeaderboard('campaign'));
  bindClick(el.rankLocal, () => renderLeaderboard(ui.rankKind, 'local'));
  bindClick(el.rankShared, () => renderLeaderboard(ui.rankKind, 'shared'));
  bindClick(el.rankRetry, () => {
    renderLeaderboard(ui.rankKind);
    el.rankShared.focus({ preventScroll: true });
  });
  el.rankSubmitForm.addEventListener('submit', submitRank);
  el.rankNickname.addEventListener('input', () => {
    if (!ui.rankPostError) return;
    ui.rankPostError = '';
    renderSubmitState();
  });
  bindClick(el.btnLeaderboardClose, closeLeaderboard);
  bindClick(el.btnPracticeClose, () => dropSheet('practice'));
  el.practiceOptions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-practice-day]');
    if (button) begin(session.startPractice(Number(button.dataset.practiceDay)));
  });
  bindClick(el.btnHelp, openHelp);
  bindClick(el.btnSound, toggleSound);
  bindClick(el.btnReset, () => askConfirm(
    '清空五天的进度、钱包和升级，从第一天重新开始？最高分这些记录会留着。',
    '清空并重来',
    () => {
      const result = session.restartCampaign();
      if (result.ok) toast('进度已清空，从第一天开始。');
      else toastReason(result.reason);
      refreshTitle();
    }
  ));

  bindClick(el.btnPause, () => openPause());
  bindClick(el.btnHelpHud, openHelp);
  bindClick(el.btnSoundHud, toggleSound);

  bindClick(el.btnResume, resumeGame);
  bindClick(el.btnHelpPause, openHelp);
  bindClick(el.btnSoundPause, toggleSound);
  bindClick(el.btnRestartShift, () => {
    if (state.practice) { restartShift(); return; }
    askConfirm('今天从头再来？这一轮还没结算的收入会作废。', '重新开始今天', restartShift);
  });
  bindClick(el.btnLeave, () => {
    if (state.practice) { leaveShift(); return; }
    askConfirm('现在回到菜单，今天还没结算的收入会作废。', '回到菜单', leaveShift);
  });

  bindClick(el.btnHelpClose, closeHelp);
  bindClick(el.openRecipeBook, openRecipes);
  bindClick(el.helpRecipeBook, openRecipes);
  bindClick(el.btnRecipeClose, closeRecipes);
  el.tasteIngredient.addEventListener('change', renderDom);
  el.tasteMethod.addEventListener('change', renderDom);
  el.confirmTaste.addEventListener('click', doChooseTaste);
  el.feedPest.addEventListener('click', doFeed);
  el.rotateBento.addEventListener('click', rotatePiece);
  el.removeBento.addEventListener('click', () => {
    if (!ready()) return;
    if (game.removeBento(ui.bentoPiece)) sfx.play('click');
    previewPiece();
    renderDom();
  });
  el.clearBento.addEventListener('click', () => {
    if (!ready()) return;
    if (game.resetBento()) sfx.play('click');
    ui.bentoPiece = menu.BENTO.pieces[0].id;
    ui.bentoRotation = 0;
    previewPiece();
    renderDom();
  });
  el.serveBento.addEventListener('click', doAction);
  bindClick(el.btnConfirmOk, () => answerConfirm(true));
  bindClick(el.btnConfirmCancel, () => answerConfirm(false));

  el.shopList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-key]');
    if (button && !button.disabled) buyUpgrade(button.dataset.key);
  });
  bindClick(el.btnNextDay, () => begin(session.nextDay()));
  bindClick(el.btnBillTitle, showTitle);
  bindClick(el.btnBillRestart, () => {
    const result = session.restartCampaign();
    if (!result.ok) { toastReason(result.reason); return; }
    begin(session.startDay());
  });

  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(el.stage);
  window.addEventListener('resize', measure);
  if (motionQuery && motionQuery.addEventListener) {
    motionQuery.addEventListener('change', (event) => stage.setCalm(event.matches));
  }

  /* ---------- 启动 ---------- */

  el.rankScope.hidden = !sharedRankUrl;
  if (sharedRankUrl) el.btnLeaderboard.textContent = '排行榜';
  sfx.setEnabled(session.profile.sound);
  createWorkControls();
  drawTitleArt();
  showTitle();
  measure();
  // 存档里留着没处理完的结算：先把日结单摆出来。
  if (session.profile.summary) openBill(session.profile.summary);
  requestAnimationFrame(frame);

  // 联调与自动化测试用的只读入口：KitchenApp.session.snapshot()
  window.KitchenApp = { session: session };
})();
