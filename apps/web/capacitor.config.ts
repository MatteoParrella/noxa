import type { CapacitorConfig } from '@capacitor/cli';

// App iOS e Android con lo stesso export statico della PWA (ADR-0001). L'identificativo segue
// il dominio di lavoro noxa.app (D-01): va confermato prima della prima pubblicazione negli
// store, dopo non si può più cambiare.
const configurazione: CapacitorConfig = {
  appId: 'app.noxa',
  appName: 'Noxa',
  webDir: 'out',
  backgroundColor: '#0E1116',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default configurazione;
