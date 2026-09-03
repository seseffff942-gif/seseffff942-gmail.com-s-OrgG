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
    normalized.startsWith('.env') ||
    normalized.startsWith('android/app/build/') ||
    normalized.startsWith('android/.gradle/') ||
    normalized.startsWith('android/build/') ||
    normalized.startsWith('.gradle/') ||
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
  const ghPath = path.join('C:', 'Program Files', 'GitHub CLI', 'gh.exe');
  let token = process.env.GITHUB_TOKEN;
  if (!token && fs.existsSync(ghPath)) {
    token = execSync(`"${ghPath}" auth token`).toString().trim();
  }

  if (!token) {
    throw new Error('No GitHub token found');
  }

  const repoUrl = 'https://github.com/seseffff942-gif/seseffff942-gmail.com-s-OrgG.git';

  // 1. Scan and stage all files
  const files = getAllFiles(dir);
  console.log(`[Git Sync] Staging ${files.length} files...`);
  for (const f of files) {
    await git.add({ fs, dir, filepath: f });
  }

  // 2. Commit
  const commitMsg = 'feat: incluir destinatarios con nombreDestinatario y telefonos formateados con codigo de pais (502) en webhook de ventas n8n';
  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: 'seseffff942-gif',
      email: 'seseffff942@gmail.com'
    },
    message: commitMsg
  });
  console.log('[Git Sync] New Commit SHA:', sha);

  // Update local main ref
  fs.writeFileSync(path.join(dir, '.git', 'refs', 'heads', 'main'), sha + '\n', 'utf8');

  // 3. Push to GitHub
  console.log('[Git Sync] Pushing to GitHub remote...');
  const pushResult = await git.push({
    fs,
    http,
    dir,
    url: repoUrl,
    remoteRef: 'refs/heads/main',
    ref: 'refs/heads/main',
    force: true,
    onAuth: () => ({
      username: 'seseffff942-gif',
      password: token
    }),
    onProgress: (p) => {
      console.log(`[Git Push] ${p.phase}: ${p.loaded} / ${p.total || '?'}`);
    }
  });

  console.log('[Git Sync] Push result:', JSON.stringify(pushResult, null, 2));
}

main().catch(err => {
  console.error('[Git Sync Error]:', err);
  process.exit(1);
});
