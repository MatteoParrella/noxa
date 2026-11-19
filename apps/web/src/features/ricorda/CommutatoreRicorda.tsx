import Link from 'next/link';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';

const testi = messaggi.ricorda.commutatore;

export type PaginaRicorda = 'diario' | 'statistiche' | 'badge';

const VOCI: ReadonlyArray<{ pagina: PaginaRicorda; href: string; etichetta: string }> = [
  { pagina: 'diario', href: '/ricorda/', etichetta: testi.diario },
  { pagina: 'statistiche', href: '/ricorda/statistiche/', etichetta: testi.statistiche },
  { pagina: 'badge', href: '/ricorda/badge/', etichetta: testi.badge },
];

/**
 * Diario · Statistiche · Badge (design/F-31-statistiche, componenti). Sono tre pagine, quindi
 * una navigazione con `aria-current` invece di un gruppo di schede.
 */
export function CommutatoreRicorda({ attiva }: { attiva: PaginaRicorda }) {
  return (
    <nav className="ri-comm" aria-label={testi.etichetta}>
      {VOCI.map((voce) => (
        <Link
          key={voce.pagina}
          href={voce.href}
          className={classi('ri-comm-voce', voce.pagina === attiva && 'is-on')}
          aria-current={voce.pagina === attiva ? 'page' : undefined}
        >
          {voce.etichetta}
        </Link>
      ))}
    </nav>
  );
}
