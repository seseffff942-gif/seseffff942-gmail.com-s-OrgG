// Vercel Serverless Function entry point
let appInstance: any = null;

export default function handler(req: any, res: any) {
  if (!appInstance) {
    try {
      // Priority: use the pre-bundled server with all TS modules resolved
      const serverModule = require('../dist/server.cjs');
      appInstance = serverModule.default || serverModule.app || serverModule;
    } catch (err) {
      console.warn('Failed to load dist/server.cjs, trying fallback:', err);
      try {
        const tsServer = require('../server');
        appInstance = tsServer.default || tsServer.app || tsServer;
      } catch (fallbackErr) {
        console.error('Server loading failed completely:', fallbackErr);
        return res.status(500).json({ error: 'Server initialization error', details: String(fallbackErr) });
      }
    }
  }

  return appInstance(req, res);
}
