import type { LucideIcon, LucideProps } from 'lucide-react';
import { classi } from '@/lib/classi';

type Props = Omit<LucideProps, 'size' | 'strokeWidth'> & {
  icona: LucideIcon;
  dimensione?: 's' | 'm' | 'l';
};

/** Icona Lucide con il tratto del design system (1,75), sempre decorativa. */
export function Icona({ icona: Componente, dimensione = 'm', className, ...resto }: Props) {
  return (
    <Componente
      aria-hidden="true"
      focusable="false"
      strokeWidth={1.75}
      className={classi(
        'ico',
        dimensione === 's' && 'ico-s',
        dimensione === 'l' && 'ico-l',
        className,
      )}
      {...resto}
    />
  );
}
