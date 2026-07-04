import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google';
import { SupabaseListener } from '@/components/supabase-listener';
import { NetworkErrorHandler } from '@/components/network-error-handler';
import { ToastProvider } from '@/components/ui/toast';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/brand';
import { getSiteUrl } from '@/lib/site-url';
import './globals.css';

const siteUrl = getSiteUrl();

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ url: '/logo.png', width: 512, height: 512, alt: APP_NAME }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans">
        <ToastProvider>
          <NetworkErrorHandler />
          <SupabaseListener />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
