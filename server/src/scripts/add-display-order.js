const { query } = require('../config/db');

async function main() {
  try {
    const cols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'cms_sections' 
        AND COLUMN_NAME = 'display_order'
    `);

    if (cols.length === 0) {
      await query(`ALTER TABLE cms_sections ADD COLUMN display_order INT DEFAULT 0`);
      console.log('✓ Added display_order column to cms_sections');
    } else {
      console.log('✓ display_order column already exists');
    }

    // Set initial order based on section keys
    const defaultOrder = [
      'announcement',
      'main_navigation',
      'hero_carousel',
      'category_strip',
      'audience_cards',
      'jewellery_gallery',
      'shop_by_price',
      'best_sellers',
      'trust_strip',
      'campaign_banners',
      'newsletter_section',
      'footer_section'
    ];

    for (let i = 0; i < defaultOrder.length; i++) {
      await query(`UPDATE cms_sections SET display_order = ? WHERE section_key = ?`, [i, defaultOrder[i]]);
    }
    console.log('✓ Initialized display_order for all sections');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
