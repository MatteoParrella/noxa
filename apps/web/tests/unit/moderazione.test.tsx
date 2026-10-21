import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CodiceSeiCifre } from '@/components/ui/CodiceSeiCifre';
import { DialogoMotivazione } from '@/components/ui/DialogoMotivazione';
import { Registro } from '@/components/ui/Registro';
import { Selezione } from '@/components/ui/Selezione';
import { TabellaDensa } from '@/components/ui/TabellaDensa';
import { dentroLimiti } from '@/components/ui/MappaPosizione';
import {
  daCampoDataOra,
  data,
  dataOra,
  durata,
  etichettaEta,
  perCampoDataOra,
  prezzo,
  serata,
  testoErrore,
  urlBreve,
} from '@/features/moderazione/formato';
import { formatoAmmesso, peso } from '@/features/moderazione/fotoLocale';
import { ErroreAutorizzazione, ErroreValidazione } from '@/lib/errori';

// jsdom non implementa <dialog>: i metodi bastano per aprire e chiudere.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
// jsdom non scorre la pagina: l'avviso d'errore chiede di portarsi in vista.
Element.prototype.scrollIntoView = function scrollIntoView() {};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

function Codice({ onCompleto }: { onCompleto: (valore: string) => void }) {
  const [valore, setValore] = useState('');
  return (
    <CodiceSeiCifre
      etichetta="Codice a 6 cifre"
      etichettaCifra={(n) => `Cifra ${n} di 6`}
      valore={valore}
      onCambia={setValore}
      onCompleto={onCompleto}
    />
  );
}

describe('CodiceSeiCifre', () => {
  it('avanza di casella in casella e segnala il codice completo', () => {
    const completo = vi.fn();
    render(<Codice onCompleto={completo} />);
    fireEvent.change(screen.getByLabelText('Cifra 1 di 6'), { target: { value: '48' } });
    expect(screen.getByLabelText('Cifra 2 di 6')).toHaveValue('8');
    expect(screen.getByLabelText('Cifra 3 di 6')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Cifra 3 di 6'), { target: { value: '1902' } });
    expect(completo).toHaveBeenCalledWith('481902');
  });

  it('ignora le lettere e corregge con Backspace', () => {
    render(<Codice onCompleto={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Cifra 1 di 6'), { target: { value: 'a1b2' } });
    expect(screen.getByLabelText('Cifra 1 di 6')).toHaveValue('1');
    expect(screen.getByLabelText('Cifra 2 di 6')).toHaveValue('2');
    fireEvent.keyDown(screen.getByLabelText('Cifra 3 di 6'), { key: 'Backspace' });
    expect(screen.getByLabelText('Cifra 2 di 6')).toHaveValue('');
  });

  it('mostra l’errore senza svuotare le cifre', () => {
    render(
      <CodiceSeiCifre
        etichetta="Codice"
        etichettaCifra={(n) => `Cifra ${n}`}
        valore="123456"
        onCambia={vi.fn()}
        errore="Codice non valido."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Codice non valido.');
    expect(screen.getByLabelText('Cifra 6')).toHaveValue('6');
    expect(screen.getByLabelText('Cifra 1')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('TabellaDensa', () => {
  const righe = [
    { id: 'a', nome: 'Club Binario 7', fonti: 2 },
    { id: 'b', nome: 'Officina Lambro', fonti: 1 },
  ];

  it('ha didascalia, intestazioni e righe; le frecce spostano il focus', () => {
    const apri = vi.fn();
    render(
      <TabellaDensa
        etichetta="Locali"
        titoloPrima="Locale"
        colonne={[{ chiave: 'fonti', titolo: 'Fonti', cella: (r) => r.fonti, classe: 'mono' }]}
        righe={righe}
        chiaveRiga={(r) => r.id}
        selezionata="b"
        onApri={apri}
        prima={(r) => (
          <a href={`#${r.id}`} data-apri-riga>
            {r.nome}
          </a>
        )}
      />,
    );
    expect(screen.getByRole('table', { name: 'Locali' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Fonti' })).toBeInTheDocument();
    screen.getByRole('link', { name: 'Club Binario 7' }).focus();
    fireEvent.keyDown(screen.getByRole('link', { name: 'Club Binario 7' }), { key: 'ArrowDown' });
    expect(screen.getByRole('link', { name: 'Officina Lambro' })).toHaveFocus();
    expect(screen.getAllByRole('row')[2]).toHaveClass('is-sel');
    fireEvent.click(screen.getAllByRole('cell', { name: '1' })[0] as HTMLElement);
    expect(apri).toHaveBeenCalledWith(righe[1]);
  });
});

describe('DialogoMotivazione', () => {
  it('non conferma senza motivazione e mostra l’errore del server', async () => {
    const conferma = vi.fn().mockRejectedValueOnce(new Error('rete')).mockResolvedValue(undefined);
    render(
      <DialogoMotivazione
        aperto
        onChiudi={vi.fn()}
        titolo="Annullare «Bassi Lunghi»?"
        effetto="Chi partecipa lo vedrà come annullato."
        etichettaMotivazione="Motivazione (obbligatoria)"
        aiutoMotivazione="Resta nel registro."
        erroreMotivazioneMancante="Scrivi la motivazione."
        etichettaConferma="Annulla evento"
        etichettaAnnulla="Annulla"
        testoErrore={() => 'Non salvato.'}
        onConferma={conferma}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Annulla evento' }));
    expect(await screen.findByText('Scrivi la motivazione.')).toBeInTheDocument();
    expect(conferma).not.toHaveBeenCalled();
    const campo = screen.getByLabelText('Motivazione (obbligatoria)');
    expect(campo).toHaveAccessibleDescription('Resta nel registro. Scrivi la motivazione.');
    fireEvent.change(campo, { target: { value: 'Rimandata.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla evento' }));
    expect(await screen.findByText('Non salvato.')).toBeInTheDocument();
    expect(campo).toHaveValue('Rimandata.');
    fireEvent.click(screen.getByRole('button', { name: 'Annulla evento' }));
    await waitFor(() => expect(conferma).toHaveBeenLastCalledWith('Rimandata.'));
  });
});

describe('Registro e Selezione', () => {
  it('il registro indica "Sistema" per la raccolta e la motivazione', () => {
    render(
      <Registro
        etichettaSistema="Sistema"
        vuoto="Nessuna azione."
        voci={[
          {
            quando: '19.10 08:14',
            autore: 'Moderatore Uno',
            cosa: 'ha approvato la foto',
            perche: 'Rif. AUT-1',
          },
          { quando: '18.10 19:31', autore: null, cosa: 'ha creato l’evento da @x', perche: null },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('Rif. AUT-1')).toBeInTheDocument();
  });

  it('il registro vuoto lo dice', () => {
    render(<Registro etichettaSistema="Sistema" vuoto="Nessuna azione." voci={[]} />);
    expect(screen.getByText('Nessuna azione.')).toBeInTheDocument();
  });

  it('la selezione ha etichetta ed errore collegati', () => {
    const cambia = vi.fn();
    render(
      <Selezione
        etichetta="Provincia"
        valore="MI"
        opzioni={[
          { valore: 'MI', etichetta: 'Milano' },
          { valore: 'MB', etichetta: 'Monza e Brianza' },
        ]}
        onCambia={cambia}
        errore="Scegli la provincia."
      />,
    );
    const menu = screen.getByRole('combobox', { name: 'Provincia' });
    expect(menu).toHaveAccessibleDescription('Scegli la provincia.');
    fireEvent.change(menu, { target: { value: 'MB' } });
    expect(cambia).toHaveBeenCalledWith('MB');
  });
});

describe('formato dell’area di moderazione', () => {
  it('date e ore nel fuso di Milano', () => {
    expect(dataOra('2026-10-19T06:12:00Z')).toBe('19.10 08:12');
    expect(serata('2026-10-23')).toBe('ven 23.10');
    expect(data('2026-10-02')).toBe('02.10.2026');
    expect(perCampoDataOra('2026-10-17T21:30:00Z')).toBe('2026-10-17T23:30');
    expect(daCampoDataOra('2026-10-17T23:30')).toBe('2026-10-17T21:30:00.000Z');
    // Dopo il cambio dell'ora Milano è a UTC+1.
    expect(daCampoDataOra('2026-10-31T23:30')).toBe('2026-10-31T22:30:00.000Z');
    expect(daCampoDataOra('17/10/2026')).toBeNull();
  });

  it('età, prezzi, durate e URL', () => {
    expect(etichettaEta(16, true)).toBe('16+');
    expect(etichettaEta(18, false)).toBe('18+ · non dichiarata');
    expect(prezzo(null)).toBe('—');
    expect(prezzo(0)).toBe('gratis');
    expect(prezzo(1250)).toBe('da 12,5 €');
    expect(durata(8400)).toBe('8,4 s');
    expect(urlBreve('https://www.binario7.example/eventi/')).toBe('binario7.example/eventi');
  });

  it('errori tradotti in testi con un’azione', () => {
    expect(testoErrore(new ErroreValidazione('motivazione_mancante'))).toMatch(
      /Scrivi la motivazione/,
    );
    expect(testoErrore(new ErroreValidazione('gia_deciso'))).toMatch(/già deciso/);
    expect(testoErrore(new ErroreAutorizzazione('negato'))).toMatch(/due fattori/);
    expect(testoErrore({ code: 'NX022', message: 'x' })).toMatch(/ADR-0008/);
  });

  it('foto: formati ammessi e peso leggibile', () => {
    expect(formatoAmmesso(new File([''], 'a.webp', { type: 'image/webp' }))).toBe(true);
    expect(formatoAmmesso(new File([''], 'a.heic', { type: 'image/heic' }))).toBe(false);
    expect(peso(412 * 1024)).toBe('412 KB');
    expect(peso(3.4 * 1024 * 1024)).toBe('3,4 MB');
  });

  it('coordinate dentro Milano e Brianza', () => {
    expect(dentroLimiti(45.5845, 9.2744)).toBe(true);
    expect(dentroLimiti(41.9, 12.5)).toBe(false);
  });
});
