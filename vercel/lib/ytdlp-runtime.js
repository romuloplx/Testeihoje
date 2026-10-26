'use strict';

const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch?v=';
let ytDlpModulePromise;

function getYtDlpModule() {
  if (!ytDlpModulePromise) {
    ytDlpModulePromise = import('@involvex/yt-dlp').then(module => {
      if (typeof module.spawnYtDlp !== 'function') {
        throw new Error('O executável yt-dlp não está disponível neste servidor.');
      }
      return module;
    }).catch(error => {
      ytDlpModulePromise = null;
      throw error;
    });
  }
  return ytDlpModulePromise;
}

function runYtDlpCapture(args, options = {}) {
  return getYtDlpModule().then(({ spawnYtDlp }) => new Promise((resolve, reject) => {
    const signal = options.signal;
    if (signal && signal.aborted) {
      reject(signal.reason || Object.assign(new Error('A consulta foi cancelada.'), { name: 'AbortError' }));
      return;
    }

    let child;
    try {
      child = spawnYtDlp(args);
    } catch (error) {
      reject(error);
      return;
    }

    const stdout = [];
    let stdoutBytes = 0;
    let stderr = '';
    let abortError = null;
    let outputLimitError = null;
    let settled = false;
    let killTimer;

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (killTimer) clearTimeout(killTimer);
    };
    const killChild = () => {
      if (child.exitCode === null && child.signalCode === null) {
        try { child.kill('SIGTERM'); } catch (_) {}
        killTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            try { child.kill('SIGKILL'); } catch (_) {}
          }
        }, 1500);
        if (typeof killTimer.unref === 'function') killTimer.unref();
      }
    };
    const onAbort = () => {
      abortError = signal.reason || Object.assign(new Error('A consulta ao yt-dlp foi cancelada.'), {
        name: 'AbortError',
        code: 'ABORT_ERR'
      });
      killChild();
    };
    const fail = error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', chunk => {
      if (settled) return;
      const buffer = Buffer.from(chunk);
      stdoutBytes += buffer.length;
      if (stdoutBytes > (options.maxOutputBytes || 8 * 1024 * 1024)) {
        outputLimitError = Object.assign(new Error('A resposta do yt-dlp excedeu o limite seguro.'), {
          code: 'YTDLP_OUTPUT_TOO_LARGE'
        });
        killChild();
        return;
      }
      stdout.push(buffer);
    });
    child.stderr.on('data', chunk => {
      if (settled) return;
      stderr = (stderr + Buffer.from(chunk).toString('utf8')).slice(-12000);
    });
    child.once('error', fail);
    child.once('close', code => {
      if (settled) return;
      settled = true;
      cleanup();
      if (abortError) {
        reject(abortError);
      } else if (outputLimitError) {
        reject(outputLimitError);
      } else if (code !== 0) {
        const error = new Error('yt-dlp não conseguiu consultar este vídeo.');
        error.code = 'YTDLP_FAILED';
        error.stderr = stderr;
        reject(error);
      } else {
        resolve(Buffer.concat(stdout).toString('utf8'));
      }
    });
  }));
}

async function getYoutubeVideoInfoWithYtDlp(videoId, signal) {
  const stdout = await runYtDlpCapture([
    '--no-warnings',
    '--js-runtimes',
    `node:${process.execPath}`,
    '--no-playlist',
    '--skip-download',
    '--dump-single-json',
    '--socket-timeout',
    '15',
    `${YOUTUBE_WATCH_URL}${encodeURIComponent(videoId)}`
  ], { signal, maxOutputBytes: 8 * 1024 * 1024 });

  try {
    return JSON.parse(stdout);
  } catch (error) {
    error.code = 'YTDLP_INVALID_JSON';
    throw error;
  }
}

async function spawnYoutubeMp4DownloadWithYtDlp(videoId, formatId) {
  const { spawnYtDlp } = await getYtDlpModule();
  return spawnYtDlp([
    '--no-warnings',
    '--js-runtimes',
    `node:${process.execPath}`,
    '--no-playlist',
    '--no-progress',
    '--quiet',
    '--no-cache-dir',
    '--socket-timeout',
    '20',
    '--format',
    String(formatId),
    '--output',
    '-',
    `${YOUTUBE_WATCH_URL}${encodeURIComponent(videoId)}`
  ]);
}

async function spawnSupportedVideoDownloadWithYtDlp(videoUrl, signal) {
  const { spawnYtDlp } = await getYtDlpModule();
  if (signal && signal.aborted) {
    throw signal.reason || Object.assign(new Error('O download foi cancelado.'), {
      name: 'AbortError',
      code: 'ABORT_ERR'
    });
  }

  return spawnYtDlp([
    '--no-warnings',
    '--js-runtimes',
    `node:${process.execPath}`,
    '--no-playlist',
    '--no-progress',
    '--quiet',
    '--no-cache-dir',
    '--socket-timeout',
    '30',
    '--format',
    'best[ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4]',
    '--output',
    '-',
    videoUrl
  ]);
}

const spawnDouyinMp4DownloadWithYtDlp = spawnSupportedVideoDownloadWithYtDlp;

module.exports = {
  getYoutubeVideoInfoWithYtDlp,
  spawnYoutubeMp4DownloadWithYtDlp,
  spawnDouyinMp4DownloadWithYtDlp,
  spawnSupportedVideoDownloadWithYtDlp
};
