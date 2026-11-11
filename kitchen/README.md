# 小满食堂

原创中文离线单机烹饪游戏。猫厨师在樱花巷口经营五天小食堂，逐步解锁十道菜。

## 怎么玩

推荐使用单文件版 **`小满食堂-双击即玩.html`**：下载这一个文件后，用 Chrome 或 Edge 打开即可，不需要解压或保留其他文件。开发者可运行 `node scripts/build-standalone.cjs` 生成到 `output/`。

源码版的打开方式：

双击 `index.html`，用 Chrome 或 Edge 打开即可。不需要联网、安装或服务器。

| 操作 | 键盘 | 鼠标、触屏 |
| --- | --- | --- |
| 选单 | `1` `2` `3` | 点右侧订单 |
| 切菜 | 方向键或 `W` `A` `S` `D` | 点方向按钮 |
| 出锅、出餐 | 空格 | 点“出锅 / 出餐” |
| 双灶分别出锅 | `Q` / `E` | 点对应灶台的火候按钮 |
| 赶走小馋鬼 | `F` | 点它，或点“赶走” |
| 喂麻雀 | `G` | 点“喂一份米” |
| 暂停 | `Esc` 或 `P` | 右上角暂停按钮 |
| 帮助、声音 | `H`、`M` | 右上角按钮 |

每天营业 90 秒，每天新增两道菜。打烊后用金币升级灶台、客人耐心或小费。切到别的窗口会自动暂停，回来后手动继续。

| 日期 | 解锁玩法 |
| --- | --- |
| 第 1 天 | 选单、切菜、控火、出餐 |
| 第 2 天 | 两口锅各自计时，做下一单时留意另一口锅 |
| 第 3 天 | 两道套餐菜都要热着才能一起上桌，凉了重做对应菜 |
| 第 4 天 | 按客人口味选择食材和做法。花一份米请麻雀送下一单 |
| 第 5 天 | 旋转并摆放主菜、米饭和两份蔬菜，给甜点留一格 |

点“选择练习日”可以直接体验任意一天。练习不计营业时间和收入，锅里的火候仍会走动。

每天打烊都会显示当日积分和本机名次。完成五天后另记一次总分排名。主菜单可打开排行榜，练习成绩不入榜。

进度保存在浏览器本地存储里。浏览器不允许本地存储时游戏照常可玩，只是关掉页面后进度不保留。

## 和朋友共用排行榜

安装 Node.js 24 以上，在游戏源码目录运行 `node scripts/serve-shared.cjs`，打开 `http://127.0.0.1:8787`。结算时点“排行榜”，输入昵称并提交本局成绩。榜单显示前十名，结算页可查到本局的实际名次。

同一局域网的朋友可以共用一个服务：

```powershell
node scripts/serve-shared.cjs --lan
```

把终端打印的“局域网”链接发给朋友。服务运行期间，朋友从这个链接打开游戏。跨网络分享需要把同一服务部署到公网，并保留数据库所在的持久磁盘。

共享成绩保存在服务所在电脑的 `.local/scores.sqlite`，可用 `KITCHEN_DB` 更换位置。共享榜适合朋友间比较，积分由游戏客户端上报。双击 HTML 文件时可以继续使用本机榜。

## 文件

| 文件 | 作用 | 负责 |
| --- | --- | --- |
| `index.html`、`style.css` | 页面结构与样式 | Claude |
| `game.js` | 前端主控：输入、帧循环、弹层、结算界面 | Claude |
| `stage.js` | Canvas 厨房舞台和动效 | Claude |
| `sfx.js` | Web Audio 合成音效 | Claude |
| `e2e/smoke.cjs` | 浏览器冒烟测试 | Claude |
| `menu.js` | 十道菜、口味条件、便当拼格规则 | Codex |
| `engine.js` | 游戏规则状态机 | Codex |
| `session.js` | 钱包、升级、五天进度、存档 | Codex |
| `scripts/serve-shared.cjs` | 共享排行榜 HTTP 服务与 SQLite 存储 | Codex |
| `tests/*.test.cjs` | 后端单元测试 | Codex |
| `art.js`、`assets/kitchen.png` | 角色与菜品绘制、厨房背景 | Codex |

接口约定见 `docs/backend-api.md`，协作状态见 `docs/coordination/`。

## 测试

游戏本身没有任何依赖。测试需要 Node 18 以上。

```powershell
npm test          # 后端单元测试
npm run check     # 游戏脚本的语法检查

npm install --no-save playwright-core
npm run e2e       # 真实浏览器冒烟测试，用本机的 Edge 或 Chrome
```

共享榜测试使用 Node.js 24 以上。运行 `node --test tests/shared-leaderboard.test.cjs` 检查 HTTP 服务，运行 `node e2e/smoke.cjs --shared` 检查两个浏览器会话提交和查看排名。

冒烟测试可选的环境变量：`BROWSER_CHANNEL`（`msedge` 或 `chrome`）、`CHROME_PATH`（浏览器可执行文件路径）、`SHOTS`（截图输出目录）。
