import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Globe } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { AmiciPartecipano } from '@/components/ui/AmiciPartecipano';
import { Copertina } from '@/components/ui/Copertina';
import { LinkEsterno } from '@/components/ui/LinkEsterno';
import { RigaEvento, SchedaEvidenza, type DatiSchedaEvento } from '@/components/ui/SchedaEvento';
import {
  SelettorePartecipazione,
  type SceltaPartecipazione,
} from '@/components/ui/SelettorePartecipazione';
import { aggiungiGiorni, giornoSettimana, serataInCorso } from '@/lib/date';
import { suggerisciComuni } from '@/features/scopri/comuni';
import {
  FILTRI_INIZIALI,
  filtriAttivi,
  intervallo,
  parametriRicerca,
  puntoDiPartenza,
} from '@/features/scopri/filtri';
import {
  dataIntestazione,
  distanza,
  etichettaEta,
  etichettaSerata,
  linkMappe,
  luogoIntestazione,
  orario,
  perSerata,
  prezzo,
  riassuntoFiltri,
  testoAmici,
} from '@/features/scopri/formato';

// Lunedì 19 ottobre 2026.
const LUNEDI = { anno: 2026, mese: 10, giorno: 19 };

describe('date delle serate', () => {
  it('fino alle 06:00 la serata è ancora quella del giorno prima', () => {
    expect(serataInCorso(new Date('2026-10-20T03:30:00+02:00'))).toEqual(LUNEDI);
    expect(serataInCorso(new Date('2026-10-20T06:30:00+02:00'))).toEqual({
      ...LUNEDI,
      giorno: 20,
    });
  });

  it('il weekend va da venerdì a domenica e nel weekend parte dalla serata in corso', () => {
    expect(intervallo({ tipo: 'weekend' }, LUNEDI)).toEqual([
      { anno: 2026, mese: 10, giorno: 23 },
      { anno: 2026, mese: 10, giorno: 25 },
    ]);
    const sabato = aggiungiGiorni(LUNEDI, 5);
    expect(giornoSettimana(sabato)).toBe(5);
    expect(intervallo({ tipo: 'weekend' }, sabato)).toEqual([sabato, aggiungiGiorni(sabato, 1)]);
    const domenica = aggiungiGiorni(LUNEDI, 6);
    expect(intervallo({ tipo: 'weekend' }, domenica)).toEqual([domenica, domenica]);
  });

  it('domani e una data scelta valgono una sola serata, anche a fine mese', () => {
    const fine = { anno: 2026, mese: 10, giorno: 31 };
    expect(intervallo({ tipo: 'domani' }, fine)).toEqual([
      { anno: 2026, mese: 11, giorno: 1 },
      { anno: 2026, mese: 11, giorno: 1 },
    ]);
  });

  it('etichette di sezione e data dell’intestazione', () => {
    expect(etichettaSerata(LUNEDI, LUNEDI)).toBe('Stasera · lun 19.10');
    expect(etichettaSerata(aggiungiGiorni(LUNEDI, 1), LUNEDI)).toBe('Domani · mar 20.10');
    expect(etichettaSerata(aggiungiGiorni(LUNEDI, 4), LUNEDI)).toBe('Venerdì 23.10');
    expect(dataIntestazione(LUNEDI, LUNEDI)).toBe('lun 19.10');
    expect(dataIntestazione(aggiungiGiorni(LUNEDI, 4), aggiungiGiorni(LUNEDI, 6))).toBe('23–25.10');
  });

  it('raggruppa gli eventi per serata nell’ordine del database', () => {
    const serate = perSerata(
      [
        { id: 'a', data_serata: '2026-10-23' },
        { id: 'b', data_serata: '2026-10-23' },
        { id: 'c', data_serata: '2026-10-24' },
      ],
      LUNEDI,
    );
    expect(serate.map((serata) => [serata.etichetta, serata.eventi.length])).toEqual([
      ['Venerdì 23.10', 2],
      ['Sabato 24.10', 1],
    ]);
  });
});

describe('testi delle schede', () => {
  it('orari nel fuso di Milano, anche oltre la mezzanotte', () => {
    expect(orario('2026-10-19T21:00:00Z', '2026-10-20T03:00:00Z')).toBe('23:00 → 05:00');
    expect(orario('2026-10-19T21:00:00Z', null)).toBe('23:00');
  });

  it('il badge d’età è sempre scritto per intero (R-21)', () => {
    expect(etichettaEta(16, true)).toBe('16+');
    expect(etichettaEta(18, false)).toBe('18+ · non dichiarata');
  });

  it('prezzo solo come informazione e distanza leggibile', () => {
    expect(prezzo(null)).toBeNull();
    expect(prezzo(0)).toBe('Ingresso libero');
    expect(prezzo(1500)).toBe('da 15 €');
    expect(prezzo(1250)).toBe('da 12,50 €');
    expect(distanza(null)).toBeNull();
    expect(distanza(40)).toBe('100 m');
    expect(distanza(2140)).toBe('2,1 km');
    expect(distanza(14_600)).toBe('15 km');
  });

  it('amici che partecipano: solo nomi di amici e mai contatori generici (F-04, R-43)', () => {
    const amici = [
      { id: '1', nome_visualizzato: 'Marco Brivio', stato: 'partecipo' as const },
      { id: '2', nome_visualizzato: 'Sara', stato: 'partecipo' as const },
      { id: '3', nome_visualizzato: 'Luca', stato: 'interessato' as const },
    ];
    expect(testoAmici([], 0, 0)).toBeNull();
    expect(testoAmici(amici.slice(0, 1), 1, 0)).toBe('Marco ci va');
    expect(testoAmici(amici, 2, 1)).toBe('Marco e Sara ci vanno');
    expect(testoAmici(amici, 3, 1)).toBe('Marco, Sara e un’altra persona ci vanno');
    expect(testoAmici(amici, 4, 0)).toBe('Marco, Sara e altri 2 ci vanno');
    expect(testoAmici(amici.slice(2), 0, 1)).toBe('Interessa a Luca');
    expect(testoAmici(amici.slice(2), 0, 3)).toBe('Interessa a Luca e ad altre 2 persone');
  });

  it('“Apri in Mappe” usa l’app del telefono', () => {
    const luogo = { lat: 45.58, lon: 9.27, nome: 'Club Binario 7' };
    expect(linkMappe(luogo, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5)')).toContain(
      'maps.apple.com',
    );
    expect(linkMappe(luogo, 'Mozilla/5.0 (Linux; Android 14)')).toMatch(/^geo:45.58,9.27/);
    expect(linkMappe(luogo, 'Mozilla/5.0 (X11; Linux x86_64)')).toContain('openstreetmap.org');
  });
});

describe('filtri', () => {
  it('conta i filtri attivi oltre al “quando”', () => {
    expect(filtriAttivi(FILTRI_INIZIALI)).toBe(0);
    expect(
      filtriAttivi({
        ...FILTRI_INIZIALI,
        dove: { tipo: 'comune', comune: 'Monza' },
        distanzaKm: 10,
        generi: ['techno', 'house'],
      }),
    ).toBe(2);
  });

  it('riassunto ed etichetta come nel design', () => {
    const filtri = {
      ...FILTRI_INIZIALI,
      dove: { tipo: 'comune' as const, comune: 'Monza' },
      distanzaKm: 10 as const,
      generi: ['techno', 'hip_hop'],
    };
    expect(riassuntoFiltri(filtri, { hip_hop: 'hip hop' })).toBe('Monza · 10 km · techno, hip hop');
    expect(luogoIntestazione(filtri)).toBe('Monza · entro 10 km');
    expect(luogoIntestazione(FILTRI_INIZIALI)).toBe('Milano e Brianza');
    expect(riassuntoFiltri(FILTRI_INIZIALI, {})).toBe('Tutti gli eventi');
  });

  it('il punto di partenza è la posizione concessa o il centro del comune (R-33)', () => {
    expect(puntoDiPartenza({ tipo: 'ovunque' }, { lat: 1, lon: 2 })).toBeNull();
    expect(puntoDiPartenza({ tipo: 'posizione' }, null)).toBeNull();
    expect(puntoDiPartenza({ tipo: 'posizione' }, { lat: 45.6, lon: 9.2 })).toEqual({
      lat: 45.6,
      lon: 9.2,
    });
    expect(puntoDiPartenza({ tipo: 'comune', comune: 'Monza' }, null)).toEqual({
      lat: 45.5845,
      lon: 9.2744,
    });
  });

  it('i parametri della ricerca non hanno coordinate senza un punto scelto', () => {
    const parametri = parametriRicerca(FILTRI_INIZIALI, null, LUNEDI);
    expect(parametri).toMatchObject({
      lat: null,
      lon: null,
      raggioKm: null,
      dal: '2026-10-19',
      al: '2026-10-19',
    });
  });

  it('suggerisce i comuni ignorando maiuscole e accenti', () => {
    expect(suggerisciComuni('mo').map((comune) => comune.nome)[0]).toBe('Monza');
    expect(suggerisciComuni('muggio').map((comune) => comune.nome)).toEqual(['Muggiò']);
    expect(suggerisciComuni('')).toEqual([]);
  });
});

const EVENTO: DatiSchedaEvento = {
  href: '/evento/?id=1',
  nome: 'Notte Ferrovia, Club Binario 7, Monza, gio 15.10 23:00, 18+',
  titolo: 'Notte Ferrovia',
  locale: 'Club Binario 7',
  comune: 'Monza',
  quando: 'gio 15.10 · 23:00 → 05:00',
  ora: '23:00',
  orario: '23:00 → 05:00',
  eta: '18+',
  generi: ['techno', 'house', 'live'],
  meta: ['2,1 km', 'da 15 €'],
  copertina: { tipo: 'locale', url: '/foto.webp', alt: 'Foto di Club Binario 7' },
};

describe('schede evento', () => {
  it('la scheda in evidenza è un link con un nome completo e la foto del locale (ADR-0018)', () => {
    render(<SchedaEvidenza dati={EVENTO} />);
    const link = screen.getByRole('link', { name: EVENTO.nome });
    expect(link.getAttribute('href')).toMatch(/^\/evento\/?\?id=1$/);
    expect(screen.getByRole('img', { name: 'Foto di Club Binario 7' })).toBeInTheDocument();
  });

  it('la riga mostra al massimo due generi e il badge d’età scritto', () => {
    render(<RigaEvento dati={{ ...EVENTO, annullato: true }} />);
    expect(screen.getByText('techno')).toBeInTheDocument();
    expect(screen.queryByText('live')).not.toBeInTheDocument();
    expect(screen.getByText('18+')).toBeInTheDocument();
    expect(screen.getByText('Annullato')).toBeInTheDocument();
  });

  it('se la foto non si carica la copertina passa al fondo tipografico', () => {
    render(
      <Copertina
        copertina={{ tipo: 'locale', url: '/rotta.webp', alt: 'Foto di Club Binario 7' }}
        forma="dettaglio"
        ora="23:00"
        titolo="Notte Ferrovia"
        sopra="gio 15.10 · Monza"
      />,
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('23:00')).toBeInTheDocument();
  });

  it('un’immagine nascosta in attesa della revisione diventa l’illustrazione notturna (ADR-0023)', () => {
    const { container } = render(
      <Copertina
        copertina={{ tipo: 'sostitutiva', url: '/non-usata.webp', alt: 'Foto di Club Binario 7' }}
        forma="miniatura"
        ora="23:00"
        titolo="Notte Ferrovia"
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('.copertina-sostitutiva .illustrazione-notte')).not.toBeNull();
    expect(screen.getByText('Notte Ferrovia')).toBeInTheDocument();
  });
});

function SelettoreDiProva() {
  const [scelta, setScelta] = useState<SceltaPartecipazione>(null);
  const [visibile, setVisibile] = useState(true);
  return (
    <SelettorePartecipazione
      scelta={scelta}
      visibile={visibile}
      onScegli={setScelta}
      onVisibilita={setVisibile}
    />
  );
}

describe('SelettorePartecipazione', () => {
  it('un tocco imposta, un secondo tocco toglie, lo stato è scritto (F-05)', () => {
    render(<SelettoreDiProva />);
    const partecipo = screen.getByRole('button', { name: 'Partecipo' });
    expect(screen.getByRole('status')).toHaveTextContent('Non hai ancora scelto.');
    fireEvent.click(partecipo);
    expect(partecipo).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Segnato: partecipi.');
    fireEvent.click(screen.getByRole('button', { name: 'Mi interessa' }));
    expect(partecipo).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Mi interessa' }));
    expect(screen.getByRole('status')).toHaveTextContent('Non hai ancora scelto.');
  });

  it('la visibilità per l’evento è un interruttore con lo stato scritto (R-67)', () => {
    render(<SelettoreDiProva />);
    const interruttore = screen.getByRole('switch', { name: 'Visibile ai tuoi amici' });
    expect(interruttore).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(interruttore);
    expect(interruttore).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Solo per te')).toBeInTheDocument();
  });
});

describe('AmiciPartecipano e LinkEsterno', () => {
  it('nel dettaglio la riga degli amici è un pulsante con il testo come nome', () => {
    let aperto = false;
    render(
      <AmiciPartecipano
        persone={[{ nome: 'Marco' }, { nome: 'Sara' }]}
        altri={2}
        testo="Marco, Sara e altri 2 ci vanno"
        onApri={() => {
          aperto = true;
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marco, Sara e altri 2 ci vanno' }));
    expect(aperto).toBe(true);
  });

  it('il link esterno si apre fuori dall’app e offline resta spento', () => {
    const { rerender } = render(
      <LinkEsterno
        href="https://binario7.example"
        icona={Globe}
        etichetta="Fonte"
        destinazione="binario7.example"
      />,
    );
    const link = screen.getByRole('link', { name: /Fonte/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    rerender(
      <LinkEsterno
        href="https://binario7.example"
        icona={Globe}
        etichetta="Fonte"
        destinazione="binario7.example"
        disattivato
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
