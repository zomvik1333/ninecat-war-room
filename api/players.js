// Looks up names, NBA team and positions for up to 50 Yahoo player keys.
const Y = require('./_yahoo');
module.exports = async (req, res) => {
  try {
    if (!Y.configured()) { const e = new Error('not_configured'); e.status = 503; throw e; }
    const sess = Y.getSession(req);
    const lk = await Y.leagueKey(req, res, sess);
    const keys = String(new URL(req.url, 'https://x').searchParams.get('keys') || '').split(',').filter(k => /^[0-9]+\.p\.[0-9]+$/.test(k)).slice(0, 50);
    const out = [];
    for (let i = 0; i < keys.length; i += 25) {
      const j = await Y.api(req, res, sess, 'league/' + lk + '/players;player_keys=' + keys.slice(i, i + 25).join(','));
      out.push(...Y.parsePlayers(j));
    }
    Y.send(res, { players: out });
  } catch (e) { Y.fail(res, e); }
};
