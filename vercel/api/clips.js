const { transcribeClipSegment, analyzeViralClips, fetchYoutubeVideoInfoAndStream, fetchVideoStreamChunk, fetchYoutubeClipMp4Segment, getBody, send } = require('./lib/ai');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
    const body = await getBody(req);
    const action = String(body.action || 'analyze_clips');

    if (action === 'fetch_url') {
      const out = await fetchYoutubeVideoInfoAndStream({
        url: body.url,
        clipPrompt: body.clipPrompt || '',
        desiredClipsCount: body.desiredClipsCount || 4
      });
      if (out.error) return send(res, 400, { error: out.error });
      return send(res, 200, out);
    }

    if (action === 'download_clip_mp4') {
      const out = await fetchYoutubeClipMp4Segment({
        videoId: body.videoId || '',
        url: body.url || '',
        startSec: body.startSec || 0,
        endSec: body.endSec || 120
      });
      return send(res, 200, out);
    }

    if (action === 'stream_chunk') {
      const out = await fetchVideoStreamChunk({
        streamUrl: body.streamUrl,
        startByte: body.startByte || 0,
        endByte: body.endByte || 3145727,
        ua: body.ua
      });
      if (out.error) return send(res, 400, { error: out.error });
      return send(res, 200, out);
    }

    if (action === 'transcribe_segment') {
      const out = await transcribeClipSegment({
        audioBase64: body.audioBase64,
        audioMime: body.audioMime || 'audio/wav',
        language: body.language || '',
        offsetSec: body.offsetSec || 0,
        durationSec: body.durationSec || 20
      });
      return send(res, 200, out);
    }

    const out = await analyzeViralClips({
      fileName: body.fileName || 'video.mp4',
      durationSec: body.durationSec || 60,
      clipPrompt: body.clipPrompt || '',
      targetClipLength: body.targetClipLength || '30-60',
      desiredClipsCount: body.desiredClipsCount || 4,
      energyPeaks: body.energyPeaks || [],
      transcricaoSegmentos: body.transcricaoSegmentos || [],
      aiModel: body.aiModel || 'auto-router'
    });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const clips = out.clips || [];
    const project = {
      id,
      type: 'clips',
      title: `OpusClip IA: ${body.fileName || 'Cortes Virais'} (${clips.length} cortes)`,
      prompt: body.clipPrompt || 'Cortes virais automáticos OpusClip IA',
      fileName: body.fileName || 'video.mp4',
      clipsCount: clips.length,
      provider: out.provider || 'multi-ia-opusclip',
      script: clips.map(c =>
        `🔥 CORTE #${c.rank} [Score ${c.viralityScore}/100] (${c.startSec}s – ${c.endSec}s): ${c.title}\n` +
        `💬 Legenda: "${c.captionText}"\n` +
        `📈 Por que viraliza: ${c.reason}`
      ).join('\n\n'),
      status: 'cortes_prontos',
      mode: 'openai',
      createdAt: new Date().toISOString(),
      thumbnail: `https://picsum.photos/seed/opus-${id}/640/360`
    };

    return send(res, 200, {
      id,
      clips,
      cortes_sugeridos: out.cortes_sugeridos || [],
      transcricao_segmentos: out.transcricao_segmentos || [],
      provider: out.provider || 'multi-ia-opusclip',
      warning: out.warning || undefined,
      project
    });
  } catch (e) {
    return send(res, 500, { error: 'Erro no motor OpusClip IA: ' + (e.message || 'falha inesperada') });
  }
};
