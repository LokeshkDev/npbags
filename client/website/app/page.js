import { getCMSSections, getProducts, getCategories } from '../lib/api';
import { HeroBanner } from '../components/home/HeroBanner';
import { CategoryShortcuts } from '../components/home/CategoryShortcuts';
import { AudienceCards } from '../components/home/AudienceCards';
import { JewelleryGallery } from '../components/home/JewelleryGallery';
import { ShopByPrice } from '../components/home/ShopByPrice';
import { BestSellingSection } from '../components/home/BestSellingSection';
import { TrustStrip } from '../components/home/TrustStrip';
import { CampaignBanners } from '../components/home/CampaignBanners';
import { NewsletterSection } from '../components/home/NewsletterSection';

export default async function HomePage() {
  const [sections, bestSellingData, categoriesData] = await Promise.all([
    getCMSSections(),
    getProducts({ is_best_selling: '1' }),
    getCategories()
  ]);

  const bestSellers = bestSellingData?.products || [];
  const categories = categoriesData || [];

  // Default fallback order if _order is not defined in DB (Desktop: Hero Banner first, Category Strip second)
  const defaultBodyOrder = [
    'hero_carousel',
    'category_strip',
    'audience_cards',
    'jewellery_gallery',
    'shop_by_price',
    'featured_collection',
    'trust_strip',
    'campaign_banners',
    'newsletter_section'
  ];

  // If DB returned sections._order, use it, filtering out non-body sections (announcement, nav, footer)
  let activeOrder = defaultBodyOrder;
  if (Array.isArray(sections?._order) && sections._order.length > 0) {
    const validKeys = sections._order.filter(key =>
      key !== 'announcement' && key !== 'main_navigation' && key !== 'footer_section' && key !== 'benefits_section' && key !== 'editorial_banner'
    );
    // Keep any default body sections that might be missing from _order
    const missing = defaultBodyOrder.filter(k => !validKeys.includes(k));
    activeOrder = [...validKeys, ...missing];
  }

  const renderSection = (key) => {
    switch (key) {
      case 'hero_carousel':
        return <HeroBanner key="hero_carousel" data={sections?.hero_carousel} />;
      case 'category_strip':
        return <CategoryShortcuts key="category_strip" data={sections?.category_strip} categories={categories} />;
      case 'audience_cards':
        return <AudienceCards key="audience_cards" data={sections?.audience_cards} />;
      case 'jewellery_gallery':
        return <JewelleryGallery key="jewellery_gallery" data={sections?.jewellery_gallery} />;
      case 'shop_by_price':
        return <ShopByPrice key="shop_by_price" data={sections?.shop_by_price} />;
      case 'featured_collection':
      case 'best_selling':
        return <BestSellingSection key="featured_collection" products={bestSellers} />;
      case 'trust_strip':
        return <TrustStrip key="trust_strip" data={sections?.trust_strip} />;
      case 'campaign_banners':
        return <CampaignBanners key="campaign_banners" data={sections?.campaign_banners} />;
      case 'newsletter_section':
        return <NewsletterSection key="newsletter_section" data={sections?.newsletter_section} />;
      default:
        return null;
    }
  };

  return (
    <>
      {activeOrder.map((sectionKey) => renderSection(sectionKey))}
    </>
  );
}
