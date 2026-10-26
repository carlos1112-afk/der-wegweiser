import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccountDeletionService } from './accountDeletionService';
import { auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const deleteAccountData = vi.fn();

vi.mock('../firebase', () => ({
  auth: { currentUser: null },
  functions: {},
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => deleteAccountData),
}));

describe('AccountDeletionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.currentUser = { uid: 'test-user-123' } as any;
    deleteAccountData.mockResolvedValue({ data: { success: true, status: 'completed', jobId: 'test-user-123' } });
    vi.stubGlobal('localStorage', { clear: vi.fn() });
    vi.stubGlobal('sessionStorage', { clear: vi.fn() });
    vi.stubGlobal('window', { caches: false, indexedDB: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears local data only after the server confirms complete cleanup', async () => {
    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();
    expect(httpsCallable).toHaveBeenCalledWith({}, 'deleteAccountData');
    expect(deleteAccountData).toHaveBeenCalledWith({});
    expect(localStorage.clear).toHaveBeenCalledTimes(1);
    expect(sessionStorage.clear).toHaveBeenCalledTimes(1);
  });

  it('does not clear local data when server cleanup fails', async () => {
    deleteAccountData.mockRejectedValueOnce(new Error('cleanup failed'));
    await expect(AccountDeletionService.deleteAccount()).rejects.toThrow('nicht abgeschlossen');
    expect(localStorage.clear).not.toHaveBeenCalled();
    expect(sessionStorage.clear).not.toHaveBeenCalled();
  });

  it('clears local data for an anonymous device without invoking the server', async () => {
    auth.currentUser = null;
    await expect(AccountDeletionService.deleteAccount()).resolves.toBeUndefined();
    expect(httpsCallable).not.toHaveBeenCalled();
    expect(localStorage.clear).toHaveBeenCalledTimes(1);
  });
});
