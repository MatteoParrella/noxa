'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * L'app si apre su Scopri. Se un link delle email arriva qui (Supabase usa l'indirizzo del sito
 * quando quello richiesto non è tra gli indirizzi ammessi, per esempio dall'app nativa), lo
 * porta alla pagina che verifica il token.
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const parametri = new URLSearchParams(window.location.search);
    const tipo = parametri.get('type');
    if (parametri.get('token_hash') && (tipo === 'email' || tipo === 'signup')) {
      router.replace(`/accesso/conferma/?${parametri.toString()}`);
    } else if (parametri.get('token_hash') && tipo === 'recovery') {
      router.replace(`/accesso/nuova-password/?${parametri.toString()}`);
    } else {
      router.replace('/scopri/');
    }
  }, [router]);
  return null;
}
