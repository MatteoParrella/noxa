import type { HTMLAttributes, ReactNode } from 'react';
import { classi } from '@/lib/classi';

type Props = HTMLAttributes<HTMLElement> & { children: ReactNode };

/** Superficie con bordo sottile e raggio 8 px: contenitore generico di contenuti. */
export function Scheda({ className, children, ...resto }: Props) {
  return (
    <section className={classi('scheda', className)} {...resto}>
      {children}
    </section>
  );
}
