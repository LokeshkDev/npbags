const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'npg_grand'
  });

  try {
    // 1. Add banner_image column to categories if not exists
    const [cols] = await conn.query("SHOW COLUMNS FROM categories LIKE 'banner_image'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE categories ADD COLUMN banner_image VARCHAR(500) NULL AFTER image");
      console.log("Added 'banner_image' column to categories table.");
    } else {
      console.log("'banner_image' column already exists in categories table.");
    }

    // 2. Ensure page_banners exists in cms_sections
    const [cmsRows] = await conn.query("SELECT section_key FROM cms_sections WHERE section_key = 'page_banners'");
    if (cmsRows.length === 0) {
      const defaultPageBanners = {
        shop: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=85',
        womens: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85',
        mens: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1800&q=85',
        kids: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1800&q=85'
      };
      await conn.query(
        "INSERT INTO cms_sections (section_key, title, subtitle, is_visible, display_order, content) VALUES (?, ?, ?, 1, 99, ?)",
        ['page_banners', 'Page & Department Banners', 'Banner images for shop, womens, mens, and kids pages', JSON.stringify(defaultPageBanners)]
      );
      console.log("Created 'page_banners' section in cms_sections.");
    } else {
      console.log("'page_banners' section already exists in cms_sections.");
    }

    // 3. Seed default high-quality wide banners for categories that don't have one
    const defaultCategoryBanners = [
      { slug: 'handbags', banner: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'tote-bags', banner: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'long-shoulder-bags', banner: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'slim-shoulder-bags', banner: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'clutches-evening-bags', banner: 'https://images.unsplash.com/photo-1566150902887-9679ec15d205?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'wallets-purses', banner: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'mens-bifold-wallets', banner: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'mens-slim-cardholders', banner: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'womens-zip-purses', banner: 'https://images.unsplash.com/photo-1563903530908-afdd155d057a?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'kids-coin-pouches', banner: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'backpacks-travel', banner: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'mens-work-backpacks', banner: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'womens-casual-daypacks', banner: 'https://images.unsplash.com/photo-1577733966973-d680bffd2e80?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'kids-school-backpacks', banner: 'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'accessories', banner: 'https://images.unsplash.com/photo-1576053139778-7e32f2ae3cfd?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'mens-leather-belts', banner: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'womens-bag-charms', banner: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1800&q=85' },
      { slug: 'kids-keychains', banner: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1800&q=85' }
    ];

    for (const b of defaultCategoryBanners) {
      await conn.query("UPDATE categories SET banner_image = ? WHERE slug = ? AND (banner_image IS NULL OR banner_image = '')", [b.banner, b.slug]);
    }
    console.log("Default category banners updated successfully.");

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await conn.end();
  }
}

run();
