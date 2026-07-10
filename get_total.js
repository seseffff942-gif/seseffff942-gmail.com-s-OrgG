import fs from 'fs';
const db_items = JSON.parse(fs.readFileSync('db_items.json', 'utf8'));
let total = 0;
for (const val of Object.values(db_items)) {
    total += val;
}
console.log("DB items total:", total);
