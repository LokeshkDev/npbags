const db = require('../server/src/config/db');

async function run() {
  const sql = `
    UPDATE purchase_bill_items pbi
    JOIN product_variants pv ON pbi.variant_id = pv.id
    SET pbi.model_name = pv.model_name
    WHERE pv.model_name IS NOT NULL AND pv.model_name != '' AND (pbi.model_name IS NULL OR pbi.model_name = '')
  `;
  const res = await db.query(sql);
  console.log('Backfilled rows:', res.affectedRows);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
