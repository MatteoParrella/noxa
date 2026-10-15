import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Le variabili stanno nel .env alla radice del monorepo (.env.example), condiviso con il worker.
loadEnvConfig(path.resolve(process.cwd(), '../..'));

// Export statico servito da Vercel e incluso nelle app Capacitor (ADR-0001).
// Le pagine *.dev.tsx (catalogo dei componenti) esistono solo in sviluppo (DESIGN.md §3) e
// nella build dei test e2e (NOXA_CATALOGO=1), che verificano il catalogo con axe.
const sviluppo = process.env.NODE_ENV === 'development' || process.env.NOXA_CATALOGO === '1';

const configurazione: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: sviluppo ? ['dev.tsx', 'tsx', 'ts'] : ['tsx', 'ts'],
};

export default configurazione;
