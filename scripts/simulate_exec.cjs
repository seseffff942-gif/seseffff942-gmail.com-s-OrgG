const { execFileSync } = require('child_process');

const py = `
import subprocess

script = """
const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const { parse } = require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const vm = require('vm');

const db = new sqlite3.Database('/home/node/.n8n/database.sqlite');
db.get('SELECT data FROM execution_data WHERE executionId = 257', (err, row) => {
  if (err) return console.error(err);
  const full = parse(row.data);
  const webhookData = full.resultData.runData['Webhook Ventas'][0].data.main[0][0].json;
  console.log('Webhook input json:');
  console.log(JSON.stringify(webhookData, null, 2));

  db.get("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'", (err2, wfRow) => {
    const nodes = JSON.parse(wfRow.nodes);
    const evalNode = nodes.find(n => n.name === 'Evaluar Hora y Meta');
    console.log('EvalNode jsCode from DB length:', evalNode.parameters.jsCode.length);
    
    // Run jsCode in sandbox
    const sandbox = {
      $input: {
        first: () => ({ json: webhookData })
      },
      console: console,
      Date: Date
    };
    vm.createContext(sandbox);
    try {
      const res = vm.runInContext(evalNode.parameters.jsCode, sandbox);
      console.log('Simulated output from jsCode:');
      console.log(JSON.stringify(res, null, 2));
    } catch(e) {
      console.error('Eval error:', e);
    }
  });
});
"""

res = subprocess.run(["docker", "exec", "-i", "n8n", "node", "-e", script], capture_output=True, text=True)
print(res.stdout)
print(res.stderr)
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: py, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
