from datetime import datetime, timedelta
from uuid import UUID, uuid4

from noxa_worker.dedup.fusione import EventoEsistente, fondi
from noxa_worker.dedup.punteggio import EsitoDedup, EventoConfronto, decidi
from noxa_worker.dedup.testi import normalizza_artista, normalizza_titolo
from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.modelli import (
    EventoNormalizzato,
    LocaleEvento,
    Origine,
    TipoOrigine,
)

LOCALE = UUID("00000000-0000-4000-8000-00000000c001")
INIZIO = datetime(2026, 10, 17, 23, 0, tzinfo=FUSO_ROMA)

# ---------------------------------------------------------------------------------------------
# Testi (§6.1)
# ---------------------------------------------------------------------------------------------


def test_titolo_senza_parole_non_distintive() -> None:
    assert (
        normalizza_titolo(
            "Club Binario 7 presents: NOTTE FERROVIA – Sabato 17 Ottobre h23", "Club Binario 7"
        )
        == "notte ferrovia"
    )


def test_titolo_vuoto_dopo_la_pulizia_resta_quello_base() -> None:
    assert normalizza_titolo("Party Night!", None) == "party night"


def test_artisti_senza_prefissi() -> None:
    assert normalizza_artista("DJ Corrado B.") == "corrado b"
    assert normalizza_artista("b2b MC Selva") == "selva"


# ---------------------------------------------------------------------------------------------
# Decisione (§6.3)
# ---------------------------------------------------------------------------------------------


def _c(
    titolo: str, minuti: int = 0, artisti: tuple[str, ...] = (), id_: UUID | None = None
) -> EventoConfronto:
    return EventoConfronto(titolo, INIZIO + timedelta(minutes=minuti), artisti, id_ or uuid4())


def test_titolo_quasi_identico_stesso_evento() -> None:
    esistente = _c("Notte Ferrovia")
    decisione = decidi(_c("NOTTE FERROVIA!!", minuti=120, id_=None), [esistente], "Club Binario 7")
    assert decisione.esito is EsitoDedup.STESSO_EVENTO
    assert decisione.evento_id == esistente.id


def test_titolo_simile_con_orario_vicino_stesso_evento() -> None:
    esistente = _c("Notte Ferrovia techno all night")
    decisione = decidi(_c("Notte Ferrovia: la festa", minuti=30), [esistente], None)
    assert decisione.esito is EsitoDedup.STESSO_EVENTO


def test_titolo_simile_senza_indizi_in_revisione() -> None:
    esistente = _c("Notte Ferrovia techno all night")
    altro = _c("Notte Ferrovia: la festa", minuti=180)
    decisione = decidi(altro, [esistente, _c("Altro evento", 60)], None)
    assert decisione.esito is EsitoDedup.REVISIONE
    assert decisione.motivo is not None
    assert "titolo simile" in decisione.motivo


def test_titoli_diversi_unico_evento_con_artista_in_revisione() -> None:
    esistente = _c("Sabato in sala grande", artisti=("Nera Vale",))
    decisione = decidi(
        _c("Techno marathon", minuti=200, artisti=("DJ Nera Vale",)), [esistente], None
    )
    assert decisione.esito is EsitoDedup.REVISIONE
    assert (
        decisione.motivo
        == "Stesso locale, orario a 200 minuti, 1 artista in comune, titolo diverso"
    )


def test_titoli_diversi_eventi_distinti() -> None:
    decisione = decidi(_c("Hip hop in sala 2", 200), [_c("Techno in sala 1"), _c("Live")], None)
    assert decisione.esito is EsitoDedup.DISTINTI


def test_flyer_simile_va_in_revisione() -> None:
    esistente = _c("Notte Ferrovia techno all night")
    decisione = decidi(_c("Notte Ferrovia: la festa", minuti=30), [esistente], None, da_flyer=True)
    assert decisione.esito is EsitoDedup.REVISIONE


def test_si_sceglie_il_candidato_piu_simile() -> None:
    simile, uguale = _c("Notte Fermata"), _c("Notte Ferrovia")
    assert decidi(_c("Notte Ferrovia"), [simile, uguale], None).evento_id == uguale.id


def test_a_parita_di_titolo_vince_l_orario_piu_vicino() -> None:
    lontano, vicino = _c("Notte Ferrovia", 90), _c("Notte Ferrovia", 15)
    assert decidi(_c("Notte Ferrovia"), [lontano, vicino], None).evento_id == vicino.id


# ---------------------------------------------------------------------------------------------
# Fusione (§7, R-21, R-22, R-23)
# ---------------------------------------------------------------------------------------------


def _esistente(**modifiche: object) -> EventoEsistente:
    dati: dict[str, object] = {
        "id": uuid4(),
        "locale_id": LOCALE,
        "titolo": "Notte Ferrovia",
        "descrizione": None,
        "inizio": INIZIO,
        "fine": None,
        "eta_minima": 18,
        "eta_minima_dichiarata": False,
        "riferimenti_alcol": False,
        "generi": ("techno",),
        "artisti": ("Nera Vale",),
        "prezzo_min_centesimi": None,
        "url_biglietti": None,
        "stato": "pubblicato",
        "priorita_migliore": 4,
    }
    dati.update(modifiche)
    return EventoEsistente(**dati)  # type: ignore[arg-type]


def _nuovo(tipo: TipoOrigine = TipoOrigine.SITO_LOCALE, **modifiche: object) -> EventoNormalizzato:
    dati: dict[str, object] = {
        "origine": Origine(
            tipo=tipo,
            fonte_id=uuid4(),
            url="https://binario7.example/e",
            raccolto_il=INIZIO,
        ),
        "locale": LocaleEvento(id=LOCALE, nome="Club Binario 7"),
        "titolo": "Notte Ferrovia",
        "inizio": INIZIO,
        "riferimenti_alcol": False,
    }
    dati.update(modifiche)
    return EventoNormalizzato.model_validate(dati)


def test_eta_massima_tra_le_dichiarate() -> None:
    fusione = fondi(_esistente(eta_minima=16, eta_minima_dichiarata=True), _nuovo(eta_minima=18))
    assert fusione.modifiche["eta_minima"] == 18


def test_eta_dichiarata_non_si_abbassa() -> None:
    fusione = fondi(_esistente(eta_minima=18, eta_minima_dichiarata=True), _nuovo(eta_minima=14))
    assert "eta_minima" not in fusione.modifiche


def test_prima_eta_dichiarata_sostituisce_il_18_predefinito() -> None:
    fusione = fondi(_esistente(), _nuovo(eta_minima=16))
    assert fusione.modifiche["eta_minima"] == 16
    assert fusione.modifiche["eta_minima_dichiarata"] is True


def test_eta_non_dichiarata_non_cambia_nulla() -> None:
    assert "eta_minima" not in fondi(_esistente(), _nuovo()).modifiche


def test_alcol_se_una_fonte_lo_indica() -> None:
    assert fondi(_esistente(), _nuovo(riferimenti_alcol=True)).modifiche["riferimenti_alcol"]
    fusione = fondi(_esistente(riferimenti_alcol=True), _nuovo(riferimenti_alcol=False))
    assert "riferimenti_alcol" not in fusione.modifiche


def test_fonte_meno_affidabile_non_cambia_i_testi() -> None:
    fusione = fondi(_esistente(), _nuovo(TipoOrigine.INSTAGRAM, titolo="NOTTE FERROVIA!!"))
    assert "titolo" not in fusione.modifiche


def test_fonte_piu_affidabile_aggiorna_i_testi() -> None:
    fusione = fondi(
        _esistente(priorita_migliore=3),
        _nuovo(titolo="Notte Ferrovia (sala grande)", prezzo_min_centesimi=1500),
    )
    assert fusione.modifiche["titolo"] == "Notte Ferrovia (sala grande)"
    assert fusione.modifiche["prezzo_min_centesimi"] == 1500


def test_unione_di_generi_e_artisti() -> None:
    fusione = fondi(
        _esistente(), _nuovo(generi=("house", "techno"), artisti=("DJ Nera Vale", "Otto Fili"))
    )
    assert fusione.generi == ("techno", "house")
    assert fusione.modifiche["artisti"] == ["Nera Vale", "Otto Fili"]


def test_spostamento_oltre_due_ore_va_al_moderatore() -> None:
    nuovo = _nuovo(inizio=INIZIO + timedelta(hours=3))
    fusione = fondi(_esistente(), nuovo)
    assert fusione.modifica_rilevante == "Modifica rilevante: inizio spostato di 3.0 ore"
    assert fondi(_esistente(), nuovo, consenti_rilevanti=True).modifiche["inizio"] == nuovo.inizio


def test_cambio_di_locale_va_al_moderatore() -> None:
    nuovo = _nuovo(locale=LocaleEvento(id=uuid4(), nome="Altro"))
    assert fondi(_esistente(), nuovo).modifica_rilevante == "Modifica rilevante: locale diverso"
    assert "locale_id" in fondi(_esistente(), nuovo, consenti_rilevanti=True).modifiche
