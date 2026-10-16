import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaDocumento } from '@/features/account/PaginaDocumento';

export const metadata: Metadata = { title: 'Termini di servizio · Noxa' };

/** Termini di servizio, versione 2026-10 (VERSIONI_DOCUMENTI, R-63). */
export default function PaginaTermini() {
  return (
    <PaginaDocumento
      etichetta="Versione 2026-10 · in vigore dal 16.10.2026"
      titolo="Termini di servizio"
    >
      <p>
        Questi termini sono l’accordo tra te e Noxa. Li abbiamo scritti in modo semplice: se
        qualcosa non è chiaro, scrivici a <span className="mono">supporto@noxa.app</span>.
      </p>

      <h2>1. Cos’è Noxa</h2>
      <p>
        Noxa ti aiuta a scoprire eventi a Milano e in Brianza, a organizzare le serate con gli
        amici, a tornare a casa in sicurezza e a ricordare le tue serate. Noxa non vende biglietti e
        non organizza eventi.
      </p>

      <h2>2. Chi può usarla</h2>
      <ul>
        <li>Devi avere almeno 14 anni.</li>
        <li>
          Devi indicare la tua vera data di nascita: serve a mostrarti solo eventi adatti alla tua
          età e a proteggere chi ha meno di 18 anni. Non si può cambiare dall’app.
        </li>
        <li>Puoi avere un solo account, personale: non prestarlo e non usare quello di altri.</li>
      </ul>

      <h2>3. Il tuo account</h2>
      <p>
        Tieni segreta la password. Se pensi che qualcuno la conosca, cambiala subito da “Password
        dimenticata?”. Puoi uscire dall’account e cancellarlo quando vuoi.
      </p>

      <h2>4. Come comportarsi</h2>
      <ul>
        <li>Rispetta le altre persone: niente molestie, minacce, insulti o discriminazioni.</li>
        <li>Non usare Noxa per contattare chi non conosci o per chiedere dati personali.</li>
        <li>
          Non caricare contenuti violenti, sessuali, illegali o che offrono alcol a minorenni.
        </li>
        <li>Non usare Noxa per pubblicità, spam o per raccogliere dati degli utenti.</li>
        <li>Non dichiarare un’età falsa e non aggirare le protezioni dell’app.</li>
      </ul>

      <h2>5. Quello che carichi</h2>
      <p>
        Puoi caricare solo contenuti che hai il diritto di condividere, per esempio il flyer di un
        evento. Ci permetti di mostrarli agli altri utenti dentro Noxa. Ogni flyer viene controllato
        da una persona prima di essere pubblicato e ogni contenuto può essere segnalato.
      </p>

      <h2>6. Gli eventi</h2>
      <p>
        Le informazioni sugli eventi arrivano dai siti e dagli account pubblici dei locali e dai
        flyer degli utenti, sempre con il link alla fonte. Possono contenere errori o cambiare:
        prima di uscire controlla con il locale orari, prezzi e regole d’ingresso.
      </p>

      <h2>7. Sicurezza</h2>
      <p>
        Check-in e ritorno sicuro aiutano i tuoi amici a sapere che stai bene, ma non sostituiscono
        i servizi di emergenza. In caso di pericolo chiama il <span className="mono">112</span>.
      </p>

      <h2>8. Segnalazioni e moderazione</h2>
      <p>
        Puoi segnalare profili, eventi e contenuti in due tocchi. Se un contenuto o un account viola
        questi termini possiamo rimuoverlo o sospendere l’account, spiegandoti il motivo. Se non sei
        d’accordo con una decisione puoi presentare reclamo rispondendo alla notifica che la
        comunica.
      </p>

      <h2>9. Responsabilità</h2>
      <p>
        Facciamo il possibile perché Noxa funzioni bene, ma può avere interruzioni o errori. Non
        siamo responsabili degli eventi, dei locali e dei comportamenti di altre persone, nei limiti
        previsti dalla legge italiana. I tuoi diritti come consumatore restano sempre validi.
      </p>

      <h2>10. Modifiche</h2>
      <p>
        Se cambiamo questi termini te lo diciamo nell’app con un riassunto delle novità e ti
        chiediamo di accettarli di nuovo. Se non li accetti puoi uscire e cancellare l’account.
      </p>

      <h2>11. Legge applicabile</h2>
      <p>
        Questi termini sono regolati dalla legge italiana. Il modo in cui trattiamo i tuoi dati è
        spiegato nell’
        <Link className="link-accesso is-in-linea" href="/privacy/">
          informativa privacy
        </Link>
        .
      </p>
    </PaginaDocumento>
  );
}
