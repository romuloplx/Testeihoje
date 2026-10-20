const { enhanceScript, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  try {
    const body = await getBody(req);
    const text = String(body.text || '').trim();
    if (!text) return send(res, 400, { error: 'Envie "text" com o roteiro.' });
    const out = await enhanceScript({ text, mode: body.mode });
    if (out.error) return send(res, 502, { error: 'Edição falhou: ' + out.error });
    send(res, 200, { text: out.text, provider: out.provider || 'ia' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
};
