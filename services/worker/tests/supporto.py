"""Strumenti comuni dei test: sito finto servito da fixture registrate, senza rete."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

import httpx

from noxa_worker.fonti.http import ClientHttpConforme, StatoCondiviso

DATI = Path(__file__).parent / "dati"
USER_AGENT = "NoxaBot/1.0 (+https://noxa.app/bot)"


def leggi_dato(percorso: str) -> str:
    return (DATI / percorso).read_text(encoding="utf-8")


@dataclass
class Risposta:
    stato: int = 200
    corpo: str = ""
    intestazioni: Mapping[str, str] = field(default_factory=dict)


@dataclass
class SitoFinto:
    """Risponde alle richieste con le risposte registrate per URL e annota le richieste."""

    risposte: dict[str, Risposta] = field(default_factory=dict)
    richieste: list[httpx.Request] = field(default_factory=list)

    def aggiungi(
        self,
        url: str,
        corpo: str = "",
        stato: int = 200,
        tipo: str | None = None,
        **intestazioni: str,
    ) -> None:
        if tipo is not None:
            intestazioni["content-type"] = tipo
        self.risposte[url] = Risposta(stato, corpo, intestazioni)

    def gestisci(self, richiesta: httpx.Request) -> httpx.Response:
        self.richieste.append(richiesta)
        url = str(richiesta.url).split("?", 1)[0]
        risposta = self.risposte.get(url)
        if risposta is None:
            return httpx.Response(404, text="non trovato")
        return httpx.Response(
            risposta.stato, text=risposta.corpo, headers=dict(risposta.intestazioni)
        )

    def percorsi(self) -> list[str]:
        return [r.url.path for r in self.richieste]


@dataclass
class Orologio:
    """Orologio finto: le attese avanzano il tempo senza dormire."""

    adesso: float = 1000.0
    attese: list[float] = field(default_factory=list)

    def __call__(self) -> float:
        return self.adesso

    async def attendi(self, secondi: float) -> None:
        self.attese.append(secondi)
        self.adesso += secondi


def client_conforme(
    sito: SitoFinto,
    *,
    pagine_massime: int = 50,
    stato: StatoCondiviso | None = None,
    orologio: Orologio | None = None,
) -> ClientHttpConforme:
    orologio_effettivo = orologio or Orologio()
    return ClientHttpConforme(
        httpx.AsyncClient(transport=httpx.MockTransport(sito.gestisci)),
        stato or StatoCondiviso(),
        user_agent=USER_AGENT,
        pagine_massime=pagine_massime,
        orologio=orologio_effettivo,
        attendi=orologio_effettivo.attendi,
    )
