import type { NextConfig } from 'next';

// Export statico servito da Vercel e incluso nelle app Capacitor (ADR-0001).
// Le pagine *.dev.tsx (catalogo dei componenti) esistono solo in sviluppo (DESIGN.md §3).
const sviluppo = process.env.NODE_ENV === 'development';

const configurazione: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: sviluppo ? ['dev.tsx', 'tsx', 'ts'] : ['tsx', 'ts'],
};

export default configurazione;
