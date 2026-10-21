"""Prova di una fonte senza scrivere nel database (skill add-event-source §3c).

Legge la fonte dal database con il ruolo del worker, esegue l'adattatore con
`ClientHttpConforme` e stampa gli eventi normalizzati in JSON. Le regole di conformità
valgono anche qui: una fonte non consentita non si legge.

Uso (da services/worker):
    uv run python -m noxa_worker.fonti.prova --fonte <fonte_id> --senza-scrittura
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from uuid import UUID

from noxa_worker.configurazione import leggi_impostazioni
from noxa_worker.database import crea_pool
from noxa_worker.errori import ErroreRaccolta
from noxa_worker.fonti.http import ClientHttpConforme, StatoCondiviso, crea_client_httpx
from noxa_worker.fonti.registro import crea_registro
from noxa_worker.raccolta.postgres import ArchivioRaccoltaPostgres


async def principale(argomenti: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prova di una fonte senza scrittura")
    parser.add_argument("--fonte", type=UUID, required=True)
    parser.add_argument(
        "--senza-scrittura",
        action="store_true",
        required=True,
        help="obbligatorio: ricorda che il comando non scrive mai nel database",
    )
    opzioni = parser.parse_args(argomenti)
    impostazioni = leggi_impostazioni()
    pool = crea_pool(impostazioni.url_database(), 1)
    await pool.open()
    try:
        voce = await ArchivioRaccoltaPostgres(pool).carica_fonte(opzioni.fonte)
    finally:
        await pool.close()
    if voce is None:
        sys.stderr.write("Fonte inesistente.\n")
        return 1
    if voce.stato_conformita != "consentita":
        sys.stderr.write("La fonte non è consentita (ADR-0008): verifica prima la conformità.\n")
        return 1
    adattatore = crea_registro(impostazioni).get(voce.fonte.adattatore)
    if adattatore is None:
        sys.stderr.write(f"Adattatore {voce.fonte.adattatore!r} non registrato.\n")
        return 1
    async with crea_client_httpx(20.0) as client:
        http = ClientHttpConforme(
            client,
            StatoCondiviso(),
            user_agent=impostazioni.scraper_user_agent,
            pagine_massime=voce.fonte.pagine_massime,
            intervallo_minimo_s=impostazioni.scraper_intervallo_minimo_s,
        )
        try:
            grezzi = await adattatore.raccogli(voce.fonte, http)
        except ErroreRaccolta as errore:
            sys.stderr.write(f"{errore.codice}: {errore}\n")
            return 1
    risultato: list[object] = []
    for grezzo in grezzi:
        try:
            risultato.append(adattatore.normalizza(grezzo, voce.fonte).model_dump(mode="json"))
        except ErroreRaccolta as errore:
            risultato.append({"url": grezzo.url, "errore": f"{errore.codice}: {errore}"})
    sys.stdout.write(json.dumps(risultato, ensure_ascii=False, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(principale()))
