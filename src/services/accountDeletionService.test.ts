import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccountDeletionService } from './accountDeletionService';
import { auth } from '../firebase';
import { deleteUser } from 'firebase/auth';
import { deleteDoc, getDocs } from 'firebase/firestore';
import { listAll, deleteObject } from 'firebase/storage';

// Mock firebase module
vi.mock('../firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('firebase/auth', () => ({
  deleteUser: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockImplementation((db, collection, id) => ({ path: `${collection}/${id}` })),
  deleteDoc: vi.fn(),
  collection: vi.fn().mockImplementation((db, name) => ({ path: name })),
  query: vi.fn().mockImplementation((coll, condition) => ({ coll, condition })),
  where: vi.fn().mockImplementation((field, op, value) => ({ field, op, value })),
  getDocs: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn().mockImplementation((storage, path) => ({ path })),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
}));

describe('AccountDeletionService', () => {
  let mockCachesDelete: ReturnType<typeof vi.fn>;
  let mockIndexedDBDelete: ReturnType<typeof vi.fn>;
  let mockLocalStorageClear: ReturnType<typeof vi.fn>;
  let mockSessionStorageClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Mock User
    auth.currentUser = { uid: 'test-user-123' } as any;

    // Mock Firestore
    (deleteDoc as any).mockResolvedValue(undefined);
    (getDocs as any).mockResolvedValue({
      docs: [
        { ref: 'mock-doc-ref-1' },
        { ref: 'mock-doc-ref-2' }
      ]
    });

    // Mock Storage
    (listAll as any).mockResolvedValue({
      items: ['mock-item-ref-1', 'mock-item-ref-2']
    });
    (deleteObject as any).mockResolvedValue(undefined);

    // Mock Auth
    (deleteUser as any).mockResolvedValue(undefined);

    // Mock Web APIs
    mockLocalStorageClear = vi.fn();
    mockSessionStorageClear = vi.fn();
    vi.stubGlobal('localStorage', { clear: mockLocalStorageClear });
    vi.stubGlobal('sessionStorage', { clear: mockSessionStorageClear });

    mockCachesDelete = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['cache-1', 'cache-2']),
      delete: mockCachesDelete
    });

    // We must invoke callbacks correctly in mockIndexedDBDelete to avoid hanging promises
    mockIndexedDBDelete = vi.fn().mockImplementation(() => {
      const request = { onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => {
        if (request.onsuccess) {
          (request as any).onsuccess();
        }
      }, 0);
      return request;
    });

    vi.stubGlobal('window', {
      caches: true,
      indexedDB: {
        databases: vi.fn().mockResolvedValue([{ name: 'db-1' }, { name: 'db-2' }]),
        deleteDatabase: mockIndexedDBDelete
      }
    });

    // To prevent warning logs cluttering test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Happy Path: Should perform full deletion for an authenticated user', async () => {
    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();

    // Verify Firestore deletion calls
    // Direct docs: users, user_tokens, user_preferences, user_memory_patterns
    expect(deleteDoc).toHaveBeenCalledTimes(
      4 + // direct UID docs
      10 * 2 // (5 collections * 2 queries per coll * 2 docs returned per query)
    );

    // Verify Storage deletion calls
    expect(listAll).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledTimes(2);

    // Verify Auth deletion call
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith(auth.currentUser);

    // Verify Web Storage clearing
    expect(mockLocalStorageClear).toHaveBeenCalledTimes(1);
    expect(mockSessionStorageClear).toHaveBeenCalledTimes(1);

    // Verify Cache and IndexedDB deletion
    expect(mockCachesDelete).toHaveBeenCalledTimes(2);
    expect(mockIndexedDBDelete).toHaveBeenCalledTimes(2);
    expect(mockIndexedDBDelete).toHaveBeenCalledWith('db-1');
    expect(mockIndexedDBDelete).toHaveBeenCalledWith('db-2');
  });

  it('No User / Anonymous: Should clear local storage but skip cloud and auth steps', async () => {
    // Set no user
    auth.currentUser = null;

    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();

    // Verify no cloud operations happened
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(listAll).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();

    // Verify Web Storage clearing STILL happened
    expect(mockLocalStorageClear).toHaveBeenCalledTimes(1);
    expect(mockSessionStorageClear).toHaveBeenCalledTimes(1);
  });

  it('Requires Recent Login Error: Should throw error', async () => {
    // Mock the specific error code
    const authError = new Error('Requires recent login') as any;
    authError.code = 'auth/requires-recent-login';
    (deleteUser as any).mockRejectedValueOnce(authError);

    await expect(AccountDeletionService.deleteAccount()).rejects.toThrow('Bitte melde dich kurz erneut an');

    // Verify Web Storage clearing was SKIPPED (because it threw)
    expect(mockLocalStorageClear).not.toHaveBeenCalled();
  });

  it('Partial Failure Recovery: Should continue if a query deletion fails', async () => {
    // Make getDocs throw for the very first query but succeed for the rest
    (getDocs as any)
      .mockRejectedValueOnce(new Error('Missing index'))
      .mockResolvedValue({
        docs: [] // return empty for the rest to make counting easier
      });

    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();

    // Verify console warning was logged for the query failure
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[AccountDeletionService] Query deletion warning on'),
      expect.any(Error)
    );
  });

  it('Partial Failure Recovery: Should continue if storage listAll fails', async () => {
    (listAll as any).mockRejectedValueOnce(new Error('Storage bucket not found'));

    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();

    // We shouldn't call deleteObject since listAll failed
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
