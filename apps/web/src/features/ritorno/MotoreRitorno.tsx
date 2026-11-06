'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ErroreRete, ErroreValidazione } from '@/lib/errori';
import { messaggi } from '@/lib/messaggi/it';
import { registraErrore } from '@/lib/registro';
import { concludiRitorno, inviaPosizione, type Coordinate } from './api';
import { CHIAVI_RITORNO, useAreeArrivo, useRitorni, avviatoQui } from './dati';
import { areaRaggiunta, leggiSessioneLocale, salvaSessioneLocale } from './dispositivo';
import { oraDi } from './formato';
import {
  aggiornaMotore,
  ATTESA_ARRIVO,
  azzeraMotore,
  INTERVALLO_INVIO,
  leggiMotore,
  useMotore,
} from './motore';
import { ascoltaPosizione, modoPosizione } from './posizione';

const testi = messaggi.ritorno;

/**
 * Condivisione della posizione durante il ritorno (R-31), montata in tutte le aree: parte solo
 * sul telefono che ha avviato il ritorno e solo finché il ritorno è attivo. Invia al massimo una
 * posizione ogni 30 secondi, mai la scia; l'arrivo nell'area salvata sul telefono si controlla
 * qui, senza mandare l'area al server (R-32).
 */
export function MotoreRitorno() {
  const client = useQueryClient();
  const ritorni = useRitorni();
  const aree = useAreeArrivo();
  const motore = useMotore();
  const mio = ritorni.data?.mio ?? null;
  const qui = avviatoQui(mio);
  const inviando = useRef(false);
  const id = qui ? (mio?.id ?? null) : null;
  const arrivoPrevisto = mio?.arrivoPrevisto ?? null;
  const destinatari = mio?.destinatari.length ?? 0;
  const areaRef = useRef(aree);
  useEffect(() => {
    areaRef.current = aree;
  });

  // Ritorno concluso (anche da un altro telefono o dal server): la sessione locale si chiude.
  useEffect(() => {
    if (!ritorni.isSuccess) return;
    const sessione = leggiSessioneLocale();
    if (sessione && sessione.ritornoId !== mio?.id) {
      salvaSessioneLocale(null);
      azzeraMotore();
    }
  }, [ritorni.isSuccess, mio?.id]);

  useEffect(() => {
    if (!id || !arrivoPrevisto) return;
    if (leggiMotore().ritornoId !== id) azzeraMotore(id);
    const nativo = modoPosizione() === 'nativo';
    let ferma: (() => void) | null = null;
    let attivo = true;

    async function invia(coordinate: Coordinate, ritorno: string) {
      const ultimoInvio = leggiMotore().inviataIl;
      if (inviando.current || (ultimoInvio !== null && Date.now() - ultimoInvio < INTERVALLO_INVIO))
        return;
      inviando.current = true;
      try {
        await inviaPosizione(ritorno, coordinate, nativo);
        aggiornaMotore({ inviataIl: Date.now() });
      } catch (errore) {
        if (errore instanceof ErroreValidazione && errore.codice === 'posizione_troppo_frequente') {
          aggiornaMotore({ inviataIl: Date.now() });
        } else if (errore instanceof ErroreValidazione && errore.codice === 'ritorno_non_attivo') {
          void client.invalidateQueries({ queryKey: CHIAVI_RITORNO.tutti });
        } else if (!(errore instanceof ErroreRete)) {
          registraErrore('posizione del ritorno', errore);
        }
      } finally {
        inviando.current = false;
      }
    }

    function controllaArea(coordinate: Coordinate) {
      const sessione = leggiSessioneLocale();
      const area = areaRef.current.find((a) => a.id === sessione?.areaId);
      if (!area) return;
      const dentro = areaRaggiunta(area, coordinate);
      const stato = leggiMotore();
      if (!dentro && stato.areaIgnorata) aggiornaMotore({ areaIgnorata: false });
      if (dentro && !stato.areaIgnorata && !stato.arrivoInAttesa)
        aggiornaMotore({
          arrivoInAttesa: { area: area.nome, scadenza: Date.now() + ATTESA_ARRIVO },
        });
    }

    ascoltaPosizione({
      notifica: {
        titolo: testi.notificaFissa.titolo,
        testo: testi.notificaFissa.testo(oraDi(arrivoPrevisto), destinatari),
      },
      onPosizione: (coordinate) => {
        if (!attivo) return;
        aggiornaMotore({ ultima: { ...coordinate, il: Date.now() }, errore: null });
        void invia(coordinate, id);
        controllaArea(coordinate);
      },
      onErrore: (motivo) => {
        if (attivo) aggiornaMotore({ errore: motivo });
      },
    })
      .then((stop) => {
        if (attivo) ferma = stop;
        else stop();
      })
      .catch((errore: unknown) => {
        registraErrore('avvio della posizione del ritorno', errore);
        aggiornaMotore({ errore: 'non_supportata' });
      });
    return () => {
      attivo = false;
      ferma?.();
    };
  }, [id, arrivoPrevisto, destinatari, client]);

  // Arrivo automatico: dopo un minuto senza "Non ero arrivato" il ritorno si conclude.
  const attesa = motore.arrivoInAttesa;
  useEffect(() => {
    if (!attesa || !id) return;
    const timer = window.setTimeout(
      () => {
        concludiRitorno(id, 'arrivato')
          .catch((errore: unknown) => {
            if (!(errore instanceof ErroreRete)) registraErrore('arrivo automatico', errore);
            aggiornaMotore({ arrivoInAttesa: null });
          })
          .finally(() => void client.invalidateQueries({ queryKey: CHIAVI_RITORNO.tutti }));
      },
      Math.max(0, attesa.scadenza - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [attesa, id, client]);

  return null;
}
