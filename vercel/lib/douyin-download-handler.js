'use strict';

const { spawnDouyinMp4DownloadWithYtDlp } = require('./ytdlp-runtime');
const { streamYtDlpProcess } = require('./youtube-download-handler');

const ALLOWED_DOUYIN_DOMAINS = ['douyin.com', 'iesdouyin.com'];
const MAX_DOUYIN_URL_LENGTH = 2048;
const DOWNLOAD_TIMEOUT_MS = 280000;

function invalidDouyinUrlError() {
  return Object.assign(new Error('Use um link válido do Douyin (douyin.com, v.douyin.com ou iesdouyin.com).'), {
    code: 'INVALID_DOUYIN_URL'
  });
}

function normalizeDouyinVideoUrl(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > MAX_DOUYIN_URL_LENGTH || /[\u0000-\u0020\\]/.test(raw)) {
    throw invalidDouyinUrlError();
  }

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch (_) {
    throw invalidDouyinUrlError();
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw invalidDouyinUrlError();
  if (parsed.username || parsed.password || parsed.port && !['80', '443'].includes(parsed.port)) {
    throw invalidDouyinUrlError();
  }

  const host = parsed.hostname.toLowerCase();
  const allowedHost = ALLOWED_DOUYIN_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
  if (!allowedHost) throw invalidDouyinUrlError();

  // Links HTTP copiados do app são promovidos para HTTPS antes de chamar o extrator.
  parsed.protocol = 'https:';
  parsed.port = '';
  parsed.hash = '';
  return parsed.toString();
}

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

function getDownloadFilename(videoUrl) {
  const videoId = new URL(videoUrl).pathname.match(/(?:video|share\/video|note)\/(\d{8,})/i);
  return `douyin-${videoId ? videoId[1] : 'video'}.mp4`;
}

async function handleDouyinDownload(req, res, rawUrl) {
  let videoUrl;
  try {
    videoUrl = normalizeDouyinVideoUrl(rawUrl);
  } catch (error) {
    return sendJson(res, 400, {
      error: error && error.message || 'Use um link válido do Douyin.',
      code: 'INVALID_DOUYIN_URL'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const child = await spawnDouyinMp4DownloadWithYtDlp(videoUrl, controller.signal);
    if (controller.signal.aborted) {
      try { child.kill('SIGTERM'); } catch (_) {}
      clearTimeout(timeout);
      return sendJson(res, 504, {
        error: 'O download do Douyin excedeu o tempo limite. Tente novamente.',
        code: 'DOUYIN_TIMEOUT'
      });
    }

    return await streamYtDlpProcess(child, res, controller, timeout, getDownloadFilename(videoUrl), {
      logPrefix: '[douyin-download]',
      timeoutCode: 'DOUYIN_TIMEOUT',
      timeoutMessage: 'O download do Douyin excedeu o tempo limite. Tente novamente.',
      emptyCode: 'EMPTY_DOUYIN_VIDEO',
      emptyMessage: 'O Douyin não retornou dados de vídeo para este link.',
      streamCode: 'DOUYIN_STREAM_FAILED',
      streamMessage: 'Não foi possível iniciar o download do Douyin. O vídeo pode estar privado ou indisponível.'
    });
  } catch (error) {
    clearTimeout(timeout);
    const timedOut = controller.signal.aborted || error && error.code === 'ABORT_ERR';
    const code = timedOut ? 'DOUYIN_TIMEOUT' : error && error.code || 'DOUYIN_DOWNLOAD_FAILED';
    console.error('[douyin-download] request failed:', code);
    return sendJson(res, timedOut ? 504 : 502, {
      error: timedOut
        ? 'O download do Douyin excedeu o tempo limite. Tente novamente.'
        : 'Não foi possível baixar este vídeo do Douyin. Ele pode estar privado, restrito ou temporariamente indisponível.',
      code
    });
  }
}

module.exports = {
  ALLOWED_DOUYIN_DOMAINS,
  normalizeDouyinVideoUrl,
  getDownloadFilename,
  handleDouyinDownload
};
