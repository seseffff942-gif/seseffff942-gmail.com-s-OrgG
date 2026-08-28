const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = path.resolve(__dirname, '..');

function isIgnored(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (
    normalized.startsWith('.git/') ||
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('dist/') ||
    normalized.startsWith('.env') ||
    normalized.startsWith('android/app/build/') ||
    normalized.startsWith('android/.gradle/') ||
    normalized.startsWith('android/build/') ||
    normalized.startsWith('.gradle/') ||
    normalized === 'scripts/git-sync.cjs' ||
    normalized === 'scripts/test-compras-pagos.cjs' ||
    normalized.endsWith('.apk') ||
    normalized.endsWith('.aab') ||
    normalized.endsWith('.jar') ||
    normalized.endsWith('.bin') ||
    normalized.endsWith('.log')
  ) {
    return true;
  }
  return false;
}

function getAllFiles(currentDir, baseDir = dir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (isIgnored(relPath + (entry.isDirectory() ? '/' : ''))) continue;

    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, baseDir));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

async function main() {
  console.log('[Git Sync] Obteniendo token de autenticación...');
  let token = process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      token = execSync('"C:\\Program Files\\GitHub CLI\\gh.exe" auth token').toString().trim();
    } catch (e) {
      console.warn('No se pudo obtener token de gh CLI');
    }
  }

  // 1. Current remote HEAD is bf04b47f5db73790d58c2b4cafbf49d2a9d9db52
  const currentRemoteHead = 'bf04b47f5db73790d58c2b4cafbf49d2a9d9db52';
  fs.writeFileSync(path.join(dir, '.git', 'refs', 'heads', 'main'), currentRemoteHead + '\n', 'utf8');

  // 2. Scan ALL valid project files across the workspace
  const allWorkspaceFiles = getAllFiles(dir);
  console.log(`[Git Sync] Escaneando archivos de proyecto completos (${allWorkspaceFiles.length} archivos)...`);

  for (const filepath of allWorkspaceFiles) {
    await git.add({ fs, dir, filepath });
  }

  // 3. Create Commit with full codebase
  const commitMessage = 'fix: restaurar arbol completo del proyecto con index.html y modulos para despliegue en Vercel';
  
  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: 'seseffff942-gif',
      email: 'seseffff942@gmail.com'
    },
    message: commitMessage
  });
  console.log('[Git Sync] Commit completo creado:', sha);

  // Verify key files in the commit
  const commitFiles = await git.listFiles({ fs, dir, ref: sha });
  console.log(`[Git Sync] Total archivos en el commit: ${commitFiles.length}`);
  console.log('  - index.html presente?:', commitFiles.includes('index.html'));
  console.log('  - vite.config.ts presente?:', commitFiles.includes('vite.config.ts'));
  console.log('  - server.ts presente?:', commitFiles.includes('server.ts'));
  console.log('  - src/App.tsx presente?:', commitFiles.includes('src/App.tsx'));

  if (!commitFiles.includes('index.html')) {
    throw new Error('¡ERROR CRÍTICO: index.html no está en el commit!');
  }

  // 4. Push to remote origin
  console.log('[Git Sync] Enviando cambios a GitHub (git push origin main)...');
  const pushResult = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    force: false,
    onAuth: () => ({
      username: 'seseffff942-gif',
      password: token
    }),
    onProgress: (p) => {
      console.log(`[Git Push] ${p.phase}: ${p.loaded} / ${p.total || '?'}`);
    }
  });

  console.log('[Git Sync] ¡PUSH COMPLETADO CON ÉXITO!', JSON.stringify(pushResult, null, 2));
}

main().catch(err => {
  console.error('[Git Sync Error]:', err);
  process.exit(1);
});
