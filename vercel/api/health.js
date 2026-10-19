const { send, probeOpenAI } = require('./lib/ai');
module.exports = async (req, res) => {
  const out = {
    ok: true,
    mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
    projects: 'browser-localstorage',
    uptime: process.uptime()
  };
  // Diagnóstico: /api/health?check=1 testa a OpenAI de verdade (modelos, chat, TTS, imagem)
  if (req.query && String(req.query.check) === '1') {
    out.openaiCheck = await probeOpenAI();
  }
  send(res, 200, out);
};
