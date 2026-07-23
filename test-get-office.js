import fetch from 'node-fetch';

async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seseffff942@gmail.com', password: '123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const res = await fetch('http://localhost:3000/api/office-inventory', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Get:', await res.json());
}
test();
