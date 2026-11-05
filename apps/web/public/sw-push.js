// Gestori del Web Push (F-22, ADR-0026). In produzione il service worker di Workbox li carica
// con importScripts (scripts/genera-sw.mjs); in sviluppo si registra da solo, solo per la push.
// Il contenuto arriva cifrato e contiene solo il testo di sistema, il tipo e l'identificativo
// della notifica: mai nomi, username o testi di altre persone.

self.addEventListener('push', (evento) => {
  let dati = {};
  try {
    dati = evento.data ? evento.data.json() : {};
  } catch {
    dati = {};
  }
  const titolo = typeof dati.titolo === 'string' ? dati.titolo : 'Noxa';
  const notifica = typeof dati.notifica === 'string' ? dati.notifica : '';
  evento.waitUntil(
    self.registration.showNotification(titolo, {
      body: typeof dati.testo === 'string' ? dati.testo : '',
      icon: '/icone/icona-192.png',
      badge: '/icone/icona-192.png',
      lang: 'it',
      tag: notifica || undefined,
      data: { notifica },
    }),
  );
});

// Il tocco apre l'elenco delle notifiche, che porta alla schermata giusta oppure dice che
// l'oggetto non è più disponibile (design/F-22-notifiche §3).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const id = evento.notification.data && evento.notification.data.notifica;
  const percorso = id ? `/notifiche/?apri=${encodeURIComponent(id)}` : '/notifiche/';
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((finestre) => {
      const finestra = finestre.find((f) => 'navigate' in f);
      // navigate funziona solo sulle finestre controllate da questo service worker: se non
      // riesce, si apre una finestra nuova.
      if (!finestra) return self.clients.openWindow(percorso);
      return finestra
        .navigate(percorso)
        .then((aperta) => (aperta || finestra).focus())
        .catch(() => self.clients.openWindow(percorso));
    }),
  );
});
