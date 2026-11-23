"""Nel catalogo si salvano solo link `https` (vincoli `*_url*` e `locali_sito_web`)."""

from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError

from noxa_worker.fonti.bootstrap_locali import Candidato
from noxa_worker.normalizzazione.modelli import Origine, TipoOrigine, in_https

FONTE = UUID("00000000-0000-4000-8000-00000000f001")


def test_un_link_http_diventa_https() -> None:
    assert in_https("http://binario7.example/eventi") == "https://binario7.example/eventi"
    assert in_https("HTTP://binario7.example") == "https://binario7.example"
    assert in_https("https://binario7.example") == "https://binario7.example"


def test_l_origine_di_una_fonte_salva_il_link_in_https() -> None:
    origine = Origine(
        tipo=TipoOrigine.SITO_LOCALE,
        fonte_id=FONTE,
        url="http://binario7.example/eventi/notte",
        raccolto_il=datetime(2026, 11, 23, tzinfo=UTC),
    )
    assert origine.url == "https://binario7.example/eventi/notte"


def test_un_link_che_non_e_web_resta_rifiutato() -> None:
    with pytest.raises(ValidationError):
        Origine(
            tipo=TipoOrigine.SITO_LOCALE,
            fonte_id=FONTE,
            url="ftp://binario7.example/eventi",
            raccolto_il=datetime(2026, 11, 23, tzinfo=UTC),
        )


def test_il_sito_di_un_candidato_locale_passa_a_https() -> None:
    candidato = Candidato(origine="osm", nome="Binario 7", sito_web="http://binario7.example")
    assert candidato.sito_web == "https://binario7.example"
