# 小满食堂后端接口

游戏规则和存档在浏览器本地运行。五天经营仍使用原有的 v1 存档键。

## 加载与初始化

使用经典脚本，允许 `file://` 直接打开：

```html
<script src="menu.js"></script>
<script src="engine.js"></script>
<script src="session.js"></script>
<script src="art.js"></script>
<script src="sfx.js"></script>
<script src="stage.js"></script>
<script src="game.js"></script>
```

```js
const session = KitchenSession.createSession();
const game = session.game;
// 如有 session.profile.summary，先显示保存的结算界面。
// 否则显示主菜单，点击开店后调用：
const result = session.startDay();
if (!result.ok) console.log(result.reason);
```

`createSession({storage, random})` 可注入 Storage 兼容对象和随机函数。省略 storage 使用浏览器 localStorage；传 null 为纯内存模式。无网络调用，无运行时依赖。

## 分工和边界

- 前端只读 `game.state`；所有游戏变化通过方法调用。
- 使用 session 的 `startDay/startPractice/nextDay` 启动，不直接调用 `game.start`。
- 钱包、升级、跨天、记录只通过 session 方法修改。
- 引擎不处理 DOM、按键事件、真实时钟、音频、窗口可见性或绘制；前端负责这些适配。
- `session.profile` 返回独立副本，可缓存渲染，不可通过修改副本保存状态。
- `game.state` 对象引用保持稳定；内部数组、feedback、stats 等可能被替换，不缓存其引用。

## Session API

更改游戏状态的操作返回 `{ok:true,...}` 或 `{ok:false,reason:string}`，`save()` 返回布尔值。失败不扣钱、不推进日期、不重启游戏。前端将 reason 映射为中文提示。

| 方法或属性 | 行为 |
| --- | --- |
| `session.game` | 本节以下的引擎实例 |
| `session.profile` | 当前存档副本 |
| `session.storageAvailable` | 能否使用持久存储；写入失败后变为 false，内存游戏继续 |
| `session.startDay()` | 从菜单开始 profile.day 的 90 秒营业；有待处理结算或已通关则拒绝 |
| `session.startPractice(day = profile.day)` | 选择第 1 至 5 天练习。不计营业时间、订单耐心和存档收益。第 4、5 天提供一只练习喂食的麻雀 |
| `session.settleDay()` | 仅正式营业 summary 时入账并保存；重复调用不重复发钱；返回 `{ok,alreadySettled,summary}` |
| `session.getLeaderboard(kind = 'daily')` | 返回本机单日榜或 `campaign` 五天总分榜的独立 `{id,day,score,served,rank}` 记录。同分并列，先结算的记录先显示 |
| `session.getLeaderboardSubmissionId(kind, id)` | 返回记录持久保存的共享提交 UUID。旧记录、未知 ID 或无加密随机源时返回 null |
| `session.getUpgradeOffer(key)` | 返回升级报价；未知 key 返回 null |
| `session.buyUpgrade(key)` | 结算时购买；返回 `{ok:true,cost,offer}`；每类最多 3 级 |
| `session.nextDay()` | 结算后推进一天并立即开始营业，第五天后结束 |
| `session.leave()` | 退出至菜单，放弃尚未结算的营业收益；不清除已保存结算和钱包 |
| `session.restartCampaign()` | 非营业/暂停状态下重置日期、钱包、升级；保留历史记录与声音偏好，返回菜单 |
| `session.setSound(boolean)` | 保存声音偏好；音频播放由前端完成 |
| `session.save()` | 将当前 profile 写入唯一存档键；返回是否成功 |
| `session.snapshot()` | `{profile,game,storageAvailable}` 的独立副本，调试和测试使用 |

`startDay/startPractice/nextDay` 成功还返回 `state`，即 `game.state`。活跃或暂停的营业不允许通过重复点击按钮重开，必须先显式 leave。

常见 reason：`busy`（游戏仍在进行）、`unsettled-shift`（刚结束的营业先结算，或显式退出放弃收益）、`campaign-complete`（五天已完成）、`settlement-pending`（先处理已保存结算）、`not-finished`（还未到结算）、`practice`（练习不入账）、`invalid-day`（练习日超出 1 至 5）、`unknown-upgrade`、`not-in-settlement`、`max-level`、`insufficient-coins`、`invalid-sound`。

## Profile 和结算

```js
{
  version: 1,
  day: 1, // 1..5
  wallet: 0, // 跨天可用余额；与 game.state.coins 不同
  upgrades: { stove: 0, patience: 0, charm: 0 }, // 每类 0..3
  bestScore: 0, // 历史单日最高分
  bestCombo: 0, // 历史最高连续成功出餐数
  totalServed: 0, // 历史正式营业出餐数，重开经营仍保留
  completed: false,
  sound: true,
  summary: null // 或下面的结算对象
}
```

结算对象为 `{day,score,coins,served,missed,bestCombo,stars,stats,dailyEntryId,campaignEntryId}`。`stats` 记录 `perfect,burned,pests,assists,sets,tastes,bentos,cold`。星级按当日出菜数计，0 道为 0 星，1 至 4 道为 1 星，5 至 9 道为 2 星，10 道起为 3 星。钱包在 `settleDay()` 时增加当日收益。排行榜 ID 可为 null。已有第三天结算的旧存档可以继续第四天，从新结算起积累单日排名。

刷新页面后保留已完成营业、结算购物和设置。营业中的进度不恢复；该天从头开始，未结算收益不入账。存档键固定为 `xiaoman-kitchen:v1`，不读取、不清除其他站点存储。无效 JSON/未知版本重置为可玩默认值；存储被禁用、配额不足或 file 协议限制时自动降级内存模式。

### 结算流程

```js
if (game.state.phase === 'summary') {
  const result = session.settleDay(); // 可多次调用，不会重复入账
  if (result.ok) renderSummary(result.summary, session.profile);
}
// 购买按钮：
const offer = session.getUpgradeOffer('stove');
// {key,name,description,level,maxed,nextCost,canBuy}
// maxed 时 nextCost 为 null。
// 按钮是否可用取 canBuy，最终仍检查 buyUpgrade 的结果。
session.buyUpgrade('stove');
// 次日按钮：
session.nextDay();
// 通关后重新开店：
session.restartCampaign();
session.startDay();
```

升级常量：`KitchenSession.UPGRADE_DEFS`。

| key | 名称 | 各级价格 | 效果 |
| --- | --- | --- | --- |
| stove | 铸铁小灶 | 40 / 70 / 110 | 火候扫动时长每级 +0.45 秒 |
| patience | 窗边好茶 | 30 / 55 / 90 | 订单初始耐心每级 +6 秒 |
| charm | 招财小猫 | 35 / 60 / 100 | 每道菜每级 +2 金币 |

## Game API

| 方法 | 行为 |
| --- | --- |
| `game.selectOrder(id, dishIndex?)` | 选订单，可指定从零开始的套餐菜序号。第 2 天起可在锅计时期间切换订单 |
| `game.selectDish(index)` | 选择当前套餐的一道菜 |
| `game.chooseTaste(ingredient, method)` | 提交选中的食材和做法，符合当前口味才开始切菜 |
| `game.input(direction)` | `up/down/left/right`，仅 chop 阶段生效 |
| `game.action()` | waiting 时尝试下锅，cook 时尝试出当前锅，ready 时尝试出餐。未做完的套餐可继续选菜 |
| `game.finishPot(index)` | 独立出第 `index` 口锅，序号从零开始 |
| `game.placeBento(pieceId, x, y, rotation)` | 旋转和摆放便当组件，坐标从零开始，旋转为顺时针四分之一圈数 |
| `game.removeBento(pieceId)` / `game.resetBento()` | 移除一个组件或重摆便当 |
| `game.feedPest()` | 用一份米雇当前麻雀。它会自动送出下一张做完的订单 |
| `game.shoo()` | 驱赶当前动物，奖励一次 |
| `game.tick(seconds)` | 推进秒数；仅 playing 生效，忽略非有限值、0 和负数 |
| `game.pause()` / `game.resume()` | playing 与 paused 互换 |
| `game.quit()` | 引擎底层退出；前端使用 session.leave 以同步结算状态 |

`game.start({day,practice,upgrades})` 是引擎底层方法，session 内部调用。

### State

```js
{
  phase: 'menu', // menu | playing | paused | summary
  day: 1,
  practice: false,
  timeLeft: 90, // 练习保持 90；界面依据 practice 显示“∞”
  coins: 0, score: 0, served: 0, missed: 0,
  combo: 0, bestCombo: 0,
  orders: [], // {id,kind,recipeId,patience,maxPatience,dishes,taste,bento}
  selectedId: null,
  selectedDish: null, recipeId: null,
  step: 'select', // select | taste | chop | waiting | cook | bento | ready
  sequence: [], // direction 字符串数组
  progress: 0, // 已完成切菜数，0..sequence.length
  heat: 0, // 0..1，从左到右单向扫动
  grade: null, // null | good | perfect
  pest: null, // 或 {remaining:秒数, kind:'sparrow'|'tanuki'}
  helper: null, // 或 {kind:'sparrow'}
  pots: [], // 每口锅为 null 或 {orderId,dishIndex,recipeId,heat}
  availableRecipeIds: [],
  rice: null, riceCapacity: 0, riceRefill: 0,
  feedback: {text:'欢迎来到小满食堂',tone:'info',id:0},
  stats: {perfect:0,burned:0,pests:0,assists:0,sets:0,tastes:0,bentos:0,cold:0},
  upgrades: {stove:0,patience:0,charm:0}
}
```

耐心进度条使用 `patience / maxPatience`，永远读取实时订单。id 跨天递增，不是数组下标；1/2/3 快捷键先从当前 orders 取对应 id。选中订单过期会清除准备并回到 select，新单自动补齐至三张。

`kind` 为 `single`、`combo`、`taste` 或 `bento`。`dishes` 每项有 `{recipeId,status,progress,heat,grade,warmth,maxWarmth}`。烹饪状态按 `chop`、`waiting`、`cook`、`ready` 推进。套餐菜出锅后保温 14 秒，凉了回到备菜。便当保存 `{placements,complete}`，填好才能出餐。

第 4 天起米饭上限 3 份，做含米饭的菜和喂麻雀各花 1 份，缺米时每 16 秒补 1 份。`riceRefill` 是距下一份米的秒数，库存满时为零。

feedback.id 每条消息递增，只在变化时播报/弹字；tone 为 info/success/warning/error。前端 `aria-live` 不应逐帧重读同一条反馈。

### 火候和分数

- 完整火候扫动：`2.8 + stove * 0.45` 秒；heat 在 `[0.42,0.72]` 为成功，`[0.52,0.62]` 为完美，区间端点包含。
- 过早/过晚按键会提示，可继续当前锅；heat 到 1 会糊锅并重做当前菜。
- 出餐后补新订单。`combo` 记录连续完成的订单数，`served` 记录已出菜数。套餐出餐一次记两道菜。
- 每道菜按菜价、火候和升级计算收益。订单完成时发放连击奖励。
- 误切 -5、错误控火 -8、糊锅 -15、超时 -25，最低 0 分，并中断连击。
- 捣乱出现间隔 12..20 秒，5 秒内驱赶奖励 2 金币/10 分，否则订单额外损失 8 秒耐心。

### 菜谱

`KitchenMenu.RECIPES` 和 `KitchenEngine.RECIPES` 提供同一份冻结菜谱。每项为 `{id,name,price,sequence,color,day,ingredient,method,tags,usesRice}`，每天解锁两项。用 `recipesForDay(day)` 取已解锁菜品，用 `findRecipe(ingredient, method, day)` 查配方，用 `matchesTaste(recipe, taste)` 检查口味。

`KitchenMenu.BENTO` 定义 4×3 便当盒、甜点格和四个拼块。`bentoCells(pieceId, rotation)` 返回旋转后的相对坐标。前端用 `game.placeBento()` 提交摆放，规则层检查边界、碰撞和甜点预留。

## 前端时钟、输入和生命周期

```js
let last = performance.now();
function frame(now) {
  const elapsed = (now - last) / 1000;
  last = now;
  game.tick(elapsed);
  render(game.state);
  requestAnimationFrame(frame);
}
window.addEventListener('blur', () => game.pause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
  last = performance.now();
});
// 玩家点击继续：重置 last，再 game.resume()。
// keydown：忽略 event.repeat；拦截方向键和空格默认行为。
```

不要用 setInterval 独立推进另一套火候或订单计时。键盘/触摸使用相同方法。暂停冻结营业、火候、订单和动物。帮助弹层打开时暂停，关闭时是否继续取决于打开前状态。

## 已提供美术

- `assets/kitchen.png`：1536×1024 原创像素厨房背景，本地 PNG。
- `assets/art-prompt.md`：完整提示词和内置 imagegen 来源。
- `art.js`：可选 Canvas 动态素材，全局 `KitchenArt`。所有位置为左上角，time 为毫秒。
- `drawDish(ctx,id,x,y,size=64)`：菜品图标，size 方形。
- `drawChef(ctx,x,y,scale=1,time=0,mood='idle')`：100×140 缩放。
- `drawPest(ctx,x,y,scale=1,time=0,kind='bird')`：70×70 缩放；支持 bird/sparrow，其余显示小鼠，可自行替换 tanuki 表现。
- `drawBoard(ctx,x,y,width,height,progress=0)` 与 `drawPan(ctx,x,y,size=160,heat=0,recipeId='omurice',time=0)`。

## 后端检查

```powershell
node --test tests/menu.test.cjs tests/engine.test.cjs tests/session.test.cjs tests/standalone.test.cjs
node --check menu.js
node --check engine.js
node --check session.js
```

`node e2e/smoke.cjs` 使用 Playwright 验证浏览器中的键盘、鼠标和触屏操作。将单文件版路径作为参数可以检查发布文件。

## 共享榜接口

`node scripts/serve-shared.cjs` 提供游戏页面和同源 `/api/leaderboard`。`GET` 接收 `kind`（`daily` 或 `campaign`）和可选 `entryId`（UUID），返回 `{rows,current}`，其中 `rows` 是前十名，`current` 是所请求成绩的当前名次或 null。

`POST` 接收 `{nickname,entries}`。每项为 `{id,kind,day,score,served}`，其中 `id` 为 UUID，五天总成绩与第 5 天的单日成绩一并提交。返回 `{entries}`，每项含原记录、`nickname` 与 `rank`。同一 UUID 重试返回已有记录。用同一 UUID 提交不同成绩返回 409，批次不会部分入榜。
