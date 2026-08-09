import http from 'http';
const postData = JSON.stringify({ name: 'test from curl', productId: 'p1' });
const options = { hostname: 'localhost', port: 3000, path: '/api/test-offer', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } };
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('POST /api/test-offer:', res.statusCode, data));
});
req.write(postData);
req.end();
