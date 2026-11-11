// 小满食堂前端冒烟测试：用真实浏览器以 file:// 直接打开 index.html，走一遍键盘、鼠标、触屏全流程。
// 用法：node e2e/smoke.cjs [index.html 的路径]
// 共享榜：node e2e/smoke.cjs --shared
// 依赖：playwright 或 playwright-core（只在跑这个脚本时需要，游戏本身零依赖）。
//   npm install --no-save playwright-core
// 环境变量（都可省略）：
//   BROWSER_CHANNEL  用本机已装的浏览器，例如 msedge 或 chrome；不设时先试 Playwright 自带的 Chromium，再依次试 msedge、chrome
//   CHROME_PATH      直接指定浏览器可执行文件
//   PLAYWRIGHT_PATH  playwright 模块所在路径（没有装在项目里时用）
//   SHOTS            截图输出目录；不设就不截图
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function loadPlaywright() {
  const names = process.env.PLAYWRIGHT_PATH ? [process.env.PLAYWRIGHT_PATH] : ['playwright', 'playwright-core'];
  for (const name of names) {
    try { return require(name); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  console.error('没有找到 playwright。先运行：npm install --no-save playwright-core');
  process.exit(2);
}
const { chromium } = loadPlaywright();

// Windows 上 path.resolve 得到 C:\... ，要转成 file:///C:/... 才是合法地址。
const SHARED = process.argv[2] === '--shared';
const INDEX = pathToFileURL(path.resolve((SHARED ? '' : process.argv[2]) || path.join(__dirname, '..', 'index.html'))).href;
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

async function launch() {
  const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, args });
  if (process.env.BROWSER_CHANNEL) return chromium.launch({ channel: process.env.BROWSER_CHANNEL, args });
  let lastError = null;
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try { return await chromium.launch({ channel, args }); } catch (error) { lastError = error; }
  }
  throw lastError;
}
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const WASD = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) { passed += 1; return; }
  failures.push(name + (detail === undefined ? '' : ' → ' + JSON.stringify(detail)));
  console.log('  ✗ ' + name + (detail === undefined ? '' : ' → ' + JSON.stringify(detail)));
}

async function open(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1366, height: 700 },
    hasTouch: Boolean(options.touch),
    reducedMotion: options.reducedMotion || 'no-preference'
  });
  if (options.init) await context.addInitScript(options.init);
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.type() + ': ' + message.text()); });
  page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
  await page.goto(options.url || INDEX);
  await page.waitForTimeout(300);
  return { context, page, problems };
}

const snap = (page) => page.evaluate(() => window.KitchenApp.session.snapshot());
const attr = (page, name) => page.evaluate((key) => document.getElementById('game').dataset[key], name);
const visible = (page, selector) => page.locator(selector).isVisible();
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const focused = (page, id) => page.evaluate((expected) => document.activeElement.id === expected, id);
const points = (score) => score.toLocaleString('zh-CN') + ' 分';
const scoreAndRank = (score, rank) => points(score) + ' · 第 ' + rank + ' 名';

async function currentRank(page) {
  const row = page.locator('#rankRows tr[aria-current="true"]');
  if (await row.count() !== 1) return null;
  return {
    id: await row.getAttribute('data-entry-id'),
    rank: Number(await row.getAttribute('data-rank')),
    points: await row.locator('td').last().textContent(),
    marker: await row.getByText('本局', { exact: true }).isVisible()
  };
}

function matchesRank(row, id, score, rank) {
  return id != null && row?.id === String(id) && row.rank === rank &&
    row.points === points(score) && row.marker;
}

// 联调用的快进：直接推进引擎时钟，界面应当在下一帧跟上。
const fastForward = (page, seconds) => page.evaluate((total) => {
  const game = window.KitchenApp.session.game;
  for (let left = total; left > 0 && game.state.phase === 'playing'; left -= 0.25) game.tick(Math.min(0.25, left));
}, seconds);

async function prep(page, index, keys = KEY) {
  await page.keyboard.press('Digit' + (index + 1));
  await chopCurrent(page, keys);
}

async function chopCurrent(page, keys = KEY) {
  const sequence = (await snap(page)).game.sequence;
  for (const direction of sequence) await page.keyboard.press(keys[direction]);
}

async function waitHeat(page, minimum) {
  await page.waitForFunction((target) => {
    const state = window.KitchenApp.session.game.state;
    return state.step === 'cook' && state.heat >= target;
  }, minimum, { polling: 'raf', timeout: 8000 });
}

async function finishPot(page, index, touch = false) {
  await page.waitForFunction((slot) => {
    const pot = window.KitchenApp.session.game.state.pots[slot];
    return pot && pot.heat >= 0.5;
  }, index, { polling: 'raf', timeout: 8000 });
  const button = page.locator('#dualPots [data-pot="' + index + '"]');
  if (touch) await button.tap();
  else await button.click();
}

async function finishSelectedPot(page) {
  const { game } = await snap(page);
  const index = game.pots.findIndex(pot => pot?.orderId === game.selectedId && pot.dishIndex === game.selectedDish);
  if (index < 0) throw new Error('选中的菜没有上锅：' + JSON.stringify(game));
  await finishPot(page, index);
}

async function cookOne(page, index = 0, keys = KEY) {
  await prep(page, index, keys);
  if ((await snap(page)).game.day === 1) {
    await waitHeat(page, 0.53);
    await page.keyboard.press('Space');
  } else {
    await finishSelectedPot(page);
  }
  await page.keyboard.press('Space');
}

async function finishDay(page, dishes) {
  for (let i = 0; i < dishes; i++) await cookOne(page, 0);
  await fastForward(page, 95);
  await page.waitForSelector('#billSheet:not([hidden])', { timeout: 6000 });
}

async function startPracticeDay(page, day) {
  await page.click('#btnPracticeDays');
  await page.click('[data-practice-day="' + day + '"]');
  await page.waitForSelector('#game[data-screen="play"]');
}

async function leavePractice(page) {
  await page.keyboard.press('Escape');
  await page.click('#btnLeave');
  await page.waitForSelector('#game[data-screen="title"]');
}

async function sharedLeaderboard(browser) {
  const { createSharedGame } = require('../scripts/serve-shared.cjs');
  const server = createSharedGame();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = 'http://127.0.0.1:' + server.address().port;
  const contexts = [];
  try {
    async function playAndSubmit(nickname, dishes, options) {
      const player = await open(browser, { ...options, url });
      contexts.push(player.context);
      await player.page.click('#btnStart');
      // Serve near closing so later idle-order penalties do not erase the test score.
      if (dishes) await fastForward(player.page, 84);
      await finishDay(player.page, dishes);
      const { score } = (await snap(player.page)).profile.summary;
      await player.page.click('#btnBillLeaderboard');
      await player.page.fill('#rankNickname', nickname);
      const submitted = player.page.waitForResponse(response =>
        response.url().endsWith('/api/leaderboard') && response.request().method() === 'POST');
      await player.page.click('#btnSubmitScore');
      const response = await submitted;
      check(nickname + '提交了本局的实际积分', response.ok() &&
        (await response.json()).entries[0].score === score);
      await player.page.locator('#rankRows').getByText(nickname, { exact: true }).waitFor();
      return { ...player, score };
    }

    const first = await playAndSubmit('花猫', 0);
    const second = await playAndSubmit('橘猫', 1, { viewport: { width: 360, height: 640 }, touch: true });
    const secondRows = second.page.locator('#rankRows tr[data-rank]');
    check('第二位玩家可以看到两人的排名和积分', second.score > first.score && await secondRows.count() === 2 &&
      (await secondRows.nth(0).textContent()).includes('橘猫') &&
      (await secondRows.nth(0).textContent()).includes(points(second.score)) &&
      (await secondRows.nth(1).textContent()).includes('花猫'), await secondRows.allTextContents());
    check('共享榜窄屏不横向溢出', await second.page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth && document.getElementById('leaderboardSheet').scrollWidth <= innerWidth));

    await first.page.reload();
    await first.page.click('#btnBillLeaderboard');
    await first.page.locator('#rankRows').getByText('橘猫', { exact: true }).waitFor();
    const firstRank = await currentRank(first.page);
    check('第一位玩家刷新后看到更新的共享名次', firstRank?.rank === 2 && firstRank.points === points(first.score), firstRank);
    check('已提交的成绩无需重复提交', await first.page.locator('#btnSubmitScore').isDisabled() &&
      (await first.page.textContent('#btnSubmitScore')) === '已提交');
    await first.page.click('#rankLocal');
    check('本机榜只显示当前浏览器的记录', await first.page.locator('#rankRows tr[data-rank]').count() === 1 &&
      (await currentRank(first.page))?.rank === 1);

    const observer = await open(browser, { url });
    contexts.push(observer.context);
    await observer.page.click('#btnLeaderboard');
    await observer.page.locator('#rankRows').getByText('橘猫', { exact: true }).waitFor();
    check('未开店的访客可从主菜单看共享榜',
      await observer.page.locator('#rankRows').getByText('花猫', { exact: true }).isVisible() &&
      !(await visible(observer.page, '#rankSubmitForm')));

    await first.page.click('#btnLeaderboardClose');
    for (let day = 2; day <= 5; day++) {
      await first.page.click('#btnNextDay');
      await finishDay(first.page, 0);
    }
    const campaign = await first.page.evaluate(() => window.KitchenApp.session.getLeaderboard('campaign')[0]);
    await first.page.click('#btnBillLeaderboard');
    check('第五天结算记住上一局昵称', (await first.page.inputValue('#rankNickname')) === '花猫');
    await first.page.click('#btnSubmitScore');
    await first.page.locator('#rankRows').getByText('花猫', { exact: true }).waitFor();
    check('第五天结算提交完整总分', (await currentRank(first.page))?.points === points(campaign.score));
    await first.page.reload();
    await first.page.click('#btnBillLeaderboard');
    await first.page.locator('#rankRows').getByText('花猫', { exact: true }).waitFor();
    check('刷新后的五天总分榜确认整局已提交', await first.page.locator('#btnSubmitScore').isDisabled() &&
      (await first.page.textContent('#btnSubmitScore')) === '已提交');
    check('共享榜两个浏览器均无控制台错误', !first.problems.length && !second.problems.length,
      [...first.problems, ...second.problems]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await new Promise(resolve => server.close(resolve));
  }
}

(async () => {
  const browser = await launch();
  if (SHARED) {
    try { await sharedLeaderboard(browser); } finally { await browser.close(); }
    console.log('共享榜通过 ' + passed + ' 项，失败 ' + failures.length + ' 项');
    if (failures.length) process.exitCode = 1;
    return;
  }
  console.log('浏览器 ' + browser.version() + '，页面 ' + INDEX + '\n');

  /* ---------- 1. 标题、帮助、声音 ---------- */
  console.log('1 标题、帮助、声音');
  let { context, page, problems } = await open(browser);
  check('标题画面可见', await attr(page, 'screen') === 'title' && await visible(page, '#btnStart'));
  check('开店木札写着第一天', (await page.textContent('#btnStart')).replace(/\s/g, '') === '开店营业第一天');
  check('没有进度时不显示重新开始', !(await visible(page, '#btnReset')));
  check('像素招牌已绘制', await visible(page, '#titleArt'));
  await page.click('#btnLeaderboard');
  check('标题打开排行榜弹层并聚焦单日榜', await visible(page, '#leaderboardSheet') &&
    await page.getAttribute('#leaderboardSheet', 'aria-modal') === 'true' &&
    await page.getAttribute('#rankDaily', 'aria-pressed') === 'true' && await focused(page, 'rankDaily') &&
    await page.locator('#titleScreen').evaluate(title => title.inert));
  check('新存档的单日榜为空', await visible(page, '#rankEmpty') &&
    !(await visible(page, '#rankTable')) && (await page.textContent('#rankEmpty')).includes('单日') &&
    await page.locator('#rankRows tr').count() === 0);
  await page.click('#rankCampaign');
  check('未完成五天时总分榜为空', await page.getAttribute('#rankCampaign', 'aria-pressed') === 'true' &&
    await visible(page, '#rankEmpty') && (await page.textContent('#rankEmpty')).includes('五天') &&
    await page.locator('#rankRows tr').count() === 0);
  await page.keyboard.press('Escape');
  check('Esc 关闭排行榜后回到标题按钮', !(await visible(page, '#leaderboardSheet')) &&
    await focused(page, 'btnLeaderboard') && !(await page.locator('#titleScreen').evaluate(title => title.inert)));
  await page.click('#btnHelp');
  check('帮助弹层打开', await visible(page, '#helpSheet'));
  await page.keyboard.press('Escape');
  check('Esc 关闭帮助', !(await visible(page, '#helpSheet')));
  await page.keyboard.press('KeyH');
  check('H 键打开帮助', await visible(page, '#helpSheet'));
  await page.click('#btnHelpClose');
  await page.click('#btnSound');
  check('声音关闭后写入存档', (await snap(page)).profile.sound === false);
  check('声音木札显示已关闭', (await page.textContent('#soundNote')) === '已关闭' && (await page.getAttribute('#btnSound', 'aria-pressed')) === 'false');
  await page.reload();
  await page.waitForTimeout(300);
  check('刷新后保留声音偏好', (await snap(page)).profile.sound === false && (await page.textContent('#soundNote')) === '已关闭');
  await page.click('#btnSound');
  check('声音可以重新打开', (await snap(page)).profile.sound === true);

  /* ---------- 2. 开店与完整做菜链路（键盘） ---------- */
  console.log('2 键盘做菜');
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  let s = await snap(page);
  check('开店后进入营业', await attr(page, 'screen') === 'play' && s.game.phase === 'playing' && s.game.day === 1);
  check('三张订单票', await page.locator('.ticket').count() === 3);
  check('HUD 显示第 1 天', (await page.textContent('#hudDay')) === '第 1 天');
  check('选单前显示提示', await visible(page, '#cuePick'));
  await page.waitForTimeout(1100);
  check('营业时间在走', (await snap(page)).game.timeLeft < 89.5);

  await page.evaluate(() => {
    window.__prevented = {};
    document.addEventListener('keydown', (event) => { window.__prevented[event.code] = event.defaultPrevented; });
  });
  await page.keyboard.press('Digit1');
  s = await snap(page);
  check('按 1 选中第一张订单的真实 id', s.game.selectedId === s.game.orders[0].id && s.game.step === 'chop');
  check('切菜提示方块数量等于序列长度', await page.locator('#cueChop .tile').count() === s.game.sequence.length);
  check('第一块是当前方向', await page.locator('#cueChop .tile.is-next').count() === 1);
  const wrong = s.game.sequence[0] === 'left' ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.press(KEY[s.game.sequence[0]]);
  check('切对一刀进度 +1', (await snap(page)).game.progress === 1);
  await page.keyboard.press(s.game.sequence[1] === 'left' ? 'ArrowRight' : 'ArrowLeft');
  check('切错回到第一个方向', (await snap(page)).game.progress === 0);
  await shot(page, 'e2e-wrong');
  void wrong;
  for (const direction of s.game.sequence) await page.keyboard.press(KEY[direction]);
  check('切完进入控火', (await snap(page)).game.step === 'cook' && await visible(page, '#cueHeat'));
  check('方向键被拦截默认行为', await page.evaluate(() => window.__prevented.ArrowUp === true || window.__prevented.ArrowLeft === true || window.__prevented.ArrowRight === true));
  await page.keyboard.press('Space');
  s = await snap(page);
  check('太早按空格不出锅', s.game.step === 'cook');
  check('空格被拦截默认行为', await page.evaluate(() => window.__prevented.Space === true));
  await waitHeat(page, 0.53);
  await page.keyboard.down('Space');
  await page.keyboard.down('Space'); // 长按产生的重复事件
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  s = await snap(page);
  check('长按空格只出锅一次，不会连带出餐', s.game.step === 'ready' && s.game.served === 0, { step: s.game.step, served: s.game.served });
  check('火候指针停在成功区间', s.game.heat >= 0.42 && s.game.heat <= 0.72, s.game.heat);
  check('出餐提示出现', await visible(page, '#cueServe'));
  check('操作按钮改名出餐', (await page.textContent('#actionLabel')) === '出餐');
  await shot(page, 'e2e-ready');
  await page.keyboard.press('Space');
  s = await snap(page);
  check('再按空格出餐', s.game.served === 1 && s.game.step === 'select' && s.game.coins >= 14);
  await page.waitForTimeout(120);
  check('HUD 金币与真实状态一致', (await page.textContent('#hudCoins')) === String(s.game.coins));
  check('出餐后补齐三张订单', await page.locator('.ticket').count() === 3);
  check('星级纸条更新', (await page.textContent('#tallyServed')) === '1' && await page.locator('#tallyStars .is-on').count() === 1);
  await shot(page, 'e2e-served');

  await cookOne(page, 1, WASD);
  s = await snap(page);
  check('WASD 也能完成一道菜', s.game.served === 2 && s.game.combo === 2, { served: s.game.served, combo: s.game.combo });
  await page.waitForTimeout(100);
  check('连击显示', await visible(page, '#hudComboWrap') && (await page.textContent('#hudCombo')) === '×2');

  /* ---------- 3. 鼠标 ---------- */
  console.log('3 鼠标');
  await page.click('.ticket:nth-child(3) .ticket-btn');
  s = await snap(page);
  check('点击订单票选单', s.game.selectedId === s.game.orders[2].id && await page.locator('.ticket.is-selected').count() === 1);
  for (const direction of s.game.sequence) await page.click('.key[data-dir="' + direction + '"]');
  check('点击方向按钮切菜', (await snap(page)).game.step === 'cook');
  await waitHeat(page, 0.5);
  await page.click('#btnAction');
  s = await snap(page);
  check('点击一次只出锅不出餐', s.game.step === 'ready' && s.game.served === 2, { step: s.game.step, served: s.game.served });
  await page.click('#btnAction');
  check('再点一次出餐', (await snap(page)).game.served === 3);

  /* ---------- 4. 暂停、失焦、帮助 ---------- */
  console.log('4 暂停与失焦');
  await page.keyboard.press('Escape');
  s = await snap(page);
  check('Esc 暂停', s.game.phase === 'paused' && await visible(page, '#pauseSheet'));
  const frozen = s.game.timeLeft;
  await page.waitForTimeout(500);
  check('暂停期间时间不走', (await snap(page)).game.timeLeft === frozen);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Digit2');
  await page.keyboard.press('KeyF');
  s = await snap(page);
  check('暂停时方向键、数字键、F 都无效', s.game.phase === 'paused' && s.game.timeLeft === frozen && s.game.selectedId === null);
  await page.keyboard.press('Escape');
  check('Esc 继续', (await snap(page)).game.phase === 'playing' && !(await visible(page, '#pauseSheet')));
  await page.waitForTimeout(300);
  s = await snap(page);
  check('继续后不补扣暂停的时间', frozen - s.game.timeLeft < 0.6 && s.game.timeLeft < frozen, frozen - s.game.timeLeft);

  await page.click('#btnPause');
  check('点暂停按钮暂停', (await snap(page)).game.phase === 'paused');
  await page.click('#btnHelpPause');
  check('暂停里打开帮助', await visible(page, '#helpSheet'));
  await page.click('#btnHelpClose');
  check('关闭帮助回到暂停，仍然暂停', await visible(page, '#pauseSheet') && (await snap(page)).game.phase === 'paused');
  await page.click('#btnResume');
  check('点继续营业恢复', (await snap(page)).game.phase === 'playing');

  await page.keyboard.press('KeyH');
  check('营业中按 H 会暂停并打开帮助', (await snap(page)).game.phase === 'paused' && await visible(page, '#helpSheet'));
  await page.click('#btnHelpClose');
  check('关掉帮助后恢复到打开前的营业状态', (await snap(page)).game.phase === 'playing');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  check('窗口失焦自动暂停', (await snap(page)).game.phase === 'paused' && await visible(page, '#pauseSheet'));
  check('暂停牌说明是自动暂停', (await page.textContent('#pauseNote')).includes('自动暂停'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(200);
  check('重新聚焦后仍需手动继续', (await snap(page)).game.phase === 'paused');
  await shot(page, 'e2e-away');
  await page.click('#btnResume');

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check('切出页面自动暂停', (await snap(page)).game.phase === 'paused');
  await page.click('#btnResume');

  await page.keyboard.press('KeyH');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.click('#btnHelpClose');
  check('看帮助时失焦：关闭帮助后停在暂停牌', (await snap(page)).game.phase === 'paused' && await visible(page, '#pauseSheet'));
  await page.click('#btnResume');

  // 空格不触发聚焦按钮
  await page.focus('#btnPause');
  await page.keyboard.press('Space');
  check('营业中空格不会“点击”聚焦的暂停按钮', (await snap(page)).game.phase === 'playing');
  await page.evaluate(() => document.activeElement.blur());

  /* ---------- 5. 小馋鬼、糊锅、超时 ---------- */
  console.log('5 小馋鬼、糊锅、超时');
  s = await snap(page);
  const freshest = s.game.orders.reduce((best, order, index) => (order.patience > s.game.orders[best].patience ? index : best), 0);
  if (s.game.phase === 'playing' && s.game.timeLeft > 8 && s.game.orders[freshest].patience > 8) {
    await prep(page, freshest);
    await page.waitForFunction(() => window.KitchenApp.session.game.state.stats.burned > 0, null, { timeout: 8000 });
    await page.waitForTimeout(150);
    s = await snap(page);
    check('指针走到头糊锅并退回切菜', s.game.stats.burned === 1 && s.game.step === 'chop' && s.game.progress === 0);
    await shot(page, 'e2e-burn');
  } else console.log('  （跳过糊锅检查：剩余时间或订单耐心不够）', s.game.timeLeft, s.game.orders.map((order) => order.patience));

  await page.evaluate(() => {
    const game = window.KitchenApp.session.game;
    for (let i = 0; i < 400 && !game.state.pest && game.state.phase === 'playing'; i++) game.tick(0.1);
  });
  await page.waitForTimeout(450);
  s = await snap(page);
  check('小馋鬼出现后可点击', Boolean(s.game.pest) && await visible(page, '#pestBtn'), s.game.pest);
  check('赶走按钮被点亮', await attr(page, 'pest') === '1');
  await shot(page, 'e2e-pest-' + (s.game.pest ? s.game.pest.kind : 'none'));
  const coinsBefore = s.game.coins;
  await page.keyboard.press('KeyF');
  s = await snap(page);
  check('F 键赶走并奖励 2 金币', s.game.pest === null && s.game.stats.pests === 1 && s.game.coins === coinsBefore + 2);
  await page.waitForTimeout(120);
  check('赶走后热区隐藏', !(await visible(page, '#pestBtn')));
  await page.evaluate(() => {
    const game = window.KitchenApp.session.game;
    for (let i = 0; i < 400 && !game.state.pest && game.state.phase === 'playing'; i++) game.tick(0.1);
  });
  await page.waitForTimeout(450);
  s = await snap(page);
  if (s.game.pest) {
    await shot(page, 'e2e-pest2-' + s.game.pest.kind);
    await page.click('#pestBtn');
    check('点击小馋鬼也能赶走', (await snap(page)).game.stats.pests === 2);
  } else check('第二只小馋鬼出现', false, s.game.timeLeft);

  /* ---------- 6. 打烊、结算、升级 ---------- */
  console.log('6 打烊、结算、升级');
  const earned = (await snap(page)).game.coins;
  await fastForward(page, 95);
  await page.waitForSelector('#billSheet:not([hidden])', { timeout: 6000 });
  s = await snap(page);
  check('打烊后已结算入账', s.profile.summary && s.profile.summary.day === 1 && s.profile.wallet === s.profile.summary.coins, s.profile);
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check('日结单刚弹出时空格和回车不会误点下一天', await visible(page, '#billSheet') && (await snap(page)).profile.day === 1);
  check('收入与当日金币一致', s.profile.summary.coins >= earned);
  check('日结单标题', (await page.textContent('#billTitle')) === '第 1 天打烊');
  check('钱包显示', (await page.textContent('#billWallet')) === s.profile.wallet + ' 金币');
  check('星级印章', await page.locator('#billStars .is-on').count() === s.profile.summary.stars);
  check('三项升级', await page.locator('#shopList .shop-item').count() === 3);
  const firstDaily = { id: s.profile.summary.dailyEntryId, score: s.game.score };
  check('首次结算显示实际得分与单日第一名', s.profile.summary.score === firstDaily.score &&
    (await page.textContent('#billDailyRank')) === scoreAndRank(firstDaily.score, 1) &&
    !(await visible(page, '#billCampaignRank')));
  await page.click('#btnBillLeaderboard');
  let ranked = await currentRank(page);
  check('单日榜只高亮这次结算的记录', await page.getAttribute('#rankDaily', 'aria-pressed') === 'true' &&
    await page.locator('#rankRows tr').count() === 1 && matchesRank(ranked, firstDaily.id, firstDaily.score, 1), ranked);
  await page.click('#btnLeaderboardClose');
  check('从排行榜返回原结算单及入口焦点', await visible(page, '#billSheet') &&
    !(await visible(page, '#leaderboardSheet')) && await focused(page, 'btnBillLeaderboard'));
  await shot(page, 'e2e-bill-day1');
  const walletBefore = s.profile.wallet;
  const patience = page.locator('#shopList [data-key="patience"]');
  if (walletBefore >= 30) {
    check('买得起时按钮可用', await patience.isEnabled());
    await patience.click();
    s = await snap(page);
    check('购买窗边好茶：扣 30 金币并升 1 级', s.profile.wallet === walletBefore - 30 && s.profile.upgrades.patience === 1);
    check('钱包文字同步', (await page.textContent('#billWallet')) === s.profile.wallet + ' 金币');
    check('等级格点亮', await page.locator('#shopList .shop-item:nth-child(2) .pips .is-on').count() === 1);
  } else check('测试前提：第一天至少赚到 30 金币', false, walletBefore);
  const stove = page.locator('#shopList [data-key="stove"]');
  s = await snap(page);
  check('买不起的升级按钮禁用', (await stove.isDisabled()) === (s.profile.wallet < 40));

  // 刷新：保留结算
  await page.reload();
  await page.waitForTimeout(400);
  check('刷新后先显示保存的结算', await visible(page, '#billSheet') && (await page.textContent('#billTitle')) === '第 1 天打烊');
  s = await snap(page);
  check('刷新后钱包和升级还在', s.profile.upgrades.patience === (walletBefore >= 30 ? 1 : 0) && s.profile.day === 1);
  await page.click('#btnBillLeaderboard');
  ranked = await currentRank(page);
  check('刷新后仍保留同一条单日成绩，不重复入榜', await page.locator('#rankRows tr').count() === 1 &&
    matchesRank(ranked, firstDaily.id, firstDaily.score, 1), ranked);
  await page.click('#btnLeaderboardClose');
  await page.click('#btnBillTitle');
  check('回到菜单后木札变成查看结算', (await page.textContent('#startText')) === '查看结算' && await visible(page, '#btnReset'));
  await page.click('#btnStart');
  check('查看结算重新打开日结单', await visible(page, '#billSheet'));
  await page.click('#btnNextDay');
  await page.waitForTimeout(200);
  s = await snap(page);
  check('继续下一天', s.game.phase === 'playing' && s.game.day === 2 && s.profile.day === 2 && s.profile.summary === null);
  check('升级带入第二天', s.game.upgrades.patience === s.profile.upgrades.patience);
  check('HUD 显示第 2 天', (await page.textContent('#hudDay')) === '第 2 天');

  /* ---------- 7. 重新开始今天、退出、营业中刷新 ---------- */
  console.log('7 重新开始与退出');
  await cookOne(page, 0);
  await page.keyboard.press('Escape');
  await page.click('#btnRestartShift');
  check('重新开始今天需要确认', await visible(page, '#confirmSheet'));
  await page.click('#btnConfirmCancel');
  check('取消后回到暂停牌', await visible(page, '#pauseSheet') && (await snap(page)).game.phase === 'paused');
  await page.click('#btnRestartShift');
  await page.click('#btnConfirmOk');
  await page.waitForTimeout(200);
  s = await snap(page);
  check('确认后今天从头开始', s.game.phase === 'playing' && s.game.day === 2 && s.game.served === 0 && s.game.coins === 0 && s.game.timeLeft > 89);
  await page.reload();
  await page.waitForTimeout(400);
  s = await snap(page);
  check('营业中刷新：回到菜单，这一天从头来', await attr(page, 'screen') === 'title' && s.profile.day === 2 && s.profile.summary === null);
  check('木札写着第二天', (await page.textContent('#startNote')) === '第二天');
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  await cookOne(page, 0);
  await page.keyboard.press('Escape');
  await page.click('#btnLeave');
  await page.click('#btnConfirmOk');
  s = await snap(page);
  check('确认回到菜单：放弃未结算收益', await attr(page, 'screen') === 'title' && s.game.phase === 'menu' && s.profile.summary === null);
  const walletDay2 = s.profile.wallet;

  /* ---------- 8. 练习模式 ---------- */
  console.log('8 练习模式');
  await page.click('#btnPractice');
  await page.waitForTimeout(200);
  s = await snap(page);
  check('练习开始', s.game.phase === 'playing' && s.game.practice === true);
  const practiceDayLabel = await page.textContent('#hudDay');
  check('练习 HUD 显示天数、练习标记与 ∞', practiceDayLabel.includes('第 2 天') &&
    practiceDayLabel.includes('练') && (await page.textContent('#hudTime')) === '∞');
  check('订单显示不限时', (await page.locator('.ticket-wait-text').first().textContent()) === '不限时');
  await cookOne(page, 0);
  await fastForward(page, 60);
  await page.waitForTimeout(200);
  s = await snap(page);
  check('练习不计时、没有小馋鬼、订单不超时', s.game.timeLeft === 90 && s.game.pest === null && s.game.missed === 0 && s.game.served === 1);
  await shot(page, 'e2e-practice');
  await page.keyboard.press('Escape');
  check('练习暂停牌用练习的说法', (await page.textContent('#leaveText')) === '结束练习' && (await page.textContent('#resumeText')) === '继续练习');
  await page.click('#btnLeave');
  s = await snap(page);
  check('结束练习直接回菜单且不入账', await attr(page, 'screen') === 'title' && s.profile.wallet === walletDay2 && s.profile.summary === null);
  await page.click('#btnLeaderboard');
  const practiceRankRows = page.locator('#rankRows tr');
  check('练习与放弃的班次都不进入单日榜', await practiceRankRows.count() === 1 &&
    await practiceRankRows.first().getAttribute('data-entry-id') === String(firstDaily.id) &&
    await practiceRankRows.first().locator('td').last().textContent() === points(firstDaily.score) &&
    await page.locator('#rankRows tr[aria-current="true"]').count() === 0);
  await page.click('#rankCampaign');
  check('练习结束后仍无五天总分记录', await visible(page, '#rankEmpty') &&
    await page.locator('#rankRows tr').count() === 0);
  await page.click('#btnLeaderboardClose');

  /* ---------- 9. 五天通关与重开 ---------- */
  console.log('9 五天通关');
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  await finishDay(page, 2);
  const dailyScores = [firstDaily.score, (await snap(page)).game.score];
  check('第二天结算', (await page.textContent('#billTitle')) === '第 2 天打烊' && (await page.textContent('#btnNextDay')) === '开始第 3 天');
  for (const day of [3, 4, 5]) {
    await page.click('#btnNextDay');
    s = await snap(page);
    check('进入第 ' + day + ' 天并解锁菜单',
      s.game.day === day && s.profile.day === day && s.game.phase === 'playing' &&
      s.game.availableRecipeIds.length === day * 2 && s.game.availableRecipeIds.includes('curry'));
    await finishDay(page, 2);
    s = await snap(page);
    dailyScores.push(s.game.score);
    if (day < 5) {
      check('第 ' + day + ' 天结算后还能继续',
        s.profile.summary.day === day && !s.profile.completed &&
        (await page.textContent('#billTitle')) === '第 ' + day + ' 天打烊' &&
        (await page.textContent('#btnNextDay')) === '开始第 ' + (day + 1) + ' 天');
    }
  }
  s = await snap(page);
  check('第五天结算后通关', s.profile.completed === true && s.profile.day === 5 && s.profile.summary.day === 5);
  check('通关日结单', (await page.textContent('#billTitle')) === '五天营业圆满结束' && !(await visible(page, '#btnNextDay')) && await visible(page, '#btnBillRestart') && await visible(page, '#finale') && !(await visible(page, '#shop')));
  const campaignTotal = dailyScores.reduce((total, score) => total + score, 0);
  const campaignId = s.profile.summary.campaignEntryId;
  const finalDailyId = s.profile.summary.dailyEntryId;
  const finalDailyScore = dailyScores[4];
  const finalDailyRank = 1 + dailyScores.filter(score => score > finalDailyScore).length;
  const finalDailyRankText = await page.textContent('#billDailyRank');
  check('通关结算显示五天实际得分之和及第一名', await visible(page, '#billCampaignRank') &&
    (await page.textContent('#billCampaignRank')) === scoreAndRank(campaignTotal, 1));
  await page.click('#btnBillLeaderboard');
  ranked = await currentRank(page);
  check('通关结算默认打开总分榜并标记本局', await page.getAttribute('#rankCampaign', 'aria-pressed') === 'true' &&
    await focused(page, 'rankCampaign') && await page.locator('#rankRows tr').count() === 1 &&
    matchesRank(ranked, campaignId, campaignTotal, 1), ranked);
  await page.click('#rankDaily');
  ranked = await currentRank(page);
  const sortedDailyPoints = await page.locator('#rankRows tr td:last-child').allTextContents();
  check('五条单日成绩按得分排序，只有第五天的结算行标为本局',
    JSON.stringify(sortedDailyPoints) === JSON.stringify(dailyScores.slice().sort((a, b) => b - a).map(points)) &&
    matchesRank(ranked, finalDailyId, finalDailyScore, finalDailyRank) &&
    finalDailyRankText === scoreAndRank(finalDailyScore, finalDailyRank), { ranked, sortedDailyPoints });
  await page.click('#btnLeaderboardClose');
  await page.reload();
  await page.waitForSelector('#billSheet:not([hidden])');
  await page.click('#btnBillLeaderboard');
  ranked = await currentRank(page);
  check('刷新后保留同一条五天总分记录', await page.locator('#rankRows tr').count() === 1 &&
    matchesRank(ranked, campaignId, campaignTotal, 1), ranked);
  await page.click('#btnLeaderboardClose');
  await shot(page, 'e2e-bill-final');
  const records = { bestScore: s.profile.bestScore, bestCombo: s.profile.bestCombo, totalServed: s.profile.totalServed };
  await page.click('#btnBillTitle');
  check('通关后菜单木札', (await page.textContent('#startText')) === '查看结算' && (await page.textContent('#startNote')) === '五天圆满');
  await shot(page, 'e2e-title-done');
  await page.click('#btnStart');
  await page.click('#btnBillRestart');
  await page.waitForTimeout(200);
  s = await snap(page);
  check('重开五天后从第一天营业，历史记录保留', s.game.phase === 'playing' && s.game.day === 1 &&
    s.profile.wallet === 0 && s.profile.upgrades.patience === 0 && records.bestScore > 0 &&
    Object.entries(records).every(([key, value]) => s.profile[key] === value));
  await page.keyboard.press('Escape');
  await page.click('#btnLeave');
  await page.click('#btnConfirmOk');

  // 菜单里的重新开始（清空五天进度）
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  await finishDay(page, 1);
  await page.click('#btnBillTitle');
  check('有进度时菜单出现重新开始', await visible(page, '#btnReset'));
  await page.click('#btnReset');
  check('清空进度需要确认', await visible(page, '#confirmSheet'));
  await page.click('#btnConfirmOk');
  s = await snap(page);
  check('确认后清空钱包与结算', s.profile.wallet === 0 && s.profile.summary === null && s.profile.day === 1 && (await page.textContent('#startText')) === '开店营业');
  check('控制台没有报错', problems.length === 0, problems);
  await context.close();

  /* ---------- 10. 本地存储不可用 ---------- */
  console.log('10 存储不可用');
  ({ context, page, problems } = await open(browser, {
    init: () => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage disabled'); } });
    }
  }));
  s = await snap(page);
  check('存储被禁用时仍能启动', s.storageAvailable === false && await visible(page, '#btnStart'));
  check('提示本次进度不保留', await visible(page, '#storageNote'));
  await shot(page, 'e2e-nostorage');
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  await cookOne(page, 0);
  check('存储被禁用时仍可做菜', (await snap(page)).game.served === 1);
  await fastForward(page, 95);
  await page.waitForSelector('#billSheet:not([hidden])', { timeout: 6000 });
  check('日结单同样提示', await visible(page, '#billStorageNote'));
  check('存储不可用时控制台没有报错', problems.length === 0, problems);
  await context.close();

  /* ---------- 11. 触屏与窄屏 ---------- */
  console.log('11 触屏与窄屏');
  for (const viewport of [{ width: 390, height: 760 }, { width: 360, height: 640 }, { width: 320, height: 568 }]) {
    const label = viewport.width + '×' + viewport.height;
    ({ context, page, problems } = await open(browser, { viewport, touch: true }));
    await shot(page, 'e2e-m' + viewport.width + '-title');
    check(label + ' 标题无横向溢出', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check(label + ' 菜单木札都在屏幕内', await page.evaluate(() => Array.from(document.querySelectorAll('#titleTags .tag:not([hidden])')).every((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;
    })));
    await page.tap('#btnStart');
    await page.waitForTimeout(250);
    check(label + ' 营业画面无横向溢出', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.getElementById('play').scrollWidth <= window.innerWidth));
    const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('#pad .key, #btnPause, #btnHelpHud, #btnSoundHud, .ticket-btn')).map((node) => {
      const box = node.getBoundingClientRect();
      return { id: node.id || node.dataset.dir || node.className, left: box.left, right: box.right, top: box.top, bottom: box.bottom, w: box.width, h: box.height };
    }));
    check(label + ' 所有操作按钮都在屏幕内', boxes.every((box) => box.left >= 0 && box.right <= viewport.width + 0.5 && box.top >= 0 && box.bottom <= viewport.height + 0.5), boxes.filter((box) => !(box.left >= 0 && box.right <= viewport.width + 0.5 && box.top >= 0 && box.bottom <= viewport.height + 0.5)));
    check(label + ' 方向与出餐按钮够大', boxes.filter((box) => /^(up|down|left|right|btnAction|btnShoo)$/.test(box.id)).every((box) => box.w >= 44 && box.h >= 44), boxes.filter((box) => /^(up|down|left|right|btnAction|btnShoo)$/.test(box.id)));
    await page.tap('.ticket:nth-child(1) .ticket-btn');
    s = await snap(page);
    check(label + ' 点按订单选单', s.game.step === 'chop');
    for (const direction of s.game.sequence) await page.tap('.key[data-dir="' + direction + '"]');
    check(label + ' 点按方向键切菜', (await snap(page)).game.step === 'cook');
    await shot(page, 'e2e-m' + viewport.width + '-cook');
    await waitHeat(page, 0.5);
    await page.tap('#btnAction');
    s = await snap(page);
    check(label + ' 点按一次只出锅', s.game.step === 'ready' && s.game.served === 0, { step: s.game.step, served: s.game.served });
    await page.tap('#btnAction');
    check(label + ' 再点按出餐', (await snap(page)).game.served === 1);
    await page.evaluate(() => {
      const game = window.KitchenApp.session.game;
      for (let i = 0; i < 400 && !game.state.pest && game.state.phase === 'playing'; i++) game.tick(0.1);
    });
    await page.waitForTimeout(400);
    await page.tap('#btnShoo');
    check(label + ' 点按赶走', (await snap(page)).game.stats.pests === 1);
    await page.tap('#btnPause');
    check(label + ' 点按暂停', (await snap(page)).game.phase === 'paused');
    await shot(page, 'e2e-m' + viewport.width + '-pause');
    check(label + ' 暂停木札都在屏幕内', await page.evaluate(() => Array.from(document.querySelectorAll('#pauseSheet .tag')).every((node) => {
      const box = node.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth;
    })));
    await page.tap('#btnResume');
    await fastForward(page, 95);
    await page.waitForSelector('#billSheet:not([hidden])', { timeout: 6000 });
    await shot(page, 'e2e-m' + viewport.width + '-bill');
    check(label + ' 日结单按钮可见', await page.evaluate(() => {
      const box = document.getElementById('btnNextDay').getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    }));
    await page.tap('#btnBillLeaderboard');
    s = await snap(page);
    ranked = await currentRank(page);
    check(label + ' 可点按打开单日榜并看到本局成绩', await visible(page, '#leaderboardSheet') &&
      matchesRank(ranked, s.profile.summary.dailyEntryId, s.profile.summary.score, 1), ranked);
    check(label + ' 排行榜面板和表格无横向溢出', await page.evaluate(() => {
      const sheet = document.getElementById('leaderboardSheet');
      const table = document.getElementById('rankTable').getBoundingClientRect();
      return document.documentElement.scrollWidth <= window.innerWidth &&
        sheet.scrollWidth <= sheet.clientWidth + 1 && table.left >= 0 && table.right <= window.innerWidth + 0.5;
    }));
    await page.tap('#rankCampaign');
    check(label + ' 可点按切换到五天总分榜', await page.getAttribute('#rankCampaign', 'aria-pressed') === 'true' &&
      await visible(page, '#rankEmpty'));
    await page.tap('#btnLeaderboardClose');
    check(label + ' 可点按返回日结单', await visible(page, '#billSheet') && !(await visible(page, '#leaderboardSheet')));
    await page.tap('#btnNextDay');
    await page.waitForTimeout(200);
    check(label + ' 点按继续下一天', (await snap(page)).game.day === 2);
    const potControls = page.locator('#dualPots [data-pot]');
    check(label + ' 两口灶的触屏控件可见', await potControls.count() === 2 &&
      await potControls.first().isVisible() && await potControls.last().isVisible());
    check(label + ' 双灶面板无横向溢出', await page.evaluate(() => {
      const panel = document.getElementById('dualPots');
      return document.documentElement.scrollWidth <= window.innerWidth &&
        document.getElementById('play').scrollWidth <= window.innerWidth &&
        panel.scrollWidth <= panel.clientWidth + 1 &&
        Array.from(panel.querySelectorAll('[data-pot]')).every((button) => {
          const box = button.getBoundingClientRect();
          return box.left >= 0 && box.right <= window.innerWidth + 0.5 && box.width >= 44 && box.height >= 44;
        });
    }));
    await page.tap('.ticket:nth-child(1) .ticket-btn');
    for (const direction of (await snap(page)).game.sequence) await page.tap('.key[data-dir="' + direction + '"]');
    await finishPot(page, 0, true);
    check(label + ' 点按左灶出锅', (await snap(page)).game.step === 'ready');
    await page.tap('#btnAction');
    check(label + ' 双灶日也能触屏出餐', (await snap(page)).game.served === 1);
    check(label + ' 控制台没有报错', problems.length === 0, problems);
    await context.close();
  }

  /* ---------- 12. 减少动态效果 ---------- */
  console.log('12 减少动态效果');
  ({ context, page, problems } = await open(browser, { reducedMotion: 'reduce' }));
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  await cookOne(page, 0);
  check('减少动态效果下仍能正常出餐', (await snap(page)).game.served === 1 && problems.length === 0, problems);
  await context.close();

  /* ---------- 13. 长按方向键、选中订单超时 ---------- */
  console.log('13 长按方向键与选中订单超时');
  ({ context, page, problems } = await open(browser));
  await page.click('#btnStart');
  await page.waitForTimeout(200);
  await page.keyboard.press('Digit1');
  s = await snap(page);
  const firstKey = KEY[s.game.sequence[0]];
  await page.keyboard.down(firstKey);
  await page.keyboard.down(firstKey); // 长按产生的重复事件：如果被算进去，第二下就是切错，进度会归零
  await page.keyboard.down(firstKey);
  await page.keyboard.up(firstKey);
  s = await snap(page);
  check('长按方向键只算一刀', s.game.progress === 1 && s.game.step === 'chop', { progress: s.game.progress, step: s.game.step });
  const selectedBefore = s.game.selectedId;
  const missedBefore = s.game.missed;
  await fastForward(page, s.game.orders[0].patience + 0.5);
  await page.waitForTimeout(200);
  s = await snap(page);
  check('选中的订单超时后回到选单', s.game.phase === 'playing' && s.game.selectedId === null && s.game.step === 'select' && s.game.missed > missedBefore, { step: s.game.step, selectedId: s.game.selectedId, missed: s.game.missed });
  check('超时的订单票已撤下并补齐三张', await page.locator('.ticket').count() === 3 && await page.locator('.ticket[data-id="' + selectedBefore + '"]').count() === 0);
  check('操作栏没有卡在切菜', await attr(page, 'step') === 'select' && await visible(page, '#cuePick') && !(await visible(page, '#cueChop')) && await page.locator('.ticket.is-selected').count() === 0);
  await page.keyboard.press('Digit1');
  s = await snap(page);
  check('超时之后还能接着选单做菜', s.game.step === 'chop' && s.game.selectedId === s.game.orders[0].id && s.game.progress === 0);
  check('这一段控制台没有报错', problems.length === 0, problems);
  await context.close();

  /* ---------- 14. 练习日、菜谱、双灶 ---------- */
  console.log('14 练习日、菜谱与双灶');
  ({ context, page, problems } = await open(browser));
  const recipeItems = page.locator('#recipeSheet #recipeList [data-recipe]');
  await page.click('#btnHelp');
  await page.click('#helpRecipeBook');
  const bookIds = await recipeItems.evaluateAll(items => items.map(item => item.dataset.recipe));
  check('标题菜谱列出十道不同的菜', await visible(page, '#recipeSheet') &&
    bookIds.length === 10 && new Set(bookIds).size === 10 &&
    bookIds.includes('onigiri') && bookIds.includes('mochi'), bookIds);
  await page.click('#btnRecipeClose');
  await page.click('#btnHelpClose');
  await page.click('#btnPracticeDays');
  check('练习菜单可选全部五天', await visible(page, '#practiceSheet') &&
    await page.locator('#practiceOptions [data-practice-day]').count() === 5);
  await page.click('[data-practice-day="2"]');
  s = await snap(page);
  check('可直接练习第二天，正式进度仍为第一天',
    s.game.practice && s.game.day === 2 && s.profile.day === 1 && s.profile.wallet === 0);
  const [leftOrder, rightOrder] = s.game.orders;
  await prep(page, 0);
  await fastForward(page, 0.35);
  await prep(page, 1);
  await page.waitForFunction(() => {
    const [left, right] = window.KitchenApp.session.game.state.pots;
    return left && right && right.heat > 0;
  }, null, { polling: 'raf', timeout: 8000 });
  s = await snap(page);
  check('切下一道菜时左锅持续加热，两锅并行',
    s.game.pots[0]?.orderId === leftOrder.id && s.game.pots[1]?.orderId === rightOrder.id &&
    s.game.pots[0].heat > s.game.pots[1].heat, s.game.pots);
  const needles = await page.locator('#dualPots [data-pot] .heat-needle').evaluateAll(nodes =>
    nodes.map(node => parseFloat(node.style.left))
  );
  check('两口锅各有独立的火候指针', needles.length === 2 && needles[0] > needles[1] && needles[1] > 0, needles);
  check('双灶时只显示两口锅各自的火候条', !(await visible(page, '#cueHeat')));
  await shot(page, 'e2e-dual-pots');
  await finishPot(page, 0);
  s = await snap(page);
  check('左锅出锅后右锅继续加热', s.game.pots[0] === null && s.game.pots[1]?.orderId === rightOrder.id && s.game.served === 0, s.game.pots);
  await finishPot(page, 1);
  await page.click('.ticket[data-id="' + rightOrder.id + '"] .ticket-btn');
  await page.click('#btnAction');
  await page.click('.ticket[data-id="' + leftOrder.id + '"] .ticket-btn');
  await page.click('#btnAction');
  check('两口锅可分别出锅，再分别出餐', (await snap(page)).game.served === 2);
  await leavePractice(page);

  /* ---------- 15. 双拼与保温 ---------- */
  console.log('15 双拼出餐');
  await startPracticeDay(page, 3);
  const combo = (await snap(page)).game.orders.find(order => order.kind === 'combo');
  await page.click('.ticket[data-id="' + combo.id + '"] .ticket-btn');
  await page.click('#comboDishes [data-dish="0"]');
  await chopCurrent(page);
  await finishSelectedPot(page);
  await page.keyboard.press('Space');
  s = await snap(page);
  const halfReady = s.game.orders.find(order => order.id === combo.id);
  check('双拼只有一道完成时不能出餐', s.game.served === 0 && s.game.coins === 0 &&
    halfReady?.dishes[0].status === 'ready' && halfReady.dishes[1].status !== 'ready');
  await page.click('#comboDishes [data-dish="1"]');
  await chopCurrent(page);
  await finishSelectedPot(page);
  s = await snap(page);
  const warmSet = s.game.orders.find(order => order.id === combo.id);
  check('双拼两道菜均完成且仍然热着', warmSet?.dishes.length === 2 &&
    warmSet.dishes.every(dish => dish.status === 'ready' && dish.warmth > 0));
  await shot(page, 'e2e-combo-ready');
  await page.focus('#comboDishes [data-dish="1"]');
  await page.keyboard.press('Space');
  s = await snap(page);
  check('焦点在双拼菜名时按空格一起送出并记作两道菜', s.game.served === 2 && s.game.stats.sets === 1 &&
    !s.game.orders.some(order => order.id === combo.id));
  await leavePractice(page);

  /* ---------- 16. 口味、米饭、麻雀 ---------- */
  console.log('16 口味、米饭、麻雀');
  await startPracticeDay(page, 4);
  const taste = (await snap(page)).game.orders.find(order => order.kind === 'taste');
  await page.click('.ticket[data-id="' + taste.id + '"] .ticket-btn');
  await page.click('#openRecipeBook');
  check('第四天菜谱显示八道已解锁的菜', await visible(page, '#recipeSheet') && await recipeItems.count() === 8);
  await page.click('#btnRecipeClose');
  const matching = await page.evaluate((request) => {
    const menu = window.KitchenMenu;
    return menu.recipesForDay(4).find(recipe => menu.matchesTaste(recipe, request));
  }, taste.taste);
  await page.selectOption('#tasteIngredient', matching.ingredient);
  await page.selectOption('#tasteMethod', matching.method);
  await page.click('#confirmTaste');
  s = await snap(page);
  check('选择食材和做法后开始制作匹配的菜', s.game.step === 'chop' && s.game.recipeId === matching.id);
  await chopCurrent(page);
  await finishSelectedPot(page);
  await page.click('#btnAction');
  s = await snap(page);
  check('口味单可以完整出餐', s.game.stats.tastes === 1 && s.game.served === 1 &&
    !s.game.orders.some(order => order.id === taste.id));

  const riceBefore = s.game.rice;
  const riceLabel = await page.textContent('#riceCount');
  await page.click('#feedPest');
  await page.waitForSelector('#helperNote:not([hidden])');
  s = await snap(page);
  check('喂麻雀用掉一份米饭，柜台显示帮手', s.game.rice === riceBefore - 1 &&
    s.game.pest === null && s.game.helper?.kind === 'sparrow' && (await page.textContent('#riceCount')) !== riceLabel);
  const helpedOrder = s.game.orders[0];
  await prep(page, 0);
  await finishSelectedPot(page);
  await page.waitForSelector('#helperNote', { state: 'hidden' });
  s = await snap(page);
  check('麻雀自动送出下一道菜且只帮一次', s.game.served === 2 && s.game.stats.assists === 1 &&
    s.game.helper === null && !s.game.orders.some(order => order.id === helpedOrder.id));
  await leavePractice(page);

  /* ---------- 17. 便当 ---------- */
  console.log('17 便当');
  await startPracticeDay(page, 5);
  s = await snap(page);
  check('可直接练习第五天，正式进度未改动', s.game.practice && s.game.day === 5 && s.profile.day === 1);
  const bento = s.game.orders.find(order => order.kind === 'bento');
  await prep(page, s.game.orders.indexOf(bento));
  await finishSelectedPot(page);
  await page.waitForSelector('#bentoPanel:not([hidden])');
  const serveBento = page.locator('#serveBento');
  const dessertCell = page.locator('#bentoGrid [data-x="3"][data-y="2"]');
  await page.click('#bentoPieces [data-piece="rice"]');
  // 竖着把米饭摆在最右列，会占用右下角的甜点格。
  await page.click('#bentoGrid [data-x="3"][data-y="0"]');
  check('甜点保留格禁止摆菜，未填满时也不能出餐',
    await dessertCell.isDisabled() && await dessertCell.getAttribute('data-reserved') === 'true' &&
    await serveBento.isDisabled() && (await snap(page)).game.orders.find(order => order.id === bento.id).bento.placements.length === 0);
  const bentoSolution = [
    ['main', 0, 0, 1], ['greens', 2, 0, 2], ['carrot', 0, 1, 0], ['rice', 0, 2, 1]
  ];
  for (const [piece, x, y, turns] of bentoSolution) {
    await page.click('#bentoPieces [data-piece="' + piece + '"]');
    for (let turn = 0; turn < turns; turn++) await page.click('#rotateBento');
    await page.click('#bentoGrid [data-x="' + x + '"][data-y="' + y + '"]');
  }
  s = await snap(page);
  const packed = s.game.orders.find(order => order.id === bento.id).bento;
  check('旋转摆好四份菜后可以出餐', packed.complete && packed.placements.length === 4 &&
    s.game.step === 'ready' && await serveBento.isEnabled());
  check('便当工作台下方的提示和出餐按钮未被裁切', await page.evaluate(() => {
    const workbench = document.querySelector('#workbench').getBoundingClientRect();
    return ['#feedback', '#btnAction'].every(selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return box.top >= workbench.bottom && box.bottom <= window.innerHeight + 1;
    });
  }));
  await shot(page, 'e2e-bento-ready');
  await serveBento.click();
  s = await snap(page);
  check('完成便当出餐，练习不写入收入', s.game.stats.bentos === 1 && s.game.served === 1 &&
    s.profile.wallet === 0 && !s.game.orders.some(order => order.id === bento.id));
  check('新玩法控制台没有报错', problems.length === 0, problems);
  await context.close();

  /* ---------- 18. 窄屏便当触控 ---------- */
  console.log('18 窄屏便当触控');
  ({ context, page, problems } = await open(browser, { viewport: { width: 320, height: 568 }, touch: true }));
  await page.tap('#btnPracticeDays');
  await page.tap('[data-practice-day="5"]');
  await page.tap('.ticket:nth-child(3) .ticket-btn');
  for (const direction of (await snap(page)).game.sequence) await page.tap('.key[data-dir="' + direction + '"]');
  await finishPot(page, 0, true);
  await page.waitForSelector('#bentoPanel:not([hidden])');
  check('320px 宽度的便当界面无横向溢出', await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth && document.getElementById('play').scrollWidth <= innerWidth));
  for (const [piece, x, y, turns] of bentoSolution) {
    await page.tap('#bentoPieces [data-piece="' + piece + '"]');
    for (let turn = 0; turn < turns; turn++) await page.tap('#rotateBento');
    await page.tap('#bentoGrid [data-x="' + x + '"][data-y="' + y + '"]');
  }
  await page.tap('#serveBento');
  check('窄屏可以全程点按完成便当', (await snap(page)).game.stats.bentos === 1 && problems.length === 0, problems);
  await context.close();

  await browser.close();
  console.log('\n通过 ' + passed + ' 项，失败 ' + failures.length + ' 项');
  if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
})().catch((error) => { console.error(error); process.exit(1); });
