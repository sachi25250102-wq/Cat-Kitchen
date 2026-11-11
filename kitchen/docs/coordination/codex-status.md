# Codex 后端状态

## 2026-11-10：后端就绪，Claude 前端开发中

用户已确认 Claude 接入共享目录并正在开发前端。此次文件检查尚未看到 `docs/coordination/claude-status.md` 或 `index.html`；此处不推断 Claude 的具体实现进度。

后端 v1 接口保持稳定。Claude 的接口需求和联调问题请写入 `docs/coordination/claude-status.md`；Codex 负责后端修改及回归测试，前端源码由 Claude 维护。

- 用户指定 Claude 负责前端，Codex 负责后端，共享项目目录。
- `engine.js` 已实现切菜、火候、出餐、订单超时、捣乱、暂停、三天难度和练习模式。
- `session.js` 已实现钱包、升级、结算防重复、三天推进、练习隔离、重开和本地存档。
- 稳定接口文档为 `docs/backend-api.md`，可开始接入；全局入口为 `KitchenSession.createSession()`。
- 35 个后端测试全部通过；engine.js 和 session.js 行覆盖率均为 100%，总分支覆盖率为 93.25%。
- 原创背景 `assets/kitchen.png` 和可选角色绘制 `art.js` 均已完成，Claude 可按自己的前端设计使用。
- 前端文件保留给 Claude，Codex 尚未创建入口页面。

## 已验证

```powershell
node --test --experimental-test-coverage tests/engine.test.cjs tests/session.test.cjs
node --check engine.js
node --check session.js
node --check art.js
git diff --check
```

- TDD：引擎初始 17 项失败后实现通过；存档初始 15 项失败后实现通过；退出与未结算重开缺陷均有先失败后通过的回归测试。
- 独立复查：结算幂等、暂停、练习、退出后重载、写入配额失败。发现的未结算收益覆盖问题已修复。
- 没有安装运行时依赖、启动联网服务、修改凭据、提交或推送。

## Claude 接入要点

1. 先读根目录 `CLAUDE-HANDOFF.md` 和 `docs/backend-api.md`。
2. 创建 `index.html`、`style.css`、`game.js`，按约定加载经典脚本。
3. 正式营业进入 summary 后先 `session.settleDay()`，再展示收益和购买升级。
4. 若返回 `unsettled-shift`，先结算；主动放弃通过 `session.leave()`。
5. 状态更新写入 `docs/coordination/claude-status.md`，需要后端改动也写这里。

下一步：收到 Claude 的前端入口或接口问题后，进行真实浏览器联调。当前没有前端入口，不能声称整款游戏已可玩。
