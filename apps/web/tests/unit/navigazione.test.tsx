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
