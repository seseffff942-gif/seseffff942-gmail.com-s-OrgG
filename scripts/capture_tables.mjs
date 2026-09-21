import puppeteer from 'puppeteer-core';
import path from 'path';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: { width: 1366, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://agricovet.lat', ['geolocation']);
  await page.setGeolocation({ latitude: 14.634915, longitude: -90.506882, accuracy: 8 });

  await page.goto('https://agricovet.lat/#login', { waitUntil: 'networkidle2' });
  const code = await page.$('input[placeholder*="4 d" i]');
  if (code) {
    await code.type('9905');
    const token = await page.$('input[placeholder*="TOKEN" i]');
    if (token) await token.type('123');
    const btn = await page.evaluateHandle(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ingresar')));
    if (btn) await btn.asElement().click();
    await new Promise(r => setTimeout(r, 3000));
  }

  await page.goto('https://agricovet.lat/#visits', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3500));

  // Scroll down to the Cartera & Frecuencia table
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Cartera & Frecuencia'));
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(process.cwd(), 'presentation_assets', '06b_cartera_frecuencia_visitas.png') });

  // Switch to Auditoria de Rutas
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Auditoría de Rutas'));
    if (el) el.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(process.cwd(), 'presentation_assets', '07_auditoria_rutas_visitas.png') });

  await browser.close();
  console.log('CAPTURED 06b and 07!');
}
run().catch(console.error);
