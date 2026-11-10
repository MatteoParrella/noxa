import type { CapacitorConfig } from '@capacitor/cli';

// App iOS e Android con lo stesso export statico della PWA (ADR-0001). L'identificativo segue
// il dominio noxanight.it (D-01) e dopo la prima pubblicazione negli store non si può più
// cambiare.
const configurazione: CapacitorConfig = {
  appId: 'it.noxanight',
  appName: 'Noxa',
  webDir: 'out',
  backgroundColor: '#0E1116',
  ios: { contentInset: 'never' },
  // Bridge legacy: senza, Android ferma la posizione del ritorno sicuro dopo 5 minuti in
  // background (@capacitor-community/background-geolocation, ADR-0028).
  android: { allowMixedContent: false, useLegacyBridge: true },
};

export default configurazione;
