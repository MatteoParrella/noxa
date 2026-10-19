'use client';

import { Globe, Map as IconaMappa, Plus, Search, Sparkles, Ticket, X } from 'lucide-react';
import { useState } from 'react';
import { AmiciPartecipano } from '@/components/ui/AmiciPartecipano';
import { Avatar, GruppoAvatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Badge, Contatore, Genere } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { CampoData } from '@/components/ui/CampoData';
import { CampoPassword } from '@/components/ui/CampoPassword';
import { CasellaLunga } from '@/components/ui/CasellaLunga';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { IndicatorePassi, IndicatorePunti } from '@/components/ui/Indicatori';
import { CodiceQr } from '@/components/ui/CodiceQr';
import { CodiceSeiCifre } from '@/components/ui/CodiceSeiCifre';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Registro } from '@/components/ui/Registro';
import { Selezione } from '@/components/ui/Selezione';
import { TabellaDensa } from '@/components/ui/TabellaDensa';
import { Interruttore } from '@/components/ui/Interruttore';
import { LinkEsterno } from '@/components/ui/LinkEsterno';
import { MenuAzioni } from '@/components/ui/MenuAzioni';
import { RigaPersona } from '@/components/ui/RigaPersona';
import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { RigaEvento, SchedaEvidenza, type DatiSchedaEvento } from '@/components/ui/SchedaEvento';
import {
  SelettorePartecipazione,
  type SceltaPartecipazione,
} from '@/components/ui/SelettorePartecipazione';
import { Schede } from '@/components/ui/Schede';
import { Segmenti } from '@/components/ui/Segmenti';
import { Caricamento, ElencoVuoto, ErroreConAzione, StrisciaOffline } from '@/components/ui/Stati';
import type { Tema } from '@/lib/tema';

const PERSONE = [
  { nome: 'Giulia Rota' },
  { nome: 'Marco Brivio' },
  { nome: 'Sara Colombo' },
  { nome: 'Luca Sala' },
  { nome: 'Anna Villa' },
];

const EVENTO: DatiSchedaEvento = {
  href: '#',
  nome: 'Notte Ferrovia, Club Binario 7, Monza, gio 15.10 23:00, 18+',
  titolo: 'Notte Ferrovia',
  locale: 'Club Binario 7',
  comune: 'Monza',
  quando: 'gio 15.10 · 23:00 → 05:00',
  ora: '23:00',
  orario: '23:00 → 05:00',
  eta: '18+',
  generi: ['techno', 'house'],
  meta: ['2,1 km', 'da 15 €'],
  copertina: { tipo: 'tipografica', alt: 'Foto di Club Binario 7' },
};

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <Rivela as="section" className="flex flex-col gap-3">
      <div className="etichetta-riga">
        <h3 className="etichetta m-0">{titolo}</h3>
      </div>
      {children}
    </Rivela>
  );
}

export function Catalogo({ tema }: { tema: Tema }) {
  const [interruttore, setInterruttore] = useState(true);
  const [quando, setQuando] = useState<'stasera' | 'domani' | 'weekend'>('stasera');
  const [tab, setTab] = useState<'prossime' | 'passate'>('prossime');
  const [foglio, setFoglio] = useState(false);
  const [data, setData] = useState('14.03.2009');
  const [termini, setTermini] = useState(false);
  const [scelta, setScelta] = useState<SceltaPartecipazione>(null);
  const [visibile, setVisibile] = useState(true);
  const [codice, setCodice] = useState('481');
  const [provincia, setProvincia] = useState<'MI' | 'MB'>('MB');
  const [motivazione, setMotivazione] = useState(false);
  const nomeTema = tema === 'scuro' ? 'Tema scuro' : 'Tema chiaro';

  return (
    <div
      data-tema={tema}
      className="flex flex-col gap-8 rounded-3 border border-linea p-6"
      aria-label={nomeTema}
      role="region"
    >
      <h2 className="t-titolo-1 m-0">{nomeTema}</h2>

      <Sezione titolo="Pulsante">
        <div className="flex flex-wrap gap-2">
          <Pulsante variante="principale">Partecipa</Pulsante>
          <Pulsante>Invita</Pulsante>
          <Pulsante variante="testo">Dettagli</Pulsante>
          <Pulsante variante="pericolo">Elimina</Pulsante>
          <Pulsante disabled>Disabilitato</Pulsante>
          <Pulsante variante="principale" caricamento>
            Invio
          </Pulsante>
          <Pulsante soloIcona variante="neutro" aria-label="Cerca">
            <Icona icona={Search} dimensione="l" />
          </Pulsante>
          <Pulsante dimensione="s">
            <Icona icona={IconaMappa} />
            Mappa
          </Pulsante>
        </div>
        <Pulsante variante="principale" dimensione="l" pieno>
          <Icona icona={Plus} />
          Crea una serata con il gruppo
        </Pulsante>
      </Sezione>

      <Sezione titolo="Campo">
        <Campo
          etichetta="Nome del gruppo"
          placeholder="Es. Sabato a Monza"
          aiuto="Lo vedono solo le persone che inviti."
        />
        <Campo
          etichetta="Username"
          defaultValue="ab"
          errore="Troppo corto: usa da 3 a 20 caratteri, per esempio giulia.rota."
        />
        <Campo
          etichetta="Zona"
          defaultValue="Milano e Brianza"
          disabled
          aiuto="La zona si cambia dal Profilo."
        />
        <Campo
          etichetta="Cerca"
          type="search"
          defaultValue="jam session"
          prefisso={<Icona icona={Search} className="c-2" />}
          suffisso={
            <Pulsante soloIcona variante="neutro" aria-label="Cancella ricerca">
              <Icona icona={X} dimensione="s" />
            </Pulsante>
          }
        />
      </Sezione>

      <Sezione titolo="Campi e controlli dell'accesso">
        <IndicatorePassi passo={2} totale={4} testo="2 di 4" etichetta="Passo 2 di 4" />
        <CampoData
          etichetta="Data di nascita"
          valore={data}
          onCambia={setData}
          dataIniziale={{ anno: 2009, mese: 3, giorno: 14 }}
          aiuto="Non potrai cambiarla e nessuno la vedrà."
        />
        <CampoPassword
          etichetta="Password"
          defaultValue="notte.sul.tram7"
          autoComplete="off"
          requisiti={[
            { testo: 'Almeno 10 caratteri', soddisfatto: true },
            { testo: 'Diversa da email e username', soddisfatto: true },
          ]}
        />
        <CasellaLunga selezionata={termini} onCambia={setTermini}>
          Accetto i Termini di servizio
        </CasellaLunga>
        <IndicatorePunti attuale={1} totale={3} etichetta="Schermata 1 di 3" />
      </Sezione>

      <Sezione titolo="Amici e sicurezza">
        <ul className="m-0 list-none p-0">
          <RigaPersona
            nome="Marco"
            username="marco.brivio"
            azioni={
              <MenuAzioni
                etichetta="Altre azioni per @marco.brivio"
                titolo="@marco.brivio"
                voci={[
                  { etichetta: 'Segnala', icona: null, onScegli: () => undefined },
                  { etichetta: 'Blocca', icona: null, onScegli: () => undefined, pericolo: true },
                ]}
              />
            }
          />
          <RigaPersona
            nome="Davide"
            username="davide.sala"
            azioniSotto
            azioni={
              <>
                <Pulsante variante="secondario" dimensione="s">
                  Accetta
                </Pulsante>
                <Pulsante variante="secondario" dimensione="s">
                  Rifiuta
                </Pulsante>
              </>
            }
          />
        </ul>
        <CodiceQr
          valore="https://noxa.app/amici/invito/?c=K7Q4M2XP9H"
          etichetta="Codice QR di esempio"
        />
        <p className="codice">K7Q4-M2XP-9H</p>
      </Sezione>

      <Sezione titolo="Badge e contatore">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variante="eta">14+</Badge>
          <Badge variante="eta">18+</Badge>
          <Badge variante="accento">Gratis</Badge>
          <Badge variante="tenue">€ 12,00</Badge>
          <Badge variante="avviso">Flyer in revisione</Badge>
          <Badge variante="successo">Ci sei</Badge>
          <Badge variante="info">Nuovo</Badge>
          <Contatore valore={2} descrizione="2 richieste nuove" />
        </div>
      </Sezione>

      <Sezione titolo="Avatar">
        <div className="flex items-center gap-3">
          <Avatar nome="Giulia Rota" dimensione="s" />
          <Avatar nome="Marco Brivio" />
          <Avatar nome="Sara Colombo" dimensione="l" />
          <GruppoAvatar persone={PERSONE} />
        </div>
      </Sezione>

      <Sezione titolo="Scelte">
        <Interruttore
          etichetta="Condividi la posizione"
          attivo={interruttore}
          onCambia={setInterruttore}
        />
        <Interruttore
          etichetta="Notifiche notturne"
          attivo={false}
          onCambia={() => undefined}
          disabled
        />
        <Segmenti
          etichetta="Quando"
          opzioni={[
            { valore: 'stasera', etichetta: 'Stasera' },
            { valore: 'domani', etichetta: 'Domani' },
            { valore: 'weekend', etichetta: 'Weekend' },
          ]}
          valore={quando}
          onCambia={setQuando}
        />
        <Schede
          etichetta="Serate"
          valore={tab}
          onCambia={setTab}
          schede={[
            {
              valore: 'prossime',
              etichetta: 'Prossime',
              contenuto: <p className="t-corpo-s m-0">Le serate in programma.</p>,
            },
            {
              valore: 'passate',
              etichetta: 'Passate',
              contenuto: <p className="t-corpo-s m-0">Le serate già fatte.</p>,
            },
          ]}
        />
      </Sezione>

      <Sezione titolo="Scheda in evidenza">
        <SchedaEvidenza
          dati={{
            ...EVENTO,
            amici: (
              <AmiciPartecipano
                persone={PERSONE.slice(1, 3)}
                altri={2}
                testo="Marco, Sara e altri 2 ci vanno"
              />
            ),
          }}
        />
      </Sezione>

      <Sezione titolo="Riga evento compatta">
        <ul className="m-0 list-none p-0">
          <li>
            <RigaEvento
              dati={{
                ...EVENTO,
                titolo: 'Anni Zero',
                nome: 'Anni Zero, Sala Ventuno, Desio, sab 17.10 22:00, 16+',
                locale: 'Sala Ventuno',
                comune: 'Desio',
                ora: '22:00',
                orario: '22:00 → 03:00',
                eta: '16+',
                generi: ['commerciale'],
                meta: ['7,9 km', 'da 10 €'],
              }}
            />
          </li>
        </ul>
      </Sezione>

      <Sezione titolo="Badge d’età e generi">
        <div className="rc-tag">
          {['14+', '16+', '18+', '21+', '18+ · non dichiarata'].map((eta) => (
            <Badge key={eta} variante="eta">
              {eta}
            </Badge>
          ))}
          <Badge variante="annullato">
            <Icona icona={X} dimensione="s" />
            Annullato
          </Badge>
          <Genere>techno</Genere>
          <Genere>hip hop</Genere>
          <Genere>live</Genere>
        </div>
      </Sezione>

      <Sezione titolo="Mi interessa / Partecipo">
        <SelettorePartecipazione
          scelta={scelta}
          visibile={visibile}
          onScegli={setScelta}
          onVisibilita={setVisibile}
        />
      </Sezione>

      <Sezione titolo="Amici che partecipano e link esterni">
        <AmiciPartecipano
          persone={PERSONE.slice(1, 3)}
          altri={2}
          testo="Marco, Sara e altri 2 ci vanno"
          onApri={() => undefined}
          className="riga-amici-dettaglio"
        />
        <div>
          <LinkEsterno
            href="https://binario7.example"
            icona={Globe}
            etichetta="Fonte: sito del locale"
            destinazione="binario7.example"
          />
          <LinkEsterno
            href="https://binario7.example/biglietti"
            icona={Ticket}
            etichetta="Biglietti"
            destinazione="sito esterno"
          />
        </div>
      </Sezione>

      <Sezione titolo="Avvisi">
        <Avviso tipo="info" titolo="Età minima">
          Se il locale non indica l’età, consideriamo l’evento 18+.
        </Avviso>
        <Avviso tipo="successo">Sei nella serata di sabato.</Avviso>
        <Avviso tipo="avviso" titolo="Flyer in revisione">
          Un moderatore lo controlla prima della pubblicazione.
        </Avviso>
        <Avviso tipo="errore" titolo="Non siamo riusciti a salvare">
          Controlla la connessione e riprova.
        </Avviso>
      </Sezione>

      <Sezione titolo="Stati">
        <ElencoVuoto
          icona={Sparkles}
          titolo="Nessun evento stasera"
          azione={<Pulsante dimensione="s">Vedi domani</Pulsante>}
        >
          Prova a cambiare giorno o zona.
        </ElencoVuoto>
        <Caricamento descrizione="Carico gli eventi" righe={2} />
        <ErroreConAzione titolo="Gli eventi non si sono caricati" onRiprova={() => undefined}>
          Può dipendere dalla rete.
        </ErroreConAzione>
        <StrisciaOffline />
      </Sezione>

      <Sezione titolo="Area di moderazione">
        <CodiceSeiCifre
          etichetta="Codice a 6 cifre"
          etichettaCifra={(n) => `Cifra ${n} di 6`}
          valore={codice}
          onCambia={setCodice}
        />
        <div className="flex flex-wrap gap-2">
          <Badge variante="successo">Consentita</Badge>
          <Badge variante="avviso">Da verificare</Badge>
          <Badge variante="errore">Vietata</Badge>
          <Badge variante="testo">Non attivo</Badge>
        </div>
        <TabellaDensa
          etichetta="Locali di esempio"
          titoloPrima="Locale"
          colonne={[
            { chiave: 'prov', titolo: 'Prov.', cella: (r) => r.provincia, classe: 'mono' },
            { chiave: 'fonti', titolo: 'Fonti', cella: (r) => r.fonti, classe: 'mono' },
          ]}
          righe={[
            { id: 'a', nome: 'Club Binario 7', provincia: 'MB', fonti: '2 / 2' },
            { id: 'b', nome: 'Spazio Navile', provincia: 'MI', fonti: '1 / 0' },
          ]}
          chiaveRiga={(r) => r.id}
          selezionata="a"
          prima={(r) => (
            <span className="cella-nome">
              <b>{r.nome}</b>
            </span>
          )}
        />
        <Selezione
          etichetta="Provincia"
          valore={provincia}
          opzioni={[
            { valore: 'MI', etichetta: 'MI · Milano' },
            { valore: 'MB', etichetta: 'MB · Monza e Brianza' },
          ]}
          onCambia={setProvincia}
        />
        <Registro
          etichettaSistema="Sistema"
          vuoto="Nessuna azione registrata."
          voci={[
            {
              quando: '19.10 08:14',
              autore: 'Moderatore Uno',
              cosa: 'ha approvato la foto',
              perche: 'Autorizzazione scritta del locale, rif. AUT-2026-014.',
            },
            {
              quando: '18.10 19:31',
              autore: null,
              cosa: 'ha creato l’evento da @officinalambro',
              perche: null,
            },
          ]}
        />
        <Pulsante onClick={() => setMotivazione(true)}>Conferma con motivazione</Pulsante>
        <DialogoMotivazione
          aperto={motivazione}
          onChiudi={() => setMotivazione(false)}
          titolo="Annullare «Bassi Lunghi»?"
          sopratitolo="Annullamento"
          effetto="Chi aveva scelto «Partecipo» lo vedrà come annullato."
          etichettaMotivazione="Motivazione (obbligatoria)"
          aiutoMotivazione="Resta nel registro con il tuo nome e l’ora."
          erroreMotivazioneMancante="Scrivi la motivazione: resta nel registro."
          etichettaConferma="Annulla evento"
          etichettaAnnulla="Annulla"
          variante="pericolo"
          testoErrore={() => 'Non salvato.'}
          onConferma={async () => setMotivazione(false)}
        />
      </Sezione>

      <Sezione titolo="Foglio">
        <Pulsante onClick={() => setFoglio(true)}>Apri il foglio</Pulsante>
        <Foglio aperto={foglio} onChiudi={() => setFoglio(false)} titolo="Filtri">
          <p className="t-corpo m-0">Contenuto del foglio.</p>
        </Foglio>
      </Sezione>
    </div>
  );
}
