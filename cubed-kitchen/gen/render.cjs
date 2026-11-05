// usage: node render.cjs full <jobdir>      -> jobdir/main.mp4, jobdir/hook.mp4, jobdir/audio.json
//        node render.cjs preview <jobdir> f1,f2,...  -> jobdir/prev/*.jpg
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const ROOT = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const PORT = 8700 + Math.floor(Math.random() * 200);
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(PORT);
const ffmpeg = out => spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
async function write(ff, url) { const b = Buffer.from(url.split(',')[1], 'base64'); if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r)); }
(async () => {
  const [mode, job, frames] = process.argv.slice(2);
  const jobRel = path.relative(ROOT, path.resolve(job));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 1800000,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[err]', e.message));
  page.on('console', m => { const t = m.text(); if (/error|ERROR/.test(t)) console.log('[page]', t.slice(0, 300)); });
  await page.setViewport({ width: 576, height: 1024 });
  await page.goto(`http://localhost:${PORT}/index.html?job=${encodeURIComponent(jobRel)}`);
  await page.waitForFunction('window.READY === true', { timeout: 120000 });
  const info = await page.evaluate(() => ({ n: SCENE.nframes, hook: SCENE.hook, food: SCENE.food, info: SCENE.info }));
  console.log(JSON.stringify(info));
  if (mode === 'preview') {
    fs.mkdirSync(path.join(job, 'prev'), { recursive: true });
    for (const f of frames.split(',').map(Number)) {
      const t0 = Date.now(); const url = await page.evaluate(f => SCENE.frame(f), f);
      fs.writeFileSync(path.join(job, 'prev', `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      console.log('frame', f, Date.now() - t0, 'ms', await page.evaluate(() => JSON.stringify({sim: Math.round(window.TSIM||0), gl: Math.round(window.TGL||0)})));
    }
  } else {
    const main = ffmpeg(path.join(job, 'main.mp4')), hook = ffmpeg(path.join(job, 'hook.mp4'));
    const t0 = Date.now();
    for (let f = 0; f < info.n; f++) {
      await write(main, await page.evaluate(f => SCENE.frame(f), f));
      if (f >= info.hook[0] && f < info.hook[1]) await write(hook, await page.evaluate(() => SCENE.rawFrame()));
      if (f % 60 === 0) console.log(`frame ${f}/${info.n} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    main.stdin.end(); hook.stdin.end();
    await Promise.all([new Promise(r => main.on('close', r)), new Promise(r => hook.on('close', r))]);
    fs.writeFileSync(path.join(job, 'audio.json'), JSON.stringify(await page.evaluate(() => SCENE.audioLog())));
    console.log('RENDER_DONE');
  }
  await browser.close(); srv.close();
})();
