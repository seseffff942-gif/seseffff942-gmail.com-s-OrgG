const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = process.cwd();

async function checkAndPush() {
  console.log('[Git Status] Verificando estado del repositorio local...');
  const statusMatrix = await git.statusMatrix({ fs, dir });

  const modifiedOrUntracked = statusMatrix.filter(row => {
    const [filepath, head, workdir, stage] = row;
    // Exclude build artifacts or node_modules or temp scripts
    if (filepath.startsWith('dist/') || filepath.startsWith('.gemini/') || filepath.startsWith('node_modules/')) return false;
    return head !== workdir || workdir !== stage;
  });

  console.log('Archivos pendientes:', modifiedOrUntracked.map(r => r[0]));

  const token = execSync('gh auth token').toString().trim();
  if (!token) throw new Error('No se pudo obtener el token de GitHub CLI');

  if (modifiedOrUntracked.length > 0) {
    for (const [filepath] of modifiedOrUntracked) {
      await git.add({ fs, dir, filepath });
    }
    const commitSha = await git.commit({
      fs,
      dir,
      author: {
        name: 'Erick Juarez',
        email: 'seseffff942@gmail.com',
      },
      message: 'Fix: Sincronizacion final de correlatividad y fechas',
    });
    console.log(`[Git Commit] Creado: ${commitSha}`);
  } else {
    console.log('[Git Status] Árbol de trabajo limpio.');
  }

  console.log('[Git Push] Pusheando a origin/main...');
  const pushResult = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    onAuth: () => ({ username: token }),
  });

  console.log('[Git Push] Resultado:', pushResult);
}

checkAndPush().catch(console.error);
