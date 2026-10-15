import { getCMSSections, getProducts } from '../lib/api';
import { HeroBanner } from '../components/home/HeroBanner';
import { TrustStrip } from '../components/home/TrustStrip';
import { CategorySection } from '../components/home/CategorySection';
import { ProductSection } from '../components/home/ProductSection';
import { BestSellingSection } from '../components/home/BestSellingSection';
import { EditorialBanner } from '../components/home/EditorialBanner';
import { BenefitsSection } from '../components/home/BenefitsSection';
import { NewsletterSection } from '../components/home/NewsletterSection';

export default async function HomePage() {
  const [sections, newArrivalsData, bestSellingData] = await Promise.all([
    getCMSSections(),
    getProducts({ is_new_arrival: '1' }),
    getProducts({ is_best_selling: '1' })
  ]);

  const newArrivals = newArrivalsData?.products || [];
  const bestSellers = bestSellingData?.products || [];

  return (
    <>
      <HeroBanner data={sections?.hero_carousel} />
      <TrustStrip data={sections?.trust_strip} />
      <CategorySection data={sections?.category_strip} />
      <ProductSection data={sections?.featured_collection} products={newArrivals} />
      <BestSellingSection products={bestSellers} />
      <EditorialBanner data={sections?.editorial_banner} />
      <BenefitsSection data={sections?.benefits_section} />
      <NewsletterSection data={sections?.newsletter_section} />
    </>
  );
}

