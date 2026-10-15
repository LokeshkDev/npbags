import { DM_Sans, Anybody } from 'next/font/google';
import '../styles/tokens.css';
import '../styles/admin.css';

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
  title: 'NP Grand — Admin Control Dashboard',
  description: 'Enterprise administration dashboard for NP Grand e-commerce platform',
  icons: {
    icon: '/assets/brand-logo.png',
    apple: '/assets/brand-logo.png'
  }
};

import { AdminProviders } from '../components/AdminProviders';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${anybody.variable}`}>
      <body style={{ fontFamily: 'var(--font-body)' }}>
        <AdminProviders>
          {children}
        </AdminProviders>
      </body>
    </html>
  );
}

