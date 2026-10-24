const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  lookupIceAndFireCharacters
} = require('../vercel/api/lib/ai');

const savedFetch = global.fetch;

function restoreFetch(){
  global.fetch = savedFetch;
}

function jsonResponse(status, payload){
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

const jonSnow = {
  url: 'https://anapioficeandfire.com/api/characters/583',
  name: 'Jon Snow',
  gender: 'Male',
  culture: 'Northmen',
  born: 'In 283 AC',
  died: '',
  titles: ['Lord Commander of the Night\'s Watch'],
  aliases: ['Lord Snow', 'Ned Stark\'s Bastard'],
  tvSeries: ['Season 1', 'Season 2'],
  playedBy: ['Kit Harington'],
  allegiances: ['https://anapioficeandfire.com/api/houses/362']
};

test('character lookup searches names through the fixed Ice and Fire API host', async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return jsonResponse(200, [jonSnow]);
  };
  try {
    const result = await lookupIceAndFireCharacters({ query: 'Jon Snow' });
    const parsedUrl = new URL(request.url);
    assert.equal(parsedUrl.origin, 'https://anapioficeandfire.com');
    assert.equal(parsedUrl.pathname, '/api/characters');
    assert.equal(parsedUrl.searchParams.get('name'), 'Jon Snow');
    assert.equal(parsedUrl.searchParams.get('pageSize'), '10');
    assert.equal(request.options.headers.Accept, 'application/json');
    assert.equal(result.results.length, 1);
    assert.deepEqual(result.results[0], {
      id: '583', name: 'Jon Snow', gender: 'Male', culture: 'Northmen', born: 'In 283 AC', died: '',
      titles: ['Lord Commander of the Night\'s Watch'],
      aliases: ['Lord Snow', 'Ned Stark\'s Bastard'],
      tvSeries: ['Season 1', 'Season 2'],
      playedBy: ['Kit Harington']
    });
    assert.equal(Object.hasOwn(result.results[0], 'allegiances'), false, 'do not pass raw relationship URLs through to the client');
  } finally {
    restoreFetch();
  }
});

test('character lookup accepts a numeric ID or a same-host character URL', async t => {
  await t.test('numeric ID', async () => {
    let requestUrl = '';
    global.fetch = async url => { requestUrl = String(url); return jsonResponse(200, jonSnow); };
    try {
      const result = await lookupIceAndFireCharacters({ query: '583' });
      assert.equal(requestUrl, 'https://anapioficeandfire.com/api/characters/583');
      assert.equal(result.results[0].name, 'Jon Snow');
    } finally {
      restoreFetch();
    }
  });

  await t.test('same-host URL', async () => {
    let requestUrl = '';
    global.fetch = async url => { requestUrl = String(url); return jsonResponse(200, jonSnow); };
    try {
      const result = await lookupIceAndFireCharacters({ query: 'https://anapioficeandfire.com/api/characters/583' });
      assert.equal(requestUrl, 'https://anapioficeandfire.com/api/characters/583');
      assert.equal(result.results[0].id, '583');
    } finally {
      restoreFetch();
    }
  });
});

test('character lookup rejects arbitrary URLs and invalid input before making a request', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not fetch'); };
  try {
    await assert.rejects(
      lookupIceAndFireCharacters({ query: 'https://example.com/api/characters/583' }),
      error => error.status === 400 && /Use o nome do personagem/.test(error.message)
    );
    await assert.rejects(
      lookupIceAndFireCharacters({ query: '' }),
      error => error.status === 400 && /Digite o nome/.test(error.message)
    );
    assert.equal(called, false);
  } finally {
    restoreFetch();
  }
});

test('character lookup limits results and treats an empty API result as no matches', async t => {
  await t.test('limits the number of results', async () => {
    global.fetch = async () => jsonResponse(200, Array.from({ length: 15 }, (_, index) => ({ ...jonSnow, name: `Character ${index + 1}` })));
    try {
      const result = await lookupIceAndFireCharacters({ query: 'Character' });
      assert.equal(result.results.length, 10);
      assert.equal(result.results[0].name, 'Character 1');
    } finally {
      restoreFetch();
    }
  });

  await t.test('empty results', async () => {
    global.fetch = async () => jsonResponse(200, []);
    try {
      assert.deepEqual(await lookupIceAndFireCharacters({ query: 'missing character' }), { results: [] });
    } finally {
      restoreFetch();
    }
  });
});

test('Vercel Create route exposes the character lookup through its existing function', async () => {
  const handler = require('../vercel/api/create');
  global.fetch = async () => jsonResponse(200, [jonSnow]);
  const res = {
    headers: {}, statusCode: 0,
    setHeader(name, value){ this.headers[name.toLowerCase()] = value; },
    end(body){ this.body = body; }
  };
  try {
    await handler({
      method: 'POST',
      body: { action: 'character-lookup', query: 'Jon Snow' },
      headers: {},
      ip: '198.51.100.22',
      socket: { remoteAddress: '127.0.0.1' }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.equal(res.headers['cache-control'], 'no-store, private');
    assert.equal(JSON.parse(res.body).results[0].name, 'Jon Snow');
  } finally {
    restoreFetch();
  }
});

test('Create UI offers safe character search and populates the cast input', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(html, /id="iceFireCharacterQuery"/);
  assert.match(html, /id="iceFireCharacterResults"/);
  assert.match(html, /action: 'character-lookup'/);
  assert.match(html, /function useIceAndFireCharacter\(/);
  assert.match(html, /createCharactersInput/);
  assert.match(html, /não gera imagens nem vídeos por si só/i);
});
