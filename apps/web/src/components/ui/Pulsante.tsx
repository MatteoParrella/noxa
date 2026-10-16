import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { classi } from '@/lib/classi';

export type VariantePulsante = 'principale' | 'secondario' | 'testo' | 'neutro' | 'pericolo';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VariantePulsante;
  dimensione?: 's' | 'm' | 'l';
  pieno?: boolean;
  /** Pulsante con sola icona: richiede `aria-label`. */
  soloIcona?: boolean;
  caricamento?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
};

export function Pulsante({
  variante = 'secondario',
  dimensione = 'm',
  pieno = false,
  soloIcona = false,
  caricamento = false,
  disabled,
  className,
  children,
  type = 'button',
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={classi(
        'btn',
        `btn-${variante}`,
        dimensione === 's' && 'btn-s',
        dimensione === 'l' && 'btn-l',
        pieno && 'btn-pieno',
        soloIcona && 'btn-icona',
        caricamento && 'is-caricamento',
        className,
      )}
      disabled={disabled}
      aria-busy={caricamento || undefined}
      {...resto}
    >
      {caricamento && (
        <span className="carico" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {children}
    </button>
  );
}
