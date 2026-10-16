'use client';

import { Map as IconaMappa, Plus, Search, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar, GruppoAvatar } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Badge, Contatore } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { CampoData } from '@/components/ui/CampoData';
import { CampoPassword } from '@/components/ui/CampoPassword';
import { CasellaLunga } from '@/components/ui/CasellaLunga';
import { Foglio } from '@/components/ui/Foglio';
import { Icona } from '@/components/ui/Icona';
import { IndicatorePassi, IndicatorePunti } from '@/components/ui/Indicatori';
import { Interruttore } from '@/components/ui/Interruttore';
import { Rivela } from '@/components/ui/Movimento';
import { Pulsante } from '@/components/ui/Pulsante';
import { PulsanteSegnala } from '@/components/ui/PulsanteSegnala';
import { SchedaEvento } from '@/components/ui/SchedaEvento';
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

      <Sezione titolo="Scheda evento">
        <SchedaEvento
          titolo="Notte italo-disco"
          locale="Magazzino Nove"
          zona="Porta Genova"
          orario="23:30 → 04:00"
          eta="16+"
          dettagli={<GruppoAvatar persone={PERSONE.slice(0, 2)} />}
          azioni={
            <PulsanteSegnala oggetto="l’evento Notte italo-disco" onSegnala={() => undefined} />
          }
        />
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

      <Sezione titolo="Foglio">
        <Pulsante onClick={() => setFoglio(true)}>Apri il foglio</Pulsante>
        <Foglio aperto={foglio} onChiudi={() => setFoglio(false)} titolo="Filtri">
          <p className="t-corpo m-0">Contenuto del foglio.</p>
        </Foglio>
      </Sezione>
    </div>
  );
}
