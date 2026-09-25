import { AuthService } from './authService';

/**
 * Einheitliche Nutzerkennung für alle nutzerbezogenen Datenpfade.
 *
 * Zuvor war an 16 Aufrufstellen die Zeichenkette 'user-1' fest verdrahtet.
 * Die Firestore-Regeln verlangen für alle nutzerbezogenen Collections
 * `request.auth.uid == userId` — mit 'user-1' schlug daher JEDER Lese- und
 * Schreibvorgang fehl und wurde still in einen localStorage-Fallback
 * umgeleitet. Cloud-Sync, Kontolöschung und geräteübergreifender Abruf waren
 * damit funktional tot, ohne dass eine Fehlermeldung eskaliert wäre.
 *
 * Diese Auflösung liefert:
 *  - die echte Firebase-UID, sobald der Nutzer angemeldet ist, und
 *  - andernfalls eine stabile, lokal generierte anonyme Kennung, damit
 *    Offline- und Anonymbetrieb weiterhin funktionieren.
 */
const ANONYMOUS_ID_KEY = 'der_wegweiser_anonymous_id';

export class UserIdentity {
  private static cachedAnonymousId: string | null = null;

  public static getUserId(): string {
    const firebaseUser = AuthService.getCurrentUser();
    if (firebaseUser && firebaseUser.uid) {
      return firebaseUser.uid;
    }

    if (this.cachedAnonymousId) return this.cachedAnonymousId;

    try {
      const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
      if (existing) {
        this.cachedAnonymousId = existing;
        return existing;
      }
      // crypto.randomUUID ist in WebView-Umgebungen nicht überall verfügbar.
      const generated =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(ANONYMOUS_ID_KEY, generated);
      this.cachedAnonymousId = generated;
      return generated;
    } catch {
      // Letzter Ausweg: nicht persistierte Sitzungskennung.
      const ephemeral = `anon-session-${Math.random().toString(36).slice(2, 10)}`;
      this.cachedAnonymousId = ephemeral;
      return ephemeral;
    }
  }

  public static isSignedIn(): boolean {
    const firebaseUser = AuthService.getCurrentUser();
    return !!firebaseUser && !!firebaseUser.uid;
  }

  /**
   * Nach An-/Abmeldung muss die zwischengespeicherte anonyme Kennung
   * verworfen werden, damit die echte UID verwendet wird.
   */
  public static clearCache(): void {
    this.cachedAnonymousId = null;
  }
}
