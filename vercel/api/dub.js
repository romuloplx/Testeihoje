const { mockDubResult, dubWithOpenAI, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const {
    fileName,
    fileSize,
    language = '',
    dubVoice = 'onyx',
    targetLanguage = 'pt-BR',
    audioBase64,
    audioMime = 'audio/wav',
    transcription,
    chunkIndex = 0,
    totalChunks = 1
  } = await getBody(req);

  if (!fileName) return send(res, 400, { error: 'Selecione um vídeo ou áudio.' });

  let result = null;
  if (audioBase64 || transcription) {
    result = await dubWithOpenAI({ audioBase64, audioMime, language, dubVoice, targetLanguage, transcription });
    if (!result || result.error) {
      return send(res, 502, {
        error: 'Falha na dublagem' + (result && result.error ? `: ${result.error}` : ' (transcrição/tradução/voz)') + '. Tente novamente em instantes.',
        chunkIndex
      });
    }
  }
  const mock = result ? null : mockDubResult({ originalName: fileName, language, dubVoice });

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const trOrig = result ? result.transcription : mock.transcription;
  const trDest = result ? result.translation : mock.translation;
  const info = result ? result.dubInfo : mock.dubInfo;

  const project = {
    id,
    type: 'dub',
    title: `Dublagem: ${fileName}`,
    prompt: `Dublagem de ${fileName} para ${targetLanguage}`,
    fileName,
    fileSize: Number(fileSize) || 0,
    language: language || 'auto',
    targetLanguage,
    dubVoice,
    transcription: trOrig,
    translation: trDest,
    dubInfo: info,
    script: [trOrig, trDest, info].filter(Boolean).join('\n\n'),
    status: 'dublado',
    mode: result ? 'openai' : 'mock',
    createdAt: new Date().toISOString(),
    thumbnail: `https://picsum.photos/seed/dub-${id}/640/360`
  };

  send(res, 200, {
    id,
    chunkIndex,
    totalChunks,
    silent: !!(result && result.silent),
    transcription: trOrig,
    translation: trDest,
    dubInfo: info,
    project,
    audioBase64: result ? result.audioMp3Base64 : null,
    audioMime: (result && result.audioMime) || 'audio/mpeg',
    message: result
      ? (result.silent ? 'Trecho instrumental/silencioso preservado.' : `Trecho dublado (${targetLanguage}).`)
      : 'Modo simulação (sem áudio real).'
  });
};
