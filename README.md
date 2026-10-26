# ⚡ DubAI PRO — Estúdio de vídeos com IA

Interface premium em **HTML + Express** para criar roteiros e dublar vídeos.  
Baseado no código original enviado, agora com **backend funcional**, armazenamento e modo MOCK/OPENAI.

![stack](https://img.shields.io/badge/stack-Node%20%2B%20Express-blue) ![mode](https://img.shields.io/badge/mode-MOCK%20%7C%20OpenAI-purple) ![pt-br](https://img.shields.io/badge/lang-pt--BR-green)

## ✨ O que funciona

- **🎬 Criar vídeo com IA** — prompt → roteiro completo com cenas e timestamps (mock local realista + GPT-4o se `OPENAI_API_KEY` definido)
- **🌍 Dublar vídeo** — upload de vídeo/áudio → transcrição + tradução PT-BR + dublagem simulada (estrutura pronta para Whisper/TTS)
- **📁 Projetos** — listagem, expandir, copiar, ouvir com `speechSynthesis`, baixar .txt, excluir, persistência em `data/projects.json`
- **🔊 TTS** — endpoint `/api/tts` (usa OpenAI TTS quando há chave, senão usa voz do navegador)
- **⬇️ Baixar vídeos** — usa yt-dlp no servidor para baixar MP4 de links suportados do TikTok, Douyin e YouTube, para conteúdo próprio ou autorizado (com confirmação do usuário); também oferece o [Brasil Downloader](https://brasil-downloader.vercel.app/) como serviço externo. Referência: [YTDLnis](https://github.com/deniscerri/ytdlnis) é um app Android separado que também usa yt-dlp; seu código Kotlin não é incorporado ao site.
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
| POST | `/api/clips` | `{action:"video_download",url}` → stream MP4 suportado do TikTok, Douyin ou YouTube (links públicos; vídeo próprio ou autorizado) |

Projetos salvos em `data/projects.json` + uploads em `uploads/`.

## 🎨 Frontend

`public/index.html` — código original evoluído:

- Tabs Criar/Dublar/Projetos/Fila de revisão/Baixar vídeos
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
