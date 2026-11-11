# 小满食堂 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Independent art and logic work may run in parallel.

**Goal:** Deliver a polished Chinese offline single-player cooking game.

**Architecture:** Buildless HTML/CSS with classic scripts. A pure state machine owns gameplay; Canvas draws the kitchen; DOM renders accessible controls and tickets. Local assets and optional localStorage keep the game offline.

**Tech Stack:** Browser Canvas 2D, Web Audio, JavaScript, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-10-komorebi-kitchen-design.md`

**User steering:** Claude owns frontend in another session sharing this directory. Codex owns local game logic, persistence, economy, tests and integration contract. Frontend implementation and browser QA remain pending that session's work.

## Global constraints

- Double-click `index.html` works without network access or module imports.
- Original art, characters and code; Chinese user-facing text.
- Three 90-second days; practice has no day timer or pests.
- Pause and window blur freeze gameplay.
- Zero runtime packages; keyboard and touch inputs share engine actions.

## Review focus

- Repeated Space or arrow keydown must not accidentally finish multiple stages.
- Background tabs must not consume game time on resuming.
- Expired selected tickets must not leave the action panel stuck.
- localStorage failure must not prevent playing.
- Narrow screens must expose every required input without horizontal overflow.

## Task 1: Pure gameplay state and tests

Files: `engine.js`, `tests/engine.test.cjs`.

Interface: global/CommonJS `KitchenEngine` exposes `createGame({random})`, `RECIPES`; game exposes `state`, `start({day,practice,upgrades})`, `selectOrder(id)`, `input(direction)`, `action()`, `shoo()`, `tick(seconds)`, `pause()`, `resume()`. State includes phase, day, timeLeft, coins, score, served, missed, combo, bestCombo, orders, selectedId, step, sequence, progress, heat, pest, feedback, stats. Recipes include id, name, price, sequence, color.

- [x] Write tests for the complete meal path and failure cases; run and observe failure.
- [x] Implement state transitions; test order expiration, pause, practice, pests and day settlement.
- [x] Run `node --test tests/engine.test.cjs`.

## Task 2: Original kitchen assets

Files: `assets/kitchen.png`, `assets/art-prompt.md`, `art.js`.

- [x] Generate original pixel-art kitchen background and save a project-local copy.
- [x] Draw animated original chef, dishes and pest through a small Canvas art interface.
- [x] Verify the background is present locally and has no embedded interface text.

## Task 2a: Session, persistence and collaboration contract (Codex)

Files: `session.js`, `tests/session.test.cjs`, `CLAUDE-HANDOFF.md`, `docs/backend-api.md`.

- [x] Write failing tests for wallet, upgrades, progression, idempotent settlement and storage fallback.
- [x] Implement session methods and persist only versioned profile state.
- [x] Test guard for completed but unsettled shifts before new-day/practice entry.
- [x] Publish the stable interface and file ownership for Claude.

## Task 3: Playable browser interface (Claude)

Files: `index.html`, `style.css`, `game.js`, `README.md`, `package.json`.

- [ ] Connect menu, lesson, orders, cut/cook/serve controls, feedback, practice and audio.
- [ ] Add settlement, bounded upgrades, three-day progression, restart and safe local saving.
- [ ] Run syntax and unit checks; serve locally for browser QA.

## Task 4: Independent review and final QA

- [x] Review state transitions and storage; repair observed defects.
- [ ] Verify real keyboard play, mouse/touch, pause, restart and responsive layout in browser.
- [ ] Check console logs, offline asset paths and `git diff --check`.
- [ ] Save a screenshot and document verified run instructions and limitations.
