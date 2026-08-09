import fetch from 'node-fetch';

async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agricovet.com', password: 'admin' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const createRes = await fetch('http://localhost:3000/api/office-inventory', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test via API',
      category: 'Mobiliario',
      quantity: 5,
      unitPrice: 100,
      location: 'Oficina',
      status: 'good'
    })
  });
  console.log('Create Response:', createRes.status, await createRes.json());
}
test();
