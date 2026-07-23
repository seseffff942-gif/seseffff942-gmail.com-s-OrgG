import fetch from 'node-fetch';

async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agricovet.com', password: 'admin' })
  });
  console.log('Login status:', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Login data:', loginData);
}
test();
