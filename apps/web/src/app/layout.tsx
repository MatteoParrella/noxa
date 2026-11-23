import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Carattere di sistema per l'interfaccia (ADR-0035): Inter è il ripiego dove non c'è SF Pro
// né Roboto, Archivo resta per i momenti di marca.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter/index.css';
import { Apertura } from '@/components/guscio/Apertura';
import { Fornitori } from '@/components/guscio/Fornitori';
import { RegistraServiceWorker } from '@/components/guscio/RegistraServiceWorker';
import { SCRIPT_TEMA } from '@/lib/tema';
import './globals.css';

const DESCRIZIONE = 'Scopri, organizza, vivi e ricorda le tue serate a Milano e in Brianza.';
// Indirizzo pubblico dell'app: rende assoluti i link dell'anteprima condivisa.
const URL_APP = process.env.NEXT_PUBLIC_URL_APP;

export const metadata: Metadata = {
  ...(URL_APP ? { metadataBase: new URL(URL_APP) } : {}),
  title: 'Noxa',
  description: DESCRIZIONE,
  // Anteprima del link nelle chat e nei social: solo marchio e descrizione, nessun dato.
  openGraph: {
    type: 'website',
    siteName: 'Noxa',
    title: 'Noxa',
    description: DESCRIZIONE,
    locale: 'it_IT',
    images: [{ url: '/icone/anteprima.png', width: 1200, height: 630, alt: 'Noxa' }],
  },
  twitter: { card: 'summary_large_image', title: 'Noxa', description: DESCRIZIONE },
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
  themeColor: '#000000',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <Apertura />
        <Fornitori>{children}</Fornitori>
        <RegistraServiceWorker />
      </body>
    </html>
  );
}
