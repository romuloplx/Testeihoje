'use strict';

const { spawnSupportedVideoDownloadWithYtDlp } = require('./ytdlp-runtime');
const { streamYtDlpProcess } = require('./youtube-download-handler');

const SUPPORTED_VIDEO_DOMAINS = {
  douyin: ['douyin.com', 'iesdouyin.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtube-nocookie.com', 'youtu.be']
};
const MAX_VIDEO_URL_LENGTH = 2048;
const DOWNLOAD_TIMEOUT_MS = 280000;

function invalidVideoUrlError() {
  return Object.assign(new Error('Use um link válido do TikTok, Douyin ou YouTube.'), {
    code: 'INVALID_VIDEO_URL'
  });
}

function getVideoPlatform(url) {
  const host = new URL(url).hostname.toLowerCase();
  for (const [platform, domains] of Object.entries(SUPPORTED_VIDEO_DOMAINS)) {
    if (domains.some(domain => host === domain || host.endsWith(`.${domain}`))) return platform;
  }
  return '';
}

function normalizeSupportedVideoUrl(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > MAX_VIDEO_URL_LENGTH || /[\u0000-\u0020\\]/.test(raw)) {
    throw invalidVideoUrlError();
  }

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch (_) {
    throw invalidVideoUrlError();
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw invalidVideoUrlError();
  if (parsed.username || parsed.password || parsed.port && !['80', '443'].includes(parsed.port)) {
    throw invalidVideoUrlError();
  }
  if (!getVideoPlatform(parsed.toString())) throw invalidVideoUrlError();

  parsed.protocol = 'https:';
  parsed.port = '';
  parsed.hash = '';
  return parsed.toString();
}

// Kept as an export alias for existing integrations/tests that used the Douyin-only name.
const normalizeDouyinVideoUrl = normalizeSupportedVideoUrl;

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
  const parsed = new URL(videoUrl);
  const platform = getVideoPlatform(videoUrl) || 'video';
  const pathId = parsed.pathname.match(/(?:video|share\/video|note|shorts|embed)\/(\d{8,})/i);
  const youtubeId = platform === 'youtube'
    ? parsed.searchParams.get('v') || (parsed.hostname.toLowerCase() === 'youtu.be' ? parsed.pathname.split('/').filter(Boolean)[0] || '' : '')
    : '';
  const videoId = (pathId && pathId[1]) || youtubeId;
  return `${platform}-${videoId && /^[a-zA-Z0-9_-]{6,}$/.test(videoId) ? videoId : 'video'}.mp4`;
}

async function handleSupportedVideoDownload(req, res, rawUrl) {
  let videoUrl;
  try {
    videoUrl = normalizeSupportedVideoUrl(rawUrl);
  } catch (error) {
    return sendJson(res, 400, {
      error: error && error.message || 'Use um link válido do TikTok, Douyin ou YouTube.',
      code: 'INVALID_VIDEO_URL'
    });
  }

  const platform = getVideoPlatform(videoUrl);
  const label = platform === 'youtube' ? 'YouTube' : platform === 'tiktok' ? 'TikTok' : 'Douyin';
  const prefix = `[${platform}-download]`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const child = await spawnSupportedVideoDownloadWithYtDlp(videoUrl, controller.signal);
    if (controller.signal.aborted) {
      try { child.kill('SIGTERM'); } catch (_) {}
      clearTimeout(timeout);
      return sendJson(res, 504, {
        error: `O download do ${label} excedeu o tempo limite. Tente novamente.`,
        code: 'VIDEO_DOWNLOAD_TIMEOUT'
      });
    }

    return await streamYtDlpProcess(child, res, controller, timeout, getDownloadFilename(videoUrl), {
      logPrefix: prefix,
      timeoutCode: 'VIDEO_DOWNLOAD_TIMEOUT',
      timeoutMessage: `O download do ${label} excedeu o tempo limite. Tente novamente.`,
      emptyCode: 'EMPTY_VIDEO_STREAM',
      emptyMessage: `A plataforma ${label} não retornou dados de vídeo para este link.`,
      streamCode: 'VIDEO_STREAM_FAILED',
      streamMessage: `Não foi possível iniciar o download do ${label}. O vídeo pode estar privado, restrito ou indisponível.`
    });
  } catch (error) {
    clearTimeout(timeout);
    const timedOut = controller.signal.aborted || error && error.code === 'ABORT_ERR';
    const code = timedOut ? 'VIDEO_DOWNLOAD_TIMEOUT' : error && error.code || 'VIDEO_DOWNLOAD_FAILED';
    console.error(`${prefix} request failed:`, code);
    return sendJson(res, timedOut ? 504 : 502, {
      error: timedOut
        ? `O download do ${label} excedeu o tempo limite. Tente novamente.`
        : `Não foi possível baixar este vídeo do ${label}. Ele pode estar privado, restrito ou temporariamente indisponível.`,
      code
    });
  }
}

module.exports = {
  SUPPORTED_VIDEO_DOMAINS,
  normalizeSupportedVideoUrl,
  normalizeDouyinVideoUrl,
  getVideoPlatform,
  getDownloadFilename,
  handleSupportedVideoDownload,
  handleDouyinDownload: handleSupportedVideoDownload
};
