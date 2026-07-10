import http from 'http';
const postData = JSON.stringify({});
const options = { hostname: 'localhost', port: 3000, path: '/api/test-random', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } };
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('POST /api/test-random:', res.statusCode, data));
});
req.write(postData);
req.end();
