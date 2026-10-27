import { auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { ConsentService } from './consentService';
interface DeleteAccountResult { success: boolean; status: 'completed'; jobId: string }
export class AccountDeletionService {
  static async deleteAccount(): Promise<void> {
    if (auth.currentUser) {
      if (!functions) throw new Error('Kontolöschung ist derzeit nicht verfügbar. Bitte erneut versuchen.');
      try {
        const call = httpsCallable<unknown, DeleteAccountResult>(functions, 'deleteAccountData');
        const result = await call({});
        if (!result.data?.success || result.data.status !== 'completed') throw new Error('Die Kontodaten konnten noch nicht vollständig gelöscht werden.');
      } catch (error: any) {
        if (error?.code === 'functions/unauthenticated') throw new Error('Bitte erneut anmelden, um die Kontolöschung zu bestätigen.');
        if (error instanceof Error && error.message.includes('nicht vollständig')) throw error;
        throw new Error('Die Kontolöschung konnte nicht abgeschlossen werden. Bitte erneut versuchen.');
      }
    }
    await this.clearLocalData();
  }
  private static async clearLocalData(): Promise<void> {
    const failures: string[] = [];
    const attempt = async (name: string, action: () => void | Promise<unknown>) => {
      try { await action(); } catch { failures.push(name); }
    };
    let consentCleaned = false;
    await attempt('Einwilligung/aktive Dienste', async () => { consentCleaned = await ConsentService.withdraw(); if (!consentCleaned) throw new Error('cleanup incomplete'); });
    if (!consentCleaned) {
      await attempt('Lokaler Speicher', () => localStorage.clear());
      await attempt('Sitzungsspeicher', () => sessionStorage.clear());
    }
    if (typeof window !== 'undefined' && window.caches) {
      await attempt('Caches', async () => {
        const names = await window.caches.keys();
        const results = await Promise.allSettled(names.map(name => window.caches.delete(name)));
        if (results.some(result => result.status === 'rejected')) throw new Error('cache cleanup incomplete');
      });
    }
    if (typeof window !== 'undefined' && window.indexedDB) {
      await attempt('IndexedDB', async () => {
        if (!window.indexedDB.databases) throw new Error('database enumeration unavailable');
        const databases = await window.indexedDB.databases();
        const results = await Promise.allSettled(databases.filter(database => !!database.name).map(database => new Promise<void>((resolve, reject) => {
          const request = window.indexedDB.deleteDatabase(database.name!);
          const timer = setTimeout(() => reject(new Error('database deletion timed out')), 5000);
          request.onsuccess = () => { clearTimeout(timer); resolve(); };
          request.onerror = () => { clearTimeout(timer); reject(new Error('database deletion failed')); };
          request.onblocked = () => { clearTimeout(timer); reject(new Error('database deletion blocked')); };
        })));
        if (results.some(result => result.status === 'rejected')) throw new Error('database cleanup incomplete');
      });
    }
    if (failures.length) throw new Error(`Lokale Löschung nicht vollständig: ${failures.join(', ')}. Bitte erneut versuchen.`);
  }
}
