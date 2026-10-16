/**
 * Illustrazioni astratte delle schermate di accesso (design/F-10-accesso): linee della città
 * e forme, nessuna persona e nessun bicchiere. Sono decorative e nascoste ai lettori di schermo.
 */

/** Età non sufficiente: un sole che sorge sull'orizzonte. */
export function IllustrazioneOrizzonte() {
  return (
    <svg className="illustrazione is-bassa" viewBox="0 0 350 180" aria-hidden="true">
      <g fill="none" strokeWidth="1.5">
        <path className="filo" d="M0 150 H350" />
        <path className="filo" d="M0 164 H350" />
        <path className="filo" d="M0 176 H350" />
        <path className="acc" d="M115 150 A60 60 0 0 1 235 150" />
        <path className="tenue" d="M135 150 A40 40 0 0 1 215 150" />
        <path className="tenue" d="M155 150 A20 20 0 0 1 195 150" />
      </g>
    </svg>
  );
}

/** Verifica dell'email: una busta con il punto arancio. */
export function IllustrazioneBusta() {
  return (
    <svg className="illustrazione is-bassa" viewBox="0 0 350 180" aria-hidden="true">
      <g fill="none" strokeWidth="1.5">
        <rect className="tenue" x="95" y="40" width="160" height="104" rx="4" />
        <path className="tenue" d="M95 44 L175 104 L255 44" />
        <path className="filo" d="M0 92 H80" />
        <path className="filo" d="M270 92 H350" />
        <path className="filo" d="M20 112 H70" strokeDasharray="4 6" />
      </g>
      <circle className="acc-pieno" cx="255" cy="44" r="9" />
    </svg>
  );
}

/** Onboarding 1: due gruppi separati, collegati solo dal codice. */
export function IllustrazioneCerchie() {
  return (
    <svg className="illustrazione" viewBox="0 0 350 240" aria-hidden="true">
      <g fill="none" strokeWidth="1.5">
        <path
          className="filo"
          d="M0 60 H350 M0 120 H350 M0 180 H350 M70 0 V240 M175 0 V240 M280 0 V240"
        />
        <circle className="tenue" cx="95" cy="120" r="62" />
        <circle className="tenue" cx="255" cy="120" r="62" />
        <path className="acc" d="M140 120 H210" strokeDasharray="5 5" />
      </g>
      <g className="pieno">
        <circle cx="78" cy="98" r="6" />
        <circle cx="112" cy="104" r="6" />
        <circle cx="88" cy="140" r="6" />
        <circle cx="120" cy="138" r="6" />
        <circle cx="238" cy="100" r="6" />
        <circle cx="270" cy="96" r="6" />
        <circle cx="262" cy="140" r="6" />
      </g>
      <rect className="acc-pieno" x="166" y="111" width="18" height="18" rx="2" />
    </svg>
  );
}

/** Onboarding 2: un percorso sulla mappa che si cancella dopo 24 ore. */
export function IllustrazionePosizione() {
  return (
    <svg className="illustrazione" viewBox="0 0 350 240" aria-hidden="true">
      <g fill="none" strokeWidth="1.5">
        <path
          className="filo"
          d="M0 50 H350 M0 110 H350 M0 170 H350 M60 0 V240 M150 0 V240 M240 0 V240 M320 0 V240"
        />
        <path className="tenue" d="M40 220 L60 170 H150 V110 H240" strokeDasharray="6 6" />
        <circle className="acc" cx="240" cy="110" r="22" />
        <circle className="acc" cx="240" cy="110" r="40" opacity="0.4" />
      </g>
      <circle className="acc-pieno" cx="240" cy="110" r="8" />
      <rect className="sup" x="262" y="150" width="70" height="26" rx="4" />
      <text x="297" y="168" textAnchor="middle">
        24 h
      </text>
    </svg>
  );
}

/** Onboarding 3: schede con la bandiera della segnalazione e un riquadro nascosto. */
export function IllustrazioneSegnala() {
  return (
    <svg className="illustrazione" viewBox="0 0 350 240" aria-hidden="true">
      <g strokeWidth="1.5">
        <rect className="sup" x="40" y="40" width="120" height="70" rx="6" />
        <rect className="sup" x="190" y="40" width="120" height="70" rx="6" />
        <rect className="sup" x="40" y="130" width="120" height="70" rx="6" />
        <rect
          className="tenue"
          x="190"
          y="130"
          width="120"
          height="70"
          rx="6"
          fill="none"
          strokeDasharray="5 5"
        />
        <path className="tenue" d="M200 140 L300 190" fill="none" />
        <path
          className="acc"
          d="M70 60 V95 M70 60 H100 L94 68 L100 76 H70"
          fill="none"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
