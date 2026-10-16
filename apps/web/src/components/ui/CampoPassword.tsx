'use client';

import { Check, Circle } from 'lucide-react';
import { useId, useState, type ComponentProps } from 'react';
import { classi } from '@/lib/classi';
import { messaggi } from '@/lib/messaggi/it';
import { Campo } from './Campo';
import { Icona } from './Icona';

export type Requisito = { testo: string; soddisfatto: boolean };

type Props = Omit<ComponentProps<typeof Campo>, 'type' | 'suffisso' | 'descrittoDa' | 'dopo'> & {
  /** Requisiti scritti sotto il campo, con lo stato letto anche dai lettori di schermo. */
  requisiti?: readonly Requisito[];
};

/** Campo password con "Mostra/Nascondi" e requisiti scritti (design/F-10-accesso). */
export function CampoPassword({ requisiti, className, ...resto }: Props) {
  const [visibile, setVisibile] = useState(false);
  const idRequisiti = useId();
  const testi = messaggi.comune;

  return (
    <Campo
      {...resto}
      className={classi('campo-password', className)}
      type={visibile ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...(requisiti ? { descrittoDa: idRequisiti } : {})}
      suffisso={
        <button
          type="button"
          className="mostra-password"
          aria-pressed={visibile}
          onClick={() => setVisibile((valore) => !valore)}
        >
          {visibile ? testi.nascondi : testi.mostra}
        </button>
      }
      dopo={
        requisiti && (
          <ul className="requisiti" id={idRequisiti}>
            {requisiti.map((requisito) => (
              <li key={requisito.testo} className={classi(requisito.soddisfatto && 'ok')}>
                <Icona icona={requisito.soddisfatto ? Check : Circle} dimensione="s" />
                <span>
                  {requisito.testo}
                  <span className="sr-only">
                    {', '}
                    {requisito.soddisfatto
                      ? messaggi.registrazione.credenziali.requisitoSoddisfatto
                      : messaggi.registrazione.credenziali.requisitoNonSoddisfatto}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )
      }
    />
  );
}
