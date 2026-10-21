"""Salva una pagina di una fonte come fixture dei test (skill add-event-source §4).

Usa `ClientHttpConforme` (robots.txt, user agent, limiti) e salva solo il corpo della
pagina, senza cookie né intestazioni. Prima del commit si controlla a mano che il file non
contenga dati personali.

Uso (da services/worker):
    uv run python -m noxa_worker.fonti.salva_fixture --url <url> \\
        --destinazione tests/dati/pagine/<adattatore>/<aaaa-mm-gg>.html
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from noxa_worker.configurazione import leggi_impostazioni
from noxa_worker.errori import ErroreRaccolta
from noxa_worker.fonti.http import ClientHttpConforme, StatoCondiviso, crea_client_httpx


async def principale(argomenti: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Salva una fixture di una fonte")
    parser.add_argument("--url", required=True)
    parser.add_argument("--destinazione", type=Path, required=True)
    opzioni = parser.parse_args(argomenti)
    impostazioni = leggi_impostazioni()
    async with crea_client_httpx(20.0) as client:
        http = ClientHttpConforme(
            client,
            StatoCondiviso(),
            user_agent=impostazioni.scraper_user_agent,
            pagine_massime=1,
            intervallo_minimo_s=impostazioni.scraper_intervallo_minimo_s,
        )
        try:
            risposta = await http.get_testo(opzioni.url)
        except ErroreRaccolta as errore:
            sys.stderr.write(f"{errore.codice}: {errore}\n")
            return 1
    opzioni.destinazione.parent.mkdir(parents=True, exist_ok=True)
    opzioni.destinazione.write_text(risposta.testo, encoding="utf-8")
    sys.stdout.write(
        f"Salvata {opzioni.destinazione}: controlla che non contenga dati personali.\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(principale()))
