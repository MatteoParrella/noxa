import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaDocumento } from '@/features/account/PaginaDocumento';

export const metadata: Metadata = { title: 'Informativa privacy · Noxa' };

/**
 * Informativa privacy, versione 2026-10 (VERSIONI_DOCUMENTI, R-63): riassunto nella
 * registrazione, testo completo qui. Le regole sono in docs/SAFETY_PRIVACY.md.
 */
export default function PaginaPrivacy() {
  return (
    <PaginaDocumento
      etichetta="Versione 2026-10 · in vigore dal 16.10.2026"
      titolo="Informativa privacy"
    >
      <p>
        Qui trovi quali dati raccogliamo, perché, chi li vede e per quanto tempo li teniamo. Per
        qualsiasi domanda scrivici a <span className="mono">privacy@noxa.app</span>.
      </p>

      <h2>1. Chi tratta i tuoi dati</h2>
      <p>
        Il titolare del trattamento è Noxa, raggiungibile a{' '}
        <span className="mono">privacy@noxa.app</span>.
      </p>

      <h2>2. Cosa raccogliamo</h2>
      <ul>
        <li>
          <b>Quando ti registri</b>: email, password (salvata cifrata, nessuno la può leggere),
          username, il nome che scegli e la data di nascita.
        </li>
        <li>
          <b>Quando accetti termini e informativa</b>: la versione accettata e la data.
        </li>
        <li>
          <b>Quando usi l’app</b>: gli amici, i gruppi e le serate che crei, gli eventi che segni,
          le segnalazioni che invii.
        </li>
        <li>
          <b>Solo se accendi le funzioni</b>: il locale del check-in, la posizione durante il
          ritorno sicuro, le spese e i ricordi del tracker, le notifiche.
        </li>
      </ul>
      <p>
        Non ti chiediamo mai numero di telefono, nome vero, genere, indirizzo di casa o la rubrica
        del telefono.
      </p>

      <h2>3. Perché li usiamo</h2>
      <ul>
        <li>Per farti usare Noxa, come previsto dai termini (contratto).</li>
        <li>
          Per proteggerti, in particolare se hai meno di 18 anni: la data di nascita serve a
          mostrarti solo eventi adatti e a limitare chi può trovarti (legittimo interesse e obblighi
          di legge).
        </li>
        <li>
          Per le funzioni facoltative come posizione e notifiche, solo se le accendi tu (consenso).
        </li>
      </ul>
      <p>Non mostriamo pubblicità e non usiamo i tuoi dati per profilarti.</p>

      <h2>4. Chi vede cosa</h2>
      <ul>
        <li>Gli altri utenti vedono solo username e nome, e solo se possono trovarti.</li>
        <li>La data di nascita e la tua età non le vede nessuno.</li>
        <li>La posizione la vedono solo gli amici che scegli tu, e si cancella dopo 24 ore.</li>
        <li>
          I moderatori vedono solo i contenuti segnalati, e ogni loro accesso viene registrato.
        </li>
      </ul>

      <h2>5. Dove sono e chi ci aiuta</h2>
      <p>I dati sono conservati nell’Unione europea. Ci aiutano questi fornitori:</p>
      <ul>
        <li>Supabase (Francoforte): database, account e file.</li>
        <li>Vercel e Fly.io (Unione europea): pubblicazione dell’app e raccolta degli eventi.</li>
        <li>
          Cloudflare Turnstile: la verifica di sicurezza alla registrazione e all’accesso, che usa
          dati tecnici del browser e l’indirizzo IP per riconoscere i programmi automatici.
        </li>
        <li>
          Anthropic: legge l’immagine dei flyer caricati per estrarre i dati dell’evento, senza
          ricevere chi li ha caricati.
        </li>
        <li>Google e Apple: consegnano le notifiche push, se le accendi.</li>
        <li>Sentry (Unione europea): errori tecnici, senza email, posizioni o testi.</li>
      </ul>

      <h2>6. Quanto li teniamo</h2>
      <ul>
        <li>Account e dati collegati: finché hai l’account.</li>
        <li>Posizione del ritorno sicuro e check-in: 24 ore.</li>
        <li>Account non confermato con il link dell’email: 24 ore.</li>
        <li>Account senza accessi per 24 mesi: ti avvisiamo, poi lo cancelliamo dopo 30 giorni.</li>
        <li>
          Quando cancelli l’account cancelliamo tutto subito; dalle copie di sicurezza i dati
          spariscono entro 30 giorni.
        </li>
      </ul>

      <h2>7. I tuoi diritti</h2>
      <p>
        Puoi vedere, scaricare, correggere e cancellare i tuoi dati, e opporti al loro uso. Dal
        profilo puoi scaricarli e cancellare l’account senza chiedere a nessuno; per il resto
        scrivici a <span className="mono">privacy@noxa.app</span>. Puoi anche presentare reclamo al
        Garante per la protezione dei dati personali.
      </p>

      <h2>8. Se hai meno di 18 anni</h2>
      <p>
        Dai 14 anni puoi usare Noxa da solo, senza il consenso dei genitori (art. 2-quinquies del
        Codice privacy). Per proteggerti ti trovano solo persone della tua età, un adulto può
        aggiungerti solo con un codice che gli dai tu, e non vedi eventi né contenuti legati
        all’alcol.
      </p>

      <h2>9. Modifiche</h2>
      <p>
        Se cambiamo questa informativa te lo diciamo nell’app con un riassunto delle novità e ti
        chiediamo di leggerla di nuovo. Le regole d’uso sono nei{' '}
        <Link className="link-accesso is-in-linea" href="/termini/">
          termini di servizio
        </Link>
        .
      </p>
    </PaginaDocumento>
  );
}
