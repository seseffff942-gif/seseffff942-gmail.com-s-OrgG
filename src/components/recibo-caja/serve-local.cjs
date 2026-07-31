const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3005;
const filePath = path.join(__dirname, 'preview.html');

const server = http.createServer((req, res) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error al cargar preview.html');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🧾 Servidor Local del Recibo de Caja (Agricovet)`);
  console.log(`👉 Abrir en navegador: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
