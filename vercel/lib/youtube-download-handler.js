'use strict';

const {
  extractYoutubeVideoId,
  isDownloadableMp4Format,
  normalizeDownloadableFormats,
  sanitizeVideoFilename,
  resolveYoutubeVideo
} = require('./youtube-download');

const VIDEO_ERROR_MESSAGES = {
  INVALID_YOUTUBE_URL: 'Use um link válido do YouTube.',
  NO_PROGRESSIVE_MP4: 'Este vídeo não disponibilizou um MP4 com áudio e vídeo juntos. Vídeos ao vivo ou com formatos separados podem não funcionar nesta versão.',
  FORMAT_NOT_FOUND: 'A qualidade escolhida expirou. Busque o vídeo novamente e selecione outro formato.'
};

function sendJson(res, status, payload) {
  if (res.headersSent) {
    if (typeof res.destroy === 'function') res.destroy();
    return;
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(payload);
    return;
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new Error('O pedido excedeu o tamanho permitido.');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch (_) { return {}; }
}

function getUrl(req) {
  try { return new URL(req.url, 'https://dubai-pro.invalid'); }
  catch (_) { return new URL('https://dubai-pro.invalid'); }
}

function encodeDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function clearDownloadHeaders(res) {
  for (const name of ['Content-Type', 'Content-Disposition', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
    if (typeof res.removeHeader === 'function') res.removeHeader(name);
  }
}

function parseRange(value, totalSize) {
  if (!value || !Number.isSafeInteger(totalSize) || totalSize <= 0) return null;
  const match = String(value).match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (!match[1] && !match[2])) return { invalid: true };
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : totalSize - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= totalSize) {
    return { invalid: true };
  }
  return { start, end: Math.min(end, totalSize - 1) };
}

async function handleFormats(req, res, bodyOverride) {
  const body = bodyOverride && typeof bodyOverride === 'object' ? bodyOverride : await getRequestBody(req);
  const input = body.videoId || body.url;
  const videoId = extractYoutubeVideoId(input);
  if (!videoId) return sendJson(res, 400, { error: VIDEO_ERROR_MESSAGES.INVALID_YOUTUBE_URL, code: 'INVALID_YOUTUBE_URL' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const { info, formats } = await resolveYoutubeVideo(videoId, controller.signal);
    if (!formats.length) {
      return sendJson(res, 422, {
        error: VIDEO_ERROR_MESSAGES.NO_PROGRESSIVE_MP4,
        code: 'NO_PROGRESSIVE_MP4'
      });
    }
    return sendJson(res, 200, {
      videoId,
      title: String(info.videoDetails && info.videoDetails.title || ''),
      author: String(info.videoDetails && info.videoDetails.author || ''),
      durationSec: Number(info.videoDetails && info.videoDetails.lengthSeconds) || 0,
      formats
    });
  } catch (error) {
    console.error('[youtube-download] formats error:', error && error.message || error);
    const code = error && error.code || 'YOUTUBE_RESOLUTION_FAILED';
    const message = VIDEO_ERROR_MESSAGES[code]
      || 'Não foi possível consultar o YouTube agora. O vídeo pode estar indisponível ou restrito; tente novamente mais tarde.';
    return sendJson(res, code === 'INVALID_YOUTUBE_URL' ? 400 : 502, { error: message, code });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleDownload(req, res) {
  const url = getUrl(req);
  const videoId = extractYoutubeVideoId(url.searchParams.get('videoId') || '');
  const itag = Number(url.searchParams.get('itag'));
  if (!videoId || !Number.isSafeInteger(itag) || itag <= 0) {
    return sendJson(res, 400, { error: 'Parâmetros de vídeo inválidos.', code: 'INVALID_DOWNLOAD_REQUEST' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 280000);
  let stream;
  try {
    const { resolver, info } = await resolveYoutubeVideo(videoId, controller.signal);
    const format = (info.formats || []).find(item => Number(item.itag) === itag && isDownloadableMp4Format(item));
    if (!format) {
      clearTimeout(timeout);
      return sendJson(res, 410, { error: VIDEO_ERROR_MESSAGES.FORMAT_NOT_FOUND, code: 'FORMAT_NOT_FOUND' });
    }

    const safeTitle = sanitizeVideoFilename(info.videoDetails && info.videoDetails.title || `video-${videoId}`);
    const quality = sanitizeVideoFilename(format.qualityLabel || (format.height ? `${format.height}p` : 'MP4'));
    const filename = `${safeTitle}-${quality}.mp4`;
    const contentLength = Number(format.contentLength);
    const totalSize = Number.isSafeInteger(contentLength) && contentLength > 0 ? contentLength : 0;
    const range = parseRange(req.headers && req.headers.range, totalSize);
    if (range && range.invalid) {
      clearTimeout(timeout);
      res.statusCode = 416;
      if (totalSize) res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.end();
    }

    res.statusCode = range ? 206 : 200;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', encodeDisposition(filename));
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (totalSize) res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${totalSize}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
    } else if (totalSize) {
      res.setHeader('Content-Length', String(totalSize));
    }

    stream = resolver.download(info, {
      format,
      signal: controller.signal,
      ...(range ? { range: { start: range.start, end: range.end } } : {}),
      chunkSize: 8 * 1024 * 1024,
      highWaterMark: 1024 * 1024
    });

    stream.on('error', error => {
      console.error('[youtube-download] stream error:', error && error.message || error);
      clearTimeout(timeout);
      if (!res.headersSent) {
        clearDownloadHeaders(res);
        sendJson(res, 502, { error: 'A conexão com o vídeo caiu antes de concluir. Tente novamente.', code: 'STREAM_INTERRUPTED' });
      } else if (typeof res.destroy === 'function') {
        res.destroy(error);
      }
    });
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
      clearTimeout(timeout);
    });
    stream.once('end', () => clearTimeout(timeout));
    stream.once('close', () => clearTimeout(timeout));
    stream.pipe(res);
  } catch (error) {
    clearTimeout(timeout);
    console.error('[youtube-download] request error:', error && error.message || error);
    const code = error && error.code || 'YOUTUBE_RESOLUTION_FAILED';
    const message = VIDEO_ERROR_MESSAGES[code]
      || 'Não foi possível resolver este vídeo. Ele pode estar privado, restrito por região/idade, ao vivo ou indisponível temporariamente.';
    return sendJson(res, code === 'INVALID_YOUTUBE_URL' ? 400 : 502, { error: message, code });
  }
  if (stream) stream.once('close', () => clearTimeout(timeout));
}

module.exports = { handleFormats, handleDownload };
