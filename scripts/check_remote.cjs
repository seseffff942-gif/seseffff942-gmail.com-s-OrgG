const https = require('https');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ghPath = path.join('C:', 'Program Files', 'GitHub CLI', 'gh.exe');
let token = process.env.GITHUB_TOKEN;
if (!token && fs.existsSync(ghPath)) {
  token = execSync(`"${ghPath}" auth token`).toString().trim();
}

const options = {
  hostname: 'api.github.com',
  path: '/repos/seseffff942-gif/seseffff942-gmail.com-s-OrgG/commits?per_page=5',
  headers: {
    'User-Agent': 'NodeJS',
    'Authorization': 'token ' + token
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const commits = JSON.parse(data);
      console.log('Last commits on remote:');
      if (Array.isArray(commits)) {
        commits.forEach(c => console.log(c.sha, c.commit.message, c.commit.committer.date));
      } else {
        console.log(commits);
      }
    } catch (e) {
      console.error(e);
    }
  });
});
