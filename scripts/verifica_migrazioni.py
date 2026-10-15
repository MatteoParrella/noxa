#!/usr/bin/env python3
"""Controllo statico delle migrazioni di Noxa (R-68, skill db-migration).

Per ogni tabella creata in public dalle migrazioni (e non eliminata da una migrazione
successiva) verifica che:
  1. una migrazione abiliti la RLS (`alter table public.<nome> enable row level security`);
  2. la tabella compaia in almeno un file di test pgTAP di supabase/tests diverso da
     001_rls_abilitata.test.sql.

Il controllo dinamico della RLS è in supabase/tests/001_rls_abilitata.test.sql; questo script
lo affianca in CI per far fallire anche le PR con una tabella senza test.

Uso: python3 scripts/verifica_migrazioni.py   (esce con codice 1 se trova problemi)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
MIGRAZIONI = RADICE / "supabase" / "migrations"
TEST = RADICE / "supabase" / "tests"

NOME = r'(?:public\.)?"?([a-z_][a-z0-9_]*)"?'
CREA = re.compile(rf"\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.\"?([a-z_][a-z0-9_]*)", re.IGNORECASE)
ELIMINA = re.compile(rf"\bdrop\s+table\s+(?:if\s+exists\s+)?public\.\"?([a-z_][a-z0-9_]*)", re.IGNORECASE)
RLS = re.compile(rf"\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?{NOME}\s+enable\s+row\s+level\s+security", re.IGNORECASE)


def senza_commenti(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", "", sql)


def main() -> int:
    tabelle: set[str] = set()
    con_rls: set[str] = set()
    for file in sorted(MIGRAZIONI.glob("*.sql")):
        sql = senza_commenti(file.read_text(encoding="utf-8"))
        # Nell'ordine delle migrazioni: creazioni, poi eliminazioni.
        tabelle |= {t.lower() for t in CREA.findall(sql)}
        tabelle -= {t.lower() for t in ELIMINA.findall(sql)}
        con_rls |= {t.lower() for t in RLS.findall(sql)}

    testi_test = [
        f.read_text(encoding="utf-8")
        for f in sorted(TEST.glob("*.sql"))
        if f.name != "001_rls_abilitata.test.sql"
    ]

    problemi: list[str] = []
    for tabella in sorted(tabelle):
        if tabella not in con_rls:
            problemi.append(f"public.{tabella}: nessuna migrazione abilita la RLS (R-68)")
        if not any(re.search(rf"\b{re.escape(tabella)}\b", testo) for testo in testi_test):
            problemi.append(f"public.{tabella}: non compare in nessun test di supabase/tests")

    for problema in problemi:
        print(f"ERRORE {problema}", file=sys.stderr)
    if problemi:
        return 1
    print(f"Migrazioni verificate: {len(tabelle)} tabelle in public, tutte con RLS e test.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
