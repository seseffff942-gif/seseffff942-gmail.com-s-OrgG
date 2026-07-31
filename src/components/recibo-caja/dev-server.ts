import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startReciboServer() {
  const app = express();
  const PORT = process.env.PORT || 3005;

  // Integrar middleware dev de Vite
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  app.use(vite.middlewares);

  // Ruta principal para servir el HTML del Recibo de Caja
  app.get('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const htmlPath = path.resolve(__dirname, 'standalone.html');
      let template = await vite.transformIndexHtml(url, `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recibo de Caja - Agricovet (80mm Térmico)</title>
    <script type="module" src="/src/components/recibo-caja/ReciboCajaApp.tsx"></script>
  </head>
  <body class="bg-slate-100">
    <div id="root"></div>
  </body>
</html>
      `);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🧾 Servidor Recibo de Caja Agricovet Activo:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`==================================================\n`);
  });
}

startReciboServer();
