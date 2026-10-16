'use client';

import {
  BookOpen,
  CircleUserRound,
  Compass,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Icona } from '@/components/ui/Icona';
import { classi } from '@/lib/classi';

type Voce = {
  href: string;
  etichetta: string;
  icona: LucideIcon;
  /** Altre pagine che appartengono all'area. */
  anche?: readonly string[];
};

/** Le cinque aree dell'app (PRD: scopri → organizza → vivi → ricorda, più il profilo). */
export const VOCI: readonly Voce[] = [
  { href: '/scopri/', etichetta: 'Scopri', icona: Compass },
  { href: '/organizza/', etichetta: 'Organizza', icona: Users },
  { href: '/vivi/', etichetta: 'Vivi', icona: ShieldCheck },
  { href: '/ricorda/', etichetta: 'Ricorda', icona: BookOpen },
  {
    href: '/profilo/',
    etichetta: 'Profilo',
    icona: CircleUserRound,
    anche: ['/amici/', '/persona/'],
  },
];

function normalizza(percorso: string): string {
  return percorso.endsWith('/') ? percorso : `${percorso}/`;
}

export function BarraNavigazione() {
  const percorso = normalizza(usePathname());
  const attiva = VOCI.findIndex(
    (voce) =>
      percorso.startsWith(voce.href) || voce.anche?.some((altro) => percorso.startsWith(altro)),
  );
  return (
    <nav className="barra-nav" aria-label="Principale">
      {attiva >= 0 && (
        <span
          className="nav-indicatore"
          aria-hidden="true"
          style={{ '--indice': attiva } as CSSProperties}
        />
      )}
      {VOCI.map((voce, indice) => {
        const corrente = indice === attiva;
        return (
          <Link
            key={voce.href}
            href={voce.href}
            className={classi('nav-voce', corrente && 'is-on')}
            aria-current={corrente ? 'page' : undefined}
          >
            <span className="nav-icona">
              <Icona icona={voce.icona} />
            </span>
            {voce.etichetta}
          </Link>
        );
      })}
    </nav>
  );
}
