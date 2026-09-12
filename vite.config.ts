import 'dotenv/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { fileURLToPath } from 'url';

function virtualPwaDevPlugin() {
  const virtualModuleId = 'virtual:pwa-register';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  return {
    name: 'virtual-pwa-register-dev',
    resolveId(id: string) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
    },
    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        return `export function registerSW(options = {}) { if (options.onOfflineReady) options.onOfflineReady(); return () => {}; }`;
      }
    }
  };
}

export default defineConfig(async ({ command }) => {
  const plugins: any[] = [
    react(), 
    tailwindcss(),
    virtualPwaDevPlugin()
  ];

  if (command === 'build') {
    const { VitePWA } = await import('vite-plugin-pwa');
    plugins.push(
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectManifest: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024
        },
        includeAssets: ['agricovet.png', 'logo.png.png', 'vaquitas.jpg', 'whatsapp.wav'],
        manifest: {
          name: 'Agricovet App',
          short_name: 'Agricovet',
          description: 'Sistema de Gestión y Ventas Agricovet',
          theme_color: '#0c5c35',
          background_color: '#0c5c35',
          display: 'standalone',
          icons: [
            {
              src: 'agricovet.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'agricovet.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    );
  }

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '')
    },
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@sentry')) {
                return 'sentry';
              }
              if (id.includes('xlsx')) {
                return 'xlsx';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'charts';
              }
              if (id.includes('supabase') || id.includes('@supabase')) {
                return 'supabase';
              }
              if (id.includes('lucide-react')) {
                return 'lucide';
              }
              return 'vendor';
            }
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR === 'true' ? false : (process.env.USE_WSS_HMR === 'true' ? {
        protocol: 'wss',
        clientPort: 443,
      } : true),
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/android/**', '**/dist/**', '**/.git/**', '**/panic_state.json', '**/*.apk', '**/*.jar', '**/node_modules/**']
      },
    },
  };
});
