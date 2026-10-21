"""Lettura dei feed iCal (RFC 5545) pubblicati dai siti dei locali: solo gli eventi
(`VEVENT`) e solo i campi dello schema evento."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from noxa_worker.normalizzazione.date import FUSO_ROMA

_DATA_ORA = re.compile(r"^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$")


@dataclass(frozen=True)
class EventoIcal:
    uid: str | None
    titolo: str | None
    inizio: datetime | date | None
    fine: datetime | date | None
    descrizione: str | None
    url: str | None
    annullato: bool


def e_ical(testo: str) -> bool:
    return testo.lstrip("﻿ \r\n\t").upper().startswith("BEGIN:VCALENDAR")


def leggi_ical(testo: str) -> list[EventoIcal]:
    """Eventi del calendario; righe ripiegate e caratteri di escape gestiti."""
    eventi: list[EventoIcal] = []
    corrente: dict[str, tuple[dict[str, str], str]] | None = None
    for riga in _srotola(testo):
        nome, parametri, valore = _dividi(riga)
        if nome == "BEGIN" and valore.upper() == "VEVENT":
            corrente = {}
        elif nome == "END" and valore.upper() == "VEVENT" and corrente is not None:
            eventi.append(_evento(corrente))
            corrente = None
        elif corrente is not None and nome not in corrente:
            corrente[nome] = (parametri, valore)
    return eventi


def _srotola(testo: str) -> list[str]:
    righe: list[str] = []
    for riga in testo.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if riga.startswith((" ", "\t")) and righe:
            righe[-1] += riga[1:]
        elif riga:
            righe.append(riga)
    return righe


def _dividi(riga: str) -> tuple[str, dict[str, str], str]:
    testa, _, valore = riga.partition(":")
    pezzi = testa.split(";")
    parametri: dict[str, str] = {}
    for pezzo in pezzi[1:]:
        chiave, _, val = pezzo.partition("=")
        parametri[chiave.upper()] = val.strip('"')
    return pezzi[0].upper(), parametri, valore


def _testo(valore: str) -> str:
    return (
        valore.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
    )


def _data(parametri: dict[str, str], valore: str) -> datetime | date | None:
    trovato = _DATA_ORA.match(valore.strip())
    if not trovato:
        return None
    anno, mese, giorno, ore, minuti, secondi, utc = trovato.groups()
    try:
        if ore is None or parametri.get("VALUE", "").upper() == "DATE":
            return date(int(anno), int(mese), int(giorno))
        fuso: tzinfo = UTC if utc else FUSO_ROMA
        if not utc and "TZID" in parametri:
            try:
                fuso = ZoneInfo(parametri["TZID"])
            except (ZoneInfoNotFoundError, ValueError):
                fuso = FUSO_ROMA
        return datetime(
            int(anno),
            int(mese),
            int(giorno),
            int(ore),
            int(minuti),
            int(secondi or 0),
            tzinfo=fuso,
        )
    except ValueError:
        return None


def _evento(campi: dict[str, tuple[dict[str, str], str]]) -> EventoIcal:
    def testo(nome: str) -> str | None:
        voce = campi.get(nome)
        return _testo(voce[1]).strip() or None if voce else None

    def data(nome: str) -> datetime | date | None:
        voce = campi.get(nome)
        return _data(*voce) if voce else None

    return EventoIcal(
        uid=testo("UID"),
        titolo=testo("SUMMARY"),
        inizio=data("DTSTART"),
        fine=data("DTEND"),
        descrizione=testo("DESCRIPTION"),
        url=testo("URL"),
        annullato=(testo("STATUS") or "").upper() == "CANCELLED",
    )
