# ╔════════════════════════════════════════════════════════════════════╗
# ║  DubAI PRO — OpusClip IA Pipeline (6 Estágios Completos)         ║
# ║  Link YouTube → yt-dlp → Whisper STT → LLM → MediaPipe →        ║
# ║  ASS Subtitles → FFmpeg Engine → corte_*.mp4 9:16                ║
# ║                                                                   ║
# ║  pip install yt-dlp openai-whisper openai moviepy mediapipe     ║
# ║  pip install opencv-python                                        ║
# ║  FFmpeg deve estar instalado no SO                                ║
# ╚════════════════════════════════════════════════════════════════════╝

import os
import sys
import json
import re
import subprocess
import textwrap
import tempfile
from pathlib import Path

import yt_dlp
import whisper
from openai import OpenAI

try:
    from moviepy.editor import VideoFileClip
    HAS_MOVIEPY = True
except ImportError:
    HAS_MOVIEPY = False

# ──────────────────────────────────────────────────────────────────
# 0. CONFIGURAÇÃO DE CHAVES
# ──────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY") or os.environ.get("UNOROUTER_API_KEY") or "SUA_CHAVE_OPENAI_AQUI"
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL") or (
    "https://api.unorouter.com/v1" if OPENAI_API_KEY.startswith("sk-mwg") else None
)
client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL) if OPENAI_BASE_URL else OpenAI(api_key=OPENAI_API_KEY)

# ──────────────────────────────────────────────────────────────────
# ETAPA 1: Download do Áudio e Vídeo (yt-dlp)
#   [Link YouTube] → [yt-dlp] → Baixa Mídia Bruta
# ──────────────────────────────────────────────────────────────────
def baixar_midia_youtube(url_youtube, output_path="video_original.mp4"):
    print("[1/6] ⬇️  [yt-dlp] Baixando mídia bruta do YouTube...")
    print(f"      URL: {url_youtube}")
    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": output_path,
        "overwrites": True,
        "quiet": False,
        "no_warnings": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url_youtube, download=True)
        title = info.get("title", "")
        duration = info.get("duration", 0)
        print(f"      ✅ Download concluído: \"{title}\" ({duration}s) → {output_path}")
    return output_path


# ──────────────────────────────────────────────────────────────────
# ETAPA 2: Transcrição com Timestamps Word-Level (Whisper STT)
#   [Whisper STT] → Gera Transcrição Word-Level Timestamps
# ──────────────────────────────────────────────────────────────────
def transcriver_audio(video_path, model_name="base", word_timestamps=True):
    print(f"[2/6] 🎙️  [Whisper STT] Transcrevendo com word-level timestamps (model={model_name})...")
    model = whisper.load_model(model_name)
    # word_timestamps=True gera timestamps por palavra (necessário para ASS karaoke)
    resultado = model.transcribe(video_path, verbose=False, word_timestamps=word_timestamps)

    segmentos = []
    words_all = []
    for seg in resultado.get("segments", []):
        seg_words = []
        for w in seg.get("words", []) or []:
            wd = {
                "word": w.get("word", "").strip(),
                "start": round(float(w.get("start", seg["start"])), 3),
                "end": round(float(w.get("end", seg["end"])), 3),
            }
            if wd["word"]:
                seg_words.append(wd)
                words_all.append(wd)
        segmentos.append({
            "inicio": round(float(seg["start"]), 3),
            "fim": round(float(seg["end"]), 3),
            "texto": seg["text"].strip(),
            "words": seg_words,
        })

    # Fallback: se o modelo não retornou words, estima divisão uniforme
    if not words_all:
        print("      ⚠️  Modelo sem word_timestamps — estimando divisão por palavra...")
        for seg in segmentos:
            txt_words = seg["texto"].split()
            if not txt_words:
                continue
            dur = seg["fim"] - seg["inicio"]
            per = dur / len(txt_words) if txt_words else dur
            seg["words"] = [
                {"word": w, "start": round(seg["inicio"] + i * per, 3), "end": round(seg["inicio"] + (i + 1) * per, 3)}
                for i, w in enumerate(txt_words)
            ]
            words_all.extend(seg["words"])

    print(f"      ✅ Transcrição concluída: {len(segmentos)} segmentos, {len(words_all)} palavras com timestamps.")
    return segmentos


# ──────────────────────────────────────────────────────────────────
# ETAPA 3: Curadoria Semântica — LLM identifica climax & cortes virais
#   [IA LLM] → Identifica Climax & Cortes Virais
# ──────────────────────────────────────────────────────────────────
def selecionar_melhores_cortes(transcricao_segmentos, n_cortes=3, duracao_min=30, duracao_max=120):
    print(f"[3/6] 🧠 [LLM] Analisando transcrição para identificar climax & cortes virais...")
    # Remove field 'words' detalhado para não estourar tokens — envia só inicio/fim/texto
    transcricao_resumida = [
        {"inicio": s["inicio"], "fim": s["fim"], "texto": s["texto"]}
        for s in transcricao_segmentos
    ]

    prompt_sistema = textwrap.dedent(f"""
    Você é um editor-chefe especialista em vídeos virais (TikTok, Reels, YouTube Shorts).
    Analise a transcrição com timestamps e identifique de {n_cortes} a {n_cortes} cortes com MAIOR potencial viral.

    Regras obrigatórias:
    - Cada corte deve ter entre {duracao_min} e {duracao_max} segundos.
    - Cada corte precisa ter história completa: Gancho forte no início + desenvolvimento + conclusão/punchline.
    - Priorize: revelação impactante, dica prática, momento engraçado, pico emocional, polêmica, storytelling.
    - Os timestamps 'inicio' e 'fim' DEVEM corresponder exatamente a valores 'inicio'/'fim' da transcrição.
    - Retorne ESTRITAMENTE um JSON válido:
    {{
      "cortes": [
        {{
          "titulo": "Título Curto e Chamativo (máx 60 chars)",
          "inicio": 12.5,
          "fim": 55.0,
          "score_viralidade": 85,
          "motivo": "Por que este corte vai viralizar (1 frase)",
          "gancho": "Primeira frase do corte — o hook que prende atenção",
          "keywords": ["tag1", "tag2"]
        }}
      ]
    }}
    """).strip()

    prompt_usuario = f"Transcrição do vídeo (timestamps em segundos):\n{json.dumps(transcricao_resumida, ensure_ascii=False)}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    resultado_json = json.loads(response.choices[0].message.content)
    cortes = (
        resultado_json.get("cortes", resultado_json.get("clips", resultado_json))
        if isinstance(resultado_json, dict)
        else resultado_json
    )
    if isinstance(cortes, dict):
        cortes = [cortes]
    # Normaliza campos
    for c in cortes:
        c["score_viralidade"] = int(c.get("score_viralidade", c.get("score", 80)))
        c["titulo"] = str(c.get("titulo", c.get("title", "Corte Viral"))).strip()

    print(f"      ✅ IA selecionou {len(cortes)} cortes virais:")
    for c in cortes:
        print(f"         🔥 [{c['score_viralidade']}/100] {c['titulo']} ({c['inicio']}s → {c['fim']}s) — {c.get('motivo','')}")
    return cortes


# ──────────────────────────────────────────────────────────────────
# ETAPA 4: MediaPipe AI — Rastreia Movimento Facial (Reframe 9:16)
#   [MediaPipe AI] → Rastreia Rosto → Crop Inteligente 9:16
# ──────────────────────────────────────────────────────────────────
def _mediapipe_face_x_center(video_path, t_sec, width, height):
    """Retorna x_center normalizado (0..1) do rosto em t_sec via MediaPipe Face Detection.
    Se MediaPipe não estiver instalado ou rosto não detectado, retorna 0.5 (centro)."""
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        return 0.5

    try:
        cap = None
        # Extrai 1 frame em t_sec via OpenCV
        import cv2
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        cap.set(cv2.CAP_PROP_POS_MSEC, t_sec * 1000)
        ret, frame = cap.read()
        if not ret or frame is None:
            return 0.5
        cap.release()
        cap = None

        mp_face = mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = mp_face.process(rgb)
        mp_face.close()
        if not res.detections:
            return 0.5
        # Usa o rosto com maior confiança; pega centro da bounding box
        best = max(res.detections, key=lambda d: d.score[0] if d.score else 0)
        bbox = best.location_data.relative_bounding_box
        cx = bbox.xmin + bbox.width / 2
        # Suaviza levemente para evitar jitter
        return max(0.15, min(0.85, float(cx)))
    except Exception as e:
        print(f"      ⚠️  MediaPipe falhou em t={t_sec}s: {e} — usando centro.")
        return 0.5
    finally:
        try:
            if cap is not None:
                cap.release()
        except Exception:
            pass


def calcular_reframe_mediapipe(video_path, t_inicio, t_fim, largura_orig, altura_orig, num_amostras=5):
    """Amostra N pontos no intervalo e retorna (x1, x2) do crop 9:16 rastreando o rosto.
    Se MediaPipe indisponível, faz crop centralizado."""
    nova_largura = int(altura_orig * (9 / 16))
    if nova_largura >= largura_orig:
        return 0, largura_orig  # já é vertical ou quadrado

    # Coleta centros faciais ao longo do corte
    cxs = []
    if t_fim <= t_inicio:
        cxs = [0.5]
    else:
        step = (t_fim - t_inicio) / max(1, num_amostras)
        for i in range(num_amostras):
            t = t_inicio + step * (i + 0.5)
            cxs.append(_mediapipe_face_x_center(video_path, t, largura_orig, altura_orig))

    # Mediana robusta contra outliers
    cxs_sorted = sorted(cxs)
    median_cx = cxs_sorted[len(cxs_sorted) // 2]
    x_center = median_cx * largura_orig
    x1 = int(max(0, min(largura_orig - nova_largura, x_center - nova_largura / 2)))
    x2 = x1 + nova_largura
    print(f"      📐 MediaPipe reframe: cx_median={median_cx:.2f} → crop x1={x1} x2={x2} (w={nova_largura} de {largura_orig}) | amostras={cxs}")
    return x1, x2


# ──────────────────────────────────────────────────────────────────
# ETAPA 5: ASS Subtitles — Estiliza Legendas Palavra por Palavra
#   [ASS Subtitles] → TikTok Style (karaoke highlight)
# ──────────────────────────────────────────────────────────────────
ASS_HEADER = textwrap.dedent("""\
    [Script Info]
    Title: DubAI PRO OpusClip — TikTok Style
    ScriptType: v4.00+
    PlayResX: 1080
    PlayResY: 1920
    WrapStyle: 1
    ScaledBorderAndShadow: yes
    YCbCr Matrix: TV.709

    [V4+ Styles]
    Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    Style: TikTok, Montserrat ExtraBold, 72, &H00FFFFFF, &H0000FFFF, &H00000000, &H66000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 7, 2, 2, 30, 30, 150, 1
    Style: TikTokActive, Montserrat ExtraBold, 80, &H0000FFFF, &H00FFFFFF, &H00000000, &H66000000, 1, 0, 0, 0, 105, 105, 0, 0, 1, 8, 3, 2, 30, 30, 150, 1
    Style: Hormozi, Anton, 76, &H00FFFFFF, &H0033FFFF, &H00000000, &HAA000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 6, 2, 5, 30, 30, 420, 1

    [Events]
    Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    """)

def _ass_time(sec):
    """Converte segundos float para H:MM:SS.cc (ASS usa centissegundos)."""
    if sec < 0:
        sec = 0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    cs = int(round((sec - int(sec)) * 100))
    if cs >= 100:
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def gerar_ass_tiktok_style(transcricao_segmentos, corte, output_ass_path, estilo="TikTok", words_per_block=2):
    """Gera arquivo .ASS com highlight palavra-por-palavra estilo TikTok/OpusClip.
    - Cada linha cobre 1–3 palavras do corte, com karaoke \\k timing por palavra.
    - corte = {inicio, fim} em segundos absolutos do vídeo original.
    """
    t0 = float(corte["inicio"])
    t1 = float(corte["fim"])
    # Coleta todas as palavras dentro do corte
    words_in_cut = []
    for seg in transcricao_segmentos:
        for w in seg.get("words", []):
            ws = float(w["start"])
            we = float(w["end"])
            if we < t0 or ws > t1:
                continue
            # Clampa ao corte
            ws = max(ws, t0)
            we = min(we, t1)
            if we <= ws:
                continue
            words_in_cut.append({"word": w["word"], "start": ws, "end": we})

    if not words_in_cut:
        # Fallback: usa texto dos segmentos
        fallback_text = " ".join(
            s["texto"] for s in transcricao_segmentos if not (s["fim"] < t0 or s["inicio"] > t1)
        ).strip()
        if not fallback_text:
            fallback_text = corte.get("titulo", "Corte Viral")
        # Divide em blocos artificiais de ~0.6s por palavra
        fwords = fallback_text.split()
        dur = max(0.5, t1 - t0)
        per = dur / max(1, len(fwords))
        words_in_cut = [
            {"word": w, "start": t0 + i * per, "end": t0 + (i + 1) * per}
            for i, w in enumerate(fwords)
        ]

    # Agrupa em blocos de words_per_block palavras por linha ASS
    lines = []
    for i in range(0, len(words_in_cut), words_per_block):
        block = words_in_cut[i:i + words_per_block]
        b_start = block[0]["start"] - t0  # relativo ao corte (0 = início do corte)
        b_end = block[-1]["end"] - t0
        # Constrói texto com karaoke tags \k (duração em centissegundos por palavra)
        parts = []
        for w in block:
            dur_cs = max(1, int(round((w["end"] - w["start"]) * 100)))
            # Palavra ativa em amarelo/verde TikTok — usa {\c&H00FFFF&} para highlight
            # Estratégia: karaoke simples + cor alternada na palavra ativa
            safe_word = w["word"].replace("{", "(").replace("}", ")").strip()
            if not safe_word:
                continue
            parts.append(f"{{\\k{dur_cs}}}{safe_word}")
        if not parts:
            continue
        text = " ".join(parts)
        # Linha ASS: Layer 0, com Style do preset
        lines.append(f"Dialogue: 0,{_ass_time(b_start)},{_ass_time(b_end)},{estilo},,0,0,0,,{text}")

    # Se estilo TikTokActive quiser highlight animado, adiciona segunda camada com \t
    # (mantido simples para compatibilidade com FFmpeg ass filter)

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(ASS_HEADER)
        for ln in lines:
            f.write(ln + "\n")

    print(f"      ✅ ASS TikTok gerado: {output_ass_path} ({len(lines)} linhas, {len(words_in_cut)} palavras, estilo={estilo})")
    return output_ass_path


# ──────────────────────────────────────────────────────────────────
# ETAPA 6: FFmpeg Engine — Compila, Recorta e Exporta MP4 9:16
#   [FFmpeg Engine] → Compila + Recorta + Queima Legenda → corte_N.mp4
# ──────────────────────────────────────────────────────────────────
def _probe_resolution(video_path):
    """Retorna (width, height) via ffprobe ou MoviePy fallback."""
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0", video_path],
            text=True, timeout=10
        ).strip()
        w_str, h_str = out.split(",")
        return int(w_str), int(h_str)
    except Exception:
        if HAS_MOVIEPY:
            clip = VideoFileClip(video_path)
            wh = tuple(clip.size)
            clip.close()
            return wh
        return 1920, 1080


def gerar_cortes_finais(video_path, transcricao_segmentos, lista_cortes, pasta_saida="cortes_gerados",
                        estilo_legenda="TikTok", words_per_block=2, usar_mediapipe=True,
                        codec="libx264", preset="fast", crf="20"):
    """
    Pipeline completo de renderização:
      1. Para cada corte: calcula crop 9:16 via MediaPipe (ou centro)
      2. Gera .ASS TikTok word-by-word
      3. Compila com FFmpeg: subclip + crop + queima legenda ASS + AAC
    Saída: cortes_gerados/corte_1.mp4 ... (1080x1920, H.264 + AAC)
    """
    print(f"[4/6 → 6/6] 🎬 [MediaPipe AI + ASS + FFmpeg Engine] Renderizando {len(lista_cortes)} cortes em 9:16...")

    if not os.path.exists(pasta_saida):
        os.makedirs(pasta_saida, exist_ok=True)

    largura_orig, altura_orig = _probe_resolution(video_path)
    print(f"      📐 Vídeo original: {largura_orig}x{altura_orig}")

    # Valida FFmpeg
    try:
        subprocess.check_output(["ffmpeg", "-version"], timeout=5)
    except Exception as e:
        raise RuntimeError(f"FFmpeg não encontrado no PATH: {e}. Instale FFmpeg para renderizar cortes.")

    for idx, corte in enumerate(lista_cortes):
        t_inicio = float(corte["inicio"])
        t_fim = float(corte["fim"])
        dur = t_fim - t_inicio
        if dur <= 0:
            print(f"      ⚠️  Corte {idx+1} com duração inválida ({t_inicio}→{t_fim}) — pulando.")
            continue

        titulo = corte.get("titulo", f"Corte {idx+1}")
        print(f"\n   ── Corte {idx+1}/{len(lista_cortes)}: \"{titulo}\" ({t_inicio:.2f}s → {t_fim:.2f}s, {dur:.1f}s) ──")

        # ── 4. MediaPipe reframe ──
        if usar_mediapipe:
            x1, x2 = calcular_reframe_mediapipe(video_path, t_inicio, t_fim, largura_orig, altura_orig)
        else:
            nova_largura = int(altura_orig * (9 / 16))
            x_center = largura_orig / 2
            x1 = max(0, int(x_center - nova_largura / 2))
            x2 = min(largura_orig, x1 + nova_largura)

        crop_w = x2 - x1
        crop_h = altura_orig

        # ── 5. ASS TikTok ──
        ass_path = os.path.join(pasta_saida, f"corte_{idx+1}.ass")
        gerar_ass_tiktok_style(transcricao_segmentos, corte, ass_path, estilo=estilo_legenda, words_per_block=words_per_block)

        # ── 6. FFmpeg compile ──
        nome_arquivo = os.path.join(pasta_saida, f"corte_{idx+1}.mp4")
        # Filtro: crop + scale para 1080x1920 + queima legenda ASS
        # O crop é em pixels do original; depois scale para 1080x1920 exato.
        # Escapa caminho ASS para FFmpeg (Windows/Unix)
        ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
        # Usa filtro ass com fontsdir se necessário; fallback para subtitles
        vf_parts = [
            f"crop={crop_w}:{crop_h}:{x1}:0",
            "scale=1080:1920:flags=lanczos",
            f"ass='{ass_escaped}'"
        ]
        vf = ",".join(vf_parts)

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(t_inicio),
            "-to", str(t_fim),
            "-i", video_path,
            "-vf", vf,
            "-c:v", codec,
            "-preset", preset,
            "-crf", crf,
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            nome_arquivo,
        ]
        print(f"      🔧 FFmpeg: {' '.join(cmd)}")
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            # Fallback: tenta sem ASS se filtro ass falhar (ex: libass não compilada)
            print(f"      ⚠️  FFmpeg com ASS falhou — tentando sem legenda queimada...")
            print(f"         stderr: {proc.stderr[-600:]}")
            vf_fallback = f"crop={crop_w}:{crop_h}:{x1}:0,scale=1080:1920:flags=lanczos"
            cmd_fb = [
                "ffmpeg", "-y",
                "-ss", str(t_inicio), "-to", str(t_fim),
                "-i", video_path,
                "-vf", vf_fallback,
                "-c:v", codec, "-preset", preset, "-crf", crf,
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                nome_arquivo,
            ]
            proc2 = subprocess.run(cmd_fb, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if proc2.returncode != 0:
                print(f"      ❌ FFmpeg fallback também falhou: {proc2.stderr[-600:]}")
                continue

        # Também salva SRT espelhando o ASS (para download separado)
        srt_path = os.path.join(pasta_saida, f"corte_{idx+1}.srt")
        try:
            gerar_srt_do_corte(transcricao_segmentos, corte, srt_path, words_per_block=words_per_block)
        except Exception as e:
            print(f"      ⚠️  SRT falhou: {e}")

        size_mb = os.path.getsize(nome_arquivo) / (1024 * 1024) if os.path.exists(nome_arquivo) else 0
        print(f"      ✅ Salvo: {nome_arquivo} ({size_mb:.1f} MB) | ASS: {ass_path} | SRT: {srt_path}")

    print(f"\n✅ Concluído! Todos os cortes salvos em: {pasta_saida}/")


def gerar_srt_do_corte(transcricao_segmentos, corte, output_srt_path, words_per_block=3):
    """Gera .SRT sincronizado com word-level timestamps para o corte."""
    t0 = float(corte["inicio"])
    t1 = float(corte["fim"])
    words = []
    for seg in transcricao_segmentos:
        for w in seg.get("words", []):
            if float(w["end"]) < t0 or float(w["start"]) > t1:
                continue
            words.append(w)
    if not words:
        # fallback por texto
        txt = " ".join(s["texto"] for s in transcricao_segmentos if not (s["fim"] < t0 or s["inicio"] > t1))
        fwords = txt.split()
        dur = max(0.5, t1 - t0)
        per = dur / max(1, len(fwords))
        words = [{"word": w, "start": t0 + i * per, "end": t0 + (i + 1) * per} for i, w in enumerate(fwords)]
        if not words:
            words = [{"word": corte.get("titulo", "Corte"), "start": t0, "end": t1}]

    def srt_time(s):
        s = max(0, float(s) - t0)  # relativo ao corte
        h = int(s // 3600)
        m = int((s % 3600) // 60)
        sec = int(s % 60)
        ms = int(round((s - int(s)) * 1000))
        return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"

    blocks = [words[i:i + words_per_block] for i in range(0, len(words), words_per_block)]
    with open(output_srt_path, "w", encoding="utf-8") as f:
        for idx, block in enumerate(blocks, 1):
            f.write(f"{idx}\n")
            f.write(f"{srt_time(block[0]['start'])} --> {srt_time(block[-1]['end'])}\n")
            f.write(" ".join(w["word"] for w in block) + "\n\n")


# ──────────────────────────────────────────────────────────────────
# Compatibilidade: assinatura antiga gerar_cortes_finais(video_path, lista_cortes, pasta_saida)
# ──────────────────────────────────────────────────────────────────
def _gerar_cortes_compativel(video_path, lista_cortes, pasta_saida="cortes_gerados", **kwargs):
    """Wrapper para chamadas antigas sem transcricao_segmentos — usa fallback centralizado."""
    print("[compat] Assinatura antiga detectada — usando crop centralizado + legenda por título.")
    if not os.path.exists(pasta_saida):
        os.makedirs(pasta_saida, exist_ok=True)
    largura_orig, altura_orig = _probe_resolution(video_path)
    nova_largura = int(altura_orig * (9 / 16))
    x_center = largura_orig / 2
    x1 = max(0, int(x_center - nova_largura / 2))
    x2 = min(largura_orig, x1 + nova_largura)
    crop_w = x2 - x1
    for idx, corte in enumerate(lista_cortes):
        t_inicio = float(corte["inicio"])
        t_fim = float(corte["fim"])
        nome = os.path.join(pasta_saida, f"corte_{idx+1}.mp4")
        vf = f"crop={crop_w}:{altura_orig}:{x1}:0,scale=1080:1920:flags=lanczos"
        cmd = ["ffmpeg", "-y", "-ss", str(t_inicio), "-to", str(t_fim), "-i", video_path,
               "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20",
               "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", nome]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f" ✅ {nome}")

# Mantém nome antigo funcionando se chamado com 3 args posicionais sem transcricao
# (detecta pelo número de args no __main__ abaixo)


# ──────────────────────────────────────────────────────────────────
# EXECUÇÃO FLUXO COMPLETO — 6 Estágios
# ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    URL_YOUTUBE = os.environ.get("URL_YOUTUBE", "https://www.youtube.com/watch?v=EXEMPLO")
    OUTPUT_VIDEO = os.environ.get("OUTPUT_VIDEO", "video_original.mp4")
    PASTA_SAIDA = os.environ.get("PASTA_SAIDA", "cortes_gerados")
    WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
    ESTILO_LEGENDA = os.environ.get("ESTILO_LEGENDA", "TikTok")  # TikTok | Hormozi | TikTokActive
    WORDS_PER_BLOCK = int(os.environ.get("WORDS_PER_BLOCK", "2"))
    USAR_MEDIAPIPE = os.environ.get("USAR_MEDIAPIPE", "1") != "0"

    print(textwrap.dedent("""
    ╔══════════════════════════════════════════════════════════════╗
    ║  DubAI PRO — OpusClip IA Pipeline (6 Estágios)              ║
    ║  Link YouTube → yt-dlp → Whisper STT → LLM → MediaPipe →   ║
    ║  ASS Subtitles → FFmpeg Engine → corte_*.mp4 9:16            ║
    ╚══════════════════════════════════════════════════════════════╝
    """))

    try:
        # [1/6] yt-dlp
        arquivo_video = baixar_midia_youtube(URL_YOUTUBE, OUTPUT_VIDEO)

        # [2/6] Whisper STT word-level
        segmentos = transcriver_audio(arquivo_video, model_name=WHISPER_MODEL, word_timestamps=True)

        # [3/6] LLM climax & cortes virais
        cortes_sugeridos = selecionar_melhores_cortes(segmentos)
        print(f"\n🧠 IA selecionou {len(cortes_sugeridos)} cortes potenciais:")
        print(json.dumps(cortes_sugeridos, indent=2, ensure_ascii=False))

        # [4/6 → 6/6] MediaPipe + ASS + FFmpeg
        gerar_cortes_finais(
            arquivo_video, segmentos, cortes_sugeridos,
            pasta_saida=PASTA_SAIDA,
            estilo_legenda=ESTILO_LEGENDA,
            words_per_block=WORDS_PER_BLOCK,
            usar_mediapipe=USAR_MEDIAPIPE,
        )

    except Exception as e:
        import traceback
        print(f"\n❌ Ocorreu um erro na execução: {e}")
        traceback.print_exc()
        sys.exit(1)
