const { mockCreateFull, generateCreateFull, lookupIceAndFireCharacters, startCreateSceneVideo, pollCreateSceneVideo, getBody, send } = require('./lib/ai');

async function sendSceneVideo(res, clip) {
  const buffer = clip.buffer;
  res.statusCode = 200;
  res.setHeader('Content-Type', clip.mime || 'video/mp4');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-AI-Video-Provider', clip.provider || 'tencent/hy-video-v1.5');
  if (typeof res.write !== 'function') {
    res.setHeader('Content-Length', String(buffer.length));
    return res.end(buffer);
  }

  // Write bounded chunks so Vercel can stream MP4 output instead of buffering a large function response.
  const chunkSize = 64 * 1024;
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    if (!res.write(buffer.subarray(offset, Math.min(buffer.length, offset + chunkSize)))) {
      await new Promise((resolve, reject) => {
        const onDrain = () => { res.removeListener('error', onError); resolve(); };
        const onError = error => { res.removeListener('drain', onDrain); reject(error); };
        res.once('drain', onDrain);
        res.once('error', onError);
      });
    }
  }
  return res.end();
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
    const body = await getBody(req);
    if (body.action === 'moneyprinter-create' || body.action === 'moneyprinter-status') {
      res.setHeader('Cache-Control', 'no-store, private');
      const baseUrl = String(process.env.MONEYPRINTERTURBO_URL || '').trim().replace(/\/$/, '');
      if (!baseUrl) return send(res, 503, { error: 'MoneyPrinterTurbo não configurado. Defina MONEYPRINTERTURBO_URL no servidor.' });
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.MONEYPRINTERTURBO_API_KEY) headers['x-api-key'] = process.env.MONEYPRINTERTURBO_API_KEY;
      try {
        const taskId = String(body.taskId || '').trim();
        if (body.action === 'moneyprinter-status' && !/^[a-zA-Z0-9_-]{1,128}$/.test(taskId)) return send(res, 400, { error: 'ID de tarefa inválido.' });
        const upstream = await fetch(body.action === 'moneyprinter-create' ? `${baseUrl}/api/v1/videos` : `${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
          method: body.action === 'moneyprinter-create' ? 'POST' : 'GET', headers,
          ...(body.action === 'moneyprinter-create' ? { body: JSON.stringify({ video_subject: String(body.subject || '').slice(0, 500), video_script: String(body.script || '').slice(0, 8000), video_aspect: ['16:9','9:16','1:1'].includes(body.aspect) ? body.aspect : '9:16', video_source: 'pexels', video_count: 1, subtitle_enabled: true }) } : {})
        });
        const result = await upstream.json().catch(() => ({}));
        if (!upstream.ok) return send(res, upstream.status, { error: result.message || result.error || 'MoneyPrinterTurbo recusou a solicitação.' });
        return send(res, body.action === 'moneyprinter-create' ? 202 : 200, result);
      } catch (error) { return send(res, 502, { error: `Não foi possível acessar MoneyPrinterTurbo: ${error.message}` }); }
    }
    if (body.action === 'character-lookup') {
      try {
        res.setHeader('Cache-Control', 'no-store, private');
        return send(res, 200, await lookupIceAndFireCharacters({ query: body.query }));
      } catch (e) {
        return send(res, Number(e.status) || 502, { error: e.message || 'Falha ao buscar personagens.' });
      }
    }
    if (body.action === 'scene-video' || body.action === 'scene-video-status') {
      try {
        res.setHeader('Cache-Control', 'no-store, private');
        if (body.action === 'scene-video') {
          const forwardedFor = String((req.headers || {})['x-forwarded-for'] || '').split(',')[0].trim();
          const clientKey = String(req.ip || (req.headers || {})['x-real-ip'] || forwardedFor || (req.socket && req.socket.remoteAddress) || 'unknown');
          const task = await startCreateSceneVideo({ ...body, clientKey });
          return send(res, 202, task);
        }
        const result = await pollCreateSceneVideo({ taskId: body.taskId });
        if (!result.done) return send(res, 202, result);
        return await sendSceneVideo(res, result);
      } catch (e) {
        if (res.headersSent) {
          if (typeof res.destroy === 'function') res.destroy(e);
          return;
        }
        if (e.retryAfterSeconds) res.setHeader('Retry-After', String(e.retryAfterSeconds));
        return send(res, Number(e.status) || 502, { error: e.message || 'Falha ao gerar o clipe com HunyuanVideo.' });
      }
    }

    const { prompt, duration, style, voice, cinemaMode, customCharacters, aiModel } = body;
    if (!prompt || !prompt.trim()) return send(res, 400, { error: 'Descreva o vídeo primeiro.' });
    if (prompt.length > 8000) return send(res, 400, { error: 'Descrição muito longa (máx 8000 caracteres).' });

    let data = null, mode = 'mock', aiError = null, provider = 'local';
    const gen = await generateCreateFull({ prompt, duration, style, voice, cinemaMode, customCharacters, aiModel });
    if (gen && gen.data) {
      data = gen.data;
      provider = gen.provider || 'ia';
      mode = provider === 'story-engine-fallback' ? 'mock' : 'openai';
      aiError = gen.error || null;
    } else {
      aiError = (gen && gen.error) || 'provedores ocupados';
      data = mockCreateFull({ prompt, duration, style, voice, customCharacters });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const project = {
      id, type: 'create', prompt: prompt.trim(),
      title: data.title || prompt.trim().slice(0, 80),
      duration: String(duration || '1'), style: style || 'realistic', voice: voice || 'onyx',
      cinemaMode: cinemaMode || 'connected',
      characters: data.characters || [],
      mood: data.mood || 'cinematic',
      artStylePrompt: data.artStylePrompt || '',
      script: data.script, scenes: data.scenes, seo: data.seo, mode, provider,
      status: 'roteiro_pronto', createdAt: new Date().toISOString(),
      thumbnail: `https://picsum.photos/seed/${id}/640/360`
    };
    send(res, 200, {
      id,
      title: data.title || project.title,
      characters: data.characters || [],
      mood: data.mood || 'cinematic',
      artStylePrompt: data.artStylePrompt || '',
      script: data.script,
      scenes: data.scenes,
      seo: data.seo,
      project,
      mode,
      provider,
      warning: mode === 'openai' ? undefined : `Roteiro de história e personagens gerados pelo motor dinâmico (${aiError}).`,
      message: mode === 'openai' ? `História e personagens criados com IA (${provider})!` : `⚡ História com personagens pronta!`
    });
  } catch (e) {
    send(res, 500, { error: 'Erro ao gerar história: ' + (e.message || 'falha inesperada') });
  }
};

