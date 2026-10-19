import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Avatar, GruppoAvatar, iniziali, tinta } from '@/components/ui/Avatar';
import { Avviso } from '@/components/ui/Avviso';
import { Contatore } from '@/components/ui/Badge';
import { Campo } from '@/components/ui/Campo';
import { Interruttore } from '@/components/ui/Interruttore';
import { Pulsante } from '@/components/ui/Pulsante';
import { PulsanteSegnala } from '@/components/ui/PulsanteSegnala';
import { Schede } from '@/components/ui/Schede';
import { Segmenti } from '@/components/ui/Segmenti';
import { ErroreConAzione } from '@/components/ui/Stati';

describe('Pulsante', () => {
  it('in caricamento resta leggibile e segnala aria-busy', () => {
    render(<Pulsante caricamento>Invio</Pulsante>);
    const pulsante = screen.getByRole('button', { name: 'Invio' });
    expect(pulsante).toHaveAttribute('aria-busy', 'true');
    expect(pulsante).toHaveAttribute('type', 'button');
  });
});

describe('Campo', () => {
  it('collega etichetta, errore e aiuto al campo', () => {
    render(<Campo etichetta="Username" errore="Troppo corto." aiuto="Da 3 a 20 caratteri." />);
    const campo = screen.getByLabelText('Username');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Troppo corto. Da 3 a 20 caratteri.');
  });

  it('senza errore non è marcato come non valido', () => {
    render(<Campo etichetta="Nome" />);
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
  });
});

describe('Avatar', () => {
  it('calcola le iniziali dal nome', () => {
    expect(iniziali('giulia maria rota')).toBe('GR');
    expect(iniziali('Sara')).toBe('S');
    expect(iniziali('   ')).toBe('?');
  });

  it('assegna sempre la stessa tinta allo stesso nome', () => {
    expect(tinta('Marco Brivio')).toBe(tinta('Marco Brivio'));
  });

  it('ha il nome come etichetta accessibile', () => {
    render(<Avatar nome="Sara Colombo" />);
    expect(screen.getByRole('img', { name: 'Sara Colombo' })).toHaveTextContent('SC');
  });

  it('il gruppo riassume le persone oltre il massimo', () => {
    render(
      <GruppoAvatar
        persone={[
          { nome: 'Giulia Rota' },
          { nome: 'Marco Brivio' },
          { nome: 'Sara Colombo' },
          { nome: 'Luca Sala' },
        ]}
        massimo={2}
      />,
    );
    expect(screen.getByRole('img', { name: 'Giulia, Marco e altre 2 persone' })).toHaveTextContent(
      '+2',
    );
  });
});

describe('Contatore', () => {
  it('non compare a zero e si ferma a 99+', () => {
    const { container, rerender } = render(<Contatore valore={0} descrizione="nessuna" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Contatore valore={120} descrizione="120 notifiche nuove" />);
    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(screen.getByText('120 notifiche nuove')).toBeInTheDocument();
  });
});

describe('Interruttore', () => {
  it('cambia stato e lo espone come switch', () => {
    function Prova() {
      const [attivo, setAttivo] = useState(false);
      return <Interruttore etichetta="Tema chiaro" attivo={attivo} onCambia={setAttivo} />;
    }
    render(<Prova />);
    const interruttore = screen.getByRole('switch', { name: 'Tema chiaro' });
    expect(interruttore).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(interruttore);
    expect(interruttore).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Segmenti', () => {
  it('le frecce spostano la selezione', () => {
    const onCambia = vi.fn();
    render(
      <Segmenti
        etichetta="Quando"
        valore="stasera"
        onCambia={onCambia}
        opzioni={[
          { valore: 'stasera', etichetta: 'Stasera' },
          { valore: 'domani', etichetta: 'Domani' },
        ]}
      />,
    );
    const stasera = screen.getByRole('radio', { name: 'Stasera' });
    expect(stasera).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Domani' })).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(stasera, { key: 'ArrowRight' });
    expect(onCambia).toHaveBeenCalledWith('domani');
    fireEvent.keyDown(stasera, { key: 'ArrowLeft' });
    expect(onCambia).toHaveBeenLastCalledWith('domani');
  });
});

describe('Schede', () => {
  it('mostra solo il pannello selezionato e risponde a Fine', () => {
    const onCambia = vi.fn();
    render(
      <Schede
        etichetta="Serate"
        valore="prossime"
        onCambia={onCambia}
        schede={[
          { valore: 'prossime', etichetta: 'Prossime', contenuto: 'Elenco prossime' },
          { valore: 'passate', etichetta: 'Passate', contenuto: 'Elenco passate' },
        ]}
      />,
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Elenco prossime');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Prossime' }), { key: 'End' });
    expect(onCambia).toHaveBeenCalledWith('passate');
  });
});

describe('Avviso', () => {
  it('annuncia subito errori e con cortesia le informazioni', () => {
    render(
      <>
        <Avviso tipo="errore">Errore</Avviso>
        <Avviso tipo="info">Info</Avviso>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Errore');
    expect(screen.getByRole('status')).toHaveTextContent('Info');
  });
});

describe('Stati', () => {
  it('l’errore offre il pulsante per riprovare', () => {
    const onRiprova = vi.fn();
    render(
      <ErroreConAzione titolo="Non caricato" onRiprova={onRiprova}>
        Rete assente.
      </ErroreConAzione>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(onRiprova).toHaveBeenCalledOnce();
  });
});

describe('PulsanteSegnala', () => {
  it('dice cosa si segnala', () => {
    render(<PulsanteSegnala oggetto="l’evento Notte italo-disco" onSegnala={() => undefined} />);
    expect(
      screen.getByRole('button', { name: 'Segnala l’evento Notte italo-disco' }),
    ).toBeInTheDocument();
  });
});
