import http from 'http';
http.get('http://localhost:3000/api/users', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('GET /api/users:', res.statusCode, body));
});
