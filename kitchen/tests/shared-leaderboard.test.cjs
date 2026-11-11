const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtemp, rm, rmdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { createSharedGame } = require('../scripts/serve-shared.cjs');

function result(score, day = 1, kind = 'daily') {
  return { id: randomUUID(), kind, day, score, served: Math.ceil(score / 150) };
}

async function openGame(t, dbPath = ':memory:') {
  const server = createSharedGame({ dbPath });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close(error => error ? reject(error) : resolve());
  });
  t.after(close);
  async function board(kind = 'daily', entryId) {
    const params = new URLSearchParams({ kind });
    if (entryId) params.set('entryId', entryId);
    const response = await fetch(`${base}/api/leaderboard?${params}`);
    assert.equal(response.status, 200);
    return response.json();
  }
  async function submit(nickname, ...entries) {
    const response = await fetch(`${base}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, entries }),
    });
    return { status: response.status, ...await response.json() };
  }
  return { base, board, submit, close };
}

test('players on separate requests share scores, ties and ranks beyond the top ten', async t => {
  const { board, submit } = await openGame(t);
  const low = result(10);
  assert.equal((await submit('花猫', low)).entries[0].rank, 1);
  assert.equal((await submit('橘猫', result(200))).entries[0].rank, 1);
  assert.equal((await submit('黑猫', result(200))).entries[0].rank, 1);
  const initial = await board('daily', low.id);
  assert.deepEqual(initial.rows.map(row => [row.nickname, row.rank, row.score]), [
    ['橘猫', 1, 200], ['黑猫', 1, 200], ['花猫', 3, 10],
  ]);
  assert.equal(initial.current.id, low.id);
  for (let index = 0; index < 10; index++) await submit(`客人 ${index}`, result(100));
  const crowded = await board('daily', low.id);
  assert.equal(crowded.rows.length, 10);
  assert.equal(crowded.current.rank, 13);
  assert.ok(crowded.rows.every(row => row.id !== low.id));
});

test('concurrent retries count once and five-day totals survive a server restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'xiaoman-leaderboard-'));
  const dbPath = join(directory, 'scores.sqlite');
  const first = await openGame(t, dbPath);
  t.after(async () => {
    await first.close();
    await rm(dbPath, { force: true });
    await rmdir(directory);
  });
  const daily = result(150, 5);
  const campaign = result(680, 5, 'campaign');
  const retries = await Promise.all(Array.from({ length: 3 }, () => first.submit('小满', daily, campaign)));
  assert.ok(retries.every(retry => retry.status === 200));
  assert.equal((await first.board()).rows.length, 1);
  assert.equal((await first.board('campaign')).rows.length, 1);
  await first.close();
  const reopened = await openGame(t, dbPath);
  try {
    assert.deepEqual((await reopened.board('campaign', campaign.id)).current, {
      ...campaign, nickname: '小满', rank: 1,
    });
    assert.equal((await reopened.submit('另一个昵称', daily, campaign)).entries[0].nickname, '小满');
  } finally {
    await reopened.close();
  }
});

test('invalid submissions and conflicting retry batches do not partially write', async t => {
  const { board, submit } = await openGame(t);
  const daily = result(150, 5);
  const campaign = result(680, 5, 'campaign');
  assert.equal((await submit('   ', daily)).status, 400);
  assert.equal((await submit('小满', { ...daily, score: -1 })).status, 400);
  assert.equal((await submit('小满', campaign)).status, 400);
  assert.equal((await submit('小满', daily, campaign)).status, 200);
  assert.equal((await submit('客人', result(100, 5), { ...campaign, score: 679 })).status, 409);
  assert.equal((await submit('客人', daily, result(700, 5, 'campaign'))).status, 409);
  assert.equal((await submit('客人', result(100, 5), campaign)).status, 409);
  assert.equal((await board()).rows.length, 1);
  assert.equal((await board('campaign')).rows.length, 1);
});

test('hosted HTML enables shared mode while exposing only the game and leaderboard', async t => {
  const { base } = await openGame(t);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<meta name="xiaoman-shared-leaderboard" content="\/api\/leaderboard">/);
  assert.equal((await fetch(base + '/scripts/serve-shared.cjs')).status, 404);
  assert.equal((await fetch(base + '/api/leaderboard?kind=practice')).status, 400);
  const oversized = await fetch(base + '/api/leaderboard', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(5000),
  });
  assert.equal(oversized.status, 413);
});
