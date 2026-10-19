const { send, probeOpenAI, fullPipelineProbe } = require('./lib/ai');
module.exports = async (req, res) => {
  const out = {
    ok: true,
    mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
    projects: 'browser-localstorage',
    uptime: process.uptime()
  };
  const check = req.query ? String(req.query.check) : '';
  // ?check=1 → testa cada provedor isolado | ?check=2 → testa o pipeline REAL (roteiro+voz+imagem)
  if (check === '1') out.openaiCheck = await probeOpenAI();
  if (check === '2') out.pipeline = await fullPipelineProbe();
  send(res, 200, out);
};
