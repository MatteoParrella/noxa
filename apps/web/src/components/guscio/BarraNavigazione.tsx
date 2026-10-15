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
import { Icona } from '@/components/ui/Icona';
import { classi } from '@/lib/classi';

type Voce = { href: string; etichetta: string; icona: LucideIcon };

/** Le cinque aree dell'app (PRD: scopri → organizza → vivi → ricorda, più il profilo). */
export const VOCI: readonly Voce[] = [
  { href: '/scopri/', etichetta: 'Scopri', icona: Compass },
  { href: '/organizza/', etichetta: 'Organizza', icona: Users },
  { href: '/vivi/', etichetta: 'Vivi', icona: ShieldCheck },
  { href: '/ricorda/', etichetta: 'Ricorda', icona: BookOpen },
  { href: '/profilo/', etichetta: 'Profilo', icona: CircleUserRound },
];

function normalizza(percorso: string): string {
  return percorso.endsWith('/') ? percorso : `${percorso}/`;
}

export function BarraNavigazione() {
  const percorso = normalizza(usePathname());
  return (
    <nav className="barra-nav" aria-label="Principale">
      {VOCI.map((voce) => {
        const attiva = percorso.startsWith(voce.href);
        return (
          <Link
            key={voce.href}
            href={voce.href}
            className={classi('nav-voce', attiva && 'is-on')}
            aria-current={attiva ? 'page' : undefined}
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
