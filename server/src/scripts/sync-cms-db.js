const { query } = require('../config/db');

const SECTIONS_TO_SYNC = [
  {
    section_key: 'announcement',
    title: 'Store Announcement Bar',
    subtitle: 'Top header announcement & utilities',
    is_visible: 1,
    content: {
      is_active: true,
      shipping_text: 'Free Shipping on Orders Above ₹999',
      returns_text: 'Easy Returns',
      payments_text: 'Secure Payments',
      track_order_url: '/account',
      help_support_url: '/contact'
    }
  },
  {
    section_key: 'main_navigation',
    title: 'Header & Main Navigation',
    subtitle: 'Brand logo, search bar and category menu links',
    is_visible: 1,
    content: {
      logo_url: '/assets/brand-logo.png',
      search_placeholder: 'Search for bags, jewellery, shoes, water bottles...',
      items: [
        { label: 'Home', url: '/' },
        { label: 'Women', url: '/shop?category=Womens' },
        { label: 'Men', url: '/shop?category=Mens' },
        { label: 'Kids', url: '/shop?category=Kids' },
        { label: 'Accessories', url: '/shop?category=Accessories' },
        { label: 'Bags & Handbags', url: '/shop?category=Everyday+essentials' },
        { label: 'Footwear', url: '/shop?category=Footwear' },
        { label: 'Water Bottles', url: '/shop?category=Water+Bottles' },
        { label: 'Key Chains', url: '/shop?category=Key+Chains' },
        { label: 'Offers', url: '/shop?filter=sale' },
        { label: 'New Arrivals', url: '/shop?filter=new' }
      ]
    }
  },
  {
    section_key: 'hero_carousel',
    title: 'Hero Banner Carousel',
    subtitle: 'Up to 3 rotating full-width banner slides',
    is_visible: 1,
    content: {
      banner_image: '/assets/banners/hero-banner.svg',
      button_url: '/shop',
      slides: [
        {
          id: 1,
          image: '/assets/banners/hero-banner.svg',
          link: '/shop',
          title: 'Every Style For Every You'
        },
        {
          id: 2,
          image: '/assets/banners/banner-new-arrivals.png',
          link: '/shop?filter=new',
          title: 'New Arrivals — Trending Styles'
        },
        {
          id: 3,
          image: '/assets/banners/banner-special-offers.png',
          link: '/shop?filter=sale',
          title: 'Special Offers & Exclusive Discounts'
        }
      ]
    }
  },
  {
    section_key: 'category_strip',
    title: 'Shop by Category Shortcuts',
    subtitle: '7 unshaped circular categories',
    is_visible: 1,
    content: {
      items: [
        { id: 'handbags', name: 'Bags & Handbags', image: '/assets/categories/cat-handbag.png', link: '/shop?category=Everyday+essentials' },
        { id: 'wallets', name: 'Purse & Wallets', image: '/assets/categories/cat-wallet.png', link: '/shop?category=Accessories' },
        { id: 'jewellery', name: 'Jewellery', image: '/assets/categories/cat-earrings.png', link: '/shop?category=Accessories' },
        { id: 'footwear', name: 'Footwear', image: '/assets/categories/cat-footwear.png', link: '/shop?category=Footwear' },
        { id: 'bottles', name: 'Water Bottles', image: '/assets/categories/cat-bottle.png', link: '/shop?category=Water+Bottles' },
        { id: 'keychains', name: 'Key Chains', image: '/assets/categories/cat-keychain.png', link: '/shop?category=Key+Chains' },
        { id: 'gifting', name: 'Gifting Ideas', image: '/assets/categories/cat-gifting.png', link: '/shop?category=Everyday+essentials' }
      ]
    }
  },
  {
    section_key: 'audience_cards',
    title: 'Collections by Audience',
    subtitle: 'Women, Men, and Kids feature cards with zero color overlay',
    is_visible: 1,
    content: {
      cards: [
        { id: 'women', tag: 'CURATED FOR HER', title: 'For Women', sub: 'Bags, Jewellery & Everyday Accessories', btnText: 'Shop Women', btnClass: 'audience-btn--red', link: '/shop?category=Womens', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85' },
        { id: 'men', tag: 'CURATED FOR HIM', title: 'For Men', sub: 'Stylish Footwear, Bags & Accessories', btnText: 'Shop Men', btnClass: 'audience-btn--green', link: '/shop?category=Mens', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=85' },
        { id: 'kids', tag: 'CURATED FOR LITTLE ONES', title: 'For Kids', sub: 'Fun Accessories, Bottles & Playful Essentials', btnText: 'Shop Kids', btnClass: 'audience-btn--red', link: '/shop?category=Kids', image: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?auto=format&fit=crop&w=900&q=85' }
      ]
    }
  },
  {
    section_key: 'jewellery_gallery',
    title: 'Jewellery Collections',
    subtitle: 'Timeless pieces for every occasion',
    is_visible: 1,
    content: {
      title: 'Jewellery Collections',
      subtitle: 'Timeless pieces for every occasion',
      view_all_url: '/shop?category=Accessories',
      items: [
        { name: 'Necklaces', image: '/assets/jewellery/jewel-necklaces.png', link: '/shop?category=Accessories&tag=necklaces' },
        { name: 'Earrings', image: '/assets/jewellery/jewel-earrings.png', link: '/shop?category=Accessories&tag=earrings' },
        { name: 'Bangles', image: '/assets/jewellery/jewel-bangles.png', link: '/shop?category=Accessories&tag=bangles' },
        { name: 'Kadas', image: '/assets/jewellery/jewel-kadas.png', link: '/shop?category=Accessories&tag=kadas' },
        { name: 'Tikkas', image: '/assets/jewellery/jewel-tikkas.png', link: '/shop?category=Accessories&tag=tikkas' },
        { name: 'Ear Chains', image: '/assets/jewellery/jewel-earchains.png', link: '/shop?category=Accessories&tag=earchains' },
        { name: 'Malas', image: '/assets/jewellery/jewel-malas.png', link: '/shop?category=Accessories&tag=malas' },
        { name: 'Chains', image: '/assets/jewellery/jewel-chains.png', link: '/shop?category=Accessories&tag=chains' },
        { name: 'Nose Pins', image: '/assets/jewellery/jewel-nosepins.png', link: '/shop?category=Accessories&tag=nosepins' },
        { name: 'Payals', image: '/assets/jewellery/jewel-payals.png', link: '/shop?category=Accessories&tag=payals' },
        { name: 'Haath Panjas', image: '/assets/jewellery/jewel-haathpanjas.png', link: '/shop?category=Accessories&tag=haathpanjas' },
        { name: 'Crowns', image: '/assets/jewellery/jewel-crowns.png', link: '/shop?category=Accessories&tag=crowns' }
      ]
    }
  },
  {
    section_key: 'shop_by_price',
    title: 'Shop by Price',
    subtitle: 'Great products at every budget',
    is_visible: 1,
    content: {
      title: 'Shop by Price',
      subtitle: 'Great products at every budget',
      tiers: [
        { prefix: 'Under', amount: '₹499', image: '/assets/price/price-handbag.png', alt: 'Under ₹499 Handbag', themeClass: 'price-card--blush', link: '/shop?max_price=499' },
        { prefix: '₹500 -', amount: '₹999', image: '/assets/price/price-wallet.png', alt: '₹500 - ₹999 Wallet', themeClass: 'price-card--sage', link: '/shop?min_price=500&max_price=999' },
        { prefix: '₹1,000 -', amount: '₹1,999', image: '/assets/price/price-sneakers.png', alt: '₹1,000 - ₹1,999 Sneakers', themeClass: 'price-card--peach', link: '/shop?min_price=1000&max_price=1999' },
        { prefix: '₹2,000 -', amount: '₹4,999', image: '/assets/price/price-watch.png', alt: '₹2,000 - ₹4,999 Smart Watch', themeClass: 'price-card--blush', link: '/shop?min_price=2000&max_price=4999' },
        { prefix: 'Above', amount: '₹5,000', image: '/assets/price/price-bottle.png', alt: 'Above ₹5,000 Bottle', themeClass: 'price-card--sage', link: '/shop?min_price=5000' }
      ]
    }
  },
  {
    section_key: 'trust_strip',
    title: 'Service Guarantees (Trust Strip)',
    subtitle: '4 trust icons with delivery, returns, security & range',
    is_visible: 1,
    content: {
      items: [
        { title: 'Wide Range', desc: 'Latest Collections', image: '/assets/trust/trust-wide-range.png' },
        { title: 'Secure Payments', desc: '100% Safe & Secure', image: '/assets/trust/trust-secure-payments.png' },
        { title: 'Easy Returns', desc: 'Hassle Free Returns', image: '/assets/trust/trust-easy-returns.png' },
        { title: 'Fast Delivery', desc: 'Across India', image: '/assets/trust/trust-fast-delivery.png' }
      ]
    }
  },
  {
    section_key: 'campaign_banners',
    title: 'Special Campaign Banners',
    subtitle: 'New Arrivals and Special Offers split banners',
    is_visible: 1,
    content: {
      banners: [
        { id: 'new-arrivals', title: 'New Arrivals', subtitle: 'Fresh Styles Just for You', ctaText: 'Explore Now', link: '/shop?filter=new', image: '/assets/banners/banner-new-arrivals.png' },
        { id: 'special-offers', title: 'Special Offers', subtitle: 'Best Deals on Top Brands', ctaText: 'Shop Offers', link: '/shop?filter=sale', image: '/assets/banners/banner-special-offers.png' }
      ]
    }
  },
  {
    section_key: 'newsletter_section',
    title: 'Newsletter Community Section',
    subtitle: 'Full-width clean card with email subscription',
    is_visible: 1,
    content: {
      title: 'Subscribe for Exclusive Offers',
      subtitle: 'Be the first to know about new arrivals, special offers and more.',
      button_text: 'Subscribe',
      icon: '/assets/banners/newsletter-icon.png'
    }
  },
  {
    section_key: 'footer_section',
    title: 'Footer Columns & Information',
    subtitle: 'About brand, contact details, social links, and payments',
    is_visible: 1,
    content: {
      about: 'Your one-stop destination for bags, accessories, footwear, water bottles and more for women, men and kids.',
      logo_url: '/assets/brand-logo.png',
      phone: '+91 98765 43210',
      email: 'support@npgrandshopping.com',
      hours: 'Mon - Sat, 9:00 AM - 6:00 PM',
      address: 'Ambattur, Chennai - 600053, Tamil Nadu, India',
      copyright: '© 2026 NP Grand Shopping. All Rights Reserved.',
      socials: [
        { platform: 'Facebook', url: 'https://facebook.com' },
        { platform: 'Instagram', url: 'https://instagram.com' },
        { platform: 'YouTube', url: 'https://youtube.com' },
        { platform: 'Pinterest', url: 'https://pinterest.com' },
        { platform: 'WhatsApp', url: 'https://wa.me/919876543210' }
      ],
      payment_badges: ['VISA', 'Mastercard', 'RuPay', 'UPI', 'Paytm']
    }
  }
];

async function syncAll() {
  console.log('[Sync CMS] Starting synchronization with MySQL table cms_sections...');
  for (const s of SECTIONS_TO_SYNC) {
    await query(
      `INSERT INTO cms_sections (section_key, title, subtitle, content, is_visible)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         subtitle = VALUES(subtitle),
         content = VALUES(content),
         is_visible = VALUES(is_visible)`,
      [s.section_key, s.title, s.subtitle, JSON.stringify(s.content), s.is_visible]
    );
    console.log(`[Sync CMS] ✓ Synchronized: ${s.section_key}`);
  }
  console.log('[Sync CMS] Successfully synced all 11 homepage sections to MySQL!');
  process.exit(0);
}

syncAll().catch(err => {
  console.error('[Sync CMS] Error during sync:', err);
  process.exit(1);
});

