const { generateSceneImage, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { prompt, style, width, height } = await getBody(req);
  if (!prompt || !prompt.trim()) return send(res, 400, { error: 'Descreva a cena.' });
  const img = await generateSceneImage({ prompt, style, width, height });
  if (!img || !img.imageBase64) {
    return send(res, 200, { imageBase64: null, mock: true, error: img && img.error, message: 'Geração de imagem falhou' + (img && img.error ? ` (${img.error})` : '') + ' — usando renderizador direto.' });
  }
  send(res, 200, { imageBase64: img.imageBase64, mime: img.mime, model: img.model });
};

