const { generateSceneImage, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { prompt, style } = await getBody(req);
  if (!prompt || !prompt.trim()) return send(res, 400, { error: 'Descreva a cena.' });
  if (!process.env.OPENAI_API_KEY) {
    return send(res, 200, { imageBase64: null, mock: true, message: 'Sem OPENAI_API_KEY: imagem placeholder será usada.' });
  }
  const img = await generateSceneImage({ prompt, style });
  if (!img) {
    return send(res, 200, { imageBase64: null, mock: true, message: 'Geração de imagem falhou — placeholder será usado.' });
  }
  send(res, 200, { imageBase64: img.imageBase64, mime: img.mime, model: img.model });
};
