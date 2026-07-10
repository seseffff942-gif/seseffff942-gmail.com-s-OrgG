import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const { token } = JSON.parse(body);
      
      const req2 = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/whatsapp/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      }, res2 => {
        let body2 = '';
        res2.on('data', d => body2 += d);
        res2.on('end', () => {
          console.log('Response:', res2.statusCode);
          console.log(body2);
        });
      });
      req2.write(JSON.stringify({
        phone: "50212345678",
        message: "Test message",
        templateName: "hello_world"
      }));
      req2.end();
    } catch(e) { console.error(e) }
  });
});
req.write(JSON.stringify({ email: "admin@agricovet.com", password: "admin" }));
req.end();
