import type { Metadata } from 'next';
import { PaginaDocumento } from '@/features/account/PaginaDocumento';

export const metadata: Metadata = { title: 'NoxaBot · Noxa' };

/**
 * Pagina indicata nello user agent del worker, `NoxaBot/1.0 (+https://noxanight.it/bot)`
 * (EVENT_INGESTION.md §2.4): chi legge i siti dei locali, con quali regole e come chiedere la
 * rimozione. Pubblica, senza accesso.
 */
export default function PaginaBot() {
  return (
    <PaginaDocumento etichetta="Per i gestori dei siti" titolo="NoxaBot">
      <p>
        NoxaBot è il programma con cui Noxa legge le pagine pubbliche degli eventi dei locali di
        Milano e della Brianza, per mostrarli nell’app a chi cerca dove uscire la sera. Si presenta
        con lo user agent <span className="mono">NoxaBot/1.0 (+https://noxanight.it/bot)</span>.
      </p>

      <h2>Quali siti legge</h2>
      <p>
        Solo i siti che abbiamo controllato uno per uno: le pagine degli eventi devono essere
        pubbliche e né il file robots.txt né i termini d’uso del sito devono vietarne la lettura.
      </p>

      <h2>Come si comporta</h2>
      <ul>
        <li>Rispetta robots.txt, anche la direttiva Crawl-delay.</li>
        <li>Fa al massimo una richiesta ogni 5 secondi per sito e 50 pagine per lettura.</li>
        <li>Si ferma subito se il sito risponde con un errore 403 o 429.</li>
        <li>Non accede ad aree riservate e non aggira CAPTCHA o paywall.</li>
      </ul>

      <h2>Cosa salva</h2>
      <p>
        Solo le informazioni sull’evento: titolo, data, orari, locale, generi musicali, età minima e
        link ai biglietti. Non salva dati personali né immagini. Ogni evento mostrato in Noxa
        rimanda sempre alla pagina originale del vostro sito.
      </p>

      <h2>Come chiedere la rimozione</h2>
      <p>Per bloccare NoxaBot basta aggiungere al file robots.txt del sito:</p>
      <pre className="mono">User-agent: NoxaBot{'\n'}Disallow: /</pre>
      <p>
        Oppure scrivete a <span className="mono">bot@noxanight.it</span> indicando il sito: entro 72
        ore smettiamo di leggerlo.
      </p>
    </PaginaDocumento>
  );
}
