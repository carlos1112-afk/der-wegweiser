import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../../src/services/authService';
import { signInWithPopup } from 'firebase/auth';

// Mock dependencies
vi.mock('firebase/auth', () => {
  const addScope = vi.fn();

  class GoogleAuthProvider {
    addScope = addScope;
  }

  class OAuthProvider {
    addScope = addScope;
  }

  return {
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
  };
});

vi.mock('../../src/firebase', () => ({
  auth: {
    app: {},
    currentUser: null,
  },
}));

describe('AuthService', () => {
  let originalConsoleError: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('signInWithGoogle', () => {
    it('should throw an error and log it if signInWithPopup fails', async () => {
      const mockError = new Error('OAuth rejected');
      vi.mocked(signInWithPopup).mockRejectedValueOnce(mockError);

      await expect(AuthService.signInWithGoogle()).rejects.toThrow('OAuth rejected');

      expect(console.error).toHaveBeenCalledWith(
        '[AuthService] Google OAuth failed:',
        mockError
      );
    });
  });
});
