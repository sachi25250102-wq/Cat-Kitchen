const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sessionPath = path.join(__dirname, '..', 'session.js');
const KitchenSession = fs.existsSync(sessionPath) ? require(sessionPath) : {};
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, read: () => value };
}

function create(storage = memoryStorage()) {
  assert.equal(typeof KitchenSession.createSession, 'function', 'createSession must be implemented');
  return KitchenSession.createSession({ storage, random: () => 0.5 });
}

function serve(session, count = 1) {
  for (let index = 0; index < count; index += 1) {
    const game = session.game;
    game.selectOrder(game.state.orders[0].id);
    for (const key of game.state.sequence.slice()) game.input(key);
    while (game.state.step === 'cook' && game.state.heat < 0.55) game.tick(0.025);
    game.action();
    game.action();
  }
}

function settledShift(session, meals = 4) {
  assert.equal(session.startDay().ok, true);
  serve(session, meals);
  session.game.tick(90);
  const result = session.settleDay();
  assert.equal(result.ok, true);
  return result;
}

test('starts with a sanitized empty campaign and read-only profile snapshots', () => {
  const session = create();
  assert.equal(session.profile.version, 1);
  assert.equal(session.profile.day, 1);
  assert.equal(session.profile.wallet, 0);
  assert.equal(session.profile.completed, false);
  assert.equal(session.profile.summary, null);
  const copy = session.profile;
  copy.wallet = 1000;
  copy.upgrades.stove = 99;
  assert.equal(session.profile.wallet, 0);
  assert.equal(session.profile.upgrades.stove, 0);
});

test('pays each finished shift once, including repeat settlement after reload', () => {
  const storage = memoryStorage();
  const session = create(storage);
  const first = settledShift(session);
  const wallet = session.profile.wallet;
  assert.ok(wallet > 0);
  assert.equal(wallet, first.summary.coins);
  assert.equal(first.summary.served, 4);
  assert.equal(first.summary.dailyEntryId, 1);
  assert.equal(first.summary.campaignEntryId, null);
  assert.equal(session.profile.totalServed, 4);
  assert.deepEqual(session.settleDay(), { ok: true, alreadySettled: true, summary: first.summary });
  assert.equal(session.profile.wallet, wallet);
  const reloaded = create(storage);
  assert.equal(reloaded.profile.wallet, wallet);
  assert.deepEqual(reloaded.settleDay(), { ok: true, alreadySettled: true, summary: first.summary });
  assert.equal(reloaded.profile.totalServed, 4);
  assert.deepEqual(reloaded.getLeaderboard(), [
    { id: 1, day: 1, score: first.summary.score, served: 4, rank: 1 }
  ]);
});

test('sorts all daily scores, retains zero, and gives ties competition ranks in entry order', () => {
  const session = create();
  const low = settledShift(session, 0).summary;
  assert.equal(low.score, 0);
  session.restartCampaign();
  const firstHigh = settledShift(session, 4).summary;
  session.restartCampaign();
  const secondHigh = settledShift(session, 4).summary;
  assert.ok(firstHigh.score > low.score);
  assert.equal(secondHigh.score, firstHigh.score);
  const expected = [
    { id: 2, day: 1, score: firstHigh.score, served: 4, rank: 1 },
    { id: 3, day: 1, score: firstHigh.score, served: 4, rank: 1 },
    { id: 1, day: 1, score: 0, served: 0, rank: 3 }
  ];
  const rows = session.getLeaderboard();
  assert.deepEqual(rows, expected);
  rows[0].score = 999999;
  rows.pop();
  assert.deepEqual(session.getLeaderboard('daily'), expected);
  assert.deepEqual(session.getLeaderboard('campaign'), []);
  assert.deepEqual(session.getLeaderboard('__proto__'), []);
});

test('submission IDs survive reload and disambiguate the same local entry ID in stale sessions', () => {
  const storage = memoryStorage();
  const first = create(storage);
  const stale = create(storage);
  const firstSummary = settledShift(first, 0).summary;
  assert.equal(typeof first.getLeaderboardSubmissionId, 'function');
  const firstId = first.getLeaderboardSubmissionId('daily', firstSummary.dailyEntryId);
  assert.match(firstId, UUID_V4);
  assert.equal(create(storage).getLeaderboardSubmissionId('daily', firstSummary.dailyEntryId), firstId);
  assert.equal(first.settleDay().alreadySettled, true);
  assert.equal(first.getLeaderboardSubmissionId('daily', firstSummary.dailyEntryId), firstId);

  const staleSummary = settledShift(stale, 0).summary;
  assert.equal(staleSummary.dailyEntryId, firstSummary.dailyEntryId);
  const staleId = stale.getLeaderboardSubmissionId('daily', staleSummary.dailyEntryId);
  assert.match(staleId, UUID_V4);
  assert.notEqual(staleId, firstId);
  assert.equal(create(storage).getLeaderboardSubmissionId('daily', staleSummary.dailyEntryId), staleId);
  assert.equal(stale.getLeaderboardSubmissionId('campaign', staleSummary.dailyEntryId), null);
  assert.equal(stale.getLeaderboardSubmissionId('__proto__', staleSummary.dailyEntryId), null);
});

test('requires a real finished campaign shift before payout or next day', () => {
  const session = create();
  assert.equal(session.settleDay().ok, false);
  assert.equal(session.nextDay().ok, false);
  session.startDay();
  serve(session);
  assert.equal(session.settleDay().ok, false);
  assert.equal(session.profile.wallet, 0);
  assert.equal(session.nextDay().ok, false);
  assert.equal(session.startDay().ok, false, 'cannot restart an active shift');
});

test('completed but unsettled earnings survive attempted new shifts and practice', () => {
  const session = create();
  session.startDay();
  serve(session);
  session.game.tick(90);
  const earned = session.game.state.coins;
  assert.ok(earned > 0);
  assert.deepEqual(session.startDay(), { ok: false, reason: 'unsettled-shift' });
  assert.deepEqual(session.startPractice(), { ok: false, reason: 'unsettled-shift' });
  assert.equal(session.game.state.phase, 'summary');
  assert.equal(session.game.state.coins, earned);
  session.settleDay();
  assert.equal(session.profile.wallet, earned);
});

test('buys upgrades from the wallet only at settlement and applies them next day', () => {
  const session = create();
  assert.equal(session.buyUpgrade('stove').ok, false);
  settledShift(session);
  const before = session.profile.wallet;
  const offer = session.getUpgradeOffer('stove');
  assert.equal(offer.canBuy, true);
  assert.equal(offer.level, 0);
  const purchased = session.buyUpgrade('stove');
  assert.equal(purchased.ok, true);
  assert.equal(session.profile.wallet, before - offer.nextCost);
  assert.equal(session.profile.upgrades.stove, 1);
  assert.equal(session.nextDay().ok, true);
  assert.equal(session.profile.day, 2);
  assert.equal(session.profile.summary, null);
  assert.equal(session.game.state.phase, 'playing');
  assert.equal(session.game.state.upgrades.stove, 1);
  assert.equal(session.buyUpgrade('patience').ok, false);
});

test('rejects unknown, inherited, unaffordable and maximum-level upgrades without spending', () => {
  const poor = create();
  settledShift(poor, 0);
  for (const key of ['stove', 'nope', '__proto__', 'toString', null]) {
    assert.equal(poor.buyUpgrade(key).ok, false);
  }
  assert.equal(poor.profile.wallet, 0);
  const storage = memoryStorage(JSON.stringify({ version: 1, wallet: 1000, day: 1, upgrades: { stove: 3 }, summary: { day: 1, score: 100, coins: 10, served: 1 } }));
  const rich = create(storage);
  assert.equal(rich.getUpgradeOffer('stove').maxed, true);
  assert.equal(rich.getUpgradeOffer('stove').nextCost, null);
  assert.equal(rich.buyUpgrade('stove').ok, false);
  assert.equal(rich.profile.wallet, 1000);
});

test('completes exactly five days and can restart while keeping lifetime records and sound', () => {
  const session = create();
  session.setSound(false);
  for (const day of [1, 2, 3, 4, 5]) {
    assert.equal(session.profile.day, day);
    if (day === 1) session.startDay();
    serve(session);
    session.game.tick(90);
    assert.equal(session.settleDay().ok, true);
    if (day < 5) {
      assert.equal(session.profile.completed, false);
      assert.equal(session.nextDay().ok, true);
    }
  }
  assert.equal(session.profile.completed, true);
  assert.equal(session.nextDay().ok, false);
  assert.equal(session.startDay().ok, false);
  const best = session.profile.bestScore;
  assert.equal(session.profile.totalServed, 5);
  assert.equal(session.restartCampaign().ok, true);
  assert.equal(session.profile.day, 1);
  assert.equal(session.profile.wallet, 0);
  assert.equal(session.profile.completed, false);
  assert.equal(session.profile.summary, null);
  assert.equal(session.profile.bestScore, best);
  assert.equal(session.profile.totalServed, 5);
  assert.equal(session.profile.sound, false);
  assert.equal(session.game.state.phase, 'menu');
});

test('ranks a full run by the sum of five settled shifts across reloads and keeps both boards on restart', () => {
  const storage = memoryStorage();
  let session = create(storage);
  assert.equal(session.startDay().ok, true);
  const summaries = [];
  for (let day = 1; day <= 5; day += 1) {
    serve(session, day <= 3 ? 4 : 2);
    session.game.tick(90);
    const { summary } = session.settleDay();
    summaries.push(summary);
    assert.equal(summary.dailyEntryId, day);
    assert.equal(summary.campaignEntryId, day === 5 ? 1 : null);
    session = create(storage);
    assert.equal(session.profile.summary.dailyEntryId, day);
    if (day < 5) {
      assert.deepEqual(session.getLeaderboard('campaign'), []);
      assert.equal(session.nextDay().ok, true);
    }
  }
  const score = summaries.reduce((sum, summary) => sum + summary.score, 0);
  const served = summaries.reduce((sum, summary) => sum + summary.served, 0);
  assert.ok(score > 0);
  assert.ok(served > 5);
  assert.deepEqual(session.profile.run, { entryIds: [1, 2, 3, 4, 5], score, served });
  assert.equal(session.settleDay().summary.campaignEntryId, 1);
  const campaignSubmissionId = session.getLeaderboardSubmissionId('campaign', 1);
  assert.match(campaignSubmissionId, UUID_V4);
  assert.notEqual(campaignSubmissionId, session.getLeaderboardSubmissionId('daily', 5));
  const campaigns = [{ id: 1, day: 5, score, served, rank: 1 }];
  const daily = session.getLeaderboard();
  assert.deepEqual(session.getLeaderboard('campaign'), campaigns);
  session.restartCampaign();
  session = create(storage);
  assert.deepEqual(session.profile.run, { entryIds: [], score: 0, served: 0 });
  assert.deepEqual(session.getLeaderboard(), daily);
  assert.deepEqual(session.getLeaderboard('campaign'), campaigns);
  assert.equal(session.getLeaderboardSubmissionId('campaign', 1), campaignSubmissionId);
  assert.equal(settledShift(session, 0).summary.dailyEntryId, 6);
  for (let day = 2; day <= 5; day += 1) {
    assert.equal(session.nextDay().ok, true);
    session.game.tick(90);
    const { summary } = session.settleDay();
    assert.equal(summary.dailyEntryId, 5 + day);
    assert.equal(summary.campaignEntryId, day === 5 ? 2 : null);
  }
  assert.deepEqual(session.getLeaderboard('campaign'), [...campaigns, { id: 2, day: 5, score: 0, served: 0, rank: 2 }]);
});

test('an old completed third day can continue to day four without losing its wallet or records', () => {
  const storage = memoryStorage(JSON.stringify({
    version: 1, day: 3, completed: true, wallet: 76, bestScore: 500, bestCombo: 4,
    totalServed: 12, sound: false, upgrades: { stove: 1 },
    summary: { day: 3, score: 500, coins: 36, served: 4 }
  }));
  const session = create(storage);
  assert.equal(session.profile.completed, false);
  const old = session.settleDay();
  assert.equal(old.alreadySettled, true);
  assert.equal(old.summary.dailyEntryId, null);
  assert.equal(old.summary.campaignEntryId, null);
  assert.deepEqual(session.getLeaderboard(), []);
  assert.equal(session.nextDay().ok, true);
  assert.equal(session.game.state.day, 4);
  assert.equal(session.profile.wallet, 76);
  assert.equal(session.profile.totalServed, 12);
  assert.equal(session.profile.upgrades.stove, 1);
  assert.equal(session.profile.bestScore, 500);
  assert.equal(session.profile.sound, false);
  for (const day of [4, 5]) {
    serve(session, 1);
    session.game.tick(90);
    const { summary } = session.settleDay();
    assert.equal(summary.dailyEntryId, day - 3);
    assert.equal(summary.campaignEntryId, null);
    if (day < 5) assert.equal(session.nextDay().ok, true);
  }
  const reloaded = create(storage);
  assert.deepEqual(reloaded.getLeaderboard().map(entry => entry.day).sort(), [4, 5]);
  assert.deepEqual(reloaded.profile.run.entryIds, [1, 2]);
  assert.deepEqual(reloaded.getLeaderboard('campaign'), []);
});

test('practice can preview day five without changing campaign progress or paying rewards', () => {
  const session = create();
  const before = session.profile;
  assert.deepEqual(session.startPractice(6), { ok: false, reason: 'invalid-day' });
  assert.equal(session.startPractice(5).ok, true);
  assert.equal(session.game.state.day, 5);
  assert.equal(session.game.state.practice, true);
  assert.equal(session.game.state.availableRecipeIds.length, 10);
  serve(session);
  assert.equal(session.settleDay().ok, false);
  session.leave();
  assert.deepEqual(session.getLeaderboard(), []);
  assert.deepEqual(session.getLeaderboard('campaign'), []);
  assert.deepEqual(session.profile, before);
});

test('practice earns no persistent money, unlocks or records, including after a campaign summary', () => {
  const session = create();
  assert.equal(session.startPractice().ok, true);
  serve(session, 2);
  assert.ok(session.game.state.coins > 0);
  assert.equal(session.settleDay().ok, false);
  assert.equal(session.profile.wallet, 0);
  assert.equal(session.profile.totalServed, 0);
  session.leave();
  settledShift(session, 1);
  const before = session.profile;
  session.startPractice();
  serve(session);
  assert.equal(session.buyUpgrade('stove').ok, false);
  assert.equal(session.nextDay().ok, false);
  assert.equal(session.settleDay().ok, false);
  session.leave();
  assert.deepEqual(session.profile, before);
});

test('abandoning an active shift or practice never banks partial earnings', () => {
  const session = create();
  session.startDay();
  serve(session);
  session.game.pause();
  assert.equal(session.restartCampaign().ok, false, 'reset requires leaving the active shift first');
  session.leave();
  assert.equal(session.game.state.phase, 'menu');
  assert.equal(session.profile.wallet, 0);
  assert.equal(session.settleDay().ok, false);
  assert.equal(session.startDay().ok, true);
});

test('restores settlement upgrades and safely continues after a browser reload', () => {
  const storage = memoryStorage();
  const session = create(storage);
  settledShift(session);
  session.buyUpgrade('stove');
  const reloaded = create(storage);
  assert.equal(reloaded.profile.upgrades.stove, 1);
  assert.equal(reloaded.profile.summary.served, 4);
  assert.equal(reloaded.startDay().ok, false, 'a saved summary must be advanced or campaign restarted');
  assert.equal(reloaded.nextDay().ok, true);
  assert.equal(reloaded.game.state.day, 2);
});

test('invalid JSON, unknown versions and non-object save data fall back to playable defaults', () => {
  for (const value of ['bad json', 'null', '[]', '42', '{"version":999,"wallet":9000}']) {
    const session = create(memoryStorage(value));
    assert.equal(session.profile.wallet, 0);
    assert.equal(session.profile.day, 1);
    assert.equal(session.startDay().ok, true);
  }
});

test('clamps hostile numeric values and drops inconsistent saved summaries', () => {
  const session = create(memoryStorage(JSON.stringify({ version: 1, day: 99, wallet: -999, upgrades: { stove: 99, patience: -1, charm: '3' }, bestScore: 'NaN', totalServed: -3, sound: 'false', completed: 'true', summary: { day: 2 } })));
  assert.equal(session.profile.day, 5);
  assert.equal(session.profile.wallet, 0);
  assert.deepEqual(session.profile.upgrades, { stove: 3, patience: 0, charm: 0 });
  assert.equal(session.profile.bestScore, 0);
  assert.equal(session.profile.totalServed, 0);
  assert.equal(session.profile.sound, true);
  assert.equal(session.profile.completed, false);
  assert.equal(session.profile.summary, null);
});

test('drops invalid persisted leaderboard rows and derives current-run totals from recorded entries', () => {
  const session = create(memoryStorage(JSON.stringify({
    version: 1, day: 3,
    leaderboards: {
      daily: [
        { id: 2, day: 2, score: 80, served: 2 },
        { id: 1, day: 1, score: 55, served: 1, rank: 999 },
        { id: 2, day: 1, score: 1000, served: 9 },
        { id: 3, day: 0, score: 4000, served: 3 },
        { id: 4, day: 1, score: -1, served: 1 },
        { id: 5, day: 1, score: '300', served: 3 },
        { id: 6, day: 1, score: 99, served: -5 },
        { id: '7', day: 1, score: 99, served: 1 }, null
      ],
      campaign: [{ id: 1, day: 3, score: 99999, served: 10 }]
    },
    run: { entryIds: [1, 2], score: 9999999, served: 9999999 }
  })));
  assert.deepEqual(session.getLeaderboard('daily'), [
    { id: 2, day: 2, score: 80, served: 2, rank: 1 },
    { id: 1, day: 1, score: 55, served: 1, rank: 2 }
  ]);
  assert.deepEqual(session.getLeaderboard('campaign'), []);
  assert.deepEqual(session.profile.run, { entryIds: [1, 2], score: 135, served: 3 });
});

test('restores only valid unique submission UUIDs and keeps older scores ranked', () => {
  const valid = 'F00D0000-1234-4000-8000-000000000001';
  const session = create(memoryStorage(JSON.stringify({
    version: 1,
    leaderboards: {
      daily: [
        { id: 1, day: 1, score: 30, served: 1, submissionId: valid },
        { id: 2, day: 2, score: 20, served: 1, submissionId: 'f00d0000-1234-1000-8000-000000000002' },
        { id: 3, day: 3, score: 10, served: 1 }
      ],
      campaign: [{ id: 1, day: 5, score: 100, served: 5, submissionId: valid.toLowerCase() }]
    }
  })));
  assert.equal(session.getLeaderboardSubmissionId('daily', 1), valid.toLowerCase());
  assert.equal(session.getLeaderboardSubmissionId('daily', 2), null);
  assert.equal(session.getLeaderboardSubmissionId('daily', 3), null);
  assert.equal(session.getLeaderboardSubmissionId('campaign', 1), null);
  assert.equal(session.getLeaderboard('daily').length, 3);
  assert.equal(session.getLeaderboard('campaign').length, 1);
});

test('blocked storage, throwing getters and quota errors preserve in-memory play', () => {
  const blocked = create({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } });
  assert.equal(blocked.storageAvailable, false);
  settledShift(blocked);
  assert.ok(blocked.profile.wallet > 0);
  assert.equal(blocked.save(), false);
  const getterStorage = Object.create(null, { getItem: { get() { throw new Error('getter'); } } });
  const getterSession = create(getterStorage);
  assert.equal(getterSession.startDay().ok, true);
  const memory = create(null);
  settledShift(memory);
  assert.equal(memory.storageAvailable, false);
});

test('a write quota error downgrades a readable store without losing current wallet or sound', () => {
  const session = create({ getItem() { return null; }, setItem() { throw new Error('QuotaExceededError'); } });
  assert.equal(session.storageAvailable, true);
  settledShift(session);
  assert.ok(session.profile.wallet > 0);
  assert.equal(session.storageAvailable, false);
  session.setSound(false);
  assert.equal(session.profile.sound, false);
  assert.equal(session.save(), false);
});

test('does not access unrelated storage keys and saves only versioned profile data', () => {
  const accesses = [];
  const session = create({ getItem(key) { accesses.push(key); return null; }, setItem(key, value) { accesses.push(key); assert.equal(JSON.parse(value).version, 1); } });
  session.setSound(false);
  assert.equal(session.save(), true);
  assert.ok(accesses.every(key => key === KitchenSession.STORAGE_KEY));
  assert.equal(KitchenSession.STORAGE_KEY, 'xiaoman-kitchen:v1');
});

test('sound state persists as a boolean and snapshots cannot mutate live game state', () => {
  const storage = memoryStorage();
  const session = create(storage);
  session.setSound(false);
  assert.equal(create(storage).profile.sound, false);
  session.setSound('yes');
  assert.equal(session.profile.sound, false);
  session.startDay();
  const copy = session.snapshot();
  copy.game.score = 9000;
  copy.profile.upgrades.stove = 3;
  assert.equal(session.game.state.score, 0);
  assert.equal(session.profile.upgrades.stove, 0);
});

test('classic-script browser load requires no Node APIs and handles unavailable localStorage', () => {
  assert.ok(fs.existsSync(sessionPath), 'session.js must exist');
  const browser = {};
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('SecurityError'); } });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'menu.js'), 'utf8'), browser);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8'), browser);
  vm.runInNewContext(fs.readFileSync(sessionPath, 'utf8'), browser);
  const session = browser.KitchenSession.createSession();
  assert.equal(session.storageAvailable, false);
  assert.equal(session.startDay().ok, true);
  session.game.tick(90);
  const { summary } = session.settleDay();
  assert.equal(summary.dailyEntryId, 1);
  assert.equal(session.getLeaderboard().length, 1);
  assert.equal(session.getLeaderboardSubmissionId('daily', 1), null);
});
