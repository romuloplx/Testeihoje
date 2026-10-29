#!/usr/bin/env node
'use strict';

// Bounded autonomous maintenance: the model may propose one unified diff, but only
// this script applies it, restricts touched files, and leaves test/push decisions
// to the fixed GitHub Actions workflow.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const MAX_CONTEXT_CHARS = 12_000;
const MAX_FILE_CHARS = 6_000;
const MAX_PATCH_CHARS = 18_000;
const ALLOWED = /^(public|vercel\/api|tests)\/[A-Za-z0-9_./-]+\.(?:html|js|css)$/;
const BLOCKED = /(^|\/)(?:\.env[^/]*|node_modules|\.git|\.github|secrets?)(\/|$)|(?:package(?:-lock)?\.json|vercel\.json)$/i;

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean)
    .filter(file => ALLOWED.test(file) && !BLOCKED.test(file))
    .filter(file => fs.existsSync(file) && fs.statSync(file).isFile());
}

function buildContext(files) {
  const chunks = [];
  let used = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    if (!original || /(?:^|\n)\s*(?:OPENAI|GEMINI|UNOROUTER|OPENROUTER)_API_KEY\s*=/.test(original)) continue;
    const remaining = MAX_CONTEXT_CHARS - used;
    if (remaining < 1200) break;
    const limit = Math.min(MAX_FILE_CHARS, remaining);
    let excerpt = original;
    if (excerpt.length > limit) {
      // Include representative beginning and end for large entrypoints; never send secrets/config files.
      const side = Math.floor((limit - 180) / 2);
      excerpt = `${excerpt.slice(0, side)}\n/* [trecho intermediário omitido para limitar contexto] */\n${excerpt.slice(-side)}`;
    }
    chunks.push(`### ${file}\n\n\`\`\`text\n${excerpt}\n\`\`\``);
    used += excerpt.length;
  }
  return chunks.join('\n\n');
}

function parseModelResponse(text) {
  const clean = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
  let result;
  try { result = JSON.parse(clean); } catch (_) {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('A IA não retornou JSON válido.');
    result = JSON.parse(clean.slice(start, end + 1));
  }
  if (!result || typeof result !== 'object' || typeof result.patch !== 'string' || typeof result.summary !== 'string') {
    throw new Error('A IA não retornou os campos summary e patch esperados.');
  }
  return result;
}

async function requestImprovement(context) {
  const key = String(process.env.UNOROUTER_API_KEY || '').trim();
  const base = String(process.env.UNOROUTER_BASE_URL || 'https://api.unorouter.com/v1').replace(/\/+$/, '');
  const system = [
    'Você é o agente de manutenção do DubAI PRO. Faça UMA melhoria pequena, concreta e de baixo risco no código fornecido.',
    'Não invente dependências, serviços, credenciais, endpoints ou funcionalidades indisponíveis. Preserve comportamento existente e compatibilidade mobile.',
    'Nunca introduza telemetria pessoal, chamadas externas novas, segredos, credenciais, código ofuscado, eval, scripts de instalação ou mudanças de segurança/autenticação.',
    'Se não encontrar melhoria segura e comprovável, retorne patch vazio. Não faça reformatação em massa.',
          'Retorne APENAS JSON: {"summary":"resumo curto em português","patch":"diff unificado git aplicável"}. O diff deve conter apenas arquivos permitidos do contexto e no máximo 250 linhas.'
  ].join(' ');
  const user = `Repositório DubAI PRO. Branch de destino: ${process.env.TARGET_BRANCH || 'arena/2cf1868f-testeihoje'}.\n\nArquivos disponíveis (trechos):\n${context}`;

  // Prefer the configured Cohere route; if GitHub Actions has no router secret,
  // use the same unauthenticated text API already present in the application.
  const providers = key
    ? [{ name: 'Unorouter/Cohere', url: `${base}/chat/completions`, models: ['cohere-command-a:free'], headers: { Authorization: `Bearer ${key}`, 'x-api-key': key, 'Content-Type': 'application/json' } }]
    : [{ name: 'Pollinations', url: 'https://text.pollinations.ai/openai', models: ['deepseek', 'mistral', 'llama'], headers: { 'Content-Type': 'application/json' } }];
  const errors = [];
  for (const provider of providers) {
    for (const model of provider.models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(provider.url, {
            method: 'POST',
            headers: { ...provider.headers, 'User-Agent': 'Mozilla/5.0 DubAI-PRO-AI-Maintainer/1.0' },
            body: JSON.stringify({
              model,
              temperature: 0.15,
              max_tokens: 4000,
              jsonMode: true,
              response_format: { type: 'json_object' },
              messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
            }),
            signal: AbortSignal.timeout(45_000)
          });
          const raw = await response.text().catch(() => '');
          let body = {};
          try { body = JSON.parse(raw); } catch (_) {}
          if (!response.ok) {
            const detail = String(body.error?.message || body.message || raw).slice(0, 220);
            if ((response.status === 402 || response.status === 429 || response.status === 503) && attempt < 2) {
              const quotaWindow = Number((detail.match(/every (\d+) seconds/i) || [])[1]) || 0;
              const retryHint = Number((detail.match(/retry after (\d+)/i) || [])[1]) || 2;
              const waitMs = Math.max(quotaWindow * 1000 + 1500, retryHint * 1000 + 1500);
              await new Promise(resolve => setTimeout(resolve, Math.min(35_000, waitMs)));
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${detail}`);
          }
          const text = body.choices?.[0]?.message?.content || raw.trim();
          if (!text) throw new Error('resposta vazia');
          return parseModelResponse(text);
        } catch (error) {
          errors.push(`${provider.name}/${model}: ${String(error.message || error).slice(0, 220)}`);
          break;
        }
      }
    }
  }
  throw new Error(errors.join(' | ') || 'nenhum provedor de IA respondeu');
}

function applyPatch(patch) {
  if (!patch.trim()) return false;
  if (patch.length > MAX_PATCH_CHARS) throw new Error('Patch excedeu o limite de tamanho permitido.');
  if (/\b(?:\.env|\.github|package(?:-lock)?\.json|vercel\.json|node_modules|\.git)\b/i.test(patch)) {
    throw new Error('Patch tentou alterar configuração, dependências ou credenciais bloqueadas.');
  }
  execFileSync('git', ['apply', '--check', '--whitespace=error', '-'], { input: patch, stdio: ['pipe', 'pipe', 'pipe'] });
  execFileSync('git', ['apply', '--whitespace=error', '-'], { input: patch, stdio: ['pipe', 'pipe', 'pipe'] });
  const changed = git(['diff', '--name-only']).trim().split('\n').filter(Boolean);
  if (!changed.length || changed.some(file => !ALLOWED.test(file) || BLOCKED.test(file))) {
    git(['checkout', '--', '.']);
    throw new Error(`O patch incluiu caminhos não permitidos: ${changed.join(', ')}`);
  }
  const stat = git(['diff', '--numstat']).trim().split('\n').filter(Boolean);
  const changedLines = stat.reduce((sum, line) => sum + line.split('\t').slice(0, 2).reduce((n, part) => n + (Number(part) || 0), 0), 0);
  if (changedLines > 500) {
    git(['checkout', '--', '.']);
    throw new Error('Patch grande demais (>500 linhas); alteração descartada.');
  }
  return true;
}

(async () => {
  const files = trackedFiles();
  const context = buildContext(files);
  if (!context) throw new Error('Não encontrei arquivos de código permitidos para analisar.');
  const proposal = await requestImprovement(context);
  console.log(`AI_MAINTENANCE_SUMMARY=${proposal.summary.replace(/[\r\n]+/g, ' ').slice(0, 300)}`);
  if (!proposal.patch.trim()) {
    console.log('AI_MAINTENANCE_NO_CHANGE=true');
    return;
  }
  if (applyPatch(proposal.patch)) console.log('AI_MAINTENANCE_PATCH_APPLIED=true');
})().catch(error => {
  const key = String(process.env.UNOROUTER_API_KEY || '').trim();
  let message = String(error.message || error);
  if (key) message = message.replaceAll(key, '[redacted]');
  message = message.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 1000);
  console.error(`AI maintenance stopped safely: ${message}`);
  console.log(`::error title=AI maintainer stopped safely::${message.replace(/[\r\n]/g, ' ')}`);
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try { fs.appendFileSync(summaryFile, `## AI maintainer stopped safely\n\n${message}\n`); } catch (_) {}
  }
  process.exitCode = 1;
});
