const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, recordVideo: { dir: '' + __dirname + '/raw-commercial', size: { width: 1080, height: 1920 } } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8977/commercial.html');
  await p.waitForFunction(() => window.READY);
  await p.waitForTimeout(600);
  const total = await p.evaluate(() => (window.start(), window.TOTAL));
  await p.waitForTimeout(total);
  await ctx.close(); await b.close();
})();
