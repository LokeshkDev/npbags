const { query } = require('../config/db');

async function migrate() {
  const cols = [
    { name: 'care_instructions', def: 'TEXT NULL' },
    { name: 'seo_title', def: 'VARCHAR(255) NULL' },
    { name: 'seo_description', def: 'TEXT NULL' },
    { name: 'seo_keywords', def: 'TEXT NULL' }
  ];
  for (const c of cols) {
    try {
      await query(`ALTER TABLE products ADD COLUMN ${c.name} ${c.def}`);
      console.log('Added column ' + c.name);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('Column already exists: ' + c.name);
      } else {
        console.error('Error adding ' + c.name, e.message);
      }
    }
  }
}

migrate()
  .then(() => {
    console.log('Migration finished successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

