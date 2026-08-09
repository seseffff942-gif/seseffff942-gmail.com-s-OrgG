import fetch from 'node-fetch';

async function test() {
  // First login as admin
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seseffff942@gmail.com', password: 'admin' }) // I don't know the password... Wait, maybe I shouldn't rely on it.
  });
}
