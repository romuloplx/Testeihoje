const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

test('ethical security utilities are available in both app deployments', () => {
  assert.equal(html, fs.readFileSync(path.join(root, 'vercel/index.html'), 'utf8'));
  for (const id of ['security-tools', 'secPassOutput', 'secBaseInput', 'secHashInput', 'secJwtInput', 'secUrlInput', 'secJsonInput', 'secFileInput', 'androidMinerPool', 'androidMinerWallet', 'androidMinerConfigOutput']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const fn of ['generateSecurePassword', 'transformBase64', 'calculateSha256', 'decodeJwtPayload', 'inspectSecurityUrl', 'formatSecurityJson', 'transformUrlComponent', 'calculateFileSha256', 'buildAndroidMinerConfig', 'downloadAndroidMinerConfig']) {
    assert.match(html, new RegExp(`function ${fn}\\(`));
  }
});

test('security tools clearly disclaim token verification and remote scans', () => {
  assert.match(html, /Não valida assinatura, emissor, audiência ou expiração/);
  assert.match(html, /não fazem varredura de redes/);
  assert.match(html, /URL analisada localmente\. O endereço não foi acessado\./);
  assert.match(html, /sem enviá-lo/);
  assert.match(html, /CyberChef \(GCHQ, Apache-2\.0\)/);
  assert.match(html, /não inicia mineração/);
  assert.match(html, /XMRig oficial \(GPL-3\.0\)/);
  assert.match(html, /github\.com\/termux\/termux-app/);
  assert.match(html, /nem envia dados/);
});
