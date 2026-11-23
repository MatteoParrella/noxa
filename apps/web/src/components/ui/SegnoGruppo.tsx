import { classi } from '@/lib/classi';
import type { ColoreGruppo } from '@/lib/coloriGruppo';

/**
 * Segno del gruppo: l'iniziale del nome sul colore scelto. Solo decorativo: il nome del gruppo
 * è sempre scritto accanto, quindi il colore non porta da solo nessuna informazione.
 */
export function SegnoGruppo({
  nome,
  colore,
  grande = false,
}: {
  nome: string;
  colore: ColoreGruppo;
  grande?: boolean;
}) {
  const iniziale = Array.from(nome.trim())[0]?.toLocaleUpperCase('it-IT') ?? '';
  return (
    <span
      className={classi('segno-gruppo', grande && 'segno-gruppo-grande')}
      data-colore={colore}
      aria-hidden="true"
    >
      {iniziale}
    </span>
  );
}
