const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('../vercel/api/create');

const savedFetch = global.fetch;
const savedEnv = {
  MONEYPRINTERTURBO_URL: process.env.MONEYPRINTERTURBO_URL,
  MONEYPRINTERTURBO_API_KEY: process.env.MONEYPRINTERTURBO_API_KEY
};

function restore() {
  global.fetch = savedFetch;
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function response() {
  return {
    headers: {}, statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };
}

test('MoneyPrinterTurbo is available directly in Create without first generating a local script', async () => {
  for (const file of ['../public/index.html', '../vercel/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(html, /moneyPrinterQuickBtn/);
    assert.match(html, /createWithMoneyPrinterTurboFromPrompt/);
    assert.match(html, /sem gerar roteiro nesta etapa/);
  }
});

test('Create has a Shorts preset that reuses the native renderer without requiring MoneyPrinterTurbo', () => {
  for (const file of ['../public/index.html', '../vercel/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(html, /nativeShortBtn/);
    assert.match(html, /createShortWithNativePipeline/);
    assert.match(html, /format\.value = '9:16'/);
    assert.match(html, /duration\.value = '0\.5'/);
    assert.match(html, /await createAndBuildVideo\(\)/);
    assert.match(html, /não precisa hospedar o backend do MoneyPrinterTurbo/);
  }
});

test('MoneyPrinterTurbo accepts a topic-only video request and keeps its API key server-side', async () => {
  process.env.MONEYPRINTERTURBO_URL = 'https://mpt.example.test/';
  process.env.MONEYPRINTERTURBO_API_KEY = 'unit-test-mpt-secret';
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, status: 200, json: async () => ({ task_id: 'task_123' }) };
  };
  try {
    const res = response();
    await handler({
      method: 'POST',
      body: { action: 'moneyprinter-create', subject: 'História sobre energia solar', script: '', aspect: '9:16' }
    }, res);
    assert.equal(res.statusCode, 202);
    assert.equal(request.url, 'https://mpt.example.test/api/v1/videos');
    assert.equal(request.options.headers['x-api-key'], 'unit-test-mpt-secret');
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.video_subject, 'História sobre energia solar');
    assert.equal(payload.video_aspect, '9:16');
    assert.equal(payload.video_source, 'pexels');
    assert.equal(payload.subtitle_enabled, true);
    assert.equal(Object.hasOwn(payload, 'video_script'), false);
    assert.doesNotMatch(res.body, /unit-test-mpt-secret/);
  } finally {
    restore();
  }
});

test('MoneyPrinterTurbo forwards a supplied script and rejects an empty topic', async () => {
  process.env.MONEYPRINTERTURBO_URL = 'https://mpt.example.test';
  delete process.env.MONEYPRINTERTURBO_API_KEY;
  let payload;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ task_id: 'task_456' }) };
  };
  try {
    const accepted = response();
    await handler({ method: 'POST', body: { action: 'moneyprinter-create', subject: 'Vídeo educativo', script: 'Roteiro pronto', aspect: '1:1' } }, accepted);
    assert.equal(accepted.statusCode, 202);
    assert.equal(payload.video_script, 'Roteiro pronto');
    assert.equal(payload.video_aspect, '1:1');

    const rejected = response();
    await handler({ method: 'POST', body: { action: 'moneyprinter-create', subject: '   ' } }, rejected);
    assert.equal(rejected.statusCode, 400);
    assert.match(JSON.parse(rejected.body).error, /tema do vídeo/);
  } finally {
    restore();
  }
});

test('MoneyPrinterTurbo returns a clear configuration error when its server URL is missing', async () => {
  delete process.env.MONEYPRINTERTURBO_URL;
  delete process.env.MONEYPRINTERTURBO_API_KEY;
  try {
    const res = response();
    await handler({ method: 'POST', body: { action: 'moneyprinter-create', subject: 'Teste' } }, res);
    assert.equal(res.statusCode, 503);
    assert.match(JSON.parse(res.body).error, /MONEYPRINTERTURBO_URL/);
  } finally {
    restore();
  }
});

test('Create offers strict Cohere mode and never silently falls back when it is selected', () => {
  for (const file of ['../public/index.html', '../vercel/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(html, /value="cohere-command-a:strict"/);
  }
  const ai = fs.readFileSync(path.join(__dirname, '../vercel/api/lib/ai.js'), 'utf8');
  assert.match(ai, /strictPreferred: true/);
  assert.match(ai, /orderedModels = cleanPref \? \[cleanPref\] : \[\]/);
  assert.match(ai, /if \(r\.error && strictCohere\)/);
  const route = fs.readFileSync(path.join(__dirname, '../vercel/api/create.js'), 'utf8');
  assert.match(route, /if \(aiModel === 'cohere-command-a:strict'\)/);
});
