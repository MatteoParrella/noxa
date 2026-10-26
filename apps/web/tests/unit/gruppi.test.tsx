import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pillole } from '@/components/ui/Pillole';
import type { Partecipante } from '@/features/gruppi/api';
import {
  autoDelGruppo,
  contaRisposte,
  dataBreve,
  oraRitrovo,
  partiData,
  senzaRitorno,
} from '@/features/gruppi/formato';
import { RigaSerata } from '@/features/gruppi/RigaSerata';
import { linkNotifica, testoNotifica } from '@/features/notifiche/testo';
import { converti, type ErroreValidazione } from '@/lib/errori';

const persona = (id: string, nome: string, extra: Partial<Partecipante> = {}): Partecipante => ({
  id,
  username: nome.toLowerCase(),
  nome_visualizzato: nome,
  avatar_path: null,
  io: false,
  risposta: 'si',
  biglietto: 'nessuno',
  trasporto_andata: null,
  trasporto_ritorno: null,
  posti_liberi: null,
  passaggio_da: null,
  aggiornato_il: null,
  ...extra,
});

describe('Pillole', () => {
  const opzioni = [
    { valore: 'auto_guido', etichetta: 'Guido', disattivata: true },
    { valore: 'passaggio', etichetta: 'Passaggio' },
    { valore: 'a_piedi', etichetta: 'A piedi' },
  ] as const;

  it('è un gruppo di radio: le frecce saltano le opzioni spente', () => {
    const cambia = vi.fn();
    render(
      <Pillole etichetta="Come torni?" opzioni={opzioni} valore="a_piedi" onCambia={cambia} />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Come torni?' })).toBeInTheDocument();
    const aPiedi = screen.getByRole('radio', { name: 'A piedi' });
    expect(aPiedi).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Guido' })).toBeDisabled();
    fireEvent.keyDown(aPiedi, { key: 'ArrowRight' });
    expect(cambia).toHaveBeenLastCalledWith('passaggio');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Passaggio' }), { key: 'ArrowLeft' });
    expect(cambia).toHaveBeenLastCalledWith('a_piedi');
  });

  it('senza scelta si raggiunge la prima opzione attiva; spento, nessuna opzione si sceglie', () => {
    const cambia = vi.fn();
    const { rerender } = render(
      <Pillole etichetta="Come vai?" opzioni={opzioni} valore={null} onCambia={cambia} />,
    );
    expect(screen.getByRole('radio', { name: 'Passaggio' })).toHaveAttribute('tabindex', '0');
    rerender(
      <Pillole
        etichetta="Come vai?"
        opzioni={opzioni}
        valore={null}
        onCambia={cambia}
        disattivato
      />,
    );
    expect(screen.getByRole('radio', { name: 'Passaggio' })).toBeDisabled();
  });
});

describe('formato di gruppi e serate', () => {
  it('scrive la data in monospaziato e l’ora del ritrovo', () => {
    expect(partiData('2026-11-08')).toEqual({ giorno: 'DOM', data: '08.11' });
    expect(dataBreve('2026-11-07')).toBe('SAB 07.11');
    expect(oraRitrovo('21:30:00')).toBe('21:30');
    expect(oraRitrovo(null)).toBeNull();
  });

  it('conta risposte, chi non ha un mezzo per tornare e le auto con i posti rimasti', () => {
    const marco = persona('m', 'Marco', { trasporto_ritorno: 'auto_guido', posti_liberi: 3 });
    const sara = persona('s', 'Sara', { trasporto_ritorno: 'passaggio', passaggio_da: 'm' });
    const elena = persona('e', 'Elena', { risposta: 'forse' });
    const luca = persona('l', 'Luca', { risposta: 'no' });
    const tutti = [marco, sara, elena, luca];
    expect(contaRisposte(tutti)).toEqual({ si: 2, forse: 1, no: 1 });
    expect(senzaRitorno(tutti)).toBe(1);
    const [auto] = autoDelGruppo(tutti);
    expect(auto?.conducente.id).toBe('m');
    expect(auto?.passeggeri.map((p) => p.id)).toEqual(['s']);
    expect(auto?.rimasti).toBe(2);
  });
});

describe('RigaSerata', () => {
  it('mostra data, titolo e la propria risposta come badge', () => {
    render(
      <ul>
        <RigaSerata
          id="00000000-0000-4000-8000-00000000d001"
          titolo="Indie al Binario"
          dataSerata="2026-11-07"
          ora="21:30:00"
          stato="proposta"
          sotto="Calcetto del giovedì"
          miaRisposta={null}
        />
      </ul>,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toMatch(
      /^\/serata\/?\?id=00000000-0000-4000-8000-00000000d001$/,
    );
    expect(link).toHaveTextContent('SAB07.11');
    expect(link).toHaveTextContent('21:30 · Calcetto del giovedì');
    expect(link).toHaveTextContent('Da rispondere');
  });
});

describe('notifiche di gruppi e serate', () => {
  it('l’uscita dal gruppo dice il motivo senza dire chi (R-15, R-17)', () => {
    const fasce = testoNotifica('rimozione_gruppo', { nome_gruppo: 'Terza B', motivo: 'fasce' });
    expect(fasce.titolo).toContain('«Terza B»');
    expect(fasce.titolo).toContain('minorenni che non sono tue amiche confermate');
    expect(fasce.motivazione).toContain('codice invito');
    expect(
      testoNotifica('rimozione_gruppo', { nome_gruppo: 'Terza B', motivo: 'compleanno' }).titolo,
    ).toMatch(/^Hai compiuto 18 anni/);
    expect(
      testoNotifica('rimozione_gruppo', { nome_gruppo: 'Terza B', motivo: 'tolto' }).titolo,
    ).toBe('Non fai più parte di «Terza B».');
    expect(
      testoNotifica('rimozione_gruppo', {
        nome_gruppo: 'Terza B',
        motivo: 'fasce',
        era_invitato: true,
      }).titolo,
    ).toBe('L’invito in «Terza B» non è più valido.');
  });

  it('una serata cambiata dice cosa è cambiato e porta alla serata', () => {
    const dati = { serata_id: '00000000-0000-4000-8000-00000000d001', cambio: 'annullata' };
    expect(testoNotifica('aggiornamento_serata', dati).titolo).toBe(
      'Una serata del tuo gruppo è stata annullata.',
    );
    expect(linkNotifica('aggiornamento_serata', dati)).toBe(
      '/serata/?id=00000000-0000-4000-8000-00000000d001',
    );
    expect(linkNotifica('nuova_serata', { serata_id: 'non-valido' })).toBe('/organizza/');
    expect(linkNotifica('invito_gruppo', {})).toBe('/organizza/');
  });

  it('la rimozione del nome di un gruppo ha il suo titolo', () => {
    expect(
      testoNotifica('esito_moderazione', {
        esito: 'contenuto_rimosso',
        tipo_oggetto: 'gruppo',
        motivazione: 'Nome offensivo',
      }),
    ).toEqual({
      titolo: 'Abbiamo rimosso il nome di un tuo gruppo',
      motivazione: 'Nome offensivo',
    });
  });
});

describe('errori dei gruppi', () => {
  it('i codici del database diventano errori di dominio', () => {
    const codice = (sqlstate: string) =>
      (converti({ code: sqlstate, message: '' }) as ErroreValidazione).codice;
    expect(codice('NX037')).toBe('gruppo_pieno');
    expect(codice('NX038')).toBe('non_invitabile');
    expect(codice('NX040')).toBe('guida_solo_maggiorenni');
    expect(codice('NX041')).toBe('posti_esauriti');
    expect(codice('NX043')).toBe('evento_non_adatto');
  });
});
