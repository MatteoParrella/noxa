"""Link delle immagini letti dalle fonti, solo per i colori delle copertine (ADR-0030)."""

from bs4 import BeautifulSoup

from noxa_worker.fonti.ical import leggi_ical
from noxa_worker.fonti.sito_jsonld import _da_json_ld

ICAL = """BEGIN:VCALENDAR
BEGIN:VEVENT
UID:1@mg
SUMMARY:PERREO
DTSTART;TZID=Europe/Rome:20261121T233000
ATTACH;FMTTYPE=image/jpeg:https://mg.example/wp-content/uploads/perreo.jpeg
END:VEVENT
BEGIN:VEVENT
UID:2@mg
SUMMARY:Senza immagine
DTSTART;TZID=Europe/Rome:20261122T233000
ATTACH;FMTTYPE=application/pdf:https://mg.example/programma.pdf
END:VEVENT
END:VCALENDAR
"""


def test_immagine_allegata_al_calendario() -> None:
    perreo, senza = leggi_ical(ICAL)
    assert perreo.immagine == "https://mg.example/wp-content/uploads/perreo.jpeg"
    assert senza.immagine is None


def _jsonld(immagine: str) -> str:
    return (
        '<script type="application/ld+json">{"@type": "Event", "name": "Kamelot", '
        f'"startDate": "2026-11-17T20:00+01:00", "image": {immagine}}}</script>'
    )


def test_immagine_dei_dati_strutturati_in_ogni_forma() -> None:
    for valore, atteso in (
        ('"https://lc.example/kamelot.png"', "https://lc.example/kamelot.png"),
        ('["/img/a.png", "/img/b.png"]', "https://lc.example/img/a.png"),
        ('{"@type": "ImageObject", "url": "/img/c.jpg"}', "https://lc.example/img/c.jpg"),
        ('"data:image/png;base64,AAAA"', None),
        ("null", None),
    ):
        pagina = BeautifulSoup(_jsonld(valore), "html.parser")
        (grezzo,) = _da_json_ld(pagina, "https://lc.example/eventi/")
        assert grezzo.dati["immagine_url"] == atteso, valore
