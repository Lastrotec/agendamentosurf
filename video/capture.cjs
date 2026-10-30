const { chromium, devices } = require('playwright');
const B = 'http://127.0.0.1:8790', out = __dirname + '/';
(async () => {
  const b = await chromium.launch();
  for (const [name, dev] of [['iphone', devices['iPhone 13']], ['android', devices['Pixel 7']]]) {
    const ctx = await b.newContext({ ...dev, locale: 'pt-BR', timezoneId: 'America/Bahia' });
    const p = await ctx.newPage();
    await p.addInitScript(() => sessionStorage.setItem('outside-splash', '1'));
    await p.goto(B + '/'); await p.waitForTimeout(1500);
    await p.screenshot({ path: out + name + '-site.png' });
    await p.addStyleTag({ content: '.install-pill,.install-banner{display:none!important}' }); await p.waitForTimeout(300);
    await p.screenshot({ path: out + name + '-app.png' });
    if (name === 'iphone') {
      // telas do comercial
      await p.goto(B + '/agendar'); await p.waitForTimeout(800);
      await p.addStyleTag({ content: '.install-pill,.install-banner{display:none!important}' });
      await p.click('text=Praia de Jaguaribe'); await p.waitForTimeout(700);
      await p.locator('.day:not([disabled])').first().click(); await p.waitForTimeout(400);
      await p.locator('.slot-btn:not([disabled])').nth(2).click(); await p.waitForTimeout(500);
      await p.evaluate(() => document.querySelector('.slot-grid')?.scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -120)); await p.waitForTimeout(300);
      await p.screenshot({ path: out + 'c-book.png' });
      await p.evaluate(() => document.querySelector('.fc-card')?.scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -40)); await p.waitForTimeout(300);
      await p.screenshot({ path: out + 'c-forecast.png' });
      await p.locator('.mobile-summary button.btn.full').click(); await p.waitForTimeout(500);
      await p.fill('#a-name', 'Marina Costa'); await p.fill('#a-phone', '7198' + String(Date.now()).slice(-7)); await p.fill('#a-pass', 'onda-boa-77'); await p.check('.check input');
      await p.screenshot({ path: out + 'c-signup.png' });
      await p.click('form.auth-form button[type=submit]'); await p.waitForTimeout(2200);
      await p.screenshot({ path: out + 'c-pix.png' });
    }
    await ctx.close();
  }
  await b.close();
})();
