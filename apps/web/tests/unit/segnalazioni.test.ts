import { describe, expect, it } from 'vitest';
import { tempoRimanente } from '@/features/moderazione/formato';
import { testoNotifica } from '@/features/notifiche/testo';

describe('tempo rimanente delle segnalazioni (R-53)', () => {
  it('scrive ore e minuti, giorni e ore, solo minuti', () => {
    expect(tempoRimanente((2 * 60 + 15) * 60_000)).toBe('2 h 15 min');
    expect(tempoRimanente(45 * 60_000 + 59_000)).toBe('45 min');
    expect(tempoRimanente((3 * 24 + 4) * 3600_000)).toBe('3 g 4 h');
  });

  it('non va mai sotto zero', () => {
    expect(tempoRimanente(-5 * 60_000)).toBe('0 min');
  });
});

describe('testo delle notifiche', () => {
  it('gli esiti di moderazione hanno titolo e motivazione', () => {
    expect(
      testoNotifica('esito_moderazione', {
        esito: 'contenuto_rimosso',
        contenuto: 'foto',
        motivazione: 'Foto di un’altra persona.',
      }),
    ).toEqual({
      titolo: 'Abbiamo rimosso la tua foto profilo',
      motivazione: 'Foto di un’altra persona.',
    });
    expect(testoNotifica('esito_moderazione', { esito: 'flyer_rifiutato' }).titolo).toBe(
      'Il tuo flyer non è stato pubblicato',
    );
  });

  it('un esito sconosciuto usa il testo generico', () => {
    expect(testoNotifica('esito_moderazione', { esito: 'nuovo_esito' }).titolo).toBe(
      'Il tuo contenuto è stato esaminato.',
    );
    expect(testoNotifica('richiesta_amicizia', {}).motivazione).toBeNull();
  });
});
