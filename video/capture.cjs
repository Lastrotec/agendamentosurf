const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [name, dev] of [['iphone', devices['iPhone 13']], ['android', devices['Pixel 7']]]) {
    const ctx = await b.newContext({ ...dev, locale: 'pt-BR', timezoneId: 'America/Bahia' });
    const p = await ctx.newPage();
    await p.addInitScript(() => sessionStorage.setItem('outside-splash', '1'));
    await p.goto('http://127.0.0.1:8790/');
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `/tmp/claude-0/video/${name}-site.png` });
    await p.addStyleTag({ content: '.install-pill,.install-banner{display:none!important}' });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `/tmp/claude-0/video/${name}-app.png` });
    await ctx.close();
  }
  await b.close();
})();
