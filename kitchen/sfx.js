/* 小满食堂 —— 音效。全部用 Web Audio 现场合成，不加载任何音频文件。
   全局 KitchenSfx：unlock() 在首次点按/按键时调用；setEnabled(boolean)；play(name)；setSizzle(0..1)。 */
(function (root) {
  'use strict';

  var AudioCtor = root.AudioContext || root.webkitAudioContext;
  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var sizzle = null;
  var enabled = true;
  var VOLUME = 0.55;

  function ensure() {
    if (ctx || !AudioCtor) return ctx;
    try {
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = enabled ? VOLUME : 0;
      master.connect(ctx.destination);
      var length = Math.floor(ctx.sampleRate * 1.2);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    } catch (_error) {
      ctx = null;
    }
    return ctx;
  }

  // 浏览器要求由用户手势启动音频，所以只在点按/按键里调用。
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (ctx && master) master.gain.setTargetAtTime(enabled ? VOLUME : 0, ctx.currentTime, 0.02);
  }

  function tone(freq, start, duration, options) {
    var o = options || {};
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var t0 = ctx.currentTime + start;
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.volume || 0.16, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function noise(start, duration, options) {
    var o = options || {};
    var source = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    var t0 = ctx.currentTime + start;
    source.buffer = noiseBuffer;
    filter.type = o.filter || 'bandpass';
    filter.frequency.setValueAtTime(o.freq || 1800, t0);
    if (o.sweep) filter.frequency.exponentialRampToValueAtTime(o.sweep, t0 + duration);
    filter.Q.value = o.q || 0.9;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.volume || 0.2, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0, Math.random() * 0.5);
    source.stop(t0 + duration + 0.03);
  }

  var SOUNDS = {
    click: function () { tone(520, 0, 0.06, { volume: 0.1 }); },
    select: function () { tone(440, 0, 0.07, { volume: 0.12 }); tone(660, 0.06, 0.09, { volume: 0.12 }); },
    deny: function () { tone(180, 0, 0.14, { type: 'sawtooth', volume: 0.1 }); },
    chop: function () {
      noise(0, 0.07, { freq: 2600, q: 1.4, volume: 0.3 });
      tone(170, 0, 0.09, { type: 'triangle', volume: 0.3, slide: 90 });
    },
    wrong: function () {
      tone(220, 0, 0.12, { type: 'sawtooth', volume: 0.12, slide: 150 });
      tone(160, 0.1, 0.18, { type: 'sawtooth', volume: 0.12, slide: 100 });
    },
    toPan: function () { noise(0, 0.5, { filter: 'highpass', freq: 3200, volume: 0.22 }); },
    good: function () { tone(523, 0, 0.1, { volume: 0.14 }); tone(784, 0.09, 0.16, { volume: 0.14 }); },
    perfect: function () {
      tone(659, 0, 0.09, { volume: 0.14 });
      tone(880, 0.08, 0.09, { volume: 0.14 });
      tone(1319, 0.16, 0.26, { volume: 0.14 });
    },
    miss: function () { tone(300, 0, 0.16, { type: 'triangle', volume: 0.2, slide: 210 }); },
    burn: function () {
      noise(0, 0.6, { filter: 'lowpass', freq: 900, sweep: 200, volume: 0.32 });
      tone(200, 0, 0.45, { type: 'sawtooth', volume: 0.12, slide: 70 });
    },
    serve: function () {
      tone(1319, 0, 0.5, { type: 'sine', volume: 0.22 });
      tone(1976, 0.02, 0.4, { type: 'sine', volume: 0.1 });
      tone(988, 0.16, 0.1, { volume: 0.08 });
      tone(1319, 0.24, 0.16, { volume: 0.08 });
    },
    coin: function () { tone(988, 0, 0.07, { volume: 0.12 }); tone(1319, 0.07, 0.2, { volume: 0.12 }); },
    expire: function () {
      tone(392, 0, 0.16, { type: 'triangle', volume: 0.22 });
      tone(294, 0.16, 0.3, { type: 'triangle', volume: 0.22 });
    },
    pestIn: function () {
      tone(1568, 0, 0.06, { volume: 0.1 });
      tone(2093, 0.08, 0.06, { volume: 0.1 });
      tone(1568, 0.16, 0.06, { volume: 0.1 });
      tone(2093, 0.24, 0.1, { volume: 0.1 });
    },
    shoo: function () {
      noise(0, 0.28, { freq: 900, sweep: 4200, q: 0.7, volume: 0.3 });
      tone(1047, 0.16, 0.14, { volume: 0.1 });
    },
    steal: function () {
      tone(330, 0, 0.1, { type: 'triangle', volume: 0.2 });
      tone(247, 0.1, 0.2, { type: 'triangle', volume: 0.2 });
    },
    tick: function () { tone(880, 0, 0.05, { volume: 0.08 }); },
    dayStart: function () {
      tone(523, 0, 0.12, { volume: 0.12 });
      tone(659, 0.12, 0.12, { volume: 0.12 });
      tone(784, 0.24, 0.12, { volume: 0.12 });
      tone(1047, 0.36, 0.3, { volume: 0.12 });
    },
    dayEnd: function () {
      tone(1047, 0, 0.16, { type: 'triangle', volume: 0.22 });
      tone(784, 0.16, 0.16, { type: 'triangle', volume: 0.22 });
      tone(659, 0.32, 0.16, { type: 'triangle', volume: 0.22 });
      tone(523, 0.48, 0.5, { type: 'triangle', volume: 0.22 });
    },
    star: function () { tone(1175, 0, 0.08, { volume: 0.1 }); tone(1568, 0.07, 0.22, { volume: 0.1 }); }
  };

  function play(name) {
    if (!enabled || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (_error) { /* 音效失败不影响游戏 */ }
  }

  // 锅里的滋滋声：一段循环噪声，音量跟着火候走。
  function setSizzle(level) {
    if (!ctx || ctx.state !== 'running') return;
    var target = enabled ? Math.max(0, Math.min(1, Number(level) || 0)) * 0.11 : 0;
    if (!sizzle) {
      if (target === 0) return;
      try {
        var source = ctx.createBufferSource();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();
        source.buffer = noiseBuffer;
        source.loop = true;
        filter.type = 'highpass';
        filter.frequency.value = 3600;
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
        sizzle = { gain: gain, level: 0 };
      } catch (_error) {
        return;
      }
    }
    if (Math.abs(sizzle.level - target) < 0.004) return;
    sizzle.level = target;
    sizzle.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.06);
  }

  root.KitchenSfx = { unlock: unlock, setEnabled: setEnabled, play: play, setSizzle: setSizzle };
})(typeof window !== 'undefined' ? window : globalThis);
