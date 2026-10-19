const { send, probeOpenAI, fullPipelineProbe, candidatesProbe } = require('./lib/ai');
module.exports = async (req, res) => {
  const out = {
    ok: true,
    mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
    projects: 'browser-localstorage',
    uptime: process.uptime()
  };
  const check = req.query ? String(req.query.check) : '';
  // ?check=1 provedores | ?check=2 pipeline real | ?check=3 candidatos gratuitos
  if (check === '1') out.openaiCheck = await probeOpenAI();
  if (check === '2') out.pipeline = await fullPipelineProbe();
  if (check === '3') out.candidates = await candidatesProbe();
  send(res, 200, out);
};
