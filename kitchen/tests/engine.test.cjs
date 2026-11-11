const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const enginePath = path.join(__dirname, '..', 'engine.js');
const KitchenEngine = fs.existsSync(enginePath) ? require(enginePath) : {};

function game(options = {}) {
  assert.equal(typeof KitchenEngine.createGame, 'function', 'createGame must be implemented');
  const result = KitchenEngine.createGame({ random: () => 0.5 });
  result.start(options);
  return result;
}

function chop(result, order = result.state.orders[0]) {
  result.selectOrder(order.id);
  for (const direction of result.state.sequence.slice()) result.input(direction);
  assert.equal(result.state.step, 'cook');
}

function ready(result) {
  chop(result);
  for (let index = 0; index < 100 && result.state.heat < 0.55; index += 1) result.tick(0.025);
  result.action();
  assert.equal(result.state.step, 'ready');
}

test('exposes the same classic-script engine in a browser with no require', () => {
  assert.ok(fs.existsSync(enginePath), 'engine.js must exist');
  const browser = {};
  const menuPath = path.join(__dirname, '..', 'menu.js');
  vm.runInNewContext(fs.readFileSync(menuPath, 'utf8'), browser);
  vm.runInNewContext(fs.readFileSync(enginePath, 'utf8'), browser);
  assert.equal(typeof browser.KitchenEngine.createGame, 'function');
  assert.equal(browser.KitchenEngine.DAY_COUNT, 5);
  assert.equal(browser.KitchenEngine.RECIPES.length, 10);
});

test('opens three playable first-day tickets and resets a new shift', () => {
  const result = game();
  assert.equal(result.state.phase, 'playing');
  assert.equal(result.state.timeLeft, 90);
  assert.equal(result.state.orders.length, 3);
  assert.ok(result.state.orders.some(order => order.recipeId === 'onigiri'));
  assert.ok(result.state.orders.every(order => ['onigiri', 'omurice'].includes(order.recipeId)));
  assert.equal(new Set(result.state.orders.map(order => order.id)).size, 3);
  ready(result);
  result.action();
  result.start({ day: 2 });
  assert.equal(result.state.score, 0);
  assert.equal(result.state.coins, 0);
  assert.equal(result.state.served, 0);
  assert.equal(result.state.step, 'select');
  assert.equal(result.state.selectedId, null);
});

test('completes a meal, pays once, records a perfect, and replaces its ticket', () => {
  const result = game();
  const ticket = result.state.orders[0].id;
  ready(result);
  assert.equal(result.state.grade, 'perfect');
  assert.equal(result.state.served, 0);
  result.action();
  assert.equal(result.state.served, 1);
  assert.equal(result.state.combo, 1);
  assert.equal(result.state.bestCombo, 1);
  assert.equal(result.state.stats.perfect, 1);
  assert.ok(result.state.coins > 0);
  assert.ok(result.state.score > 0);
  assert.equal(result.state.orders.length, 3);
  assert.ok(result.state.orders.every(order => order.id !== ticket));
  assert.equal(result.state.step, 'select');
  const coins = result.state.coins;
  result.action();
  result.action();
  assert.equal(result.state.served, 1);
  assert.equal(result.state.coins, coins);
});

test('wrong chopping resets the sequence and combo but allows the dish to finish', () => {
  const result = game();
  ready(result);
  result.action();
  result.selectOrder(result.state.orders[0].id);
  result.input(result.state.sequence[0]);
  result.input('invalid');
  assert.equal(result.state.progress, 1, 'unsupported inputs are ignored');
  const expected = result.state.sequence[1];
  result.input(expected === 'left' ? 'right' : 'left');
  assert.equal(result.state.progress, 0);
  assert.equal(result.state.combo, 0);
  for (const direction of result.state.sequence.slice()) result.input(direction);
  assert.equal(result.state.step, 'cook');
});

test('an early cooking action allows another try on the same cooking dish', () => {
  const result = game();
  chop(result);
  result.tick(0.1);
  const ticket = result.state.selectedId;
  result.action();
  assert.equal(result.state.step, 'cook');
  assert.equal(result.state.selectedId, ticket);
  assert.equal(result.state.combo, 0);
  while (result.state.heat < 0.5) result.tick(0.025);
  result.action();
  assert.equal(result.state.step, 'ready');
});

test('burned food resets preparation and can be remade on the same ticket', () => {
  const result = game();
  chop(result);
  const ticket = result.state.selectedId;
  result.tick(6);
  assert.equal(result.state.step, 'chop');
  assert.equal(result.state.selectedId, ticket);
  assert.equal(result.state.progress, 0);
  assert.equal(result.state.heat, 0);
  assert.equal(result.state.stats.burned, 1);
  assert.equal(result.state.served, 0);
  for (const direction of result.state.sequence.slice()) result.input(direction);
  assert.equal(result.state.step, 'cook');
});

test('switching tickets resets prep and switching during cooking is blocked', () => {
  const result = game();
  const [first, second] = result.state.orders;
  result.selectOrder(first.id);
  result.input(result.state.sequence[0]);
  result.selectOrder(first.id);
  assert.equal(result.state.progress, 1, 'reselecting preserves progress');
  result.selectOrder(second.id);
  assert.equal(result.state.selectedId, second.id);
  assert.equal(result.state.progress, 0);
  assert.notDeepEqual(result.state.sequence, []);
  for (const direction of result.state.sequence.slice()) result.input(direction);
  result.selectOrder(first.id);
  assert.equal(result.state.selectedId, second.id);
  assert.equal(result.state.step, 'cook');
});

test('a selected ticket expiring clears every prep stage and leaves other tickets playable', () => {
  for (const step of ['chop', 'cook', 'ready']) {
    const result = game();
    if (step === 'ready') ready(result);
    else if (step === 'cook') chop(result);
    else result.selectOrder(result.state.orders[0].id);
    const selected = result.state.orders.find(order => order.id === result.state.selectedId);
    selected.patience = 0.1;
    result.tick(0.2);
    assert.equal(result.state.missed, 1, step);
    assert.equal(result.state.selectedId, null, step);
    assert.equal(result.state.step, 'select', step);
    assert.equal(result.state.orders.length, 3, step);
    chop(result);
  }
});

test('an unrelated expiring ticket does not interrupt the selected preparation', () => {
  const result = game();
  result.selectOrder(result.state.orders[0].id);
  result.input(result.state.sequence[0]);
  const selected = result.state.selectedId;
  result.state.orders[1].patience = 0.1;
  result.tick(0.2);
  assert.equal(result.state.selectedId, selected);
  assert.equal(result.state.progress, 1);
  assert.equal(result.state.missed, 1);
});

test('pause freezes clock, cooking, tickets, pest, and all actions', () => {
  const result = game();
  result.tick(16.1);
  assert.ok(result.state.pest);
  chop(result);
  result.pause();
  const snapshot = JSON.stringify(result.state);
  result.tick(20);
  result.action();
  result.input('up');
  result.selectOrder(result.state.orders[1].id);
  result.shoo();
  assert.equal(JSON.stringify(result.state), snapshot);
  result.resume();
  result.tick(0.2);
  assert.equal(result.state.phase, 'playing');
  assert.ok(result.state.heat > 0);
  assert.ok(result.state.pest.remaining < 4.9);
});

test('a pest appears after its delay and shooing it rewards only once', () => {
  const result = game();
  result.tick(11.9);
  assert.equal(result.state.pest, null);
  result.tick(8.1);
  assert.ok(result.state.pest);
  assert.ok(result.state.pest.remaining > 0 && result.state.pest.remaining <= 5);
  result.shoo();
  assert.equal(result.state.pest, null);
  assert.equal(result.state.stats.pests, 1);
  const coins = result.state.coins;
  assert.ok(coins > 0);
  result.shoo();
  assert.equal(result.state.coins, coins);
});

test('an unattended pest leaves and takes additional patience from waiting orders', () => {
  const result = game();
  result.tick(16.1);
  assert.ok(result.state.pest);
  const first = result.state.orders[0];
  const before = first.patience;
  result.tick(5);
  assert.equal(result.state.pest, null);
  assert.ok(first.patience < before - 5);
  assert.equal(result.state.stats.pests, 0);
});

test('practice has endless time, patience, and no pests while meals remain playable', () => {
  const result = game({ practice: true });
  const before = result.state.orders.map(order => order.patience);
  const time = result.state.timeLeft;
  result.tick(1000);
  assert.equal(result.state.phase, 'playing');
  assert.equal(result.state.timeLeft, time);
  assert.deepEqual(result.state.orders.map(order => order.patience), before);
  assert.equal(result.state.pest, null);
  assert.equal(result.state.missed, 0);
  ready(result);
  result.action();
  assert.equal(result.state.served, 1);
});

test('a shift ends at 90 seconds and every gameplay action then freezes', () => {
  const result = game();
  result.tick(89.75);
  assert.equal(result.state.phase, 'playing');
  result.tick(5);
  assert.equal(result.state.phase, 'summary');
  assert.equal(result.state.timeLeft, 0);
  const snapshot = JSON.stringify(result.state);
  result.tick(100);
  result.selectOrder(result.state.orders[0].id);
  result.input('up');
  result.action();
  result.shoo();
  result.pause();
  result.resume();
  assert.equal(JSON.stringify(result.state), snapshot);
});

test('upgrades are bounded, extend patience, slow heat, and increase served payout', () => {
  const base = game();
  const upgraded = game({ upgrades: { stove: 99, patience: 2.9, charm: 3, extra: 50 } });
  assert.deepEqual(upgraded.state.upgrades, { stove: 3, patience: 2, charm: 3 });
  assert.ok(upgraded.state.orders[0].maxPatience > base.state.orders[0].maxPatience);
  chop(base);
  chop(upgraded);
  base.tick(0.5);
  upgraded.tick(0.5);
  assert.ok(upgraded.state.heat < base.state.heat);
  while (base.state.heat < 0.55) base.tick(0.025);
  while (upgraded.state.heat < 0.55) upgraded.tick(0.025);
  base.action();
  upgraded.action();
  base.action();
  upgraded.action();
  assert.ok(upgraded.state.coins > base.state.coins);
  const invalid = game({ day: 99, upgrades: { stove: -2, patience: 'bad', charm: Infinity } });
  assert.equal(invalid.state.day, 5);
  assert.deepEqual(invalid.state.upgrades, { stove: 0, patience: 0, charm: 0 });
});

test('two recipes unlock each day and all five shifts can settle and restart', () => {
  assert.equal(typeof KitchenEngine.createGame, 'function', 'createGame must be implemented');
  for (const day of [1, 2, 3, 4, 5]) {
    const result = KitchenEngine.createGame({ random: () => 0.999 });
    result.start({ day });
    assert.equal(result.state.availableRecipeIds.length, day * 2);
    if (day === 1) assert.ok(result.state.orders.every(order => order.recipeId !== 'curry'));
    if (day === 2) assert.equal(result.state.orders[2].recipeId, 'curry');
    ready(result);
    result.action();
    result.tick(90);
    assert.equal(result.state.phase, 'summary');
    assert.equal(result.state.served, 1);
    result.start({ day });
    assert.equal(result.state.phase, 'playing');
    assert.equal(result.state.timeLeft, 90);
    assert.equal(result.state.served, 0);
  }
});

test('invalid elapsed time and stale ticket ids leave active preparation intact', () => {
  const result = game();
  result.selectOrder(result.state.orders[0].id);
  result.input(result.state.sequence[0]);
  const snapshot = JSON.stringify(result.state);
  for (const seconds of [NaN, Infinity, -1, 0, '5']) result.tick(seconds);
  result.selectOrder('missing-ticket');
  assert.equal(JSON.stringify(result.state), snapshot);
});

test('quit returns every phase to menu, clears active prep, and freezes until restart', () => {
  for (const phase of ['playing', 'paused', 'summary', 'menu']) {
    const result = game({ practice: phase === 'paused' });
    assert.equal(typeof result.quit, 'function', 'quit must be implemented');
    chop(result);
    result.tick(0.5);
    if (!result.state.practice) result.tick(15.6);
    if (phase === 'paused') result.pause();
    if (phase === 'summary') result.tick(90);
    if (phase === 'menu') result.quit();
    result.quit();
    assert.equal(result.state.phase, 'menu', phase);
    assert.equal(result.state.selectedId, null, phase);
    assert.equal(result.state.step, 'select', phase);
    assert.deepEqual(result.state.sequence, [], phase);
    assert.equal(result.state.progress, 0, phase);
    assert.equal(result.state.heat, 0, phase);
    assert.equal(result.state.grade, null, phase);
    assert.equal(result.state.pest, null, phase);
    assert.ok(result.state.pots.every(pot => pot === null), phase);
    assert.equal(result.state.helper, null, phase);
    const snapshot = JSON.stringify(result.state);
    result.quit();
    result.tick(100);
    result.selectOrder(result.state.orders[0].id);
    result.input('up');
    result.action();
    result.shoo();
    result.pause();
    result.resume();
    assert.equal(JSON.stringify(result.state), snapshot, phase);
    result.start();
    chop(result);
    result.tick(0.5);
    assert.equal(result.state.phase, 'playing', phase);
    assert.ok(result.state.heat > 0, phase);
  }
});

function prepareDish(result, order, dishIndex = 0) {
  result.selectOrder(order.id, dishIndex);
  assert.equal(result.state.step, 'chop');
  for (const direction of result.state.sequence.slice()) result.input(direction);
}

function finishDish(result, order, dishIndex = 0) {
  prepareDish(result, order, dishIndex);
  const index = result.state.pots.findIndex(pot => pot?.orderId === order.id && pot.dishIndex === dishIndex);
  assert.notEqual(index, -1);
  result.tick(1.55);
  assert.equal(result.finishPot(index), true);
}

test('two independent pots can cook while a third prepared dish waits for space', () => {
  const result = game({ day: 2 });
  assert.deepEqual(result.state.pots, [null, null]);
  const [first, second, third] = result.state.orders;
  prepareDish(result, first);
  result.tick(0.4);
  prepareDish(result, second);
  prepareDish(result, third);
  assert.equal(result.state.step, 'waiting');
  assert.equal(third.dishes[0].status, 'waiting');
  result.tick(1.2);
  const secondHeat = result.state.pots[1].heat;
  assert.ok(result.state.pots[0].heat > secondHeat);
  assert.equal(result.finishPot(0), true);
  assert.equal(first.dishes[0].status, 'ready');
  assert.equal(result.state.pots[0], null);
  assert.equal(result.state.pots[1].heat, secondHeat);
  assert.equal(result.state.selectedId, third.id);
  assert.equal(result.state.served, 0);
  result.action();
  assert.equal(result.state.pots[0].orderId, third.id);
  assert.equal(result.state.step, 'cook');
});

test('burning or expiring one dish clears only its pot and leaves other preparation intact', () => {
  const result = game({ day: 2 });
  const [first, second, third] = result.state.orders;
  prepareDish(result, first);
  result.tick(1.6);
  prepareDish(result, second);
  result.tick(1.3);
  assert.equal(result.state.stats.burned, 1);
  assert.equal(result.state.pots[0], null);
  assert.equal(first.dishes[0].status, 'chop');
  assert.equal(result.state.pots[1].orderId, second.id);
  assert.equal(result.state.selectedId, second.id);
  assert.equal(result.state.step, 'cook');
  result.selectOrder(third.id);
  result.input(result.state.sequence[0]);
  second.patience = 0.1;
  result.tick(0.2);
  assert.equal(result.state.pots[1], null);
  assert.equal(result.state.missed, 1);
  assert.equal(result.state.selectedId, third.id);
  assert.equal(result.state.progress, 1);
});

test('a set pays once after both warm dishes are ready and counts both dishes', () => {
  const result = game({ day: 3 });
  const ticket = result.state.orders[2];
  assert.equal(ticket.kind, 'combo');
  assert.equal(ticket.dishes.length, 2);
  finishDish(result, ticket, 0);
  assert.equal(ticket.dishes[0].warmth, 14);
  result.action();
  assert.equal(result.state.selectedDish, 1);
  assert.equal(result.state.coins, 0);
  finishDish(result, ticket, 1);
  result.action();
  assert.equal(result.state.served, 2);
  assert.equal(result.state.stats.sets, 1);
  assert.equal(result.state.combo, 1);
  assert.ok(result.state.coins >= ticket.dishes.reduce((sum, dish) =>
    sum + KitchenEngine.RECIPES.find(recipe => recipe.id === dish.recipeId).price, 0));
  const coins = result.state.coins;
  result.action();
  assert.equal(result.state.coins, coins);
  assert.equal(result.state.served, 2);
});

test('a cold component can be remade while the other set dish stays warm in practice', () => {
  const result = game({ day: 3, practice: true });
  const ticket = result.state.orders[2];
  const patience = ticket.patience;
  finishDish(result, ticket, 0);
  result.tick(5);
  finishDish(result, ticket, 1);
  result.tick(7.6);
  assert.equal(ticket.dishes[0].status, 'chop');
  assert.equal(ticket.dishes[1].status, 'ready');
  assert.ok(ticket.dishes[1].warmth > 0);
  assert.equal(result.state.stats.cold, 1);
  assert.equal(result.state.timeLeft, 90);
  assert.equal(ticket.patience, patience);
  finishDish(result, ticket, 0);
  result.action();
  assert.equal(result.state.served, 2);
});

test('taste tickets reject incompatible choices and accept different matching recipes', () => {
  const result = game({ day: 4 });
  const ticket = result.state.orders[2];
  assert.equal(ticket.kind, 'taste');
  result.selectOrder(ticket.id);
  assert.equal(result.state.step, 'taste');
  assert.equal(result.state.recipeId, null);
  const menu = require('../menu.js');
  const recipes = menu.recipesForDay(4);
  const matching = recipes.filter(recipe => menu.matchesTaste(recipe, ticket.taste));
  const mismatch = recipes.find(recipe => !menu.matchesTaste(recipe, ticket.taste));
  assert.ok(matching.length >= 2 && mismatch);
  assert.equal(result.chooseTaste('impossible', 'impossible'), false);
  assert.equal(result.chooseTaste(mismatch.ingredient, mismatch.method), false);
  assert.equal(result.state.step, 'taste');
  for (const recipe of matching.slice(0, 2)) {
    const next = game({ day: 4 });
    const order = next.state.orders[2];
    next.selectOrder(order.id);
    assert.equal(next.chooseTaste(recipe.ingredient, recipe.method), true);
    assert.equal(next.state.recipeId, recipe.id);
    assert.equal(next.state.step, 'chop');
    finishDish(next, order);
    next.action();
    assert.equal(next.state.stats.tastes, 1);
  }
});

test('rice shortage keeps a dish waiting, and refill resumes after unpausing', () => {
  const result = game({ day: 4, practice: true });
  assert.ok(result.state.riceCapacity > 0);
  assert.equal(result.state.rice, result.state.riceCapacity);
  const first = result.state.orders[0];
  assert.equal(first.recipeId, 'onigiri');
  for (let i = 0; i < result.state.riceCapacity; i += 1) {
    prepareDish(result, first);
    result.tick(2.85);
  }
  assert.equal(result.state.rice, 0);
  prepareDish(result, first);
  assert.equal(result.state.step, 'waiting');
  result.action();
  assert.equal(result.state.step, 'waiting');
  const refill = result.state.riceRefill;
  result.pause();
  result.tick(30);
  assert.equal(result.state.riceRefill, refill);
  result.resume();
  result.tick(refill + 0.01);
  assert.equal(result.state.rice, 1);
  result.action();
  assert.equal(result.state.step, 'cook');
  assert.equal(result.state.rice, 0);
});

test('feeding the practice sparrow consumes rice and delivers exactly one completed ticket', () => {
  const result = game({ day: 4, practice: true });
  assert.equal(result.state.pest?.kind, 'sparrow');
  const stock = result.state.rice;
  assert.equal(result.feedPest(), true);
  assert.equal(result.state.rice, stock - 1);
  assert.equal(result.state.pest, null);
  assert.deepEqual(result.state.helper, { kind: 'sparrow' });
  assert.equal(result.feedPest(), false);
  const [first, second] = result.state.orders;
  finishDish(result, first);
  assert.equal(result.state.helper, null);
  assert.equal(result.state.served, 1);
  assert.equal(result.state.stats.assists, 1);
  assert.ok(result.state.orders.every(order => order.id !== first.id));
  result.action();
  finishDish(result, second);
  assert.equal(result.state.served, 1);
  result.action();
  assert.equal(result.state.served, 2);
  result.tick(60);
  assert.equal(result.state.pest, null);
  assert.equal(result.state.stats.assists, 1);
});

test('the sparrow delivering a different order preserves the selected chopping progress', () => {
  const result = game({ day: 4, practice: true });
  const [first, second] = result.state.orders;
  assert.equal(result.feedPest(), true);
  prepareDish(result, first);
  result.selectOrder(second.id);
  result.input(result.state.sequence[0]);
  result.tick(1.55);
  assert.equal(result.finishPot(0), true);
  assert.equal(result.state.served, 1);
  assert.equal(result.state.selectedId, second.id);
  assert.equal(result.state.recipeId, second.recipeId);
  assert.equal(result.state.step, 'chop');
  assert.equal(result.state.progress, 1);
  assert.equal(result.finishPot(0), false);
  assert.equal(result.state.served, 1);
});

test('the sparrow waits until both dishes of a set are ready', () => {
  const result = game({ day: 4, practice: true });
  for (let i = 0; i < 3; i += 1) {
    finishDish(result, result.state.orders.find(order => order.kind === 'single'));
    result.action();
  }
  const ticket = result.state.orders.find(order => order.kind === 'combo');
  assert.ok(ticket);
  result.tick(60);
  assert.equal(result.feedPest(), true);
  const served = result.state.served;
  finishDish(result, ticket, 0);
  assert.ok(result.state.helper);
  assert.equal(result.state.served, served);
  finishDish(result, ticket, 1);
  assert.equal(result.state.helper, null);
  assert.equal(result.state.served, served + 2);
  assert.equal(result.state.stats.assists, 1);
  assert.equal(result.state.stats.sets, 1);
});

test('the first campaign visitor on day four is feedable and tanuki still must be shooed', () => {
  const result = game({ day: 4 });
  result.tick(16.1);
  assert.equal(result.state.pest?.kind, 'sparrow');
  assert.equal(result.feedPest(), true);
  result.tick(16);
  assert.equal(result.state.pest?.kind, 'tanuki');
  const rice = result.state.rice;
  assert.equal(result.feedPest(), false);
  assert.equal(result.state.rice, rice);
  result.shoo();
  assert.equal(result.state.pest, null);
  assert.equal(result.state.stats.pests, 1);
});

const BENTO_PLACEMENTS = [
  ['main', 0, 0, 1], ['greens', 2, 0, 2], ['carrot', 0, 1, 0], ['rice', 0, 2, 1]
];

test('bento service requires all four placements and leaves the dessert cell reserved', () => {
  const result = game({ day: 5 });
  const ticket = result.state.orders[2];
  assert.equal(ticket.kind, 'bento');
  assert.equal(ticket.recipeId, 'ginger-pork');
  const rice = result.state.rice;
  assert.equal(result.placeBento(...BENTO_PLACEMENTS[0]), false, 'uncooked meal cannot be packed');
  finishDish(result, ticket);
  assert.equal(result.state.rice, rice - 1, 'bento consumes rice on loading the pot');
  assert.equal(result.state.step, 'bento');
  assert.equal(result.placeBento('carrot', 3, 2, 0), false);
  assert.equal(result.placeBento(...BENTO_PLACEMENTS[0]), true);
  assert.equal(result.placeBento('carrot', 0, 0, 0), false, 'overlap is rejected');
  result.action();
  assert.equal(result.state.served, 0);
  assert.equal(result.resetBento(), true);
  assert.deepEqual(ticket.bento.placements, []);
  for (const placement of BENTO_PLACEMENTS) assert.equal(result.placeBento(...placement), true);
  assert.equal(ticket.bento.complete, true);
  assert.equal(result.state.step, 'ready');
  assert.equal(result.removeBento('rice'), true);
  assert.equal(result.state.step, 'bento');
  result.action();
  assert.equal(result.state.served, 0);
  assert.equal(result.placeBento(...BENTO_PLACEMENTS[3]), true);
  result.action();
  assert.equal(result.state.served, 1);
  assert.equal(result.state.stats.bentos, 1);
});

test('a sparrow helper waits for a fully packed bento before delivering it', () => {
  const result = game({ day: 5, practice: true });
  const ticket = result.state.orders[2];
  assert.equal(result.feedPest(), true);
  finishDish(result, ticket);
  assert.ok(result.state.helper);
  for (const placement of BENTO_PLACEMENTS.slice(0, -1)) assert.equal(result.placeBento(...placement), true);
  assert.ok(result.state.helper);
  assert.equal(result.state.served, 0);
  assert.equal(result.placeBento(...BENTO_PLACEMENTS.at(-1)), true);
  assert.equal(result.state.helper, null);
  assert.equal(result.state.served, 1);
  assert.equal(result.state.stats.bentos, 1);
  assert.equal(result.state.stats.assists, 1);
});

test('replacement tickets offer all ten unlocked recipes without relying on random luck', () => {
  const result = game({ day: 5 });
  const seen = new Set();
  for (let i = 0; i < 24; i += 1) {
    for (const order of result.state.orders) {
      for (const dish of order.dishes) if (dish.recipeId) seen.add(dish.recipeId);
    }
    result.state.orders[0].patience = 0.1;
    result.tick(0.2);
  }
  assert.deepEqual([...seen].sort(), [...result.state.availableRecipeIds].sort());
  assert.equal(seen.size, 10);
});

test('closing a shift discards remaining pot, warmth, and helper state without payouts', () => {
  const result = game({ day: 4, upgrades: { patience: 3 } });
  for (let i = 0; i < 3; i += 1) {
    finishDish(result, result.state.orders.find(order => order.kind === 'single'));
    result.action();
  }
  result.tick(12);
  assert.equal(result.feedPest(), true);
  const earned = result.state.coins;
  const ticket = result.state.orders.find(order => order.kind === 'combo');
  finishDish(result, ticket, 0);
  prepareDish(result, ticket, 1);
  assert.ok(result.state.pots.some(Boolean));
  assert.ok(ticket.dishes[0].warmth > 0);
  assert.ok(result.state.helper);
  result.state.timeLeft = 0.25;
  result.tick(0.5);
  assert.equal(result.state.phase, 'summary');
  assert.ok(result.state.pots.every(pot => pot === null));
  assert.equal(result.state.helper, null);
  assert.ok(result.state.orders.every(order => order.dishes.every(dish => dish.warmth === 0)));
  assert.equal(result.state.coins, earned);
});
