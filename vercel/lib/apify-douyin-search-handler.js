'use strict';

const crypto = require('node:crypto');

const ACTOR_ID = 'atomus~douyin-scraper';
const ACTOR_RUN_URL = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items`;
const UPSTREAM_TIMEOUT_MS = 65000;
const SEARCH_CACHE_TTL_MS = 60000;
const SEARCH_CACHE_MAX_ENTRIES = 100;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SEARCHES = 10;
const RATE_LIMIT_MAX_CLIENTS = 1000;

const searchCache = new Map();
const clientSearchWindows = new Map();

function sendJson(res, statusCode, payload) {
  if (res.destroyed) return;
  if (res.headersSent) {
    if (typeof res.destroy === 'function') res.destroy();
    return;
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(payload);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function createError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function parseInteger(value, fallback) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function normalizeSearchInput(body = {}) {
  const keyword = String(body.keyword || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!keyword) throw createError('Digite um tema ou palavra-chave para buscar no Douyin.', 400, 'DOUYIN_SEARCH_KEYWORD_REQUIRED');
  if (keyword.length > 100) throw createError('A busca pode ter no máximo 100 caracteres.', 400, 'DOUYIN_SEARCH_KEYWORD_TOO_LONG');

  const sortType = parseInteger(body.sortType, 1);
  const sortMap = { 0: '综合排序', 1: '最多点赞', 2: '最新发布' };
  if (!Object.prototype.hasOwnProperty.call(sortMap, sortType)) {
    throw createError('Tipo de ordenação inválido.', 400, 'DOUYIN_SEARCH_INVALID_SORT');
  }

  const publishTime = parseInteger(body.publishTime, 7);
  const publishTimeMap = { 0: '不限', 1: '一天内', 7: '一周内', 180: '半年内' };
  if (!Object.prototype.hasOwnProperty.call(publishTimeMap, publishTime)) {
    throw createError('Período de publicação inválido.', 400, 'DOUYIN_SEARCH_INVALID_PERIOD');
  }

  const count = Math.min(10, Math.max(1, parseInteger(body.count, 10)));
  return {
    keyword,
    sortType,
    sortLabel: sortMap[sortType],
    publishTime,
    publishTimeLabel: publishTimeMap[publishTime],
    count
  };
}

function safeNonNegativeNumber(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const number = Number(value);
    if (Number.isSafeInteger(number) && number >= 0) return number;
  }
  return null;
}

function isAllowedDouyinLink(raw) {
  try {
    const url = new URL(String(raw || ''));
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['douyin.com', 'iesdouyin.com'].some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch (_) {
    return false;
  }
}

function isAllowedDouyinImage(raw) {
  try {
    const url = new URL(String(raw || ''));
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['douyinpic.com', 'douyincdn.com'].some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch (_) {
    return false;
  }
}

function normalizeVideo(item) {
  const source = item && typeof item === 'object' ? item : {};
  const author = source.author && typeof source.author === 'object' ? source.author : {};
  const stats = source.stats && typeof source.stats === 'object'
    ? source.stats
    : (source.statistics && typeof source.statistics === 'object' ? source.statistics : {});
  const id = String(source.awemeId || source.aweme_id || source.videoId || source.video_id || source.item_id || source.id || '').trim().slice(0, 80);
  const rawUrl = String(source.url || source.videoUrl || source.video_url || source.shareUrl || source.share_url || source.link || '').trim();
  const url = isAllowedDouyinLink(rawUrl)
    ? rawUrl
    : (/^\d{8,32}$/.test(id) ? `https://www.douyin.com/video/${id}` : '');
  const rawCover = String(source.coverUrl || source.cover_url || source.cover || '').trim();
  const rawCreatedAt = source.createTime || source.create_time || source.createdAt || source.created_at || 0;
  const numericCreatedAt = Number(rawCreatedAt);
  const parsedDate = typeof rawCreatedAt === 'string' && !/^\d+$/.test(rawCreatedAt) ? Date.parse(rawCreatedAt) : NaN;
  const createdValue = Number.isSafeInteger(numericCreatedAt) && numericCreatedAt > 0
    ? numericCreatedAt
    : (Number.isFinite(parsedDate) && parsedDate > 0 ? parsedDate : 0);
  const createdAt = createdValue > 0
    ? (createdValue > 1000000000000 ? Math.floor(createdValue / 1000) : createdValue)
    : null;

  return {
    id,
    title: String(source.desc || source.title || source.description || source.caption || 'Vídeo sem título disponível').replace(/\s+/g, ' ').trim().slice(0, 300),
    creator: String(author.nickname || author.name || (typeof source.author === 'string' ? source.author : '') || source.nickname || source.creator || source.authorName || 'Criador não identificado').replace(/\s+/g, ' ').trim().slice(0, 100),
    likes: safeNonNegativeNumber(stats.diggCount, stats.digg_count, stats.likeCount, stats.like_count, source.likes, source.diggCount, source.digg_count),
    comments: safeNonNegativeNumber(stats.commentCount, stats.comment_count, source.commentCount, source.comment_count, source.comments),
    shares: safeNonNegativeNumber(stats.shareCount, stats.share_count, source.shareCount, source.share_count, source.shares),
    views: safeNonNegativeNumber(stats.playCount, stats.play_count, source.playCount, source.play_count, source.views),
    createdAt,
    url,
    cover: isAllowedDouyinImage(rawCover) ? rawCover : ''
  };
}
function normalizeActorItems(payload) {
  const items = Array.isArray(payload)
    ? payload
    : (payload && Array.isArray(payload.items) ? payload.items : []);
  const seen = new Set();
  return items.map(normalizeVideo).filter(video => {
    if (!video.id || seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  }).slice(0, 10);
}

function getSearchCacheKey(input) {
  return JSON.stringify([input.keyword.toLocaleLowerCase(), input.sortType, input.publishTime, input.count]);
}

function readSearchCache(key, now = Date.now()) {
  const entry = searchCache.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) searchCache.delete(key);
    return null;
  }
  searchCache.delete(key);
  searchCache.set(key, entry);
  return JSON.parse(JSON.stringify(entry.value));
}

function writeSearchCache(key, value, now = Date.now()) {
  searchCache.set(key, { value, expiresAt: now + SEARCH_CACHE_TTL_MS });
  while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) searchCache.delete(searchCache.keys().next().value);
}

function getClientRateLimitKey(req = {}) {
  const headers = req.headers || {};
  const forwarded = String(headers['x-forwarded-for'] || '').split(',').map(value => value.trim()).filter(Boolean);
  const address = String(headers['x-real-ip'] || forwarded[forwarded.length - 1] || req.socket && req.socket.remoteAddress || 'unknown')
    .replace(/[\r\n\u0000]/g, '').slice(0, 120);
  return crypto.createHash('sha256').update(address).digest('hex');
}

function consumeClientSearchQuota(req, now = Date.now()) {
  const key = getClientRateLimitKey(req);
  const timestamps = (clientSearchWindows.get(key) || []).filter(timestamp => timestamp > now - RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_SEARCHES) {
    clientSearchWindows.set(key, timestamps);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000)) };
  }
  timestamps.push(now);
  clientSearchWindows.set(key, timestamps);
  while (clientSearchWindows.size > RATE_LIMIT_MAX_CLIENTS) clientSearchWindows.delete(clientSearchWindows.keys().next().value);
  return { allowed: true, retryAfterSeconds: 0 };
}

async function fetchActorResults(input, token, fetchImpl) {
  const url = new URL(ACTOR_RUN_URL);
  url.searchParams.set('timeout', '60');
  url.searchParams.set('format', 'json');
  url.searchParams.set('clean', 'true');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  if (timer && typeof timer.unref === 'function') timer.unref();
  try {
    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        searchType: 'search',
        keywords: [input.keyword],
        maxItems: input.count,
        sortType: input.sortLabel,
        publishTime: input.publishTimeLabel,
        duration: '不限',
        contentType: '视频'
      }),
      signal: controller.signal
    });
    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : []; }
    catch (_) { payload = null; }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw createError('O token do Apify foi recusado. Confira APIFY_API_TOKEN nas variáveis de ambiente do servidor.', 502, 'APIFY_AUTH_FAILED');
      }
      if (response.status === 402 || response.status === 429) {
        throw createError('O Apify atingiu o limite de uso ou de cobrança da conta. Confira seu painel e tente novamente.', 429, 'APIFY_LIMIT_REACHED');
      }
      if (response.status === 408 || response.status === 504) {
        throw createError('A busca externa demorou demais. Tente novamente com outro tema.', 504, 'APIFY_SEARCH_TIMEOUT');
      }
      throw createError(`O provedor externo não concluiu a busca (HTTP ${response.status}). Tente novamente.`, 502, 'APIFY_SEARCH_FAILED');
    }

    if (payload && !Array.isArray(payload) && (payload.error || payload.message)) {
      throw createError('O provedor externo retornou uma falha ao pesquisar. Tente novamente mais tarde.', 502, 'APIFY_ACTOR_FAILED');
    }
    return normalizeActorItems(payload);
  } catch (error) {
    if (error && error.code) throw error;
    if (controller.signal.aborted || error && error.name === 'AbortError') {
      throw createError('A busca externa excedeu o tempo limite. Tente novamente.', 504, 'APIFY_SEARCH_TIMEOUT');
    }
    throw createError('Não foi possível conectar ao provedor de busca externa. Tente novamente.', 502, 'APIFY_SEARCH_NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

async function handleApifyDouyinSearch(req, res, body = {}, options = {}) {
  try {
    const input = normalizeSearchInput(body);
    const env = options.env || process.env;
    const token = String(env.APIFY_API_TOKEN || '').trim();
    if (!token) {
      throw createError(
        'Busca externa ainda não configurada. Crie uma conta Apify e adicione APIFY_API_TOKEN nas variáveis de ambiente do servidor/Vercel; não precisa de conta Douyin.',
        503,
        'APIFY_SEARCH_NOT_CONFIGURED'
      );
    }

    const cacheKey = getSearchCacheKey(input);
    const cached = readSearchCache(cacheKey);
    if (cached) return sendJson(res, 200, cached);

    const quota = consumeClientSearchQuota(req);
    if (!quota.allowed) {
      const error = createError('Limite de buscas atingido para este acesso. Aguarde alguns minutos antes de pesquisar novamente.', 429, 'APIFY_RATE_LIMITED');
      error.retryAfterSeconds = quota.retryAfterSeconds;
      throw error;
    }

    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const videos = await fetchActorResults(input, token, fetchImpl);
    const result = {
      ok: true,
      provider: 'Apify',
      videos,
      hasMore: false,
      cursor: '0',
      searchId: ''
    };
    writeSearchCache(cacheKey, result);
    return sendJson(res, 200, result);
  } catch (error) {
    if (error && error.retryAfterSeconds && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    return sendJson(res, Number(error && error.statusCode) || 500, {
      ok: false,
      error: String(error && error.message || 'Falha na busca externa do Douyin.'),
      code: String(error && error.code || 'APIFY_SEARCH_FAILED')
    });
  }
}

function clearApifyDouyinSearchCache() {
  searchCache.clear();
  clientSearchWindows.clear();
}

module.exports = {
  ACTOR_ID,
  ACTOR_RUN_URL,
  normalizeSearchInput,
  normalizeVideo,
  normalizeActorItems,
  fetchActorResults,
  handleApifyDouyinSearch,
  clearApifyDouyinSearchCache
};
