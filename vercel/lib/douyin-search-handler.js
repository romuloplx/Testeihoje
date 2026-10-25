'use strict';

const crypto = require('node:crypto');

const CLIENT_TOKEN_URL = 'https://open.douyin.com/oauth/client_token/';
const VIDEO_SEARCH_URL = 'https://open.douyin.com/dy_open_api/v1/search/video/';
const TOKEN_TIMEOUT_MS = 15000;
const SEARCH_TIMEOUT_MS = 20000;
const SEARCH_CACHE_TTL_MS = 30000;
const SEARCH_CACHE_MAX_ENTRIES = 100;

let cachedClientToken = null;
let clientTokenPromise = null;
const searchCache = new Map();

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

function normalizeDouyinSearchInput(body = {}) {
  const keyword = String(body.keyword || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!keyword) throw createError('Digite uma palavra-chave para buscar no Douyin.', 400, 'DOUYIN_SEARCH_KEYWORD_REQUIRED');
  if (keyword.length > 100) throw createError('A busca pode ter no máximo 100 caracteres.', 400, 'DOUYIN_SEARCH_KEYWORD_TOO_LONG');

  const sortType = parseInteger(body.sortType, 1);
  if (![0, 1, 2].includes(sortType)) throw createError('Tipo de ordenação inválido.', 400, 'DOUYIN_SEARCH_INVALID_SORT');

  const publishTime = parseInteger(body.publishTime, 7);
  if (![0, 1, 7, 180].includes(publishTime)) throw createError('Período de publicação inválido.', 400, 'DOUYIN_SEARCH_INVALID_PERIOD');

  const count = Math.min(10, Math.max(1, parseInteger(body.count, 10)));
  const cursor = String(body.cursor == null ? '0' : body.cursor).trim();
  if (!/^\d{1,22}$/.test(cursor)) throw createError('Cursor de paginação inválido.', 400, 'DOUYIN_SEARCH_INVALID_CURSOR');

  const searchId = String(body.searchId || '').trim();
  if (searchId.length > 128 || /[\u0000-\u001f\u007f]/.test(searchId)) {
    throw createError('Identificador de busca inválido.', 400, 'DOUYIN_SEARCH_INVALID_SEARCH_ID');
  }

  const deviceId = String(body.deviceId || '1').trim();
  if (!/^\d{1,19}$/.test(deviceId)) throw createError('Identificador técnico inválido.', 400, 'DOUYIN_SEARCH_INVALID_DEVICE_ID');

  return { keyword, sortType, publishTime, count, cursor, searchId, deviceId };
}

async function fetchJson(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (timer && typeof timer.unref === 'function') timer.unref();
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let json;
    try { json = raw ? JSON.parse(raw) : {}; }
    catch (_) { json = {}; }
    return { response, json };
  } catch (error) {
    if (controller.signal.aborted || error && error.name === 'AbortError') {
      throw createError('A conexão com a API do Douyin excedeu o tempo limite. Tente novamente.', 504, 'DOUYIN_SEARCH_TIMEOUT');
    }
    throw createError('Não foi possível conectar à API oficial do Douyin. Tente novamente.', 502, 'DOUYIN_SEARCH_NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

function getClientTokenError(json) {
  const data = json && json.data || {};
  const errorCode = Number(data.error_code || json && json.error_code || 0);
  const token = String(data.access_token || data.client_token || '').trim();
  if (errorCode || !token) {
    const details = String(data.description || data.message || json && json.message || '').trim().slice(0, 180);
    return createError(
      details ? `Não foi possível autenticar na API do Douyin: ${details}` : 'Não foi possível autenticar na API do Douyin. Confira as credenciais configuradas no servidor.',
      502,
      'DOUYIN_CLIENT_TOKEN_FAILED'
    );
  }
  return null;
}

async function getDouyinClientToken({ fetchImpl = globalThis.fetch, env = process.env, force = false, now = Date.now() } = {}) {
  const clientKey = String(env.DOUYIN_CLIENT_KEY || '').trim();
  const clientSecret = String(env.DOUYIN_CLIENT_SECRET || '').trim();
  if (!clientKey || !clientSecret) {
    throw createError(
      'Busca oficial do Douyin ainda não configurada. Cadastre DOUYIN_CLIENT_KEY e DOUYIN_CLIENT_SECRET como variáveis de ambiente do servidor.',
      503,
      'DOUYIN_SEARCH_NOT_CONFIGURED'
    );
  }
  const credentialId = crypto.createHash('sha256').update(`${clientKey}|${clientSecret}`).digest('hex');

  if (!force && cachedClientToken && cachedClientToken.credentialId === credentialId && cachedClientToken.expiresAt > now + 30000) {
    return cachedClientToken.value;
  }
  if (!force && clientTokenPromise) return clientTokenPromise;

  clientTokenPromise = (async () => {
    const { response, json } = await fetchJson(fetchImpl, CLIENT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'client_credential'
      })
    }, TOKEN_TIMEOUT_MS);

    const tokenError = getClientTokenError(json);
    if (!response.ok || tokenError) {
      throw tokenError || createError('A autenticação na API do Douyin falhou. Confira a configuração da aplicação.', 502, 'DOUYIN_CLIENT_TOKEN_FAILED');
    }

    const tokenData = json.data || {};
    const expiresIn = Math.max(120, Number(tokenData.expires_in) || 7200);
    const token = String(tokenData.access_token || tokenData.client_token).trim();
    cachedClientToken = {
      credentialId,
      value: token,
      expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000
    };
    return token;
  })();

  try {
    return await clientTokenPromise;
  } finally {
    clientTokenPromise = null;
  }
}

function getUpstreamSearchError(json) {
  const candidates = [json, json && json.data, json && json.data && json.data.data];
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const rawCode = item.err_no != null ? item.err_no : item.error_code;
    if (rawCode == null || Number(rawCode) === 0) continue;
    const code = String(rawCode);
    const message = String(item.err_msg || item.description || item.message || '').trim().slice(0, 180);
    if (code === '28001003' || code === '28001008') {
      return createError('A autorização temporária do Douyin expirou. Tente pesquisar novamente.', 502, 'DOUYIN_CLIENT_TOKEN_EXPIRED');
    }
    if (code === '28001018' || code === '28001014') {
      return createError('A aplicação Douyin ainda não tem a permissão de busca de vídeos (aweme.dy.video_search). Solicite essa capacidade no Open Platform.', 403, 'DOUYIN_SEARCH_PERMISSION_REQUIRED');
    }
    if (code === '28003017') {
      return createError('A cota de busca do Douyin foi atingida. Aguarde e tente novamente.', 429, 'DOUYIN_SEARCH_QUOTA_EXCEEDED');
    }
    return createError(
      message ? `A API do Douyin recusou a busca (${code}): ${message}` : `A API do Douyin recusou a busca (${code}).`,
      502,
      'DOUYIN_SEARCH_UPSTREAM_ERROR'
    );
  }
  return null;
}

function isAllowedDouyinLink(raw) {
  try {
    const url = new URL(String(raw || ''));
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && ['douyin.com', 'iesdouyin.com'].some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch (_) {
    return false;
  }
}

function isAllowedDouyinImage(raw) {
  try {
    const url = new URL(String(raw || ''));
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && ['douyinpic.com', 'douyincdn.com'].some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch (_) {
    return false;
  }
}

function normalizeDouyinSearchVideo(item) {
  const source = item && typeof item === 'object' ? item : {};
  const id = String(source.item_id || source.aweme_id || source.video_id || '').trim().slice(0, 80);
  const title = String(source.title || source.desc || source.high_quality_text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const creator = String(source.nickname || source.author && source.author.nickname || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  const stats = source.statistics && typeof source.statistics === 'object' ? source.statistics : {};
  const likesValue = Number(stats.digg_count != null ? stats.digg_count : source.digg_count);
  const createdValue = Number(source.create_time || source.createTime || 0);
  const rawLink = String(source.link || source.share_url || '').trim();
  const link = isAllowedDouyinLink(rawLink)
    ? rawLink
    : (/^[A-Za-z0-9_-]{8,80}$/.test(id) ? `https://www.douyin.com/video/${encodeURIComponent(id)}` : '');
  const rawCover = String(source.cover || source.cover_url || source.coverUrl || '').trim();

  return {
    id,
    title: title || 'Vídeo sem título disponível',
    creator: creator || 'Criador não identificado',
    likes: Number.isSafeInteger(likesValue) && likesValue >= 0 ? likesValue : null,
    createdAt: Number.isSafeInteger(createdValue) && createdValue > 0 ? createdValue : null,
    url: link,
    cover: isAllowedDouyinImage(rawCover) ? rawCover : ''
  };
}

function normalizeDouyinSearchResponse(json) {
  const data = json && json.data || {};
  const searchData = data.data && typeof data.data === 'object' ? data.data : data;
  const list = Array.isArray(searchData.video_list) ? searchData.video_list : [];
  const seen = new Set();
  const videos = list.map(normalizeDouyinSearchVideo).filter(video => {
    if (!video.id || seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  }).slice(0, 10);

  const rawCursor = searchData.cursor;
  const cursor = rawCursor == null ? '0' : String(rawCursor).trim();
  return {
    videos,
    hasMore: Boolean(searchData.has_more),
    cursor: /^\d{1,22}$/.test(cursor) ? cursor : '0',
    searchId: String(searchData.search_id || '').trim().slice(0, 128)
  };
}

function getSearchCacheKey(input, clientKey) {
  return JSON.stringify([
    clientKey,
    input.keyword.toLocaleLowerCase(),
    input.sortType,
    input.publishTime,
    input.count,
    input.cursor,
    input.searchId,
    input.deviceId
  ]);
}

function readSearchCache(key, now = Date.now()) {
  const item = searchCache.get(key);
  if (!item || item.expiresAt <= now) {
    if (item) searchCache.delete(key);
    return null;
  }
  // Atualiza a ordem de uso para manter no mapa os resultados acessados com maior frequência.
  searchCache.delete(key);
  searchCache.set(key, item);
  return JSON.parse(JSON.stringify(item.value));
}

function writeSearchCache(key, value, now = Date.now()) {
  searchCache.set(key, { value, expiresAt: now + SEARCH_CACHE_TTL_MS });
  while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) searchCache.delete(searchCache.keys().next().value);
}

async function performSearch(input, token, fetchImpl) {
  const url = new URL(VIDEO_SEARCH_URL);
  url.searchParams.set('keyword', input.keyword);
  url.searchParams.set('sort_type', String(input.sortType));
  url.searchParams.set('publish_time', String(input.publishTime));
  url.searchParams.set('count', String(input.count));
  url.searchParams.set('cursor', input.cursor);
  url.searchParams.set('device_id', input.deviceId);
  if (input.searchId) url.searchParams.set('search_id', input.searchId);

  const { response, json } = await fetchJson(fetchImpl, url.toString(), {
    method: 'GET',
    headers: {
      'access-token': token,
      'Content-Type': 'application/json'
    }
  }, SEARCH_TIMEOUT_MS);
  const upstreamError = getUpstreamSearchError(json);
  if (!response.ok || upstreamError) {
    throw upstreamError || createError('A API oficial do Douyin não concluiu a busca. Tente novamente.', 502, 'DOUYIN_SEARCH_UPSTREAM_ERROR');
  }

  const normalized = normalizeDouyinSearchResponse(json);
  return { ok: true, ...normalized };
}

async function handleDouyinVideoSearch(req, res, body = {}, options = {}) {
  try {
    const input = normalizeDouyinSearchInput(body);
    const env = options.env || process.env;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const clientKey = String(env.DOUYIN_CLIENT_KEY || '').trim();
    const clientSecret = String(env.DOUYIN_CLIENT_SECRET || '').trim();
    if (!clientKey || !clientSecret) {
      throw createError(
        'Busca oficial do Douyin ainda não configurada. Cadastre DOUYIN_CLIENT_KEY e DOUYIN_CLIENT_SECRET como variáveis de ambiente do servidor.',
        503,
        'DOUYIN_SEARCH_NOT_CONFIGURED'
      );
    }
    const cacheKey = getSearchCacheKey(input, clientKey);
    const cachedResult = readSearchCache(cacheKey);
    if (cachedResult) return sendJson(res, 200, cachedResult);

    let token = await getDouyinClientToken({ fetchImpl, env });
    let result;
    try {
      result = await performSearch(input, token, fetchImpl);
    } catch (error) {
      if (error && error.code === 'DOUYIN_CLIENT_TOKEN_EXPIRED') {
        cachedClientToken = null;
        token = await getDouyinClientToken({ fetchImpl, env, force: true });
        result = await performSearch(input, token, fetchImpl);
      } else {
        throw error;
      }
    }

    writeSearchCache(cacheKey, result);
    return sendJson(res, 200, result);
  } catch (error) {
    const statusCode = Number(error && error.statusCode) || 500;
    return sendJson(res, statusCode, {
      ok: false,
      error: String(error && error.message || 'Falha na busca de vídeos do Douyin.'),
      code: String(error && error.code || 'DOUYIN_SEARCH_FAILED')
    });
  }
}

function clearDouyinSearchCaches() {
  cachedClientToken = null;
  clientTokenPromise = null;
  searchCache.clear();
}

module.exports = {
  CLIENT_TOKEN_URL,
  VIDEO_SEARCH_URL,
  normalizeDouyinSearchInput,
  normalizeDouyinSearchVideo,
  normalizeDouyinSearchResponse,
  handleDouyinVideoSearch,
  clearDouyinSearchCaches
};
