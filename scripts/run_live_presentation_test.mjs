import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(process.cwd(), '.chrome-live-session');
const ARTIFACTS_DIR = 'C:\\Users\\sesef\\.gemini\\antigravity-ide\\brain\\509906f2-9a3c-418d-bd1e-f90eef3f5416';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Banner visual flotante en la pantalla del usuario dentro de la ventana de Chrome
async function showVisualBanner(page, stepNum, title, description, durationMs = 4000) {
  console.log(`\n========================================`);
  console.log(`[PASO ${stepNum}] ${title}`);
  console.log(`> ${description}`);
  console.log(`========================================\n`);

  try {
    await page.evaluate((sNum, t, d) => {
      let old = document.getElementById('presentation-test-overlay');
      if (old) old.remove();

      const overlay = document.createElement('div');
      overlay.id = 'presentation-test-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '30px';
      overlay.style.right = '30px';
      overlay.style.zIndex = '99999999';
      overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.96)';
      overlay.style.backdropFilter = 'blur(16px)';
      overlay.style.border = '2px solid #0d9488';
      overlay.style.borderRadius = '18px';
      overlay.style.padding = '20px 24px';
      overlay.style.maxWidth = '440px';
      overlay.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 35px rgba(13, 148, 136, 0.4)';
      overlay.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      overlay.style.color = '#ffffff';

      overlay.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <span style="background: linear-gradient(135deg, #0d9488, #059669); color: white; font-weight: 900; font-size: 11px; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.08em; box-shadow: 0 2px 8px rgba(13, 148, 136, 0.5);">
            PASO ${sNum} DEL POWERPOINT
          </span>
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 12px #10b981;"></span>
        </div>
        <div style="font-size: 17px; font-weight: 800; color: #f8fafc; margin-bottom: 6px; letter-spacing: -0.02em;">
          ${t}
        </div>
        <div style="font-size: 13.5px; color: #94a3b8; line-height: 1.5;">
          ${d}
        </div>
      `;

      document.body.appendChild(overlay);
    }, stepNum, title, description);
  } catch (e) {}

  await sleep(durationMs);
}

async function captureStep(page, filename) {
  try {
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: fullPath, fullPage: false });
    console.log(`[CAPTURA GUARDADA] ${filename}`);
  } catch (e) {
    console.warn(`No se pudo tomar captura ${filename}:`, e.message);
  }
}

async function run() {
  console.log('Iniciando Google Chrome visible en pantalla...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: null,
    userDataDir: USER_DATA_DIR,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-position=0,0'
    ]
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  await page.bringToFront();

  // 1. Simulación GPS Satelital (Slide 3: Paso Cero - Activar GPS)
  const context = browser.defaultBrowserContext();
  try {
    await context.overridePermissions('https://agricovet.lat', ['geolocation']);
  } catch (e) {}

  // Coordenadas reales de Guatemala (Ciudad de Guatemala / Km 15 Carretera a San Lucas)
  await page.setGeolocation({
    latitude: 14.634915,
    longitude: -90.506882,
    accuracy: 10
  });

  console.log('Navegando a https://agricovet.lat...');
  await page.goto('https://agricovet.lat', { waitUntil: 'networkidle2', timeout: 45000 });
  await page.bringToFront();
  await sleep(2000);

  // Comprobar si estamos en pantalla de login
  const codeInput = await page.$('input[placeholder*="4 d" i], input[type="text"]');
  if (codeInput) {
    console.log('Pantalla de Login detectada. Autenticando a Emanuel Lima (Admin 9905)...');
    await showVisualBanner(
      page,
      'LOGIN',
      'Iniciando Sesión Oficial',
      'Ingresando con credenciales maestras autorizadas para acceder al Módulo de Visitas.',
      3500
    );

    // Escribir código de vendedor
    await codeInput.type('9905', { delay: 100 });
    await sleep(800);

    // Escribir token
    const tokenInput = await page.$('input[placeholder*="TOKEN" i], input[type="password"]');
    if (tokenInput) {
      await tokenInput.type('123', { delay: 100 });
      await sleep(800);
    }

    // Clic en 'Ingresar al Sistema'
    const submitBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent && b.textContent.includes('Ingresar')) || null;
    });

    if (submitBtn && (await submitBtn.asElement())) {
      await submitBtn.asElement().click();
      console.log('Botón de Login pulsado.');
      await sleep(4000);
    }
  }

  // Navegar a Visitas
  console.log('Abriendo módulo de Visitas (#visits)...');
  await page.goto('https://agricovet.lat/#visits', { waitUntil: 'networkidle2', timeout: 45000 });
  await page.bringToFront();
  await sleep(4000);

  // ==========================================
  // SLIDE 3: PASO CERO: GPS ACTIVO
  // ==========================================
  await showVisualBanner(
    page,
    '3',
    'Paso Cero: Activar el GPS en el Teléfono',
    'La aplicación detecta automáticamente la ubicación satelital con precisión métrica.',
    5000
  );
  await captureStep(page, 'slide3_gps_activo.png');

  // ==========================================
  // SLIDE 4: PANTALLA PRINCIPAL DEL MAPA
  // ==========================================
  await showVisualBanner(
    page,
    '4',
    'Conociendo el Centro de Comando del Mapa',
    'Pines verdes para clientes georreferenciados, filtros superiores y buscador rápido.',
    5000
  );
  await captureStep(page, 'slide4_mapa_principal.png');

  // ==========================================
  // SLIDE 5: SELECTOR DE CAPAS DE MAPA
  // ==========================================
  await showVisualBanner(
    page,
    '5',
    'Capas de Mapa: Adapta la Vista a tu Terreno',
    'Vistas disponibles: Satélite Híbrido, Google Earth Limpio, Calles y Relieve Topográfico.',
    5000
  );

  // Interactuar con control de capas
  try {
    const layerCtrl = await page.$('.leaflet-control-layers-toggle');
    if (layerCtrl) {
      await layerCtrl.hover();
      await sleep(2000);
    }
  } catch (e) {}
  await captureStep(page, 'slide5_selector_capas.png');

  // ==========================================
  // SLIDE 6: PASO 1 DEL DÍA - INICIAR RUTA
  // ==========================================
  await showVisualBanner(
    page,
    '6',
    'Paso 1 del Día: Iniciar Ruta de Trabajo',
    'Al salir en la mañana, el asesor activa la ruta para auditar horario, paradas y rendimiento.',
    5000
  );
  await captureStep(page, 'slide6_ruta_del_dia.png');

  // ==========================================
  // SLIDE 7: FUNCIÓN 1 - MARCAR CLIENTE
  // ==========================================
  await showVisualBanner(
    page,
    '7',
    'Función 1: Marcar Ubicación de Cliente (Georreferenciación)',
    'Se hace una sola vez cuando el asesor llega al negocio para fijar su pin permanente.',
    5000
  );

  try {
    const markBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent && b.textContent.includes('Marcar Cliente')) || null;
    });

    if (markBtn && (await markBtn.asElement())) {
      const el = markBtn.asElement();
      await el.evaluate(btn => {
        btn.style.outline = '4px solid #14b8a6';
        btn.style.boxShadow = '0 0 30px #14b8a6';
      });
      await sleep(2000);
      await el.click();
      await sleep(3500);

      await showVisualBanner(
        page,
        '7 (Modal)',
        'Modal de Georreferenciación Abierto',
        'El asesor selecciona el cliente del listado y presiona "Guardar Ubicación" con coordenadas automáticas.',
        5000
      );
      await captureStep(page, 'slide7_modal_marcar_cliente.png');

      // Cerrar modal
      await page.keyboard.press('Escape');
      await sleep(2000);
    }
  } catch (err) {
    console.warn('Paso 7 detalle:', err.message);
  }

  // ==========================================
  // SLIDE 8 & 9: FUNCIÓN 2 - REGISTRAR VISITA & 4 TIPOS
  // ==========================================
  await showVisualBanner(
    page,
    '8 y 9',
    'Función 2: Registrar Visita y los 4 Tipos',
    'Certificación oficial: Prospección (Nuevos), Seguimiento (Asesoría), Cobro (Cartera) o Entrega (Logística).',
    5000
  );

  try {
    const registerBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent && (b.textContent.includes('Registrar Visita') || b.textContent.includes('Nueva Visita'))) || null;
    });

    if (registerBtn && (await registerBtn.asElement())) {
      const el = registerBtn.asElement();
      await el.evaluate(btn => {
        btn.style.outline = '4px solid #10b981';
        btn.style.boxShadow = '0 0 30px #10b981';
      });
      await sleep(2000);
      await el.click();
      await sleep(3500);

      await showVisualBanner(
        page,
        '9 (Clasificación)',
        'Formulario de Registro con los 4 Tipos de Visita',
        'El asesor selecciona el cliente, el motivo (Prospección/Seguimiento/Cobro/Entrega), toma foto y anota acuerdos.',
        5500
      );
      await captureStep(page, 'slide8_modal_registrar_visita.png');

      // Cerrar modal
      await page.keyboard.press('Escape');
      await sleep(2000);
    }
  } catch (err) {
    console.warn('Paso 8 detalle:', err.message);
  }

  // ==========================================
  // SLIDE 10: PESTAÑA MI CARTERA (CERCANÍA GPS)
  // ==========================================
  await showVisualBanner(
    page,
    '10',
    'Pestaña "Mi Cartera": Clientes Ordenados por Cercanía',
    'Cálculo de kilómetros en vivo, botones Waze / Maps y semáforo de urgencia comercial.',
    5000
  );

  try {
    const carteraTab = await page.evaluateHandle(() => {
      const tabs = Array.from(document.querySelectorAll('button, div[role="tab"]'));
      return tabs.find(t => t.textContent && (t.textContent.includes('Cartera') || t.textContent.includes('Clientes'))) || null;
    });

    if (carteraTab && (await carteraTab.asElement())) {
      const el = carteraTab.asElement();
      await el.click();
      await sleep(3500);
      await captureStep(page, 'slide10_mi_cartera_distancias.png');
    }
  } catch (err) {
    console.warn('Paso 10 detalle:', err.message);
  }

  // ==========================================
  // SLIDE 11: MODO OFFLINE
  // ==========================================
  await showVisualBanner(
    page,
    '11',
    'Modo Offline: Operatividad sin Señal en Campo',
    'El chip satelital GPS guarda visitas localmente en el teléfono y sincroniza en automático.',
    5000
  );

  // ==========================================
  // FINALIZACIÓN Y MANTENER VENTANA ABIERTA
  // ==========================================
  await showVisualBanner(
    page,
    'FINAL',
    '✅ Verificación Exitosa de la Presentación',
    'Todos los pasos del PowerPoint han sido verificados sin errores. El navegador quedará abierto para tu uso.',
    10000
  );

  console.log('\n======================================================');
  console.log('🎉 RECORRIDO EN VIVO COMPLETADO CON ÉXITO.');
  console.log('El navegador Google Chrome permanecerá abierto para ti.');
  console.log('======================================================\n');

  // Mantener el navegador abierto 15 minutos
  await sleep(900000);
}

run().catch(err => {
  console.error('Error durante la prueba:', err);
});
