(function (root, factory) {
  'use strict';
  const engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.KitchenEngine;
  const api = factory(engine, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KitchenSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (engine, root) {
  'use strict';

  const STORAGE_KEY = 'xiaoman-kitchen:v1';
  const DAY_COUNT = engine.DAY_COUNT;
  const MAX_RECORD = 10000000;
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const UPGRADE_DEFS = Object.freeze({
    stove: Object.freeze({ name: '铸铁小灶', description: '火候指针变慢，更容易把握出锅时机。', costs: Object.freeze([40, 70, 110]) }),
    patience: Object.freeze({ name: '窗边好茶', description: '每级为客人增加 6 秒等待时间。', costs: Object.freeze([30, 55, 90]) }),
    charm: Object.freeze({ name: '招财小猫', description: '每级让每道料理多赚 2 金币。', costs: Object.freeze([35, 60, 100]) })
  });

  function integer(value, max = MAX_RECORD) {
    return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emptyRun() {
    return { entryIds: [], score: 0, served: 0 };
  }

  function defaults() {
    return {
      version: 1, day: 1, wallet: 0, upgrades: { stove: 0, patience: 0, charm: 0 },
      bestScore: 0, bestCombo: 0, totalServed: 0, completed: false, sound: true, summary: null,
      leaderboards: { daily: [], campaign: [] }, run: emptyRun()
    };
  }

  function summaryFor(value, day) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.day !== day || !Number.isFinite(value.score) || !Number.isFinite(value.coins) || !Number.isFinite(value.served)) return null;
    const stats = value.stats && typeof value.stats === 'object' ? value.stats : {};
    const served = integer(value.served);
    return {
      day, score: integer(value.score), coins: integer(value.coins), served,
      missed: integer(value.missed), bestCombo: integer(value.bestCombo),
      stars: served >= 10 ? 3 : served >= 5 ? 2 : served > 0 ? 1 : 0,
      dailyEntryId: null, campaignEntryId: null,
      stats: {
        perfect: integer(stats.perfect), burned: integer(stats.burned), pests: integer(stats.pests),
        assists: integer(stats.assists), sets: integer(stats.sets), tastes: integer(stats.tastes),
        bentos: integer(stats.bentos), cold: integer(stats.cold)
      }
    };
  }

  function boundedWhole(value, minimum, maximum) {
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  }

  function normalizeBoard(value, kind, submissionIds) {
    if (!Array.isArray(value)) return [];
    const earliestDay = kind === 'campaign' ? DAY_COUNT : 1;
    const maximum = kind === 'campaign' ? MAX_RECORD * DAY_COUNT : MAX_RECORD;
    const rows = [];
    const ids = new Set();
    for (const row of value) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const { id, day, score, served } = row;
      if (!boundedWhole(id, 1, Number.MAX_SAFE_INTEGER - 1) || ids.has(id) ||
          !boundedWhole(day, earliestDay, DAY_COUNT) || !boundedWhole(score, 0, maximum) ||
          !boundedWhole(served, 0, maximum)) continue;
      const candidate = typeof row.submissionId === 'string' && UUID_V4.test(row.submissionId) ? row.submissionId.toLowerCase() : null;
      const submissionId = candidate && !submissionIds.has(candidate) ? candidate : null;
      if (submissionId) submissionIds.add(submissionId);
      rows.push({ id, day, score, served, submissionId });
      ids.add(id);
    }
    return rows.sort((a, b) => a.id - b.id);
  }

  function restoreRun(value, profile) {
    const ids = value?.entryIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > DAY_COUNT) return emptyRun();
    const lastDay = profile.summary ? profile.day : profile.day - 1;
    const firstDay = lastDay - ids.length + 1;
    if (firstDay < 1 || (profile.summary && profile.summary.dailyEntryId !== ids[ids.length - 1])) return emptyRun();
    const run = emptyRun();
    for (const [index, id] of ids.entries()) {
      const row = profile.leaderboards.daily.find(entry => entry.id === id);
      if (!row || row.day !== firstDay + index || (index > 0 && id !== ids[index - 1] + 1)) return emptyRun();
      run.entryIds.push(id);
      run.score += row.score;
      run.served += row.served;
    }
    return run;
  }

  function makeSubmissionId() {
    try {
      const crypto = root.crypto;
      if (typeof crypto?.getRandomValues !== 'function') return null;
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    } catch {
      return null;
    }
  }

  function appendEntry(rows, { day, score, served }) {
    const id = (rows[rows.length - 1]?.id ?? 0) + 1;
    rows.push({ id, day, score, served, submissionId: makeSubmissionId() });
    return id;
  }

  function normalize(value) {
    const profile = defaults();
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return profile;
    profile.day = Math.max(1, integer(value.day, DAY_COUNT));
    for (const key of ['wallet', 'bestScore', 'bestCombo', 'totalServed']) profile[key] = integer(value[key]);
    const upgrades = value.upgrades && typeof value.upgrades === 'object' ? value.upgrades : {};
    for (const key of Object.keys(UPGRADE_DEFS)) profile.upgrades[key] = integer(upgrades[key], 3);
    profile.sound = typeof value.sound === 'boolean' ? value.sound : true;
    profile.summary = summaryFor(value.summary, profile.day);
    const submissionIds = new Set();
    profile.leaderboards.daily = normalizeBoard(value.leaderboards?.daily, 'daily', submissionIds);
    profile.leaderboards.campaign = normalizeBoard(value.leaderboards?.campaign, 'campaign', submissionIds);
    if (profile.summary) {
      const daily = profile.leaderboards.daily.find(row => row.id === value.summary.dailyEntryId);
      if (daily && daily.day === profile.day && daily.score === profile.summary.score && daily.served === profile.summary.served) {
        profile.summary.dailyEntryId = daily.id;
      }
    }
    profile.run = restoreRun(value.run, profile);
    if (profile.summary && profile.run.entryIds.length === DAY_COUNT) {
      const campaign = profile.leaderboards.campaign.find(row => row.id === value.summary.campaignEntryId);
      if (campaign && campaign.score === profile.run.score && campaign.served === profile.run.served) {
        profile.summary.campaignEntryId = campaign.id;
      }
    }
    // Derive completion from the current campaign length. Old third-day saves can continue.
    profile.completed = profile.day === DAY_COUNT && profile.summary !== null;
    return profile;
  }

  function createSession(options = {}) {
    const game = engine.createGame({ random: options.random });
    let storage = null;
    let storageAvailable = false;
    let profile = defaults();
    let activeCampaignShift = false;
    try {
      storage = Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : root.localStorage;
      storageAvailable = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
      if (storageAvailable) {
        const saved = storage.getItem(STORAGE_KEY);
        if (saved) {
          try { profile = normalize(JSON.parse(saved)); } catch (_error) { profile = defaults(); }
        }
      }
    } catch (_error) {
      storageAvailable = false;
    }

    function save() {
      if (!storageAvailable) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(profile));
        return true;
      } catch (_error) {
        storageAvailable = false;
        return false;
      }
    }

    function busy() {
      return game.state.phase === 'playing' || game.state.phase === 'paused';
    }

    function fail(reason) {
      return { ok: false, reason };
    }

    function startDay() {
      if (busy()) return fail('busy');
      if (activeCampaignShift && game.state.phase === 'summary') return fail('unsettled-shift');
      if (profile.completed) return fail('campaign-complete');
      if (profile.summary) return fail('settlement-pending');
      activeCampaignShift = true;
      game.start({ day: profile.day, upgrades: profile.upgrades });
      return { ok: true, state: game.state };
    }

    function startPractice(day = profile.day) {
      if (busy()) return fail('busy');
      if (activeCampaignShift && game.state.phase === 'summary') return fail('unsettled-shift');
      if (!Number.isInteger(day) || day < 1 || day > DAY_COUNT) return fail('invalid-day');
      activeCampaignShift = false;
      game.start({ day, practice: true, upgrades: profile.upgrades });
      return { ok: true, state: game.state };
    }

    function settleDay() {
      if (game.state.practice && busy()) return fail('practice');
      if (profile.summary) return { ok: true, alreadySettled: true, summary: clone(profile.summary) };
      if (!activeCampaignShift || game.state.phase !== 'summary' || game.state.practice) return fail('not-finished');
      const summary = summaryFor(game.state, profile.day);
      profile.wallet = integer(profile.wallet + summary.coins);
      profile.bestScore = Math.max(profile.bestScore, summary.score);
      profile.bestCombo = Math.max(profile.bestCombo, summary.bestCombo);
      profile.totalServed = integer(profile.totalServed + summary.served);
      summary.dailyEntryId = appendEntry(profile.leaderboards.daily, summary);
      profile.run.entryIds.push(summary.dailyEntryId);
      profile.run.score += summary.score;
      profile.run.served += summary.served;
      if (profile.day === DAY_COUNT && profile.run.entryIds.length === DAY_COUNT) {
        summary.campaignEntryId = appendEntry(profile.leaderboards.campaign, { day: DAY_COUNT, ...profile.run });
      }
      profile.summary = summary;
      profile.completed = profile.day === DAY_COUNT;
      activeCampaignShift = false;
      save();
      return { ok: true, alreadySettled: false, summary: clone(summary) };
    }

    function getLeaderboard(kind = 'daily') {
      if (kind !== 'daily' && kind !== 'campaign') return [];
      const rows = profile.leaderboards[kind].slice().sort((a, b) => b.score - a.score || a.id - b.id);
      let rank = 0;
      return rows.map(({ id, day, score, served }, index) => {
        if (index === 0 || score !== rows[index - 1].score) rank = index + 1;
        return { id, day, score, served, rank };
      });
    }

    function getLeaderboardSubmissionId(kind, localEntryId) {
      if (kind !== 'daily' && kind !== 'campaign') return null;
      return profile.leaderboards[kind].find(row => row.id === localEntryId)?.submissionId ?? null;
    }

    function canShop() {
      return Boolean(profile.summary && !busy());
    }

    function getUpgradeOffer(key) {
      if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(UPGRADE_DEFS, key)) return null;
      const definition = UPGRADE_DEFS[key];
      const level = profile.upgrades[key];
      const maxed = level >= definition.costs.length;
      const nextCost = maxed ? null : definition.costs[level];
      return {
        key, name: definition.name, description: definition.description, level, maxed, nextCost,
        canBuy: canShop() && !maxed && profile.wallet >= nextCost
      };
    }

    function buyUpgrade(key) {
      const offer = getUpgradeOffer(key);
      if (!offer) return fail('unknown-upgrade');
      if (!canShop()) return fail('not-in-settlement');
      if (offer.maxed) return fail('max-level');
      if (profile.wallet < offer.nextCost) return fail('insufficient-coins');
      profile.wallet -= offer.nextCost;
      profile.upgrades[key] += 1;
      save();
      return { ok: true, cost: offer.nextCost, offer: getUpgradeOffer(key) };
    }

    function nextDay() {
      if (busy()) return fail('busy');
      if (!profile.summary) return fail('not-in-settlement');
      if (profile.completed || profile.day >= DAY_COUNT) return fail('campaign-complete');
      profile.day += 1;
      profile.summary = null;
      save();
      return startDay();
    }

    function leave() {
      activeCampaignShift = false;
      game.quit();
      return { ok: true };
    }

    function restartCampaign() {
      if (busy()) return fail('busy');
      const previous = profile;
      profile = defaults();
      for (const key of ['bestScore', 'bestCombo', 'totalServed', 'sound', 'leaderboards']) profile[key] = previous[key];
      leave();
      save();
      return { ok: true };
    }

    function setSound(enabled) {
      if (typeof enabled !== 'boolean') return fail('invalid-sound');
      profile.sound = enabled;
      save();
      return { ok: true };
    }

    return {
      game, get profile() { return clone(profile); }, get storageAvailable() { return storageAvailable; },
      startDay, startPractice, settleDay, nextDay, leave, restartCampaign,
      getUpgradeOffer, buyUpgrade, getLeaderboard, getLeaderboardSubmissionId, setSound, save,
      snapshot() { return { profile: clone(profile), game: clone(game.state), storageAvailable }; }
    };
  }

  return { STORAGE_KEY, UPGRADE_DEFS, createSession };
});
