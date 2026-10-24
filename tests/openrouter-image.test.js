const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generateSceneImage } = require('../vercel/api/lib/ai');

const savedFetch = global.fetch;
const savedEnv = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  UNOROUTER_API_KEY: process.env.UNOROUTER_API_KEY
};

function configureOpenRouter(key = 'unit-test-openrouter-key') {
  process.env.OPENROUTER_API_KEY = key;
  process.env.OPENAI_API_KEY = '';
  process.env.GEMINI_API_KEY = '';
  process.env.UNOROUTER_API_KEY = '';
}

function restoreEnvironment() {
  global.fetch = savedFetch;
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function imageResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function makeImagePayload(cost = 0.02) {
  return {
    data: [{ b64_json: Buffer.alloc(1024, 0x61).toString('base64'), media_type: 'image/jpeg' }],
    usage: { cost }
  };
}

test('OpenRouter FLUX.2 Pro is used first for video scene images and keeps its key server-side', async t => {
  for (const [width, height, expectedRatio] of [[896, 504, '16:9'], [576, 1024, '9:16'], [768, 768, '1:1']]) {
    await t.test(`${expectedRatio} output ratio`, async () => {
      configureOpenRouter();
      const calls = [];
      global.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        return imageResponse(200, makeImagePayload());
      };
      try {
        const result = await generateSceneImage({
          prompt: 'Uma viajante atravessa uma floresta ao amanhecer.',
          style: 'cinematic', width, height
        });
        assert.equal(calls.length, 1, 'OpenRouter should be the first successful provider');
        assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/images');
        assert.equal(calls[0].options.method, 'POST');
        assert.equal(calls[0].options.headers.Authorization, 'Bearer unit-test-openrouter-key');
        assert.equal(calls[0].url.includes('unit-test-openrouter-key'), false);
        assert.equal(calls[0].options.body.includes('unit-test-openrouter-key'), false);
        const request = JSON.parse(calls[0].options.body);
        assert.equal(request.model, 'black-forest-labs/flux.2-pro');
        assert.equal(request.n, 1);
        assert.equal(request.aspect_ratio, expectedRatio);
        assert.equal(request.output_format, 'jpeg');
        assert.match(request.prompt, /Uma viajante atravessa uma floresta/);
        assert.equal(result.model, 'openrouter/black-forest-labs/flux.2-pro');
        assert.equal(result.mime, 'image/jpeg');
        assert.equal(result.imageBase64, makeImagePayload().data[0].b64_json);
        assert.equal(result.costUsd, 0.02);
      } finally {
        restoreEnvironment();
      }
    });
  }
});

test('OpenRouter uses sanitized character portraits as visual identity references', async () => {
  configureOpenRouter();
  const portrait = `data:image/jpeg;base64,${Buffer.alloc(300, 0x62).toString('base64')}`;
  let requestBody;
  global.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(options.body);
    return imageResponse(200, makeImagePayload());
  };
  try {
    await generateSceneImage({
      prompt: 'A menina e o inventor exploram um observatório antigo.',
      style: 'animation', width: 896, height: 504,
      references: [
        { name: 'Luna', dataUrl: portrait },
        { name: 'URL externa deve ser ignorada', dataUrl: 'https://attacker.example/portrait.jpg' }
      ]
    });
    assert.equal(requestBody.input_references.length, 1);
    assert.equal(requestBody.input_references[0].type, 'image_url');
    assert.equal(requestBody.input_references[0].image_url.url, portrait);
    assert.match(requestBody.prompt, /Luna/);
    assert.match(requestBody.prompt, /identity anchors/);
    assert.match(requestBody.prompt, /animated feature film/);
    assert.doesNotMatch(JSON.stringify(requestBody), /attacker\.example/);
  } finally {
    restoreEnvironment();
  }
});

test('OpenRouter image errors never expose the configured key', async () => {
  const key = 'unit-test-openrouter-key';
  configureOpenRouter(key);
  const urls = [];
  global.fetch = async url => {
    const address = String(url);
    urls.push(address);
    if (address === 'https://openrouter.ai/api/v1/images') {
      return imageResponse(401, { error: { message: `Invalid credential ${key}` } });
    }
    return { ok: false, status: 503 };
  };
  try {
    const result = await generateSceneImage({ prompt: 'Cena de teste', width: 896, height: 504 });
    assert.equal(result.imageBase64, undefined);
    assert.match(result.error, /openrouter\/black-forest-labs\/flux\.2-pro: HTTP 401/);
    assert.doesNotMatch(result.error, new RegExp(key));
    assert.equal(urls[0], 'https://openrouter.ai/api/v1/images');
  } finally {
    restoreEnvironment();
  }
});

test('scene-image GET exposes only whether the OpenRouter image key is configured', async () => {
  const handler = require('../vercel/api/scene-image');
  const key = 'unit-test-openrouter-key';
  configureOpenRouter(key);
  const res = {
    headers: {}, statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };
  try {
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['cache-control'], 'no-store, private');
    assert.deepEqual(JSON.parse(res.body), { openrouterImageConfigured: true });
    assert.doesNotMatch(res.body, new RegExp(key));
  } finally {
    restoreEnvironment();
  }
});

test('scene-image POST forwards approved portrait references and reports the billed amount', async () => {
  const handler = require('../vercel/api/scene-image');
  configureOpenRouter();
  const portrait = `data:image/jpeg;base64,${Buffer.alloc(300, 0x63).toString('base64')}`;
  let requestBody;
  global.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(options.body);
    return imageResponse(200, makeImagePayload(0.037));
  };
  const res = {
    headers: {}, statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };
  try {
    await handler({
      method: 'POST',
      body: {
        prompt: 'Luna encontra um mapa nas ruínas.', style: 'cinematic', width: 896, height: 504,
        references: [{ name: 'Luna', dataUrl: portrait }]
      }
    }, res);
    const responseBody = JSON.parse(res.body);
    assert.equal(res.statusCode, 200);
    assert.equal(requestBody.input_references.length, 1);
    assert.equal(responseBody.model, 'openrouter/black-forest-labs/flux.2-pro');
    assert.equal(responseBody.costUsd, 0.037);
    assert.equal(responseBody.imageBase64, makeImagePayload(0.037).data[0].b64_json);
  } finally {
    restoreEnvironment();
  }
});

test('Create uses AI character portraits to anchor scene identity and displays actual image cost', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(html, /hasConfiguredOpenRouterSceneImages\(\)/);
  assert.match(html, /buildSceneCharacterReferences\(actors\)/);
  assert.match(html, /hasAiPortrait: isAi/);
  assert.match(html, /references: openRouterEnabled \? characterReferences : \[\]/);
  assert.match(html, /id="createUseCharacterReferences" type="checkbox" checked/);
  assert.match(html, /const useSceneIdentityReferences = !referenceToggle \|\| referenceToggle\.checked/);
  assert.match(html, /FLUX\.2 Pro via OpenRouter/);
  assert.match(html, /OPENROUTER_API_KEY/);
  assert.match(html, /_createOpenRouterImageSpendUsd/);
  assert.match(html, /Desmarque para não enviar referências e reduzir custos/);
  assert.match(html, /o custo informado aparece ao final do vídeo/);
});
