# ADR-0001: Next.js in export statico con Capacitor

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
L'app deve essere una PWA installabile e, per il ritorno sicuro (F-21), un'app nativa
capace di leggere la posizione in background: una PWA non può farlo in modo affidabile su
iOS. Capacitor impacchetta una web app in un contenitore nativo, ma carica file statici
locali: non può eseguire il rendering lato server di Next.js.

## Decisione
- Un solo codice in `apps/web`: Next.js (App Router) + TypeScript strict + Tailwind, con
  `output: 'export'`.
- Lo stesso export viene servito come PWA (Vercel) e incluso nelle app iOS e Android con
  Capacitor.
- Niente Server Components con dati, Route Handlers, Server Actions o middleware: tutti i
  dati arrivano da Supabase lato client, protetti dalla RLS (ADR-0002).
- I dettagli usano parametri di query (`/evento?id=…`) invece di segmenti dinamici.

## Alternative considerate
- **PWA sola**: il ritorno sicuro non funzionerebbe in background su iOS, dando un falso
  senso di sicurezza.
- **React Native / Expo**: ottimo per il nativo, ma richiederebbe un secondo codice per la
  PWA o rinunciare a Tailwind e al flusso con Claude Design; la squadra lavora sul web.
- **Next.js con SSR e Capacitor in modalità URL remoto**: l'app dipenderebbe dalla rete per
  partire e Apple tende a rifiutare app che sono solo un sito web incapsulato.

## Conseguenze
- La SEO delle pagine evento è limitata (non serve: l'accesso richiede un account, R-07).
- Tutta l'autorizzazione è per forza nel database: è un vantaggio per la sicurezza.
- Servono plugin Capacitor per geolocalizzazione in background (D-04), notifiche push,
  fotocamera e condivisione.
- Le release native passano dalla revisione degli store.
