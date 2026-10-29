const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'npg_grand'
  });

  const updatedItems = [
    { label: 'Home', url: '/' },
    {
      label: 'Women',
      url: '/womens',
      sub_items: [
        { label: 'All Women', url: '/womens' },
        { label: 'Handbags', url: '/womens?category=handbags' },
        { label: 'Tote Bags', url: '/womens?category=tote-bags' },
        { label: 'Shoulder Bags', url: '/womens?category=long-shoulder-bags' },
        { label: 'Evening Clutches', url: '/womens?category=clutches-evening-bags' },
        { label: 'Zip Purses', url: '/womens?category=womens-zip-purses' },
        { label: 'Casual Daypacks', url: '/womens?category=womens-casual-daypacks' },
        { label: 'Bag Charms & Scarves', url: '/womens?category=womens-bag-charms' }
      ]
    },
    {
      label: 'Men',
      url: '/mens',
      sub_items: [
        { label: 'All Men', url: '/mens' },
        { label: 'Bifold Wallets', url: '/mens?category=mens-bifold-wallets' },
        { label: 'Slim Cardholders', url: '/mens?category=mens-slim-cardholders' },
        { label: 'Work Backpacks', url: '/mens?category=mens-work-backpacks' },
        { label: 'Leather Belts', url: '/mens?category=mens-leather-belts' }
      ]
    },
    {
      label: 'Kids',
      url: '/kids',
      sub_items: [
        { label: 'All Kids', url: '/kids' },
        { label: 'Coin Pouches', url: '/kids?category=kids-coin-pouches' },
        { label: 'School Backpacks', url: '/kids?category=kids-school-backpacks' },
        { label: 'Cute Keychains', url: '/kids?category=kids-keychains' }
      ]
    },
    {
      label: 'Accessories',
      url: '/shop?category=accessories',
      sub_items: [
        { label: 'All Accessories', url: '/shop?category=accessories' },
        { label: 'Leather Belts', url: '/shop?category=mens-leather-belts' },
        { label: 'Keychains & Charms', url: '/shop?category=keychains' },
        { label: 'Scarves & Charms', url: '/shop?category=womens-bag-charms' }
      ]
    },
    {
      label: 'Bags & Handbags',
      url: '/shop?category=handbags',
      sub_items: [
        { label: 'All Bags', url: '/shop?category=handbags' },
        { label: 'Handbags', url: '/shop?category=handbags' },
        { label: 'Tote Bags', url: '/shop?category=tote-bags' },
        { label: 'Shoulder Bags', url: '/shop?category=long-shoulder-bags' },
        { label: 'Clutches', url: '/shop?category=clutches-evening-bags' },
        { label: 'Backpacks & Travel', url: '/shop?category=backpacks-travel' }
      ]
    },
    {
      label: 'Footwear',
      url: '/shop?category=footwear',
      sub_items: [
        { label: 'All Footwear', url: '/shop?category=footwear' },
        { label: 'Casual Footwear', url: '/shop?category=footwear' },
        { label: 'Sandals & Slides', url: '/shop?category=footwear' }
      ]
    },
    {
      label: 'Water Bottles',
      url: '/shop?category=water-bottles',
      sub_items: [
        { label: 'All Water Bottles', url: '/shop?category=water-bottles' },
        { label: 'Insulated Flasks', url: '/shop?category=water-bottles' },
        { label: 'Stainless Steel', url: '/shop?category=water-bottles' }
      ]
    },
    {
      label: 'Key Chains',
      url: '/shop?category=keychains',
      sub_items: [
        { label: 'All Key Chains', url: '/shop?category=keychains' },
        { label: 'Cute Keychains', url: '/shop?category=kids-keychains' },
        { label: 'Leather Key Rings', url: '/shop?category=keychains' }
      ]
    },
    {
      label: 'Offers',
      url: '/shop?filter=sale',
      sub_items: [
        { label: 'Special Clearance', url: '/shop?filter=sale' },
        { label: 'Under ₹499', url: '/shop?maxPrice=499' },
        { label: 'Under ₹999', url: '/shop?maxPrice=999' }
      ]
    },
    {
      label: 'New Arrivals',
      url: '/shop?filter=new',
      sub_items: [
        { label: 'This Week\'s Drops', url: '/shop?filter=new' },
        { label: 'New in Handbags', url: '/shop?category=handbags&filter=new' },
        { label: 'New in Wallets', url: '/shop?category=wallets-purses&filter=new' }
      ]
    }
  ];

  const [rows] = await conn.query('SELECT content FROM cms_sections WHERE section_key = ?', ['main_navigation']);
  let content = {};
  if (rows.length > 0 && rows[0].content) {
    content = typeof rows[0].content === 'string' ? JSON.parse(rows[0].content) : rows[0].content;
  }
  content.items = updatedItems;
  await conn.query('UPDATE cms_sections SET content = ? WHERE section_key = ?', [JSON.stringify(content), 'main_navigation']);
  console.log('Successfully updated main_navigation items with sub_items in DB!');
  await conn.end();
}

run().catch(console.error);

