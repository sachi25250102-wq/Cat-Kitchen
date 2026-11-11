/* 小满食堂 —— Canvas 厨房舞台。
   只负责画面：背景、猫厨师、砧板、锅、出餐托盘、小馋鬼和粒子动效。
   所有数值都由 game.js 从 game.state 读出后传入，这里不保存任何游戏状态。
   全局 KitchenStage.create(canvas, options) → { draw(view, now), emit(name, data), setCalm(boolean) }。 */
(function (root) {
  'use strict';

  var W = 1536;
  var H = 1024;
  var COUNTER_Y = 690; // 背景图里前柜台台面的上沿

  var C = {
    ink: '#382c2a', dark: '#513d35', cream: '#fff1d2', white: '#fff9e8',
    sage: '#73977a', leaf: '#42694f', red: '#c55743', gold: '#f1ba67',
    orange: '#d88b49', brown: '#9b663e', wood: '#c58d58', woodLight: '#e0af74',
    fur: '#8a5a3c', furLight: '#a9744a', petalA: '#f6b9c6', petalB: '#ffdbe2'
  };

  // 舞台坐标（1536 × 1024）。game.js 里按同一组数字摆放 DOM 提示。
  // 砧板、锅、菜和小动物都取整数或半整数倍率，阶梯椭圆的每一行才不会出现缝隙。
  var BOARD = { x: 140, y: 686, w: 360, h: 200 };
  var PAN = { x: 684, y: 576, size: 320 };
  var DUAL_PANS = [{ x: 640, y: 610, size: 244 }, { x: 884, y: 610, size: 244 }];
  var TRAY = { x: 1124, y: 716, w: 268 };
  var PEST = { x: 506, y: 700, scale: 2.5 };
  var CHEF = { scale: 3.2, y: 330, idle: 596, chop: 320, cook: 845 };
  var PANES = [
    { x: 258, y: 300, w: 214, h: 248 },
    { x: 496, y: 300, w: 194, h: 248 }
  ];

  function block(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // 与 art.js 相同的阶梯椭圆，放大后边缘仍是方块。
  function oval(c, x, y, w, h, color, step) {
    step = step || 2;
    c.fillStyle = color;
    for (var yy = 0; yy < h; yy += step) {
      var ny = ((yy + Math.min(step, h - yy) / 2) / h) * 2 - 1;
      var half = Math.sqrt(Math.max(0, 1 - ny * ny)) * w / 2;
      var left = Math.round((w / 2 - half) / step) * step;
      c.fillRect(x + left, y + yy, Math.max(step, w - left * 2), Math.min(step, h - yy));
    }
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // 原创狸猫：圆身子、深色眼罩、环纹尾巴，头顶一片叶子。70 × 70 的本地坐标。
  function drawTanuki(c, x, y, scale, time) {
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(Math.round(x), Math.round(y));
    c.scale(scale, scale);
    oval(c, 10, 61, 50, 7, 'rgba(56,44,42,0.16)');
    c.translate(0, -Math.round(Math.max(0, Math.sin(time / 230)) * 3));
    oval(c, 0, 32, 28, 28, C.ink);
    oval(c, 2, 34, 24, 24, C.fur);
    block(c, 4, 40, 20, 4, C.dark);
    block(c, 4, 48, 20, 4, C.dark);
    oval(c, 14, 30, 46, 34, C.ink);
    oval(c, 16, 32, 42, 30, C.fur);
    oval(c, 25, 40, 24, 20, C.woodLight);
    block(c, 14, 4, 14, 14, C.ink);
    block(c, 16, 6, 10, 10, C.fur);
    block(c, 19, 9, 4, 5, C.dark);
    block(c, 46, 4, 14, 14, C.ink);
    block(c, 48, 6, 10, 10, C.fur);
    block(c, 51, 9, 4, 5, C.dark);
    oval(c, 12, 8, 50, 36, C.ink);
    oval(c, 14, 10, 46, 32, C.furLight);
    oval(c, 16, 17, 20, 14, C.dark);
    oval(c, 38, 17, 20, 14, C.dark);
    block(c, 23, 21, 6, 6, C.white);
    block(c, 26, 22, 3, 4, C.ink);
    block(c, 45, 21, 6, 6, C.white);
    block(c, 45, 22, 3, 4, C.ink);
    oval(c, 28, 24, 18, 16, C.cream);
    block(c, 34, 27, 6, 4, C.ink);
    block(c, 36, 31, 2, 3, C.ink);
    block(c, 33, 34, 8, 2, C.ink);
    block(c, 31, 2, 12, 7, C.leaf);
    block(c, 33, 0, 8, 5, C.sage);
    block(c, 36, 8, 2, 4, C.leaf);
    block(c, 22, 56, 11, 8, C.ink);
    block(c, 24, 58, 7, 4, C.dark);
    block(c, 41, 56, 11, 8, C.ink);
    block(c, 43, 58, 7, 4, C.dark);
    c.restore();
  }

  function create(canvas, options) {
    options = options || {};
    var ctx = canvas.getContext('2d');
    var art = root.KitchenArt || null;
    var calm = Boolean(options.calm);
    var bg = new Image();
    var bgReady = false;
    var particles = [];
    var windowPetals = [];
    var roomPetals = [];
    var lastNow = 0;
    var clock = 0; // 暂停时停住的动画时钟（毫秒）
    var fx = null;

    bg.onload = function () { bgReady = true; };
    bg.src = options.background || 'assets/kitchen.png';

    function resetFx() {
      fx = {
        chefX: CHEF.idle, chopAt: -9999, wrongAt: -9999, bellAt: -9999,
        shakeUntil: 0, happyUntil: 0, sweatUntil: 0, fly: null, pest: null
      };
      particles.length = 0;
    }

    function seed() {
      var i;
      for (i = 0; i < 16; i++) {
        var pane = PANES[i % 2];
        windowPetals.push({
          pane: pane, x: rand(pane.x, pane.x + pane.w), y: rand(pane.y, pane.y + pane.h),
          vy: rand(22, 46), drift: rand(8, 22), phase: rand(0, 6.28),
          size: i % 3 === 0 ? 8 : 6, color: i % 2 ? C.petalA : C.petalB
        });
      }
      for (i = 0; i < 5; i++) {
        roomPetals.push({
          x: rand(0, W), y: rand(0, H), vy: rand(34, 58), vx: rand(-26, -10),
          phase: rand(0, 6.28), size: 10, color: i % 2 ? C.petalA : C.petalB
        });
      }
    }

    resetFx();
    seed();

    /* ---------- 粒子 ---------- */

    function spawn(count, make) {
      for (var i = 0; i < count && particles.length < 260; i++) particles.push(make(i));
    }

    function stepParticles(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    function drawParticles() {
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = Math.min(1, p.life / p.fade);
        block(ctx, p.x, p.y, p.size, p.size, p.color);
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 背景与氛围 ---------- */

    function drawBackground() {
      if (bgReady) {
        ctx.drawImage(bg, 0, 0, W, H);
        return;
      }
      // 背景图没读到时的替代：纯色墙、窗和柜台，保证还能玩。
      block(ctx, 0, 0, W, H, '#6b4631');
      block(ctx, 0, 0, W, 170, C.red);
      block(ctx, 190, 176, 510, 380, '#e9a7b4');
      block(ctx, 0, 590, W, 100, '#7d5236');
    }

    function drawCounter() {
      if (bgReady) ctx.drawImage(bg, 0, COUNTER_Y, W, H - COUNTER_Y, 0, COUNTER_Y, W, H - COUNTER_Y);
      else {
        block(ctx, 0, COUNTER_Y, W, 272, C.wood);
        block(ctx, 0, COUNTER_Y, W, 8, C.woodLight);
        block(ctx, 0, 962, W, 62, '#7d3a1c');
      }
    }

    function drawGlow(t) {
      var pulse = calm ? 0 : Math.sin(t / 700) * 0.025 + Math.sin(t / 233) * 0.012;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      [[150, 236, 190, 0.13], [212, 548, 110, 0.1]].forEach(function (lamp) {
        var glow = ctx.createRadialGradient(lamp[0], lamp[1], 8, lamp[0], lamp[1], lamp[2]);
        glow.addColorStop(0, 'rgba(255,196,110,' + (lamp[3] + pulse) + ')');
        glow.addColorStop(1, 'rgba(255,196,110,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(lamp[0] - lamp[2], lamp[1] - lamp[2], lamp[2] * 2, lamp[2] * 2);
      });
      ctx.restore();
    }

    function drawWindowPetals(dt, t) {
      if (calm) return;
      for (var i = 0; i < windowPetals.length; i++) {
        var p = windowPetals[i];
        p.y += p.vy * dt;
        p.x += Math.sin(t / 900 + p.phase) * p.drift * dt;
        if (p.y > p.pane.y + p.pane.h - p.size) {
          p.y = p.pane.y;
          p.x = rand(p.pane.x, p.pane.x + p.pane.w - p.size);
        }
        var x = Math.max(p.pane.x, Math.min(p.pane.x + p.pane.w - p.size, p.x));
        block(ctx, x, p.y, p.size, p.size, p.color);
      }
    }

    function drawRoomPetals(dt, t) {
      if (calm) return;
      for (var i = 0; i < roomPetals.length; i++) {
        var p = roomPetals[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(t / 700 + p.phase) * 30) * dt;
        if (p.y > H + 12 || p.x < -12) {
          p.y = -12;
          p.x = rand(W * 0.2, W);
        }
        block(ctx, p.x, p.y, p.size, p.size, p.color);
        block(ctx, p.x + 4, p.y + 4, 6, 6, C.petalA);
      }
    }

    /* ---------- 角色与道具 ---------- */

    function chef(x, y, scale, t, mood) {
      if (art) { art.drawChef(ctx, x, y, scale, t, mood); return; }
      block(ctx, x + 20 * scale, y + 30 * scale, 60 * scale, 100 * scale, C.cream);
      block(ctx, x + 26 * scale, y + 4 * scale, 48 * scale, 30 * scale, C.white);
      block(ctx, x + 30 * scale, y + 52 * scale, 8 * scale, 8 * scale, C.ink);
      block(ctx, x + 62 * scale, y + 52 * scale, 8 * scale, 8 * scale, C.ink);
    }

    function dish(id, x, y, size) {
      if (art) { art.drawDish(ctx, id, x, y, size); return; }
      oval(ctx, x, y + size * 0.3, size, size * 0.5, C.white, 4);
      oval(ctx, x + size * 0.2, y + size * 0.36, size * 0.6, size * 0.32, C.gold, 4);
    }

    function drawChefBehind(view, t, dt) {
      var target = view.step === 'chop' ? CHEF.chop
        : (view.step === 'cook' || view.step === 'ready') ? CHEF.cook : CHEF.idle;
      fx.chefX += (target - fx.chefX) * (1 - Math.exp(-dt * 9));
      if (Math.abs(target - fx.chefX) < 0.6) fx.chefX = target;
      var dip = t - fx.chopAt < 90 ? 10 : 0;
      var x = fx.chefX - 50 * CHEF.scale;
      chef(x, CHEF.y + dip, CHEF.scale, t, t < fx.happyUntil ? 'happy' : 'idle');
      if (t < fx.sweatUntil) {
        var drop = Math.floor((fx.sweatUntil - t) / 120) % 3;
        block(ctx, x + 268, CHEF.y + 120 + drop * 10, 10, 10, '#bfe3ee');
        block(ctx, x + 270, CHEF.y + 112 + drop * 10, 6, 8, '#bfe3ee');
        block(ctx, x + 284, CHEF.y + 152 + drop * 8, 8, 8, '#bfe3ee');
      }
    }

    function drawBoard(view, t) {
      var age = t - fx.chopAt;
      var kick = age < 80 ? 6 : 0;
      var wrongAge = t - fx.wrongAt;
      var wobble = !calm && wrongAge < 240 ? Math.round(Math.sin(wrongAge / 18) * 7) : 0;
      var progress = view.total ? view.progress / view.total : 0;
      oval(ctx, BOARD.x - 6, BOARD.y + BOARD.h - 22, BOARD.w + 12, 34, 'rgba(56,44,42,0.26)', 4);
      if (art) art.drawBoard(ctx, BOARD.x + wobble, BOARD.y + kick, BOARD.w, BOARD.h, progress);
      else {
        block(ctx, BOARD.x, BOARD.y, BOARD.w, BOARD.h, C.ink);
        block(ctx, BOARD.x + 8, BOARD.y + 8, BOARD.w - 16, BOARD.h - 16, C.wood);
      }
      if (age < 90) {
        // 落刀的一道白光
        block(ctx, BOARD.x + 216, BOARD.y + 36, 100, 6, C.white);
        block(ctx, BOARD.x + 236, BOARD.y + 24, 62, 6, C.white);
      }
    }

    function drawPan(position, pot, paused, t) {
      var cooking = Boolean(pot);
      var heat = pot ? pot.heat : 0;
      var s = position.size / 160;
      oval(ctx, position.x + 6, position.y + position.size - 30, position.size - 22, 34, 'rgba(56,44,42,0.26)', 4);
      if (art) art.drawPan(ctx, position.x, position.y, position.size, cooking ? Math.max(0.12, heat) : 0, pot?.recipeId || 'omurice', t);
      else {
        oval(ctx, position.x + 20, position.y + 80, position.size - 40, position.size * 0.5, C.ink, 4);
        if (cooking) oval(ctx, position.x + 60, position.y + 100, position.size - 120, position.size * 0.3, C.gold, 4);
        return;
      }
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.scale(s, s);
      if (!cooking) {
        // art.js 的锅里总有菜，没在烹饪时盖成空锅。
        oval(ctx, 30, 49, 96, 56, '#3b3f3b');
        block(ctx, 44, 60, 30, 3, '#4b514c');
        block(ctx, 40, 66, 14, 3, '#4b514c');
      } else if (heat > 0.72) {
        // 过了绿色区间，菜色慢慢变焦。
        ctx.globalAlpha = Math.min(0.6, (heat - 0.72) / 0.28 * 0.6);
        oval(ctx, 37, 55, 84, 46, C.ink);
      }
      ctx.restore();
      if (cooking && heat > 0.78 && !paused && Math.random() < 0.3) {
        spawn(1, function () {
          return {
            x: position.x + rand(45, 100) * s, y: position.y + rand(45, 60) * s, vx: rand(-20, 20), vy: rand(-140, -80),
            g: -40, life: 0.7, fade: 0.5, size: pick([8, 10, 12]), color: pick([C.dark, C.ink, '#6d5a50'])
          };
        });
      }
    }

    function drawTray(view, t) {
      var x = TRAY.x;
      var y = TRAY.y;
      oval(ctx, x - 8, y + 146, TRAY.w + 16, 34, 'rgba(56,44,42,0.26)', 4);
      block(ctx, x, y + 96, TRAY.w, 70, C.ink);
      block(ctx, x + 6, y + 102, TRAY.w - 12, 58, C.brown);
      block(ctx, x + 6, y + 102, TRAY.w - 12, 8, C.woodLight);
      block(ctx, x + 18, y + 116, TRAY.w - 36, 36, C.wood);
      block(ctx, x + 42, y + 112, TRAY.w - 84, 42, C.leaf);
      block(ctx, x + 46, y + 116, TRAY.w - 92, 34, C.sage);
      block(ctx, x + 46, y + 124, TRAY.w - 92, 4, '#8aaa85');
      block(ctx, x + 46, y + 138, TRAY.w - 92, 4, '#8aaa85');

      // 出餐铃
      var bellAge = t - fx.bellAt;
      var ring = !calm && bellAge < 320 ? Math.round(Math.sin(bellAge / 22) * 4) : 0;
      var bx = x + TRAY.w + 24 + ring;
      block(ctx, bx + 34, y + 62, 14, 18, C.ink);
      block(ctx, bx + 37, y + 65, 8, 12, C.gold);
      oval(ctx, bx, y + 74, 84, 68, C.ink);
      oval(ctx, bx + 6, y + 78, 72, 58, C.orange);
      oval(ctx, bx + 6, y + 78, 72, 50, C.gold);
      block(ctx, bx + 20, y + 90, 10, 20, '#ffdc8f');
      block(ctx, bx - 8, y + 130, 100, 20, C.ink);
      block(ctx, bx - 2, y + 134, 88, 10, C.brown);
      block(ctx, bx - 2, y + 134, 88, 4, C.woodLight);

      var dishes = view.readyDishes.length ? view.readyDishes : view.step === 'ready' && view.recipeId ? [view.recipeId] : [];
      if (dishes.length) {
        var bob = calm ? 0 : Math.round(Math.sin(t / 260) * 3);
        if (dishes.length === 1) dish(dishes[0], x + 38, y - 26 + bob, 192);
        else dishes.forEach(function (id, index) { dish(id, x + 12 + index * 116, y + 3 + bob, 124); });
        if (!view.paused && Math.random() < (view.grade === 'perfect' ? 0.22 : 0.08)) {
          spawn(1, function () {
            return {
              x: x + rand(30, TRAY.w - 30), y: y + rand(0, 110), vx: 0, vy: rand(-60, -30),
              g: 0, life: 0.5, fade: 0.3, size: pick([6, 8]),
              color: view.grade === 'perfect' ? pick([C.gold, C.white]) : C.white
            };
          });
        }
      }
    }

    function drawFlyingDish(t) {
      if (!fx.fly) return;
      var p = (t - fx.fly.at) / 420;
      if (p >= 1) { fx.fly = null; return; }
      var ease = p * p;
      dish(fx.fly.recipeId, lerp(TRAY.x + 38, W + 60, ease), TRAY.y - 26 - Math.sin(p * Math.PI) * 150, 192 * (1 - 0.4 * ease));
    }

    function drawPest(t) {
      var pest = fx.pest;
      if (!pest) return;
      var age = t - pest.at;
      var ox = 0;
      var oy = 0;
      var alpha = 1;
      var bird = pest.kind !== 'tanuki';
      if (pest.mode === 'in') {
        var arrive = calm ? 1 : Math.min(1, age / 280);
        var left = 1 - arrive;
        if (bird) { ox = -left * 200; oy = -left * left * 360; }
        else { ox = left * 240; oy = -Math.sin(arrive * Math.PI) * 70; }
      } else {
        var leave = age / 340;
        if (leave >= 1) { fx.pest = null; return; }
        if (bird) { ox = -leave * 280; oy = -leave * leave * 460; }
        else { ox = leave * leave * 620; oy = -Math.abs(Math.sin(leave * Math.PI * 2)) * 40; }
        alpha = 1 - leave * leave;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      if (bird && art) art.drawPest(ctx, PEST.x + ox, PEST.y + oy, PEST.scale, t, 'sparrow');
      else drawTanuki(ctx, PEST.x + ox, PEST.y + oy, PEST.scale, t);
      ctx.restore();
    }

    function drawKitchen(view, t, dt) {
      drawChefBehind(view, t, dt);
      drawCounter();
      drawBoard(view, t);
      var positions = view.pots.length > 1 ? DUAL_PANS : [PAN];
      positions.forEach(function (position, index) { drawPan(position, view.pots[index], view.paused, t); });
      drawTray(view, t);
      drawPest(t);
      if (view.helper && art) art.drawPest(ctx, TRAY.x + 144, TRAY.y - 78, 1.7, calm ? 0 : t, 'sparrow');
      drawFlyingDish(t);
    }

    // 标题画面。横屏：猫厨师站在柜台后面、木札菜单的右侧；竖屏：站到柜台上、菜单的下方。
    // 具体位置由 game.js 按木札的实际位置算好后放在 view.title 里。
    function drawTitleScene(view, t) {
      var layout = view.title || { behind: false, x: W / 2, feet: 934, scale: 2.5 };
      var mood = Math.floor(t / 2400) % 3 === 2 ? 'happy' : 'idle';
      var x = layout.x;
      if (layout.behind) {
        chef(x - 50 * CHEF.scale, CHEF.y, CHEF.scale, t, mood);
        drawCounter();
        dish('onigiri', x - 64 - 150, 716, 128);
        dish('curry', x - 64 + 150, 716, 128);
        dish('omurice', x - 64, 748, 128);
        return;
      }
      var scale = Math.max(1.5, Math.floor(layout.scale * 2) / 2);
      var size = scale >= 2.5 ? 128 : 96;
      chef(x - 50 * scale, layout.feet - 136 * scale, scale, t, mood);
      dish('onigiri', x - size / 2 - size * 1.3, layout.feet - size * 0.74, size);
      dish('curry', x - size / 2 + size * 1.3, layout.feet - size * 0.74, size);
      dish('omurice', x - size / 2, layout.feet - size * 0.54, size);
    }

    /* ---------- 对外接口 ---------- */

    function draw(view, now) {
      var dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      if (view.paused) dt = 0;
      clock += dt * 1000;
      var t = clock;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (!calm && t < fx.shakeUntil) ctx.translate(Math.round(rand(-7, 7)), Math.round(rand(-5, 5)));
      drawBackground();
      drawGlow(t);
      drawWindowPetals(dt, t);
      if (view.mode === 'title') drawTitleScene(view, t);
      else drawKitchen(view, t, dt);
      stepParticles(dt);
      drawParticles();
      drawRoomPetals(dt, t);
      ctx.restore();
    }

    function emit(name, data) {
      var t = clock;
      data = data || {};
      switch (name) {
        case 'reset':
          resetFx();
          break;
        case 'chop':
          fx.chopAt = t;
          spawn(6, function () {
            return {
              x: BOARD.x + rand(130, 210), y: BOARD.y + rand(70, 110), vx: rand(-170, 170), vy: rand(-300, -140),
              g: 900, life: 0.5, fade: 0.2, size: pick([6, 8, 10]), color: pick([C.cream, '#b4bd8f', C.sage, C.white])
            };
          });
          break;
        case 'wrong':
          fx.wrongAt = t;
          fx.sweatUntil = t + 600;
          break;
        case 'toPan': {
          fx.chopAt = t;
          var fromX = BOARD.x + 170;
          var fromY = BOARD.y + 90;
          var toX = PAN.x + 140;
          var toY = PAN.y + 130;
          var flight = 0.4;
          var gravity = 1700;
          spawn(12, function (i) {
            var time = flight + i * 0.012;
            return {
              x: fromX + rand(-30, 30), y: fromY + rand(-14, 14),
              vx: (toX - fromX) / time, vy: (toY - fromY) / time - gravity * time / 2,
              g: gravity, life: time, fade: 0.05, size: pick([8, 10]),
              color: pick([C.cream, '#b4bd8f', C.sage, C.red, C.gold])
            };
          });
          break;
        }
        case 'good':
        case 'perfect': {
          var many = name === 'perfect' ? 18 : 8;
          fx.happyUntil = t + (name === 'perfect' ? 1100 : 700);
          spawn(many, function () {
            return {
              x: PAN.x + rand(60, 230), y: PAN.y + rand(70, 150), vx: rand(-90, 90), vy: rand(-260, -120),
              g: 260, life: 0.7, fade: 0.4, size: pick([6, 8, 10]),
              color: name === 'perfect' ? pick([C.gold, C.white, '#ffdc8f']) : pick([C.white, C.cream])
            };
          });
          break;
        }
        case 'miss':
          spawn(5, function () {
            return {
              x: PAN.x + rand(90, 200), y: PAN.y + rand(70, 110), vx: rand(-40, 40), vy: rand(-120, -60),
              g: 0, life: 0.4, fade: 0.3, size: 8, color: C.cream
            };
          });
          break;
        case 'burn':
          fx.shakeUntil = t + 260;
          fx.sweatUntil = t + 900;
          spawn(22, function () {
            return {
              x: PAN.x + rand(50, 240), y: PAN.y + rand(60, 140), vx: rand(-60, 60), vy: rand(-220, -90),
              g: -60, life: rand(0.6, 1.1), fade: 0.5, size: pick([10, 12, 16]), color: pick([C.ink, C.dark, '#6d5a50'])
            };
          });
          break;
        case 'serve':
          fx.fly = { recipeId: data.recipeId, at: t };
          fx.bellAt = t;
          fx.happyUntil = t + 1000;
          spawn(10, function () {
            return {
              x: TRAY.x + rand(60, 210), y: TRAY.y + rand(40, 100), vx: rand(-200, 200), vy: rand(-460, -240),
              g: 1200, life: 0.7, fade: 0.2, size: pick([8, 10]), color: pick([C.gold, '#ffdc8f', C.orange])
            };
          });
          break;
        case 'pestIn':
          fx.pest = { kind: data.kind === 'tanuki' ? 'tanuki' : 'sparrow', mode: 'in', at: t };
          break;
        case 'pestShoo':
        case 'pestSteal':
          if (fx.pest) { fx.pest.mode = 'out'; fx.pest.at = t; }
          if (name === 'pestShoo') fx.happyUntil = t + 700;
          else fx.sweatUntil = t + 700;
          spawn(name === 'pestShoo' ? 8 : 5, function () {
            return {
              x: PEST.x + rand(40, 130), y: PEST.y + rand(50, 120), vx: rand(-150, 150), vy: rand(-260, -100),
              g: 700, life: 0.5, fade: 0.25, size: pick([6, 8]),
              color: name === 'pestShoo' ? pick([C.brown, C.cream, C.dark]) : pick([C.cream, C.white])
            };
          });
          break;
        case 'pestGone':
          fx.pest = null;
          break;
        default:
          break;
      }
    }

    return {
      draw: draw,
      emit: emit,
      setCalm: function (value) { calm = Boolean(value); }
    };
  }

  root.KitchenStage = { WIDTH: W, HEIGHT: H, create: create };
})(typeof window !== 'undefined' ? window : globalThis);
