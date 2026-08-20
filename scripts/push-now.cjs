const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = process.cwd();

async function pushNow() {
  console.log('[Git Push] Obteniendo token de GitHub...');
  const token = execSync('gh auth token').toString().trim();
  if (!token) throw new Error('No se pudo obtener el token de GitHub');

  console.log('[Git Push] Verificando estado del repositorio...');
  const statusMatrix = await git.statusMatrix({ fs, dir });

  let modifiedCount = 0;
  for (const row of statusMatrix) {
    const [filepath, head, workdir, stage] = row;
    if (filepath.startsWith('dist/') || filepath.startsWith('.gemini/') || filepath.startsWith('node_modules/')) continue;
    
    if (workdir === 0) {
      // File deleted
      await git.remove({ fs, dir, filepath });
      modifiedCount++;
    } else if (head !== workdir || workdir !== stage) {
      // File added or modified
      if (fs.existsSync(path.join(dir, filepath))) {
        await git.add({ fs, dir, filepath });
        modifiedCount++;
      }
    }
  }

  if (modifiedCount > 0) {
    console.log(`[Git Push] Procesando ${modifiedCount} cambios...`);
    const commitSha = await git.commit({
      fs,
      dir,
      author: {
        name: 'Erick Juarez',
        email: 'seseffff942@gmail.com',
      },
      message: 'Fix: Sincronizacion completa de correlatividad y fechas en GitHub',
    });
    console.log(`[Git Commit] Commit creado: ${commitSha}`);
  } else {
    console.log('[Git Push] No hay cambios sin commit.');
  }

  console.log('[Git Push] Pusheando a origin/main en GitHub...');
  const pushResult = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    onAuth: () => ({ username: token }),
  });

  console.log('SUCCESS_PUSH_GITHUB:', JSON.stringify(pushResult, null, 2));
}

pushNow().catch(console.error);
