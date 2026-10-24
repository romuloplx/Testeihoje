const { generateSceneImage, hasOpenRouterImageApiKey, getBody, send } = require('./lib/ai');

module.exports = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, private');
    if (req.method === 'GET') {
      return send(res, 200, { openrouterImageConfigured: hasOpenRouterImageApiKey() });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return send(res, 405, { error: 'Método não permitido. Use GET ou POST.' });
    }

    const { prompt, style, width, height, references } = await getBody(req);
    if (!prompt || !prompt.trim()) return send(res, 400, { error: 'Descreva a cena.' });
    const img = await generateSceneImage({ prompt, style, width, height, references });
    if (!img || !img.imageBase64) {
      return send(res, 200, {
        imageBase64: null,
        mock: true,
        error: img && img.error,
        message: 'Geração de imagem falhou' + (img && img.error ? ` (${img.error})` : '') + ' — usando renderizador direto.'
      });
    }
    return send(res, 200, { imageBase64: img.imageBase64, mime: img.mime, model: img.model, costUsd: img.costUsd });
  } catch (e) {
    return send(res, 200, { imageBase64: null, mock: true, error: e.message || 'Erro interno ao gerar imagem' });
  }
};
