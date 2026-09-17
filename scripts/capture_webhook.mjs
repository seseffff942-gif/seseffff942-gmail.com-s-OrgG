import { execSync } from 'child_process';

// 1. Start tcpdump in background on VPS to /tmp/webhook_capture.txt
const startDump = `ssh -n -i "C:\\Users\\sesef\\.ssh\\id_ed25519" -o StrictHostKeyChecking=no root@185.166.39.49 "nohup tcpdump -i any -A -s 0 'tcp port 3000' > /tmp/webhook_capture.txt 2>&1 & echo \\$! > /tmp/tcpdump.pid"`;
execSync(startDump);
console.log('Started tcpdump on VPS...');

// 2. Send the message via test_meta_send.mjs
console.log('Sending Meta template message...');
const token = 'EAGJ7fnVAP5UBSX6ZC3wVhmT0wEZCBvA5yiE0jzXQMOB91QPBCG0mDBI4UqApzYxjMm4GiPhmHsjLJReYhpa0f8RI6DEqz4v1SZBbQdlR6EAB0qPL2NoPI6VQXTOnt4yIB4DvragKj8IaWXElMyWxvygDYZCZB9VeXPov5nYxx3HgfpCBbzFufCzB2GIcGkgZDZD';
const phoneNumberId = '1259519730581758';

async function send() {
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '50248234048',
      type: 'template',
      template: {
        name: 'cierre_meta_no_alcanzada_v1',
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Emanuel Lima' },
              { type: 'text', text: '0' },
              { type: 'text', text: '8,750' }
            ]
          }
        ]
      }
    })
  });
  const data = await res.json();
  console.log('Meta API response:', data);

  // Wait 6 seconds for webhook to arrive
  console.log('Waiting 6s for webhook callback...');
  await new Promise(r => setTimeout(r, 6000));

  // Kill tcpdump and read output
  const readDump = `ssh -n -i "C:\\Users\\sesef\\.ssh\\id_ed25519" -o StrictHostKeyChecking=no root@185.166.39.49 "kill \\$(cat /tmp/tcpdump.pid) 2>/dev/null; cat /tmp/webhook_capture.txt"`;
  const dumpOut = execSync(readDump, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

  // Look for POST /api/webhooks and body
  const lines = dumpOut.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('POST /api/webhooks') || lines[i].includes('whatsapp_business_account')) {
      console.log('--- CAPTURED WEBHOOK ---');
      console.log(lines.slice(i, i + 35).join('\n'));
      break;
    }
  }
}

send().catch(console.error);
