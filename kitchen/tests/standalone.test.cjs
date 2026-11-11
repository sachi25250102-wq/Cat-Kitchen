const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const packerPath = path.join(root, 'scripts', 'build-standalone.cjs');
const packer = fs.existsSync(packerPath) ? require(packerPath) : {};

function build() {
  assert.equal(typeof packer.buildStandalone, 'function', 'standalone packer must exist');
  return packer.buildStandalone(root);
}

test('standalone game loads its menu before the engine and embeds every script and style', () => {
  const html = build();
  assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'no script file may be requested');
  assert.ok(!/<link\b[^>]*\brel=["']stylesheet["']/i.test(html), 'no stylesheet file may be requested');
  assert.ok(html.includes(fs.readFileSync(path.join(root, 'style.css'), 'utf8')));
  const sources = [...html.matchAll(/<script data-source="([^"]+)">([\s\S]*?)<\/script>/g)];
  assert.deepEqual(sources.map(match => match[1]), ['menu.js', 'engine.js', 'session.js', 'art.js', 'sfx.js', 'stage.js', 'game.js']);
  for (const source of sources) assert.doesNotThrow(() => new vm.Script(source[2], { filename: source[1] }));
});

test('embedded kitchen background is byte-identical to the real game asset', () => {
  const html = build();
  const image = html.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(image, 'kitchen image must be embedded');
  assert.deepEqual(Buffer.from(image[1], 'base64'), fs.readFileSync(path.join(root, 'assets', 'kitchen.png')));
  assert.ok(!html.includes("'assets/kitchen.png'"), 'stage must not request a separate PNG');
});

test('bundled classic scripts preserve offline session and a complete cooking action', () => {
  const html = build();
  const scripts = [...html.matchAll(/<script data-source="([^"]+)">([\s\S]*?)<\/script>/g)];
  const browser = {};
  for (const source of scripts.slice(0, 4)) vm.runInNewContext(source[2], browser);
  assert.equal(browser.KitchenEngine.DAY_COUNT, 5);
  assert.equal(browser.KitchenEngine.RECIPES.length, 10);
  const session = browser.KitchenSession.createSession({ storage: null, random: () => 0.5 });
  assert.equal(session.startPractice().ok, true);
  const game = session.game;
  game.selectOrder(game.state.orders[0].id);
  for (const direction of game.state.sequence.slice()) game.input(direction);
  game.tick(1.55);
  game.action();
  assert.equal(game.state.step, 'ready');
  game.action();
  assert.equal(game.state.served, 1);
  assert.equal(session.profile.wallet, 0, 'practice must remain isolated from saved money');
});
