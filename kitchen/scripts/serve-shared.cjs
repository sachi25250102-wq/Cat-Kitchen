const { mkdirSync } = require('node:fs');
const { createServer } = require('node:http');
const { networkInterfaces } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { buildStandalone } = require('./build-standalone.cjs');

const ROOT = join(__dirname, '..');
const API = '/api/leaderboard';
const MAX_BODY_BYTES = 4096;
const ENTRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = ['daily', 'campaign'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readJson(request) {
  const type = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') {
    request.resume();
    throw new HttpError(415, '请以 JSON 提交成绩。');
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
      else reject(new HttpError(413, '提交内容太长。'));
    });
    request.once('error', reject);
    request.once('end', () => {
      if (size > MAX_BODY_BYTES) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, '成绩格式有误。'));
      }
    });
  });
}

function isIntegerBetween(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function isEntryId(value) {
  return typeof value === 'string' && ENTRY_ID.test(value);
}

function validateSubmission(body) {
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim().normalize('NFC') : '';
  if (!/[\p{L}\p{N}\p{P}\p{S}]/u.test(nickname) || [...nickname].length > 16 || /[\p{Cc}\p{Cs}\u202a-\u202e\u2066-\u2069]/u.test(nickname)) {
    throw new HttpError(400, '昵称须为 1 到 16 个字符。');
  }
  if (!Array.isArray(body.entries) || body.entries.length < 1 || body.entries.length > 2) {
    throw new HttpError(400, '没有可提交的营业成绩。');
  }
  const entries = body.entries.map(entry => {
    if (!entry || !isEntryId(entry.id) || !KINDS.includes(entry.kind)) {
      throw new HttpError(400, '成绩标识有误。');
    }
    const { id, kind, day, score, served } = entry;
    const days = kind === 'campaign' ? 5 : 1;
    if (!isIntegerBetween(day, days, 5) || !isIntegerBetween(served, 0, 200 * days) ||
        !isIntegerBetween(score, 0, 300 * served + 1000 * days)) {
      throw new HttpError(400, '营业天数、出餐数或积分超出范围。');
    }
    return { id: id.toLowerCase(), kind, day, score, served };
  });
  const daily = entries.find(entry => entry.kind === 'daily');
  const campaign = entries.find(entry => entry.kind === 'campaign');
  if (!daily || (entries.length === 2 && (!campaign || campaign.id === daily.id ||
      daily.day !== 5 || campaign.score < daily.score || campaign.served < daily.served))) {
    throw new HttpError(400, '五天总成绩须与第 5 天成绩一起提交。');
  }
  return { nickname, daily, campaign };
}

function createSharedGame({ dbPath = ':memory:' } = {}) {
  const html = buildStandalone(ROOT).replace('</head>',
    `  <meta name="xiaoman-shared-leaderboard" content="${API}">\n</head>`);
  const db = new DatabaseSync(dbPath, { timeout: 3000 });
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      sequence INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('daily', 'campaign')),
      day INTEGER NOT NULL,
      score INTEGER NOT NULL,
      served INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      campaign_daily_id TEXT UNIQUE REFERENCES results(id),
      CHECK ((kind = 'campaign') = (campaign_daily_id IS NOT NULL))
    ) STRICT;
    CREATE INDEX IF NOT EXISTS results_rank ON results (kind, score DESC, sequence);
  `);
  const rankedResult = `
    SELECT r.id, r.kind, r.day, r.score, r.served, r.nickname,
      1 + (SELECT count(*) FROM results AS better WHERE better.kind = r.kind AND better.score > r.score) AS rank
    FROM results AS r`;
  const top = db.prepare(`${rankedResult} WHERE r.kind = ? ORDER BY r.score DESC, r.sequence LIMIT 10`);
  const find = db.prepare(`${rankedResult} WHERE r.kind = ? AND r.id = ?`);
  const findLink = db.prepare('SELECT campaign_daily_id FROM results WHERE id = ?');
  const insert = db.prepare(`
    INSERT INTO results (id, kind, day, score, served, nickname, campaign_daily_id) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);

  function writeResult({ id, kind, day, score, served }, nickname, dailyId = null) {
    insert.run(id, kind, day, score, served, nickname, dailyId);
    const saved = find.get(kind, id);
    if (!saved || saved.day !== day || saved.score !== score || saved.served !== served ||
        findLink.get(id).campaign_daily_id !== dailyId) {
      throw new HttpError(409, '该成绩已提交，记录无法覆盖。');
    }
    return saved;
  }

  function submit({ daily, campaign, nickname }) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const savedDaily = writeResult(daily, nickname);
      const results = [savedDaily];
      if (campaign) results.push(writeResult(campaign, savedDaily.nickname, savedDaily.id));
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function json(response, status, payload) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
  }

  const server = createServer({ requestTimeout: 10000, headersTimeout: 5000 }, async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(html);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      if (url.pathname !== API) throw new HttpError(404, '找不到该页面。');
      if (request.method === 'GET') {
        const kind = url.searchParams.get('kind') ?? 'daily';
        const entryId = url.searchParams.get('entryId');
        if (!KINDS.includes(kind) || (entryId !== null && !isEntryId(entryId))) {
          throw new HttpError(400, '排行榜参数有误。');
        }
        const current = entryId ? find.get(kind, entryId.toLowerCase()) ?? null : null;
        json(response, 200, { rows: top.all(kind), current });
        return;
      }
      if (request.method === 'POST') {
        const data = validateSubmission(await readJson(request));
        json(response, 200, { entries: submit(data) });
        return;
      }
      response.setHeader('Allow', 'GET, POST');
      throw new HttpError(405, '该操作不受支持。');
    } catch (error) {
      if (error instanceof HttpError) json(response, error.status, { error: error.message });
      else {
        console.error(error);
        json(response, 500, { error: '排行榜暂时无法使用，请稍后重试。' });
      }
    }
  });
  server.once('close', () => db.close());
  return server;
}

if (require.main === module) {
  const dbPath = resolve(process.env.KITCHEN_DB || join(ROOT, '.local', 'scores.sqlite'));
  const lan = process.argv.includes('--lan');
  const host = process.env.KITCHEN_HOST || (lan ? '0.0.0.0' : '127.0.0.1');
  const port = Number(process.env.PORT || 8787);
  mkdirSync(dirname(dbPath), { recursive: true });
  const server = createSharedGame({ dbPath });
  server.listen(port, host, () => {
    const actualPort = server.address().port;
    const address = host === '0.0.0.0' ? '127.0.0.1' : host.includes(':') ? `[${host}]` : host;
    console.log(`小满食堂 http://${address}:${actualPort}`);
    if (host === '0.0.0.0') {
      for (const item of Object.values(networkInterfaces()).flat()) {
        if (item.family === 'IPv4' && !item.internal) console.log(`局域网 http://${item.address}:${actualPort}`);
      }
    }
  });
}

module.exports = { createSharedGame };
