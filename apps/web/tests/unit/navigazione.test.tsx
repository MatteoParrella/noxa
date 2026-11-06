import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BarraNavigazione } from '@/components/guscio/BarraNavigazione';

vi.mock('next/navigation', () => ({ usePathname: () => '/organizza' }));

describe('BarraNavigazione', () => {
  it('elenca le cinque aree e segna quella attiva', () => {
    render(<BarraNavigazione />);
    const navigazione = screen.getByRole('navigation', { name: 'Principale' });
    const voci = Array.from(navigazione.querySelectorAll('a')).map((a) => a.textContent);
    expect(voci).toEqual(['Scopri', 'Organizza', 'Vivi', 'Ricorda', 'Profilo']);
    expect(screen.getByRole('link', { name: 'Organizza' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Scopri' })).not.toHaveAttribute('aria-current');
  });
});

describe('cronologia interna del pulsante indietro', () => {
  it('aggiunge le pagine nuove e accorcia la pila quando si torna alla penultima', async () => {
    const { prossimaPila } = await import('@/lib/navigazione');
    let pila = prossimaPila([], '/scopri/');
    pila = prossimaPila(pila, '/evento/?id=a');
    pila = prossimaPila(pila, '/persona/?id=b');
    expect(pila).toEqual(['/scopri/', '/evento/?id=a', '/persona/?id=b']);
    pila = prossimaPila(pila, '/evento/?id=a');
    expect(pila).toEqual(['/scopri/', '/evento/?id=a']);
    expect(prossimaPila(pila, '/evento/?id=a')).toEqual(pila);
  });

  it('trova la pagina precedente anche prima che la pagina nuova sia registrata', async () => {
    const { precedenteDi } = await import('@/lib/navigazione');
    const pila = ['/organizza/', '/gruppo/?id=g', '/serata/?id=s'];
    // Pagina già registrata.
    expect(precedenteDi(pila, '/serata/')).toBe('/gruppo/?id=g');
    // Pagina nuova non ancora registrata: la precedente è l'ultima della pila.
    expect(precedenteDi(pila, '/persona/')).toBe('/serata/?id=s');
    // Ritorno alla penultima non ancora registrato.
    expect(precedenteDi(pila, '/gruppo/')).toBe('/organizza/');
    expect(precedenteDi(['/amici/'], '/amici/')).toBeNull();
  });

  it('dà il nome della pagina di arrivo, con un nome generico per quelle sconosciute', async () => {
    const { nomePagina } = await import('@/lib/navigazione');
    expect(nomePagina('/gruppo/?id=g')).toBe('Gruppo');
    expect(nomePagina('/amici')).toBe('Amici');
    expect(nomePagina('/sconosciuta/')).toBe('Indietro');
  });
});
