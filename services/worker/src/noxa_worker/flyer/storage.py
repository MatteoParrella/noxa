"""Client asincrono per Supabase Storage con la chiave service_role.

Usato dal worker solo per i bucket dei flyer (ADR-0003, CLAUDE.md):
la chiave non va mai nel codice dell'app né in variabili NEXT_PUBLIC_*.
"""

from __future__ import annotations

import json as _json

import httpx
import structlog

log = structlog.get_logger(__name__)

_TIMEOUT_SCARICA = 60.0
_TIMEOUT_CARICA = 120.0
_TIMEOUT_ELIMINA = 30.0


class ClientStorage:
    """Accede a Supabase Storage con la chiave service_role (bucket privati)."""

    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._base = supabase_url.rstrip("/") + "/storage/v1"
        self._headers = {
            "Authorization": f"Bearer {service_role_key}",
            "apikey": service_role_key,
        }

    async def scarica(self, bucket: str, percorso: str) -> bytes:
        """Scarica un oggetto dal bucket privato."""
        url = f"{self._base}/object/{bucket}/{percorso}"
        async with httpx.AsyncClient(timeout=_TIMEOUT_SCARICA) as client:
            risposta = await client.get(url, headers=self._headers)
            risposta.raise_for_status()
            return risposta.content

    async def carica(
        self, bucket: str, percorso: str, dati: bytes, mime: str = "image/webp"
    ) -> None:
        """Carica un oggetto nel bucket; sovrascrive se esiste già."""
        url = f"{self._base}/object/{bucket}/{percorso}"
        async with httpx.AsyncClient(timeout=_TIMEOUT_CARICA) as client:
            risposta = await client.post(
                url,
                headers={**self._headers, "Content-Type": mime},
                content=dati,
            )
            if risposta.status_code == 400 and b"already exist" in risposta.content:
                # Sovrascrive con PUT se il file esiste già.
                risposta = await client.put(
                    url,
                    headers={**self._headers, "Content-Type": mime},
                    content=dati,
                )
            risposta.raise_for_status()

    async def elimina(self, bucket: str, percorsi: list[str]) -> None:
        """Elimina uno o più oggetti dal bucket."""
        if not percorsi:
            return
        url = f"{self._base}/object/{bucket}"
        corpo = _json.dumps({"prefixes": percorsi}).encode()
        async with httpx.AsyncClient(timeout=_TIMEOUT_ELIMINA) as client:
            risposta = await client.request(
                "DELETE",
                url,
                headers={**self._headers, "Content-Type": "application/json"},
                content=corpo,
            )
            risposta.raise_for_status()
