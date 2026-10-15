import { DM_Sans, Anybody } from 'next/font/google';
import '../styles/tokens.css';
import '../styles/global.css';
import '../styles/components.css';
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
import { MobileAppNav } from '../components/layout/MobileAppNav';
import { Toast } from '../components/layout/Toast';
import { getCMSSections } from '../lib/api';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap'
});

const anybody = Anybody({
  subsets: ['latin'],
  variable: '--font-anybody',
  display: 'swap'
});

export const metadata = {
  title: 'Your Brand — Everyday, Elevated | Premium Bags & Handcrafted Essentials',
  description: 'Shop handcrafted everyday totes, versatile crossbody bags, commuter backpacks, and travel essentials made with premium sustainable materials. Enjoy complimentary delivery across India on qualifying orders over ₹499.',
  icons: {
    icon: '/assets/brand-logo.png',
    apple: '/assets/brand-logo.png'
  }
};

export default async function RootLayout({ children }) {
  const sections = await getCMSSections();

  return (
    <html lang="en" className={`${dmSans.variable} ${anybody.variable}`}>
      <body>
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
                <MobileAppNav />
                <Toast />
              </QuickViewProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

