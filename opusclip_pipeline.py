# Dependências do Python
# pip install yt-dlp openai-whisper openai moviepy
# Ter o FFmpeg instalado no sistema operacional (necessário para o yt-dlp e moviepy)

import os
import json
import yt_dlp
import whisper
from openai import OpenAI
from moviepy.editor import VideoFileClip

# 1. CONFIGURAÇÕES E CHAVES
# Usa variável de ambiente OPENAI_API_KEY (ou UNOROUTER_API_KEY) ou substitua abaixo
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY") or os.environ.get("UNOROUTER_API_KEY") or "SUA_CHAVE_OPENAI_AQUI"
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL") or (
    "https://api.unorouter.com/v1" if OPENAI_API_KEY.startswith("sk-mwg") else None
)
client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL) if OPENAI_BASE_URL else OpenAI(api_key=OPENAI_API_KEY)


# ---------------------------------------------------------
# ETAPA 1: Download do Áudio e Vídeo (yt-dlp)
# ---------------------------------------------------------
def baixar_midia_youtube(url_youtube, output_path="video_original.mp4"):
    print("[1/4] Baixando vídeo do YouTube...")
    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": output_path,
        "overwrites": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url_youtube])
    print("Download concluído!")
    return output_path


# ---------------------------------------------------------
# ETAPA 2: Transcrição com Timestamps (Whisper)
# ---------------------------------------------------------
def transcriver_audio(video_path):
    print("[2/4] Transcrevendo áudio com Whisper...")
    # Usa o modelo 'base' (rápido). Use 'small', 'medium' ou 'large' para maior precisão.
    model = whisper.load_model("base")
    resultado = model.transcribe(video_path, verbose=False)

    # Extrai trechos formatados com tempo
    segmentos = []
    for seg in resultado["segments"]:
        segmentos.append(
            {
                "inicio": round(seg["start"], 2),
                "fim": round(seg["end"], 2),
                "texto": seg["text"].strip(),
            }
        )
    print("Transcrição concluída!")
    return segmentos


# ---------------------------------------------------------
# ETAPA 3: Curadoria Semântica (Análise pela IA / LLM)
# ---------------------------------------------------------
def selecionar_melhores_cortes(transcricao_segmentos):
    print("[3/4] Analisando texto com IA para selecionar os melhores ganchos...")

    prompt_sistema = """
    Você é um editor especialista em vídeos virais (TikTok, Reels, YouTube Shorts).
    Sua tarefa é analisar a transcrição de um vídeo com timestamps e identificar de 1 a 3 cortes virais.

    Regras:
    - Cada corte deve ter entre 30 e 90 segundos.
    - O corte precisa ter uma história completa (Gancho forte no início, desenvolvimento, conclusão).
    - Retorne ESTRITAMENTE um JSON válido no formato:
    {
      "cortes": [
        {
          "titulo": "Título Curto do Corte",
          "inicio": 12.5,
          "fim": 55.0,
          "score_viralidade": 85,
          "motivo": "Explicacao breve"
        }
      ]
    }
    """

    prompt_usuario = f"Transcrição do vídeo:\n{json.dumps(transcricao_segmentos, ensure_ascii=False)}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",  # Ou gpt-4o para maior precisão
        messages=[
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario},
        ],
        response_format={"type": "json_object"},
    )

    resultado_json = json.loads(response.choices[0].message.content)
    # Garante que seja uma lista de cortes
    cortes = (
        resultado_json.get("cortes", resultado_json.get("clips", resultado_json))
        if isinstance(resultado_json, dict)
        else resultado_json
    )
    return cortes


# ---------------------------------------------------------
# ETAPA 4: Renderização dos Cortes + Crop Vertical (MoviePy / FFmpeg)
# ---------------------------------------------------------
def gerar_cortes_finais(video_path, lista_cortes, pasta_saida="cortes_gerados"):
    print("[4/4] Cortando e formatando vídeos para o formato 9:16 (Vertical)...")
    if not os.path.exists(pasta_saida):
        os.makedirs(pasta_saida)

    video = VideoFileClip(video_path)
    largura_orig, altura_orig = video.size

    # Cálculo para Crop Centralizado 9:16 (1080x1920)
    nova_largura = int(altura_orig * (9 / 16))
    x_center = largura_orig / 2
    x1 = max(0, x_center - (nova_largura / 2))
    x2 = min(largura_orig, x_center + (nova_largura / 2))

    for idx, corte in enumerate(lista_cortes):
        t_inicio = corte["inicio"]
        t_fim = corte["fim"]

        print(
            f" Renderizando Corte {idx+1}: {corte.get('titulo', 'Corte')} ({t_inicio}s - {t_fim}s)..."
        )

        # Recorta o tempo
        subclip = video.subclip(t_inicio, t_fim)

        # Aplica o Crop 9:16
        clip_vertical = subclip.crop(x1=x1, y1=0, x2=x2, y2=altura_orig)

        # Nome do arquivo final
        nome_arquivo = f"{pasta_saida}/corte_{idx+1}.mp4"
        clip_vertical.write_videofile(
            nome_arquivo,
            codec="libx264",
            audio_codec="aac",
            preset="fast",
        )
        print(f" Saved: {nome_arquivo}")

    video.close()
    print("\n Concluído! Todos os cortes foram salvos na pasta:", pasta_saida)


# ---------------------------------------------------------
# EXECUÇÃO FLUXO COMPLETO
# ---------------------------------------------------------
if __name__ == "__main__":
    # Cole a URL do YouTube que você quer processar
    URL_YOUTUBE = os.environ.get("URL_YOUTUBE", "https://www.youtube.com/watch?v=EXEMPLO")

    try:
        # 1. Download
        arquivo_video = baixar_midia_youtube(URL_YOUTUBE)

        # 2. Transcrição
        segmentos = transcriver_audio(arquivo_video)

        # 3. Análise com LLM
        cortes_sugeridos = selecionar_melhores_cortes(segmentos)
        print(f"\nA IA selecionou {len(cortes_sugeridos)} cortes potenciais:")
        print(json.dumps(cortes_sugeridos, indent=2, ensure_ascii=False))

        # 4. Processamento dos Vídeos
        gerar_cortes_finais(arquivo_video, cortes_sugeridos)

    except Exception as e:
        print(f"\n Ocorreu um erro na execução: {str(e)}")
