import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectManifest: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
        },
        includeAssets: ['agricovet.png', 'bottle.png', 'box.png', 'logo.png.png', 'vaquitas.jpg', 'whatsapp.wav'],
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
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
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
      hmr: process.env.DISABLE_HMR === 'true' ? false : {
        protocol: 'wss',
        clientPort: 443,
      },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
