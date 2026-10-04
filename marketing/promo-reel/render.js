#!/usr/bin/env node
/*
 * Frame-accurate MP4 export for index.html.
 *
 * Seeks the GSAP timeline to every frame (no real-time capture, so no dropped
 * frames), screenshots the 1080x1920 stage and pipes PNGs straight into ffmpeg.
 *
 *   node render.js                          -> tallyshot-reel.mp4 (30fps, H.264)
 *   node render.js --fps 60 --out reel60.mp4
 *   node render.js --audio track.mp3        -> muxes a 120 BPM track, trimmed to 15s
 *   node render.js --stills 0.9,4.6,7.5     -> PNG stills only, no video
 *
 * Env: CHROME_PATH=/path/to/chrome to use an installed Chrome instead of
 *      Puppeteer's bundled one. FFMPEG_PATH=/path/to/ffmpeg to override ffmpeg.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const FPS = parseInt(opt('fps', '30'), 10);
const OUT = path.resolve(opt('out', 'tallyshot-reel.mp4'));
const AUDIO = opt('audio', null);
const STILLS = opt('stills', null);
const CRF = opt('crf', '16');
const PAGE = pathToFileURL(path.join(__dirname, 'index.html')).href + '?render';

function ffmpegBin() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { return require('ffmpeg-static'); } catch (_) { return 'ffmpeg'; }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(PAGE, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction('window.__reel', { timeout: 30000 });
  await page.evaluate(() => window.__reel.ready);
  const duration = await page.evaluate(() => window.__reel.duration);
  const clip = { x: 0, y: 0, width: 1080, height: 1920 };

  if (STILLS) {
    const dir = path.resolve(opt('dir', 'stills'));
    fs.mkdirSync(dir, { recursive: true });
    for (const t of STILLS.split(',').map(Number)) {
      await page.evaluate(s => window.__reel.seek(s), t);
      const file = path.join(dir, `t${t.toFixed(2).replace('.', '_')}.png`);
      await page.screenshot({ path: file, clip });
      console.log('wrote', file);
    }
    await browser.close();
    return;
  }

  const total = Math.round(duration * FPS);
  const ff = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  ];
  if (AUDIO) ff.push('-i', AUDIO);
  ff.push(
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-movflags', '+faststart',
  );
  if (AUDIO) ff.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), '-shortest');
  ff.push(OUT);

  const proc = spawn(ffmpegBin(), ff, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => {
    proc.on('error', rej);
    proc.on('close', code => (code === 0 ? res() : rej(new Error('ffmpeg exited with ' + code))));
  });

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate(s => window.__reel.seek(s), i / FPS);
    const buf = await page.screenshot({ clip, type: 'png' });
    if (!proc.stdin.write(buf)) await new Promise(r => proc.stdin.once('drain', r));
    if (i % FPS === 0 || i === total - 1) process.stdout.write(`\rframe ${i + 1}/${total}`);
  }
  proc.stdin.end();
  await done;
  await browser.close();
  console.log(`\nwrote ${OUT} (${total} frames @ ${FPS}fps) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(err => { console.error(err); process.exit(1); });
