"""Gli adattatori fanno richieste solo con ClientHttpConforme (EVENT_INGESTION.md §4)."""

import ast
from pathlib import Path

import pytest

CARTELLA_FONTI = Path(__file__).parents[2] / "src/noxa_worker/fonti"
VIETATI = {"httpx", "playwright", "requests", "urllib.request", "aiohttp", "socket"}
# Solo il client conforme usa httpx direttamente.
AMMESSI = {"http.py"}


def _moduli_importati(percorso: Path) -> set[str]:
    albero = ast.parse(percorso.read_text(encoding="utf-8"))
    moduli: set[str] = set()
    for nodo in ast.walk(albero):
        if isinstance(nodo, ast.Import):
            moduli.update(alias.name for alias in nodo.names)
        elif isinstance(nodo, ast.ImportFrom) and nodo.module:
            moduli.add(nodo.module)
    return moduli


@pytest.mark.parametrize(
    "modulo",
    sorted(p for p in CARTELLA_FONTI.glob("*.py") if p.name not in AMMESSI),
    ids=lambda p: p.name,
)
def test_nessuna_richiesta_http_fuori_dal_client_conforme(modulo: Path) -> None:
    importati = _moduli_importati(modulo)
    vietati = {m for m in importati if m in VIETATI or m.split(".")[0] in VIETATI}
    assert not vietati, f"{modulo.name} importa {sorted(vietati)}: usa ClientHttpConforme"


def test_il_controllo_trova_i_moduli() -> None:
    assert len(list(CARTELLA_FONTI.glob("*.py"))) > 3
