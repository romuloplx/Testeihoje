const { generateAvatarPortrait, generateAvatarScript, generateAvatarVideo, detectAvatarFaceLandmarks, getBody, send } = require('./lib/ai');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  try {
    const body = await getBody(req);
    const action = String(body.action || 'portrait');

    if (action === 'detect_face') {
      const out = await detectAvatarFaceLandmarks({
        imageBase64: body.imageBase64,
        mime: body.mime || 'image/jpeg'
      });
      return send(res, 200, out);
    }

    if (action === 'portrait') {
      const out = await generateAvatarPortrait({ prompt: body.prompt, style: body.style });
      if (!out || !out.imageBase64) {
        return send(res, 200, {
          imageBase64: null,
          mock: true,
          error: out && out.error,
          message: 'Retrato gerado localmente no estúdio (provedores externos indisponíveis no momento).'
        });
      }
      return send(res, 200, { imageBase64: out.imageBase64, mime: out.mime || 'image/png', model: out.model });
    }

    if (action === 'script') {
      const out = await generateAvatarScript({
        topic: body.topic || body.prompt,
        durationSec: body.durationSec,
        tone: body.tone
      });
      return send(res, 200, out);
    }

    if (action === 'video') {
      const out = await generateAvatarVideo({
        imageBase64: body.imageBase64,
        prompt: body.prompt,
        duration: body.duration
      });
      return send(res, 200, out);
    }

    return send(res, 400, { error: `Ação desconhecida: ${action}` });
  } catch (e) {
    return send(res, 500, { error: e.message || 'Erro interno no Avatar IA' });
  }
};
