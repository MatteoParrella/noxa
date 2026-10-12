# apps/web

App Noxa: Next.js (App Router) in export statico + TypeScript strict + Tailwind, distribuita
come PWA e come app iOS e Android con Capacitor (ADR-0001).

Viene inizializzata nella Fase 0 (`docs/ROADMAP.md`). Organizzazione prevista:

| Cartella | Contenuto |
|---|---|
| `src/app/` | Route statiche; i dettagli usano parametri di query (`/evento?id=…`) |
| `src/features/<area>/` | `scopri`, `organizza`, `vivi`, `ricorda`, `account`, `moderazione`: schermate, hook, query e test di ogni area |
| `src/components/ui/` | Componenti del design system (skill `implement-design`) |
| `src/lib/` | Client Supabase, `database.types.ts` generato, `errori.ts`, `messaggi/it.ts` |
| `src/styles/` | `tokens.css` (design token da Claude Design) |
| `tests/unit/`, `tests/e2e/` | Vitest e Playwright con axe |

Comandi in `CLAUDE.md`.
