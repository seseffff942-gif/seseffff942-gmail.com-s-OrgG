import { execFileSync } from 'child_process';

const pyCode = `
with open('/opt/evolution-api/docker-compose.yml', 'r') as f:
    content = f.read()

# Replace evolution_db with agricovet_db in pgweb command
new_content = content.replace(
    '--url=postgres://postgres:evolution_pass@postgres:5432/evolution_db?sslmode=disable',
    '--url=postgres://postgres:evolution_pass@postgres:5432/agricovet_db?sslmode=disable'
)

with open('/opt/evolution-api/docker-compose.yml', 'w') as f:
    f.write(new_content)

print("Updated docker-compose.yml")
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e);
}
