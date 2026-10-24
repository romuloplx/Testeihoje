const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  generateCreateSceneVideo,
  consumeGeminiOmniVideoRequest
} = require('../vercel/api/lib/ai');

const savedFetch = global.fetch;
const savedApiKey = process.env.GEMINI_API_KEY;
const savedBaseUrl = process.env.GEMINI_BASE_URL;

function restoreGeminiEnvironment(){
  global.fetch = savedFetch;
  if(savedApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedApiKey;
  if(savedBaseUrl === undefined) delete process.env.GEMINI_BASE_URL;
  else process.env.GEMINI_BASE_URL = savedBaseUrl;
}

function makeImageBase64(){
  return Buffer.alloc(180, 0x65).toString('base64');
}

function makeMp4Base64(){
  const mp4 = Buffer.alloc(2048, 0);
  mp4.writeUInt32BE(16, 0);
  mp4.write('ftyp', 4, 'ascii');
  return { mp4, base64: mp4.toString('base64') };
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

test('Gemini Omni image-to-video submits a reference image and returns a valid MP4 buffer', async () => {
  process.env.GEMINI_API_KEY = 'unit-test-gemini-key';
  process.env.GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const { mp4, base64 } = makeMp4Base64();
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'test-interaction',
        status: 'completed',
        steps: [{
          type: 'model_output',
          content: [{ type: 'video', mime_type: 'video/mp4', data: base64 }]
        }]
      })
    };
  };

  try {
    const result = await generateCreateSceneVideo({
      prompt: 'A menina atravessa uma floresta iluminada.',
      imageBase64: `data:image/jpeg;base64,${makeImageBase64()}`,
      imageMime: 'image/jpeg',
      stylePrompt: 'animação 3D cinematográfica',
      aspectRatio: '9:16',
      clientKey: `omni-success-${process.pid}`
    });

    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['x-goog-api-key'], 'unit-test-gemini-key');
    assert.equal(request.body.model, 'gemini-omni-1.1-flash');
    assert.equal(request.body.input[0].type, 'image');
    assert.equal(request.body.input[0].mime_type, 'image/jpeg');
    assert.equal(request.body.input[1].type, 'text');
    assert.equal(request.body.response_format.aspect_ratio, '9:16');
    assert.equal(request.body.response_format.resolution, '720p');
    assert.equal(request.body.generation_config.video_config.task, 'image_to_video');
    assert.equal(request.body.store, false);
    assert.deepEqual(result.buffer, mp4);
    assert.equal(result.mime, 'video/mp4');
    assert.equal(result.provider, 'gemini-omni-1.1-flash');
  } finally {
    restoreGeminiEnvironment();
  }
});

test('Gemini Omni accepts the SDK-style output_video.data response shape', async () => {
  process.env.GEMINI_API_KEY = 'unit-test-gemini-key';
  const { mp4, base64 } = makeMp4Base64();
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ status: 'completed', output_video: { mime_type: 'video/mp4', data: base64 } })
  });
  try {
    const result = await generateCreateSceneVideo({
      prompt: 'A câmera atravessa a paisagem.',
      imageBase64: makeImageBase64(),
      clientKey: `omni-output-video-${process.pid}`
    });
    assert.deepEqual(result.buffer, mp4);
    assert.equal(result.mime, 'video/mp4');
  } finally {
    restoreGeminiEnvironment();
  }
});

test('Gemini Omni video generation fails clearly when the server key is missing', async () => {
  delete process.env.GEMINI_API_KEY;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call provider'); };
  try {
    await assert.rejects(
      generateCreateSceneVideo({ prompt: 'teste', imageBase64: makeImageBase64(), clientKey: `omni-no-key-${process.pid}` }),
      error => error.status === 503 && /GEMINI_API_KEY/.test(error.message)
    );
    assert.equal(called, false);
  } finally {
    restoreGeminiEnvironment();
  }
});

test('Gemini Omni provider errors retain the HTTP status without exposing a key in the URL', async () => {
  process.env.GEMINI_API_KEY = 'unit-test-gemini-key';
  process.env.GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  let requestedUrl = '';
  global.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: 'model access not enabled' } })
    };
  };
  try {
    await assert.rejects(
      generateCreateSceneVideo({
        prompt: 'teste', imageBase64: makeImageBase64(), clientKey: `omni-forbidden-${process.pid}`
      }),
      error => error.status === 403 && /model access not enabled/.test(error.message)
    );
    assert.equal(requestedUrl, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(requestedUrl.includes('unit-test-gemini-key'), false);
  } finally {
    restoreGeminiEnvironment();
  }
});

test('Gemini Omni rejects a completed interaction that contains no usable MP4', async () => {
  process.env.GEMINI_API_KEY = 'unit-test-gemini-key';
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'sem vídeo' }] }] })
  });
  try {
    await assert.rejects(
      generateCreateSceneVideo({
        prompt: 'teste', imageBase64: makeImageBase64(), clientKey: `omni-empty-${process.pid}`
      }),
      error => error.status === 502 && /não devolveu um clipe concluído/.test(error.message)
    );
  } finally {
    restoreGeminiEnvironment();
  }
});

test('Gemini Omni clip rate limit allows a small project batch, then resets after its window', () => {
  const clientKey = `omni-rate-limit-${process.pid}-${Date.now()}`;
  const now = Date.now();
  for (let i = 0; i < 14; i++) {
    assert.equal(consumeGeminiOmniVideoRequest(clientKey, now).ok, true);
  }
  const blocked = consumeGeminiOmniVideoRequest(clientKey, now + 1);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(consumeGeminiOmniVideoRequest(clientKey, now + 60 * 60 * 1000 + 1).ok, true);
});

test('Vercel Create route streams Gemini scene clips as video/mp4', async () => {
  const handler = require('../vercel/api/create');
  process.env.GEMINI_API_KEY = 'unit-test-gemini-key';
  process.env.GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const { mp4, base64 } = makeMp4Base64();
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: base64 }] }]
    })
  });
  const res = {
    headers: {},
    statusCode: 0,
    chunks: [],
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
      ip: `omni-route-${process.pid}`,
      socket: { remoteAddress: '127.0.0.1' }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'video/mp4');
    assert.equal(res.headers['x-ai-video-provider'], 'gemini-omni-1.1-flash');
    assert.deepEqual(res.body, mp4);
  } finally {
    restoreGeminiEnvironment();
  }
});

test('Vercel Create route returns a clear 503 when Gemini Omni has no configured key', async () => {
  const handler = require('../vercel/api/create');
  delete process.env.GEMINI_API_KEY;
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
      ip: `omni-route-no-key-${process.pid}`,
      socket: { remoteAddress: '127.0.0.1' }
    }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['content-type'], 'application/json');
    assert.match(JSON.parse(res.body).error, /GEMINI_API_KEY/);
  } finally {
    restoreGeminiEnvironment();
  }
});
