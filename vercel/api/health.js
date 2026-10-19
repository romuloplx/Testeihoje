const { send } = require('./lib/ai');
module.exports = (req, res) => {
  send(res, 200, {
    ok: true,
    mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
    projects: 'browser-localstorage',
    uptime: process.uptime()
  });
};
