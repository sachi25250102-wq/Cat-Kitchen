const assert = require('node:assert/strict');
const test = require('node:test');
const menu = require('../menu.js');

test('unlocks two unique recipes on each of five days', () => {
  assert.equal(menu.DAY_COUNT, 5);
  assert.equal(menu.RECIPES.length, 10);
  assert.equal(new Set(menu.RECIPES.map(recipe => recipe.id)).size, 10);
  assert.equal(new Set(menu.RECIPES.map(recipe => JSON.stringify([
    recipe.ingredient, recipe.method
  ]))).size, 10);
  for (let day = 1; day <= 5; day++) {
    assert.equal(menu.recipesForDay(day).length, 2 * day);
  }
  assert.deepEqual(menu.recipesForDay(2).map(recipe => recipe.id), [
    'onigiri', 'omurice', 'curry', 'miso'
  ]);
});

test('recipe discovery requires the matching pair and an unlocked day', () => {
  const curry = menu.RECIPES.find(recipe => recipe.id === 'curry');
  const { ingredient, method } = curry;
  assert.equal(menu.findRecipe(ingredient, method, 1), null);
  assert.equal(menu.findRecipe(ingredient, method, 2), curry);
  assert.equal(menu.findRecipe(ingredient, '捏制', 2), null);
});

test('each taste has at least two choices by the fourth day', () => {
  assert.ok(menu.TASTES.length >= 2);
  for (const taste of menu.TASTES) {
    assert.ok(
      menu.recipesForDay(4).filter(recipe => menu.matchesTaste(recipe, taste)).length >= 2,
      taste.text
    );
  }
});

test('matching needs every required tag and excludes any forbidden tag', () => {
  const taste = { required: ['清淡', '汤菜'], forbidden: ['辛辣'] };
  assert.equal(menu.matchesTaste({ tags: ['清淡', '汤菜'] }, taste), true);
  assert.equal(menu.matchesTaste({ tags: ['清淡'] }, taste), false);
  assert.equal(menu.matchesTaste({ tags: ['清淡', '汤菜', '辛辣'] }, taste), false);
});

test('quarter-turns rotate the bento shape and normalize it to the origin', () => {
  assert.deepEqual(menu.bentoCells('main', 0), [[0, 0], [0, 1], [1, 1], [0, 2]]);
  assert.deepEqual(menu.bentoCells('main', 1), [[0, 0], [1, 0], [2, 0], [1, 1]]);
  assert.deepEqual(menu.bentoCells('main', 2), [[1, 0], [0, 1], [1, 1], [1, 2]]);
  assert.deepEqual(menu.bentoCells('main', 3), [[1, 0], [0, 1], [1, 1], [2, 1]]);
  assert.deepEqual(menu.bentoCells('missing', 0), []);
  assert.deepEqual(menu.bentoCells('main', 4), []);
});

test('bento rejects an overlap, out-of-bounds cells, or the dessert cell', () => {
  const placements = menu.placeBento([], 'main', 0, 0, 1);
  assert.equal(menu.placeBento(placements, 'carrot', 1, 0, 0), null);
  assert.equal(menu.placeBento(placements, 'rice', 2, 2, 1), null);
  assert.equal(menu.placeBento(placements, 'carrot', 3, 2, 0), null);
});

test('placing a piece again replaces it atomically', () => {
  const placements = menu.placeBento([], 'main', 0, 0, 1);
  const snapshot = structuredClone(placements);
  const moved = menu.placeBento(placements, 'main', 1, 0, 1);
  assert.deepEqual(moved, [{
    pieceId: 'main', x: 1, y: 0, rotation: 1,
    cells: [[1, 0], [2, 0], [3, 0], [2, 1]]
  }]);
  assert.equal(menu.placeBento(placements, 'main', -1, 0, 1), null);
  assert.deepEqual(placements, snapshot);
});

test('all four pieces can cover the bento except the dessert cell', () => {
  const placements = [
    ['main', 0, 0, 1],
    ['greens', 2, 0, 2],
    ['carrot', 0, 1, 0],
    ['rice', 0, 2, 1]
  ].reduce((board, args) => menu.placeBento(board, ...args), []);
  assert.ok(placements);
  assert.equal(menu.bentoComplete(placements), true);
  assert.equal(menu.bentoComplete(placements.slice(0, -1)), false);
  assert.equal(new Set(placements.flatMap(piece => piece.cells.map(cell => cell.join(',')))).size, 11);
});

test('bento rejects malformed coordinates, forged cells, and duplicate pieces', () => {
  const carrot = menu.placeBento([], 'carrot', 0, 1, 0)[0];
  const forged = { ...carrot, cells: [[3, 2]] };
  assert.equal(menu.placeBento(null, 'carrot', 0, 1, 0), null);
  assert.equal(menu.placeBento([], 'carrot', '0', 1, 0), null);
  assert.equal(menu.placeBento([], 'carrot', 0, 1, 0.5), null);
  assert.equal(menu.placeBento([forged], 'rice', 0, 2, 1), null);
  assert.equal(menu.placeBento([carrot, carrot], 'rice', 0, 2, 1), null);
  assert.equal(menu.bentoComplete([carrot, carrot, carrot, carrot]), false);
});
