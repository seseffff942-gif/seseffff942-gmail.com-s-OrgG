const fs = require('fs');
const content = fs.readFileSync('src/pages/SalesPage.tsx', 'utf8');

const lines = content.split('\n');
let tags = [];
for (let i = 794; i <= 1164; i++) {
  const line = lines[i];
  if (!line) continue;
  
  // A very naive regex to find open and close tags
  let match;
  const regex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
  while ((match = regex.exec(line)) !== null) {
     const tag = match[1];
     if (['input', 'br', 'img', 'hr'].includes(tag)) continue;
     if (match[0].endsWith('/>')) continue;
     if (match[0].startsWith('</')) {
        const last = tags.pop();
        if (last && last.tag !== tag) {
           console.log(`Mismatch at line ${i+1}: expected </${last.tag}> but found </${tag}>. Opened at line ${last.line}`);
        }
     } else {
        tags.push({ tag, line: i + 1});
     }
  }
}
console.log('Unclosed tags at end:', tags);
