import http from 'http';
http.get('http://localhost:3000/api/test-random', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('GET /api/test-random:', res.statusCode, data));
});
