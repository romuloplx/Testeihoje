# ⚡ DubAI PRO — Estúdio de vídeos com IA

Interface premium em **HTML + Express** para criar roteiros e dublar vídeos.  
Baseado no código original enviado, agora com **backend funcional**, armazenamento e modo MOCK/OPENAI.

![stack](https://img.shields.io/badge/stack-Node%20%2B%20Express-blue) ![mode](https://img.shields.io/badge/mode-MOCK%20%7C%20OpenAI-purple) ![pt-br](https://img.shields.io/badge/lang-pt--BR-green)

## ✨ O que funciona

- **🎬 Criar vídeo com IA** — prompt → roteiro completo com cenas e timestamps (mock local realista + GPT-4o se `OPENAI_API_KEY` definido)
- **🌍 Dublar vídeo** — upload de vídeo/áudio → transcrição + tradução PT-BR + dublagem simulada (estrutura pronta para Whisper/TTS)
- **📁 Projetos** — listagem, expandir, copiar, ouvir com `speechSynthesis`, baixar .txt, excluir, persistência em `data/projects.json`
- **🔊 TTS** — endpoint `/api/tts` (usa OpenAI TTS quando há chave, senão usa voz do navegador)
- **🇨🇳 Inspiração Douyin** — busca externa via Apify por palavra-chave, ordenação por curtidas/relevância/recência e até 10 resultados; não exige conta Douyin, e os resultados são apenas referências, sem download automático
- **📋 Fila de revisão** — guarda vídeos dublados e metadados no IndexedDB local do navegador; não publica nem envia arquivos ao TikTok

## 🚀 Como rodar

```bash
npm install
npm start
# ou
node server.js
```

Acesse `http://localhost:3000`

### Variáveis

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
# edite OPENAI_API_KEY se quiser IA real
```

- Sem `OPENAI_API_KEY` → modo **MOCK** (perfeito para demo, não gasta créditos)
- Com `OPENAI_API_KEY` → usa **GPT-4o** para roteiros e pode usar Whisper/TTS
- Com `APIFY_API_TOKEN` → habilita a busca externa de inspiração no Douyin pelo Actor `atomus/douyin-scraper`; não é preciso criar conta nem autenticar no Douyin. O token fica apenas no servidor/Vercel. O Actor pode cobrar por resultado ou consulta, inclusive quando não há resultados: confira o preço e os créditos vigentes na [página do Actor](https://apify.com/atomus/douyin-scraper) antes de pesquisar.

## 📡 API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | status + modo |
| POST | `/api/create` | `{prompt,duration,style,voice}` → roteiro |
| GET | `/api/projects` | lista projetos |
| GET | `/api/projects/:id` | detalhe |
| DELETE | `/api/projects/:id` | remove |
| POST | `/api/dub` | `multipart` `video` + `language` + `dubVoice` |
| POST | `/api/tts` | `{text,voice}` → mp3 ou instrução browser |
| POST | `/api/clips` | `{action:"douyin_search",keyword,sortType,publishTime,count}` → busca externa de metadados públicos no Douyin via Apify (`count` é limitado a 10) |

Projetos salvos em `data/projects.json` + uploads em `uploads/`.

## 🎨 Frontend

`public/index.html` — código original evoluído:

- Tabs Criar/Dublar/Projetos/Fila de revisão/Downloads
- Busca externa de inspiração Douyin via Apify; resultados públicos não iniciam downloads e podem gerar cobrança por resultado ou consulta
- Progress bar com etapas, status colorido, toasts
- Preview de vídeo/áudio
- Cards com thumbnail, tags, detalhes colapsáveis
- Ações: copiar, ouvir (Web Speech API), baixar, excluir

## 🛠️ Stack

- `express` + `multer` + `cors` + `dotenv`
- `openai` (opcional)
- Vanilla JS, CSS moderno, sem build necessário

## 📦 Deploy

Qualquer Node 18+:

```bash
npm ci --omit=dev
PORT=3000 node server.js
```

---

Feito com 💜 para criadores.
