import '../styles/tokens.css';
import '../styles/admin.css';
import { AdminProviders } from '../components/AdminProviders';

export const metadata = {
  title: 'NP Grand — Admin Control Dashboard',
  description: 'Enterprise administration dashboard for NP Grand e-commerce platform',
  icons: {
    icon: '/assets/brand-logo.png',
    apple: '/assets/brand-logo.png'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anybody:ital,wght@0,100..900;1,100..900&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: 'var(--font-body, "DM Sans", sans-serif)' }}>
        <AdminProviders>
          {children}
        </AdminProviders>
      </body>
    </html>
  );
}

