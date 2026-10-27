const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'npg_grand'
  });

  const updates = [
    { slug: 'handbags', img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80' },
    { slug: 'tote-bags', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80' },
    { slug: 'long-shoulder-bags', img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80' },
    { slug: 'slim-shoulder-bags', img: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=800&q=80' },
    { slug: 'clutches-evening-bags', img: 'https://images.unsplash.com/photo-1566150902887-9679ec15d205?auto=format&fit=crop&w=800&q=80' },
    { slug: 'womens-zip-purses', img: 'https://images.unsplash.com/photo-1563903530908-afdd155d057a?auto=format&fit=crop&w=800&q=80' },
    { slug: 'womens-casual-daypacks', img: 'https://images.unsplash.com/photo-1577733966973-d680bffd2e80?auto=format&fit=crop&w=800&q=80' },
    { slug: 'womens-bag-charms', img: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=800&q=80' },
    { slug: 'mens-bifold-wallets', img: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80' },
    { slug: 'mens-slim-cardholders', img: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80' },
    { slug: 'mens-work-backpacks', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80' },
    { slug: 'mens-leather-belts', img: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=800&q=80' },
    { slug: 'kids-coin-pouches', img: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80' },
    { slug: 'kids-school-backpacks', img: 'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=800&q=80' },
    { slug: 'kids-keychains', img: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=800&q=80' }
  ];

  for (const u of updates) {
    await conn.query('UPDATE categories SET image = ? WHERE slug = ?', [u.img, u.slug]);
  }
  console.log('Category images updated successfully');
  await conn.end();
}

run().catch(console.error);

