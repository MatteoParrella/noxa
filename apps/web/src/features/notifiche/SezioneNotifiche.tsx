'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Info, Laptop, Smartphone, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Avviso } from '@/components/ui/Avviso';
import { Icona } from '@/components/ui/Icona';
import { Interruttore } from '@/components/ui/Interruttore';
import { Pulsante } from '@/components/ui/Pulsante';
import { Caricamento } from '@/components/ui/Stati';
import { useToast } from '@/components/ui/Toast';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { AggiungiAllaHome, FoglioPermesso, PermessoNegato } from './FoglioPermesso';
import { CHIAVI_PUSH, useDispositivi, useStatoPush } from './datiPush';
import { disattivaPushQui, togliDispositivo, type Dispositivo } from './push';

const testi = messaggi.push.impostazioni;

const formatoGiorno = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  day: '2-digit',
  month: '2-digit',
});

/**
 * Profilo › Privacy e dati › Notifiche (design/F-22-notifiche §2): l'interruttore vale per
 * questo dispositivo e accenderlo apre il foglio del consenso; sotto, i dispositivi con le
 * notifiche attive, ognuno removibile (R-66).
 */
export function SezioneNotifiche({ online }: { online: boolean }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const stato = useStatoPush();
  const dispositivi = useDispositivi();
  const [foglio, setFoglio] = useState(false);
  const [fallito, setFallito] = useState(false);

  const spegni = useMutation({
    mutationFn: disattivaPushQui,
    onMutate: () => setFallito(false),
    onError: (errore) => {
      registraErrore('spegnimento notifiche', errore);
      setFallito(true);
    },
    onSuccess: () => mostraToast({ testo: testi.spente }),
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI_PUSH.push }),
  });

  if (stato === null || dispositivi.isPending) {
    return <Caricamento descrizione={testi.caricamento} righe={2} />;
  }

  const elenco = dispositivi.data ?? [];
  const accesoQui = elenco.some((dispositivo) => dispositivo.questo);
  const descrizione =
    stato === 'negato'
      ? testi.negato
      : !online
        ? testi.offline
        : accesoQui
          ? testi.acceso
          : testi.spento;

  return (
    <>
      {fallito && (
        <Avviso
          tipo="errore"
          titolo={messaggi.privacy.pagina.salvataggio.titolo}
          portaInVista
          azioni={
            <Pulsante variante="secondario" dimensione="s" onClick={() => spegni.mutate()}>
              {messaggi.comune.riprova}
            </Pulsante>
          }
        >
          {testi.salvataggio(true)}
        </Avviso>
      )}
      {stato === 'iphone_da_installare' ? (
        <div className="pv-impostazione">
          <AggiungiAllaHome titolo={testi.iphone.titolo} testo={testi.iphone.testo} />
        </div>
      ) : stato === 'non_compatibile' ? (
        <p className="dsp-vuoto">{testi.nonCompatibile}</p>
      ) : (
        <div className="pv-impostazione">
          <Interruttore
            etichetta={testi.titolo}
            descrizione={testi.testo}
            attivo={accesoQui && stato !== 'negato'}
            disabled={!online || stato === 'negato' || spegni.isPending}
            onCambia={(nuovo) => {
              if (nuovo) setFoglio(true);
              else spegni.mutate();
            }}
          />
          <p className="pv-nota">
            <Icona icona={online ? Info : WifiOff} />
            {descrizione}
          </p>
          {stato === 'negato' && (
            <PermessoNegato titolo={testi.negatoAvviso.titolo} testo={testi.negatoAvviso.testo} />
          )}
        </div>
      )}

      <div className="dsp-intestazione">
        <h3 className="etichetta">{testi.dispositivi}</h3>
        <span className="t-didascalia c-2 ck-mono">{testi.conteggio(elenco.length)}</span>
      </div>
      {dispositivi.isError ? (
        <Avviso tipo="errore">{messaggi.privacy.pagina.errore.testo}</Avviso>
      ) : elenco.length === 0 ? (
        <p className="dsp-vuoto">{testi.nessuno}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {elenco.map((dispositivo) => (
            <RigaDispositivo key={dispositivo.id} dispositivo={dispositivo} online={online} />
          ))}
        </ul>
      )}
      <p className="nf-90">
        <Icona icona={Bell} dimensione="s" />
        {testi.nota}
      </p>
      <FoglioPermesso aperto={foglio} onChiudi={() => setFoglio(false)} />
    </>
  );
}

function RigaDispositivo({ dispositivo, online }: { dispositivo: Dispositivo; online: boolean }) {
  const client = useQueryClient();
  const mostraToast = useToast();
  const togli = useMutation({
    mutationFn: () => togliDispositivo(dispositivo),
    onSuccess: () => mostraToast({ testo: testi.tolto }),
    onError: (errore) => {
      registraErrore('dispositivo non tolto', errore);
      mostraToast({ testo: testi.nonTolto });
    },
    onSettled: () => void client.invalidateQueries({ queryKey: CHIAVI_PUSH.push }),
  });
  const nome = dispositivo.descrizione ?? messaggi.push.dispositivo.generico;
  const telefono = /Android|iPhone|Telefono/.test(nome);
  return (
    <li className="dsp-riga">
      <span className="dsp-ico" aria-hidden="true">
        <Icona icona={telefono ? Smartphone : Laptop} />
      </span>
      <span className="dsp-testo">
        {dispositivo.questo && <span className="dsp-questo">{testi.questo}</span>}
        <b>{nome}</b>
        <span className="mono">
          {dispositivo.questo
            ? testi.attivoOra
            : testi.ultimoUso(
                formatoGiorno.format(new Date(dispositivo.ultimo_uso_il)).replace('/', '.'),
              )}
        </span>
      </span>
      <Pulsante
        variante="secondario"
        dimensione="s"
        caricamento={togli.isPending}
        disabled={!online}
        aria-label={testi.togliDispositivo(nome)}
        onClick={() => togli.mutate()}
      >
        {testi.togli}
      </Pulsante>
    </li>
  );
}
