const fs = require('fs');
const lines = fs.readFileSync('inventario.csv', 'utf-8').trim().split('\n');
let md = "| Producto | Categoría | Stock | Precio |\n|---|---|---|---|\n";
for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    md += `| ${parts[0]} | ${parts[1]} | ${parts[2]} | ${parts[3]} |\n`;
}
fs.writeFileSync('inventario.md', md);
