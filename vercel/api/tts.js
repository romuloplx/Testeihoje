const { getBody, send, ttsWithFallback } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { text, voice = 'onyx', lang = 'pt-BR' } = await getBody(req);
  if (!text) return send(res, 400, { error: 'Texto vazio' });
  const out = await ttsWithFallback({ text, voice, lang });
  if (out.error) {
    return send(res, 502, { error: 'Voz falhou em todos os provedores: ' + out.error, fallback: 'browser' });
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('X-Audio-Provider', out.provider);
  res.setHeader('Content-Disposition', 'inline; filename="narracao.mp3"');
  res.end(out.buffer);
};
