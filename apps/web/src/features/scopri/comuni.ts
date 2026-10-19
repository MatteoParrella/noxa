/**
 * Comuni che si possono scegliere al posto della posizione (R-33): il punto di partenza per le
 * distanze è il centro del comune. Coordinate approssimate al centro storico, sufficienti per
 * distanze di qualche chilometro.
 */
export type Comune = { nome: string; provincia: 'MI' | 'MB'; lat: number; lon: number };

export const COMUNI: readonly Comune[] = [
  { nome: 'Milano', provincia: 'MI', lat: 45.4642, lon: 9.19 },
  { nome: 'Monza', provincia: 'MB', lat: 45.5845, lon: 9.2744 },
  { nome: 'Abbiategrasso', provincia: 'MI', lat: 45.398, lon: 8.918 },
  { nome: 'Agrate Brianza', provincia: 'MB', lat: 45.577, lon: 9.351 },
  { nome: 'Arcore', provincia: 'MB', lat: 45.628, lon: 9.322 },
  { nome: 'Arese', provincia: 'MI', lat: 45.553, lon: 9.077 },
  { nome: 'Assago', provincia: 'MI', lat: 45.408, lon: 9.127 },
  { nome: 'Barlassina', provincia: 'MB', lat: 45.655, lon: 9.129 },
  { nome: 'Bernareggio', provincia: 'MB', lat: 45.648, lon: 9.404 },
  { nome: 'Besana in Brianza', provincia: 'MB', lat: 45.7, lon: 9.288 },
  { nome: 'Biassono', provincia: 'MB', lat: 45.629, lon: 9.273 },
  { nome: 'Bollate', provincia: 'MI', lat: 45.546, lon: 9.117 },
  { nome: 'Bovisio-Masciago', provincia: 'MB', lat: 45.61, lon: 9.15 },
  { nome: 'Bresso', provincia: 'MI', lat: 45.539, lon: 9.19 },
  { nome: 'Brugherio', provincia: 'MB', lat: 45.552, lon: 9.301 },
  { nome: 'Buccinasco', provincia: 'MI', lat: 45.418, lon: 9.122 },
  { nome: 'Caponago', provincia: 'MB', lat: 45.567, lon: 9.379 },
  { nome: 'Carate Brianza', provincia: 'MB', lat: 45.675, lon: 9.239 },
  { nome: 'Cavenago di Brianza', provincia: 'MB', lat: 45.583, lon: 9.412 },
  { nome: 'Ceriano Laghetto', provincia: 'MB', lat: 45.628, lon: 9.082 },
  { nome: 'Cernusco sul Naviglio', provincia: 'MI', lat: 45.525, lon: 9.333 },
  { nome: 'Cesano Boscone', provincia: 'MI', lat: 45.442, lon: 9.094 },
  { nome: 'Cesano Maderno', provincia: 'MB', lat: 45.63, lon: 9.15 },
  { nome: 'Cinisello Balsamo', provincia: 'MI', lat: 45.558, lon: 9.215 },
  { nome: 'Cogliate', provincia: 'MB', lat: 45.646, lon: 9.079 },
  { nome: 'Cologno Monzese', provincia: 'MI', lat: 45.53, lon: 9.278 },
  { nome: 'Concorezzo', provincia: 'MB', lat: 45.59, lon: 9.335 },
  { nome: 'Cormano', provincia: 'MI', lat: 45.542, lon: 9.168 },
  { nome: 'Corsico', provincia: 'MI', lat: 45.433, lon: 9.11 },
  { nome: 'Desio', provincia: 'MB', lat: 45.618, lon: 9.207 },
  { nome: 'Garbagnate Milanese', provincia: 'MI', lat: 45.577, lon: 9.077 },
  { nome: 'Giussano', provincia: 'MB', lat: 45.695, lon: 9.21 },
  { nome: 'Gorgonzola', provincia: 'MI', lat: 45.532, lon: 9.405 },
  { nome: 'Lainate', provincia: 'MI', lat: 45.573, lon: 9.028 },
  { nome: 'Lazzate', provincia: 'MB', lat: 45.672, lon: 9.082 },
  { nome: 'Legnano', provincia: 'MI', lat: 45.596, lon: 8.916 },
  { nome: 'Lentate sul Seveso', provincia: 'MB', lat: 45.678, lon: 9.121 },
  { nome: 'Lesmo', provincia: 'MB', lat: 45.646, lon: 9.308 },
  { nome: 'Limbiate', provincia: 'MB', lat: 45.597, lon: 9.129 },
  { nome: 'Lissone', provincia: 'MB', lat: 45.613, lon: 9.244 },
  { nome: 'Macherio', provincia: 'MB', lat: 45.642, lon: 9.269 },
  { nome: 'Magenta', provincia: 'MI', lat: 45.465, lon: 8.883 },
  { nome: 'Meda', provincia: 'MB', lat: 45.664, lon: 9.156 },
  { nome: 'Melzo', provincia: 'MI', lat: 45.499, lon: 9.42 },
  { nome: 'Mezzago', provincia: 'MB', lat: 45.627, lon: 9.444 },
  { nome: 'Misinto', provincia: 'MB', lat: 45.664, lon: 9.082 },
  { nome: 'Muggiò', provincia: 'MB', lat: 45.588, lon: 9.228 },
  { nome: 'Nova Milanese', provincia: 'MB', lat: 45.59, lon: 9.199 },
  { nome: 'Novate Milanese', provincia: 'MI', lat: 45.533, lon: 9.136 },
  { nome: 'Opera', provincia: 'MI', lat: 45.378, lon: 9.211 },
  { nome: 'Ornago', provincia: 'MB', lat: 45.601, lon: 9.421 },
  { nome: 'Paderno Dugnano', provincia: 'MI', lat: 45.569, lon: 9.168 },
  { nome: 'Parabiago', provincia: 'MI', lat: 45.559, lon: 8.948 },
  { nome: 'Peschiera Borromeo', provincia: 'MI', lat: 45.43, lon: 9.313 },
  { nome: 'Pioltello', provincia: 'MI', lat: 45.499, lon: 9.33 },
  { nome: 'Renate', provincia: 'MB', lat: 45.724, lon: 9.284 },
  { nome: 'Rho', provincia: 'MI', lat: 45.53, lon: 9.04 },
  { nome: 'Rozzano', provincia: 'MI', lat: 45.381, lon: 9.155 },
  { nome: 'San Donato Milanese', provincia: 'MI', lat: 45.417, lon: 9.269 },
  { nome: 'San Giuliano Milanese', provincia: 'MI', lat: 45.395, lon: 9.29 },
  { nome: 'Segrate', provincia: 'MI', lat: 45.49, lon: 9.295 },
  { nome: 'Senago', provincia: 'MI', lat: 45.577, lon: 9.126 },
  { nome: 'Seregno', provincia: 'MB', lat: 45.65, lon: 9.205 },
  { nome: 'Sesto San Giovanni', provincia: 'MI', lat: 45.535, lon: 9.233 },
  { nome: 'Settimo Milanese', provincia: 'MI', lat: 45.48, lon: 9.056 },
  { nome: 'Seveso', provincia: 'MB', lat: 45.648, lon: 9.14 },
  { nome: 'Sovico', provincia: 'MB', lat: 45.645, lon: 9.263 },
  { nome: 'Trezzano sul Naviglio', provincia: 'MI', lat: 45.421, lon: 9.065 },
  { nome: 'Usmate Velate', provincia: 'MB', lat: 45.649, lon: 9.36 },
  { nome: 'Varedo', provincia: 'MB', lat: 45.596, lon: 9.158 },
  { nome: 'Verano Brianza', provincia: 'MB', lat: 45.687, lon: 9.227 },
  { nome: 'Villasanta', provincia: 'MB', lat: 45.605, lon: 9.308 },
  { nome: 'Vimercate', provincia: 'MB', lat: 45.615, lon: 9.369 },
  { nome: 'Vimodrone', provincia: 'MI', lat: 45.515, lon: 9.285 },
];

function semplifica(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('it-IT')
    .trim();
}

/** Suggerimenti per il campo "Scegli un comune": prima chi inizia con il testo, poi chi lo contiene. */
export function suggerisciComuni(testo: string, massimo = 5): Comune[] {
  const cercato = semplifica(testo);
  if (cercato === '') return [];
  const inizio = COMUNI.filter((comune) => semplifica(comune.nome).startsWith(cercato));
  const dentro = COMUNI.filter(
    (comune) => !inizio.includes(comune) && semplifica(comune.nome).includes(cercato),
  );
  return [...inizio, ...dentro].slice(0, massimo);
}

export function trovaComune(nome: string): Comune | undefined {
  return COMUNI.find((comune) => comune.nome === nome);
}
