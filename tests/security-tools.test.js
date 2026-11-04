const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

test('ethical security utilities are available in both app deployments', () => {
  assert.equal(html, fs.readFileSync(path.join(root, 'vercel/index.html'), 'utf8'));
  for (const id of ['security-tools', 'secPassOutput', 'wifiPasswordOutput', 'wifiChecklistStatus', 'wifiCheckEncryption', 'wifiCheckWps', 'wifiCheckAdminPassword', 'wifiCheckFirmware', 'wifiCheckRemoteAdmin', 'secBaseInput', 'secHashInput', 'secJwtInput', 'secUrlInput', 'secJsonInput', 'secFileInput', 'androidMinerPool', 'androidMinerWallet', 'androidMinerConfigOutput']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const fn of ['generateSecurePassword', 'generateWifiPassword', 'summarizeWifiChecklist', 'transformBase64', 'calculateSha256', 'decodeJwtPayload', 'inspectSecurityUrl', 'formatSecurityJson', 'transformUrlComponent', 'calculateFileSha256', 'buildAndroidMinerConfig', 'downloadAndroidMinerConfig', 'makeAndroidMinerSetupScript', 'downloadAndroidMinerSetupScript', 'copyAndroidMinerRunCommand']) {
    assert.match(html, new RegExp(`function ${fn}\\(`));
  }
});

test('Wi-Fi helper creates a local strong password and summarizes only the manual router checklist', () => {
  const ids = ['wifiPasswordLength', 'wifiPasswordOutput', 'wifiPasswordStatus', 'wifiChecklistStatus', 'wifiCheckEncryption', 'wifiCheckWps', 'wifiCheckAdminPassword', 'wifiCheckFirmware', 'wifiCheckRemoteAdmin'];
  const elements = Object.fromEntries(ids.map(id => [id, { value: id === 'wifiPasswordLength' ? '24' : '', checked: id === 'wifiCheckEncryption' || id === 'wifiCheckFirmware' }]));
  const statuses = {};
  const start = html.indexOf('function generateWifiPassword(');
  const end = html.indexOf('async function copySecurityValue(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = {
    document: { getElementById: id => elements[id] },
    secureRandomIndex: max => max - 1,
    setSecurityStatus: (id, message, kind) => { statuses[id] = { message, kind }; }
  };
  vm.runInNewContext(html.slice(start, end), context);
  context.generateWifiPassword();
  assert.equal(elements.wifiPasswordOutput.value.length, 24);
  assert.match(elements.wifiPasswordOutput.value, /^[A-Za-z0-9!@#$%*\\-_+=]+$/);
  assert.equal(statuses.wifiPasswordStatus.kind, 'success');
  context.summarizeWifiChecklist();
  assert.match(statuses.wifiChecklistStatus.message, /2 de 5 itens marcados/);
  assert.match(statuses.wifiChecklistStatus.message, /não verifica a rede automaticamente/);
  assert.match(html, /não escaneia redes Wi-Fi, não captura tráfego e não tenta descobrir, quebrar ou testar senhas/);
  assert.match(html, /não informe aqui uma senha Wi-Fi existente/);
});

test('security and mining helper make clear what stays local and what cannot run in the web page', () => {
  assert.match(html, /Não valida assinatura, emissor, audiência ou expiração/);
  assert.match(html, /não fazem varredura de redes/);
  assert.match(html, /URL analisada localmente\. O endereço não foi acessado\./);
  assert.match(html, /sem enviá-lo/);
  assert.match(html, /CyberChef \(GCHQ, Apache-2\.0\)/);
  assert.match(html, /não inicia mineração/);
  assert.match(html, /XMRig oficial \(GPL-3\.0\)/);
  assert.match(html, /value="pool\.supportxmr\.com:443"/);
  assert.match(html, /id="androidMinerTls" type="checkbox" checked/);
  assert.match(html, /nem envia dados/);
  assert.match(html, /navegador não pode executar comandos nativos do Termux/);
  assert.match(html, /termux-setup-storage/);
  assert.match(html, /Termux:Widget/);
  assert.match(html, /Baixar instalador \+ execução/);
  assert.match(html, /Copiar comando único do Termux/);
});

test('Android setup script generator creates a local XMRig config and a bounded one-command runner', () => {
  const elements = {
    androidMinerPool: { value: 'pool.supportxmr.com:443' },
    androidMinerWallet: { value: '4' + 'A'.repeat(94) },
    androidMinerThreads: { value: '2' },
    androidMinerTls: { checked: true },
    androidMinerConfigOutput: { value: '' },
    androidMinerCommandOutput: { value: '' }
  };
  const between = (startName, endName) => {
    const start = html.indexOf(`function ${startName}(`);
    const end = html.indexOf(`function ${endName}(`, start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    return html.slice(start, end);
  };
  const source = between('buildAndroidMinerConfig', 'downloadAndroidMinerConfig') + between('makeAndroidMinerSetupScript', 'triggerAndroidMinerScriptDownload');
  const context = {
    document: { getElementById: id => elements[id] },
    URL,
    btoa,
    setSecurityStatus() {}
  };
  vm.runInNewContext(source, context);
  assert.equal(context.buildAndroidMinerConfig(), true);
  const config = JSON.parse(elements.androidMinerConfigOutput.value);
  assert.equal(config.pools[0].url, 'pool.supportxmr.com:443');
  assert.equal(config.pools[0].tls, true);
  assert.equal(config.pools[0].user, elements.androidMinerWallet.value);
  const script = context.makeAndroidMinerSetupScript();
  assert.match(script, /git clone --depth 1 https:\/\/github\.com\/xmrig\/xmrig\.git/);
  assert.match(script, /cmake --build \. --parallel 2/);
  assert.match(script, /exec \.\/xmrig -c config\.json --threads=2/);
  assert.doesNotMatch(script, /curl[^\n]*\|\s*(bash|sh)/i);
});
