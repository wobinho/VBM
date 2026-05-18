import type { Metadata } from 'next';
import { Bebas_Neue, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { AudioProvider } from '@/contexts/audio-context';
import AppShell from '@/components/app-shell';

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mono',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'VBM — Volleyball Manager',
  description: 'Build your dynasty. Manage your team. Dominate the court.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${bebas.variable} ${mono.variable} ${manrope.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <AudioProvider>
            <AppShell>{children}</AppShell>
          </AudioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
