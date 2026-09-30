const Y = require('./_yahoo');
module.exports = (req, res) => {
  const s = Y.configured() ? Y.getSession(req) : null;
  Y.send(res, { configured: Y.configured(), connected: !!(s && s.rt), league_id: Y.LEAGUE_ID });
};
