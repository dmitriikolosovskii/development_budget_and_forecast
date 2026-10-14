import { autosaveQueue, AUTOSAVE_DELAY_MS } from './autosave-queue';
import { useToastStore } from './toast-store';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function opts(send = vi.fn().mockResolvedValue('ok')) {
  return { send, onSuccess: vi.fn(), rollback: vi.fn() };
}

describe('autosaveQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    autosaveQueue.__reset();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    autosaveQueue.__reset();
    vi.useRealTimers();
  });

  it('should send one merged patch 400 ms after the last change [AC-02.4]', async () => {
    const o = opts();
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, o);
    await vi.advanceTimersByTimeAsync(300);
    autosaveQueue.enqueue('item:a', { qtyMilli: 2, name: 'x' }, o);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
    expect(o.send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(o.send).toHaveBeenCalledTimes(1);
    expect(o.send).toHaveBeenCalledWith({ qtyMilli: 2, name: 'x' });
    expect(o.onSuccess).toHaveBeenCalledWith('ok');
  });

  it('should send immediately when flushed, without waiting for the debounce [AC-02.5]', async () => {
    const o = opts();
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, o);

    await autosaveQueue.flush();

    expect(o.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(o.send).toHaveBeenCalledTimes(1);
  });

  it('should run saves for one key strictly one after another [AC-02.11]', async () => {
    const first = deferred<string>();
    const send = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('second');
    const o = opts(send);
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, o);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosaveQueue.enqueue('item:a', { qtyMilli: 2 }, o);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 3);
    expect(send).toHaveBeenCalledTimes(1);

    first.resolve('first');
    await vi.advanceTimersByTimeAsync(0);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ qtyMilli: 2 });
  });

  it('should not make different keys wait for each other [AC-02.11]', async () => {
    const slow = opts(vi.fn().mockReturnValue(new Promise(() => undefined)));
    const fast = opts();
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, slow);
    autosaveQueue.enqueue('item:b', { qtyMilli: 1 }, fast);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(fast.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('should report the newer queued patch as unconfirmed when an older save succeeds [AC-02.12]', async () => {
    const first = deferred<string>();
    const send = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('second');
    let seenInSuccess: object | undefined;
    const o = { send, rollback: vi.fn(), onSuccess: () => (seenInSuccess = autosaveQueue.unconfirmed('item:a')) };
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, o);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosaveQueue.enqueue('item:a', { name: 'newer' }, o);
    expect(autosaveQueue.unconfirmed('item:a')).toEqual({ qtyMilli: 1, name: 'newer' });

    first.resolve('first');
    await vi.advanceTimersByTimeAsync(0);

    expect(seenInSuccess).toEqual({ name: 'newer' });
  });

  it('should roll back, drop queued patches and show a toast when a save fails [AC-02.13]', async () => {
    const first = deferred<string>();
    const send = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue('never');
    const o = opts(send);
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, o);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosaveQueue.enqueue('item:a', { qtyMilli: 2 }, o);

    first.reject(new Error('Server said no'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

    expect(o.rollback).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(autosaveQueue.unconfirmed('item:a')).toBeUndefined();
    expect(useToastStore.getState().toasts[0]?.text).toContain('Server said no');
  });

  it('should use the latest opts for a key', async () => {
    const old = opts();
    const latest = opts();
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, old);
    autosaveQueue.enqueue('item:a', { qtyMilli: 2 }, latest);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(old.send).not.toHaveBeenCalled();
    expect(latest.send).toHaveBeenCalledWith({ qtyMilli: 2 });
  });

  it('should list every unconfirmed key for the refetch overlay [AC-02.14]', () => {
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, opts());
    autosaveQueue.enqueue('line:l1', { approvedCents: 5 }, opts());

    expect(autosaveQueue.unconfirmedAll()).toEqual([
      ['item:a', { qtyMilli: 1 }],
      ['line:l1', { approvedCents: 5 }],
    ]);
  });

  it('should forget a key on discard without sending it', async () => {
    const o = opts();
    autosaveQueue.enqueue('item:a', { qtyMilli: 1 }, o);

    autosaveQueue.discard('item:a');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(o.send).not.toHaveBeenCalled();
    expect(autosaveQueue.has('item:a')).toBe(false);
  });
});
