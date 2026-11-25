import { query } from "./src/db";

async function getStats() {
  const today = "2026-11-02";
  const res = await query(
    `SELECT i.id, i.folio, i.total_amount, i.seller_id, i.date, u.name, u.email 
     FROM invoices i 
     LEFT JOIN users u ON i.seller_id = u.id 
     WHERE DATE(i.date) = $1`,
    [today]
  );
  console.log("Invoices today:", JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
getStats();

