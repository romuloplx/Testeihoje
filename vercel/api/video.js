const { fetchYoutubeClipMp4Segment, fetchYoutubeVideoInfoAndStream, extractYoutubeVideoId, getBody, send } = require('./lib/ai');

// POST /api/video/download  { url, resolution?, start?, end? }  -> ytdown-style job
// GET  /api/video/download?id=xxx  -> poll job
// Compat: também aceita /api/video via rewrite se necessário

const jobs = global.__videoJobs || (global.__videoJobs = new Map());

function makeId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

module.exports = async (req, res) => {
  try {
    // CORS liberado para o front da Vercel baixar direto pra Galeria
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if(req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

    if(req.method === 'GET'){
      const urlObj = new URL(req.url, 'https://dummy');
      const id = urlObj.searchParams.get('id') || (await getBody(req)).id;
      if(!id) return send(res, 400, { error: 'id obrigatório' });
      const job = jobs.get(id);
      if(!job) return send(res, 404, { error: 'job não encontrado' });
      // se já finalizou, retorna com downloadUrl pronto
      return send(res, 200, job);
    }

    if(req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
    const body = await getBody(req);
    const url = String(body.url || body.watchUrl || '').trim();
    const resolution = Number(body.resolution || 1080);
    const start = body.start != null ? Number(body.start) : null;
    const end = body.end != null ? Number(body.end) : null;

    if(!url) return send(res, 400, { error: 'url é obrigatória (ex: https://youtu.be/ID)' });

    const vid = extractYoutubeVideoId(url);
    if(!vid) return send(res, 400, { error: 'ID do YouTube não encontrado na URL' });

    const watchUrl = `https://www.youtube.com/watch?v=${vid}`;
    const id = makeId();
    const job = {
      id,
      status: 'queued',
      videoId: vid,
      url: watchUrl,
      resolution,
      start, end,
      createdAt: new Date().toISOString(),
      progress: 0,
      downloadUrl: null,
      title: null,
      error: null
    };
    jobs.set(id, job);

    // dispara assincrono (não bloqueia o POST inicial — ytdown retorna 202)
    (async ()=>{
      try{
        job.status = 'downloading';
        job.progress = 10;

        // se tem start/end → clipping (igual loader.to), senão baixa original 1080p
        if(start != null && end != null && Number.isFinite(start) && Number.isFinite(end)){
          const seg = await fetchYoutubeClipMp4Segment({ videoId: vid, url: watchUrl, startSec: start, endSec: end });
          if(seg && seg.ok && (seg.clippedStreamUrl || seg.streamUrl)){
            job.downloadUrl = seg.clippedStreamUrl || seg.streamUrl;
            job.candidateUrls = seg.candidateUrls || [];
            job.title = `corte-${vid}-${start}-${end}.mp4`;
            job.status = 'ready';
            job.progress = 100;
            return;
          }
          // fallback: tenta baixar original e deixa o front cortar no canvas
          job.error = seg && seg.error ? seg.error : 'clipping indisponível, tentando original';
        }

        const info = await fetchYoutubeVideoInfoAndStream({ url: watchUrl, desiredClipsCount: 1 });
        if(info && !info.error){
          job.title = (info.title || vid) + '.mp4';
          // prioriza directStreamUrl (googlevideo já decifrado)
          if(info.directStreamUrl){
            job.downloadUrl = info.directStreamUrl;
            job.candidateUrls = info.candidateStreamUrls || [];
            job.status = 'ready';
            job.progress = 100;
            return;
          }
          if(info.candidateStreamUrls && info.candidateStreamUrls[0]){
            job.downloadUrl = info.candidateStreamUrls[0];
            job.candidateUrls = info.candidateStreamUrls;
            job.status = 'ready';
            job.progress = 100;
            return;
          }
        }
        job.status = 'error';
        job.error = (info && info.error) || 'não foi possível resolver directStreamUrl (IP do Vercel bloqueado pelo YouTube)';
      }catch(e){
        job.status = 'error';
        job.error = e.message || 'erro interno';
      }
    })();

    // ytdown-style: responde 202 com id pra poll
    return send(res, 202, { id, status: job.status, videoId: vid, url: watchUrl, pollUrl: `/api/video?id=${id}` });
  } catch(e){
    return send(res, 500, { error: 'Erro em /api/video: ' + (e.message||'falha') });
  }
};
