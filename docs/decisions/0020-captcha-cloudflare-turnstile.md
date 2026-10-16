# ADR-0020: CAPTCHA con Cloudflare Turnstile

- **Stato**: Accettato
- **Data**: 2026-10-16

## Contesto
La registrazione, l'accesso e il recupero della password sono gli endpoint più esposti agli
abusi automatici: creazione di account in massa, tentativi di indovinare le password, invio di
email a indirizzi altrui. ARCHITECTURE.md §3.2 prevedeva già un CAPTCHA in Supabase Auth, che
supporta hCaptcha e Cloudflare Turnstile. Il pubblico è fatto in gran parte di minorenni:
il CAPTCHA non deve chiedere di risolvere puzzle né usare i dati per profilare (R-61, R-62), e
deve funzionare dentro l'app Capacitor e con la Content Security Policy della PWA.

## Decisione
Supabase Auth richiede il token di **Cloudflare Turnstile** su registrazione, accesso, recupero
della password e reinvio dell'email, in staging e produzione. La chiave del sito è pubblica
(`NEXT_PUBLIC_TURNSTILE_SITE_KEY`); la chiave segreta sta solo nella configurazione di
Supabase Auth (Authentication → Attack Protection), mai nel repository.

- Nella registrazione il riquadro è sempre visibile (design/F-10-accesso); nelle altre
  schermate il widget è "discreto" (`appearance: interaction-only`) e compare solo se
  Cloudflare chiede un'azione.
- Lo script arriva da `https://challenges.cloudflare.com`, l'unica origine esterna ammessa
  dalla Content Security Policy per script e iframe (ARCHITECTURE.md §9).
- In locale il CAPTCHA è spento (supabase/config.toml) e la chiave del sito è vuota: lo
  sviluppo e i test e2e non dipendono da Cloudflare. I test e2e simulano lo script.

## Alternative considerate
- **hCaptcha**: chiede spesso di risolvere immagini, peggiore per l'accessibilità (WCAG 2.2
  AA, DESIGN.md §4); la versione gratuita è più orientata alla raccolta di dati.
- **Nessun CAPTCHA, solo limiti di frequenza di Supabase**: i limiti per IP non fermano reti
  di indirizzi; resta un rischio di account falsi, che per un'app con minorenni ha un costo
  alto.
- **CAPTCHA solo nella registrazione**: Supabase Auth applica il CAPTCHA a tutti gli endpoint
  di autenticazione quando è attivo, quindi non è configurabile per singolo endpoint.

## Conseguenze
- Cloudflare tratta indirizzo IP e segnali tecnici del browser durante la verifica: è un
  fornitore extra-UE aggiunto a R-66, all'informativa (/privacy) e alle verifiche legali di
  D-07.
- Le schermate di accesso gestiscono il token monouso: lo azzerano dopo ogni tentativo.
- Da configurare in staging e produzione: widget Turnstile con gli hostname dell'app, chiave
  segreta in Supabase Auth, chiave del sito nelle variabili di Vercel (supabase/README.md).
