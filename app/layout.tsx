import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SupabaseListener } from '@/components/supabase-listener';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mahendra Saree House',
  description: 'Tally bill processing and barcode sticker printing',
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
