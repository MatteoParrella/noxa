"""Comando `python -m noxa_worker.flyer.valuta` per valutare il golden set (skill `flyer-parser`).

Uso:
  cd services/worker
  uv run python -m noxa_worker.flyer.valuta --golden tests/dati/flyer_golden
  uv run python -m noxa_worker.flyer.valuta --golden tests/dati/flyer_golden \\
      --uscita /tmp/valutazione.json
  uv run python -m noxa_worker.flyer.valuta \\
      --confronta /tmp/valutazione_prima.json /tmp/valutazione_dopo.json
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import structlog

from noxa_worker.flyer.estrattore import (
    VERSIONE_PROMPT,
    crea_client,
    estrai_da_immagine,
    oggi_iso,
    prepara_immagine,
)
from noxa_worker.flyer.schema import FlyerEstratto

log = structlog.get_logger(__name__)

# Costo stimato per immagine in EUR (usato solo per la stima pre-esecuzione).
_COSTO_STIMATO_PER_IMMAGINE_EUR = 0.05


def _carica_golden(cartella: Path) -> list[tuple[Path, FlyerEstratto]]:
    """Legge i file *.jpg/*.png/*.webp e i corrispondenti .atteso.json."""
    risultati = []
    for immagine in sorted(cartella.glob("*.*")):
        if immagine.suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        atteso_path = immagine.with_suffix("").with_suffix(".atteso.json")
        if not atteso_path.exists():
            log.warning("atteso_mancante", immagine=str(immagine))
            continue
        atteso = FlyerEstratto.model_validate_json(atteso_path.read_text(encoding="utf-8"))
        risultati.append((immagine, atteso))
    return risultati


def _confronta(estratto: FlyerEstratto, atteso: FlyerEstratto) -> dict[str, bool | str]:
    """Restituisce il confronto campo per campo."""
    return {
        "e_un_evento": estratto.e_un_evento == atteso.e_un_evento,
        "eta_minima_ok": _eta_ok(estratto.eta_minima, atteso.eta_minima),
        "eta_minima_sicura": _eta_sicura(estratto.eta_minima, atteso.eta_minima),
        "riferimenti_alcol_ok": estratto.riferimenti_alcol == atteso.riferimenti_alcol,
        "data_ok": estratto.data == atteso.data,
        "nome_locale_ok": (
            (estratto.nome_locale or "").lower() == (atteso.nome_locale or "").lower()
        ),
        "titolo_ok": estratto.titolo == atteso.titolo,
        "contenuto_inappropriato_ok": (
            estratto.contenuto_inappropriato == atteso.contenuto_inappropriato
        ),
    }


def _eta_ok(estratta: int | None, attesa: int | None) -> bool:
    return estratta == attesa


def _eta_sicura(estratta: int | None, attesa: int | None) -> bool:
    """True se l'età estratta non è mai inferiore a quella attesa (verso il basso)."""
    if attesa is None:
        return True
    if estratta is None:
        return False
    return estratta >= attesa


def _stampa_metriche(campioni: list[dict[str, object]]) -> None:
    totale = len(campioni)
    if totale == 0:
        print("Nessun campione elaborato.")
        return

    def pct(campo: str) -> str:
        ok = sum(1 for c in campioni if c.get(campo))
        return f"{ok}/{totale} ({100 * ok / totale:.0f}%)"

    print(f"\n{'─' * 60}")
    print(f"Campioni: {totale}")
    print(f"e_un_evento:              {pct('e_un_evento')}")
    print(f"età_minima esatta:        {pct('eta_minima_ok')}")
    print(f"età_minima sicura:        {pct('eta_minima_sicura')}  (critico: deve essere 100%)")
    print(f"riferimenti_alcol:        {pct('riferimenti_alcol_ok')}  (critico: deve essere 100%)")
    print(f"data:                     {pct('data_ok')}")
    print(f"nome_locale:              {pct('nome_locale_ok')}")
    print(f"titolo:                   {pct('titolo_ok')}")
    print(f"contenuto_inappropriato:  {pct('contenuto_inappropriato_ok')}")
    print(f"{'─' * 60}\n")


async def _esegui_valutazione(
    cartella: Path,
    *,
    api_key: str,
    modello: str,
    lato_max: int,
    uscita: Path | None,
) -> None:
    from datetime import UTC, datetime

    golden = _carica_golden(cartella)
    if not golden:
        print(f"Nessun flyer trovato in {cartella}", file=sys.stderr)
        sys.exit(1)

    stima = len(golden) * _COSTO_STIMATO_PER_IMMAGINE_EUR
    print(f"Flyer da valutare: {len(golden)}")
    print(f"Stima costo: ~{stima:.2f} EUR (modello {modello})")
    # input() è sincrono: per un CLI a uso interno va bene; non chiamare da codice server.
    risposta = input("Procedere? [s/N] ").strip().lower()  # noqa: ASYNC250
    if risposta not in {"s", "si", "sì", "y", "yes"}:
        print("Annullato.")
        sys.exit(0)

    client = crea_client(api_key)
    oggi = oggi_iso(datetime.now(tz=UTC).date())
    campioni: list[dict[str, object]] = []
    totale_costo = 0.0

    for immagine_path, atteso in golden:
        nome = immagine_path.stem
        try:
            dati = immagine_path.read_bytes()
            dati_jpeg, _ = prepara_immagine(dati, lato_max)
            estratto, costo = await estrai_da_immagine(client, modello, dati_jpeg, oggi)
            totale_costo += costo
            confronto = _confronta(estratto, atteso)
            campioni.append({"id": nome, "costo_eur": costo, **confronto})
            critico_ok = all(v for k, v in confronto.items() if not k.startswith("eta_minima_s"))
            stato = "OK" if critico_ok else "FAIL"
            print(f"  {stato}  {nome}")
        except Exception as errore:  # noqa: BLE001
            print(f"  ERR  {nome}: {errore}")
            campioni.append({"id": nome, "errore": str(errore)})

    print(f"\nCosto effettivo: {totale_costo:.4f} EUR")
    print(f"Versione prompt: {VERSIONE_PROMPT}")
    _stampa_metriche(campioni)

    risultato: dict[str, object] = {
        "versione_prompt": VERSIONE_PROMPT,
        "modello": modello,
        "totale_costo_eur": totale_costo,
        "campioni": campioni,
    }
    if uscita:
        testo = json.dumps(risultato, indent=2, ensure_ascii=False)
        uscita.write_text(testo, encoding="utf-8")  # noqa: ASYNC240
        print(f"Risultati salvati in: {uscita}")


def _confronta_file(prima: Path, dopo: Path) -> None:
    """Confronta due file di valutazione e stampa le differenze."""
    r1 = json.loads(prima.read_text(encoding="utf-8"))
    r2 = json.loads(dopo.read_text(encoding="utf-8"))

    c1 = {c["id"]: c for c in r1["campioni"]}
    c2 = {c["id"]: c for c in r2["campioni"]}
    tutti = sorted(c1.keys() | c2.keys())

    metriche = [
        "e_un_evento", "eta_minima_ok", "eta_minima_sicura",
        "riferimenti_alcol_ok", "data_ok", "nome_locale_ok", "titolo_ok",
    ]
    print(f"\nConfronfo: {prima.name}  →  {dopo.name}")
    print(f"{'─' * 70}")
    print(f"Versione prompt: {r1.get('versione_prompt')} → {r2.get('versione_prompt')}")
    c1_prima = r1.get("totale_costo_eur", 0)
    c2_dopo = r2.get("totale_costo_eur", 0)
    print(f"Costo totale:    {c1_prima:.4f} → {c2_dopo:.4f} EUR")
    print()
    for m in metriche:
        n1 = sum(1 for c in c1.values() if c.get(m))
        n2 = sum(1 for c in c2.values() if c.get(m))
        t = len(tutti)
        delta = n2 - n1
        simbolo = "▲" if delta > 0 else ("▼" if delta < 0 else "=")
        print(f"  {m:<30} {n1}/{t} → {n2}/{t}  {simbolo}{abs(delta)}")
    print(f"{'─' * 70}\n")


def main() -> None:
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Valutazione golden set flyer")
    parser.add_argument("--golden", type=Path, help="Cartella del golden set")
    parser.add_argument("--uscita", type=Path, help="Salva i risultati in questo file JSON")
    parser.add_argument("--confronta", nargs=2, type=Path, metavar=("PRIMA", "DOPO"))
    parser.add_argument("--modello", default=os.getenv("CLAUDE_MODELLO_FLYER", "claude-opus-5-5"))
    parser.add_argument("--lato-max", type=int, default=1568)
    args = parser.parse_args()

    if args.confronta:
        _confronta_file(args.confronta[0], args.confronta[1])
        return

    if not args.golden:
        parser.error("--golden è obbligatorio")

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("ANTHROPIC_API_KEY non impostata.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(
        _esegui_valutazione(
            args.golden,
            api_key=api_key,
            modello=args.modello,
            lato_max=args.lato_max,
            uscita=args.uscita,
        )
    )


if __name__ == "__main__":
    main()
