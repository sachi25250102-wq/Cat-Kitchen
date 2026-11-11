# Claude 前端协作入口

用户指定分工：Claude 负责前端，Codex 负责后端。双方共享此项目目录。

## 当前状态

- 项目：**小满食堂**，原创中文离线单机烹饪游戏。
- 前端入口、布局、Canvas 舞台、输入、声音、动效和浏览器实测由 Claude 负责。
- Codex 已完成纯游戏逻辑、结算、升级、存档与稳定接口文档；35 项后端测试通过，现可开始接入。
- 本文件是共享目录交接记录；不表示已通过其他渠道向 Claude 发送消息。

## 文件分工

| 负责人 | 文件 |
| --- | --- |
| Codex | `engine.js`、`session.js`、`tests/*.test.cjs`、`docs/backend-api.md`、`docs/coordination/codex-status.md` |
| Claude | `index.html`、`style.css`、`game.js`、前端其他文件、浏览器交互和视觉验证 |
| 可复用的已完成美术草稿 | `assets/kitchen.png`、`assets/art-prompt.md`、`art.js` |

Claude 可自由选择是否使用美术草稿。请不要修改后端文件；所需接口变更写入 `docs/coordination/claude-status.md`，Codex 负责调整。

## 产品方向

借鉴 Cook or Cooked 的像素厨房气氛与操作节奏，名称、角色、画面、代码使用原创内容。日式暖色小食堂，樱花窗景、木柜台、暖帘、猫厨师。画面应像可玩的完整游戏，以厨房为主体，而不是仪表盘。

核心循环：选单（点击或 1/2/3）→ 按方向键/WASD 切菜 → 指针进入绿色区域后按空格控火 → 再按空格出餐。F 或点击动物驱赶。提供对应触屏按钮。三天营业，每天 90 秒，结算购买升级；另有无计时练习模式。

## 技术约束

- 原生 HTML/CSS/Canvas/经典 JavaScript 脚本，直接双击 `index.html` 可运行。
- 不使用 ES module、运行时 fetch、在线字体、CDN、联网账号或后端服务器。
- 脚本顺序：`engine.js` → `session.js` → `art.js`（可选）→ `game.js`。
- 后端入口：`KitchenSession.createSession()`，取得 `session.game` 和只读的 `session.profile`。
- 具体接口以 `docs/backend-api.md` 为准；后端完成状态看 `docs/coordination/codex-status.md`。
- 菜单、帮助、暂停、音量、重新开始、继续下一天必须可用。失焦/切出页面时暂停；重新聚焦后由玩家手动继续。
- `keydown` 忽略 `event.repeat`，方向键和空格阻止页面默认滚动。每帧 `tick` 使用秒；暂停或恢复时重置帧时间戳。
- `game.state` 仅供读取，不直接修改；从真实状态渲染火候、订单、反馈、分数和金币。
- 正式营业结束先调用 `session.settleDay()`；升级和跨天通过 session 方法，不能直接发放金币。
- `storageAvailable === false` 时仍可玩，界面可提示本次进度不能持久保存。

## 参考资料

- `docs/superpowers/specs/2026-11-10-komorebi-kitchen-design.md`
- `docs/backend-api.md`
- `assets/art-prompt.md`

## 协作回报

请在 `docs/coordination/claude-status.md` 写明：当前阶段、已修改文件、待解决接口问题、验证命令和结果。入口可运行时请记录启动方式。Codex 不会接管或覆盖前端文件。
