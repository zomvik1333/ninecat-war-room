const Y = require('./_yahoo');
module.exports = (req, res) => { Y.clearSession(res); Y.send(res, { ok: true }); };
