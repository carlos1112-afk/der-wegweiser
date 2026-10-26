import { auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

interface DeleteAccountResult {
  success: boolean;
  status: 'completed';
  jobId: string;
}

export class AccountDeletionService {
  /**
   * Deletes the account only after the privileged server workflow confirms that
   * all user-owned cloud data and uploads were removed. Suspended users are
   * handled by the Admin SDK on the server, not by client Firestore rules.
   */
  public static async deleteAccount(): Promise<void> {
    const currentUser = auth.currentUser;

    if (currentUser) {
      if (!functions) {
        throw new Error('Kontolöschung ist derzeit nicht verfügbar. Bitte versuche es später erneut.');
      }

      try {
        const deleteAccountData = httpsCallable<unknown, DeleteAccountResult>(functions, 'deleteAccountData');
        const result = await deleteAccountData({});
        if (!result.data?.success || result.data.status !== 'completed') {
          throw new Error('Die Kontodaten konnten noch nicht vollständig gelöscht werden.');
        }
      } catch (error: any) {
        if (error?.code === 'functions/unauthenticated') {
          throw new Error('Bitte melde dich erneut an, um die Kontolöschung zu bestätigen.');
        }
        if (error instanceof Error && error.message.includes('nicht vollständig')) throw error;
        throw new Error('Die Kontolöschung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
      }
    }

    await this.clearLocalData();
  }

  private static async clearLocalData(): Promise<void> {
    try {
      localStorage.clear();
      sessionStorage.clear();

      if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
        const cacheStorage = window.caches;
        const cacheNames = await cacheStorage.keys();
        await Promise.all(cacheNames.map((name) => cacheStorage.delete(name)));
      }

      if ('indexedDB' in window) {
        const dbs = await window.indexedDB.databases?.();
        if (dbs) {
          await Promise.all(
            dbs
              .filter((dbInfo) => !!dbInfo.name)
              .map(
                (dbInfo) =>
                  new Promise<void>((resolve) => {
                    const req = window.indexedDB.deleteDatabase(dbInfo.name!);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                  })
              )
          );
        }
      }
    } catch (error) {
      console.warn('[AccountDeletionService] Local storage clear error:', error);
    }
  }
}
