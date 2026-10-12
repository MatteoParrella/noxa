#!/usr/bin/env python3
"""Verifica la coerenza della documentazione di Noxa.

Controlli:
  1. nessun segnaposto (TODO, TBD, FIXME, "da definire") nei documenti;
  2. ogni funzionalità F-xx del PRD compare nella matrice di tracciabilità, in
     ARCHITECTURE.md, DATA_MODEL.md e ROADMAP.md;
  3. ogni regola R-xx, decisione D-xx e ADR citati esistono;
  4. ogni tabella di DATA_MODEL.md ha policy RLS documentate e le funzionalità che la usano;
  5. ogni funzione private.* citata è documentata in DATA_MODEL.md.

Uso: python3 scripts/verifica_documentazione.py   (esce con codice 1 se trova problemi)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
DOCS = RADICE / "docs"
ESCLUSI = {".git", "node_modules", ".venv"}
# Righe che citano i segnaposto per vietarli, non come segnaposto.
CONTESTI_AMMESSI = re.compile(r"segnaposto|niente `?TODO|Non si lasciano|nessun `?TODO", re.IGNORECASE)


def leggi_documenti() -> dict[Path, str]:
    percorsi = [
        p
        for p in RADICE.rglob("*")
        if p.is_file()
        and p.suffix in {".md", ".yml", ".yaml", ".example"}
        and not ESCLUSI.intersection(p.parts)
    ]
    percorsi += [RADICE / ".env.example"]
    return {p: p.read_text(encoding="utf-8") for p in percorsi if p.exists()}


def main() -> int:
    documenti = leggi_documenti()
    leggi = lambda nome: (DOCS / nome).read_text(encoding="utf-8")  # noqa: E731
    prd, arch, dm, roadmap = (leggi(n) for n in ("PRD.md", "ARCHITECTURE.md", "DATA_MODEL.md", "ROADMAP.md"))
    sicurezza, decisioni = leggi("SAFETY_PRIVACY.md"), leggi("DECISIONI_APERTE.md")
    problemi: list[str] = []
    rel = lambda p: p.relative_to(RADICE)  # noqa: E731

    # 1. Segnaposto
    for percorso, testo in documenti.items():
        for riga in testo.splitlines():
            if re.search(r"\b(TODO|TBD|FIXME|da definire|da decidere)\b", riga, re.IGNORECASE):
                if not CONTESTI_AMMESSI.search(riga):
                    problemi.append(f"segnaposto in {rel(percorso)}: {riga.strip()[:80]}")

    # 2. Funzionalità
    funzionalita = sorted(set(re.findall(r"^\| (F-\d\d) \| [^|]+ \| P\d", prd, re.MULTILINE)))
    for f in funzionalita:
        for nome, testo in (("ARCHITECTURE.md", arch), ("DATA_MODEL.md", dm), ("ROADMAP.md", roadmap)):
            if f not in testo:
                problemi.append(f"{f} non compare in {nome}")
        if not re.search(rf"^\| {f} \| .*\| (\d|\d–\d) \|$", prd, re.MULTILINE):
            problemi.append(f"{f} non compare nella matrice di tracciabilità del PRD")

    # 3. Riferimenti
    regole = set(re.findall(r"^\| (R-\d\d) \|", sicurezza, re.MULTILINE))
    id_decisioni = set(re.findall(r"^\| (D-\d\d) \|", decisioni, re.MULTILINE))
    adr = {p.name[:4] for p in (DOCS / "decisions").glob("[0-9][0-9][0-9][0-9]-*.md")}
    for percorso, testo in documenti.items():
        for r in set(re.findall(r"(?<![A-Z])R-\d\d", testo)) - regole:
            problemi.append(f"{r} citata in {rel(percorso)} ma non definita in SAFETY_PRIVACY.md")
        for d in set(re.findall(r"\bD-\d\d\b", testo)) - id_decisioni:
            problemi.append(f"{d} citata in {rel(percorso)} ma non definita in DECISIONI_APERTE.md")
        for a in set(re.findall(r"ADR-(\d{4})", testo)) - adr:
            problemi.append(f"ADR-{a} citato in {rel(percorso)} ma inesistente")

    # 4. Tabelle
    tabelle = re.findall(r"^#### `(\w+)`", dm, re.MULTILINE)
    for tabella in tabelle:
        sezione = dm.split(f"#### `{tabella}`", 1)[1].split("\n#### ", 1)[0].split("\n### ", 1)[0]
        if not re.search(r"\*\*[SIUD/]+\*\*", sezione) and "nessun accesso" not in sezione:
            problemi.append(f"tabella {tabella}: policy RLS non documentate")
        if "*Funzionalità:" not in sezione:
            problemi.append(f"tabella {tabella}: funzionalità collegate non indicate")

    # 5. Funzioni private
    funzioni_documentate = set(re.findall(r"`(?:private\.)?(\w+)\(", dm)) | set(re.findall(r"private\.(\w+)", dm))
    for percorso, testo in documenti.items():
        for funzione in set(re.findall(r"private\.(\w+)", testo)) - funzioni_documentate:
            problemi.append(f"private.{funzione} citata in {rel(percorso)} ma non documentata in DATA_MODEL.md")

    for problema in sorted(set(problemi)):
        print(f"- {problema}")
    print(
        f"\n{len(funzionalita)} funzionalità, {len(regole)} regole, {len(id_decisioni)} decisioni aperte, "
        f"{len(adr) - 1} ADR, {len(tabelle)} tabelle: {len(set(problemi))} problemi."
    )
    return 1 if problemi else 0


if __name__ == "__main__":
    sys.exit(main())
