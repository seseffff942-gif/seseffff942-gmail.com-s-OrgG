const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = process.cwd();

async function pushAllSalesFix() {
  const token = execSync('gh auth token').toString().trim();

  const statusMatrix = await git.statusMatrix({ fs, dir });
  let modifiedCount = 0;
  for (const row of statusMatrix) {
    const [filepath, head, workdir, stage] = row;
    if (filepath.startsWith('dist/') || filepath.startsWith('.gemini/') || filepath.startsWith('node_modules/')) continue;
    if (workdir === 0) {
      await git.remove({ fs, dir, filepath });
      modifiedCount++;
    } else if (head !== workdir || workdir !== stage) {
      if (fs.existsSync(path.join(dir, filepath))) {
        await git.add({ fs, dir, filepath });
        modifiedCount++;
      }
    }
  }

  console.log(`Archivos modificados: ${modifiedCount}`);

  if (modifiedCount > 0) {
    const sha = await git.commit({
      fs, dir, ref: 'refs/heads/main',
      author: { name: 'Erick Juarez', email: 'seseffff942@gmail.com' },
      message: 'Fix: Mostrar todas las ventas del día en Ventas Diarias + botón Actualizar + total general global',
    });
    fs.writeFileSync(path.join(dir, '.git', 'refs', 'heads', 'main'), sha + '\n');
    console.log(`Commit: ${sha}`);
  }

  const pushRes = await git.push({
    fs, http, dir, remote: 'origin', ref: 'refs/heads/main', remoteRef: 'refs/heads/main',
    onAuth: () => ({ username: token }),
  });
  console.log('Push Result:', JSON.stringify(pushRes.ok ? { ok: true } : pushRes, null, 2));
}

pushAllSalesFix().catch(console.error);
