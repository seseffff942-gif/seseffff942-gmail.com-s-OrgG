const token = 'EAGJ7fnVAP5UBSX6ZC3wVhmT0wEZCBvA5yiE0jzXQMOB91QPBCG0mDBI4UqApzYxjMm4GiPhmHsjLJReYhpa0f8RI6DEqz4v1SZBbQdlR6EAB0qPL2NoPI6VQXTOnt4yIB4DvragKj8IaWXElMyWxvygDYZCZB9VeXPov5nYxx3HgfpCBbzFufCzB2GIcGkgZDZD';
const phoneNumberId = '1259519730581758';

async function test12() {
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
        name: 'reporte_ventas_mediodia_v2',
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Emanuel Lima' },
              { type: 'text', text: '0' },
              { type: 'text', text: '8,750' },
              { type: 'text', text: '8,750' }
            ]
          }
        ]
      }
    })
  });
  console.log('Response 12PM template:', await res.json());
}

test12();
