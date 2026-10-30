const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const os of ['android', 'iphone']) {
    const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, recordVideo: { dir: '' + __dirname + '/raw-' + os, size: { width: 540, height: 960 } } });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8977/install.html#' + os);
    await p.waitForTimeout(800);
    const total = await p.evaluate(() => (window.start(), window.TOTAL));
    await p.waitForTimeout(total);
    await ctx.close();
  }
  await b.close();
})();
