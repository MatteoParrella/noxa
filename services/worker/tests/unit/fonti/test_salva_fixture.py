"""Pulizia delle pagine salvate come fixture."""

from noxa_worker.fonti.salva_fixture import senza_script


def test_toglie_script_e_attributi_on_ma_tiene_il_json_ld() -> None:
    html = (
        "<html><head><script>alert(1)</script>"
        '<script type="application/ld+json">{"@type": "Event"}</script>'
        '<script src="https://esempio.it/a.js"></script></head>'
        '<body onload="x()"><noscript><img src="p.gif"></noscript>'
        '<a href="/e" onclick="y()">Serata</a></body></html>'
    )
    pulita = senza_script(html)
    assert "alert" not in pulita
    assert "a.js" not in pulita
    assert "onload" not in pulita
    assert "onclick" not in pulita
    assert "p.gif" not in pulita
    assert '{"@type": "Event"}' in pulita
    assert '<a href="/e">Serata</a>' in pulita
