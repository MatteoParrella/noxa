import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodiceQr } from '@/components/ui/CodiceQr';
import { MenuAzioni } from '@/components/ui/MenuAzioni';
import { RigaPersona } from '@/components/ui/RigaPersona';
import { formattaCodice } from '@/features/amici/MioCodice';
import { estraiCodice } from '@/features/amici/ScansionaCodice';
import { converti, type ErroreValidazione } from '@/lib/errori';

describe('codice invito', () => {
  it('si legge a gruppi', () => {
    expect(formattaCodice('K7Q4M2XP9H')).toBe('K7Q4-M2XP-9H');
  });

  it('si ricava dal link del QR o dal testo scritto a mano', () => {
    expect(estraiCodice('https://noxa.app/amici/invito/?c=K7Q4M2XP9H')).toBe('K7Q4M2XP9H');
    expect(estraiCodice(' k7q4-m2xp-9h ')).toBe('K7Q4M2XP9H');
    expect(estraiCodice('troppo corto')).toBeNull();
    expect(estraiCodice('https://example.com/')).toBeNull();
  });

  it('il QR ha l’alternativa testuale e moduli disegnati', () => {
    render(<CodiceQr valore="https://noxa.app/amici/invito/?c=K7Q4M2XP9H" etichetta="Codice QR" />);
    const qr = screen.getByRole('img', { name: 'Codice QR' });
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});

describe('MenuAzioni', () => {
  it('si apre, si usa con le frecce, esegue la voce e si chiude con Esc', () => {
    const segnala = vi.fn();
    render(
      <MenuAzioni
        etichetta="Altre azioni per @marco.brivio"
        titolo="@marco.brivio"
        voci={[
          { etichetta: 'Segnala', icona: null, onScegli: segnala },
          { etichetta: 'Blocca', icona: null, onScegli: vi.fn(), pericolo: true },
        ]}
      />,
    );
    const pulsante = screen.getByRole('button', { name: 'Altre azioni per @marco.brivio' });
    expect(pulsante).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(pulsante);
    expect(pulsante).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Segnala' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Blocca' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(pulsante).toHaveFocus();
    fireEvent.click(pulsante);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Segnala' }));
    expect(segnala).toHaveBeenCalledOnce();
  });
});

describe('RigaPersona', () => {
  it('mostra nome e username, con il link al profilo', () => {
    render(
      <ul>
        <RigaPersona nome="Marco" username="marco.brivio" href="/persona/?id=1" />
      </ul>,
    );
    // Fuori dalla build Next non aggiunge la barra finale: si controlla solo la destinazione.
    expect(
      screen.getByRole('link', { name: /Marco.*@marco\.brivio/ }).getAttribute('href'),
    ).toMatch(/^\/persona\/?\?id=1$/);
  });
});

describe('errori delle amicizie', () => {
  it('converte i limiti e i codici del database', () => {
    expect((converti({ code: 'NX008', message: '' }) as ErroreValidazione).codice).toBe(
      'troppe_richieste_oggi',
    );
    expect((converti({ code: 'NX010', message: '' }) as ErroreValidazione).codice).toBe(
      'troppi_codici_oggi',
    );
    expect((converti({ code: '23505', message: '' }) as ErroreValidazione).codice).toBe(
      'valore_duplicato',
    );
  });
});
