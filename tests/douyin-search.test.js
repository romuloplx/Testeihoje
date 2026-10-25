'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLIENT_TOKEN_URL,
  VIDEO_SEARCH_URL,
  normalizeDouyinSearchInput,
  normalizeDouyinSearchResponse,
  handleDouyinVideoSearch,
  clearDouyinSearchCaches
} = require('../vercel/lib/douyin-search-handler');
const {
  ACTOR_RUN_URL,
  normalizeSearchInput,
  normalizeActorItems,
  handleApifyDouyinSearch,
  clearApifyDouyinSearchCache
} = require('../vercel/lib/apify-douyin-search-handler');
const clipsHandler = require('../vercel/api/clips');

function makeResponse() {
  return {
    headers: {},
    headersSent: false,
    destroyed: false,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(payload) { this.body = payload; return this; },
    end(body) { this.body = JSON.parse(body); }
  };
}

function jsonResponse(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(json); }
  };
}

const credentials = {
  DOUYIN_CLIENT_KEY: 'test-client-key',
  DOUYIN_CLIENT_SECRET: 'test-client-secret'
};

function validVideoSearchResponse() {
  return {
    err_no: 0,
    err_msg: 'success',
    data: {
      data: {
        cursor: 10,
        has_more: true,
        search_id: 'search-abc-123',
        video_list: [{
          item_id: '7481234567890123456',
          title: 'Vídeo popular de teste #tema',
          nickname: 'Criadora de exemplo',
          statistics: { digg_count: 4321 },
          create_time: 1750000000,
          link: 'https://www.douyin.com/video/7481234567890123456',
          cover: 'https://p11-sign.douyinpic.com/example.jpeg'
        }]
      }
    }
  };
}

test('validates external search filters and clamps each query to ten results', () => {
  assert.deepEqual(normalizeSearchInput({
    keyword: '  美食  ', sortType: '2', publishTime: '180', count: '5000'
  }), {
    keyword: '美食', sortType: 2, sortLabel: '最新发布', publishTime: 180,
    publishTimeLabel: '半年内', count: 10
  });
  assert.equal(normalizeSearchInput({ keyword: 'pets', count: 3 }).count, 3);
  assert.throws(() => normalizeSearchInput({ keyword: '   ' }), { code: 'DOUYIN_SEARCH_KEYWORD_REQUIRED' });
  assert.throws(() => normalizeSearchInput({ keyword: 'x'.repeat(101) }), { code: 'DOUYIN_SEARCH_KEYWORD_TOO_LONG' });
  assert.throws(() => normalizeSearchInput({ keyword: 'cats', sortType: 9 }), { code: 'DOUYIN_SEARCH_INVALID_SORT' });
  assert.throws(() => normalizeSearchInput({ keyword: 'cats', publishTime: 30 }), { code: 'DOUYIN_SEARCH_INVALID_PERIOD' });
});

test('returns Apify setup instructions without outbound calls when no server token is configured', async () => {
  clearApifyDouyinSearchCache();
  const response = makeResponse();
  let called = false;
  await handleApifyDouyinSearch({ method: 'POST' }, response, { keyword: '宠物' }, {
    env: {},
    fetchImpl: async () => { called = true; throw new Error('should not be called'); }
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'APIFY_SEARCH_NOT_CONFIGURED');
  assert.match(response.body.error, /APIFY_API_TOKEN/);
  assert.match(response.body.error, /não precisa de conta Douyin/);
  assert.equal(called, false);
});

test('runs the Apify keyword-search Actor with a server-side bearer token and normalizes metadata', async () => {
  clearApifyDouyinSearchCache();
  const calls = [];
  const response = makeResponse();
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse([{
      mode: 'search',
      videoId: '7481234567890123456',
      desc: 'Vídeo viral sobre comida',
      url: 'https://www.douyin.com/video/7481234567890123456',
      coverUrl: 'https://p11-sign.douyinpic.com/example.jpeg',
      createTime: 1750000000000,
      author: { nickname: 'Criadora Apify' },
      stats: { diggCount: 4321, commentCount: 87, shareCount: 65, playCount: 90000 },
      downloadUrl: 'https://media.invalid/private.mp4'
    }]);
  };

  await handleApifyDouyinSearch({ method: 'POST' }, response, {
    keyword: '美食', sortType: 1, publishTime: 7, count: 500
  }, { env: { APIFY_API_TOKEN: 'apify-test-token' }, fetchImpl });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.provider, 'Apify');
  assert.equal(response.body.hasMore, false);
  assert.equal(response.body.videos.length, 1);
  assert.deepEqual(response.body.videos[0], {
    id: '7481234567890123456',
    title: 'Vídeo viral sobre comida',
    creator: 'Criadora Apify',
    likes: 4321,
    comments: 87,
    shares: 65,
    views: 90000,
    createdAt: 1750000000,
    url: 'https://www.douyin.com/video/7481234567890123456',
    cover: 'https://p11-sign.douyinpic.com/example.jpeg'
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith(ACTOR_RUN_URL));
  const requestUrl = new URL(calls[0].url);
  assert.equal(requestUrl.searchParams.get('timeout'), '60');
  assert.equal(requestUrl.searchParams.has('token'), false, 'the Apify token must not be placed in the URL');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer apify-test-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    searchType: 'search',
    keywords: ['美食'],
    maxItems: 10,
    sortType: '最多点赞',
    publishTime: '一周内',
    duration: '不限',
    contentType: '视频'
  });
  assert.equal(Object.hasOwn(response.body.videos[0], 'downloadUrl'), false, 'search results must never pass download URLs to the UI');

  const cachedResponse = makeResponse();
  await handleApifyDouyinSearch({ method: 'POST' }, cachedResponse, {
    keyword: '美食', sortType: 1, publishTime: 7, count: 500
  }, { env: { APIFY_API_TOKEN: 'apify-test-token' }, fetchImpl });
  assert.equal(calls.length, 1, 'identical searches should use the short server cache');
  assert.deepEqual(cachedResponse.body, response.body);
});

test('drops untrusted Apify links and covers and removes duplicate results', () => {
  const videos = normalizeActorItems([
    {
      videoId: '7481234567890123456',
      url: 'https://attacker.invalid/repost',
      coverUrl: 'https://attacker.invalid/cover.jpg',
      downloadUrl: 'https://attacker.invalid/file.mp4'
    },
    { videoId: '7481234567890123456', desc: 'duplicate' }
  ]);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].url, 'https://www.douyin.com/video/7481234567890123456');
  assert.equal(videos[0].cover, '');
  assert.equal(Object.hasOwn(videos[0], 'downloadUrl'), false);
});

test('rate-limits uncached Apify searches per client to help prevent unexpected spend', async () => {
  clearApifyDouyinSearchCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return jsonResponse([]);
  };
  const req = { headers: { 'x-forwarded-for': '203.0.113.44' } };
  for (let index = 0; index < 10; index++) {
    const response = makeResponse();
    await handleApifyDouyinSearch(req, response, { keyword: `tema-${index}` }, {
      env: { APIFY_API_TOKEN: 'apify-test-token' }, fetchImpl
    });
    assert.equal(response.statusCode, 200);
  }

  const limitedResponse = makeResponse();
  await handleApifyDouyinSearch(req, limitedResponse, { keyword: 'tema-10' }, {
    env: { APIFY_API_TOKEN: 'apify-test-token' }, fetchImpl
  });
  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedResponse.body.code, 'APIFY_RATE_LIMITED');
  assert.ok(Number(limitedResponse.headers['retry-after']) > 0);
  assert.equal(calls, 10);
});

test('maps Apify authentication and billing errors to actionable safe responses', async () => {
  clearApifyDouyinSearchCache();
  const response = makeResponse();
  await handleApifyDouyinSearch({ method: 'POST' }, response, { keyword: '旅行' }, {
    env: { APIFY_API_TOKEN: 'invalid-test-token' },
    fetchImpl: async () => jsonResponse({ error: { message: 'token invalid' } }, 401)
  });
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.code, 'APIFY_AUTH_FAILED');
  assert.match(response.body.error, /APIFY_API_TOKEN/);
  assert.doesNotMatch(response.body.error, /invalid-test-token|token invalid/);

  clearApifyDouyinSearchCache();
  const billingResponse = makeResponse();
  await handleApifyDouyinSearch({ method: 'POST' }, billingResponse, { keyword: '旅行' }, {
    env: { APIFY_API_TOKEN: 'valid-test-token' },
    fetchImpl: async () => jsonResponse({ error: { message: 'payment required' } }, 402)
  });
  assert.equal(billingResponse.statusCode, 429);
  assert.equal(billingResponse.body.code, 'APIFY_LIMIT_REACHED');
  assert.doesNotMatch(billingResponse.body.error, /payment required/);
});

test('validates Douyin search keyword, sorting, date filter, cursor and device id', () => {
  assert.deepEqual(normalizeDouyinSearchInput({ keyword: '  美食  ', sortType: '1', publishTime: '7' }), {
    keyword: '美食', sortType: 1, publishTime: 7, count: 10, cursor: '0', searchId: '', deviceId: '1'
  });
  assert.throws(() => normalizeDouyinSearchInput({ keyword: '   ' }), { code: 'DOUYIN_SEARCH_KEYWORD_REQUIRED' });
  assert.throws(() => normalizeDouyinSearchInput({ keyword: 'x'.repeat(101) }), { code: 'DOUYIN_SEARCH_KEYWORD_TOO_LONG' });
  assert.throws(() => normalizeDouyinSearchInput({ keyword: 'cats', sortType: 9 }), { code: 'DOUYIN_SEARCH_INVALID_SORT' });
  assert.throws(() => normalizeDouyinSearchInput({ keyword: 'cats', publishTime: 30 }), { code: 'DOUYIN_SEARCH_INVALID_PERIOD' });
  assert.throws(() => normalizeDouyinSearchInput({ keyword: 'cats', cursor: '0&bad=true' }), { code: 'DOUYIN_SEARCH_INVALID_CURSOR' });
  assert.throws(() => normalizeDouyinSearchInput({ keyword: 'cats', deviceId: 'not-a-number' }), { code: 'DOUYIN_SEARCH_INVALID_DEVICE_ID' });
});

test('returns setup instructions without making outbound calls if official app credentials are missing', async () => {
  clearDouyinSearchCaches();
  const response = makeResponse();
  let called = false;
  await handleDouyinVideoSearch({ method: 'POST' }, response, { keyword: '宠物' }, {
    env: {},
    fetchImpl: async () => { called = true; throw new Error('should not be called'); }
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'DOUYIN_SEARCH_NOT_CONFIGURED');
  assert.match(response.body.error, /DOUYIN_CLIENT_KEY/);
  assert.equal(called, false);
});

test('uses the official client-token and video-search APIs and normalizes public inspiration metadata', async () => {
  clearDouyinSearchCaches();
  const calls = [];
  const response = makeResponse();
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === CLIENT_TOKEN_URL) {
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), {
        client_key: credentials.DOUYIN_CLIENT_KEY,
        client_secret: credentials.DOUYIN_CLIENT_SECRET,
        grant_type: 'client_credential'
      });
      return jsonResponse({ data: { access_token: 'clt.test-token', expires_in: 7200, error_code: 0 } });
    }
    assert.ok(url.startsWith(VIDEO_SEARCH_URL));
    assert.equal(options.headers['access-token'], 'clt.test-token');
    return jsonResponse(validVideoSearchResponse());
  };

  await handleDouyinVideoSearch({ method: 'POST' }, response, {
    keyword: '美食', sortType: 1, publishTime: 7, deviceId: '1750000000000123'
  }, { env: credentials, fetchImpl });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.videos.length, 1);
  assert.equal(response.body.videos[0].id, '7481234567890123456');
  assert.equal(response.body.videos[0].creator, 'Criadora de exemplo');
  assert.equal(response.body.videos[0].likes, 4321);
  assert.equal(response.body.videos[0].url, 'https://www.douyin.com/video/7481234567890123456');
  assert.equal(response.body.videos[0].cover, 'https://p11-sign.douyinpic.com/example.jpeg');
  assert.equal(response.body.hasMore, true);
  assert.equal(response.body.cursor, '10');
  assert.equal(response.body.searchId, 'search-abc-123');
  assert.equal(calls.length, 2);
  const query = new URL(calls[1].url);
  assert.equal(query.searchParams.get('keyword'), '美食');
  assert.equal(query.searchParams.get('sort_type'), '1');
  assert.equal(query.searchParams.get('publish_time'), '7');
  assert.equal(query.searchParams.get('device_id'), '1750000000000123');

  const cachedResponse = makeResponse();
  await handleDouyinVideoSearch({ method: 'POST' }, cachedResponse, {
    keyword: '美食', sortType: 1, publishTime: 7, deviceId: '1750000000000123'
  }, { env: credentials, fetchImpl });
  assert.equal(calls.length, 2, 'same search should use the short server cache');
  assert.deepEqual(cachedResponse.body, response.body);
});

test('does not trust arbitrary media or external video URLs from upstream search results', () => {
  const output = normalizeDouyinSearchResponse({
    data: { data: { video_list: [{
      item_id: '7481234567890123456',
      link: 'https://attacker.invalid/repost',
      cover: 'https://attacker.invalid/cover.jpg'
    }] } }
  });
  assert.equal(output.videos[0].url, 'https://www.douyin.com/video/7481234567890123456');
  assert.equal(output.videos[0].cover, '');
});

test('reports missing Douyin search scope without exposing upstream internals', async () => {
  clearDouyinSearchCaches();
  const response = makeResponse();
  const fetchImpl = async url => url === CLIENT_TOKEN_URL
    ? jsonResponse({ data: { access_token: 'clt.test-token', expires_in: 7200 } })
    : jsonResponse({ err_no: 0, data: { err_no: 28001018, err_msg: 'permission not enabled' } });

  await handleDouyinVideoSearch({ method: 'POST' }, response, { keyword: '旅行' }, { env: credentials, fetchImpl });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'DOUYIN_SEARCH_PERMISSION_REQUIRED');
  assert.match(response.body.error, /aweme\.dy\.video_search/);
  assert.doesNotMatch(response.body.error, /test-token|permission not enabled/);
});

test('routes primary inspiration searches through Apify and reports missing server token', async () => {
  clearApifyDouyinSearchCache();
  const oldToken = process.env.APIFY_API_TOKEN;
  delete process.env.APIFY_API_TOKEN;
  const response = makeResponse();
  try {
    await clipsHandler({
      method: 'POST',
      url: '/api/clips',
      body: { action: 'douyin_search', keyword: 'viral' }
    }, response);
  } finally {
    if (oldToken == null) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = oldToken;
  }

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'APIFY_SEARCH_NOT_CONFIGURED');
  assert.match(response.body.error, /APIFY_API_TOKEN/);
});

test('retains the optional official Douyin search under an explicit action', async () => {
  clearDouyinSearchCaches();
  const oldKey = process.env.DOUYIN_CLIENT_KEY;
  const oldSecret = process.env.DOUYIN_CLIENT_SECRET;
  delete process.env.DOUYIN_CLIENT_KEY;
  delete process.env.DOUYIN_CLIENT_SECRET;
  const response = makeResponse();
  try {
    await clipsHandler({
      method: 'POST',
      url: '/api/clips',
      body: { action: 'douyin_search_official', keyword: 'viral' }
    }, response);
  } finally {
    if (oldKey == null) delete process.env.DOUYIN_CLIENT_KEY;
    else process.env.DOUYIN_CLIENT_KEY = oldKey;
    if (oldSecret == null) delete process.env.DOUYIN_CLIENT_SECRET;
    else process.env.DOUYIN_CLIENT_SECRET = oldSecret;
  }

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'DOUYIN_SEARCH_NOT_CONFIGURED');
});

test('publishes the trend-only boundary and local review queue in both HTML copies', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['../public/index.html', '../vercel/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(html, /id="douyinTrendDiscoveryCard"/);
    assert.match(html, /action:'douyin_search'/);
    assert.match(html, /BUSCA EXTERNA · APIFY/);
    assert.match(html, /APIFY_API_TOKEN/);
    assert.match(html, /cobrança na Apify por resultado/);
    assert.match(html, /somente como inspiração/);
    assert.match(html, /douyinRightsConfirmed/);
    assert.match(html, /function addDubToReviewQueue\(\)/);
    assert.match(html, /id="review-queue"/);
    assert.match(html, /nenhuma publicação ou envio ao TikTok acontece nesta etapa/i);
  }
});
