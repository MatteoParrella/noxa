"""Colori delle copertine dopo una fonte (ADR-0030): un'immagine per serata, in memoria,
con le regole di ClientHttpConforme; gli errori saltano la serata senza fermare nulla."""

import io
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from PIL import Image
from pydantic import JsonValue

from noxa_worker.copertine.servizio import ColoriCopertine, EventoColori
from noxa_worker.errori import ErroreConformita, ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from tests.supporto import SitoFinto, client_conforme

ADESSO = datetime(2026, 11, 11, 10, 0, tzinfo=UTC)
BASE = "https://club.example"
FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f020"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c020"),
    locale_nome="Club di prova",
    tipo=TipoFonte.SITO_LOCALE,
    url=f"{BASE}/eventi",
    adattatore="sito_jsonld",
    pagine_massime=5,
)


def _png(colore: tuple[int, int, int]) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (100, 100), colore).save(buffer, format="PNG")
    return buffer.getvalue()


@dataclass
class ArchivioFinto:
    eventi: list[EventoColori]
    scritture: list[tuple[list[UUID], dict[str, JsonValue]]] = field(default_factory=list)

    async def eventi_futuri(self, locale_id: UUID) -> list[EventoColori]:
        return self.eventi

    async def imposta_colori(self, eventi: Sequence[UUID], colori: dict[str, JsonValue]) -> None:
        self.scritture.append((list(eventi), colori))


def _grezzo(titolo: str, immagine: str | None) -> EventoGrezzo:
    return EventoGrezzo(url=f"{BASE}/e", dati={"titolo": titolo, "immagine_url": immagine})


def _sito() -> SitoFinto:
    sito = SitoFinto()
    sito.aggiungi(f"{BASE}/robots.txt", "User-agent: *\nDisallow: /privato/\n", tipo="text/plain")
    sito.aggiungi(f"{BASE}/img/one.png", _png((230, 40, 40)), tipo="image/png")
    sito.aggiungi(f"{BASE}/img/atlanta.png", _png((40, 90, 230)), tipo="image/png")
    sito.aggiungi(f"{BASE}/img/pagina.html", "<html></html>", tipo="text/html")
    sito.aggiungi(f"{BASE}/privato/x.png", _png((0, 200, 0)), tipo="image/png")
    return sito


def _servizio(archivio: ArchivioFinto, sito: SitoFinto) -> ColoriCopertine:
    return ColoriCopertine(
        archivio, lambda pagine: client_conforme(sito, pagine_massime=pagine), adesso=lambda: ADESSO
    )


async def test_una_immagine_per_serata_su_tutte_le_date() -> None:
    one = [EventoColori(uuid4(), f"ONE TWO {g}.11", None) for g in (11, 18, 25)]
    atlanta = EventoColori(uuid4(), "ATLANTA", None)
    archivio = ArchivioFinto([*one, atlanta])
    sito = _sito()
    serate = await _servizio(archivio, sito).aggiorna(
        FONTE,
        [
            _grezzo("ONE TWO 11.11", f"{BASE}/img/one.png"),
            _grezzo("ONE TWO 18.11", f"{BASE}/img/one.png"),
            _grezzo("ATLANTA", f"{BASE}/img/atlanta.png"),
        ],
    )
    assert serate == 2
    assert sito.percorsi().count("/img/one.png") == 1
    scritti = {tuple(sorted(map(str, ids))) for ids, _ in archivio.scritture}
    assert tuple(sorted(str(e.id) for e in one)) in scritti
    rosso = next(c for ids, c in archivio.scritture if one[0].id in ids)
    blu = next(c for ids, c in archivio.scritture if atlanta.id in ids)
    assert rosso != blu


async def test_colori_recenti_copiati_senza_scaricare() -> None:
    colori: dict[str, JsonValue] = {
        "scuro": {},
        "chiaro": {},
        "calcolata_il": "2026-11-01T10:00:00Z",
    }
    gia = EventoColori(uuid4(), "SUPERBE", colori)
    nuovo = EventoColori(uuid4(), "SUPERBE", None)
    archivio = ArchivioFinto([gia, nuovo])
    sito = _sito()
    await _servizio(archivio, sito).aggiorna(FONTE, [_grezzo("SUPERBE", f"{BASE}/img/one.png")])
    assert archivio.scritture == [([nuovo.id], colori)]
    assert "/img/one.png" not in sito.percorsi()


async def test_colori_vecchi_ricalcolati() -> None:
    vecchi: dict[str, JsonValue] = {
        "scuro": {},
        "chiaro": {},
        "calcolata_il": "2026-09-01T10:00:00Z",
    }
    evento = EventoColori(uuid4(), "SUPERBE", vecchi)
    archivio = ArchivioFinto([evento])
    await _servizio(archivio, _sito()).aggiorna(FONTE, [_grezzo("SUPERBE", f"{BASE}/img/one.png")])
    assert archivio.scritture[0][1]["calcolata_il"] == "2026-11-11T10:00:00Z"


@pytest.mark.parametrize("percorso", ["/privato/x.png", "/img/pagina.html", "/img/manca.png", None])
async def test_errori_saltano_la_serata(percorso: str | None) -> None:
    """robots.txt che vieta, contenuto che non è un'immagine, 404, nessuna immagine."""
    archivio = ArchivioFinto([EventoColori(uuid4(), "GATE", None)])
    link = f"{BASE}{percorso}" if percorso else None
    assert await _servizio(archivio, _sito()).aggiorna(FONTE, [_grezzo("GATE", link)]) == 0
    assert archivio.scritture == []


async def test_robots_controllato_prima_di_scaricare() -> None:
    sito = _sito()
    http = client_conforme(sito)
    with pytest.raises(ErroreConformita):
        await http.get_immagine(f"{BASE}/privato/x.png")
    assert "/privato/x.png" not in sito.percorsi()
    with pytest.raises(ErroreFonte) as errore:
        await http.get_immagine(f"{BASE}/img/pagina.html")
    assert errore.value.codice == "NON_IMMAGINE"


async def test_al_massimo_dieci_immagini_per_esecuzione() -> None:
    sito = _sito()
    eventi = [EventoColori(uuid4(), f"SERATA {chr(65 + i)}", None) for i in range(12)]
    grezzi = []
    for i in range(12):
        sito.aggiungi(f"{BASE}/img/{i}.png", _png((20 * i, 40, 200)), tipo="image/png")
        grezzi.append(_grezzo(f"SERATA {chr(65 + i)}", f"{BASE}/img/{i}.png"))
    archivio = ArchivioFinto(eventi)
    assert await _servizio(archivio, sito).aggiorna(FONTE, grezzi) == 10
