'use strict';

const {
  extractYoutubeVideoId,
  isDownloadableMp4Format,
  normalizeDownloadableFormats,
  normalizeYtDlpFormats,
  sanitizeVideoFilename,
  resolveYoutubeVideo
} = require('./youtube-download');
const {
  getYoutubeVideoInfoWithYtDlp,
  spawnYoutubeMp4DownloadWithYtDlp
} = require('./ytdlp-runtime');

const VIDEO_ERROR_MESSAGES = {
  INVALID_YOUTUBE_URL: 'Use um link válido do YouTube.',
  NO_PROGRESSIVE_MP4: 'Este vídeo não disponibilizou um MP4 com áudio e vídeo juntos. Vídeos ao vivo ou com formatos separados podem não funcionar nesta versão.',
  FORMAT_NOT_FOUND: 'A qualidade escolhida expirou. Busque o vídeo novamente e selecione outro formato.'
};

function sendJson(res, status, payload) {
  if (res.destroyed) return;
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

function formatDetails(info, ytdlp) {
  const details = info && info.videoDetails;
  return {
    title: String(details && details.title || info && info.title || ''),
    author: String(details && details.author || info && (info.uploader || info.channel || info.creator) || ''),
    durationSec: Number(details && details.lengthSeconds || info && info.duration) || 0,
    formats: ytdlp ? normalizeYtDlpFormats(info && info.formats) : normalizeDownloadableFormats(info && info.formats)
  };
}

async function handleFormats(req, res, bodyOverride) {
  const body = bodyOverride && typeof bodyOverride === 'object' ? bodyOverride : await getRequestBody(req);
  const input = body.videoId || body.url;
  const videoId = extractYoutubeVideoId(input);
  if (!videoId) return sendJson(res, 400, { error: VIDEO_ERROR_MESSAGES.INVALID_YOUTUBE_URL, code: 'INVALID_YOUTUBE_URL' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let ytdlpInfo;
  let ytdlpError;
  let ytdlError;
  try {
    try {
      ytdlpInfo = await getYoutubeVideoInfoWithYtDlp(videoId, controller.signal);
      const ytdlpResult = formatDetails(ytdlpInfo, true);
      if (ytdlpResult.formats.length) {
        return sendJson(res, 200, { videoId, ...ytdlpResult, source: 'yt-dlp' });
      }
    } catch (error) {
      ytdlpError = error;
    }

    try {
      const { info } = await resolveYoutubeVideo(videoId, controller.signal);
      const ytdlResult = formatDetails(info, false);
      if (ytdlResult.formats.length) {
        return sendJson(res, 200, { videoId, ...ytdlResult, source: 'ytdl-core' });
      }
    } catch (error) {
      ytdlError = error;
    }

    if (controller.signal.aborted) {
      const error = new Error('A consulta ao YouTube excedeu o tempo limite.');
      error.code = 'YOUTUBE_TIMEOUT';
      throw error;
    }
    if (ytdlpInfo || ytdlpError && ytdlpError.code === 'NO_PROGRESSIVE_MP4' || ytdlError && ytdlError.code === 'NO_PROGRESSIVE_MP4') {
      const error = new Error(VIDEO_ERROR_MESSAGES.NO_PROGRESSIVE_MP4);
      error.code = 'NO_PROGRESSIVE_MP4';
      throw error;
    }
    throw ytdlError || ytdlpError || new Error('YouTube resolution failed.');
  } catch (error) {
    console.error('[youtube-download] formats error:', error && error.message || error);
    const code = error && error.code || 'YOUTUBE_RESOLUTION_FAILED';
    const message = VIDEO_ERROR_MESSAGES[code]
      || 'Não foi possível consultar o YouTube agora. O vídeo pode estar indisponível ou restrito; tente novamente mais tarde.';
    return sendJson(res, code === 'NO_PROGRESSIVE_MP4' ? 422 : 502, { error: message, code });
  } finally {
    clearTimeout(timeout);
  }
}

function streamYtDlpProcess(child, res, controller, timeout, filename) {
  return new Promise(resolve => {
    let started = false;
    let settled = false;
    let outputBytes = 0;
    let stderr = '';
    let killTimer;

    const cleanup = () => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      controller.signal.removeEventListener('abort', onAbort);
      res.removeListener('drain', onDrain);
      res.removeListener('close', onResponseClose);
    };
    const killChild = () => {
      if (child.exitCode === null && child.signalCode === null) {
        try { child.kill('SIGTERM'); } catch (_) {}
        killTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            try { child.kill('SIGKILL'); } catch (_) {}
          }
        }, 1500);
        if (typeof killTimer.unref === 'function') killTimer.unref();
      }
    };
    const onAbort = () => killChild();
    const onDrain = () => child.stdout.resume();
    const onResponseClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (res.destroyed) {
        resolve();
        return;
      }
      if (!started) {
        if (code === 0 && outputBytes === 0) {
          sendJson(res, 502, { error: 'O yt-dlp não retornou dados de vídeo.', code: 'EMPTY_VIDEO_STREAM' });
        } else {
          console.error('[youtube-download] yt-dlp stream error:', error && error.message || stderr || `exit ${code}`);
          sendJson(res, 502, { error: 'Não foi possível iniciar o stream deste vídeo. Tente outra qualidade.', code: 'YTDLP_STREAM_FAILED' });
        }
      } else if (code === 0) {
        res.end();
      } else if (typeof res.destroy === 'function') {
        res.destroy(error || new Error('yt-dlp video stream interrupted'));
      }
      resolve();
    };

    controller.signal.addEventListener('abort', onAbort, { once: true });
    res.on('drain', onDrain);
    res.once('close', onResponseClose);
    child.stdout.on('data', chunk => {
      if (settled) return;
      if (!started) {
        started = true;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', encodeDisposition(filename));
        res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Accept-Ranges', 'none');
      }
      outputBytes += chunk.length;
      if (!res.write(chunk)) child.stdout.pause();
    });
    child.stderr.on('data', chunk => {
      if (settled) return;
      stderr = (stderr + Buffer.from(chunk).toString('utf8')).slice(-8000);
    });
    child.once('error', error => finish(null, error));
    child.once('close', (code, signal) => {
      const closeCode = Number.isInteger(code) ? code : signal ? 128 : 1;
      finish(closeCode, signal ? new Error(`yt-dlp stopped (${signal})`) : null);
    });
  });
}

async function handleYtDlpDownload(req, res, videoId, itag) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 280000);
  try {
    const info = await getYoutubeVideoInfoWithYtDlp(videoId, controller.signal);
    const format = normalizeYtDlpFormats(info && info.formats).find(item => item.itag === itag);
    if (!format) {
      clearTimeout(timeout);
      return sendJson(res, 410, { error: VIDEO_ERROR_MESSAGES.FORMAT_NOT_FOUND, code: 'FORMAT_NOT_FOUND' });
    }
    if (controller.signal.aborted) {
      clearTimeout(timeout);
      return sendJson(res, 504, { error: 'A solicitação excedeu o tempo limite.', code: 'YOUTUBE_TIMEOUT' });
    }

    const title = sanitizeVideoFilename(info.title || `video-${videoId}`);
    const quality = sanitizeVideoFilename(format.qualityLabel || (format.height ? `${format.height}p` : 'MP4'));
    const filename = `${title}-${quality}.mp4`;
    const child = await spawnYoutubeMp4DownloadWithYtDlp(videoId, String(format.itag));
    if (controller.signal.aborted) {
      try { child.kill('SIGTERM'); } catch (_) {}
      clearTimeout(timeout);
      return sendJson(res, 504, { error: 'A solicitação excedeu o tempo limite.', code: 'YOUTUBE_TIMEOUT' });
    }
    return await streamYtDlpProcess(child, res, controller, timeout, filename);
  } catch (error) {
    clearTimeout(timeout);
    console.error('[youtube-download] yt-dlp request error:', error && error.message || error);
    if (controller.signal.aborted) {
      return sendJson(res, 504, { error: 'A solicitação excedeu o tempo limite.', code: 'YOUTUBE_TIMEOUT' });
    }
    const code = error && error.code || 'YTDLP_DOWNLOAD_FAILED';
    const message = code === 'INVALID_YOUTUBE_URL'
      ? VIDEO_ERROR_MESSAGES.INVALID_YOUTUBE_URL
      : 'Não foi possível baixar este vídeo com yt-dlp. Ele pode estar indisponível ou restrito; tente outra qualidade mais tarde.';
    return sendJson(res, code === 'INVALID_YOUTUBE_URL' ? 400 : 502, { error: message, code });
  }
}

async function handleDownload(req, res) {
  const url = getUrl(req);
  const videoId = extractYoutubeVideoId(url.searchParams.get('videoId') || '');
  const itag = Number(url.searchParams.get('itag'));
  const engine = url.searchParams.get('engine') || 'ytdl-core';
  if (!videoId || !Number.isSafeInteger(itag) || itag <= 0 || !['ytdl-core', 'yt-dlp'].includes(engine)) {
    return sendJson(res, 400, { error: 'Parâmetros de vídeo inválidos.', code: 'INVALID_DOWNLOAD_REQUEST' });
  }
  if (engine === 'yt-dlp') return handleYtDlpDownload(req, res, videoId, itag);

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
