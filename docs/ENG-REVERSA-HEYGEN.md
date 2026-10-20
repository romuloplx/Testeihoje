# Engenharia Reversa: HeyGen (app.heygen.com)
### Como o produto funciona por baixo dos panos — e o que replicamos no DubAI PRO
> Análise de produto/engenharia baseada em documentação pública (developers.heygen.com), artigos técnicos e testes de produto. **Não copiamos código, marca ou assets do HeyGen** — replicamos funcionalidades com a nossa própria implementação e as APIs que já temos.

---

## 1. Resumo executivo

O HeyGen (fundado em 2020, ~US$100M ARR) é uma plataforma de **vídeo com avatar de IA**. O "truque" central não é gerar texto nem voz — é **animar um rosto para falar** (lip-sync) com sincronia em nível de fonema. Tudo o mais (roteiro, voz, tradução, legendas) existe para alimentar esse núcleo.

Fluxo mágico que define o produto:
1. Você digita um roteiro (ou cola um vídeo em outro idioma)
2. Escolhe um avatar (foto/vídeo seu ou banco de 230+)
3. A IA gera a voz → **anima a boca do avatar** bater com cada sílaba
4. Sai um vídeo pronto que parece uma pessoa real falando aquilo

---

## 2. Mapa de módulos do produto

| Módulo | O que faz | Entrada | Saída |
|---|---|---|---|
| **Video Avatar** | Avatar que fala um roteiro | Foto OU vídeo de 15s–5min + roteiro | Vídeo 1080p/4K |
| **Photo Avatar / Avatar IV** | Anima uma foto parada para falar | 1 foto + roteiro/áudio | Vídeo 16:9 |
| **Video Agent** | Prompt → vídeo completo roteirizado | 1 frase | Vídeo estruturado (cenas, b-roll, legendas) |
| **AI Studio** | Editor cena a cena | Roteiro + avatar + voz | Vídeo montado manualmente |
| **Video Translate** | Dublagem com lip-sync em 175+ idiomas | Vídeo pronto + idioma-alvo | Vídeo "gravado" no idioma novo |
| **Live Avatar** | Avatar interativo em tempo real | Áudio/stream | Resposta falada em tempo real |
| **Voices (TTS/clone)** | 300+ vozes + clonagem da sua voz | Texto ou amostra de voz | Áudio |
| **Ferramentas** | Legendas, remover "é/hum", cortar trechos, trilha, SFX | Vídeo | Vídeo editado |

---

## 3. Arquitetura oficial (do developers.heygen.com)

O próprio site de devs mostra a camada do sistema:

```
SUA APLICAÇÃO (roteiro · dados · assets)
        │
        ▼
CAMADA DE SISTEMA HEYGEN (o produto)
  └─ Assets      → imagem · vídeo · música · sfx
  └─ Compose     → Studio · Templates · HyperFrames
  └─ Orchestrate → workflows (batch de até 100, webhooks)
  └─ Render      → frota de GPUs
  └─ Deliver     → webhooks, download
        │
        ▼
MODELOS & PIPELINES
  └─ Avatar III · IV · V   (geração de rosto falante)
  └─ Voices                (TTS + clonagem)
  └─ Video Agent           (prompt → vídeo)
  └─ Translation           (dublagem)
  └─ Lipsync               (ressincronia de boca)
```

**Insight de engenharia:** eles separam **identidade** (quem é a pessoa) de **performance** (o que ela faz/fala). O modelo recebe o áudio como "diretor de cena" — o áudio dita expressão, gesto e ritmo.

---

## 4. Os 3 pilares de tecnologia

### Pilar 1 — Geração de Avatar (Avatar III → IV → V)
- **Avatar III**: encoder de identidade → vetor fixo (embedding) → decoder anima o rosto.
- **Avatar IV**: motor **difusão áudio→expressão**: analisa tom, ritmo e emoção do áudio e gera movimento facial quadro a quadro (olhos, inclinação de cabeça, micro-expressões), não só a boca.
- **Avatar V (2026)**: **Sparse Reference Self-Attention** — em vez de comprimir a identidade num vetor, o modelo olha **a sequência completa de quadros do vídeo de referência** em todas as camadas do transformer. Resultado: identidade estável em qualquer ângulo/roupa/luz.
  - Entrada curta: **15 segundos** de vídeo (era 5–10 min).
  - Fase final: **RLHF** (reinforcement learning com preferência humana) para maximizar semelhança facial.
  - Benchmarks próprios: face similarity 0.840, LSE-C 8.97 / LSE-D 6.75 (métricas padrão de lip-sync).

### Pilar 2 — Tradução de vídeo com lip-sync (o carro-chefe comercial)
Pipeline em 4 estágios:
1. **ASR** (reconhecimento de fala): transcreve com timing, ênfase e pausas
2. **NMT** (tradução neural): LLM fine-tuned que preserva **tom, formalidade e comprimento** da frase (crítico para caber na janela de tempo original!)
3. **TTS + clonagem de voz**: sintetiza no idioma-alvo com a voz do falante original
4. **Re-renderização facial (lip-sync)**: modifica apenas boca/mandíbula/rosto inferior do vídeo original para bater com os **fonemas do novo idioma** — pixel a pixel, aguenta perfil, mão na boca, cabeça mexendo

### Pilar 3 — Streaming interativo (Live Avatar)
Avatar responde em tempo real (conversa, suporte, kiosk) — combina TTS streaming + animação incremental + LLM de diálogo.

---

## 5. Superfície de API pública (o que os programadores usam)

| API | Endpoint-chave | Função |
|---|---|---|
| Video Generation | `POST /v2/video/generate` | avatar + script/áudio → vídeo (audio_url OU voice_id) |
| Video Agent | `POST /v1/video_agent` | prompt → vídeo completo |
| Video Translation | `POST /v3/video-translations` | dub + lip-sync (modos `speed`/`precision`) |
| Lipsync | `POST /v1/lipsync` | ressincronizar boca (speed/precision) |
| Text to Speech | `POST /v1/tts` | voz sintética / clonada |
| Template | `POST /v2/template/generate` | variações em escala |
| Proofread | — | validação de transcrição |
| Avatar Management | `GET/POST /v2/avatars` | criar/gerenciar avatares |

- Auth por API key; **batch até 100 requisições**; webhooks; REST + CLI + **MCP** (agentes de IA geram vídeo sem glue code)
- Preço de referência (API): **US$1/min** avatar padrão · **US$4/min** Avatar IV · **US$2/min** tradução
- Planos: Creator US$29/mês (200 créditos ≈ 10 min de Avatar IV) · Business US$149/mês

---

## 6. UX — como o usuário navega (para replicar o "feeling")

1. **Home com templates de uso** (Ads & Promo, Educational, Explainer, Tips & How-To, News Brief, Video Podcast) → clique já abre o editor com o formato
2. **Editor**: roteiro à esquerda, avatar/preview à direita, timeline de cenas embaixo
3. **Escolha de avatar** (Pro/Lifestyle/UGC + custom) e **voz** (preview de 1 clique)
4. **Render na nuvem** com barra de progresso → download MP4 + legendas
5. **Traduzir** como botão de segundo nível em qualquer vídeo pronto

---

## 7. Matriz de replicação no DubAI PRO

| Capacidade HeyGen | DubAI HOJE | Como | Nota |
|---|---|---|---|
| Script → vídeo completo (Video Agent) | ✅ **TEMOS** | 🎬 Criar: roteiro+cenas+SEO+narração+montagem | Paridade real |
| Templates de uso (Ads/Edu/Explainer...) | ✅ **NOVO** | Chips "🎨 Modelos prontos" | Implementado nesta rodada |
| Legendas (Captions) | ✅ **NOVO** | "📜 Baixar legendas (SRT)" | Implementado |
| Proofread + remover filler words | ✅ **NOVO** | "✨ Melhorar com IA" + `/api/enhance` | Implementado |
| TTS com múltiplas vozes | ✅ **TEMOS** | 9 vozes + cadeia OpenAI→Unorouter→Google | Paridade parcial (sem clone de voz) |
| Dublagem de vídeo (translate) | ✅ **TEMOS** | 🌍 Dublar: transcreve→traduz→voz→vídeo trocado | **Sem lip-sync** |
| Trilha/SFX | 🔴 | — | Sem API de áudio musical no momento |
| Remover trechos (AI clipping) | 🟡 | Cortar por cena já dá no editor do YouTube | Roadmap |
| **Photo Avatar (foto que fala)** | 🟡 **ROADMAP** | Foto + voz + legendas animadas (sem animar boca) | Ver §8 |
| **Lip-sync real (a "mágica")** | 🔴 | Requer modelo tipo Wav2Lip/MuseTalk/LivePortrait em GPU | Ver §8 |
| Clonagem de voz | 🔴 | Requer modelo de voice cloning | Ver §8 |
| Live Avatar (tempo real) | 🔴 | Streaming + GPU | Roadmap longo |

Legenda: ✅ pronto · 🟡 possível agora (versão parcial) · 🔴 precisa de modelo/GPU novo

---

## 8. Roadmap de engenharia (como fechar a lacuna)

### Fase 1 — Paridade "de mesa de trabalho" (SEMANA ESTA — já entregue)
- ✅ Templates de vídeo (6 formatos HeyGen-like)
- ✅ Legendas SRT
- ✅ Melhorar roteiro (proofread + limpeza de palavras de preenchimento)

### Fase 2 — "Foto Falante" (Photo Avatar lite) — 1–2 dias de trabalho
- Upload de 1 foto → narração com voz escolhida → vídeo com zoom/pan + legendas sincronizadas
- **Não anima a boca**, mas entrega o fluxo de uso do Photo Avatar (e serve de base para plugar lip-sync depois)
- Tudo client-side (canvas) + nossas APIs de TTS/roteiro existentes

### Fase 3 — Lip-sync (o verdadeiro HeyGen) — requer infra nova
Opções open-source para rodar em servidor com GPU (RunPod/Modal/Vast ~US$0,2–0,5/h):
| Modelo | O que faz | Obs |
|---|---|---|
| **MuseTalk** (Tencent) | rosto falante em tempo real | ótimo custo-benefício |
| **Wav2Lip** | só a boca (rápido) | qualidade "boa o suficiente" |
| **SadTalker** | foto → cabeça falante | clássico para foto |
| **EchoMimic / Hallo / LivePortrait** | foto → vídeo expressivo | qualidade premium |
Arquitetura: `DubAI PRO (Vercel) → fila (webhook) → worker GPU (FastAPI) → devolve MP4`

### Fase 4 — Voz clonada + tradução com lip-sync (paridade total)
- Clonagem: **OpenVoice / XTTS-v2 / F5-TTS** no mesmo worker de GPU
- Tradução com lip-sync = nosso pipeline atual (ASR→MT→TTS) + worker de lip-sync do Fase 3

### Fase 5 — Live Avatar (opcional)
- TTS streaming (ElevenLabs/OpenAI realtime) + LivePortrait incremental + LLM de diálogo

---

## 9. Custos comparativos (para decidir)

| Cenário | HeyGen (API) | DubAI PRO (nosso caminho) |
|---|---|---|
| Vídeo de roteiro 10 min | ~US$10 (avatar) | **Grátis** (Pollinations/Unorouter) ou ~US$0,02 com OpenAI |
| Dublagem 10 min (com lip) | ~US$20 | Grátis sem lip · ~US$1–3 com worker GPU |
| Avatar custom | 200 créditos/mês | 15s de vídeo → worker GPU (custo de render) |

---

## 10. Conclusão

O HeyGen é, em engenharia, **um bom editor de vídeo com 3 modelos neurais no centro**: gerador de rosto (Avatar V), sintetizador de voz com clonagem e reanimador facial (lip-sync). Todo o resto é produto (templates, editor, API, webhooks).

O DubAI PRO já cobre **o produto** (roteiro → cena → voz → vídeo → dublagem → SEO → legendas). A lacuna real são os **3 modelos neurais de rosto/voz** — e o roadmap acima mostra exatamente como fechar cada um, do mais barato (Foto Falante) ao completo (worker GPU com MuseTalk + XTTS).
