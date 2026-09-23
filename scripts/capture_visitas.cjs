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
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function captureVisitas() {
  console.log('🚀 Capturando pantalla de Visitas y Rutas...');

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

  async function evaluate(expression) {
    return await sendCommand('Runtime.evaluate', { expression, returnByValue: true });
  }

  console.log('1. Navegando e iniciando sesión Admin...');
  await sendCommand('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2500);

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
  await sleep(3500);

  console.log('2. Clic en pestaña Visitas...');
  await evaluate(`
    (() => {
      const navItems = Array.from(document.querySelectorAll('button, a'));
      const v = navItems.find(el => el.textContent.trim().startsWith('Visitas') || el.innerText?.includes('Visitas'));
      if (v) v.click();
      else window.location.hash = '#visits';
    })()
  `);
  await sleep(6000);

  const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(res.data, 'base64');
  fs.writeFileSync('evidencia_visitas_mapa.png', buffer);
  console.log(`📸 Captura de Visitas guardada: evidencia_visitas_mapa.png (${buffer.length} bytes)`);

  ws.close();
  chromeProc.kill();
}

captureVisitas().catch(console.error);
