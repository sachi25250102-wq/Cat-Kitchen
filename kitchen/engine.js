(function (root, factory) {
  'use strict';
  const menu = typeof module === 'object' && module.exports ? require('./menu.js') : root.KitchenMenu;
  const engine = factory(menu);
  if (typeof module === 'object' && module.exports) module.exports = engine;
  root.KitchenEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (menu) {
  'use strict';

  const { RECIPES, DAY_COUNT, TASTES } = menu;
  const RECIPES_BY_ID = Object.fromEntries(RECIPES.map(recipe => [recipe.id, recipe]));
  const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
  const EPSILON = 0.000001;
  const WARM_SECONDS = 14;
  const RICE_CAPACITY = 3;
  const RICE_SECONDS = 16;

  function boundedInteger(value, minimum, maximum, fallback) {
    return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
  }

  function resetDish(dish) {
    Object.assign(dish, { status: 'chop', progress: 0, heat: 0, grade: null, warmth: 0 });
  }

  function newStats() {
    return { perfect: 0, burned: 0, pests: 0, assists: 0, sets: 0, tastes: 0, bentos: 0, cold: 0 };
  }

  function createGame(options = {}) {
    const random = typeof options.random === 'function' ? options.random : Math.random;
    let ticketId = 0;
    let feedbackId = 0;
    let pestClock = 16;
    let visitors = 0;
    let recipeCursor = 0;
    let kindCursor = 0;
    let tasteCursor = 0;
    let unlocked = menu.recipesForDay(1);
    let kinds = ['single'];
    const state = {
      phase: 'menu', day: 1, practice: false, timeLeft: 90,
      coins: 0, score: 0, served: 0, missed: 0, combo: 0, bestCombo: 0,
      orders: [], selectedId: null, selectedDish: null, recipeId: null,
      step: 'select', sequence: [], progress: 0, heat: 0, grade: null,
      pots: [null], availableRecipeIds: unlocked.map(recipe => recipe.id),
      rice: null, riceCapacity: 0, riceRefill: 0, pest: null, helper: null,
      feedback: { text: '欢迎来到小满食堂', tone: 'info', id: 0 },
      stats: newStats(),
      upgrades: { stove: 0, patience: 0, charm: 0 }
    };

    function roll() {
      const value = random();
      return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0.5;
    }

    function feedback(text, tone = 'info') {
      state.feedback = { text, tone, id: ++feedbackId };
    }

    function selectedOrder() {
      return state.orders.find(order => order.id === state.selectedId);
    }

    function syncSelection() {
      const order = selectedOrder();
      const dish = order?.dishes[state.selectedDish];
      if (!dish) {
        Object.assign(state, {
          selectedId: null, selectedDish: null, recipeId: null,
          step: 'select', sequence: [], progress: 0, heat: 0, grade: null
        });
        return;
      }
      state.recipeId = dish.recipeId;
      state.sequence = dish.recipeId ? RECIPES_BY_ID[dish.recipeId].sequence : [];
      state.progress = dish.progress;
      state.heat = dish.heat;
      state.grade = dish.grade;
      if (!dish.recipeId) state.step = 'taste';
      else if (dish.status === 'ready' && order.bento && !order.bento.complete) state.step = 'bento';
      else state.step = dish.status;
    }

    function clearSelection() {
      state.selectedId = null;
      syncSelection();
    }

    function nextRecipe() {
      // A rice shortage gives fresh tickets for recipes the player can cook immediately.
      for (let i = 0; i < unlocked.length; i += 1) {
        const recipe = unlocked[recipeCursor++ % unlocked.length];
        if (state.rice !== 0 || !recipe.usesRice) return recipe;
      }
      return unlocked[0];
    }

    function addOrder(kind, recipes = []) {
      let taste = null;
      let bento = null;
      if (kind === 'taste') {
        taste = TASTES[tasteCursor++ % TASTES.length];
        recipes = [null];
      } else if (kind === 'combo') {
        if (!recipes.length) {
          const first = nextRecipe();
          let second = nextRecipe();
          if (second === first) second = unlocked.find(recipe => recipe !== first && (state.rice !== 0 || !recipe.usesRice));
          recipes = [first, second];
        }
      } else if (kind === 'bento') {
        recipes = [RECIPES_BY_ID['ginger-pork']];
        bento = { placements: [], complete: false };
      } else {
        if (!recipes.length) recipes = [nextRecipe()];
      }
      const maxWarmth = kind === 'combo' ? WARM_SECONDS : 0;
      const dishes = recipes.map(recipe => ({
        recipeId: recipe?.id ?? null, status: 'chop', progress: 0, heat: 0,
        grade: null, warmth: 0, maxWarmth
      }));
      const basePatience = 38 - (state.day - 1) * 4 + state.upgrades.patience * 6;
      const maxPatience = basePatience + (kind === 'single' ? 0 : kind === 'bento' ? 24 : 12);
      state.orders.push({
        id: ++ticketId, recipeId: dishes[0].recipeId, kind, patience: maxPatience, maxPatience,
        dishes, taste, bento
      });
    }

    function restock() {
      while (state.orders.length < 3) {
        const kind = kinds[kindCursor++ % kinds.length];
        addOrder(kind === 'bento' && state.rice === 0 ? 'single' : kind);
      }
    }

    function start({ day = 1, practice = false, upgrades = {} } = {}) {
      const safeUpgrades = upgrades && typeof upgrades === 'object' ? upgrades : {};
      const dayNumber = boundedInteger(day, 1, DAY_COUNT, 1);
      const riceCapacity = dayNumber >= 4 ? RICE_CAPACITY : 0;
      unlocked = menu.recipesForDay(dayNumber);
      kinds = ['single', 'single'];
      if (dayNumber >= 3) kinds.push('combo', 'single');
      if (dayNumber >= 4) kinds.push('taste', 'single');
      if (dayNumber >= 5) kinds.push('bento', 'single');
      recipeCursor = 0;
      kindCursor = 0;
      tasteCursor = 0;
      visitors = 0;
      Object.assign(state, {
        phase: 'playing', day: dayNumber, practice: Boolean(practice), timeLeft: 90,
        coins: 0, score: 0, served: 0, missed: 0, combo: 0, bestCombo: 0,
        orders: [], pots: Array(dayNumber === 1 ? 1 : 2).fill(null),
        availableRecipeIds: unlocked.map(recipe => recipe.id), stats: newStats(),
        rice: riceCapacity || null, riceCapacity, riceRefill: 0,
        pest: practice && riceCapacity ? { remaining: 5, kind: 'sparrow' } : null, helper: null,
        upgrades: {
          stove: boundedInteger(safeUpgrades.stove, 0, 3, 0),
          patience: boundedInteger(safeUpgrades.patience, 0, 3, 0),
          charm: boundedInteger(safeUpgrades.charm, 0, 3, 0)
        }
      });
      clearSelection();
      addOrder('single', [RECIPES_BY_ID.onigiri]);
      const second = dayNumber >= 4 ? unlocked.find(recipe => recipe.day === dayNumber && !recipe.usesRice) : RECIPES_BY_ID.omurice;
      addOrder('single', [second]);
      if (dayNumber === 2) addOrder('single', [RECIPES_BY_ID.curry]);
      else if (dayNumber === 3) addOrder('combo', unlocked.filter(recipe => recipe.day === 3));
      else if (dayNumber === 4) addOrder('taste');
      else if (dayNumber === 5) addOrder('bento');
      else restock();
      pestClock = state.practice ? Infinity : 12 + roll() * 8;
      feedback(state.practice ? '慢慢来，先选一张订单练练手。' : '第 ' + state.day + ' 天开店！先选一张订单吧。');
      return state;
    }

    function selectOrder(id, dishIndex = state.selectedId === id ? state.selectedDish : 0) {
      if (state.phase !== 'playing') return false;
      const order = state.orders.find(ticket => ticket.id === id);
      if (!order || !Number.isInteger(dishIndex) || !order.dishes[dishIndex]) return false;
      if (state.selectedId === id && state.selectedDish === dishIndex) return true;
      if (state.day === 1 && state.step === 'cook') {
        feedback('锅里还有料理，先照看好火候。', 'warning');
        return false;
      }
      if (state.day === 1) {
        const previous = selectedOrder()?.dishes[state.selectedDish];
        if (previous) resetDish(previous);
      }
      state.selectedId = id;
      state.selectedDish = dishIndex;
      syncSelection();
      if (state.step === 'taste') feedback(order.taste.text);
      else if (state.step === 'chop') feedback(RECIPES_BY_ID[state.recipeId].name + '：照着方向切菜吧。');
      return true;
    }

    function selectDish(index) {
      return selectOrder(state.selectedId, index);
    }

    function chooseTaste(ingredient, method) {
      if (state.phase !== 'playing' || state.step !== 'taste') return false;
      const order = selectedOrder();
      const recipe = menu.findRecipe(ingredient, method, state.day);
      if (!recipe || !menu.matchesTaste(recipe, order.taste)) {
        feedback(recipe ? '这道菜不合客人的口味，换一种试试。' : '这种食材和做法搭不起来，换一种试试。', 'warning');
        return false;
      }
      order.recipeId = recipe.id;
      order.dishes[0].recipeId = recipe.id;
      syncSelection();
      feedback(recipe.name + '正合口味，开始切菜吧！', 'success');
      return true;
    }

    function spendRice() {
      if (state.rice === state.riceCapacity) state.riceRefill = RICE_SECONDS;
      state.rice -= 1;
    }

    function loadPot(order, dishIndex) {
      const dish = order.dishes[dishIndex];
      const index = state.pots.indexOf(null);
      const needsRice = state.rice !== null && (order.kind === 'bento' || RECIPES_BY_ID[dish.recipeId].usesRice);
      if (index === -1 || (needsRice && state.rice === 0)) {
        dish.status = 'waiting';
        feedback(index === -1 ? '锅都占满了，空出一口锅后再下锅。' : '米饭用完了，补好后再下锅。', 'warning');
        return false;
      }
      if (needsRice) spendRice();
      dish.status = 'cook';
      state.pots[index] = { orderId: order.id, dishIndex, recipeId: dish.recipeId, heat: 0 };
      feedback('食材下锅！指针进入绿色时按空格。', 'success');
      return true;
    }

    function input(direction) {
      if (state.phase !== 'playing' || state.step !== 'chop' || !DIRECTIONS.has(direction)) return;
      const order = selectedOrder();
      const dish = order.dishes[state.selectedDish];
      if (direction !== state.sequence[dish.progress]) {
        dish.progress = 0;
        state.combo = 0;
        state.score = Math.max(0, state.score - 5);
        feedback('切错啦，从第一个方向重新来。', 'error');
      } else {
        dish.progress += 1;
        if (dish.progress === state.sequence.length) loadPot(order, state.selectedDish);
        else feedback('咚！切得不错。', 'success');
      }
      syncSelection();
    }

    function ticketReady(order) {
      return order.dishes.every(dish => dish.status === 'ready' && (!dish.maxWarmth || dish.warmth > EPSILON)) &&
        (!order.bento || order.bento.complete);
    }

    function serve(order, assisted = false) {
      if (!ticketReady(order)) return false;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      let coins = Math.min(5, state.combo - 1);
      let score = Math.min(10, state.combo - 1) * 15;
      for (const dish of order.dishes) {
        const perfect = dish.grade === 'perfect';
        coins += RECIPES_BY_ID[dish.recipeId].price + (perfect ? 4 : 0) + state.upgrades.charm * 2;
        score += perfect ? 150 : 100;
        if (perfect) state.stats.perfect += 1;
      }
      state.coins += coins;
      state.score += score;
      state.served += order.dishes.length;
      if (order.kind === 'combo') state.stats.sets += 1;
      if (order.kind === 'taste') state.stats.tastes += 1;
      if (order.kind === 'bento') state.stats.bentos += 1;
      if (assisted) {
        state.helper = null;
        state.stats.assists += 1;
      }
      state.orders = state.orders.filter(ticket => ticket.id !== order.id);
      syncSelection();
      restock();
      const name = order.kind === 'combo' ? '套餐' : order.kind === 'bento' ? '便当' : RECIPES_BY_ID[order.recipeId].name;
      feedback((assisted ? '小麻雀帮忙送出了' : '') + name + '！+' + coins + ' 金币', 'success');
      return true;
    }

    function finishPot(index) {
      if (state.phase !== 'playing' || !Number.isInteger(index)) return false;
      const pot = state.pots[index];
      if (!pot) return false;
      const order = state.orders.find(ticket => ticket.id === pot.orderId);
      const dish = order.dishes[pot.dishIndex];
      if (pot.heat < 0.42 - EPSILON || pot.heat > 0.72 + EPSILON) {
        state.combo = 0;
        state.score = Math.max(0, state.score - 8);
        feedback(pot.heat < 0.42 ? '还没熟，等指针进入绿色再试一次。' : '火有点大了，要在绿色区间出锅哦。', 'warning');
        return false;
      }
      dish.grade = pot.heat >= 0.52 - EPSILON && pot.heat <= 0.62 + EPSILON ? 'perfect' : 'good';
      dish.status = 'ready';
      dish.warmth = dish.maxWarmth;
      state.pots[index] = null;
      syncSelection();
      if (state.helper && serve(order, true)) return true;
      if (order.kind === 'bento') feedback('菜做好了，把四样配菜装进便当盒。', 'success');
      else if (!ticketReady(order)) feedback('一道菜好了，趁热把套餐的另一道做好。', 'success');
      else feedback(dish.grade === 'perfect' ? '完美火候！再按空格出餐。' : '香喷喷出锅！再按空格出餐。', 'success');
      return true;
    }

    function action() {
      if (state.phase !== 'playing') return;
      const order = selectedOrder();
      if (!order) {
        feedback('先点一张订单，或按 1、2、3 选单。');
        return;
      }
      if (state.step === 'waiting') {
        loadPot(order, state.selectedDish);
        syncSelection();
      } else if (state.step === 'cook') {
        const index = state.pots.findIndex(pot => pot?.orderId === order.id && pot.dishIndex === state.selectedDish);
        finishPot(index);
      } else if (state.step === 'ready') {
        if (!serve(order)) {
          const unfinished = order.dishes.findIndex(dish => dish.status !== 'ready');
          if (unfinished >= 0) selectDish(unfinished);
        }
      } else if (state.step === 'bento') feedback('先把四样配菜装进便当盒，留好甜点格。');
    }

    function editableBento() {
      const order = selectedOrder();
      return state.phase === 'playing' && order?.bento && order.dishes[0].status === 'ready' ? order : null;
    }

    function placeBento(pieceId, x, y, rotation) {
      const order = editableBento();
      if (!order) return false;
      const placements = menu.placeBento(order.bento.placements, pieceId, x, y, rotation);
      if (!placements) {
        feedback('放不下，要避开其他配菜和甜点格。', 'warning');
        return false;
      }
      order.bento.placements = placements;
      order.bento.complete = menu.bentoComplete(placements);
      syncSelection();
      if (order.bento.complete) {
        if (state.helper && serve(order, true)) return true;
        feedback('便当装好了！按空格出餐。', 'success');
      } else feedback('配菜放好了。', 'success');
      return true;
    }

    function removeBento(pieceId) {
      const order = editableBento();
      if (!order || !order.bento.placements.some(piece => piece.pieceId === pieceId)) return false;
      order.bento.placements = order.bento.placements.filter(piece => piece.pieceId !== pieceId);
      order.bento.complete = false;
      syncSelection();
      return true;
    }

    function resetBento() {
      const order = editableBento();
      if (!order) return false;
      order.bento.placements = [];
      order.bento.complete = false;
      syncSelection();
      return true;
    }

    function shoo() {
      if (state.phase !== 'playing' || !state.pest) return;
      state.pest = null;
      state.stats.pests += 1;
      state.coins += 2;
      state.score += 10;
      feedback('小馋鬼跑走啦！+2 金币', 'success');
    }

    function feedPest() {
      if (state.phase !== 'playing' || state.day < 4 || state.pest?.kind !== 'sparrow' || state.helper) return false;
      if (!state.rice) {
        feedback('米饭用完了，等补好再喂麻雀。', 'warning');
        return false;
      }
      spendRice();
      state.pest = null;
      state.helper = { kind: 'sparrow' };
      feedback('小麻雀吃饱啦，下次料理齐了会帮你送餐。', 'success');
      return true;
    }

    function expireOrders() {
      const expired = state.orders.filter(order => order.patience <= EPSILON);
      if (!expired.length) return;
      const ids = new Set(expired.map(order => order.id));
      state.missed += expired.length;
      state.combo = 0;
      state.score = Math.max(0, state.score - expired.length * 25);
      state.orders = state.orders.filter(order => !ids.has(order.id));
      state.pots = state.pots.map(pot => pot && ids.has(pot.orderId) ? null : pot);
      syncSelection();
      restock();
      feedback('有客人等不及离开了，新订单已经送到。', 'warning');
    }

    function coolDishes() {
      for (const order of state.orders) {
        for (const dish of order.dishes) {
          if (dish.status !== 'ready' || !dish.maxWarmth || dish.warmth > EPSILON) continue;
          resetDish(dish);
          state.stats.cold += 1;
          state.combo = 0;
          feedback(RECIPES_BY_ID[dish.recipeId].name + '凉了，重新做这道菜就好。', 'warning');
        }
      }
    }

    function heatDuration() {
      return 2.8 + state.upgrades.stove * 0.45;
    }

    function burnPots() {
      state.pots.forEach((pot, index) => {
        if (!pot || pot.heat < 1 - EPSILON) return;
        const order = state.orders.find(ticket => ticket.id === pot.orderId);
        resetDish(order.dishes[pot.dishIndex]);
        state.pots[index] = null;
        state.stats.burned += 1;
        state.combo = 0;
        state.score = Math.max(0, state.score - 15);
        feedback('哎呀，糊锅了！这道菜重新切菜就好。', 'error');
      });
    }

    function clearShiftWork() {
      for (const order of state.orders) {
        for (const dish of order.dishes) resetDish(dish);
        if (order.bento) order.bento = { placements: [], complete: false };
      }
      state.pots.fill(null);
      state.pest = null;
      state.helper = null;
      clearSelection();
    }

    function tick(seconds) {
      if (state.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
      let remaining = state.practice ? seconds : Math.min(seconds, state.timeLeft);
      const duration = heatDuration();
      // Advance to the next event across both burners and every waiting dish.
      while (remaining > EPSILON && state.phase === 'playing') {
        const refilling = state.rice !== null && state.rice < state.riceCapacity;
        let delta = remaining;
        if (!state.practice) {
          delta = Math.min(delta, state.timeLeft, pestClock);
          if (state.pest) delta = Math.min(delta, Math.max(0, state.pest.remaining));
        }
        if (refilling) delta = Math.min(delta, state.riceRefill);
        for (const pot of state.pots) if (pot) delta = Math.min(delta, Math.max(0, (1 - pot.heat) * duration));
        for (const order of state.orders) {
          if (!state.practice) delta = Math.min(delta, Math.max(0, order.patience));
          for (const dish of order.dishes) {
            if (dish.status === 'ready' && dish.maxWarmth) delta = Math.min(delta, dish.warmth);
          }
        }

        remaining = Math.max(0, remaining - delta);
        if (!state.practice) {
          state.timeLeft = Math.max(0, state.timeLeft - delta);
          pestClock -= delta;
          if (state.pest) state.pest.remaining = Math.max(0, state.pest.remaining - delta);
        }
        if (refilling) state.riceRefill = Math.max(0, state.riceRefill - delta);
        for (const order of state.orders) {
          if (!state.practice) order.patience = Math.max(0, order.patience - delta);
          for (const dish of order.dishes) {
            if (dish.status === 'ready' && dish.maxWarmth) dish.warmth = Math.max(0, dish.warmth - delta);
          }
        }
        for (const pot of state.pots) {
          if (!pot) continue;
          pot.heat = Math.min(1, pot.heat + delta / duration);
          const order = state.orders.find(ticket => ticket.id === pot.orderId);
          order.dishes[pot.dishIndex].heat = pot.heat;
        }

        if (!state.practice && state.timeLeft <= EPSILON) {
          state.timeLeft = 0;
          state.phase = 'summary';
          clearShiftWork();
          feedback('今天辛苦啦！看看小店的营业成果吧。', 'success');
          break;
        }
        if (refilling && state.riceRefill <= EPSILON) {
          state.rice += 1;
          state.riceRefill = state.rice < state.riceCapacity ? RICE_SECONDS : 0;
        }
        if (!state.practice) {
          if (state.pest && state.pest.remaining <= EPSILON) {
            state.pest = null;
            for (const order of state.orders) order.patience = Math.max(0, order.patience - 8);
            state.combo = 0;
            feedback('小馋鬼偷吃了一口，客人有点着急了。', 'warning');
          }
          expireOrders();
        }
        burnPots();
        coolDishes();
        if (pestClock <= EPSILON) {
          const kind = (state.day >= 4 && visitors === 0) || roll() < 0.5 ? 'sparrow' : 'tanuki';
          state.pest = { remaining: 5, kind };
          visitors += 1;
          pestClock = 12 + roll() * 8;
          feedback('小馋鬼来了！按 F 或点它，赶快保护食材。', 'warning');
        }
        syncSelection();
      }
    }

    function pause() {
      if (state.phase === 'playing') state.phase = 'paused';
    }

    function resume() {
      if (state.phase === 'paused') state.phase = 'playing';
    }

    function quit() {
      state.phase = 'menu';
      clearShiftWork();
    }

    return {
      state, start, selectOrder, selectDish, chooseTaste, input, action, finishPot,
      placeBento, removeBento, resetBento, shoo, feedPest, tick, pause, resume, quit
    };
  }

  return { RECIPES, DAY_COUNT, createGame };
});
