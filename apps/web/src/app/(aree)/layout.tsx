import type { ReactNode } from 'react';
import { BarraNavigazione } from '@/components/guscio/BarraNavigazione';
import { StatoConnessione } from '@/components/guscio/StatoConnessione';
import { ProtezioneAccount } from '@/features/account/ProtezioneAccount';

export default function LayoutAree({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="guscio">
      <a className="salta-al-contenuto" href="#contenuto">
        Vai al contenuto
      </a>
      <StatoConnessione />
      <main id="contenuto" className="guscio-contenuto" tabIndex={-1}>
        <ProtezioneAccount>{children}</ProtezioneAccount>
      </main>
      <BarraNavigazione />
    </div>
  );
}
