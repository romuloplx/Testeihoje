const { getBody, send, ttsWithFallback } = require('./lib/ai');
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
    const { text, voice = 'onyx', lang = 'pt-BR', emotion = '', exactTextOnly = false } = await getBody(req);
    if (!text) return send(res, 400, { error: 'Texto vazio' });
    const out = await ttsWithFallback({ text, voice, lang, emotion, exactTextOnly: exactTextOnly === true });
    if (out.error) {
      return send(res, 502, { error: 'Voz selecionada indisponível: ' + out.error });
    }
    const isWav = out.buffer && out.buffer.length >= 4 && out.buffer.subarray(0, 4).toString('ascii') === 'RIFF';
    res.statusCode = 200;
    res.setHeader('Content-Type', isWav ? 'audio/wav' : 'audio/mpeg');
    res.setHeader('X-Audio-Provider', out.provider);
    res.setHeader('Content-Disposition', isWav ? 'inline; filename="narracao.wav"' : 'inline; filename="narracao.mp3"');
    res.end(out.buffer);
  } catch (e) {
    send(res, 502, { error: 'Erro interno de TTS: ' + (e.message || 'falha inesperada') });
  }
};

