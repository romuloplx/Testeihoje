'use strict';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
]);

let resolverPromise;

function extractYoutubeVideoId(input) {
  const raw = String(input || '').trim();
  if (VIDEO_ID_RE.test(raw)) return raw;

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch (_) {
    return '';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_YOUTUBE_HOSTS.has(host)) return '';

  let id = '';
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/').filter(Boolean)[0] || '';
  } else {
    id = parsed.searchParams.get('v') || '';
    if (!id) {
      const match = parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/i);
      if (match) id = match[1];
    }
  }

  return VIDEO_ID_RE.test(id) ? id : '';
}

function isDownloadableMp4Format(format) {
  if (!format || !Number.isSafeInteger(Number(format.itag)) || Number(format.itag) <= 0) return false;
  if (String(format.container || '').toLowerCase() !== 'mp4') return false;
  if (format.hasAudio !== true || format.hasVideo !== true) return false;
  if (format.isDrm || format.isOtf || format.isLive || format.isDrc) return false;
  return true;
}

function normalizeDownloadableFormats(formats) {
  const unique = new Map();
  for (const format of Array.isArray(formats) ? formats : []) {
    if (!isDownloadableMp4Format(format)) continue;
    const itag = Number(format.itag);
    if (unique.has(itag)) continue;
    const height = Number(format.height) || Number((String(format.qualityLabel || '').match(/\d+/) || [])[0]) || 0;
    unique.set(itag, {
      itag,
      qualityLabel: String(format.qualityLabel || (height ? `${height}p` : 'MP4')),
      height,
      bitrate: Number(format.bitrate || format.averageBitrate) || 0,
      contentLength: Number(format.contentLength) || 0,
      container: 'mp4',
      hasAudio: true,
      hasVideo: true
    });
  }
  return [...unique.values()].sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
}

function sanitizeVideoFilename(value) {
  const safe = String(value || 'video-youtube')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 100);
  return safe || 'video-youtube';
}

async function getResolver() {
  if (!resolverPromise) {
    resolverPromise = import('@distube/ytdl-core').then(({ Ytdl }) => {
      if (typeof Ytdl !== 'function') throw new Error('Resolvedor de vídeo indisponível.');
      return new Ytdl({ lang: 'en', country: 'US', timeoutMs: 25000 });
    }).catch(error => {
      resolverPromise = null;
      throw error;
    });
  }
  return resolverPromise;
}

async function resolveYoutubeVideo(input, signal) {
  const videoId = extractYoutubeVideoId(input);
  if (!videoId) {
    const error = new Error('Use um link válido do YouTube.');
    error.code = 'INVALID_YOUTUBE_URL';
    throw error;
  }

  const resolver = await getResolver();
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await resolver.getInfo(url, { signal: signal || AbortSignal.timeout(30000) });
  const formats = normalizeDownloadableFormats(info.formats);
  return { resolver, info, videoId, formats };
}

module.exports = {
  VIDEO_ID_RE,
  extractYoutubeVideoId,
  isDownloadableMp4Format,
  normalizeDownloadableFormats,
  sanitizeVideoFilename,
  getResolver,
  resolveYoutubeVideo
};
