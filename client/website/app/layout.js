import '../styles/tokens.css';
import '../styles/global.css';
import '../styles/components.css';
import '../styles/screenshot-theme.css';
import '../styles/shop.css';
import '../styles/pdp.css';
import '../styles/categories.css';

import { CartProvider } from '../lib/cart-context';
import { WishlistProvider } from '../lib/wishlist-context';
import { QuickViewProvider } from '../lib/quickview-context';
import { AuthProvider } from '../lib/auth-context';

import { SiteAnnouncement } from '../components/layout/SiteAnnouncement';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { CartDrawer } from '../components/layout/CartDrawer';
import { QuickViewModal } from '../components/layout/QuickViewModal';
import { Toast } from '../components/layout/Toast';
import { getCMSSections } from '../lib/api';

export const metadata = {
  title: 'NP Grand Shopping — Everyday, Elevated | Premium Bags, Jewellery & Essentials',
  description: 'Shop curated handbags, jewellery, footwear, water bottles, and lifestyle essentials for women, men, and kids with premium craftsmanship and complimentary delivery over ₹499.',
  icons: {
    icon: '/assets/brand-logo.png',
    apple: '/assets/brand-logo.png'
  }
};

export default async function RootLayout({ children }) {
  const sections = await getCMSSections();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400..800;1,400..800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <QuickViewProvider>
                <SiteAnnouncement data={sections?.announcement} />
                <SiteHeader navigationData={sections?.main_navigation} />
                <main id="main-content">{children}</main>
                <SiteFooter data={sections?.footer_section} />
                <CartDrawer />
                <QuickViewModal />
                <Toast />
              </QuickViewProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
