from typing import Any, cast

from noxa_worker.osservabilita import pulisci_evento, pulisci_testo


def test_pulisci_testo_toglie_email_coordinate_url_e_testi() -> None:
    testo = (
        "Errore per mario.rossi@example.com a 45.46421, 9.19003 su https://sito.example/a?b=1 "
        "con titolo 'Festa privata'"
    )
    pulito = pulisci_testo(testo)

    assert "example.com" not in pulito
    assert "45.46421" not in pulito
    assert "sito.example" not in pulito
    assert "Festa privata" not in pulito
    assert "[email]" in pulito
    assert "[url]" in pulito
    assert "[testo]" in pulito


def test_pulisci_evento_toglie_utente_richiesta_breadcrumb_e_variabili() -> None:
    evento: dict[str, Any] = {
        "user": {"id": "1", "email": "a@b.it"},
        "request": {"url": "https://x"},
        "breadcrumbs": {"values": [{"message": "ciao"}]},
        "extra": {"payload": {"titolo": "x"}},
        "message": "contatto a@b.it",
        "logentry": {"message": "job 'Serata'", "params": ["segreto"]},
        "exception": {
            "values": [
                {
                    "type": "ValueError",
                    "value": "valore 'Testo scritto'",
                    "stacktrace": {"frames": [{"function": "f", "vars": {"password": "x"}}]},
                }
            ]
        },
    }

    pulito = cast("dict[str, Any]", pulisci_evento(cast("Any", evento), cast("Any", {})))

    for chiave in ("user", "request", "breadcrumbs", "extra"):
        assert chiave not in pulito
    assert pulito["message"] == "contatto [email]"
    assert "params" not in pulito["logentry"]
    eccezione = pulito["exception"]["values"][0]
    assert eccezione["value"] == "valore [testo]"
    assert "vars" not in eccezione["stacktrace"]["frames"][0]
