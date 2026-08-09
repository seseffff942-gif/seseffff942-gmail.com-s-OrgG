import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const secret = process.env.JWT_SECRET || 'default_stable_secret_for_agricovet_dev';
const token = jwt.sign({ id: 'u1b', role: 'admin' }, secret);

async function test() {
  console.log('Testing create...');
  const createRes = await fetch('http://localhost:3000/api/office-inventory', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test JWT',
      category: 'Mobiliario',
      quantity: 5,
      unitPrice: 100,
      location: 'Oficina',
      status: 'good'
    })
  });
  const createData = await createRes.json();
  console.log('Create Response:', createRes.status, createData);

  if (!createData.id) return;
  const id = createData.id;

  console.log('Testing update...');
  const updateRes = await fetch(`http://localhost:3000/api/office-inventory/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test JWT Updated',
      category: 'Mobiliario',
      quantity: 10,
      unitPrice: 200,
      location: 'Oficina 2',
      status: 'excellent'
    })
  });
  console.log('Update Response:', updateRes.status, await updateRes.json());

  console.log('Testing delete...');
  const deleteRes = await fetch(`http://localhost:3000/api/office-inventory/${id}`, {
    method: 'DELETE',
    headers: { 
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('Delete Response:', deleteRes.status, await deleteRes.json());
}
test();
