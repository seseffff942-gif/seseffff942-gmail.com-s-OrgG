import fetch from 'node-fetch';

async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seseffff942@gmail.com', password: '123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  console.log('Testing create...');
  const createRes = await fetch('http://localhost:3000/api/office-inventory', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test Update Fix',
      category: 'Mobiliario',
      quantity: 5,
      unitPrice: 100,
      location: 'Oficina',
      status: 'good'
    })
  });
  const createData = await createRes.json();
  console.log('Create:', createData);
  const id = createData.id;

  console.log('Testing update for ID:', id);
  const updateRes = await fetch(`http://localhost:3000/api/office-inventory/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test Update Fix 2',
      category: 'Mobiliario',
      quantity: 10,
      unitPrice: 200,
      location: 'Oficina 2',
      status: 'excellent'
    })
  });
  console.log('Update Response:', updateRes.status, await updateRes.json());
  
  console.log('Testing delete for ID:', id);
  const delRes = await fetch(`http://localhost:3000/api/office-inventory/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Delete:', delRes.status, await delRes.json());
}
test();
