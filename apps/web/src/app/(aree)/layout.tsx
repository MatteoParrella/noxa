import type { ReactNode } from 'react';
import { BarraNavigazione } from '@/components/guscio/BarraNavigazione';
import { StatoConnessione } from '@/components/guscio/StatoConnessione';
import { ProtezioneAccount } from '@/features/account/ProtezioneAccount';
import { RinnovaDispositivo } from '@/features/notifiche/RinnovaDispositivo';
import { BarraRitorno } from '@/features/ritorno/BarraRitorno';
import { MotoreRitorno } from '@/features/ritorno/MotoreRitorno';
import { SincronizzaDiario } from '@/features/ricorda/SincronizzaDiario';

export default function LayoutAree({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="guscio">
      <a className="salta-al-contenuto" href="#contenuto">
        Vai al contenuto
      </a>
      <StatoConnessione />
      <main id="contenuto" className="guscio-contenuto" tabIndex={-1}>
        <ProtezioneAccount>
          <BarraRitorno />
          {children}
          <MotoreRitorno />
          <SincronizzaDiario />
          <RinnovaDispositivo />
        </ProtezioneAccount>
      </main>
      <BarraNavigazione>
        <BarraRitorno variante="laterale" />
      </BarraNavigazione>
    </div>
  );
}
