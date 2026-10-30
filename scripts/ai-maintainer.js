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

function textModelIds(payload) {
  const list = Array.isArray(payload) ? payload : (payload && (payload.models || payload.data || payload.items)) || [];
  const ids = list.map(item => typeof item === 'string' ? item : String(item && (item.id || item.name || item.model) || '')).filter(Boolean);
  const textOnly = ids.filter(id => !/(image|vision|tts|audio|video|embedding|diffusion)/i.test(id));
  const preferred = ['openai', 'openai-fast', 'gemini', 'mistral', 'searchgpt'];
  return [...preferred.filter(id => textOnly.includes(id)), ...textOnly.filter(id => !preferred.includes(id))].slice(0, 5);
}

async function requestImprovement(context) {
  const key = String(process.env.UNOROUTER_API_KEY || '').trim();
  const base = String(process.env.UNOROUTER_BASE_URL || 'https://api.unorouter.com/v1').replace(/\/+$/, '');
  const system = [
    'Você é o agente de manutenção do DubAI PRO. Faça UMA melhoria pequena, concreta e de baixo risco no código fornecido.',
    'Não invente dependências, serviços, credenciais, endpoints ou funcionalidades indisponíveis. Preserve comportamento existente e compatibilidade mobile.',
    'Nunca introduza telemetria pessoal, chamadas externas novas, segredos, credenciais, código ofuscado, eval, scripts de instalação ou mudanças de segurança/autenticação.',
    'Se não encontrar melhoria segura e comprovável, retorne patch vazio. Não faça reformatação em massa.',
          'Retorne APENAS JSON: {"summary":"resumo curto em português","patch":"diff unificado git aplicável"}. O campo patch precisa conter cabeçalhos diff --git a/ARQUIVO b/ARQUIVO e hunks @@ padrão, com quebras de linha reais; não escreva instruções no lugar de um diff. Use apenas arquivos permitidos do contexto e no máximo 250 linhas.'
  ].join(' ');
  const user = `Repositório DubAI PRO. Branch de destino: ${process.env.TARGET_BRANCH || 'arena/2cf1868f-testeihoje'}.\n\nArquivos disponíveis (trechos):\n${context}`;

  // Paid fallback is explicitly authorized by the project owner; it is first because
  // Unorouter itself recommends this model when the free DeepSeek tier is rate-limited.
  const paidFallbackModels = ['deepseek-r1-distill-qwen-32b'];
  const staticFreeModels = ['cohere-command-a:free', 'agnes-2.5-flash:free', 'deepseek-r1-distill-qwen-32b:free', 'gemini-3.1-flash-lite:free'];
  let routerModels = [...paidFallbackModels, ...staticFreeModels];
  if (key) {
    try {
      const catalog = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${key}`, 'x-api-key': key },
        signal: AbortSignal.timeout(12000)
      });
      if (catalog.ok) {
        const data = await catalog.json();
        const discovered = (Array.isArray(data.data) ? data.data : [])
          .map(item => String(item && item.id || '').trim())
          .filter(id => /^[A-Za-z0-9._:/+-]{1,160}$/.test(id) && /:free$/i.test(id)
            && !/(image|vision|tts|audio|whisper|embedding|video|diffusion|sdxl|flux|veo|kling)/i.test(id));
        routerModels = [...new Set([...paidFallbackModels, ...staticFreeModels, ...discovered])].slice(0, 10);
      }
    } catch (error) {
      console.warn(`Unorouter model catalog unavailable; using known free candidates: ${String(error.message || error).slice(0, 120)}`);
    }
  }
  const providers = key
    ? [{ name: 'Unorouter', url: `${base}/chat/completions`, models: routerModels, includeModel: true, headers: { Authorization: `Bearer ${key}`, 'x-api-key': key, 'Content-Type': 'application/json' } }]
    : [{ name: 'Pollinations', url: 'https://text.pollinations.ai/openai', models: [], includeModel: true, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 DubAI-PRO-AI-Maintainer/1.0' } }];
  if (!key) {
    try {
      const modelResponse = await fetch('https://text.pollinations.ai/models', { signal: AbortSignal.timeout(12000) });
      if (modelResponse.ok) providers[0].models = textModelIds(await modelResponse.json());
      if (!providers[0].models.length) providers[0].models = ['openai'];
    } catch (_) { providers[0].models = ['openai']; }
  }
  const errors = [];
  for (const provider of providers) {
    for (const model of provider.models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const payload = {
            temperature: 0.15,
            max_tokens: 4000,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
          };
          if (provider.includeModel) payload.model = model;
          if (provider.includeModel) {
            payload.jsonMode = true;
            payload.response_format = { type: 'json_object' };
          }
          const response = await fetch(provider.url, {
            method: 'POST',
            headers: provider.headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(45_000)
          });
          const raw = await response.text().catch(() => '');
          let body = {};
          try { body = JSON.parse(raw); } catch (_) {}
          if (!response.ok) {
            const detail = String(body.error?.message || body.message || raw).slice(0, 220);
            const providerBusy = response.status === 503 && /all providers.*busy|hit their rate limit/i.test(detail);
            if (providerBusy) throw new Error(`HTTP ${response.status}: ${detail}`);
            if ((response.status === 402 || response.status === 429 || response.status === 503) && attempt < 1) {
              const retryMatch = detail.match(/retry (?:after|in) (\d+)\s*(s|sec|seconds?|m|min|minutes?)?/i);
              const retryValue = Number((retryMatch || [])[1]) || 0;
              const retryUnit = String((retryMatch || [])[2] || 's').toLowerCase();
              const retryHintMs = retryValue * (/^m|min|minute/.test(retryUnit) ? 60_000 : 1000);
              const windowMatch = detail.match(/every (\d+)\s*(seconds?|minutes?)/i);
              const quotaWindowMs = windowMatch
                ? Number(windowMatch[1]) * (/^minute/i.test(windowMatch[2]) ? 60_000 : 1000)
                : 0;
              const waitMs = response.status === 503
                ? Math.max(6000, retryHintMs)
                : Math.max(2500, retryHintMs + 1500, quotaWindowMs + 1500);
              await new Promise(resolve => setTimeout(resolve, Math.min(90_000, waitMs)));
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
  let normalized = patch.trim()
    .replace(/^```(?:diff|patch)?\s*/i, '')
    .replace(/\s*```\s*$/, '');
  if (!normalized.includes('\n') && /\\n/.test(normalized)) normalized = normalized.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  const diffStart = normalized.search(/(?:^diff --git |^--- a\/)/m);
  if (diffStart > 0) normalized = normalized.slice(diffStart);
  if (!/^diff --git |^--- a\//m.test(normalized)) {
    throw new Error(`A IA não retornou um diff Git padrão. Trecho recebido: ${normalized.slice(0, 240).replace(/[\r\n]+/g, ' ')}`);
  }
  if (/\b(?:\.env|\.github|package(?:-lock)?\.json|vercel\.json|node_modules|\.git)\b/i.test(normalized)) {
    throw new Error('Patch tentou alterar configuração, dependências ou credenciais bloqueadas.');
  }
  try {
    execFileSync('git', ['apply', '--check', '--whitespace=error', '-'], { input: normalized, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw new Error(`Patch Git inválido: ${String(error.stderr || error.message || error).slice(0, 300)} Trecho: ${normalized.slice(0, 240).replace(/[\r\n]+/g, ' ')}`);
  }
  execFileSync('git', ['apply', '--whitespace=error', '-'], { input: normalized, stdio: ['pipe', 'pipe', 'pipe'] });
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
