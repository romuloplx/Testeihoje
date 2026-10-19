const { getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { text, voice = 'onyx' } = await getBody(req);
  if (!text) return send(res, 400, { error: 'Texto vazio' });
  if (!process.env.OPENAI_API_KEY) {
    return send(res, 200, { mode: 'browser', useBrowserTTS: true, message: 'Use speechSynthesis no navegador.' });
  }
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const voiceMap = { onyx: 'onyx', nova: 'nova', alloy: 'alloy', echo: 'echo', fable: 'fable', shimmer: 'shimmer' };
    const mp3 = await openai.audio.speech.create({ model: 'tts-1', voice: voiceMap[voice] || 'onyx', input: text.slice(0, 4096), response_format: 'mp3' });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="narracao.mp3"');
    res.end(buffer);
  } catch (e) {
    send(res, 500, { error: 'Erro TTS: ' + e.message, fallback: 'browser' });
  }
};
