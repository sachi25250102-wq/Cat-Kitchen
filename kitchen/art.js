/* Original, palette-limited pixel sprites for 小满食堂. All bounds are local. */
(function (root) {
  'use strict';

  var P = {
    ink: '#382c2a', dark: '#513d35', cream: '#fff1d2', white: '#fff9e8',
    rice: '#e8dfbf', sage: '#73977a', leaf: '#42694f', light: '#a6bc8e',
    red: '#c55743', blush: '#e39b7d', gold: '#f1ba67', orange: '#d88b49',
    brown: '#9b663e', wood: '#c58d58', woodLight: '#e0af74', blue: '#344956',
    iron: '#26323c', ironLight: '#52616a', curry: '#ad643a', curryLight: '#cd8747'
  };

  function block(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }

  function shape(c, points, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.closePath();
    c.fill();
  }

  // Horizontal pixel runs keep curved silhouettes square-edged at every scale.
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

  function begin(c, x, y, sx, sy, w, h) {
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(Math.round(x), Math.round(y));
    c.scale(sx, sy);
    c.beginPath();
    c.rect(0, 0, w, h);
    c.clip();
  }

  function riceGrains(c, points, color) {
    points.forEach(function (p) { block(c, p[0], p[1], 2, 2, color || P.rice); });
  }

  function plate(c) {
    oval(c, 2, 24, 60, 34, P.ink);
    oval(c, 4, 23, 56, 32, P.rice);
    oval(c, 4, 21, 56, 30, P.white);
    oval(c, 10, 25, 44, 22, '#ddd5b8');
    oval(c, 12, 25, 40, 20, P.cream);
    block(c, 12, 49, 8, 2, P.white);
    block(c, 44, 47, 8, 2, P.white);
  }

  function onigiri(c) {
    oval(c, 5, 48, 54, 12, '#00000020');
    shape(c, [[27,5],[37,5],[37,9],[41,9],[41,15],[45,15],[45,21],[49,21],[49,29],[53,29],[53,39],[57,39],[57,49],[53,49],[53,53],[13,53],[13,51],[7,51],[7,43],[11,43],[11,33],[15,33],[15,25],[19,25],[19,17],[23,17],[23,11],[27,11]], P.ink);
    shape(c, [[29,9],[35,9],[35,13],[39,13],[39,21],[43,21],[43,27],[47,27],[47,35],[51,35],[51,43],[53,43],[53,47],[49,47],[49,49],[15,49],[15,47],[11,47],[11,43],[15,43],[15,35],[19,35],[19,27],[23,27],[23,19],[27,19],[27,13],[29,13]], P.white);
    shape(c, [[13,43],[17,43],[17,47],[49,47],[49,43],[53,43],[53,47],[49,47],[49,49],[15,49],[15,47],[13,47]], P.rice);
    riceGrains(c, [[29,15],[33,21],[25,25],[21,31],[39,29],[43,37],[17,39],[29,31],[35,35],[23,43],[45,43]]);
    block(c, 25, 32, 16, 21, P.ink);
    block(c, 27, 33, 12, 18, P.leaf);
    block(c, 29, 35, 2, 13, P.sage);
    block(c, 35, 37, 2, 12, '#294c3b');
    block(c, 31, 45, 4, 2, '#294c3b');
    block(c, 30, 9, 4, 2, P.cream);
    block(c, 48, 15, 2, 5, P.gold);
    block(c, 46, 17, 6, 2, P.gold);
  }

  function omurice(c) {
    plate(c);
    oval(c, 10, 24, 44, 24, P.ink);
    oval(c, 12, 20, 40, 25, P.orange);
    oval(c, 12, 18, 40, 24, P.gold);
    shape(c, [[18,22],[24,22],[24,20],[38,20],[38,22],[44,22],[44,24],[48,24],[48,30],[44,30],[44,28],[40,28],[40,26],[24,26],[24,28],[18,28]], '#ffda84');
    block(c, 14, 32, 4, 6, P.orange);
    block(c, 20, 40, 18, 2, P.orange);
    // A hand-piped ketchup ribbon, with visible square turns.
    shape(c, [[24,23],[30,23],[30,25],[34,25],[34,27],[40,27],[40,29],[36,29],[36,31],[30,31],[30,33],[24,33],[24,31],[28,31],[28,29],[34,29],[34,27],[28,27],[28,25],[24,25]], P.red);
    block(c, 25, 23, 4, 1, '#e17a58');
    block(c, 47, 40, 4, 5, P.leaf);
    block(c, 45, 38, 4, 4, P.sage);
    block(c, 49, 37, 4, 4, P.light);
    block(c, 48, 44, 2, 3, P.sage);
  }

  function curry(c) {
    plate(c);
    oval(c, 12, 24, 40, 22, P.curry);
    oval(c, 15, 24, 37, 18, P.curryLight);
    shape(c, [[13,24],[17,24],[17,20],[23,20],[23,18],[31,18],[31,20],[35,20],[35,24],[37,24],[37,32],[35,32],[35,38],[31,38],[31,42],[19,42],[19,40],[15,40],[15,36],[13,36]], P.rice);
    shape(c, [[15,24],[19,24],[19,22],[23,22],[23,20],[29,20],[29,22],[33,22],[33,26],[35,26],[35,32],[31,32],[31,38],[19,38],[19,36],[15,36]], P.white);
    riceGrains(c, [[21,24],[27,22],[31,28],[19,30],[25,32],[23,36],[29,36]]);
    block(c, 40, 26, 7, 6, P.brown);
    block(c, 40, 25, 6, 4, P.gold);
    block(c, 36, 35, 6, 6, P.brown);
    block(c, 36, 34, 5, 4, P.orange);
    block(c, 46, 34, 5, 5, P.red);
    block(c, 44, 40, 3, 2, P.cream);
    block(c, 49, 43, 4, 3, P.red);
    block(c, 51, 40, 4, 4, P.blush);
    block(c, 31, 21, 2, 2, P.sage);
    block(c, 29, 25, 2, 2, P.leaf);
  }

  function bowl(c) {
    oval(c, 7, 39, 50, 17, '#382c2a25');
    shape(c, [[6,26],[58,26],[58,38],[55,38],[55,45],[50,45],[50,49],[44,49],[44,53],[20,53],[20,50],[13,50],[13,45],[9,45],[9,39],[6,39]], P.ink);
    shape(c, [[9,29],[55,29],[55,38],[52,38],[52,43],[47,43],[47,47],[42,47],[42,50],[22,50],[22,47],[16,47],[16,43],[12,43],[12,38],[9,38]], P.red);
    block(c, 17, 44, 29, 3, '#e39b7d');
    oval(c, 6, 16, 52, 25, P.ink);
    oval(c, 9, 17, 46, 21, P.cream);
  }

  function soup(c, noodles) {
    oval(c, 12, 20, 40, 17, noodles ? '#bf8249' : '#997054');
    oval(c, 15, 21, 34, 13, noodles ? P.gold : '#b8895a');
    if (noodles) {
      shape(c, [[15,26],[24,26],[24,24],[35,24],[35,26],[45,26],[45,29],[36,29],[36,32],[22,32],[22,30],[16,30]], P.cream);
      block(c, 24, 27, 11, 2, P.orange);
      block(c, 32, 30, 9, 2, P.gold);
      shape(c, [[41,21],[46,21],[46,24],[49,24],[49,28],[44,28],[44,26],[39,26],[39,23],[41,23]], P.leaf);
      block(c, 43, 23, 3, 2, P.light);
      block(c, 18, 23, 4, 3, P.blush);
      block(c, 39, 30, 4, 3, P.red);
    } else {
      [[18,25],[30,22],[39,28],[28,30]].forEach(function (p) {
        block(c, p[0], p[1], 7, 5, P.rice);
        block(c, p[0], p[1], 6, 3, P.cream);
      });
      block(c, 24, 22, 4, 3, P.leaf);
      block(c, 35, 27, 4, 3, P.sage);
      block(c, 43, 24, 3, 2, P.leaf);
      block(c, 19, 31, 3, 2, P.sage);
    }
  }

  function greens(c, x, y) {
    block(c, x, y + 4, 11, 4, P.leaf);
    block(c, x + 1, y + 1, 4, 5, P.sage);
    block(c, x + 5, y, 4, 5, P.light);
    block(c, x + 7, y + 5, 5, 3, P.sage);
  }

  function newFood(c, id) {
    if (id === 'miso' || id === 'noodles') {
      soup(c, id === 'noodles');
    } else if (id === 'ginger-pork') {
      [[16,20],[22,27],[15,34]].forEach(function (p) {
        var x = p[0], y = p[1];
        shape(c, [[x,y],[x+16,y],[x+16,y+2],[x+23,y+2],[x+23,y+7],[x+19,y+7],[x+19,y+10],[x+4,y+10],[x+4,y+8],[x,y+8]], P.dark);
        block(c, x + 2, y + 2, 17, 5, '#a7604b');
        block(c, x + 5, y + 2, 8, 2, P.blush);
        block(c, x + 12, y + 6, 7, 2, P.brown);
      });
      greens(c, 39, 30);
      block(c, 35, 22, 8, 2, P.gold);
      block(c, 38, 24, 6, 2, P.cream);
    } else if (id === 'tempura') {
      [[15,26],[24,20],[33,27]].forEach(function (p) {
        var x = p[0], y = p[1];
        shape(c, [[x,y+8],[x+3,y+8],[x+3,y+4],[x+7,y+4],[x+7,y],[x+12,y],[x+12,y+2],[x+15,y+2],[x+15,y+8],[x+12,y+8],[x+12,y+12],[x+8,y+12],[x+8,y+15],[x,y+15]], P.brown);
        block(c, x + 2, y + 9, 6, 4, P.gold);
        block(c, x + 5, y + 5, 7, 6, P.gold);
        block(c, x + 8, y + 2, 5, 5, '#ffda84');
        block(c, x + 7, y + 7, 3, 2, P.cream);
        block(c, x + 12, y - 2, 5, 4, P.red);
      });
      greens(c, 41, 36);
    } else if (id === 'tofu') {
      [[17,22],[33,24],[21,34]].forEach(function (p) {
        var x = p[0], y = p[1];
        block(c, x, y, 16, 11, P.brown);
        block(c, x + 1, y + 1, 14, 8, P.gold);
        block(c, x + 2, y + 1, 12, 5, P.cream);
        block(c, x + 4, y + 3, 4, 2, P.orange);
        block(c, x + 10, y + 5, 3, 2, P.sage);
      });
      greens(c, 40, 35);
    } else if (id === 'salmon') {
      shape(c, [[13,30],[18,30],[18,24],[26,24],[26,20],[40,20],[40,22],[47,22],[47,26],[51,26],[51,34],[46,34],[46,38],[36,38],[36,41],[20,41],[20,38],[13,38]], P.dark);
      shape(c, [[16,31],[21,31],[21,26],[28,26],[28,23],[39,23],[39,25],[46,25],[46,29],[48,29],[48,33],[44,33],[44,36],[34,36],[34,38],[21,38],[21,36],[16,36]], '#e58465');
      shape(c, [[22,27],[25,27],[25,30],[29,30],[29,34],[34,34],[34,36],[27,36],[27,32],[23,32],[23,29],[22,29]], '#ffd5a7');
      block(c, 34, 25, 3, 3, '#ffd5a7');
      block(c, 37, 28, 3, 3, '#ffd5a7');
      block(c, 40, 31, 4, 3, '#ffd5a7');
      greens(c, 40, 38);
    } else if (id === 'mochi') {
      [[13,27, '#d89d9e'],[25,20, '#a6bc8e'],[34,28, P.cream]].forEach(function (p) {
        oval(c, p[0], p[1], 17, 14, P.dark);
        oval(c, p[0] + 1, p[1] + 1, 15, 11, p[2]);
        block(c, p[0] + 4, p[1] + 3, 4, 2, P.white);
        block(c, p[0] + 8, p[1] + 9, 4, 2, P.blush);
      });
    }
  }

  function bento(c) {
    shape(c, [[9,13],[55,13],[55,16],[60,16],[60,50],[55,50],[55,54],[9,54],[9,51],[4,51],[4,16],[9,16]], P.ink);
    block(c, 7, 17, 50, 32, P.wood);
    block(c, 9, 19, 25, 17, '#a7604b');
    block(c, 12, 22, 18, 3, P.blush);
    block(c, 15, 28, 14, 3, P.brown);
    block(c, 37, 19, 18, 17, P.leaf);
    greens(c, 40, 23);
    block(c, 9, 39, 12, 8, P.gold);
    block(c, 10, 40, 8, 4, P.orange);
    block(c, 24, 39, 21, 8, P.cream);
    riceGrains(c, [[26,41],[31,43],[38,41]]);
    block(c, 48, 39, 7, 8, P.blush);
    block(c, 50, 40, 3, 3, P.cream);
  }

  function drawDish(ctx, recipeId, x, y, size) {
    size = size === undefined ? 64 : size;
    begin(ctx, x, y, size / 64, size / 64, 64, 64);
    if (recipeId === 'onigiri') onigiri(ctx);
    else if (recipeId === 'curry') curry(ctx);
    else if (recipeId === 'omurice') omurice(ctx);
    else if (recipeId === 'bento') bento(ctx);
    else {
      if (recipeId === 'miso' || recipeId === 'noodles') bowl(ctx);
      else plate(ctx);
      newFood(ctx, recipeId);
    }
    ctx.restore();
  }

  function drawChef(ctx, x, y, scale, time, mood) {
    scale = scale === undefined ? 1 : scale;
    time = Number(time) || 0;
    mood = mood || 'idle';
    begin(ctx, x, y, scale, scale, 100, 140);
    var c = ctx;
    oval(c, 15, 132, 74, 8, '#382c2a25');
    c.translate(0, Math.round((Math.sin(time / 340) + 1)));
    // Curled calico tail and the soft silhouette behind the apron.
    shape(c, [[77,87],[89,87],[89,83],[95,83],[95,87],[99,87],[99,103],[95,103],[95,109],[83,109],[83,105],[77,105]], P.ink);
    shape(c, [[79,91],[89,91],[89,87],[93,87],[93,91],[95,91],[95,101],[91,101],[91,105],[83,105],[83,101],[79,101]], P.orange);
    block(c, 89, 92, 6, 6, P.cream);
    shape(c, [[22,76],[76,76],[76,82],[82,82],[82,114],[77,114],[77,128],[23,128],[23,114],[17,114],[17,82],[22,82]], P.ink);
    block(c, 23, 80, 54, 42, P.cream);
    block(c, 27, 118, 46, 10, P.cream);
    // Tiny boots are visible below the apron hem.
    block(c, 24, 123, 20, 13, P.ink);
    block(c, 58, 123, 20, 13, P.ink);
    block(c, 26, 123, 16, 9, P.orange);
    block(c, 60, 123, 16, 9, P.cream);
    block(c, 28, 132, 14, 2, P.dark);
    block(c, 60, 132, 14, 2, P.dark);
    // Arms have stepped cuffs and little paw pads.
    shape(c, [[18,82],[24,82],[24,104],[20,104],[20,112],[8,112],[8,108],[4,108],[4,96],[8,96],[8,88],[18,88]], P.ink);
    shape(c, [[18,86],[22,86],[22,102],[18,102],[18,108],[10,108],[10,104],[8,104],[8,98],[12,98],[12,90],[18,90]], P.cream);
    block(c, 9, 100, 9, 7, P.orange);
    block(c, 10, 102, 2, 3, P.blush);
    shape(c, [[78,82],[86,82],[86,88],[92,88],[92,96],[96,96],[96,106],[92,106],[92,112],[80,112],[80,106],[76,106],[76,86],[78,86]], P.ink);
    shape(c, [[80,86],[84,86],[84,92],[88,92],[88,98],[92,98],[92,104],[88,104],[88,108],[82,108],[82,102],[80,102]], P.cream);
    block(c, 84, 102, 5, 4, P.blush);
    // Cross-back straps, pocket, stitched hem and a small brass button.
    block(c, 29, 78, 7, 26, P.leaf);
    block(c, 64, 78, 7, 26, P.leaf);
    shape(c, [[29,91],[37,91],[37,95],[63,95],[63,91],[71,91],[71,102],[75,102],[75,124],[25,124],[25,102],[29,102]], P.leaf);
    shape(c, [[31,95],[37,95],[37,99],[63,99],[63,95],[69,95],[69,104],[71,104],[71,120],[29,120],[29,104],[31,104]], P.sage);
    block(c, 32, 96, 3, 3, P.gold);
    block(c, 65, 96, 3, 3, P.gold);
    block(c, 41, 103, 20, 13, P.leaf);
    block(c, 43, 103, 16, 10, '#8aaa85');
    block(c, 47, 106, 8, 2, P.cream);
    block(c, 50, 104, 2, 6, P.cream);
    block(c, 31, 118, 38, 2, '#a0b690');
    // Ears project out of an asymmetrical cream-and-ginger head.
    shape(c, [[18,26],[24,26],[24,22],[30,22],[30,26],[38,26],[38,40],[18,40]], P.ink);
    shape(c, [[22,29],[26,29],[26,27],[29,27],[29,31],[34,31],[34,39],[22,39]], P.orange);
    block(c, 25, 31, 5, 8, P.blush);
    shape(c, [[64,27],[70,27],[70,23],[76,23],[76,27],[82,27],[82,41],[64,41]], P.ink);
    shape(c, [[68,31],[72,31],[72,28],[75,28],[75,31],[78,31],[78,39],[68,39]], P.cream);
    block(c, 71, 32, 5, 7, P.blush);
    shape(c, [[24,34],[76,34],[76,38],[82,38],[82,44],[86,44],[86,64],[82,64],[82,72],[76,72],[76,78],[64,78],[64,82],[36,82],[36,78],[24,78],[24,72],[18,72],[18,64],[14,64],[14,46],[18,46],[18,39],[24,39]], P.ink);
    shape(c, [[26,38],[74,38],[74,42],[79,42],[79,48],[82,48],[82,62],[78,62],[78,69],[72,69],[72,74],[62,74],[62,78],[38,78],[38,74],[26,74],[26,69],[22,69],[22,62],[18,62],[18,48],[22,48],[22,42],[26,42]], P.cream);
    shape(c, [[24,38],[44,38],[44,42],[47,42],[47,49],[43,49],[43,53],[37,53],[37,57],[21,57],[21,62],[18,62],[18,48],[22,48],[22,42],[24,42]], P.orange);
    block(c, 25, 41, 6, 3, P.gold);
    block(c, 68, 39, 6, 11, P.dark);
    block(c, 72, 43, 7, 9, P.dark);
    block(c, 73, 53, 8, 5, P.orange);
    // Blinking is time based, so animation never needs to retain sprite state.
    var blink = time % 4700 > 4510;
    var happy = mood === 'happy' || mood === 'success';
    if (blink || happy) {
      block(c, 29, 55, 10, 3, P.ink);
      block(c, 61, 55, 10, 3, P.ink);
      if (happy) {
        block(c, 31, 53, 6, 2, P.ink);
        block(c, 63, 53, 6, 2, P.ink);
      }
    } else {
      block(c, 30, 52, 7, 9, P.ink);
      block(c, 63, 52, 7, 9, P.ink);
      block(c, 31, 53, 2, 3, P.white);
      block(c, 64, 53, 2, 3, P.white);
    }
    block(c, 23, 62, 10, 4, P.blush);
    block(c, 68, 62, 10, 4, P.blush);
    block(c, 47, 61, 7, 3, P.red);
    block(c, 49, 64, 3, 4, P.ink);
    block(c, 44, 67, 5, 2, P.ink);
    block(c, 52, 67, 5, 2, P.ink);
    if (happy) block(c, 48, 69, 6, 3, P.blush);
    block(c, 12, 58, 10, 2, P.ink);
    block(c, 16, 65, 8, 2, P.ink);
    block(c, 79, 58, 9, 2, P.ink);
    block(c, 77, 65, 8, 2, P.ink);
    // Puffy chef hat: four distinct square-edged lobes, a folded band.
    shape(c, [[27,3],[41,3],[41,1],[59,1],[59,3],[73,3],[73,7],[81,7],[81,13],[85,13],[85,23],[79,23],[79,29],[73,29],[73,36],[27,36],[27,29],[21,29],[21,23],[15,23],[15,13],[19,13],[19,7],[27,7]], P.ink);
    shape(c, [[29,7],[43,7],[43,5],[57,5],[57,7],[71,7],[71,11],[77,11],[77,15],[81,15],[81,21],[75,21],[75,25],[69,25],[69,32],[31,32],[31,25],[25,25],[25,21],[19,21],[19,15],[23,15],[23,11],[29,11]], P.white);
    block(c, 29, 12, 3, 10, P.rice);
    block(c, 45, 7, 3, 10, P.cream);
    block(c, 65, 12, 3, 11, P.rice);
    block(c, 29, 27, 42, 6, P.rice);
    block(c, 32, 27, 36, 3, P.white);
    block(c, 47, 29, 7, 3, P.sage);
    ctx.restore();
  }

  function drawPest(ctx, x, y, scale, time, kind) {
    scale = scale === undefined ? 1 : scale;
    time = Number(time) || 0;
    begin(ctx, x, y, scale, scale, 70, 70);
    var c = ctx;
    oval(c, 12, 61, 47, 7, '#382c2a25');
    c.translate(0, -Math.round(Math.max(0, Math.sin(time / 230)) * 4));
    if (kind === 'mouse') {
      shape(c, [[4,49],[8,49],[8,55],[12,55],[12,59],[23,59],[23,63],[10,63],[10,59],[4,59],[4,55],[2,55],[2,51],[4,51]], P.ink);
      block(c, 5, 53, 3, 5, P.blush);
      block(c, 8, 57, 13, 3, P.blush);
      oval(c, 13, 31, 43, 31, P.ink);
      oval(c, 16, 32, 37, 27, '#918778');
      oval(c, 25, 15, 22, 24, P.ink);
      oval(c, 29, 18, 15, 18, P.blush);
      oval(c, 31, 20, 10, 13, '#e9b399');
      shape(c, [[42,29],[52,29],[52,33],[58,33],[58,39],[64,39],[64,49],[58,49],[58,55],[42,55],[42,51],[36,51],[36,36],[42,36]], P.ink);
      shape(c, [[44,33],[50,33],[50,37],[55,37],[55,41],[60,41],[60,47],[54,47],[54,51],[43,51],[43,47],[40,47],[40,37],[44,37]], '#b5aa93');
      block(c, 48, 37, 5, 6, P.ink);
      block(c, 49, 38, 2, 2, P.white);
      block(c, 60, 42, 6, 4, P.red);
      block(c, 54, 49, 10, 2, P.ink);
      block(c, 58, 53, 8, 2, P.ink);
      block(c, 25, 55, 10, 8, P.ink);
      block(c, 27, 57, 9, 4, P.blush);
      block(c, 44, 56, 9, 7, P.ink);
      block(c, 46, 57, 9, 4, P.blush);
      block(c, 21, 35, 5, 3, '#b5aa93');
    } else {
      // A chestnut sparrow with a cream cheek, barred wings and two tiny feet.
      shape(c, [[11,35],[18,35],[18,28],[24,28],[24,18],[30,18],[30,14],[46,14],[46,18],[53,18],[53,24],[59,24],[59,39],[55,39],[55,49],[49,49],[49,56],[29,56],[29,53],[21,53],[21,48],[15,48],[15,43],[9,43],[9,39],[11,39]], P.ink);
      shape(c, [[26,23],[30,23],[30,18],[44,18],[44,22],[50,22],[50,27],[55,27],[55,38],[51,38],[51,47],[46,47],[46,52],[30,52],[30,49],[23,49],[23,43],[18,43],[18,36],[24,36],[24,29],[26,29]], P.brown);
      shape(c, [[37,29],[49,29],[49,31],[55,31],[55,39],[50,39],[50,47],[45,47],[45,52],[33,52],[33,48],[29,48],[29,38],[33,38],[33,33],[37,33]], P.cream);
      block(c, 43, 27, 12, 5, P.dark);
      block(c, 47, 24, 5, 7, P.ink);
      block(c, 48, 24, 2, 2, P.white);
      block(c, 43, 35, 7, 5, P.ink);
      shape(c, [[57,29],[63,29],[63,31],[69,31],[69,34],[63,34],[63,37],[57,37]], P.ink);
      block(c, 57, 31, 7, 3, P.gold);
      shape(c, [[22,32],[32,32],[32,35],[38,35],[38,40],[35,40],[35,45],[29,45],[29,48],[23,48],[23,44],[20,44],[20,36],[22,36]], P.dark);
      block(c, 24, 35, 9, 3, P.gold);
      block(c, 23, 41, 8, 3, P.orange);
      block(c, 21, 45, 6, 3, P.cream);
      shape(c, [[13,38],[20,38],[20,43],[17,43],[17,48],[13,48],[13,52],[7,52],[7,48],[9,48],[9,43],[11,43],[11,40],[13,40]], P.ink);
      block(c, 11, 43, 6, 4, P.brown);
      block(c, 30, 54, 3, 9, P.ink);
      block(c, 44, 54, 3, 9, P.ink);
      block(c, 26, 62, 10, 3, P.ink);
      block(c, 41, 62, 10, 3, P.ink);
      block(c, 29, 59, 2, 5, P.orange);
      block(c, 43, 59, 2, 5, P.orange);
    }
    ctx.restore();
  }

  function drawBoard(ctx, x, y, width, height, progress) {
    progress = Math.min(1, Math.max(0, Number(progress) || 0));
    begin(ctx, x, y, width / 180, height / 100, 180, 100);
    var c = ctx;
    shape(c, [[8,3],[172,3],[172,7],[178,7],[178,91],[172,91],[172,97],[8,97],[8,93],[2,93],[2,9],[8,9]], P.ink);
    shape(c, [[9,7],[171,7],[171,11],[174,11],[174,89],[168,89],[168,93],[10,93],[10,89],[6,89],[6,11],[9,11]], P.brown);
    block(c, 8, 8, 162, 78, P.wood);
    block(c, 10, 9, 158, 5, P.woodLight);
    block(c, 10, 33, 158, 2, '#b97e4d');
    block(c, 10, 60, 158, 2, '#b97e4d');
    block(c, 12, 84, 154, 3, '#d49d64');
    block(c, 20, 23, 23, 2, P.woodLight);
    block(c, 141, 23, 20, 2, P.woodLight);
    block(c, 83, 71, 40, 2, '#b57b4b');
    block(c, 14, 70, 12, 2, P.woodLight);
    oval(c, 154, 42, 12, 16, P.brown);
    oval(c, 156, 44, 8, 12, P.ink);
    // Onion half, visible rings and individual diced pieces.
    oval(c, 18, 25, 44, 35, P.ink);
    oval(c, 21, 26, 38, 30, P.rice);
    oval(c, 25, 29, 30, 24, P.white);
    oval(c, 29, 31, 22, 20, '#d2d9b0');
    oval(c, 32, 33, 16, 16, P.cream);
    oval(c, 36, 36, 8, 10, '#bdc99e');
    block(c, 37, 22, 7, 5, P.brown);
    block(c, 39, 19, 3, 5, P.gold);
    var dice = [[64,36],[76,42],[64,49],[74,56],[54,63],[66,65],[83,65],[83,30]];
    var count = 2 + Math.round(progress * 6);
    dice.slice(0, count).forEach(function (p, i) {
      block(c, p[0], p[1] + (i % 2), 8, 7, '#b4bd8f');
      block(c, p[0], p[1] + (i % 2), 6, 5, P.cream);
      block(c, p[0] + 2, p[1] + 2 + (i % 2), 2, 2, P.white);
    });
    // Scallion stalks and the scattered green cross-sections.
    shape(c, [[99,64],[105,64],[105,42],[109,42],[109,19],[113,19],[113,48],[109,48],[109,69],[103,69],[103,75],[97,75],[97,70],[99,70]], P.leaf);
    block(c, 101, 47, 4, 21, P.sage);
    block(c, 99, 64, 5, 11, P.rice);
    block(c, 107, 19, 3, 25, P.light);
    block(c, 112, 52, 5, 18, P.leaf);
    block(c, 114, 35, 5, 22, P.sage);
    block(c, 116, 22, 4, 16, P.light);
    block(c, 111, 67, 5, 10, P.cream);
    [[91,79],[105,81],[118,76],[123,62]].forEach(function (p) {
      block(c, p[0], p[1], 7, 6, P.leaf);
      block(c, p[0] + 2, p[1] + 1, 3, 3, P.cream);
    });
    block(c, 129, 70, 8, 7, P.red);
    block(c, 130, 69, 6, 5, P.orange);
    block(c, 139, 77, 7, 7, P.red);
    block(c, 139, 76, 6, 5, P.gold);
    // Broad cleaver: polished upper edge, shaded blade and riveted wood grip.
    c.save();
    c.translate(Math.round(progress * 3), -Math.round(Math.sin(progress * Math.PI * 6) * 2));
    shape(c, [[126,8],[136,8],[136,33],[145,33],[145,60],[125,60],[121,56],[121,34],[126,34]], P.ink);
    block(c, 128, 11, 6, 25, P.dark);
    block(c, 129, 13, 2, 19, P.brown);
    block(c, 130, 16, 2, 2, P.gold);
    block(c, 130, 27, 2, 2, P.gold);
    block(c, 124, 36, 18, 20, '#aab6ac');
    block(c, 124, 36, 16, 3, P.white);
    block(c, 126, 39, 4, 13, '#d9e0cb');
    block(c, 126, 55, 16, 2, P.white);
    ctx.restore();
    ctx.restore();
  }

  function steam(c, time, heat) {
    if (heat <= 0) return;
    c.save();
    c.globalAlpha *= Math.min(0.85, heat * 0.8);
    for (var i = 0; i < 3; i++) {
      var rise = ((time / 70 + i * 11) % 28);
      var xx = 57 + i * 22 + Math.round(Math.sin(time / 420 + i) * 3);
      var yy = 42 - Math.round(rise);
      block(c, xx, yy, 4, 8, P.cream);
      block(c, xx - 3, yy - 6, 4, 8, P.cream);
      block(c, xx - 3, yy - 8, 7, 3, P.cream);
    }
    c.restore();
  }

  function drawPan(ctx, x, y, size, heat, recipeId, time) {
    size = size === undefined ? 160 : size;
    heat = Math.min(1, Math.max(0, Number(heat) || 0));
    time = Number(time) || 0;
    begin(ctx, x, y, size / 160, size / 160, 160, 160);
    var c = ctx;
    // Enamel cooker, brass control, and a visible ring of pixel flame.
    shape(c, [[12,111],[142,111],[142,117],[150,117],[150,153],[144,153],[144,158],[12,158],[12,154],[6,154],[6,117],[12,117]], P.ink);
    block(c, 10, 119, 136, 32, '#b6bea5');
    block(c, 14, 115, 126, 12, P.cream);
    block(c, 14, 128, 128, 3, '#899882');
    block(c, 14, 133, 128, 14, '#c9cfb5');
    oval(c, 25, 110, 104, 26, P.ink);
    oval(c, 31, 112, 92, 20, P.dark);
    if (heat > 0) {
      var flame = Math.round(Math.sin(time / 100) * 2);
      for (var f = 0; f < 7; f++) {
        var fx = 35 + f * 12;
        var fh = 5 + ((f % 2) * 3) + Math.round(heat * 7) + flame;
        block(c, fx, 127 - fh, 8, fh, P.red);
        block(c, fx + 2, 128 - Math.max(4, fh - 4), 4, Math.max(4, fh - 4), P.gold);
      }
    }
    block(c, 22, 138, 20, 5, P.sage);
    block(c, 26, 139, 3, 3, P.light);
    oval(c, 113, 133, 16, 16, P.ink);
    oval(c, 116, 135, 10, 10, P.brown);
    block(c, 120, 135, 2, 7, P.gold);
    // The handle, metal ferrule and the heavy cast-iron pan body.
    shape(c, [[119,59],[129,59],[129,54],[140,54],[140,49],[154,49],[154,53],[159,53],[159,66],[153,66],[153,70],[135,70],[135,75],[119,75]], P.ink);
    block(c, 126, 60, 12, 10, P.ironLight);
    block(c, 139, 54, 15, 11, P.dark);
    block(c, 141, 54, 11, 3, P.brown);
    block(c, 149, 58, 3, 4, P.ink);
    oval(c, 20, 48, 116, 82, P.ink);
    oval(c, 22, 45, 112, 78, P.iron);
    oval(c, 22, 43, 112, 72, P.ironLight);
    oval(c, 26, 46, 104, 64, P.ink);
    oval(c, 30, 49, 96, 56, '#3b3f3b');
    block(c, 29, 70, 3, 14, '#718073');
    block(c, 38, 101, 16, 3, P.blue);
    if (recipeId === 'curry') {
      oval(c, 37, 58, 82, 43, P.curry);
      oval(c, 41, 59, 73, 36, P.curryLight);
      [[49,68],[77,61],[93,77],[64,85]].forEach(function (p) {
        block(c, p[0], p[1], 10, 9, P.brown);
        block(c, p[0], p[1] - 1, 8, 6, P.gold);
        block(c, p[0] + 2, p[1], 3, 2, '#ffda84');
      });
      block(c, 64, 71, 9, 7, P.red);
      block(c, 105, 68, 6, 6, P.red);
      block(c, 83, 88, 6, 4, P.leaf);
      block(c, 44, 82, 4, 3, P.cream);
      block(c, 89, 66, 4, 3, P.cream);
    } else if (recipeId === 'onigiri') {
      oval(c, 39, 58, 79, 40, P.rice);
      oval(c, 41, 57, 75, 36, P.cream);
      riceGrains(c, [[48,67],[58,61],[65,69],[80,61],[87,75],[99,67],[103,80],[71,86],[55,81],[84,87]], P.white);
      [[57,72],[76,78],[96,62]].forEach(function (p) { block(c, p[0], p[1], 4, 3, P.leaf); });
      block(c, 91, 85, 7, 4, P.red);
    } else if (recipeId === 'omurice' || recipeId === undefined) {
      oval(c, 37, 57, 84, 44, P.orange);
      oval(c, 40, 55, 78, 40, P.gold);
      shape(c, [[48,63],[58,63],[58,59],[79,59],[79,61],[95,61],[95,65],[108,65],[108,73],[99,73],[99,69],[85,69],[85,66],[64,66],[64,69],[50,69],[50,73],[44,73],[44,67],[48,67]], '#ffda84');
      block(c, 43, 81, 7, 6, P.orange);
      block(c, 56, 91, 39, 3, P.orange);
      block(c, 65, 71, 14, 4, P.red);
      block(c, 77, 75, 15, 4, P.red);
      block(c, 65, 79, 14, 4, P.red);
      block(c, 83, 81, 6, 4, P.red);
      block(c, 101, 83, 4, 4, P.leaf);
      block(c, 98, 79, 5, 5, P.sage);
      block(c, 104, 78, 4, 4, P.light);
    } else {
      c.save();
      c.translate(16, 17);
      c.scale(2, 2);
      newFood(c, recipeId);
      c.restore();
    }
    if (heat > 0.2) {
      var phase = Math.floor(time / 170) % 3;
      [[46,83],[91,62],[104,89]].forEach(function (p, i) {
        if (i === phase) {
          block(c, p[0], p[1], 6, 2, P.cream);
          block(c, p[0] - 2, p[1] - 2, 2, 2, P.cream);
          block(c, p[0] + 6, p[1] - 2, 2, 2, P.cream);
        }
      });
    }
    steam(c, time, heat);
    ctx.restore();
  }

  var api = {
    drawDish: drawDish,
    drawChef: drawChef,
    drawPest: drawPest,
    drawBoard: drawBoard,
    drawPan: drawPan
  };
  root.KitchenArt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
