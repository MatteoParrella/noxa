import Link from 'next/link';
import { PERCORSI } from '@/features/account/documenti';
import { messaggi } from '@/lib/messaggi/it';

/** Piè di pagina del layout desktop (ADR-0033): marchio, zona e documenti. Sul telefono non c'è. */
export function PiedeSito() {
  const testi = messaggi.piede;
  return (
    <footer className="piede-sito">
      <div className="piede-sito-riga">
        <span className="piede-sito-marchio">
          noxa
          <span className="marchio-punto" aria-hidden="true" />
        </span>
        <span className="t-corpo-s c-2">{testi.frase}</span>
        <nav className="piede-sito-link" aria-label={testi.documenti}>
          <Link href={PERCORSI.sicurezza}>{testi.sicurezza}</Link>
          <Link href={PERCORSI.termini}>{testi.termini}</Link>
          <Link href={PERCORSI.privacy}>{testi.privacy}</Link>
        </nav>
      </div>
    </footer>
  );
}
