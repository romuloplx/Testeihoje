const { mockDubResult, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { fileName, fileSize, language = '', dubVoice = 'onyx' } = await getBody(req);
  if (!fileName) return send(res, 400, { error: 'Selecione um vídeo.' });
  const mock = mockDubResult({ originalName: fileName, language, dubVoice });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const project = {
    id, type: 'dub', title: `Dublagem: ${fileName}`,
    prompt: `Dublagem de ${fileName} para PT-BR`,
    fileName, fileSize: Number(fileSize) || 0,
    language: language || 'auto', dubVoice,
    transcription: mock.transcription, translation: mock.translation, dubInfo: mock.dubInfo,
    script: `${mock.transcription}\n\n${mock.translation}\n\n${mock.dubInfo}`,
    status: 'dublado', mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
    createdAt: new Date().toISOString(),
    thumbnail: `https://picsum.photos/seed/dub-${id}/640/360`
  };
  send(res, 200, { id, project, message: 'Dublagem concluída (simulação).' });
};
