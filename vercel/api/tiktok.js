const { send, chatWithFallback } = require('./lib/ai');

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({}); }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const TIKTOK_AUTH_BASE = 'https://open.tiktokapis.com/v2';

// Domínios oficiais permitidos da infraestrutura de upload do TikTok (proteção anti-SSRF estrita)
function isAllowedTikTokUploadUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ''));
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return (
      h.endsWith('.tiktokapis.com') ||
      h === 'open-upload.tiktokapis.com' ||
      h.endsWith('.tiktokv.com') ||
      h.endsWith('.tiktokcdn.com') ||
      h.endsWith('.byteoversea.com')
    );
  } catch {
    return false;
  }
}

// Regra oficial do TikTok Media Transfer Guide (2026):
// - Arquivos < 10 MB: 1 único chunk com chunk_size === video_size
// - Arquivos >= 10 MB: chunks de 10 MiB, total_chunk_count = Math.floor(video_size / chunk_size),
//   onde o último chunk absorve os bytes restantes (entre 10 MiB e < 20 MiB, dentro do limite <= 128 MB)
function computeTikTokChunkPlan(videoSize) {
  const size = Math.max(1, Math.floor(Number(videoSize) || 0));
  const TEN_MB = 10 * 1024 * 1024;
  if (size < TEN_MB) {
    return {
      video_size: size,
      chunk_size: size,
      total_chunk_count: 1
    };
  }
  const chunkSize = TEN_MB;
  const totalChunks = Math.max(1, Math.floor(size / chunkSize));
  return {
    video_size: size,
    chunk_size: chunkSize,
    total_chunk_count: totalChunks
  };
}

async function tiktokJsonFetch(url, options = {}, timeoutMs = 25000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: ac.signal });
    const text = await resp.text();
    let json = {};
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
    return { status: resp.status, ok: resp.ok, json };
  } finally {
    clearTimeout(timer);
  }
}

function readRawBuffer(req, maxBytes = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) return resolve(req.body);
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Chunk acima do limite de relay serverless; use upload direto ao TikTok.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function renderOAuthCallbackPage(req) {
  const urlObj = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const code = urlObj.searchParams.get('code') || '';
  const state = urlObj.searchParams.get('state') || '';
  const err = urlObj.searchParams.get('error') || '';
  const errDesc = urlObj.searchParams.get('error_description') || '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DubAI PRO • Conexão TikTok</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090b16;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;padding:20px}
  .box{max-width:440px;width:100%;background:#11152b;border:1px solid #312e81;border-radius:16px;padding:24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.5)}
  .btn{margin-top:16px;padding:12px 20px;border:none;border-radius:10px;background:linear-gradient(135deg,#ec4899,#8b5cf6,#06b6d4);color:#fff;font-weight:800;cursor:pointer;font-size:14px}
</style>
</head>
<body>
  <div class="box">
    <div style="font-size:36px;margin-bottom:8px">🎵</div>
    <h2 id="ttl" style="margin:0 0 8px;font-size:18px"> Finalizando conexão com o TikTok...</h2>
    <p id="msg" style="margin:0;font-size:13.5px;color:#cbd5e1;line-height:1.6">Validando chave segura OAuth 2.0 PKCE...</p>
    <button class="btn" onclick="goBack()">Voltar para o DubAI PRO</button>
  </div>
<script>
const CODE = ${JSON.stringify(code)};
const STATE = ${JSON.stringify(state)};
const OAUTH_ERR = ${JSON.stringify(err)};
const OAUTH_ERR_DESC = ${JSON.stringify(errDesc)};

function goBack(){
  if(window.opener && !window.opener.closed){ window.close(); return; }
  window.location.href = '/#tiktok';
}

(async () => {
  const ttl = document.getElementById('ttl');
  const msg = document.getElementById('msg');
  if(OAUTH_ERR){
    ttl.textContent = '⚠️ Autorização cancelada ou recusada';
    msg.textContent = OAUTH_ERR_DESC || OAUTH_ERR;
    return;
  }
  if(!CODE){
    ttl.textContent = '✅ Endpoint de Callback TikTok Ativo!';
    msg.textContent = 'Esta URL (' + window.location.origin + '/api/tiktok) está pronta para ser colada no Redirect URI do TikTok Developer Portal.';
    return;
  }
  try{
    const savedCfg = JSON.parse(localStorage.getItem('dubai_tiktok_cfg') || '{}');
    const pkce = JSON.parse(localStorage.getItem('dubai_tiktok_pkce') || '{}');
    const redirectUri = pkce.redirectUri || (window.location.origin + '/api/tiktok');
    const res = await fetch('/api/tiktok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'token_exchange',
        code: CODE,
        clientKey: savedCfg.clientKey || '',
        clientSecret: savedCfg.clientSecret || '',
        codeVerifier: pkce.codeVerifier || '',
        redirectUri
      })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || 'Falha ao trocar código por token');

    const authObj = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      openId: data.open_id || '',
      scope: data.scope || '',
      expiresAt: Date.now() + ((Number(data.expires_in) || 86400) * 1000)
    };
    localStorage.setItem('dubai_tiktok_auth', JSON.stringify(authObj));
    if(window.opener && !window.opener.closed){
      window.opener.postMessage({ type: 'DUBAI_TIKTOK_CONNECTED', auth: authObj }, window.location.origin);
    }
    ttl.textContent = '✅ Conta TikTok Conectada com Sucesso!';
    msg.textContent = 'Postagem automática ativada! Retornando ao estúdio...';
    setTimeout(goBack, 1200);
  }catch(e){
    ttl.textContent = '❌ Erro ao concluir login TikTok';
    msg.textContent = e.message || String(e);
  }
})();
</script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Range, X-Upload-Url, X-Video-Mime');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1) Callback OAuth 2.0 no navegador (GET /api/tiktok?code=...)
  if (req.method === 'GET') {
    const html = renderOAuthCallbackPage(req);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
    return;
  }

  // 2) Relay binário opcional p/ upload de vídeo <= 4.5MB caso o navegador bloqueie CORS direto
  if (req.method === 'PUT') {
    try {
      const targetUploadUrl = req.headers['x-upload-url'] || (req.query && req.query.upload_url) || '';
      if (!isAllowedTikTokUploadUrl(targetUploadUrl)) {
        return send(res, 400, { error: 'URL de upload TikTok inválida ou não autorizada.' });
      }
      const rawBuf = await readRawBuffer(req);
      const contentType = req.headers['x-video-mime'] || req.headers['content-type'] || 'video/mp4';
      const contentRange = req.headers['content-range'] || `bytes 0-${rawBuf.length - 1}/${rawBuf.length}`;

      const upResp = await fetch(targetUploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(rawBuf.length),
          'Content-Range': contentRange
        },
        body: rawBuf
      });
      const respTxt = await upResp.text().catch(() => '');
      return send(res, upResp.ok ? 200 : upResp.status, {
        ok: upResp.ok,
        status: upResp.status,
        contentRange: upResp.headers.get('content-range') || contentRange,
        detail: respTxt.slice(0, 300)
      });
    } catch (e) {
      return send(res, 500, { error: e.message || String(e) });
    }
  }

  // 3) Operações JSON (POST /api/tiktok)
  try {
    const body = await parseJsonBody(req);
    const action = String(body.action || 'config_status');
    const clientKey = String(body.clientKey || process.env.TIKTOK_CLIENT_KEY || '').trim();
    const clientSecret = String(body.clientSecret || process.env.TIKTOK_CLIENT_SECRET || '').trim();
    const accessToken = String(body.accessToken || process.env.TIKTOK_ACCESS_TOKEN || '').trim();

    if (action === 'config_status') {
      return send(res, 200, {
        ok: true,
        hasEnvClientKey: !!process.env.TIKTOK_CLIENT_KEY,
        hasEnvAccessToken: !!process.env.TIKTOK_ACCESS_TOKEN,
        hasEnvWebhook: !!process.env.TIKTOK_WEBHOOK_URL,
        envClientKey: process.env.TIKTOK_CLIENT_KEY || ''
      });
    }

    // IA Geradora de Legenda Viral + Gancho + Hashtags otimizadas p/ TikTok
    if (action === 'viral_caption') {
      const contextText = String(body.script || body.prompt || 'Vídeo incrível criado no estúdio').slice(0, 2800);
      const lang = String(body.lang || 'pt-BR');
      const niche = String(body.niche || 'geral');
      try {
        const aiResp = await chatWithFallback({
          system:
            `Você é um especialista nº1 em crescimento viral no TikTok (${lang}). ` +
            `Escreva UMA legenda magnética pronta para postar no TikTok (máx 420 caracteres no total): ` +
            `1ª linha com gancho forte que prende a atenção nos primeiros 2 segundos, ` +
            `1 frase curta gerando comentários/engajamento, e no final 6 a 8 hashtags em alta (#fyp #foryou #viral + hashtags exatas do tema). ` +
            `Responda APENAS o texto final pronto da legenda, sem aspas e sem explicações.`,
          user: `Nicho: ${niche}\nConteúdo do vídeo:\n${contextText}`,
          maxTokens: 320
        });

        const txt = String((aiResp && aiResp.text) || '').trim();
        if (txt && !aiResp.error) {
          return send(res, 200, {
            ok: true,
            caption: txt,
            provider: aiResp.provider
          });
        }
      } catch {}
      const cleanSummary = contextText.replace(/\s+/g, ' ').trim().slice(0, 140);
      return send(res, 200, {
        ok: true,
        caption: `🔥 Assista até o final! ${cleanSummary}...\nComenta aqui o que você achou! 👇\n#fyp #foryou #viral #tiktokbrasil #fy #curiosidades`,
        provider: 'template'
      });
    }

    // Troca authorization_code -> access_token + refresh_token (Login Kit v2 + PKCE)
    if (action === 'token_exchange') {
      if (!clientKey || !clientSecret || !body.code) {
        return send(res, 400, { error: 'Informe Client Key, Client Secret e o código OAuth do TikTok.' });
      }
      const params = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: String(body.code),
        grant_type: 'authorization_code',
        redirect_uri: String(body.redirectUri || '')
      });
      if (body.codeVerifier) params.set('code_verifier', String(body.codeVerifier));

      const r = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/oauth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
        body: params.toString()
      });
      if (r.json.error || !r.json.access_token) {
        return send(res, 400, {
          error: r.json.error_description || r.json.message || r.json.error || 'Falha ao obter token do TikTok',
          detail: r.json
        });
      }
      return send(res, 200, { ok: true, ...r.json });
    }

    // Renovação automática de token expirado (refresh_token)
    if (action === 'refresh_token') {
      const refreshToken = String(body.refreshToken || '').trim();
      if (!clientKey || !clientSecret || !refreshToken) {
        return send(res, 400, { error: 'Client Key, Client Secret e refresh_token são necessários para renovar.' });
      }
      const params = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });
      const r = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/oauth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      if (r.json.error || !r.json.access_token) {
        return send(res, 400, { error: r.json.error_description || r.json.error || 'Falha ao renovar token' });
      }
      return send(res, 200, { ok: true, ...r.json });
    }

    // Disparo automático via Webhook externo (Make.com / n8n / Zapier / API própria)
    if (action === 'webhook_post') {
      const hookUrl = String(body.webhookUrl || process.env.TIKTOK_WEBHOOK_URL || '').trim();
      if (!hookUrl || !/^https?:\/\//i.test(hookUrl)) {
        return send(res, 400, { error: 'Informe uma URL de Webhook válida (Make, n8n, Zapier).' });
      }
      const r = await tiktokJsonFetch(hookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'tiktok',
          source: 'DubAI PRO',
          postedAt: new Date().toISOString(),
          caption: body.caption || '',
          privacyLevel: body.privacyLevel || 'PUBLIC_TO_EVERYONE',
          fileName: body.fileName || 'video-tiktok.mp4',
          fileSize: body.videoSize || 0,
          videoBase64: body.videoBase64 || null
        })
      }, 30000);
      if (!r.ok) {
        return send(res, 400, { error: `Webhook retornou HTTP ${r.status}` });
      }
      return send(res, 200, { ok: true, mode: 'webhook', status: r.status, response: r.json });
    }

    // A partir daqui exige Access Token do TikTok
    if (!accessToken) {
      return send(res, 400, { error: 'Conecte sua conta TikTok (OAuth) ou cole seu Access Token primeiro.' });
    }

    // Consulta perfil + permissões reais de publicação da conta (creator_info/query/)
    if (action === 'creator_info') {
      const [cInfo, uInfo] = await Promise.all([
        tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/post/publish/creator_info/query/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: '{}'
        }),
        tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/user/info/?fields=open_id,avatar_url,display_name,username`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` }
        }).catch(() => ({ ok: false, json: {} }))
      ]);

      const errObj = cInfo.json && cInfo.json.error;
      if (errObj && errObj.code && errObj.code !== 'ok') {
        return send(res, 400, {
          error: `${errObj.code}: ${errObj.message || 'Não foi possível consultar creator_info no TikTok'}`,
          code: errObj.code
        });
      }
      return send(res, 200, {
        ok: true,
        creator: (cInfo.json && cInfo.json.data) || {},
        user: (uInfo.json && uInfo.json.data && uInfo.json.data.user) || {}
      });
    }

    // Inicializa Postagem Oficial no TikTok (Direct Post com fallback inteligente p/ Caixa de Entrada / Privado)
    if (action === 'init_post') {
      const videoSize = Number(body.videoSize) || 0;
      if (videoSize <= 0) return send(res, 400, { error: 'Tamanho do arquivo de vídeo inválido.' });

      const chunkPlan = computeTikTokChunkPlan(videoSize);
      const caption = String(body.caption || '').slice(0, 2150);
      const publishMode = String(body.publishMode || 'direct'); // 'direct' | 'inbox'
      let requestedPrivacy = String(body.privacyLevel || 'PUBLIC_TO_EVERYONE');

      // 1º: Consulta creator_info p/ garantir que privacy_level seja aceito pela conta (requisito obrigatório TikTok v2)
      let allowedPrivacies = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
      let creatorNickname = '';
      try {
        const ci = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/post/publish/creator_info/query/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: '{}'
        });
        if (ci.json && ci.json.data) {
          creatorNickname = ci.json.data.creator_nickname || ci.json.data.creator_username || '';
          if (Array.isArray(ci.json.data.privacy_level_options) && ci.json.data.privacy_level_options.length > 0) {
            allowedPrivacies = ci.json.data.privacy_level_options;
          }
        }
      } catch {}

      if (!allowedPrivacies.includes(requestedPrivacy)) {
        requestedPrivacy = allowedPrivacies[0] || 'SELF_ONLY';
      }

      const sourceInfo = {
        source: 'FILE_UPLOAD',
        video_size: chunkPlan.video_size,
        chunk_size: chunkPlan.chunk_size,
        total_chunk_count: chunkPlan.total_chunk_count
      };

      // Se o usuário escolheu Rascunho/Caixa de Entrada do TikTok diretamente
      if (publishMode === 'inbox') {
        const inboxRes = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/post/publish/inbox/video/init/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: JSON.stringify({ source_info: sourceInfo })
        });
        const err = inboxRes.json && inboxRes.json.error;
        if (!inboxRes.json?.data?.upload_url || (err && err.code && err.code !== 'ok')) {
          return send(res, 400, {
            error: `${err?.code || 'erro_tiktok'}: ${err?.message || 'Falha ao iniciar envio para Caixa de Entrada TikTok'}`
          });
        }
        return send(res, 200, {
          ok: true,
          effectiveMode: 'inbox',
          creatorNickname,
          chunkPlan,
          publishId: inboxRes.json.data.publish_id,
          uploadUrl: inboxRes.json.data.upload_url
        });
      }

      // Tentativa Principal: Direct Post (/v2/post/publish/video/init/)
      const buildDirectBody = (priv) => ({
        post_info: {
          title: caption,
          privacy_level: priv,
          disable_duet: !body.allowDuet,
          disable_stitch: !body.allowStitch,
          disable_comment: !body.allowComment,
          video_cover_timestamp_ms: Math.max(0, Number(body.coverTimestampMs) || 1000),
          is_aigc: body.isAigc !== false
        },
        source_info: sourceInfo
      });

      let directRes = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/post/publish/video/init/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(buildDirectBody(requestedPrivacy))
      });

      let errCode = directRes.json?.error?.code || '';
      // Fallback automático caso o App no TikTok ainda não tenha passado pela auditoria pública:
      // 1º tenta enviar direto p/ Caixa de Entrada do App TikTok (onde o criador publica PÚBLICO com 1 toque sem precisar de auditoria!)
      // 2º se não tiver escopo video.upload, publica direto no perfil como SELF_ONLY!
      if ((!directRes.json?.data?.upload_url) &&
          /unaudited_client|privacy_level|scope_not_authorized/i.test(errCode)) {
        const inboxFallback = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/post/publish/inbox/video/init/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          body: JSON.stringify({ source_info: sourceInfo })
        });
        if (inboxFallback.json?.data?.upload_url) {
          return send(res, 200, {
            ok: true,
            effectiveMode: 'inbox_fallback',
            fallbackNote: 'App ainda sem auditoria pública no TikTok: enviado direto para sua Caixa de Entrada oficial do TikTok (basta tocar na notificação para publicar em Público!).',
            creatorNickname,
            chunkPlan,
            publishId: inboxFallback.json.data.publish_id,
            uploadUrl: inboxFallback.json.data.upload_url
          });
        }

        if (requestedPrivacy !== 'SELF_ONLY') {
          directRes = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/post/publish/video/init/`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(buildDirectBody('SELF_ONLY'))
          });
          if (directRes.json?.data?.upload_url) {
            return send(res, 200, {
              ok: true,
              effectiveMode: 'direct_self_only',
              fallbackNote: 'Publicado automaticamente no seu perfil TikTok em modo Privado (apps sem auditoria pública exigem SELF_ONLY; você pode mudar para Público em 1 toque no app!).',
              creatorNickname,
              chunkPlan,
              publishId: directRes.json.data.publish_id,
              uploadUrl: directRes.json.data.upload_url
            });
          }
        }
      }

      if (!directRes.json?.data?.upload_url) {
        const e = directRes.json?.error || {};
        return send(res, 400, {
          error: `${e.code || 'tiktok_error'}: ${e.message || 'Não foi possível iniciar publicação no TikTok.'}`,
          detail: directRes.json
        });
      }

      return send(res, 200, {
        ok: true,
        effectiveMode: 'direct',
        creatorNickname,
        privacyUsed: requestedPrivacy,
        chunkPlan,
        publishId: directRes.json.data.publish_id,
        uploadUrl: directRes.json.data.upload_url
      });
    }

    // Consulta em tempo real do processamento da postagem (/v2/post/publish/status/fetch/)
    if (action === 'check_status') {
      const publishId = String(body.publishId || '').trim();
      if (!publishId) return send(res, 400, { error: 'publishId ausente.' });
      const st = await tiktokJsonFetch(`${TIKTOK_AUTH_BASE}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify({ publish_id: publishId })
      });
      return send(res, 200, {
        ok: true,
        statusData: (st.json && st.json.data) || {},
        error: st.json && st.json.error
      });
    }

    return send(res, 400, { error: `Ação desconhecida: ${action}` });
  } catch (e) {
    return send(res, 500, { error: e.message || String(e) });
  }
};
