const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  generateCreateSceneVideo,
  consumeCreateSceneVideoRequest
} = require('../vercel/api/lib/ai');

const savedFetch = global.fetch;
const savedSetTimeout = global.setTimeout;
const savedApiKey = process.env.TENCENT_TOKENHUB_API_KEY;
const savedBaseUrl = process.env.TENCENT_TOKENHUB_BASE_URL;

function restoreTokenHubEnvironment(){
  global.fetch = savedFetch;
  global.setTimeout = savedSetTimeout;
  if(savedApiKey === undefined) delete process.env.TENCENT_TOKENHUB_API_KEY;
  else process.env.TENCENT_TOKENHUB_API_KEY = savedApiKey;
  if(savedBaseUrl === undefined) delete process.env.TENCENT_TOKENHUB_BASE_URL;
  else process.env.TENCENT_TOKENHUB_BASE_URL = savedBaseUrl;
}

function configureTokenHub(){
  process.env.TENCENT_TOKENHUB_API_KEY = 'unit-test-tokenhub-key';
  process.env.TENCENT_TOKENHUB_BASE_URL = 'https://tokenhub-test.example/v1';
}

function makeImageBase64(){
  return Buffer.alloc(180, 0x65).toString('base64');
}

function makeMp4(){
  const mp4 = Buffer.alloc(2048, 0);
  mp4.writeUInt32BE(16, 0);
  mp4.write('ftyp', 4, 'ascii');
  return mp4;
}

function jsonResponse(status, body){
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

function mp4Response(mp4){
  return {
    ok: true,
    status: 200,
    headers: { get: name => name.toLowerCase() === 'content-length' ? String(mp4.length) : 'video/mp4' },
    arrayBuffer: async () => mp4.buffer.slice(mp4.byteOffset, mp4.byteOffset + mp4.byteLength)
  };
}

function makeSuccessfulFetch(mp4, { runningOnce = false } = {}){
  const calls = [];
  let polls = 0;
  const videoUrl = 'https://cdn-tokenhub-test.example/generated/scene.mp4';
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if(String(url) === 'https://tokenhub-test.example/v1/wand/hunyuan-video/generation'){
      return jsonResponse(200, { task_id: 'hunyuan-test-task' });
    }
    if(String(url).includes('/v1/wand/hunyuan-video/tasks/')){
      polls++;
      if(runningOnce && polls === 1) return jsonResponse(200, { status: 'running' });
      return jsonResponse(200, { status: 'succeeded', videos: [{ url: videoUrl }] });
    }
    if(String(url) === videoUrl) return mp4Response(mp4);
    throw new Error(`Unexpected test fetch URL: ${url}`);
  };
  return { fetch, calls, get polls(){ return polls; }, videoUrl };
}

test('connected cinema drawer keeps scene sources in scope for preparation and cleanup', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const start = html.indexOf('function makeConnectedCinemaDrawer(movie){');
  const end = html.indexOf('\n// Reamostra qualquer AudioBuffer', start);
  assert.ok(start >= 0 && end > start, 'connected cinema drawer source should be present');
  const source = html.slice(start, end);
  const context = { waitForGeneratedSceneVideo: async video => video };
  vm.runInNewContext(`${source}\nthis.makeConnectedCinemaDrawer = makeConnectedCinemaDrawer;`, context);

  const staticDrawer = context.makeConnectedCinemaDrawer({ scenes: [{ videoEl: null }] });
  assert.equal(staticDrawer.requiresRealtimeSources, false);
  await staticDrawer.prepare();
  staticDrawer.cleanup();
  assert.equal(staticDrawer.requiresRealtimeSources, false);

  const video = { readyState: 2, videoWidth: 640, currentTime: 0.2, pause(){} };
  const motionDrawer = context.makeConnectedCinemaDrawer({ scenes: [{ videoEl: video }] });
  assert.equal(motionDrawer.requiresRealtimeSources, true);
  await motionDrawer.prepare();
  assert.equal(motionDrawer.requiresRealtimeSources, true);
  assert.equal(video.currentTime, 0);
  motionDrawer.cleanup();
});

test('HunyuanVideo 1.5 submits an image-to-video task, polls it, and returns the MP4', async () => {
  configureTokenHub();
  const mp4 = makeMp4();
  const mock = makeSuccessfulFetch(mp4, { runningOnce: true });
  global.fetch = mock.fetch;
  // Avoid a real four-second wait while exercising the asynchronous running -> succeeded flow.
  global.setTimeout = (callback, _delay, ...args) => savedSetTimeout(callback, 0, ...args);

  try {
    const result = await generateCreateSceneVideo({
      prompt: 'A menina atravessa uma floresta iluminada.',
      imageBase64: `data:image/jpeg;base64,${makeImageBase64()}`,
      imageMime: 'image/jpeg',
      stylePrompt: 'animação 3D cinematográfica',
      clientKey: `hunyuan-success-${process.pid}`
    });

    assert.equal(mock.calls.length, 4);
    assert.equal(mock.polls, 2);
    const submit = mock.calls[0];
    assert.equal(submit.url, 'https://tokenhub-test.example/v1/wand/hunyuan-video/generation');
    assert.equal(submit.options.method, 'POST');
    assert.equal(submit.options.headers.Authorization, 'Bearer unit-test-tokenhub-key');
    assert.equal(submit.url.includes('unit-test-tokenhub-key'), false);
    const body = JSON.parse(submit.options.body);
    assert.equal(body.model, 'hy-video-v1.5');
    assert.equal(body.image, `data:image/jpeg;base64,${makeImageBase64()}`);
    assert.equal(body.duration, 5);
    assert.equal(body.revise, true);
    assert.match(body.negative_prompt, /watermark/);
    assert.match(body.prompt, /A menina atravessa uma floresta iluminada/);
    assert.match(body.prompt, /animação 3D cinematográfica/);
    assert.equal(mock.calls[1].url, 'https://tokenhub-test.example/v1/wand/hunyuan-video/tasks/hunyuan-test-task');
    assert.equal(mock.calls[2].url, mock.calls[1].url);
    assert.equal(mock.calls[3].url, mock.videoUrl);
    assert.equal(mock.calls[3].options.headers, undefined, 'the TokenHub secret must not be sent to the signed video URL');
    assert.deepEqual(result.buffer, mp4);
    assert.equal(result.mime, 'video/mp4');
    assert.equal(result.provider, 'tencent/hy-video-v1.5');
  } finally {
    restoreTokenHubEnvironment();
  }
});

test('HunyuanVideo fails clearly without a server-side TokenHub key and makes no request', async () => {
  delete process.env.TENCENT_TOKENHUB_API_KEY;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call provider'); };
  try {
    await assert.rejects(
      generateCreateSceneVideo({ prompt: 'teste', imageBase64: makeImageBase64(), clientKey: `hunyuan-no-key-${process.pid}` }),
      error => error.status === 503 && /TENCENT_TOKENHUB_API_KEY/.test(error.message)
    );
    assert.equal(called, false);
  } finally {
    restoreTokenHubEnvironment();
  }
});

test('HunyuanVideo provider errors preserve HTTP status and keep the key out of the URL', async () => {
  configureTokenHub();
  const urls = [];
  global.fetch = async url => {
    urls.push(String(url));
    return jsonResponse(403, { error: { message: 'model access not enabled' } });
  };
  try {
    await assert.rejects(
      generateCreateSceneVideo({ prompt: 'teste', imageBase64: makeImageBase64(), clientKey: `hunyuan-forbidden-${process.pid}` }),
      error => error.status === 403 && /model access not enabled/.test(error.message)
    );
    assert.deepEqual(urls, ['https://tokenhub-test.example/v1/wand/hunyuan-video/generation']);
    assert.equal(urls.some(url => url.includes('unit-test-tokenhub-key')), false);
  } finally {
    restoreTokenHubEnvironment();
  }
});

test('HunyuanVideo rejects failed tasks and invalid MP4 download results', async t => {
  await t.test('failed task', async () => {
    configureTokenHub();
    global.fetch = async url => String(url).endsWith('/generation')
      ? jsonResponse(200, { task_id: 'failed-task' })
      : jsonResponse(200, { status: 'failed', error: { message: 'generation rejected' } });
    try {
      await assert.rejects(
        generateCreateSceneVideo({ prompt: 'teste', imageBase64: makeImageBase64(), clientKey: `hunyuan-failed-${process.pid}` }),
        error => error.status === 422 && /generation rejected/.test(error.message)
      );
    } finally {
      restoreTokenHubEnvironment();
    }
  });

  await t.test('non-MP4 payload', async () => {
    configureTokenHub();
    global.fetch = async url => String(url).endsWith('/generation')
      ? jsonResponse(200, { task_id: 'bad-video-task' })
      : String(url).includes('/tasks/')
        ? jsonResponse(200, { status: 'succeeded', videos: [{ url: 'https://cdn-tokenhub-test.example/not-a-video' }] })
        : { ...mp4Response(Buffer.from('not an mp4 file')), arrayBuffer: async () => Buffer.from('not an mp4 file') };
    try {
      await assert.rejects(
        generateCreateSceneVideo({ prompt: 'teste', imageBase64: makeImageBase64(), clientKey: `hunyuan-bad-mp4-${process.pid}` }),
        error => error.status === 502 && /não é um MP4 válido/.test(error.message)
      );
    } finally {
      restoreTokenHubEnvironment();
    }
  });
});

test('HunyuanVideo image validation rejects oversized data before using the provider', async () => {
  configureTokenHub();
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call provider'); };
  try {
    await assert.rejects(
      generateCreateSceneVideo({ prompt: 'teste', imageBase64: 'A'.repeat(1_600_001), clientKey: `hunyuan-large-image-${process.pid}` }),
      error => error.status === 413 && /grande demais/.test(error.message)
    );
    assert.equal(called, false);
  } finally {
    restoreTokenHubEnvironment();
  }
});

test('HunyuanVideo clip rate limit allows a scene batch and then resets after its window', () => {
  const clientKey = `hunyuan-rate-limit-${process.pid}-${Date.now()}`;
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    assert.equal(consumeCreateSceneVideoRequest(clientKey, now).ok, true);
  }
  const blocked = consumeCreateSceneVideoRequest(clientKey, now + 1);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(consumeCreateSceneVideoRequest(clientKey, now + 60 * 60 * 1000 + 1).ok, true);
});

test('Vercel Create route starts async Hunyuan tasks and streams the completed MP4 on status poll', async () => {
  const handler = require('../vercel/api/create');
  configureTokenHub();
  const mp4 = makeMp4();
  const mock = makeSuccessfulFetch(mp4, { runningOnce: true });
  global.fetch = mock.fetch;
  const startRes = {
    headers: {}, statusCode: 0,
    setHeader(name, value){ this.headers[name.toLowerCase()] = value; },
    end(body){ this.body = body; }
  };
  const pendingRes = {
    headers: {}, statusCode: 0,
    setHeader(name, value){ this.headers[name.toLowerCase()] = value; },
    end(body){ this.body = body; }
  };
  const videoRes = {
    headers: {}, statusCode: 0, chunks: [],
    setHeader(name, value){ this.headers[name.toLowerCase()] = value; },
    write(chunk){ this.chunks.push(Buffer.from(chunk)); return true; },
    end(body){
      if(body) this.chunks.push(Buffer.from(body));
      this.body = Buffer.concat(this.chunks);
    }
  };
  try {
    await handler({
      method: 'POST',
      body: { action: 'scene-video', prompt: 'Cena de teste', imageBase64: makeImageBase64(), imageMime: 'image/jpeg' },
      headers: { 'x-forwarded-for': '198.51.100.20' },
      ip: `hunyuan-route-${process.pid}`,
      socket: { remoteAddress: '127.0.0.1' }
    }, startRes);
    assert.equal(startRes.statusCode, 202);
    assert.equal(startRes.headers['content-type'], 'application/json');
    const task = JSON.parse(startRes.body);
    assert.equal(task.taskId, 'hunyuan-test-task');
    assert.equal(task.provider, 'tencent/hy-video-v1.5');

    await handler({
      method: 'POST',
      body: { action: 'scene-video-status', taskId: task.taskId },
      headers: {},
      ip: `hunyuan-route-${process.pid}`,
      socket: { remoteAddress: '127.0.0.1' }
    }, pendingRes);
    assert.equal(pendingRes.statusCode, 202);
    assert.equal(JSON.parse(pendingRes.body).status, 'running');

    await handler({
      method: 'POST',
      body: { action: 'scene-video-status', taskId: task.taskId },
      headers: {},
      ip: `hunyuan-route-${process.pid}`,
      socket: { remoteAddress: '127.0.0.1' }
    }, videoRes);
    assert.equal(videoRes.statusCode, 200);
    assert.equal(videoRes.headers['content-type'], 'video/mp4');
    assert.equal(videoRes.headers['x-ai-video-provider'], 'tencent/hy-video-v1.5');
    assert.deepEqual(videoRes.body, mp4);
  } finally {
    restoreTokenHubEnvironment();
  }
});

test('Vercel Create route returns a clear 503 when HunyuanVideo has no configured TokenHub key', async () => {
  const handler = require('../vercel/api/create');
  delete process.env.TENCENT_TOKENHUB_API_KEY;
  const res = {
    headers: {},
    statusCode: 0,
    setHeader(name, value){ this.headers[name.toLowerCase()] = value; },
    end(body){ this.body = body; }
  };
  try {
    await handler({
      method: 'POST',
      body: { action: 'scene-video', prompt: 'Cena de teste', imageBase64: makeImageBase64() },
      headers: { 'x-forwarded-for': '198.51.100.21' },
      ip: `hunyuan-route-no-key-${process.pid}`,
      socket: { remoteAddress: '127.0.0.1' }
    }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['content-type'], 'application/json');
    assert.match(JSON.parse(res.body).error, /TENCENT_TOKENHUB_API_KEY/);
  } finally {
    restoreTokenHubEnvironment();
  }
});

test('Create UI describes the optional Tencent model and keeps the local fallback', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const start = html.indexOf('<input id="createAiMotion"');
  const end = html.indexOf('</div>', html.indexOf('TENCENT_TOKENHUB_API_KEY', start));
  assert.ok(start >= 0 && end > start, 'optional AI motion control should be present');
  const section = html.slice(start, end);
  assert.match(section, /HunyuanVideo 1\.5/);
  assert.match(section, /5 s em 720p/);
  assert.match(section, /Pode consumir créditos\/cota/);
  assert.match(section, /render atual/);
  assert.doesNotMatch(section, /Gemini Omni/i);
});
