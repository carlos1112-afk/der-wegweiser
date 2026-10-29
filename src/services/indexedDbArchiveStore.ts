import type { ArchiveEntry, ArchiveStore } from './routeArchiveService';
const DATABASE = 'wegweiser-route-archive-v1';
export class IndexedDbArchiveStore implements ArchiveStore {
  private database: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;
  private async open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Dauerhafter Gerätespeicher ist nicht verfügbar.')); return; }
      const request = indexedDB.open(DATABASE, 1);
      let rejected = false;
      request.onupgradeneeded = () => { const store = request.result.createObjectStore('entries', { keyPath: 'key' }); store.createIndex('ownerId', 'ownerId'); };
      request.onerror = () => { rejected = true; reject(request.error ?? new Error('Archiv konnte nicht geöffnet werden.')); };
      request.onblocked = () => { rejected = true; reject(new Error('Archiv ist durch ein anderes Fenster blockiert.')); };
      request.onsuccess = () => {
        if (rejected) { request.result.close(); return; }
        this.database = request.result;
        this.database.onversionchange = () => { this.database?.close(); this.database = null; };
        resolve(this.database);
      };
    });
    try { return await this.opening; } finally { this.opening = null; }
  }
  async transact(keys: string[], update: (current: (ArchiveEntry | undefined)[]) => ArchiveEntry[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entries', 'readwrite'), store = tx.objectStore('entries');
      let failure: unknown;
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Archivierung nicht abgeschlossen.'));
      tx.onerror = () => { /* onabort reports the transaction failure; never resolve on a request success. */ };
      const current: (ArchiveEntry | undefined)[] = new Array(keys.length); let remaining = keys.length;
      keys.forEach((key, index) => {
        const request = store.get(key);
        request.onsuccess = () => {
          current[index] = request.result; remaining--;
          if (!remaining) {
            try { for (const entry of update(current)) { if (!keys.includes(entry.key)) throw new Error('Ungültiger Archivschlüssel.'); store.put(entry); } }
            catch (error) { failure = error; tx.abort(); }
          }
        };
      });
    });
  }
  async list(ownerId: string): Promise<ArchiveEntry[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entries', 'readonly'); const request = tx.objectStore('entries').index('ownerId').getAll(ownerId);
      let records: ArchiveEntry[] = [];
      request.onsuccess = () => { records = request.result; };
      tx.oncomplete = () => resolve(records); tx.onabort = () => reject(tx.error ?? new Error('Archiv konnte nicht gelesen werden.'));
    });
  }
  async clear(): Promise<void> {
    if (this.opening) { try { await this.opening; } catch { /* A failed open must not prevent an explicit delete attempt. */ } }
    this.database?.close(); this.database = null;
    if (typeof indexedDB === 'undefined') return;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Archivlöschung blockiert. Andere Appfenster schließen.'));
    });
  }
}
