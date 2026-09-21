import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(process.cwd(), '.chrome-shots-session');
const OUTPUT_DIR = path.join(process.cwd(), 'presentation_assets');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- CAPTURANDO PANTALLAS REALES DE AGRICOVET EN ALTA RESOLUCIÓN ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1366, height: 768, deviceScaleFactor: 2 },
    userDataDir: USER_DATA_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  // Permiso GPS y Coordenadas de Guatemala
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://agricovet.lat', ['geolocation']);
  await page.setGeolocation({
    latitude: 14.634915,
    longitude: -90.506882,
    accuracy: 8
  });

  // 1. CAPTURA: PANTALLA DE LOGIN INICIAL
  console.log('1. Capturando Pantalla de Login...');
  await page.goto('https://agricovet.lat/#login', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_login_asesor.png') });

  // Autenticar con Emanuel Lima (Admin 9905)
  console.log('Autenticando...');
  const codeInput = await page.$('input[placeholder*="4 d" i], input[type="text"]');
  if (codeInput) {
    await codeInput.type('9905', { delay: 50 });
    const tokenInput = await page.$('input[placeholder*="TOKEN" i], input[type="password"]');
    if (tokenInput) await tokenInput.type('123', { delay: 50 });
    const submitBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent && b.textContent.includes('Ingresar')) || null;
    });
    if (submitBtn && (await submitBtn.asElement())) {
      await submitBtn.asElement().click();
      await sleep(3500);
    }
  }

  // 2. CAPTURA: ENTRAR POR PRIMERA VEZ A VISITAS (CENTRO DE COMANDO & GPS)
  console.log('2. Capturando Pantalla Principal de Visitas...');
  await page.goto('https://agricovet.lat/#visits', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(4000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_pantalla_principal_visitas.png') });

  // 3. CAPTURA: MODAL MARCAR CLIENTE (PASO A PASO: PRIMERA VEZ)
  console.log('3. Capturando Modal Marcar Cliente...');
  const markBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent && (b.textContent.includes('Fijar GPS') || b.textContent.includes('Marcar Cliente'))) || null;
  });

  if (markBtn && (await markBtn.asElement())) {
    await markBtn.asElement().click();
    await sleep(2500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_modal_fijar_gps_cliente.png') });

    // Filtrar un cliente para ver el paso de búsqueda
    const searchInput = await page.$('input[placeholder*="Buscar por Nombre" i]');
    if (searchInput) {
      await searchInput.type('Agro', { delay: 100 });
      await sleep(1500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '04_busqueda_cliente_para_marcar.png') });
    }

    // Cerrar modal usando el botón Cancelar
    const cancelBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent && b.textContent.includes('Cancelar')) || null;
    });
    if (cancelBtn && (await cancelBtn.asElement())) {
      await cancelBtn.asElement().click();
      await sleep(1500);
    }
  }

  // 4. CAPTURA: MODAL REGISTRAR VISITA (FORMULARIO RUTINARIO)
  console.log('4. Capturando Modal Registrar Visita...');
  const registerBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent && (b.textContent.includes('Registrar Visita GPS') || b.textContent.includes('Registrar Visita'))) || null;
  });

  if (registerBtn && (await registerBtn.asElement())) {
    await registerBtn.asElement().click();
    await sleep(2500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_modal_registrar_visita.png') });

    // Seleccionar el primer cliente para ver el formulario completo desplegado
    const firstClientItem = await page.evaluateHandle(() => {
      const items = Array.from(document.querySelectorAll('div, button'));
      return items.find(el => el.textContent && el.textContent.includes('#4869') || el.textContent.includes('ABNER GUERRA')) || null;
    });
    if (firstClientItem && (await firstClientItem.asElement())) {
      await firstClientItem.asElement().click();
      await sleep(1500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, '05b_formulario_visita_desplegado.png') });
    }

    // Cerrar modal
    const closeRegBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent && b.textContent.includes('Cancelar')) || null;
    });
    if (closeRegBtn && (await closeRegBtn.asElement())) {
      await closeRegBtn.asElement().click();
      await sleep(1500);
    }
  }

  // 5. CAPTURA: PESTAÑA 'MI CARTERA' CON DISTANCIAS Y BOTONES WAZE/MAPS
  console.log('5. Capturando Pestaña Mi Cartera...');
  const carteraTab = await page.evaluateHandle(() => {
    const tabs = Array.from(document.querySelectorAll('button, div[role="tab"]'));
    return tabs.find(t => t.textContent && (t.textContent.includes('Cartera') || t.textContent.includes('Clientes'))) || null;
  });

  if (carteraTab && (await carteraTab.asElement())) {
    await carteraTab.asElement().click();
    await sleep(3500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06_cartera_ordenada_distancia.png') });
  }

  // 6. CAPTURA: VISTAS MÓVILES (SMARTPHONE EN TERRENO)
  console.log('6. Capturando Vistas Móviles (Smartphone en Terreno)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto('https://agricovet.lat/#visits', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(3500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08_vista_movil_mapa.png') });

  // Modal marcar en móvil
  const mobileMarkBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent && (b.textContent.includes('Fijar GPS') || b.textContent.includes('Marcar'))) || null;
  });
  if (mobileMarkBtn && (await mobileMarkBtn.asElement())) {
    await mobileMarkBtn.asElement().click();
    await sleep(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '09_movil_modal_marcar.png') });
  }

  await browser.close();
  console.log('--- TODAS LAS CAPTURAS COMPLETADAS EXITOSAMENTE ---');
}

run().catch(err => {
  console.error('Error capturando pantallas:', err);
});
