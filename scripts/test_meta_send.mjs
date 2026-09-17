const token = 'EAGJ7fnVAP5UBSX6ZC3wVhmT0wEZCBvA5yiE0jzXQMOB91QPBCG0mDBI4UqApzYxjMm4GiPhmHsjLJReYhpa0f8RI6DEqz4v1SZBbQdlR6EAB0qPL2NoPI6VQXTOnt4yIB4DvragKj8IaWXElMyWxvygDYZCZB9VeXPov5nYxx3HgfpCBbzFufCzB2GIcGkgZDZD';
const phoneNumberId = '1259519730581758';

async function testSend(lang, paramsCount) {
  const params = [
    { type: 'text', text: 'Emanuel Lima' },
    { type: 'text', text: '0' },
  ];
  if (paramsCount === 4) {
    params.push({ type: 'text', text: '8,750' });
    params.push({ type: 'text', text: '8,750' });
  } else {
    params.push({ type: 'text', text: '8,750' });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '50248234048',
    type: 'template',
    template: {
      name: 'cierre_meta_no_alcanzada_v1',
      language: { code: lang },
      components: [
        {
          type: 'body',
          parameters: params
        }
      ]
    }
  };

  console.log(`Testing lang=${lang}, params=${paramsCount}...`);
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(`Result (lang=${lang}, params=${paramsCount}):`, JSON.stringify(data));
}

async function run() {
  await testSend('es', 3);
  await testSend('es', 4);
  await testSend('es_MX', 4);
}

run();
