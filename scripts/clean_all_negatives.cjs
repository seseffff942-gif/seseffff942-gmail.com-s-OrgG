const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query("SELECT id, name, category, stock, variants FROM products WHERE stock < 0 OR variants::text LIKE '%\"stock\":-%';");

  console.log(`Resetting ${res.rows.length} products with negative stock to 0...`);

  for (const p of res.rows) {
    let vars = p.variants;
    if (typeof vars === 'string') {
      try { vars = JSON.parse(vars); } catch (e) {}
    }
    let updatedVars = null;
    if (vars && Array.isArray(vars)) {
      updatedVars = vars.map(v => {
        if (Number(v.stock) < 0) {
          return { ...v, stock: 0 };
        }
        return v;
      });
    }

    const newStock = Math.max(0, Number(p.stock || 0));

    if (updatedVars) {
      await pool.query("UPDATE products SET stock = $1, variants = $2 WHERE id = $3", [newStock, JSON.stringify(updatedVars), p.id]);
    } else {
      await pool.query("UPDATE products SET stock = $1 WHERE id = $2", [newStock, p.id]);
    }

    console.log(`✅ [${p.category}] "${p.name}": reset de ${p.stock} a 0.`);

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs (id, action, category, entity_type, entity_id, entity_name, description, previous_data, new_data, user_email, user_role, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `, [
      `audit_reset_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      'STOCK_RESET_ZERO',
      'stock',
      'product',
      p.id,
      p.name,
      `Ajuste correctivo automático para eliminar saldo negativo en inventario: "${p.name}" (${p.category}) de ${p.stock} a 0 uds.`,
      JSON.stringify({ stock: p.stock }),
      JSON.stringify({ stock: 0 }),
      'system@agricovet.lat',
      'admin'
    ]);
  }

  // Verification
  const check = await pool.query("SELECT id, name, stock FROM products WHERE stock < 0 OR variants::text LIKE '%\"stock\":-%';");
  console.log(`\nVerificación final: Productos con stock negativo en DB = ${check.rows.length}`);

  await pool.end();
}

run();
