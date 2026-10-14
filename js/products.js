/**
 * Product Catalog Data & Utility Functions
 * Powers both Product List Views, Quick View modals, and dynamic PDP pages.
 */

const PRODUCT_CATALOG = [
  {
    id: 'the-everyday-tote',
    name: 'The Everyday Tote',
    cat: 'Everyday essentials',
    price: 48,
    sale: 60,
    badge: 'Bestseller',
    rating: 4.9,
    reviewCount: 148,
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
    shippingInfo: 'Free standard shipping on orders over $50. Arrives in 2-4 business days. 30-day hassle-free returns.',
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
      { name: 'Elena R.', date: '3 days ago', rating: 5, title: 'Obsessed with the craftsmanship!', comment: 'Fits my MacBook, notebook, and gym clothes without feeling bulky. The strap comfort is next level.' },
      { name: 'Marcus K.', date: '1 week ago', rating: 5, title: 'Clean design, durable feel', comment: 'The material feels heavy-duty yet very refined. Love the discreet key leash inside.' },
      { name: 'Sophia T.', date: '2 weeks ago', rating: 4.8, title: 'Perfect daily driver', comment: 'Gets compliments every time I head into the office. Worth every penny!' }
    ]
  },
  {
    id: 'the-city-crossbody',
    name: 'The City Crossbody',
    cat: 'On the go',
    price: 42,
    sale: 52,
    badge: 'New',
    rating: 4.8,
    reviewCount: 96,
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
    shippingInfo: 'Free standard shipping on orders over $50. Arrives in 2-4 business days. 30-day hassle-free returns.',
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
      { name: 'Chloe M.', date: '5 days ago', rating: 5, title: 'Never leave home without it', comment: 'Fits phone, wallet, lip balm, sunglasses, and keys effortlessly without bulging.' },
      { name: 'David H.', date: '2 weeks ago', rating: 4.7, title: 'Very sleek look', comment: 'Quality of the strap and buckles is surprisingly high. Perfect for travel.' }
    ]
  },
  {
    id: 'the-weekender',
    name: 'The Weekender',
    cat: 'Travel edit',
    price: 68,
    sale: 82,
    badge: 'Popular',
    rating: 4.95,
    reviewCount: 215,
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
    shippingInfo: 'Free express shipping on this item. Guaranteed delivery in 2-3 business days. 30-day hassle-free returns.',
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
      { name: 'Julian B.', date: 'Yesterday', rating: 5, title: 'The best carry-on I have ever owned', comment: 'Took this on a 4-day trip to Montreal. Shoe compartment is brilliant and kept everything spotless.' },
      { name: 'Amara W.', date: '1 week ago', rating: 5, title: 'Sturdy, handsome and practical', comment: 'The trolley sleeve slides over my rolling bag securely. Couldn’t recommend more.' }
    ]
  },
  {
    id: 'the-mini-shoulder',
    name: 'The Mini Shoulder',
    cat: 'Finishing touches',
    price: 38,
    sale: 48,
    badge: 'Trending',
    rating: 4.75,
    reviewCount: 82,
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
    shippingInfo: 'Free standard shipping on orders over $50. Arrives in 2-4 business days. 30-day returns.',
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
      { name: 'Nadia P.', date: '4 days ago', rating: 5, title: 'Stunning in person!', comment: 'The sage color is even prettier in natural light. Perfect for dinners or day-outs.' }
    ]
  }
];

window.PRODUCT_CATALOG = PRODUCT_CATALOG;

window.getProductById = function(id) {
  if (!id) return PRODUCT_CATALOG[0];
  const cleaned = String(id).toLowerCase().trim();
  // check id match
  let found = PRODUCT_CATALOG.find(p => p.id === cleaned);
  if (found) return found;
  // check numeric index match
  const idx = parseInt(cleaned, 10);
  if (!isNaN(idx) && PRODUCT_CATALOG[idx]) {
    return PRODUCT_CATALOG[idx];
  }
  // fallback by name
  found = PRODUCT_CATALOG.find(p => p.name.toLowerCase().includes(cleaned));
  return found || PRODUCT_CATALOG[0];
};

