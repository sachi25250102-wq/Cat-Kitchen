# Claude 前端状态

## 2026-11-10：前端已完成，可以开始联调测试

当前阶段：前端入口可运行，全部功能已接到后端 v1 接口上，浏览器冒烟测试 160 项通过。没有需要 Codex 修改的接口问题。下一步是 Codex/GPT 在 Windows 真机上联调测试。

## 启动方式

双击 `index.html`（Chrome、Edge 均可），不需要服务器、网络或构建步骤。

脚本加载顺序比交接单多了两个前端文件，放在 `art.js` 之后、`game.js` 之前：

```
engine.js → session.js → art.js → sfx.js → stage.js → game.js
```

## 已修改文件

全部是前端文件，后端文件没有动。

| 文件 | 内容 |
| --- | --- |
| `index.html` | 入口：厨房舞台、HUD、订单夹、操作栏、标题画面，暂停、帮助、日结单、确认四个弹层 |
| `style.css` | 布局与视觉；桌面横排、手机竖排、横屏手机三套布局；减少动态效果 |
| `game.js` | 主控：输入、帧循环、失焦暂停、结算与升级界面、音效触发 |
| `stage.js` | 新增。Canvas 舞台：背景、猫厨师、砧板、锅、托盘、小馋鬼、粒子。全局 `KitchenStage` |
| `sfx.js` | 新增。Web Audio 合成音效，不加载音频文件。全局 `KitchenSfx` |
| `e2e/smoke.cjs` | 新增。真实浏览器冒烟测试 |
| `README.md`、`package.json` | 新增。运行说明和三个 npm 脚本，没有任何依赖 |
| `docs/coordination/claude-status.md`、`docs/coordination/screenshots/` | 本文件和 6 张验证截图 |

`engine.js`、`session.js`、`art.js`、`tests/`、`docs/backend-api.md`、`assets/` 未改动，交付时的 md5 与接手时一致：

```
fc6ddb687873597abd23261587a15546  engine.js
ba290e3b39f3c11ca6d0b4e04304037a  session.js
89e809ffc844aa57b4723e53e905e713  art.js
```

## 接口使用情况

- 只读 `game.state`，前端代码里没有任何对它的写入。
- 用到的方法：`session.startDay / startPractice / nextDay / leave / settleDay / getUpgradeOffer / buyUpgrade / restartCampaign / setSound / snapshot`，`game.selectOrder / input / action / shoo / tick / pause / resume`。没有直接调用 `game.start` 或 `game.quit`。
- 只有一个时钟：`requestAnimationFrame` 里调 `game.tick(秒)`，没有 `setInterval`。单帧最多推进 1 秒；暂停、恢复、切回页面时都重置帧时间戳。
- `ok:false` 的 reason 全部映射成中文提示；`settlement-pending` 和 `unsettled-shift` 会直接打开日结单。
- 正式营业进入 `summary` 后先调 `session.settleDay()`，再显示日结单。
- `storageAvailable === false` 时标题画面和日结单都会提示本次进度不保留。

## 待解决接口问题

没有阻塞问题。下面三条是非阻塞的说明，Codex 可以不处理。

1. 有几个数值前端是照文档写死的，后端如果调整，前端要跟着改。能导出成常量的话前端可以改为读取。
   - 火候区间 0.42 / 0.52 / 0.62 / 0.72：`style.css` 的 `.heat-good`、`.heat-perfect`、`.heat-burn`，`stage.js` 第 303 行，`game.js` 第 703 行。
   - 小馋鬼停留 5 秒：`game.js` 第 982 行的倒计时条。
   - 星级门槛 1 / 5 / 10 道：`game.js` 的 `renderTally` 和 `renderBill`（营业中显示“再出几道升星”）。
2. `art.js` 的 `drawPest` 没有狸猫，`stage.js` 里自己画了一只，不需要改 `art.js`。
3. `art.js` 的 `drawPan` 锅里始终有菜，非烹饪阶段前端盖了一层空锅，不需要改。

## 验证命令和结果

```powershell
node --test tests/engine.test.cjs tests/session.test.cjs
node --check engine.js; node --check session.js; node --check art.js
node --check sfx.js; node --check stage.js; node --check game.js
npm install --no-save playwright-core
node e2e/smoke.cjs
```

| 检查 | 结果 |
| --- | --- |
| 后端单元测试 | 35 通过，0 失败（未改后端，只是确认没被影响） |
| 六个脚本语法检查 | 全部通过 |
| 浏览器冒烟测试 | 160 通过，0 失败；全程控制台无 error 和 warning |

冒烟测试的运行环境是 Linux 上的无头 Chrome 153，以 `file://` 直接打开 `index.html`，键盘、鼠标、触屏事件由 Playwright 真实派发。脚本不设环境变量时会依次尝试 Playwright 自带的 Chromium、本机 Edge、本机 Chrome，Windows 上可以直接跑；也可以用 `BROWSER_CHANNEL=msedge` 指定。`SHOTS=目录` 会输出截图。

冒烟测试覆盖的 13 段：

1. 标题、帮助、声音开关及刷新后保留
2. 键盘完整做菜链路；切错归零；太早按空格不出锅；长按空格只出锅一次；方向键和空格拦截页面滚动
3. 鼠标点订单、点方向按钮、点出锅和出餐
4. Esc 暂停与继续、暂停期间时间不走且按键无效、继续后不补扣时间；窗口失焦和切出页面自动暂停，回来后需手动继续；帮助打开时暂停，关闭后恢复到打开前的状态
5. 糊锅退回切菜；小馋鬼出现、F 键和点击驱赶、奖励入账
6. 打烊自动结算入账；日结单刚弹出时空格和回车不会误点下一天；购买升级扣款和等级显示；刷新后先显示保存的结算
7. 重新开始今天和回到菜单都要确认；营业中刷新后该天从头来
8. 练习模式不计时、无小馋鬼、订单不超时、不入账
9. 三天通关、通关日结单、重新开始三天后记录保留
10. `localStorage` 被禁用时仍可完整游玩并有提示
11. 390×760、360×640、320×568 三种触屏竖屏：无横向溢出，所有操作按钮都在屏幕内，方向、出锅、赶走按钮不小于 44px，点按走完整流程
12. 减少动态效果偏好下正常出餐
13. 长按方向键只算一刀；选中的订单超时后界面回到选单，不会卡住

另外做过两项检查：

- 去掉 `art.js` 和 `assets/kitchen.png` 再跑一遍，153 项功能检查全部通过，剩下 7 项是预期中的“图片文件不存在”控制台消息。也就是美术素材缺失时游戏仍然可玩。
- 截图检查过的窗口尺寸：1920×1080、1366×768、1366×700、1280×560、1024×768、800×600、844×390（横屏手机）、390×760、360×640、320×568。

截图在 `docs/coordination/screenshots/`：标题、切菜、控火、日结单、失焦自动暂停、手机竖屏。

## 没有验证到的范围

请联调时重点看这几项，它们在我的环境里测不到：

- Windows 真机上的 Chrome 和 Edge。上面的结果来自 Linux 无头 Chrome。
- Windows 的字体效果。标题字体栈在 Windows 上会落到宋体加浏览器合成粗体；我用细体宋体模拟过，像素招牌和木札文字清晰可读，但没有看过真机画面。
- 声音的实际听感。自动化只确认了开关状态、存档和没有报错，没有人耳听过音量和音色。
- 真实触屏设备。触屏只做了浏览器模拟。
- Firefox 和 Safari 没有跑过。
- 失焦是用派发 `blur` 和 `visibilitychange` 事件模拟的，没有做真实的 Alt+Tab。

## 联调提示

- `window.KitchenApp.session` 是留给联调的入口，`KitchenApp.session.snapshot()` 返回存档、游戏状态和存储状态的独立副本。
- 想快进时间，在控制台调 `KitchenApp.session.game.tick(秒)`。界面每帧对比真实状态，糊锅、超时、小馋鬼、打烊都会在下一帧跟上。
- 清存档：菜单里的“重新开始”，或控制台 `localStorage.removeItem('xiaoman-kitchen:v1')` 后刷新。
- 键位：`1` `2` `3` 选单，方向键或 `WASD` 切菜，空格出锅和出餐，`F` 赶走，`Esc` 或 `P` 暂停，`H` 帮助，`M` 声音。

## 几个前端行为，测试时可能会当成问题

- 日结单弹出时不自动聚焦任何按钮。打烊那一刻玩家多半还在连按空格，这样不会顺手点掉“开始第 2 天”。
- 打烊后先显示约 1.3 秒“打烊啦”横幅，再弹日结单。结算在横幅出现时就已经入账。
- 看帮助时窗口失焦：关闭帮助后停在暂停牌，不会自动继续。
- 正式营业里“重新开始”和“回到菜单”会先确认，因为会放弃未结算的收入；练习模式不确认。
- 844×390 这类很矮的横屏会隐藏订单夹下方的出餐星级纸条，订单和操作按钮都在。
