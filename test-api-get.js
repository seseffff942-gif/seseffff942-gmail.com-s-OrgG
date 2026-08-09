import http from 'http';

http.get('http://localhost:3000/api/offers', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('GET /api/offers:', data));
});
