import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '@/components/ui/Toast';
import {
  applicaAggiornamento,
  controllaPeriodicamente,
  osservaAggiornamento,
} from '@/lib/aggiornamento';

/** Bersaglio di eventi minimo per simulare registrazione, worker e documento. */
class Bersaglio extends EventTarget {}

class WorkerFinto extends Bersaglio {
  state: ServiceWorkerState = 'installing';
  postMessage = vi.fn();
  cambiaStato(stato: ServiceWorkerState) {
    this.state = stato;
    this.dispatchEvent(new Event('statechange'));
  }
}

class RegistrazioneFinta extends Bersaglio {
  waiting: ServiceWorker | null = null;
  installing: ServiceWorker | null = null;
  update = vi.fn(() => Promise.resolve(this as unknown as ServiceWorkerRegistration));
}

const comeWorker = (w: WorkerFinto) => w as unknown as ServiceWorker;
const CONTROLLER = {} as ServiceWorker;

describe('osservaAggiornamento', () => {
  it('avvisa se all’avvio c’è già una versione in attesa', () => {
    const registrazione = new RegistrazioneFinta();
    const nuovo = comeWorker(new WorkerFinto());
    registrazione.waiting = nuovo;
    const suDisponibile = vi.fn();
    osservaAggiornamento(registrazione, { controller: CONTROLLER }, suDisponibile);
    expect(suDisponibile).toHaveBeenCalledWith(nuovo);
  });

  it('avvisa quando la versione trovata finisce di installarsi', () => {
    const registrazione = new RegistrazioneFinta();
    const nuovo = new WorkerFinto();
    const suDisponibile = vi.fn();
    osservaAggiornamento(registrazione, { controller: CONTROLLER }, suDisponibile);

    registrazione.installing = comeWorker(nuovo);
    registrazione.dispatchEvent(new Event('updatefound'));
    expect(suDisponibile).not.toHaveBeenCalled();

    registrazione.installing = null;
    registrazione.waiting = comeWorker(nuovo);
    nuovo.cambiaStato('installed');
    expect(suDisponibile).toHaveBeenCalledTimes(1);
    expect(suDisponibile).toHaveBeenCalledWith(nuovo);
  });

  it('non avvisa alla prima installazione, senza una versione che controlla la pagina', () => {
    const registrazione = new RegistrazioneFinta();
    const nuovo = new WorkerFinto();
    const suDisponibile = vi.fn();
    osservaAggiornamento(registrazione, { controller: null }, suDisponibile);

    registrazione.installing = comeWorker(nuovo);
    registrazione.dispatchEvent(new Event('updatefound'));
    registrazione.waiting = comeWorker(nuovo);
    nuovo.cambiaStato('installed');
    expect(suDisponibile).not.toHaveBeenCalled();
  });

  it('smette di osservare dopo la pulizia', () => {
    const registrazione = new RegistrazioneFinta();
    const nuovo = new WorkerFinto();
    const suDisponibile = vi.fn();
    const smetti = osservaAggiornamento(registrazione, { controller: CONTROLLER }, suDisponibile);
    registrazione.installing = comeWorker(nuovo);
    registrazione.dispatchEvent(new Event('updatefound'));
    smetti();

    registrazione.waiting = comeWorker(nuovo);
    nuovo.cambiaStato('installed');
    registrazione.dispatchEvent(new Event('updatefound'));
    expect(suDisponibile).not.toHaveBeenCalled();
  });
});

describe('controllaPeriodicamente', () => {
  afterEach(() => vi.useRealTimers());

  it('controlla quando l’app torna visibile e a intervalli, non quando va in secondo piano', () => {
    vi.useFakeTimers();
    const registrazione = new RegistrazioneFinta();
    const documento = Object.assign(new Bersaglio(), {
      visibilityState: 'hidden' as DocumentVisibilityState,
    });
    const smetti = controllaPeriodicamente(registrazione, documento, 1000);

    documento.dispatchEvent(new Event('visibilitychange'));
    expect(registrazione.update).not.toHaveBeenCalled();

    documento.visibilityState = 'visible';
    documento.dispatchEvent(new Event('visibilitychange'));
    expect(registrazione.update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(registrazione.update).toHaveBeenCalledTimes(2);

    smetti();
    vi.advanceTimersByTime(5000);
    documento.dispatchEvent(new Event('visibilitychange'));
    expect(registrazione.update).toHaveBeenCalledTimes(2);
  });

  it('ignora gli errori del controllo (per esempio offline)', async () => {
    const registrazione = new RegistrazioneFinta();
    registrazione.update.mockRejectedValueOnce(new TypeError('offline'));
    const documento = Object.assign(new Bersaglio(), {
      visibilityState: 'visible' as DocumentVisibilityState,
    });
    const smetti = controllaPeriodicamente(registrazione, documento);
    documento.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(registrazione.update).toHaveBeenCalledTimes(1);
    smetti();
  });
});

describe('applicaAggiornamento', () => {
  it('chiede l’attivazione e ricarica una volta sola al cambio di controller', () => {
    const contenitore = new Bersaglio();
    const nuovo = new WorkerFinto();
    const ricarica = vi.fn();
    applicaAggiornamento(nuovo, contenitore, ricarica);

    expect(nuovo.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(ricarica).not.toHaveBeenCalled();
    contenitore.dispatchEvent(new Event('controllerchange'));
    contenitore.dispatchEvent(new Event('controllerchange'));
    expect(ricarica).toHaveBeenCalledTimes(1);
  });
});

describe('Toast persistente', () => {
  afterEach(() => vi.useRealTimers());

  it('con durata null non si chiude da solo e si chiude con il pulsante', () => {
    vi.useFakeTimers();
    const onChiudi = vi.fn();
    render(
      <Toast
        testo="È disponibile una nuova versione di Noxa."
        durata={null}
        chiudibile
        onChiudi={onChiudi}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onChiudi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onChiudi).toHaveBeenCalledTimes(1);
  });

  it('senza chiudibile non mostra il pulsante per chiudere', () => {
    render(<Toast testo="Fatto" onChiudi={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Chiudi' })).toBeNull();
  });
});
