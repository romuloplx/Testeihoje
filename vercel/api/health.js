const { send, probeOpenAI, fullPipelineProbe, candidatesProbe, unorouterProbe, unorouterVideoProbe } = require('./lib/ai');
module.exports = async (req, res) => {
  const hasAiKey = !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.UNOROUTER_API_KEY);
  const out = {
    ok: true,
    mode: hasAiKey ? 'openai' : 'mock',
    projects: 'browser-localstorage',
    uptime: process.uptime()
  };
  const check = req.query ? String(req.query.check) : '';
  // ?check=1 provedores | ?check=2 pipeline real | ?check=3 candidatos gratuitos | ?check=5 só Unorouter
  if (check === '1') out.openaiCheck = await probeOpenAI();
  if (check === '2') out.pipeline = await fullPipelineProbe();
  if (check === '3') out.candidates = await candidatesProbe();
  if (check === '5') out.unorouter = await unorouterProbe();
  if (check === '6') out.unorouterVideo = await unorouterVideoProbe();
  send(res, 200, out);
};
