'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bus, CircleCheck, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Badge } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { Icona } from '@/components/ui/Icona';
import { Interruttore } from '@/components/ui/Interruttore';
import { Pulsante } from '@/components/ui/Pulsante';
import { Selezione } from '@/components/ui/Selezione';
import { Caricamento, ElencoVuoto, ErroreConAzione } from '@/components/ui/Stati';
import { TabellaDensa, type ColonnaTabella } from '@/components/ui/TabellaDensa';
import { messaggi } from '@/lib/messaggi/it';
import { salvaServizioTrasporto, type DatiServizioTrasporto, type ServizioTrasporto } from './api';
import { CHIAVI, useServiziTrasporto } from './dati';
import { serata, testoErrore, urlBreve } from './formato';
import { RegistroOggetto } from './RegistroOggetto';
import { Testata } from './Testata';

const testi = messaggi.moderazione;
const t = testi.trasporti;

type Modulo = {
  tipo: ServizioTrasporto['tipo'];
  nome: string;
  zona: ServizioTrasporto['zona'];
  telefono: string;
  url: string;
  nota: string;
  eta_minima: string;
  ordine: string;
  fonte_url: string;
  verificato_il: string;
  attivo: boolean;
  motivazione: string;
};
type Errori = Partial<Record<keyof Modulo, string>>;

const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

function moduloDa(servizio: ServizioTrasporto | null): Modulo {
  return {
    tipo: servizio?.tipo ?? 'taxi',
    nome: servizio?.nome ?? '',
    zona: servizio?.zona ?? 'milano',
    telefono: servizio?.telefono ?? '',
    url: servizio?.url ?? '',
    nota: servizio?.nota ?? '',
    eta_minima: String(servizio?.eta_minima ?? 14),
    ordine: String(servizio?.ordine ?? 100),
    fonte_url: servizio?.fonte_url ?? '',
    verificato_il: servizio?.verificato_il ?? oggi(),
    attivo: servizio?.attivo ?? true,
    motivazione: '',
  };
}

/** Gli stessi controlli dei vincoli di `servizi_trasporto` (DATA_MODEL.md §5.5). */
function valida(modulo: Modulo): Errori {
  const errori: Errori = {};
  const nome = modulo.nome.trim();
  if (nome.length < 2 || nome.length > 60) errori.nome = t.errori.nome;
  const telefono = modulo.telefono.trim();
  if (modulo.tipo === 'taxi' && !telefono) errori.telefono = t.errori.telefonoTaxi;
  else if (telefono && !/^\+39[0-9]{6,11}$/.test(telefono)) errori.telefono = t.errori.telefono;
  const url = modulo.url.trim();
  if (modulo.tipo !== 'taxi' && !url) errori.url = t.errori.urlObbligatorio;
  else if (url && !/^https:\/\/\S+$/.test(url)) errori.url = t.errori.url;
  if (!/^https:\/\/\S+$/.test(modulo.fonte_url.trim())) errori.fonte_url = t.errori.fonte;
  if (!modulo.verificato_il || modulo.verificato_il > oggi())
    errori.verificato_il = t.errori.verificato;
  if (modulo.nota.trim().length > 140) errori.nota = t.errori.nota;
  if (!modulo.motivazione.trim()) errori.motivazione = t.errori.motivazione;
  return errori;
}

function dati(modulo: Modulo): DatiServizioTrasporto {
  const taxi = modulo.tipo === 'taxi';
  return {
    tipo: modulo.tipo,
    nome: modulo.nome.trim(),
    zona: modulo.zona,
    // Un taxi si chiama, gli altri si aprono con un link (vincolo servizi_trasporto_forma).
    telefono: taxi ? modulo.telefono.trim() : null,
    url: modulo.url.trim() || null,
    nota: modulo.nota.trim() || null,
    eta_minima: Number(modulo.eta_minima),
    ordine: Number(modulo.ordine) || 100,
    fonte_url: modulo.fonte_url.trim(),
    verificato_il: modulo.verificato_il,
    attivo: modulo.attivo,
  };
}

/** Servizi di «Non hai un passaggio?» (F-23, ADR-0034): elenco e pannello di modifica. */
export function Trasporti() {
  const servizi = useServiziTrasporto();
  const [aperto, setAperto] = useState<string | 'nuovo' | null>(null);
  const scelto =
    aperto && aperto !== 'nuovo' ? (servizi.data?.find((s) => s.id === aperto) ?? null) : null;

  const colonne: ReadonlyArray<ColonnaTabella<ServizioTrasporto>> = [
    { chiave: 'tipo', titolo: t.colonne.tipo, cella: (s) => t.tipi[s.tipo] },
    { chiave: 'zona', titolo: t.colonne.zona, cella: (s) => t.zone[s.zona], classe: 'nasc-390' },
    {
      chiave: 'eta',
      titolo: t.colonne.eta,
      cella: (s) => <Badge variante="eta">{`${s.eta_minima}+`}</Badge>,
    },
    {
      chiave: 'verificato',
      titolo: t.colonne.verificato,
      cella: (s) => serata(s.verificato_il),
      classe: 'mono',
    },
    {
      chiave: 'attivo',
      titolo: t.colonne.attivo,
      cella: (s) =>
        s.attivo ? (
          <Badge variante="successo">{testi.comune.si}</Badge>
        ) : (
          <Badge variante="testo">{testi.comune.no}</Badge>
        ),
    },
  ];

  return (
    <>
      <Testata
        titolo={t.titolo}
        conta={servizi.data ? String(servizi.data.length) : undefined}
        strumenti={
          <Pulsante variante="principale" onClick={() => setAperto('nuovo')}>
            <Icona icona={Plus} dimensione="s" />
            {t.nuovo}
          </Pulsante>
        }
      />
      <div className="md-contenuto">
        <div className="md-scorre">
          <p className="guida mt-0">{t.introduzione}</p>
          {servizi.isPending && <Caricamento descrizione={t.caricamento} righe={5} />}
          {servizi.isError && (
            <div className="pt-6">
              <ErroreConAzione
                titolo={testi.comune.erroreCaricamento.titolo}
                onRiprova={() => void servizi.refetch()}
                riprovaInCorso={servizi.isFetching}
              >
                {testi.comune.erroreCaricamento.testo}
              </ErroreConAzione>
            </div>
          )}
          {servizi.data?.length === 0 && (
            <div className="pt-6">
              <ElencoVuoto icona={Bus} titolo={t.vuoto.titolo}>
                {t.vuoto.testo}
              </ElencoVuoto>
            </div>
          )}
          {servizi.data && servizi.data.length > 0 && (
            <TabellaDensa
              etichetta={t.titolo}
              titoloPrima={t.colonne.servizio}
              colonne={colonne}
              righe={servizi.data}
              chiaveRiga={(s) => s.id}
              selezionata={scelto?.id ?? null}
              onApri={(s) => setAperto(s.id)}
              prima={(s) => (
                <span className="cella-nome">
                  <button
                    type="button"
                    className="link-accesso text-left"
                    data-apri-riga
                    onClick={() => setAperto(s.id)}
                  >
                    {s.nome}
                  </button>
                  <span className="t-mono-dato">
                    {s.telefono ?? (s.url ? urlBreve(s.url) : '')}
                  </span>
                </span>
              )}
            />
          )}
        </div>
        {aperto && (
          <PannelloServizio
            key={aperto}
            servizio={scelto}
            onChiudi={() => setAperto(null)}
            onSalvato={(id) => setAperto(id)}
          />
        )}
      </div>
    </>
  );
}

function PannelloServizio({
  servizio,
  onChiudi,
  onSalvato,
}: {
  servizio: ServizioTrasporto | null;
  onChiudi: () => void;
  onSalvato: (id: string) => void;
}) {
  const client = useQueryClient();
  const [modulo, setModulo] = useState<Modulo>(() => moduloDa(servizio));
  const [errori, setErrori] = useState<Errori>({});
  const [salvato, setSalvato] = useState(false);
  const cambia = <K extends keyof Modulo>(chiave: K, valore: Modulo[K]) => {
    setModulo((attuale) => ({ ...attuale, [chiave]: valore }));
    setSalvato(false);
  };

  const salvataggio = useMutation({
    mutationFn: () =>
      salvaServizioTrasporto(servizio?.id ?? null, dati(modulo), modulo.motivazione.trim()),
    onSuccess: async (id) => {
      setSalvato(true);
      setModulo((attuale) => ({ ...attuale, motivazione: '' }));
      await client.invalidateQueries({ queryKey: CHIAVI.trasporti });
      await client.invalidateQueries({ queryKey: CHIAVI.registro('servizio_trasporto', id) });
      if (!servizio) onSalvato(id);
    },
  });

  function invia(evento: FormEvent) {
    evento.preventDefault();
    const trovati = valida(modulo);
    setErrori(trovati);
    if (Object.keys(trovati).length === 0) salvataggio.mutate();
  }

  const idTitolo = 'pannello-servizio';
  return (
    <aside className="md-pannello" aria-labelledby={idTitolo}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={idTitolo} className="m-0">
          {servizio?.nome ?? t.nuovoTitolo}
        </h2>
        <Pulsante variante="neutro" soloIcona aria-label={t.chiudi} onClick={onChiudi}>
          <Icona icona={X} />
        </Pulsante>
      </div>
      {salvato && (
        <div className="conferma-riga" role="status">
          <Icona icona={CircleCheck} dimensione="s" />
          {t.salvato}
        </div>
      )}
      {salvataggio.isError && (
        <Avviso tipo="errore" titolo={testi.comune.erroreSalvataggio.titolo} portaInVista>
          {testoErrore(salvataggio.error)}
        </Avviso>
      )}
      <form className="flex flex-col gap-3" onSubmit={invia} noValidate>
        <Campo
          etichetta={t.campi.nome}
          value={modulo.nome}
          maxLength={60}
          errore={errori.nome}
          onChange={(e) => cambia('nome', e.target.value)}
          required
        />
        <Selezione
          etichetta={t.campi.tipo}
          valore={modulo.tipo}
          opzioni={(['mezzi_pubblici', 'taxi', 'app_trasporto'] as const).map((valore) => ({
            valore,
            etichetta: t.tipi[valore],
          }))}
          onCambia={(valore) => cambia('tipo', valore)}
        />
        <Selezione
          etichetta={t.campi.zona}
          valore={modulo.zona}
          opzioni={(['milano', 'brianza', 'tutte'] as const).map((valore) => ({
            valore,
            etichetta: t.zone[valore],
          }))}
          onCambia={(valore) => cambia('zona', valore)}
        />
        {modulo.tipo === 'taxi' && (
          <Campo
            etichetta={t.campi.telefono}
            type="tel"
            value={modulo.telefono}
            aiuto={t.campi.telefonoAiuto}
            errore={errori.telefono}
            placeholder="+39"
            onChange={(e) => cambia('telefono', e.target.value.replace(/\s/g, ''))}
          />
        )}
        <Campo
          etichetta={t.campi.url}
          type="url"
          value={modulo.url}
          aiuto={t.campi.urlAiuto}
          errore={errori.url}
          placeholder="https://"
          onChange={(e) => cambia('url', e.target.value)}
          facoltativo={modulo.tipo === 'taxi'}
        />
        <Campo
          etichetta={t.campi.nota}
          value={modulo.nota}
          maxLength={140}
          errore={errori.nota}
          onChange={(e) => cambia('nota', e.target.value)}
          facoltativo
        />
        <div className="campi2">
          <Selezione
            etichetta={t.campi.eta}
            valore={modulo.eta_minima}
            aiuto={t.campi.etaAiuto}
            opzioni={['14', '15', '16', '17', '18'].map((valore) => ({
              valore,
              etichetta: `${valore}+`,
            }))}
            onCambia={(valore) => cambia('eta_minima', valore)}
          />
          <Campo
            etichetta={t.campi.ordine}
            inputMode="numeric"
            value={modulo.ordine}
            aiuto={t.campi.ordineAiuto}
            onChange={(e) => cambia('ordine', e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Campo
          etichetta={t.campi.fonte}
          type="url"
          value={modulo.fonte_url}
          aiuto={t.campi.fonteAiuto}
          errore={errori.fonte_url}
          placeholder="https://"
          onChange={(e) => cambia('fonte_url', e.target.value)}
          required
        />
        <Campo
          etichetta={t.campi.verificato}
          type="date"
          value={modulo.verificato_il}
          max={oggi()}
          errore={errori.verificato_il}
          onChange={(e) => cambia('verificato_il', e.target.value)}
          required
        />
        <Interruttore
          etichetta={t.campi.attivo}
          attivo={modulo.attivo}
          onCambia={(valore) => cambia('attivo', valore)}
        />
        <div className="motivazione">
          <label className="campo-etichetta" htmlFor="motivazione-servizio">
            {t.campi.motivazione}
          </label>
          <textarea
            id="motivazione-servizio"
            value={modulo.motivazione}
            maxLength={500}
            aria-describedby="motivazione-servizio-aiuto"
            aria-invalid={errori.motivazione ? true : undefined}
            onChange={(e) => cambia('motivazione', e.target.value)}
          />
          {errori.motivazione && (
            <span className="campo-errore" role="alert">
              {errori.motivazione}
            </span>
          )}
          <span className="guida" id="motivazione-servizio-aiuto">
            {t.campi.motivazioneAiuto}
          </span>
        </div>
        <Pulsante variante="principale" type="submit" caricamento={salvataggio.isPending}>
          {t.salva}
        </Pulsante>
      </form>
      {servizio && <RegistroOggetto tipo="servizio_trasporto" id={servizio.id} />}
    </aside>
  );
}
