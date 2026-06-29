import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SupabaseListener } from '@/components/supabase-listener';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseListener />
        {children}
      </body>
    </html>
  );
}
