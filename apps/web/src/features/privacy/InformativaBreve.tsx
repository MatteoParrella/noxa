import { ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { Icona } from '@/components/ui/Icona';
import { IN_VIGORE_DAL, PERCORSI, VERSIONI_DOCUMENTI } from '@/features/account/documenti';
import { messaggi } from '@/lib/messaggi/it';

const testi = messaggi.privacy.informativa;

/**
 * Informativa in breve (design/F-42-privacy §4, R-63): il primo livello in parole semplici,
 * poi il testo completo in /privacy. I contenuti seguono SAFETY_PRIVACY.md.
 */
export function InformativaBreve() {
  return (
    <div className="flex flex-col">
      <ol className="pv-informativa">
        {testi.blocchi.map((blocco, indice) => (
          <li key={blocco.titolo} className="pv-blocco">
            <span className="pv-numero" aria-hidden="true">
              {String(indice + 1).padStart(2, '0')}
            </span>
            <div>
              <h2>{blocco.titolo}</h2>
              <ul>
                {blocco.righe.map((riga) => (
                  <li key={riga} className="t-corpo">
                    {riga}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <Link className="pv-riga" href={PERCORSI.privacy}>
        <Icona icona={FileText} />
        <span className="min-w-0">
          <b>{testi.completa}</b>
          <small className="mono">{PERCORSI.privacy}</small>
        </span>
        <span className="valore">
          <Icona icona={ChevronRight} dimensione="s" />
        </span>
      </Link>
      <p className="pv-versione">
        {testi.versione(VERSIONI_DOCUMENTI.privacy, IN_VIGORE_DAL.privacy)}
      </p>
    </div>
  );
}
