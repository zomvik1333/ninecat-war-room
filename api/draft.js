// Returns the league, every draft pick so far, and (with ?teams=1) the teams and their draft slots.
const Y = require('./_yahoo');
module.exports = async (req, res) => {
  try {
    if (!Y.configured()) { const e = new Error('not_configured'); e.status = 503; throw e; }
    const sess = Y.getSession(req);
    const lk = await Y.leagueKey(req, res, sess);
    const url = new URL(req.url, 'https://x');
    const dj = await Y.api(req, res, sess, 'league/' + lk + '/draftresults');
    const out = { league: Y.parseLeagueMeta(dj), picks: Y.parseDraft(dj), at: Date.now() };
    if (url.searchParams.get('teams') === '1') out.teams = Y.parseTeams(await Y.api(req, res, sess, 'league/' + lk + '/teams'));
    Y.send(res, out);
  } catch (e) { Y.fail(res, e); }
};
