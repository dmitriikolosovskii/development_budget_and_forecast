import { showToast } from './toast-store';

export const AUTOSAVE_DELAY_MS = 400;

type Patch = Record<string, unknown>;

export interface EnqueueOptions<T> {
  /** Sends the merged patch; must reject on failure. */
  send: (merged: Patch) => Promise<T>;
  /** Called with the server response. `unconfirmed(key)` then holds only patches newer than this save. */
  onSuccess: (res: T) => void;
  /** Called on failure after the queued patches for the key were dropped. */
  rollback: () => void;
}

interface KeyState {
  queued: Patch | null;
  inFlight: Patch | null;
  timer: ReturnType<typeof setTimeout> | null;
  running: Promise<void> | null;
  // The latest opts for a key win (CONTRACTS §6).
  opts: EnqueueOptions<unknown>;
}

const states = new Map<string, KeyState>();

function clearTimer(s: KeyState): void {
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
}

function cleanup(key: string, s: KeyState): void {
  if (!s.queued && !s.inFlight && !s.timer && !s.running && states.get(key) === s) states.delete(key);
}

/** Sends the queued patch for a key; saves for one key run strictly one after another. */
function run(key: string): Promise<void> {
  const s = states.get(key);
  if (!s) return Promise.resolve();
  clearTimer(s);
  if (s.running) return s.running.then(() => run(key));
  if (!s.queued) {
    cleanup(key, s);
    return Promise.resolve();
  }
  const patch = s.queued;
  s.queued = null;
  s.inFlight = patch;
  s.running = s.opts.send(patch).then(
    (res) => {
      s.inFlight = null;
      s.running = null;
      s.opts.onSuccess(res);
      cleanup(key, s);
    },
    (error: unknown) => {
      s.inFlight = null;
      s.running = null;
      s.queued = null;
      clearTimer(s);
      s.opts.rollback();
      cleanup(key, s);
      const reason = error instanceof Error ? error.message : 'unknown error';
      showToast(`Changes were not saved and have been reverted: ${reason}`, 'risk');
    },
  );
  return s.running;
}

/**
 * Module singleton that coalesces edits per key and saves them 400 ms after the last change.
 * Flushed on blur, route change and beforeunload (AppShell).
 */
export const autosaveQueue = {
  enqueue<T>(key: string, patch: Patch, opts: EnqueueOptions<T>): void {
    let s = states.get(key);
    if (!s) {
      s = { queued: null, inFlight: null, timer: null, running: null, opts: opts as EnqueueOptions<unknown> };
      states.set(key, s);
    }
    s.opts = opts as EnqueueOptions<unknown>;
    s.queued = { ...(s.queued ?? {}), ...patch };
    clearTimer(s);
    s.timer = setTimeout(() => void run(key), AUTOSAVE_DELAY_MS);
  },

  /** Sends every pending patch now; resolves when all of them have settled. */
  flush(key?: string): Promise<void> {
    const keys = key ? [key] : [...states.keys()];
    return Promise.all(keys.map(run)).then(() => undefined);
  },

  /** True while a key has a queued or in-flight patch. */
  has(key: string): boolean {
    const s = states.get(key);
    return !!s && (!!s.queued || !!s.inFlight);
  },

  /** In-flight and queued patches for a key, merged; undefined when everything is confirmed. */
  unconfirmed(key: string): Patch | undefined {
    const s = states.get(key);
    if (!s || (!s.queued && !s.inFlight)) return undefined;
    return { ...(s.inFlight ?? {}), ...(s.queued ?? {}) };
  },

  unconfirmedAll(): Array<[string, Patch]> {
    const out: Array<[string, Patch]> = [];
    for (const key of states.keys()) {
      const patch = autosaveQueue.unconfirmed(key);
      if (patch) out.push([key, patch]);
    }
    return out;
  },

  /** Drops queued (not in-flight) patches for a key, e.g. when the row is deleted. */
  discard(key: string): void {
    const s = states.get(key);
    if (!s) return;
    clearTimer(s);
    s.queued = null;
    cleanup(key, s);
  },

  /** Test-only: forget every key and timer. */
  __reset(): void {
    for (const s of states.values()) clearTimer(s);
    states.clear();
  },
};
