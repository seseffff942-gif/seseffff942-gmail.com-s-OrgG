const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\sesef\\.gemini\\antigravity-ide\\brain\\f74b6af9-f05f-4076-91b9-ce59924b3289\\scratch\\chrome_profile_tmp';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function capture() {
  console.log('🚀 Iniciando Chrome UI Automation...');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1440,900',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      targets = await getJson('http://127.0.0.1:9222/json/list');
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }

  const target = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let msgId = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const res = JSON.parse(event.data);
    if (res.id && callbacks.has(res.id)) {
      const cb = callbacks.get(res.id);
      callbacks.delete(res.id);
      if (res.error) cb.reject(res.error);
      else cb.resolve(res.result);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function takeScreenshot(fileName) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(fileName, buffer);
    console.log(`📸 Captura guardada: ${fileName} (${buffer.length} bytes)`);
  }

  async function evaluate(expression) {
    return await sendCommand('Runtime.evaluate', { expression, returnByValue: true });
  }

  console.log('1. Navegando a localhost:3000...');
  await sendCommand('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2500);

  // Iniciar Sesión como Administrador
  console.log('2. Iniciando sesión interactiva como Administrador (9905 / 123)...');
  await evaluate(`
    (() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(inputs[0], '9905');
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        nativeSetter.call(inputs[1], '123');
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }
    })()
  `);
  await sleep(4000);

  // Navegar a Visitas
  console.log('3. Navegando a Visitas...');
  await evaluate(`
    (() => {
      const visitsBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Visitas'));
      if (visitsBtn) visitsBtn.click();
      else window.location.hash = '#visits';
    })()
  `);
  await sleep(5000);
  await takeScreenshot('evidencia_visitas_mapa.png');

  // Navegar a Facturación
  console.log('4. Navegando a Facturación...');
  await evaluate(`
    (() => {
      const billingBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Facturación'));
      if (billingBtn) billingBtn.click();
      else window.location.hash = '#billing';
    })()
  `);
  await sleep(5000);
  await takeScreenshot('evidencia_facturacion.png');

  // Cerrar sesión
  console.log('5. Cerrando sesión de Administrador e ingresando como Vendedor Herbert Argueta (1521 / 123)...');
  await evaluate(`
    (() => {
      localStorage.clear();
      window.location.hash = '#login';
      window.location.reload();
    })()
  `);
  await sleep(3500);

  // Iniciar Sesión como Vendedor
  await evaluate(`
    (() => {
      const inputs = document.querySelectorAll('input');
      if (inputs.length >= 2) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(inputs[0], '1521');
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        nativeSetter.call(inputs[1], '123');
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }
    })()
  `);
  await sleep(4000);

  // Capturar vista de vendedor (My Sales sin botones admin de n8n o pánico)
  console.log('6. Capturando vista de Vendedor (Mis Ventas sin botones admin)...');
  await takeScreenshot('evidencia_vendedor_sin_botones_admin.png');

  // Navegar a Ventas para demostrar checkout protegido
  console.log('7. Navegando a Ventas como Vendedor (Checkout restringido)...');
  await evaluate(`
    (() => {
      const salesBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Ventas'));
      if (salesBtn) salesBtn.click();
      else window.location.hash = '#sales';
    })()
  `);
  await sleep(4000);
  await takeScreenshot('evidencia_checkout_vendedor.png');

  ws.close();
  chromeProc.kill();
  console.log('🎯 Proceso completado.');
}

capture().catch(err => {
  console.error('Error durante la captura:', err);
  process.exit(1);
});
