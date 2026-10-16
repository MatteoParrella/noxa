import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { Fornitori } from '@/components/guscio/Fornitori';
import { RegistraServiceWorker } from '@/components/guscio/RegistraServiceWorker';
import { SCRIPT_TEMA } from '@/lib/tema';
import './globals.css';

export const metadata: Metadata = {
  title: 'Noxa',
  description: 'Scopri, organizza, vivi e ricorda le tue serate a Milano e in Brianza.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Noxa',
  appleWebApp: { capable: true, title: 'Noxa', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icone/icona.svg', apple: '/icone/icona-180.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Colore della barra di sistema: lo sfondo del tema scuro predefinito (tokens.css).
  themeColor: '#0E1116',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <Fornitori>{children}</Fornitori>
        <RegistraServiceWorker />
      </body>
    </html>
  );
}
