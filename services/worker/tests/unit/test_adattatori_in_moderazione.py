"""Ogni adattatore registrato nel worker si può scegliere nell'area di moderazione: la scheda
della fonte ha l'elenco scritto nel codice dell'app, con un'etichetta per ognuno."""

from pathlib import Path

from pydantic import SecretStr

from noxa_worker.configurazione import Impostazioni
from noxa_worker.fonti.registro import crea_registro

RADICE = Path(__file__).resolve().parents[4]
SCHEDA = RADICE / "apps/web/src/features/moderazione/SchedaFonte.tsx"
MESSAGGI = RADICE / "apps/web/src/lib/messaggi/moderazione.ts"


def test_ogni_adattatore_registrato_e_sceglibile() -> None:
    impostazioni = Impostazioni(
        ambiente="locale", worker_database_url=SecretStr("postgresql://x@127.0.0.1/x")
    )
    scheda, messaggi = SCHEDA.read_text(), MESSAGGI.read_text()
    for nome in crea_registro(impostazioni):
        assert f"'{nome}'" in scheda, f"{nome} manca in SchedaFonte.tsx"
        assert f"{nome}: '" in messaggi, f"{nome} senza etichetta in moderazione.ts"
