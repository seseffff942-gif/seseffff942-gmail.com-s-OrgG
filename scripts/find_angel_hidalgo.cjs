const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db",
  ssl: false
});

async function main() {
  console.log("=== BUSCANDO 'angel hidalgo' EN POSTGRESQL ===");

  // 1. En tabla clients (incluyendo todos los campos)
  try {
    const clientsRes = await pool.query(
      `SELECT * FROM clients WHERE name ILIKE '%angel%' OR name ILIKE '%hidalgo%' OR "companyName" ILIKE '%angel%' OR "companyName" ILIKE '%hidalgo%'`
    );
    console.log(`\n[clients] Coincidencias en tabla clients: ${clientsRes.rows.length}`);
    for (const row of clientsRes.rows) {
      console.log(JSON.stringify(row, null, 2));
    }
  } catch (err) {
    console.error("Error consultando clients:", err.message);
  }

  // 2. En facturas (invoices)
  try {
    const invRes = await pool.query(
      `SELECT id, folio, "clientName", nit, "totalAmount", date, status, "sellerId" FROM invoices WHERE "clientName" ILIKE '%angel%' OR "clientName" ILIKE '%hidalgo%' LIMIT 10`
    );
    console.log(`\n[invoices] Coincidencias en facturas: ${invRes.rows.length}`);
    for (const row of invRes.rows) {
      console.log(row);
    }
  } catch (err) {
    console.error("Error consultando invoices:", err.message);
  }

  // 3. En visitas (client_visits)
  try {
    const visRes = await pool.query(
      `SELECT id, "clientId", "clientName", "sellerName", "visitType", "createdAt" FROM client_visits WHERE "clientName" ILIKE '%angel%' OR "clientName" ILIKE '%hidalgo%' LIMIT 10`
    );
    console.log(`\n[client_visits] Coincidencias en visitas: ${visRes.rows.length}`);
    for (const row of visRes.rows) {
      console.log(row);
    }
  } catch (err) {
    console.error("Error consultando client_visits:", err.message);
  }

  // 4. Archivos locales en el contenedor
  const localFiles = [
    "deleted_clients.json",
    "clients_local.json",
    "deleted_recibos_ids.json"
  ];
  for (const f of localFiles) {
    const p = path.join(process.cwd(), f);
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf8");
        if (raw.toLowerCase().includes("angel") || raw.toLowerCase().includes("hidalgo")) {
          console.log(`\n[${f}] ¡ENCONTRADO en archivo local ${f}!`);
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            const matches = data.filter(d => JSON.stringify(d).toLowerCase().includes("angel") || JSON.stringify(d).toLowerCase().includes("hidalgo"));
            console.log(matches);
          } else {
            console.log(data);
          }
        } else {
          console.log(`\n[${f}] No contiene 'angel' ni 'hidalgo'.`);
        }
      } catch (e) {
        console.error(`Error leyendo ${f}:`, e.message);
      }
    } else {
      console.log(`\n[${f}] Archivo no existe.`);
    }
  }

  await pool.end();
}

main().catch(console.error);

