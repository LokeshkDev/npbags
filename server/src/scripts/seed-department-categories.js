const slugify = require('slugify');
const { query } = require('../config/db');

async function seedDepartments() {
  console.log('[Seed] Seeding AJIO-style department taxonomy categories...');

  try {
    const existingCats = await query(`SELECT id, slug, name, parent_id, gender FROM categories`);
    const catBySlug = {};
    existingCats.forEach(c => { catBySlug[c.slug] = c; });

    const structure = [
      {
        name: 'Handbags',
        slug: 'handbags',
        gender: 'women',
        description: 'Luxury shoulder bags, totes, and designer handbags for women.',
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        display_order: 1,
        subcategories: [
          { name: 'Tote Bags', slug: 'tote-bags', gender: 'women', description: 'Spacious daily leather totes and work bags.', display_order: 1 },
          { name: 'Long Shoulder Bags', slug: 'long-shoulder-bags', gender: 'women', description: 'Classic bags with long drop shoulder handles.', display_order: 2 },
          { name: 'Slim Shoulder Bags', slug: 'slim-shoulder-bags', gender: 'women', description: 'Streamlined, compact slim bags.', display_order: 3 },
          { name: 'Clutches & Evening Bags', slug: 'clutches-evening-bags', gender: 'women', description: 'Elegant clutches and compact evening bags.', display_order: 4 }
        ]
      },
      {
        name: 'Wallets & Purses',
        slug: 'wallets-purses',
        gender: 'all',
        description: 'Bifold wallets, slim cardholders, coin pouches, and zip purses.',
        image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
        display_order: 2,
        subcategories: [
          { name: "Men's Bifold Wallets", slug: 'mens-bifold-wallets', gender: 'men', description: 'Classic full-grain leather bifold wallets for men.', display_order: 1 },
          { name: "Men's Slim Cardholders", slug: 'mens-slim-cardholders', gender: 'men', description: 'Minimalist pocket cardholders.', display_order: 2 },
          { name: "Women's Zip Purses", slug: 'womens-zip-purses', gender: 'women', description: 'Multi-compartment continental zip purses.', display_order: 3 },
          { name: 'Kids Coin Pouches', slug: 'kids-coin-pouches', gender: 'kids', description: 'Colorful, lightweight coin pouches for kids.', display_order: 4 }
        ]
      },
      {
        name: 'Backpacks & Travel',
        slug: 'backpacks-travel',
        gender: 'all',
        description: 'Commuter daypacks, leather laptop bags, and school packs.',
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
        display_order: 3,
        subcategories: [
          { name: "Men's Work Backpacks", slug: 'mens-work-backpacks', gender: 'men', description: 'Ergonomic business and laptop backpacks.', display_order: 1 },
          { name: "Women's Casual Daypacks", slug: 'womens-casual-daypacks', gender: 'women', description: 'Lightweight, stylish everyday carry packs.', display_order: 2 },
          { name: "Kids' School Backpacks", slug: 'kids-school-backpacks', gender: 'kids', description: 'Durable, ergonomic school backpacks for children.', display_order: 3 }
        ]
      },
      {
        name: 'Accessories',
        slug: 'accessories',
        gender: 'all',
        description: 'Belts, keychains, charms, and everyday accessories.',
        image: 'https://images.unsplash.com/photo-1576053139778-7e32f2ae3cfd?auto=format&fit=crop&w=800&q=80',
        display_order: 4,
        subcategories: [
          { name: "Men's Leather Belts", slug: 'mens-leather-belts', gender: 'men', description: 'Full grain formal and casual leather belts.', display_order: 1 },
          { name: "Women's Bag Charms & Scarves", slug: 'womens-bag-charms', gender: 'women', description: 'Silk scarves, charms and replacement straps.', display_order: 2 },
          { name: "Kids' Cute Keychains", slug: 'kids-keychains', gender: 'kids', description: 'Fun zipper pulls and backpack keychains for kids.', display_order: 3 }
        ]
      }
    ];

    for (const main of structure) {
      let mainId;
      if (catBySlug[main.slug]) {
        mainId = catBySlug[main.slug].id;
        await query(`UPDATE categories SET gender = ?, description = COALESCE(description, ?) WHERE id = ?`, [main.gender, main.description, mainId]);
        console.log(`[Seed] Updated main category: ${main.name} (${main.gender})`);
      } else {
        const res = await query(
          `INSERT INTO categories (parent_id, slug, name, description, image, display_order, gender, is_active)
           VALUES (NULL, ?, ?, ?, ?, ?, ?, TRUE)`,
          [main.slug, main.name, main.description, main.image, main.display_order, main.gender]
        );
        mainId = res.insertId;
        console.log(`[Seed] Created main category: ${main.name} (${main.gender})`);
      }

      if (main.subcategories) {
        for (const sub of main.subcategories) {
          if (catBySlug[sub.slug]) {
            await query(`UPDATE categories SET parent_id = ?, gender = ?, description = COALESCE(description, ?) WHERE id = ?`, [mainId, sub.gender, sub.description, catBySlug[sub.slug].id]);
          } else {
            await query(
              `INSERT INTO categories (parent_id, slug, name, description, image, display_order, gender, is_active)
               VALUES (?, ?, ?, ?, NULL, ?, ?, TRUE)`,
              [mainId, sub.slug, sub.name, sub.description, sub.display_order, sub.gender]
            );
            console.log(`[Seed]   ↳ Created subcategory: ${sub.name} (${sub.gender})`);
          }
        }
      }
    }

    // Assign existing women handbag products to Tote Bags / Handbags category
    const handbagMain = await query(`SELECT id FROM categories WHERE slug = 'handbags'`);
    const toteSub = await query(`SELECT id FROM categories WHERE slug = 'tote-bags'`);
    const targetCatId = toteSub[0]?.id || handbagMain[0]?.id;

    if (targetCatId) {
      await query(`UPDATE products SET category_id = ?, gender = 'women' WHERE LOWER(name) LIKE '%handbag%' OR LOWER(name) LIKE '%tote%'`, [targetCatId]);
      console.log(`[Seed] Linked existing tote/handbag products to category ID ${targetCatId} (Women)`);
    }

    console.log('[Seed] Department categories successfully seeded!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]', err);
    process.exit(1);
  }
}

seedDepartments();

