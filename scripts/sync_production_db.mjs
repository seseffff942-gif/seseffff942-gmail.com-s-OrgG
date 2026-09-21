import { execFileSync } from 'child_process';
import pg from 'pg';
import fs from 'fs';

async function syncFromRemote() {
  console.log('1. Extrayendo todas las facturas de produccion (remote agricovet_db)...');
  
  const dumpCmd = `docker exec -i evolution_postgres psql -U postgres -d agricovet_db -t -A -F '|||' -c 'SELECT id, folio, date, "clientName", "totalAmount", "paidAmount", "sellerId", status, is_archived FROM invoices;'`;

  const rawInvs = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    dumpCmd
  ], { encoding: 'utf-8', maxBuffer: 30 * 1024 * 1024 });

  const lines = rawInvs.trim().split('\n').filter(Boolean);
  console.log(`Descargadas ${lines.length} facturas de producción.`);

  const localClient = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await localClient.connect();

  let inserted = 0;
  for (const line of lines) {
    const parts = line.split('|||');
    if (parts.length < 8) continue;
    const [id, folio, date, clientName, totalAmount, paidAmount, sellerId, status, is_archived] = parts;
    
    await localClient.query(`
      INSERT INTO invoices (id, folio, date, "clientName", "totalAmount", "paidAmount", "sellerId", status, is_archived)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        folio = EXCLUDED.folio,
        date = EXCLUDED.date,
        "clientName" = EXCLUDED."clientName",
        "totalAmount" = EXCLUDED."totalAmount",
        "paidAmount" = EXCLUDED."paidAmount",
        "sellerId" = EXCLUDED."sellerId",
        status = EXCLUDED.status,
        is_archived = EXCLUDED.is_archived;
    `, [id, folio, date ? new Date(date) : null, clientName, totalAmount ? Number(totalAmount) : 0, paidAmount ? Number(paidAmount) : 0, sellerId, status, is_archived === 't']);
    inserted++;
  }

  console.log(`✅ Sincronizadas ${inserted} facturas en el PostgreSQL local.`);

  // Sincronizar clientes
  console.log('2. Extrayendo clientes de produccion...');
  const dumpCliCmd = `docker exec -i evolution_postgres psql -U postgres -d agricovet_db -t -A -F '|||' -c 'SELECT id, name, "companyName", address, phone, "sellerId" FROM clients;'`;

  const rawCli = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    dumpCliCmd
  ], { encoding: 'utf-8', maxBuffer: 30 * 1024 * 1024 });

  const cliLines = rawCli.trim().split('\n').filter(Boolean);
  console.log(`Descargados ${cliLines.length} clientes de producción.`);

  for (const line of cliLines) {
    const parts = line.split('|||');
    if (parts.length < 5) continue;
    const [id, name, companyName, address, phone, sellerId] = parts;

    await localClient.query(`
      INSERT INTO clients (id, name, "companyName", address, phone, "sellerId")
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "companyName" = EXCLUDED."companyName",
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        "sellerId" = EXCLUDED."sellerId";
    `, [id, name, companyName, address, phone, sellerId]);
  }
  console.log(`✅ Clientes de producción sincronizados.`);

  await localClient.end();
}

syncFromRemote().catch(console.error);
