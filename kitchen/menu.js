(function (root) {
  'use strict';

  const DAY_COUNT = 5;

  function recipe(id, name, price, sequence, color, day, ingredient, method, tags, usesRice = false) {
    return Object.freeze({
      id, name, price, sequence: Object.freeze(sequence), color, day, ingredient, method,
      tags: Object.freeze(tags), usesRice
    });
  }

  const RECIPES = Object.freeze([
    recipe('onigiri', '梅子饭团', 14, ['up', 'right', 'down'], '#e7e4c9', 1,
      '梅子', '捏制', ['清淡'], true),
    recipe('omurice', '番茄蛋包饭', 22, ['left', 'up', 'right', 'down'], '#f1ba67', 1,
      '鸡蛋', '香煎', ['浓香'], true),
    recipe('curry', '金黄咖喱饭', 30, ['up', 'left', 'down', 'right', 'up'], '#c78b46', 2,
      '土豆', '慢炖', ['浓香', '辛辣'], true),
    recipe('miso', '豆腐味噌汤', 19, ['down', 'right', 'up', 'left'], '#b88b62', 2,
      '味噌', '煮汤', ['清淡', '汤菜']),
    recipe('ginger-pork', '生姜烧肉', 32, ['left', 'down', 'right', 'up', 'right'], '#a7604b', 3,
      '猪肉', '香煎', ['浓香']),
    recipe('tempura', '鲜虾天妇罗', 34, ['up', 'down', 'left', 'right', 'down'], '#ecae63', 3,
      '鲜虾', '油炸', ['香脆', '油炸']),
    recipe('tofu', '香煎豆腐', 24, ['right', 'left', 'up', 'down'], '#d6b272', 4,
      '豆腐', '香煎', ['清淡', '香脆']),
    recipe('noodles', '海带乌冬面', 33, ['down', 'up', 'right', 'left', 'up'], '#c7a47d', 4,
      '乌冬面', '煮汤', ['清淡', '汤菜']),
    recipe('salmon', '照烧三文鱼', 38, ['right', 'up', 'down', 'left', 'down'], '#e58465', 5,
      '三文鱼', '香煎', ['浓香']),
    recipe('mochi', '红豆糯米团', 28, ['up', 'left', 'right', 'down', 'left'], '#d89d9e', 5,
      '糯米', '捏制', ['清淡', '甜点'], true)
  ]);

  function taste(id, text, required, forbidden) {
    return Object.freeze({
      id, text, required: Object.freeze(required), forbidden: Object.freeze(forbidden)
    });
  }

  const TASTES = Object.freeze([
    taste('light', '想吃清淡一点的，今天不吃辣。', ['清淡'], ['辛辣']),
    taste('crispy', '想吃点香脆的，先不喝汤。', ['香脆'], ['汤菜']),
    taste('soup', '想喝一碗热汤，口味别辣。', ['汤菜'], ['辛辣']),
    taste('savory', '想来份浓香的，别油炸。', ['浓香'], ['油炸'])
  ]);

  function recipesForDay(day) {
    return Number.isInteger(day) ? RECIPES.filter(recipe => recipe.day <= day) : [];
  }

  function findRecipe(ingredient, method, day) {
    return recipesForDay(day).find(recipe => recipe.ingredient === ingredient && recipe.method === method) || null;
  }

  function matchesTaste(recipe, taste) {
    if (!Array.isArray(recipe?.tags) || !Array.isArray(taste?.required) ||
        !Array.isArray(taste?.forbidden)) return false;
    return taste.required.every(tag => recipe.tags.includes(tag)) &&
      !taste.forbidden.some(tag => recipe.tags.includes(tag));
  }

  function piece(id, name, color, cells) {
    return Object.freeze({ id, name, color, cells: Object.freeze(cells.map(cell => Object.freeze(cell))) });
  }

  const BENTO = Object.freeze({
    width: 4,
    height: 3,
    reserved: Object.freeze({ x: 3, y: 2 }),
    pieces: Object.freeze([
      piece('main', '生姜烧肉', '#ae6550', [[0, 0], [0, 1], [1, 1], [0, 2]]),
      piece('greens', '小青菜', '#799558', [[0, 0], [1, 0], [0, 1]]),
      piece('carrot', '胡萝卜', '#e69958', [[0, 0]]),
      piece('rice', '白米饭', '#f5dfbd', [[0, 0], [0, 1], [0, 2]])
    ])
  });

  function bentoCells(pieceId, rotation) {
    const shape = BENTO.pieces.find(piece => piece.id === pieceId);
    if (!shape || !Number.isInteger(rotation) || rotation < 0 || rotation > 3) return [];

    let cells = shape.cells;
    for (let turn = 0; turn < rotation; turn++) {
      cells = cells.map(([x, y]) => [-y, x]);
    }
    const left = Math.min(...cells.map(([x]) => x));
    const top = Math.min(...cells.map(([, y]) => y));
    return cells.map(([x, y]) => [x - left, y - top])
      .sort(([x1, y1], [x2, y2]) => y1 - y2 || x1 - x2);
  }

  function createPlacement(pieceId, x, y, rotation) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    const cells = bentoCells(pieceId, rotation).map(([dx, dy]) => [x + dx, y + dy]);
    if (!cells.length || cells.some(([column, row]) =>
      column < 0 || column >= BENTO.width || row < 0 || row >= BENTO.height ||
      (column === BENTO.reserved.x && row === BENTO.reserved.y)
    )) return null;
    return { pieceId, x, y, rotation, cells };
  }

  function sameCell([x, y], other) {
    return Array.isArray(other) && other.length === 2 && x === other[0] && y === other[1];
  }

  function overlaps(placement, placements) {
    return placements.some(other =>
      placement.cells.some(cell => other.cells.some(otherCell => sameCell(cell, otherCell)))
    );
  }

  function validatePlacements(placements) {
    if (!Array.isArray(placements) || placements.length > BENTO.pieces.length) return null;

    const valid = [];
    for (const entry of placements) {
      if (!entry || !Array.isArray(entry.cells)) return null;
      const placement = createPlacement(entry.pieceId, entry.x, entry.y, entry.rotation);
      if (!placement || placement.cells.length !== entry.cells.length ||
          !placement.cells.every(cell => entry.cells.some(other => sameCell(cell, other))) ||
          valid.some(other => other.pieceId === placement.pieceId) ||
          overlaps(placement, valid)) return null;
      valid.push(placement);
    }
    return valid;
  }

  function placeBento(placements, pieceId, x, y, rotation) {
    const valid = validatePlacements(placements);
    const placement = createPlacement(pieceId, x, y, rotation);
    if (!valid || !placement) return null;

    const others = valid.filter(other => other.pieceId !== pieceId);
    if (overlaps(placement, others)) return null;
    return [...others, placement];
  }

  function bentoComplete(placements) {
    return validatePlacements(placements)?.length === BENTO.pieces.length;
  }

  const api = Object.freeze({
    DAY_COUNT, RECIPES, TASTES, BENTO, recipesForDay, findRecipe, matchesTaste,
    bentoCells, placeBento, bentoComplete
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KitchenMenu = api;
})(globalThis);
