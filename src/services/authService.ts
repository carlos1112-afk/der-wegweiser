import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  provider: 'google' | 'apple' | 'microsoft' | 'facebook' | 'x' | 'telegram' | 'anonymous';
}

export class AuthService {
  private static currentUser: User | null = null;
  private static listeners: ((user: User | null) => void)[] = [];

  static {
    try {
      if (auth && typeof onAuthStateChanged === 'function') {
        onAuthStateChanged(auth, (user) => {
          AuthService.currentUser = user;
          AuthService.listeners.forEach((cb) => cb(user));
        });
      }
    } catch (err) {
      console.warn('[AuthService] Auth state listener initialization deferred:', err);
    }
  }

  public static getCurrentUser(): User | null {
    return AuthService.currentUser || (auth && auth.currentUser) || null;
  }

  public static onAuthStateChange(callback: (user: User | null) => void): () => void {
    AuthService.listeners.push(callback);
    callback(AuthService.getCurrentUser());
    return () => {
      AuthService.listeners = AuthService.listeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Seamless Google OAuth Sign-In (Default)
   */
  public static async signInWithGoogle(): Promise<User | null> {
    if (!auth || !auth.app) {
      throw new Error('Firebase Auth ist offline oder nicht konfiguriert.');
    }
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    try {
      const result = await signInWithPopup(auth, provider);
      AuthService.currentUser = result.user;
      return result.user;
    } catch (error: any) {
      console.error('[AuthService] Google OAuth failed:', error);
      throw error;
    }
  }

  /**
   * Apple Sign-In
   */
  public static async signInWithApple(): Promise<User | null> {
    if (!auth || !auth.app) {
      throw new Error('Firebase Auth ist offline oder nicht konfiguriert.');
    }
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');

    try {
      const result = await signInWithPopup(auth, provider);
      AuthService.currentUser = result.user;
      return result.user;
    } catch (error: any) {
      console.error('[AuthService] Apple OAuth failed:', error);
      throw error;
    }
  }

  /**
   * Microsoft Sign-In
   */
  public static async signInWithMicrosoft(): Promise<User | null> {
    if (!auth || !auth.app) {
      throw new Error('Firebase Auth ist offline oder nicht konfiguriert.');
    }
    const provider = new OAuthProvider('microsoft.com');

    try {
      const result = await signInWithPopup(auth, provider);
      AuthService.currentUser = result.user;
      return result.user;
    } catch (error: any) {
      console.error('[AuthService] Microsoft OAuth failed:', error);
      throw error;
    }
  }

  /**
   * Facebook Sign-In
   */
  public static async signInWithFacebook(): Promise<User | null> {
    if (!auth || !auth.app) {
      throw new Error('Firebase Auth ist offline oder nicht konfiguriert.');
    }
    const provider = new OAuthProvider('facebook.com');

    try {
      const result = await signInWithPopup(auth, provider);
      AuthService.currentUser = result.user;
      return result.user;
    } catch (error: any) {
      console.error('[AuthService] Facebook OAuth failed:', error);
      throw error;
    }
  }

  /**
   * X (Twitter) Sign-In
   */
  public static async signInWithX(): Promise<User | null> {
    if (!auth || !auth.app) {
      throw new Error('Firebase Auth ist offline oder nicht konfiguriert.');
    }
    const provider = new OAuthProvider('twitter.com');

    try {
      const result = await signInWithPopup(auth, provider);
      AuthService.currentUser = result.user;
      return result.user;
    } catch (error: any) {
      console.error('[AuthService] X OAuth failed:', error);
      throw error;
    }
  }

  /**
   * Telegram OAuth / Link Sign-In
   */
  public static async signInWithTelegram(): Promise<User | null> {
    if (!auth || !auth.app) {
      throw new Error('Firebase Auth ist offline oder nicht konfiguriert.');
    }
    const provider = new OAuthProvider('telegram.org');

    try {
      const result = await signInWithPopup(auth, provider);
      AuthService.currentUser = result.user;
      return result.user;
    } catch (error: any) {
      console.error('[AuthService] Telegram OAuth failed:', error);
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  public static async signOut(): Promise<void> {
    if (auth && typeof firebaseSignOut === 'function') {
      await firebaseSignOut(auth);
    }
    AuthService.currentUser = null;
    AuthService.listeners.forEach((cb) => cb(null));
  }
}
