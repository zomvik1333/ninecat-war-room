// Shared helpers for the Yahoo Fantasy connection.
// Tokens live only in an encrypted, http only cookie in your browser. Nothing is stored on the server.
const crypto = require('crypto');

const AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const API = 'https://fantasysports.yahooapis.com/fantasy/v2/';
const COOKIE = 'ncw_yahoo';
const LEAGUE_ID = String(process.env.YAHOO_LEAGUE_ID || '82878');

function configured() { return !!(process.env.YAHOO_CLIENT_ID && process.env.YAHOO_CLIENT_SECRET); }
function origin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + host;
}
function redirectUri(req) { return process.env.YAHOO_REDIRECT_URI || (origin(req) + '/api/callback'); }

function key() { return crypto.createHash('sha256').update('ncw:' + process.env.YAHOO_CLIENT_SECRET).digest(); }
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64url');
}
function unseal(s) {
  try {
    const b = Buffer.from(s, 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
  } catch (e) { return null; }
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function setCookie(res, name, val, maxAge) {
  const c = name + '=' + encodeURIComponent(val) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
}
function getSession(req) { const v = cookies(req)[COOKIE]; return v ? unseal(v) : null; }
function saveSession(res, s) { setCookie(res, COOKIE, seal(s), 60 * 60 * 24 * 60); }
function clearSession(res) { setCookie(res, COOKIE, '', 0); }

async function tokenCall(req, params) {
  const basic = Buffer.from(process.env.YAHOO_CLIENT_ID + ':' + process.env.YAHOO_CLIENT_SECRET).toString('base64');
  const body = new URLSearchParams(Object.assign({ redirect_uri: redirectUri(req) }, params));
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json().catch(() => ({}));
  if (process.env.NCW_DEBUG) console.log('token_resp', params.grant_type, r.status, Object.keys(j).join(','), j.scope || '', j.error || '', j.error_description || '');
  if (!r.ok || !j.access_token) { const e = new Error('token'); e.status = 401; e.detail = j.error_description || j.error || r.status; throw e; }
  return { at: j.access_token, rt: j.refresh_token || params.refresh_token, exp: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000 };
}

// Walk any Yahoo JSON shape and call fn on every object.
function walk(o, fn) {
  if (Array.isArray(o)) { o.forEach(x => walk(x, fn)); return; }
  if (o && typeof o === 'object') { fn(o); Object.values(o).forEach(v => walk(v, fn)); }
}
// Yahoo returns metadata as a list of one key objects. Merge them into one object.
function flat(list) {
  const out = {};
  const add = x => { if (Array.isArray(x)) x.forEach(add); else if (x && typeof x === 'object') Object.assign(out, x); };
  add(list);
  return out;
}

async function api(req, res, sess, path) {
  if (!sess || !sess.rt) { const e = new Error('login'); e.status = 401; throw e; }
  if (!sess.at || Date.now() > sess.exp) { Object.assign(sess, await tokenCall(req, { grant_type: 'refresh_token', refresh_token: sess.rt })); saveSession(res, sess); }
  const url = API + path + (path.includes('?') ? '&' : '?') + 'format=json';
  let r = await fetch(url, { headers: { Authorization: 'Bearer ' + sess.at } });
  if (r.status === 401) {
    Object.assign(sess, await tokenCall(req, { grant_type: 'refresh_token', refresh_token: sess.rt })); saveSession(res, sess);
    r = await fetch(url, { headers: { Authorization: 'Bearer ' + sess.at } });
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    console.error('yahoo_fail', r.status, path, 'tokenlen', String(sess.at||'').length, txt.replace(/\s+/g, ' ').slice(0, 400));
    const m = txt.match(/<description>([^<]*)<\/description>/) || txt.match(/"description"\s*:\s*"([^"]*)"/);
    const noAccess = r.status === 403 && /not authorized/i.test(txt);
    const e = new Error(noAccess ? 'yahoo_locked' : 'yahoo'); e.status = r.status === 401 ? 401 : noAccess ? 403 : 502; e.detail = 'Yahoo answered ' + r.status + (m ? ', ' + m[1] : ''); throw e;
  }
  return r.json();
}

async function leagueKey(req, res, sess) {
  if (!sess || !sess.rt) { const e = new Error('login'); e.status = 401; throw e; }
  if (sess.lk) return sess.lk;
  let lk = null;
  // first ask for the league directly by NBA game code, then fall back to the list of your leagues
  try { const j0 = await api(req, res, sess, 'league/nba.l.' + LEAGUE_ID); walk(j0, o => { if (!lk && o.league_key && String(o.league_id) === LEAGUE_ID) lk = o.league_key; }); } catch (e) { if (e.status === 401) throw e; }
  if (!lk) {
    try { const j1 = await api(req, res, sess, 'game/nba'); let gk = null; walk(j1, o => { if (!gk && o.game_key && o.code === 'nba') gk = o.game_key; }); if (gk) { const j2 = await api(req, res, sess, 'league/' + gk + '.l.' + LEAGUE_ID); walk(j2, o => { if (!lk && o.league_key) lk = o.league_key; }); } } catch (e) { if (e.status === 401) throw e; }
  }
  if (!lk) {
    const j = await api(req, res, sess, 'users;use_login=1/games;game_keys=nba/leagues');
    walk(j, o => { if (!lk && o.league_key && String(o.league_id) === LEAGUE_ID) lk = o.league_key; });
  }
  if (!lk) { const e = new Error('noleague'); e.status = 404; e.detail = 'League ' + LEAGUE_ID + ' was not found on this Yahoo account for the current NBA season'; throw e; }
  sess.lk = lk; saveSession(res, sess);
  return lk;
}

function parseLeagueMeta(j) {
  let meta = null;
  walk(j, o => { if (!meta && o.league_key && o.name) meta = o; });
  return meta ? { key: meta.league_key, name: meta.name, draft_status: meta.draft_status || null, num_teams: meta.num_teams ? Number(meta.num_teams) : null } : null;
}
function parseDraft(j) {
  const picks = [];
  walk(j, o => { if (o.draft_result) { const d = o.draft_result; picks.push({ pick: Number(d.pick), round: Number(d.round), team_key: d.team_key || null, player_key: d.player_key || null }); } });
  picks.sort((a, b) => a.pick - b.pick);
  return picks;
}
function parseTeams(j) {
  const teams = [];
  walk(j, o => { if (Array.isArray(o.team)) { const t = flat(o.team[0]); if (t.team_key) teams.push({ key: t.team_key, name: t.name || ('Team ' + t.team_id), mine: Number(t.is_owned_by_current_login || 0) === 1, slot: t.draft_position ? Number(t.draft_position) : null }); } });
  return teams;
}
function parsePlayers(j) {
  const out = [];
  walk(j, o => { if (Array.isArray(o.player)) { const p = flat(o.player[0]); if (p.player_key) out.push({ key: p.player_key, name: (p.name && (p.name.full || [p.name.first, p.name.last].join(' '))) || '', team: p.editorial_team_abbr || '', pos: (p.display_position || '').replace(/\s+/g, '') }); } });
  return out;
}

function fail(res, e) {
  res.statusCode = e.status || 500;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: e.message, detail: e.detail || null }));
}
function send(res, obj) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = { AUTH_URL, configured, redirectUri, seal, unseal, cookies, setCookie, getSession, saveSession, clearSession, tokenCall, api, leagueKey, parseLeagueMeta, parseDraft, parseTeams, parsePlayers, walk, flat, fail, send, LEAGUE_ID };
