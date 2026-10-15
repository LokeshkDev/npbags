const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const CATEGORIES = [
  { slug: 'everyday-essentials', name: 'Everyday essentials', description: 'Functional canvas and vegan leather bags for daily routines.', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=85', display_order: 1 },
  { slug: 'on-the-go', name: 'On the go', description: 'Hands-free slings and compact crossbodies designed for agility.', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85', display_order: 2 },
  { slug: 'travel-edit', name: 'Travel edit', description: 'Spacious weekender duffels and carry-on capsules built for transit.', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85', display_order: 3 },
  { slug: 'finishing-touches', name: 'Finishing touches', description: 'Minimalist leather wallets, pouches and elegant accent accessories.', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=85', display_order: 4 },
  { slug: 'work-travel', name: 'Work & travel', description: 'Structured satchels and commuter backpacks with padded laptop protection.', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85', display_order: 5 }
];

const PRODUCTS = [
  {
    id: 'the-everyday-tote',
    slug: 'the-everyday-tote',
    name: 'The Everyday Tote',
    category_slug: 'everyday-essentials',
    price: 48.00,
    sale_price: 60.00,
    badge: 'Bestseller',
    rating: 4.90,
    review_count: 148,
    tagline: 'Your go-to companion for morning commutes, market runs, and everything in between.',
    description: 'Constructed from resilient organic cotton canvas with premium reinforced saddle stitching. Roomy enough to house a 15" laptop, water bottle, planner, and daily essentials with effortless elegance.',
    features: JSON.stringify([
      'Padded sleeve fits up to 15" laptop securely',
      'Dual reinforced shoulder straps with 10.5" drop',
      'Interior zippered slip pocket & key leash',
      'Water-repellent finish on base and exterior lining'
    ]),
    materials: '100% GOTS-Certified Heavyweight Organic Cotton Canvas with vegetable-tanned leather trim and antique brass hardware.',
    dimensions: '15.5" H x 13.0" W x 5.5" D — 18L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day hassle-free returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85', color: 'Warm Oatmeal', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', color: 'Warm Oatmeal', is_primary: 0 },
      { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85', color: 'Midnight Charcoal', is_primary: 0 },
      { url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85', color: 'Olive Green', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Warm Oatmeal', color_hex: '#d9cdb8', size_name: 'Standard 18L', stock: 45, sku: 'TOTE-OAT-18L' },
      { color_name: 'Warm Oatmeal', color_hex: '#d9cdb8', size_name: 'Grande 24L', stock: 25, sku: 'TOTE-OAT-24L' },
      { color_name: 'Olive Green', color_hex: '#4e5b47', size_name: 'Standard 18L', stock: 30, sku: 'TOTE-OLV-18L' },
      { color_name: 'Midnight Charcoal', color_hex: '#26292b', size_name: 'Standard 18L', stock: 35, sku: 'TOTE-CHR-18L' }
    ],
    reviews: [
      { user_name: 'Elena R.', rating: 5.0, title: 'Obsessed with the craftsmanship!', comment: 'Fits my MacBook, notebook, and gym clothes without feeling bulky. The strap comfort is next level.', date_label: '3 days ago' },
      { user_name: 'Marcus K.', rating: 5.0, title: 'Clean design, durable feel', comment: 'The material feels heavy-duty yet very refined. Love the discreet key leash inside.', date_label: '1 week ago' },
      { user_name: 'Sophia T.', rating: 4.8, title: 'Perfect daily driver', comment: 'Gets compliments every time I head into the office. Worth every penny!', date_label: '2 weeks ago' }
    ]
  },
  {
    id: 'the-city-crossbody',
    slug: 'the-city-crossbody',
    name: 'The City Crossbody',
    category_slug: 'on-the-go',
    price: 42.00,
    sale_price: 52.00,
    badge: 'New',
    rating: 4.80,
    review_count: 96,
    tagline: 'Streamlined, hands-free ease made for spontaneous city walks and weekend cafe hops.',
    description: 'Sleek geometric silhouette designed for essential carry. Features smooth quick-access magnetic flap closure, interior card slots, and an adjustable webbing strap for cross-body or shoulder wear.',
    features: JSON.stringify([
      'Quick-release magnetic flap for instant access',
      'Integrated RFID-blocking card slots',
      'Adjustable seatbelt-grade woven nylon strap (32" to 54")',
      'Discrete exterior zip pocket against back body'
    ]),
    materials: 'Micro-grain vegan leather, water-resistant twill lining, matte gunmetal hardware.',
    dimensions: '7.8" H x 9.4" W x 2.8" D — 3.5L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day hassle-free returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', color: 'Saddle Tan', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85', color: 'Jet Black', is_primary: 0 },
      { url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85', color: 'Forest Moss', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Saddle Tan', color_hex: '#9c6644', size_name: 'Compact', stock: 40, sku: 'XBODY-TAN-CMP' },
      { color_name: 'Saddle Tan', color_hex: '#9c6644', size_name: 'Regular', stock: 30, sku: 'XBODY-TAN-REG' },
      { color_name: 'Jet Black', color_hex: '#1c1b1a', size_name: 'Regular', stock: 35, sku: 'XBODY-BLK-REG' },
      { color_name: 'Forest Moss', color_hex: '#3d4d3e', size_name: 'Regular', stock: 20, sku: 'XBODY-MOS-REG' }
    ],
    reviews: [
      { user_name: 'Chloe M.', rating: 5.0, title: 'Never leave home without it', comment: 'Fits phone, wallet, lip balm, sunglasses, and keys effortlessly without bulging.', date_label: '5 days ago' },
      { user_name: 'David H.', rating: 4.7, title: 'Very sleek look', comment: 'Quality of the strap and buckles is surprisingly high. Perfect for travel.', date_label: '2 weeks ago' }
    ]
  },
  {
    id: 'the-weekender',
    slug: 'the-weekender',
    name: 'The Weekender',
    category_slug: 'travel-edit',
    price: 68.00,
    sale_price: 82.00,
    badge: 'Popular',
    rating: 4.95,
    review_count: 215,
    tagline: 'Pack light, travel far. Thoughtfully structured for 3-day getaways and overhead bins.',
    description: 'Our signature travel duffel balances generous interior volume with clever organization. Features a dedicated ventilated shoe compartment, trolley sleeve for luggage handles, and water-repellent lining.',
    features: JSON.stringify([
      'Separate side-loading shoe or laundry compartment',
      'Luggage pass-through trolley strap fits any suitcase handle',
      'Detachable ergonomic padded shoulder strap',
      'TSA carry-on compliant for all major airlines'
    ]),
    materials: '600D Recycled ballistic poly-canvas with waterproof TPU base and brushed nickel zips.',
    dimensions: '19.5" W x 12.0" H x 9.5" D — 38L Capacity',
    shipping_info: 'Free express shipping on this item. Guaranteed delivery in 2-3 business days. 30-day hassle-free returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85', color: 'Khaki Sand', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', color: 'Slate Gray', is_primary: 0 },
      { url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85', color: 'Deep Evergreen', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Khaki Sand', color_hex: '#c5b8a5', size_name: '38L Weekend', stock: 25, sku: 'DUF-KHK-38L' },
      { color_name: 'Khaki Sand', color_hex: '#c5b8a5', size_name: '50L Extended', stock: 15, sku: 'DUF-KHK-50L' },
      { color_name: 'Slate Gray', color_hex: '#4a4e51', size_name: '38L Weekend', stock: 30, sku: 'DUF-SGY-38L' }
    ],
    reviews: [
      { user_name: 'Julian B.', rating: 5.0, title: 'The best carry-on I have ever owned', comment: 'Took this on a 4-day trip to Montreal. Shoe compartment is brilliant and kept everything spotless.', date_label: 'Yesterday' },
      { user_name: 'Amara W.', rating: 5.0, title: 'Sturdy, handsome and practical', comment: 'The trolley sleeve slides over my rolling bag securely. Couldn’t recommend more.', date_label: '1 week ago' }
    ]
  },
  {
    id: 'the-mini-shoulder',
    slug: 'the-mini-shoulder',
    name: 'The Mini Shoulder',
    category_slug: 'finishing-touches',
    price: 38.00,
    sale_price: 48.00,
    badge: 'Trending',
    rating: 4.75,
    review_count: 82,
    tagline: 'A sculptural 90s silhouette reworked with modern proportions and minimalist detail.',
    description: 'Slender, comfortable under-arm fit crafted from buttery soft vegan leather. Subtle curved top-line with zip-top closure and polished metallic accent studs.',
    features: JSON.stringify([
      'Ergonomic under-arm drop fits snugly under coats',
      'Smooth sliding zinc alloy zipper with leather pull',
      'Interior card pocket & phone pocket',
      'Structured reinforced base holds its shape empty or full'
    ]),
    materials: 'Smooth ultra-soft vegan nappa leather, champagne gold hardware, microfiber interior.',
    dimensions: '6.0" H x 10.5" W x 2.2" D — 2.2L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85', color: 'Sage Green', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85', color: 'Cream Ivory', is_primary: 0 },
      { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', color: 'Caramel Rust', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Sage Green', color_hex: '#778a75', size_name: 'One Size', stock: 20, sku: 'MSH-SGE-OS' },
      { color_name: 'Cream Ivory', color_hex: '#f0ece1', size_name: 'One Size', stock: 18, sku: 'MSH-IVR-OS' },
      { color_name: 'Caramel Rust', color_hex: '#a85d34', size_name: 'One Size', stock: 15, sku: 'MSH-RST-OS' }
    ],
    reviews: [
      { user_name: 'Nadia P.', rating: 5.0, title: 'Stunning in person!', comment: 'The sage color is even prettier in natural light. Perfect for dinners or day-outs.', date_label: '4 days ago' }
    ]
  },
  {
    id: 'the-structured-satchel',
    slug: 'the-structured-satchel',
    name: 'The Structured Satchel',
    category_slug: 'work-travel',
    price: 54.00,
    sale_price: 68.00,
    badge: 'Trending',
    rating: 4.85,
    review_count: 112,
    tagline: 'Architectural lines with organized dual partitions for modern professionals.',
    description: 'Precision crafted from structured pebbled vegan leather. Stands upright gracefully on protective metal feet with padded tablet partition and key clip.',
    features: JSON.stringify([
      'Dual zippered interior compartments',
      'Protective gold-finish brass base studs',
      'Removable crossbody strap and padded top handle',
      'RFID-safe document pocket'
    ]),
    materials: 'Pebbled cruelty-free vegan leather, brushed gold hardware, stain-resistant microsuede interior.',
    dimensions: '11.0" H x 14.2" W x 4.8" D — 12L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85', color: 'Midnight Charcoal', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85', color: 'Warm Oatmeal', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Midnight Charcoal', color_hex: '#26292b', size_name: '13" Satchel', stock: 22, sku: 'STC-CHR-13' },
      { color_name: 'Midnight Charcoal', color_hex: '#26292b', size_name: '15" Satchel', stock: 14, sku: 'STC-CHR-15' }
    ],
    reviews: [
      { user_name: 'Rohan M.', rating: 5.0, title: 'Best work bag ever', comment: 'Holds my iPad Pro, notebook, charger, and lunch. Very sturdy.', date_label: '3 days ago' }
    ]
  },
  {
    id: 'the-commuter-backpack',
    slug: 'the-commuter-backpack',
    name: 'The Commuter Backpack',
    category_slug: 'everyday-essentials',
    price: 64.00,
    sale_price: 78.00,
    badge: 'Bestseller',
    rating: 4.90,
    review_count: 184,
    tagline: 'Lightweight ergonomic backpack tailored for long commutes and rainy mornings.',
    description: 'Hydrophobic woven shell with cushioned breathable mesh back panel. Features a dedicated 16" laptop sleeve and quick-draw side water bottle pocket.',
    features: JSON.stringify([
      'Quick-access exterior vertical zipper',
      'Air-mesh breathable back padding and ergonomic straps',
      'Padded sleeve fits laptops up to 16 inches',
      'Hidden passport and travel card pocket against back'
    ]),
    materials: 'Recycled 900D ripstop nylon, waterproof YKK Aquaguard zips, recycled polyester lining.',
    dimensions: '17.5" H x 12.0" W x 6.0" D — 20L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85', color: 'Jet Black', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', color: 'Olive Green', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Jet Black', color_hex: '#1c1b1a', size_name: 'Standard 20L', stock: 40, sku: 'BPK-BLK-20L' },
      { color_name: 'Olive Green', color_hex: '#4e5b47', size_name: 'Standard 20L', stock: 25, sku: 'BPK-OLV-20L' }
    ],
    reviews: [
      { user_name: 'Aarav P.', rating: 5.0, title: 'Incredible comfort', comment: 'Even with a heavy laptop, the shoulder straps make it feel weightless.', date_label: '1 week ago' }
    ]
  },
  {
    id: 'the-minimalist-sling',
    slug: 'the-minimalist-sling',
    name: 'The Minimalist Sling',
    category_slug: 'on-the-go',
    price: 32.00,
    sale_price: 40.00,
    badge: 'New',
    rating: 4.70,
    review_count: 64,
    tagline: 'Compact, weatherproof crossbody pack for essential pocket items.',
    description: 'Ultra-lightweight waist or chest carry with quick-release magnetic buckle. Water-resistant zippers keep your phone, keys, and cards bone-dry.',
    features: JSON.stringify([
      'Fidlock magnetic quick-snap buckle',
      'Expandable gusset design accommodates sunglasses case',
      'Internal stretch mesh organization dividers',
      'Reflective micro-pullers for nighttime visibility'
    ]),
    materials: 'High-density matte nylon with water-resistant PU coating and anodized aluminium hardware.',
    dimensions: '5.5" H x 10.0" W x 2.0" D — 2.0L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85', color: 'Warm Oatmeal', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85', color: 'Midnight Charcoal', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Warm Oatmeal', color_hex: '#d9cdb8', size_name: 'One Size', stock: 35, sku: 'SLG-OAT-OS' },
      { color_name: 'Midnight Charcoal', color_hex: '#26292b', size_name: 'One Size', stock: 30, sku: 'SLG-CHR-OS' }
    ],
    reviews: [
      { user_name: 'Maya S.', rating: 5.0, title: 'Best hands-free bag', comment: 'Great for morning runs and cycling around town.', date_label: '5 days ago' }
    ]
  },
  {
    id: 'the-leather-wallet-folio',
    slug: 'the-leather-wallet-folio',
    name: 'The Leather Wallet Folio',
    category_slug: 'finishing-touches',
    price: 28.00,
    sale_price: 36.00,
    badge: 'Staff Pick',
    rating: 4.88,
    review_count: 79,
    tagline: 'Slimline bifold travel wallet crafted from Italian vegetable-tanned leather.',
    description: 'Designed to fit passports, currency notes, and up to 10 cards without unnecessary bulk. Features an integrated micro pen and SIM-card extraction tool pocket.',
    features: JSON.stringify([
      'Fits international passports and folded boarding passes',
      'RFID-blocking inner liner safeguards tap-and-pay cards',
      'Smooth hand-burnished and waxed edges',
      'Hidden micro-pen slot for travel declarations'
    ]),
    materials: 'Full-grain vegetable tanned leather with wax treatment and waxed linen stitching.',
    dimensions: '5.8" H x 4.0" W x 0.5" D',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    is_featured: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85', color: 'Saddle Tan', is_primary: 1 },
      { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85', color: 'Jet Black', is_primary: 0 }
    ],
    variants: [
      { color_name: 'Saddle Tan', color_hex: '#9c6644', size_name: 'Compact Bifold', stock: 45, sku: 'WLT-TAN-CB' },
      { color_name: 'Jet Black', color_hex: '#1c1b1a', size_name: 'Compact Bifold', stock: 35, sku: 'WLT-BLK-CB' }
    ],
    reviews: [
      { user_name: 'Vikram C.', rating: 5.0, title: 'Incredible leather smell', comment: 'Quality is exceptional. The passport fits like a glove.', date_label: '2 days ago' }
    ]
  }
];

const CMS_SECTIONS = [
  {
    section_key: 'announcement',
    title: 'Store Announcement Bar',
    subtitle: 'Top sliding marquee text ticker',
    content: {
      is_active: true,
      items: [
        'Complimentary delivery on qualifying orders over ₹499',
        'Fresh picks. Thoughtful details.',
        'Easy 30-day exchanges'
      ]
    }
  },
  {
    section_key: 'hero_carousel',
    title: 'Hero Slideshow Carousel',
    subtitle: 'Homepage full-width main hero slider',
    content: {
      slides: [
        {
          eyebrow: 'Made for your everyday',
          title: 'Your everyday.<br><em>Elevated.</em>',
          text: 'Thoughtfully chosen essentials that bring a little more style, comfort and confidence to every day.',
          image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85',
          ctaPrimary: { text: 'Shop the collection', link: '/shop' },
          ctaSecondary: { text: 'Discover our story', link: '#story' },
          note: 'Considered design. Everyday quality.'
        },
        {
          eyebrow: 'New Season Arrival',
          title: 'Crafted for motion.<br><em>Built for living.</em>',
          text: 'Lightweight, versatile silhouettes tailored for seamless transit between workdays and weekends.',
          image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85',
          ctaPrimary: { text: 'Explore New Arrivals', link: '/shop?filter=new' },
          ctaSecondary: { text: 'Browse Collections', link: '/shop' },
          note: '100% Sustainable finishes. Water-resistant.'
        },
        {
          eyebrow: 'Curated Travel Edit',
          title: 'The Weekend<br><em>Getaway Capsule.</em>',
          text: 'Spacious compartments, durable brass hardware, and minimalist luxury that travels effortlessly with you.',
          image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1800&q=85',
          ctaPrimary: { text: 'Shop Travel Edit', link: '/shop?category=Travel+edit' },
          ctaSecondary: { text: 'Why Shop With Us', link: '#benefits' },
          note: 'Complimentary shipping on orders over ₹499.'
        }
      ]
    }
  },
  {
    section_key: 'trust_strip',
    title: 'Trust Strip Band',
    subtitle: 'Quick 4-column value proposition strip under hero',
    content: {
      items: [
        { icon: '↗', title: 'Easy everyday style', subtitle: 'Pieces made to be lived in' },
        { icon: '◇', title: 'Thoughtful quality', subtitle: 'Details you can feel' },
        { icon: '♡', title: 'Customer-first service', subtitle: 'Here when you need us' },
        { icon: '⌁', title: 'Secure checkout', subtitle: 'Shop with confidence' }
      ]
    }
  },
  {
    section_key: 'category_strip',
    title: 'Shop by Collection Strip',
    subtitle: 'Visual category card highlights on homepage',
    content: {
      eyebrow: 'Find your favourite',
      heading: 'Shop by collection',
      ctaText: 'Explore all →',
      cards: [
        { name: 'Everyday bags', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Everyday+essentials' },
        { name: 'Work & travel', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Work+%26+travel' },
        { name: 'Weekend edit', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Travel+edit' },
        { name: 'New season', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=85', link: '/shop?filter=new' }
      ]
    }
  },
  {
    section_key: 'featured_collection',
    title: 'Featured Collection (New Arrivals)',
    subtitle: 'Product grid/carousel section on homepage',
    content: {
      eyebrow: 'Just landed',
      heading: 'New arrivals',
      subtitle: 'The latest pieces to make your everyday a little more special.',
      maxProducts: 6
    }
  },
  {
    section_key: 'editorial_banner',
    title: 'Editorial "About" Band',
    subtitle: 'Brand storytelling section with split image & text',
    content: {
      eyebrow: 'A little more considered',
      heading: 'Good design.<br>Better everyday.',
      text: "We believe the pieces you reach for most should be the ones you love most. That's why we focus on useful details, considered design and lasting style.",
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85',
      buttonText: 'Get to know us →',
      buttonLink: '#categories'
    }
  },
  {
    section_key: 'benefits_section',
    title: 'Why Shop With Us (Benefits)',
    subtitle: '3-card benefits section highlighting brand promises',
    content: {
      eyebrow: 'The difference is in the details',
      heading: 'Why shop with us?',
      cards: [
        { icon: '✳', title: 'Considered by design', text: 'Practical details and versatile styles that work with your everyday routine.' },
        { icon: '⌂', title: 'Made for real life', text: 'Easy-to-use pieces designed to go from busy weekdays to relaxed weekends.' },
        { icon: '♡', title: 'Here for you', text: 'A friendly team and a straightforward shopping experience, every step of the way.' }
      ]
    }
  },
  {
    section_key: 'newsletter_section',
    title: 'Newsletter Community Section',
    subtitle: 'Email subscription card before footer',
    content: {
      eyebrow: 'The good stuff, occasionally',
      heading: 'Join our community',
      text: 'Get first access to new arrivals, thoughtful edits and special offers.',
      buttonText: 'Sign me up →'
    }
  },
  {
    section_key: 'footer_section',
    title: 'Footer Columns & Copyright',
    subtitle: 'Footer links, address, and social links',
    content: {
      brandDescription: 'Everyday essentials, thoughtfully chosen. A little more style for the moments that make up your day.',
      exploreLinks: [
        { label: 'Collections', url: '/shop' },
        { label: 'New arrivals', url: '/shop?filter=new' },
        { label: 'Our story', url: '/#story' },
        { label: 'Why us', url: '/#benefits' }
      ],
      supportLinks: [
        { label: 'Contact us', url: '/contact' },
        { label: 'Shipping information', url: '/about' },
        { label: 'Returns & exchanges', url: '/about' }
      ],
      socialLinks: [
        { label: 'Instagram', url: 'https://instagram.com' },
        { label: 'Facebook', url: 'https://facebook.com' }
      ],
      copyright: '© 2026 Your Brand. All rights reserved.'
    }
  }
];

async function seed() {
  console.log('[DB Seed] Starting database seeding...');
  try {
    // 1. Admin & Customer Users
    console.log('[DB Seed] Seeding users...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedCustomerPassword = await bcrypt.hash('customer123', 10);

    await pool.execute(
      `INSERT INTO users (id, name, email, password, role, phone)
       VALUES (1, 'Store Administrator', 'admin@npgrand.com', ?, 'admin', '+91 98765 43210')
       ON DUPLICATE KEY UPDATE name = VALUES(name), password = VALUES(password), role = 'admin'`,
      [hashedAdminPassword]
    );

    await pool.execute(
      `INSERT INTO users (id, name, email, password, role, phone)
       VALUES (2, 'Lokesh Sharma', 'customer@npgrand.com', ?, 'customer', '+91 98765 12345')
       ON DUPLICATE KEY UPDATE name = VALUES(name), password = VALUES(password)`,
      [hashedCustomerPassword]
    );

    // 2. Categories
    console.log('[DB Seed] Seeding categories...');
    const categoryMap = {};
    for (const cat of CATEGORIES) {
      await pool.execute(
        `INSERT INTO categories (slug, name, description, image, display_order)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), image = VALUES(image), display_order = VALUES(display_order)`,
        [cat.slug, cat.name, cat.description, cat.image, cat.display_order]
      );
      const [rows] = await pool.execute(`SELECT id FROM categories WHERE slug = ?`, [cat.slug]);
      if (rows && rows[0]) {
        categoryMap[cat.slug] = rows[0].id;
      }
    }

    // 3. Products, Images, Variants, Reviews
    console.log('[DB Seed] Seeding products catalog...');
    for (const prod of PRODUCTS) {
      const catId = categoryMap[prod.category_slug] || null;
      await pool.execute(
        `INSERT INTO products (id, slug, name, category_id, price, sale_price, badge, rating, review_count, tagline, description, features, materials, dimensions, shipping_info, is_featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), category_id = VALUES(category_id), price = VALUES(price), sale_price = VALUES(sale_price),
           badge = VALUES(badge), rating = VALUES(rating), review_count = VALUES(review_count), tagline = VALUES(tagline),
           description = VALUES(description), features = VALUES(features), materials = VALUES(materials), dimensions = VALUES(dimensions),
           shipping_info = VALUES(shipping_info), is_featured = VALUES(is_featured)`,
        [
          prod.id, prod.slug, prod.name, catId, prod.price, prod.sale_price, prod.badge,
          prod.rating, prod.review_count, prod.tagline, prod.description, prod.features,
          prod.materials, prod.dimensions, prod.shipping_info, prod.is_featured
        ]
      );

      // Clean old images and insert fresh ones
      await pool.execute(`DELETE FROM product_images WHERE product_id = ?`, [prod.id]);
      for (let i = 0; i < prod.images.length; i++) {
        const img = prod.images[i];
        await pool.execute(
          `INSERT INTO product_images (product_id, image_url, color_name, is_primary, display_order)
           VALUES (?, ?, ?, ?, ?)`,
          [prod.id, img.url, img.color, img.is_primary, i]
        );
      }

      // Clean old variants and insert
      await pool.execute(`DELETE FROM product_variants WHERE product_id = ?`, [prod.id]);
      for (const v of prod.variants) {
        await pool.execute(
          `INSERT INTO product_variants (product_id, color_name, color_hex, size_name, stock_quantity, sku)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [prod.id, v.color_name, v.color_hex, v.size_name, v.stock, v.sku]
        );
      }

      // Reviews
      await pool.execute(`DELETE FROM product_reviews WHERE product_id = ?`, [prod.id]);
      for (const r of prod.reviews) {
        await pool.execute(
          `INSERT INTO product_reviews (product_id, user_name, rating, title, comment, date_label)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [prod.id, r.user_name, r.rating, r.title, r.comment, r.date_label]
        );
      }
    }

    // 4. Hero Banners
    console.log('[DB Seed] Seeding hero banners...');
    await pool.execute(`DELETE FROM banners`);
    const heroSlides = CMS_SECTIONS.find(s => s.section_key === 'hero_carousel').content.slides;
    for (let i = 0; i < heroSlides.length; i++) {
      const s = heroSlides[i];
      await pool.execute(
        `INSERT INTO banners (eyebrow, title, text, image, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, note, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.eyebrow, s.title, s.text, s.image, s.ctaPrimary.text, s.ctaPrimary.link, s.ctaSecondary.text, s.ctaSecondary.link, s.note, i]
      );
    }

    // 5. CMS Sections
    console.log('[DB Seed] Seeding CMS sections...');
    for (const s of CMS_SECTIONS) {
      await pool.execute(
        `INSERT INTO cms_sections (section_key, title, subtitle, content, is_visible)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE title = VALUES(title), subtitle = VALUES(subtitle), content = VALUES(content)`,
        [s.section_key, s.title, s.subtitle, JSON.stringify(s.content)]
      );
    }

    // 6. Delivery Settings
    console.log('[DB Seed] Seeding delivery settings...');
    await pool.execute(
      `INSERT INTO delivery_settings (id, free_delivery_threshold, standard_shipping_fee, express_shipping_fee, estimated_delivery_days, cod_enabled, return_window_days)
       VALUES (1, 499.00, 49.00, 99.00, '2-4 business days', TRUE, 30)
       ON DUPLICATE KEY UPDATE
         free_delivery_threshold = VALUES(free_delivery_threshold),
         standard_shipping_fee = VALUES(standard_shipping_fee),
         express_shipping_fee = VALUES(express_shipping_fee),
         estimated_delivery_days = VALUES(estimated_delivery_days)`
    );

    // 7. Store Settings
    console.log('[DB Seed] Seeding store settings...');
    await pool.execute(
      `INSERT INTO store_settings (id, store_name, logo_url, email, phone, address, currency, announcement_text)
       VALUES (1, 'Your Brand', '/assets/brand-logo.png', 'support@npgrand.com', '+91 98765 43210', 'Plot 42, Design District, Bengaluru, India', '₹', 'Complimentary delivery on qualifying orders over ₹499')
       ON DUPLICATE KEY UPDATE store_name = VALUES(store_name)`
    );

    // 8. Coupons
    console.log('[DB Seed] Seeding coupons...');
    await pool.execute(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, is_active)
       VALUES
         ('WELCOME10', 'percentage', 10.00, 200.00, 50.00, TRUE),
         ('FREESHIP', 'fixed', 49.00, 300.00, 49.00, TRUE),
         ('NPGRAND15', 'percentage', 15.00, 500.00, 100.00, TRUE)
       ON DUPLICATE KEY UPDATE discount_value = VALUES(discount_value)`
    );

    // 9. Blogs
    console.log('[DB Seed] Seeding blogs...');
    await pool.execute(
      `INSERT INTO blogs (slug, title, excerpt, content, cover_image, author)
       VALUES
         ('sustainable-canvas-revolution', 'Sustainable Canvas: Inside Our Organic Cotton Weave', 'How we source GOTS-certified organic cotton to craft long-lasting, weatherproof everyday totes.', 'At NP Grand, sustainability is not an afterthought—it is the very architecture of how we design. Every yard of canvas undergoes custom spinning for abrasion resistance...', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85', 'Elena Vance'),
         ('the-art-of-minimalist-packing', 'The Art of Minimalist Packing for Weekend Getaways', 'Essential tips for packing 4 days of essentials into an overhead-compliant 38L Weekender duffel.', 'Whether heading for an impromptu coastal escape or a quick creative retreat, packing light transforms the way you travel. Learn how to fold, organize, and utilize smart shoe partitions...', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85', 'David Kim')
       ON DUPLICATE KEY UPDATE title = VALUES(title)`
    );

    console.log('✅ [DB Seed] Database seeded successfully with all theme demo content!');
    process.exit(0);
  } catch (error) {
    console.error('❌ [DB Seed Error]', error);
    process.exit(1);
  }
}

seed();

