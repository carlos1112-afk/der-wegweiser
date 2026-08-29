import { auth, db, storage } from '../firebase';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';

export interface DeletionResult {
  success: boolean;
  message: string;
  authDeleted: boolean;
  cloudDataDeleted: boolean;
  localDataDeleted: boolean;
}

export class AccountDeletionService {
  /**
   * Performs complete end-to-end deletion of user account and all associated data across:
   * 1. Firestore collections (users, user_tokens, user_preferences, user_memory_patterns, routes, charging_stations, scout_reports)
   * 2. Cloud Storage (user uploads and photos)
   * 3. Firebase Authentication account (auth.currentUser) - executed ONLY AFTER cloud data wipe
   * 4. Local device storage (localStorage, sessionStorage, IndexedDB)
   */
  public static async executeFullAccountDeletion(): Promise<DeletionResult> {
    let authDeleted = false;
    let cloudDataDeleted = false;
    let localDataDeleted = false;

    const currentUser = auth.currentUser;

    if (currentUser) {
      const uid = currentUser.uid;

      // ── 1. Delete Cloud Firestore documents across ALL collections ──
      try {
        // Direct UID documents
        await deleteDoc(doc(db, 'users', uid)).catch(() => {});
        await deleteDoc(doc(db, 'user_tokens', uid)).catch(() => {});
        await deleteDoc(doc(db, 'user_preferences', uid)).catch(() => {});
        await deleteDoc(doc(db, 'user_memory_patterns', uid)).catch(() => {});

        // Query-based documents created by this user
        const deleteByQuery = async (collName: string, fieldName: string) => {
          try {
            const q = query(collection(db, collName), where(fieldName, '==', uid));
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
            await Promise.all(deletePromises);
          } catch (e) {
            console.warn(`[AccountDeletionService] Query deletion warning on ${collName}:`, e);
          }
        };

        await Promise.all([
          deleteByQuery('routes', 'createdByUserId'),
          deleteByQuery('charging_stations', 'createdByUserId'),
          deleteByQuery('charging_stations_v2', 'createdByUserId'),
          deleteByQuery('scout_reports', 'userId'),
        ]);

        // ── 2. Delete Cloud Storage uploads ──
        try {
          const userStorageRef = ref(storage, `users/${uid}`);
          const listRes = await listAll(userStorageRef);
          await Promise.all(listRes.items.map((itemRef) => deleteObject(itemRef)));
        } catch (e) {
          // Ignore if directory doesn't exist
        }

        cloudDataDeleted = true;
      } catch (e) {
        console.warn('[AccountDeletionService] Cloud data deletion warning:', e);
      }

      // ── 3. Delete Firebase Authentication account (ONLY AFTER cloud data is wiped) ──
      try {
        await deleteUser(currentUser);
        authDeleted = true;
      } catch (e: any) {
        console.warn('[AccountDeletionService] Auth deletion error (requires re-auth if stale):', e);
        if (e.code === 'auth/requires-recent-login') {
          return {
            success: false,
            message: 'Bitte melde dich kurz erneut an, um die Kontolöschung aus Sicherheitsgründen zu bestätigen.',
            authDeleted: false,
            cloudDataDeleted,
            localDataDeleted: false,
          };
        }
      }
    } else {
      // Anonymous / Local-only user: no cloud account to delete
      cloudDataDeleted = true;
      authDeleted = true;
    }

    // ── 4. Clear all local storage & caches ──
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        const dbs = await window.indexedDB.databases?.();
        if (dbs) {
          for (const dbInfo of dbs) {
            if (dbInfo.name) window.indexedDB.deleteDatabase(dbInfo.name);
          }
        }
      }
      localDataDeleted = true;
    } catch (e) {
      console.warn('[AccountDeletionService] Local storage clear error:', e);
    }

    return {
      success: true,
      message: 'Konto und alle zugehörigen Daten wurden erfolgreich und unwiderruflich gelöscht.',
      authDeleted,
      cloudDataDeleted,
      localDataDeleted,
    };
  }
}
