import { it, expect, vi, afterEach } from 'vitest';
import { IndexedDbArchiveStore } from '../../src/services/indexedDbArchiveStore';
function databaseHarness() {
  const transactions: any[] = [], closed = vi.fn();
  const database = { close: closed, transaction: () => {
    const tx: any = { error: null };
    const store = { get: (_key: string) => { const request: any = { result: undefined }; queueMicrotask(() => request.onsuccess?.()); return request; }, put: vi.fn() };
    tx.objectStore = () => store; tx.abort = () => queueMicrotask(() => tx.onabort?.()); tx.store = store;
    transactions.push(tx); return tx;
  } };
  vi.stubGlobal('indexedDB', { open: () => { const request: any = { result: database }; queueMicrotask(() => request.onsuccess?.()); return request; },
    deleteDatabase: () => { const request: any = {}; queueMicrotask(() => request.onsuccess?.()); return request; } });
  return { transactions, closed };
}
afterEach(() => vi.unstubAllGlobals());
it('acknowledges a save only after transaction commit, not after an individual request', async () => {
  const { transactions } = databaseHarness(), storage = new IndexedDbArchiveStore(); let saved = false;
  const promise = storage.transact(['k'], () => [{ key: 'k', kind: 'plan' } as any]).then(() => { saved = true; });
  await vi.waitFor(() => expect(transactions[0]?.store.put).toHaveBeenCalled());
  expect(saved).toBe(false); transactions[0].oncomplete(); await promise; expect(saved).toBe(true);
});
it('rejects transaction abort/quota failure instead of reporting a stored route', async () => {
  const { transactions } = databaseHarness(), storage = new IndexedDbArchiveStore();
  const promise = storage.transact(['k'], () => [{ key: 'k' } as any]);
  const rejected = expect(promise).rejects.toThrow('quota');
  await vi.waitFor(() => expect(transactions[0]?.store.put).toHaveBeenCalled());
  transactions[0].error = new Error('quota'); transactions[0].onabort(); await rejected;
});
it('aborts when the caller attempts to mutate outside the requested keys', async () => {
  databaseHarness(); const storage = new IndexedDbArchiveStore();
  await expect(storage.transact(['owned'], () => [{ key: 'foreign' } as any])).rejects.toThrow('Ungültiger Archivschlüssel');
});
