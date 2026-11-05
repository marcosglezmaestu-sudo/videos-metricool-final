// usage: node render.js preview f1,f2,... | node render.js full out.mp4 [fk]
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const ROOT = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8765);

(async () => {
  const [mode, arg, fk] = process.argv.slice(2);
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=720,1280'],
  });
  const page = await browser.newPage();
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.setViewport({ width: 720, height: 1280 });
  await page.goto(`http://localhost:8765/${process.env.PAGE || 'index.html'}?fk=${fk || 72}`);
  await page.waitForFunction('window.READY === true', { timeout: 60000 });
  const info = await page.evaluate(() => ({ n: SCENE.nframes, total: SCENE.total, info: SCENE.info }));
  console.log(JSON.stringify(info));
  if (mode === 'events') {
    fs.writeFileSync(arg, JSON.stringify({ total: info.total, events: await page.evaluate(() => SCENE.events()) }));
  } else if (mode === 'preview') {
    fs.mkdirSync(path.join(ROOT, 'prev'), { recursive: true });
    for (const f of arg.split(',').map(Number)) {
      const t0 = Date.now();
      const url = await page.evaluate(f => SCENE.frame(f), f);
      fs.writeFileSync(path.join(ROOT, 'prev', `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      console.log('frame', f, Date.now() - t0, 'ms');
    }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', arg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    // sequential render (state like counters' pop timers depends on order)
    for (let f = 0; f < info.n; f++) {
      const url = await page.evaluate(f => SCENE.frame(f), f);
      const buf = Buffer.from(url.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) console.log(`frame ${f}/${info.n} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close(); srv.close();
})();
