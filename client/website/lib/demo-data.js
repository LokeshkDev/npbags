export const DEMO_SETTINGS = {
  store_name: 'Your Brand',
  logo_url: '/assets/brand-logo.png',
  email: 'support@npgrand.com',
  phone: '+91 98765 43210',
  currency: '₹',
  announcement_text: 'Complimentary delivery on qualifying orders over ₹499'
};

export const DEMO_DELIVERY = {
  free_delivery_threshold: 499.00,
  standard_shipping_fee: 49.00,
  express_shipping_fee: 99.00,
  estimated_delivery_days: '2-4 business days',
  cod_enabled: true,
  return_window_days: 30
};

export const DEMO_CMS_SECTIONS = {
  announcement: {
    is_active: true,
    items: [
      'Complimentary delivery on qualifying orders over ₹499',
      'Fresh picks. Thoughtful details.',
      'Easy 30-day exchanges'
    ]
  },
  hero_carousel: {
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
  },
  trust_strip: {
    items: [
      { icon: '↗', title: 'Easy everyday style', subtitle: 'Pieces made to be lived in' },
      { icon: '◇', title: 'Thoughtful quality', subtitle: 'Details you can feel' },
      { icon: '♡', title: 'Customer-first service', subtitle: 'Here when you need us' },
      { icon: '⌁', title: 'Secure checkout', subtitle: 'Shop with confidence' }
    ]
  },
  category_strip: {
    eyebrow: 'Find your favourite',
    heading: 'Shop by collection',
    ctaText: 'Explore all →',
    cards: [
      { name: 'Everyday bags', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Everyday+essentials' },
      { name: 'Work & travel', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Work+%26+travel' },
      { name: 'Weekend edit', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Travel+edit' },
      { name: 'New season', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=85', link: '/shop?filter=new' }
    ]
  },
  featured_collection: {
    eyebrow: 'Just landed',
    heading: 'New arrivals',
    subtitle: 'The latest pieces to make your everyday a little more special.',
    maxProducts: 6
  },
  editorial_banner: {
    eyebrow: 'A little more considered',
    heading: 'Good design.<br>Better everyday.',
    text: "We believe the pieces you reach for most should be the ones you love most. That's why we focus on useful details, considered design and lasting style.",
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85',
    buttonText: 'Get to know us →',
    buttonLink: '#categories'
  },
  benefits_section: {
    eyebrow: 'The difference is in the details',
    heading: 'Why shop with us?',
    cards: [
      { icon: '✳', title: 'Considered by design', text: 'Practical details and versatile styles that work with your everyday routine.' },
      { icon: '⌂', title: 'Made for real life', text: 'Easy-to-use pieces designed to go from busy weekdays to relaxed weekends.' },
      { icon: '♡', title: 'Here for you', text: 'A friendly team and a straightforward shopping experience, every step of the way.' }
    ]
  },
  newsletter_section: {
    eyebrow: 'The good stuff, occasionally',
    heading: 'Join our community',
    text: 'Get first access to new arrivals, thoughtful edits and special offers.',
    buttonText: 'Sign me up →'
  },
  footer_section: {
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
};

export const DEMO_PRODUCTS = [
  {
    id: 'the-everyday-tote',
    slug: 'the-everyday-tote',
    name: 'The Everyday Tote',
    cat: 'Everyday essentials',
    price: 48,
    sale_price: 60,
    badge: 'Bestseller',
    rating: 4.9,
    review_count: 148,
    tagline: 'Your go-to companion for morning commutes, market runs, and everything in between.',
    description: 'Constructed from resilient organic cotton canvas with premium reinforced saddle stitching. Roomy enough to house a 15" laptop, water bottle, planner, and daily essentials with effortless elegance.',
    features: [
      'Padded sleeve fits up to 15" laptop securely',
      'Dual reinforced shoulder straps with 10.5" drop',
      'Interior zippered slip pocket & key leash',
      'Water-repellent finish on base and exterior lining'
    ],
    materials: '100% GOTS-Certified Heavyweight Organic Cotton Canvas with vegetable-tanned leather trim and antique brass hardware.',
    dimensions: '15.5" H x 13.0" W x 5.5" D — 18L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day hassle-free returns.',
    colors: [
      { name: 'Warm Oatmeal', hex: '#d9cdb8', img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Olive Green', hex: '#4e5b47', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Midnight Charcoal', hex: '#26292b', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['Standard 18L', 'Grande 24L'],
    gallery: [
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Elena R.', date_label: '3 days ago', rating: 5, title: 'Obsessed with the craftsmanship!', comment: 'Fits my MacBook, notebook, and gym clothes without feeling bulky. The strap comfort is next level.' },
      { user_name: 'Marcus K.', date_label: '1 week ago', rating: 5, title: 'Clean design, durable feel', comment: 'The material feels heavy-duty yet very refined. Love the discreet key leash inside.' },
      { user_name: 'Sophia T.', date_label: '2 weeks ago', rating: 4.8, title: 'Perfect daily driver', comment: 'Gets compliments every time I head into the office. Worth every penny!' }
    ]
  },
  {
    id: 'the-city-crossbody',
    slug: 'the-city-crossbody',
    name: 'The City Crossbody',
    cat: 'On the go',
    price: 42,
    sale_price: 52,
    badge: 'New',
    rating: 4.8,
    review_count: 96,
    tagline: 'Streamlined, hands-free ease made for spontaneous city walks and weekend cafe hops.',
    description: 'Sleek geometric silhouette designed for essential carry. Features smooth quick-access magnetic flap closure, interior card slots, and an adjustable webbing strap for cross-body or shoulder wear.',
    features: [
      'Quick-release magnetic flap for instant access',
      'Integrated RFID-blocking card slots',
      'Adjustable seatbelt-grade woven nylon strap (32" to 54")',
      'Discrete exterior zip pocket against back body'
    ],
    materials: 'Micro-grain vegan leather, water-resistant twill lining, matte gunmetal hardware.',
    dimensions: '7.8" H x 9.4" W x 2.8" D — 3.5L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day hassle-free returns.',
    colors: [
      { name: 'Saddle Tan', hex: '#9c6644', img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Jet Black', hex: '#1c1b1a', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Forest Moss', hex: '#3d4d3e', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['Compact', 'Regular'],
    gallery: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Chloe M.', date_label: '5 days ago', rating: 5, title: 'Never leave home without it', comment: 'Fits phone, wallet, lip balm, sunglasses, and keys effortlessly without bulging.' },
      { user_name: 'David H.', date_label: '2 weeks ago', rating: 4.7, title: 'Very sleek look', comment: 'Quality of the strap and buckles is surprisingly high. Perfect for travel.' }
    ]
  },
  {
    id: 'the-weekender',
    slug: 'the-weekender',
    name: 'The Weekender',
    cat: 'Travel edit',
    price: 68,
    sale_price: 82,
    badge: 'Popular',
    rating: 4.95,
    review_count: 215,
    tagline: 'Pack light, travel far. Thoughtfully structured for 3-day getaways and overhead bins.',
    description: 'Our signature travel duffel balances generous interior volume with clever organization. Features a dedicated ventilated shoe compartment, trolley sleeve for luggage handles, and water-repellent lining.',
    features: [
      'Separate side-loading shoe or laundry compartment',
      'Luggage pass-through trolley strap fits any suitcase handle',
      'Detachable ergonomic padded shoulder strap',
      'TSA carry-on compliant for all major airlines'
    ],
    materials: '600D Recycled ballistic poly-canvas with waterproof TPU base and brushed nickel zips.',
    dimensions: '19.5" W x 12.0" H x 9.5" D — 38L Capacity',
    shipping_info: 'Free express shipping on this item. Guaranteed delivery in 2-3 business days. 30-day hassle-free returns.',
    colors: [
      { name: 'Khaki Sand', hex: '#c5b8a5', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Slate Gray', hex: '#4a4e51', img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Deep Evergreen', hex: '#1c3629', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['38L Weekend', '50L Extended'],
    gallery: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Julian B.', date_label: 'Yesterday', rating: 5, title: 'The best carry-on I have ever owned', comment: 'Took this on a 4-day trip to Montreal. Shoe compartment is brilliant and kept everything spotless.' }
    ]
  },
  {
    id: 'the-mini-shoulder',
    slug: 'the-mini-shoulder',
    name: 'The Mini Shoulder',
    cat: 'Finishing touches',
    price: 38,
    sale_price: 48,
    badge: 'Trending',
    rating: 4.75,
    review_count: 82,
    tagline: 'A sculptural 90s silhouette reworked with modern proportions and minimalist detail.',
    description: 'Slender, comfortable under-arm fit crafted from buttery soft vegan leather. Subtle curved top-line with zip-top closure and polished metallic accent studs.',
    features: [
      'Ergonomic under-arm drop fits snugly under coats',
      'Smooth sliding zinc alloy zipper with leather pull',
      'Interior card pocket & phone pocket',
      'Structured reinforced base holds its shape empty or full'
    ],
    materials: 'Smooth ultra-soft vegan nappa leather, champagne gold hardware, microfiber interior.',
    dimensions: '6.0" H x 10.5" W x 2.2" D — 2.2L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    colors: [
      { name: 'Sage Green', hex: '#778a75', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Cream Ivory', hex: '#f0ece1', img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Caramel Rust', hex: '#a85d34', img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['One Size'],
    gallery: [
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Nadia P.', date_label: '4 days ago', rating: 5, title: 'Stunning in person!', comment: 'The sage color is even prettier in natural light. Perfect for dinners or day-outs.' }
    ]
  },
  {
    id: 'the-structured-satchel',
    slug: 'the-structured-satchel',
    name: 'The Structured Satchel',
    cat: 'Work & travel',
    price: 54,
    sale_price: 68,
    badge: 'Trending',
    rating: 4.85,
    review_count: 112,
    tagline: 'Architectural lines with organized dual partitions for modern professionals.',
    description: 'Precision crafted from structured pebbled vegan leather. Stands upright gracefully on protective metal feet with padded tablet partition and key clip.',
    features: [
      'Dual zippered interior compartments',
      'Protective gold-finish brass base studs',
      'Removable crossbody strap and padded top handle',
      'RFID-safe document pocket'
    ],
    materials: 'Pebbled cruelty-free vegan leather, brushed gold hardware, stain-resistant microsuede interior.',
    dimensions: '11.0" H x 14.2" W x 4.8" D — 12L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    colors: [
      { name: 'Midnight Charcoal', hex: '#26292b', img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Warm Oatmeal', hex: '#d9cdb8', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['13" Satchel', '15" Satchel'],
    gallery: [
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Rohan M.', date_label: '3 days ago', rating: 5, title: 'Best work bag ever', comment: 'Holds my iPad Pro, notebook, charger, and lunch. Very sturdy.' }
    ]
  },
  {
    id: 'the-commuter-backpack',
    slug: 'the-commuter-backpack',
    name: 'The Commuter Backpack',
    cat: 'Everyday essentials',
    price: 64,
    sale_price: 78,
    badge: 'Bestseller',
    rating: 4.9,
    review_count: 184,
    tagline: 'Lightweight ergonomic backpack tailored for long commutes and rainy mornings.',
    description: 'Hydrophobic woven shell with cushioned breathable mesh back panel. Features a dedicated 16" laptop sleeve and quick-draw side water bottle pocket.',
    features: [
      'Quick-access exterior vertical zipper',
      'Air-mesh breathable back padding and ergonomic straps',
      'Padded sleeve fits laptops up to 16 inches',
      'Hidden passport and travel card pocket against back'
    ],
    materials: 'Recycled 900D ripstop nylon, waterproof YKK Aquaguard zips, recycled polyester lining.',
    dimensions: '17.5" H x 12.0" W x 6.0" D — 20L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    colors: [
      { name: 'Jet Black', hex: '#1c1b1a', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Olive Green', hex: '#4e5b47', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['Standard 20L'],
    gallery: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Aarav P.', date_label: '1 week ago', rating: 5, title: 'Incredible comfort', comment: 'Even with a heavy laptop, the shoulder straps make it feel weightless.' }
    ]
  },
  {
    id: 'the-minimalist-sling',
    slug: 'the-minimalist-sling',
    name: 'The Minimalist Sling',
    cat: 'On the go',
    price: 32,
    sale_price: 40,
    badge: 'New',
    rating: 4.7,
    review_count: 64,
    tagline: 'Compact, weatherproof crossbody pack for essential pocket items.',
    description: 'Ultra-lightweight waist or chest carry with quick-release magnetic buckle. Water-resistant zippers keep your phone, keys, and cards bone-dry.',
    features: [
      'Fidlock magnetic quick-snap buckle',
      'Expandable gusset design accommodates sunglasses case',
      'Internal stretch mesh organization dividers',
      'Reflective micro-pullers for nighttime visibility'
    ],
    materials: 'High-density matte nylon with water-resistant PU coating and anodized aluminium hardware.',
    dimensions: '5.5" H x 10.0" W x 2.0" D — 2.0L Capacity',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    colors: [
      { name: 'Warm Oatmeal', hex: '#d9cdb8', img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Midnight Charcoal', hex: '#26292b', img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['One Size'],
    gallery: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Maya S.', date_label: '5 days ago', rating: 5, title: 'Best hands-free bag', comment: 'Great for morning runs and cycling around town.' }
    ]
  },
  {
    id: 'the-leather-wallet-folio',
    slug: 'the-leather-wallet-folio',
    name: 'The Leather Wallet Folio',
    cat: 'Finishing touches',
    price: 28,
    sale_price: 36,
    badge: 'Staff Pick',
    rating: 4.88,
    review_count: 79,
    tagline: 'Slimline bifold travel wallet crafted from Italian vegetable-tanned leather.',
    description: 'Designed to fit passports, currency notes, and up to 10 cards without unnecessary bulk. Features an integrated micro pen and SIM-card extraction tool pocket.',
    features: [
      'Fits international passports and folded boarding passes',
      'RFID-blocking inner liner safeguards tap-and-pay cards',
      'Smooth hand-burnished and waxed edges',
      'Hidden micro-pen slot for travel declarations'
    ],
    materials: 'Full-grain vegetable tanned leather with wax treatment and waxed linen stitching.',
    dimensions: '5.8" H x 4.0" W x 0.5" D',
    shipping_info: 'Free standard shipping on orders over ₹499. Arrives in 2-4 business days. 30-day returns.',
    colors: [
      { name: 'Saddle Tan', hex: '#9c6644', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85' },
      { name: 'Jet Black', hex: '#1c1b1a', img: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85' }
    ],
    sizes: ['Compact Bifold'],
    gallery: [
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85'
    ],
    reviews: [
      { user_name: 'Vikram C.', date_label: '2 days ago', rating: 5, title: 'Incredible leather smell', comment: 'Quality is exceptional. The passport fits like a glove.' }
    ]
  }
];

export const DEMO_CATEGORIES = [
  { id: 1, slug: 'everyday-essentials', name: 'Everyday essentials', product_count: 2 },
  { id: 2, slug: 'on-the-go', name: 'On the go', product_count: 2 },
  { id: 3, slug: 'travel-edit', name: 'Travel edit', product_count: 1 },
  { id: 4, slug: 'finishing-touches', name: 'Finishing touches', product_count: 2 },
  { id: 5, slug: 'work-travel', name: 'Work & travel', product_count: 1 }
];

