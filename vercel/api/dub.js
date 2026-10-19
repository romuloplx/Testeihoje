const { mockDubResult, dubWithOpenAI, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { fileName, fileSize, language = '', dubVoice = 'onyx', targetLanguage = 'pt-BR', audioBase64 } = await getBody(req);
  if (!fileName) return send(res, 400, { error: 'Selecione um vídeo.' });

  let result = null;
  if (audioBase64) {
    if (!process.env.OPENAI_API_KEY) {
      return send(res, 400, { error: 'Configure OPENAI_API_KEY no servidor para dublagem real.' });
    }
    result = await dubWithOpenAI({ audioBase64, language, dubVoice, targetLanguage });
    if (!result) {
      return send(res, 502, { error: 'Falha ao dublar com a OpenAI (transcrição/tradução/voz). Tente com um arquivo menor ou tente novamente.' });
    }
  }
  const mock = result ? null : mockDubResult({ originalName: fileName, language, dubVoice });

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const project = {
    id, type: 'dub', title: `Dublagem: ${fileName}`,
    prompt: `Dublagem de ${fileName} para ${targetLanguage}`,
    fileName, fileSize: Number(fileSize) || 0,
    language: language || 'auto', targetLanguage, dubVoice,
    transcription: result ? result.transcription : mock.transcription,
    translation: result ? result.translation : mock.translation,
    dubInfo: result ? result.dubInfo : mock.dubInfo,
    script: result ? `${result.transcription}\n\n${result.translation}\n\n${result.dubInfo}` : `${mock.transcription}\n\n${mock.translation}\n\n${mock.dubInfo}`,
    status: 'dublado', mode: result ? 'openai' : 'mock',
    createdAt: new Date().toISOString(),
    thumbnail: `https://picsum.photos/seed/dub-${id}/640/360`
  };
  send(res, 200, {
    id, project,
    audioBase64: result ? result.audioMp3Base64 : null,
    message: result ? `Vídeo traduzido e dublado (${targetLanguage}).` : 'Modo simulação (sem áudio real).'
  });
};
