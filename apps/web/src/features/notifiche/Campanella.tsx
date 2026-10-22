'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Contatore } from '@/components/ui/Badge';
import { Icona } from '@/components/ui/Icona';
import { messaggi } from '@/lib/messaggi/it';
import { useConteggioNonLette } from './dati';

const testi = messaggi.notifiche;

/** Pulsante campanella con contatore delle notifiche non lette, link a /notifiche/. */
export function Campanella() {
  const nonLette = useConteggioNonLette();
  return (
    <Link
      href="/notifiche/"
      className="btn btn-testo btn-s relative"
      aria-label={nonLette > 0 ? testi.campanella(nonLette) : testi.apriNotifiche}
    >
      <span className="nav-icona">
        <Icona icona={Bell} />
        {nonLette > 0 && <Contatore valore={nonLette} descrizione={testi.campanella(nonLette)} />}
      </span>
    </Link>
  );
}
