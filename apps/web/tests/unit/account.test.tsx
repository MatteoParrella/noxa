import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CampoData } from '@/components/ui/CampoData';
import { CampoPassword } from '@/components/ui/CampoPassword';
import { CasellaLunga } from '@/components/ui/CasellaLunga';
import { IndicatorePassi, IndicatorePunti } from '@/components/ui/Indicatori';
import { analizzaDataNascita, dataIso, etaA, formattaDigitazione, oggiARoma } from '@/lib/date';
import { mascheraEmail } from '@/lib/email';
import {
  converti,
  ErroreAutorizzazione,
  ErroreLimite,
  ErroreRete,
  ErroreSconosciuto,
  ErroreValidazione,
} from '@/lib/errori';

const OGGI = { anno: 2026, mese: 10, giorno: 16 };

describe('data di nascita', () => {
  it('aggiunge i punti mentre si digitano le cifre', () => {
    expect(formattaDigitazione('1')).toBe('1');
    expect(formattaDigitazione('1403')).toBe('14.03');
    expect(formattaDigitazione('14032009')).toBe('14.03.2009');
    expect(formattaDigitazione('14/03/2009 e altro')).toBe('14.03.2009');
  });

  it('accetta una data valida e calcola l’età a oggi', () => {
    expect(analizzaDataNascita('14.03.2009', OGGI)).toEqual({
      valida: true,
      data: { anno: 2009, mese: 3, giorno: 14 },
      eta: 17,
    });
  });

  it('spiega perché una data non esiste', () => {
    expect(analizzaDataNascita('31.02.2009', OGGI)).toEqual({
      valida: false,
      errore: 'Questa data non esiste: nel 2009 febbraio ha 28 giorni. Controlla il giorno.',
    });
    expect(analizzaDataNascita('29.02.2008', OGGI).valida).toBe(true);
    expect(analizzaDataNascita('10.13.2009', OGGI)).toMatchObject({ valida: false });
  });

  it('rifiuta formato sbagliato, date future e anni prima del 1900', () => {
    expect(analizzaDataNascita('', OGGI)).toMatchObject({ valida: false });
    expect(analizzaDataNascita('14-03-2009', OGGI)).toMatchObject({ valida: false });
    expect(analizzaDataNascita('17.10.2026', OGGI)).toMatchObject({
      valida: false,
      errore: 'Questa data è nel futuro: controlla l’anno.',
    });
    expect(analizzaDataNascita('01.01.1900', OGGI)).toMatchObject({ valida: false });
  });

  it('il compleanno conta dal giorno stesso (R-01: 14 anni compiuti oggi)', () => {
    expect(etaA({ anno: 2012, mese: 10, giorno: 16 }, OGGI)).toBe(14);
    expect(etaA({ anno: 2012, mese: 10, giorno: 17 }, OGGI)).toBe(13);
  });

  it('usa il giorno di Roma anche quando a Greenwich è ancora ieri', () => {
    expect(oggiARoma(new Date('2026-10-15T22:30:00Z'))).toEqual(OGGI);
  });

  it('converte nel formato del database', () => {
    expect(dataIso({ anno: 2009, mese: 3, giorno: 4 })).toBe('2009-03-04');
  });
});

describe('email', () => {
  it('maschera l’indirizzo lasciando solo la prima lettera e il dominio', () => {
    expect(mascheraEmail('giulia.rota@example.com')).toBe('g•••@example.com');
    expect(mascheraEmail('senza-chiocciola')).toBe('•••');
  });
});

describe('errori di dominio', () => {
  it('riconosce i codici del database restituiti dall’hook di registrazione', () => {
    const errore = converti(new AuthApiError('NX001', 400, 'unknown'));
    expect(errore).toBeInstanceOf(ErroreValidazione);
    expect((errore as ErroreValidazione).codice).toBe('eta_insufficiente');
    expect((converti(new AuthApiError('NX003', 400, 'unknown')) as ErroreValidazione).codice).toBe(
      'username_in_uso',
    );
  });

  it('riconosce i codici del database restituiti da PostgREST', () => {
    const errore = converti({ code: 'NX007', message: 'La data di nascita non è modificabile' });
    expect((errore as ErroreValidazione).codice).toBe('data_nascita_immutabile');
    expect(converti({ code: '42501', message: 'permission denied' })).toBeInstanceOf(
      ErroreAutorizzazione,
    );
  });

  it('distingue credenziali errate, email non confermata e troppi tentativi', () => {
    expect(
      (converti(new AuthApiError('Invalid', 400, 'invalid_credentials')) as ErroreAutorizzazione)
        .codice,
    ).toBe('credenziali_non_valide');
    expect(
      (converti(new AuthApiError('Email', 400, 'email_not_confirmed')) as ErroreAutorizzazione)
        .codice,
    ).toBe('email_non_confermata');
    expect(converti(new AuthApiError('Too many', 429, 'over_request_rate_limit'))).toBeInstanceOf(
      ErroreLimite,
    );
    expect(converti(new AuthApiError('Too many', 429, undefined))).toBeInstanceOf(ErroreLimite);
  });

  it('riconosce le password comparse in una violazione e i link scaduti', () => {
    const violata = converti(new AuthWeakPasswordError('weak', 422, ['pwned']));
    expect((violata as ErroreValidazione).codice).toBe('password_violata');
    const corta = converti(new AuthWeakPasswordError('weak', 422, ['length']));
    expect((corta as ErroreValidazione).codice).toBe('password_debole');
    expect(
      (converti(new AuthApiError('expired', 403, 'otp_expired')) as ErroreValidazione).codice,
    ).toBe('link_scaduto');
  });

  it('tratta come errori di rete i fetch falliti', () => {
    expect(converti(new TypeError('Failed to fetch'))).toBeInstanceOf(ErroreRete);
    expect(converti(new AuthRetryableFetchError('fetch failed', 0))).toBeInstanceOf(ErroreRete);
  });

  it('riconosce i codici NX027-NX031 per flyer e reclami', () => {
    expect((converti({ code: 'NX027', message: '' }) as ErroreValidazione).codice).toBe(
      'troppi_caricamenti_oggi',
    );
    expect((converti({ code: 'NX028', message: '' }) as ErroreValidazione).codice).toBe(
      'reclamo_fuori_termine',
    );
    expect((converti({ code: 'NX029', message: '' }) as ErroreValidazione).codice).toBe(
      'reclamo_gia_presentato',
    );
    expect((converti({ code: 'NX030', message: '' }) as ErroreValidazione).codice).toBe(
      'reclamo_non_ammesso',
    );
    expect((converti({ code: 'NX031', message: '' }) as ErroreValidazione).codice).toBe(
      'reclamo_stesso_moderatore',
    );
  });

  it('il resto è uno sconosciuto', () => {
    expect(converti(new Error('boh'))).toBeInstanceOf(ErroreSconosciuto);
  });
});

describe('componenti dell’accesso', () => {
  it('CampoPassword mostra e nasconde la password e legge i requisiti', () => {
    render(
      <CampoPassword
        etichetta="Password"
        defaultValue="notte.sul"
        requisiti={[
          { testo: 'Almeno 10 caratteri', soddisfatto: false },
          { testo: 'Diversa da email e username', soddisfatto: true },
        ]}
      />,
    );
    const campo = screen.getByLabelText('Password');
    expect(campo).toHaveAttribute('type', 'password');
    expect(campo).toHaveAccessibleDescription(
      'Almeno 10 caratteri, requisito non ancora soddisfatto Diversa da email e username, requisito soddisfatto',
    );
    const mostra = screen.getByRole('button', { name: 'Mostra' });
    expect(mostra).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(mostra);
    expect(campo).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Nascondi' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('CasellaLunga è una casella vera, con il testo come etichetta e non preselezionata', () => {
    const onCambia = vi.fn();
    render(
      <CasellaLunga selezionata={false} onCambia={onCambia} errore>
        Accetto i Termini
      </CasellaLunga>,
    );
    const casella = screen.getByRole('checkbox', { name: 'Accetto i Termini' });
    expect(casella).not.toBeChecked();
    expect(casella).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(casella);
    expect(onCambia).toHaveBeenCalledWith(true);
  });

  it('gli indicatori hanno un nome per i lettori di schermo', () => {
    render(
      <>
        <IndicatorePassi passo={2} totale={4} testo="2 di 4" etichetta="Passo 2 di 4" />
        <IndicatorePunti attuale={3} totale={3} etichetta="Schermata 3 di 3" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Passo 2 di 4' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Schermata 3 di 3' })).toBeInTheDocument();
  });

  it('CampoData scrive i punti da solo', () => {
    function Prova() {
      const [valore, setValore] = useState('');
      return (
        <CampoData
          etichetta="Data di nascita"
          valore={valore}
          onCambia={setValore}
          dataIniziale={{ anno: 2010, mese: 1, giorno: 1 }}
        />
      );
    }
    render(<Prova />);
    const campo = screen.getByLabelText('Data di nascita');
    fireEvent.change(campo, { target: { value: '14032009' } });
    expect(campo).toHaveValue('14.03.2009');
    expect(campo).toHaveAttribute('inputmode', 'numeric');
  });
});
