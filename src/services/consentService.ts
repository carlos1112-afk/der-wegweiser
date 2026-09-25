/**
 * Einwilligungsverwaltung (Art. 6/7 DSGVO, § 25 TDDDG) — Der Wegweiser
 *
 * Single Source of Truth für die Einwilligung. Vorher stand die Einwilligung
 * ausschließlich als Anzeige-Flag im App-State (`App.tsx`), wurde nur einmal
 * geschrieben und von KEINEM Service ausgewertet. GPS-Tracking, Firestore-Zugriffe,
 * Wetter-, KI- und Telemetrie-Aufrufe starteten dadurch unabhängig von der
 * Entscheidung des Nutzers.
 *
 * Dieser Service liefert die verbindliche Antwort auf die Frage
 * "Darf diese Verarbeitung stattfinden?" und wird von allen datenverarbeitenden
 * Services abgefragt.
 */

export interface ConsentFlags {
  /** Notwendig für die Kernfunktion (Navigation) — immer aktiv, sobald Einwilligung erteilt. */
  essential: boolean;
  /** Reichweitenmessung, Analytics, Wetter-Abfragen, Telemetrie-Upload. */
  analytics: boolean;
  /** Dritte Umfragen-/Offerwall-Module (BitLabs, CPX Research). */
  surveys: boolean;
  /** Personalisierte Empfehlungen. */
  personalizedAds: boolean;
  /** ISO-Zeitstempel der Einwilligung. */
  acceptedAt: string;
  /**
   * Version der Datenschutzerklärung, der zugestimmt wurde.
   * Bei Versionswechsel wird die Einwilligung als erneuert behandelt (Art. 7(3) DSGVO).
   */
  version: number;
}

/**
 * Bei jeder inhaltlichen Änderung der Datenschutzerklärung hochzählen,
 * damit eine erneute Einwilligung abgefragt wird.
 */
export const CONSENT_VERSION = 2;

const STORAGE_KEY = 'der_wegweiser_legal_consent';

type ConsentListener = (flags: ConsentFlags) => void;

export class ConsentService {
  private static listeners: ConsentListener[] = [];

  /**
   * Liest die gespeicherte Einwilligung. Gibt `null` zurück, wenn keine
   * Einwilligung vorliegt ODER die gespeicherte Einwilligung auf eine veraltete
   * Fassung der Datenschutzerklärung erteilt wurde. In beiden Fällen muss
   * erneut eingewilligt werden.
   */
  public static getConsent(): ConsentFlags | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<ConsentFlags>;

      if (typeof parsed.essential !== 'boolean') return null;
      // Veraltete Einwilligung → erneut einholen.
      if (parsed.version !== CONSENT_VERSION) return null;

      return {
        essential: parsed.essential,
        analytics: parsed.analytics === true,
        surveys: parsed.surveys === true,
        personalizedAds: parsed.personalizedAds === true,
        acceptedAt: parsed.acceptedAt || new Date(0).toISOString(),
        version: CONSENT_VERSION,
      };
    } catch (e) {
      console.warn('[Consent] Einwilligung nicht lesbar, erneute Zustimmung erforderlich:', e);
      return null;
    }
  }

  /**
   * Wurde eine gültige, aktuelle Einwilligung erteilt?
   * Ohne diese Freigabe darf KEINE Datenverarbeitung stattfinden.
   */
  public static hasValidConsent(): boolean {
    return this.getConsent() !== null;
  }

  /**
   * Prüft eine einzelne Verarbeitungskategorie.
   * Kategorien, fürden keine gültige Einwilligung vorliegt, sind immer `false`.
   */
  public static isGranted(category: keyof Pick<ConsentFlags, 'essential' | 'analytics' | 'surveys' | 'personalizedAds'>): boolean {
    const consent = this.getConsent();
    if (!consent) return false;
    return consent[category] === true;
  }

  /**
   * Bequeme Kurzprüfungen für die Aufrufstellen.
   */
  public static get allowsEssential(): boolean {
    return this.isGranted('essential');
  }
  public static get allowsAnalytics(): boolean {
    return this.isGranted('analytics');
  }
  public static get allowsSurveys(): boolean {
    return this.isGranted('surveys');
  }
  public static get allowsPersonalizedAds(): boolean {
    return this.isGranted('personalizedAds');
  }

  public static save(flags: Omit<ConsentFlags, 'acceptedAt' | 'version'>): ConsentFlags {
    const consent: ConsentFlags = {
      essential: flags.essential,
      analytics: flags.analytics,
      surveys: flags.surveys,
      personalizedAds: flags.personalizedAds,
      acceptedAt: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    this.listeners.forEach((cb) => cb(consent));
    return consent;
  }

  /**
   * Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO).
   * Entfernt die Einwilligung vollständig, damit die App beim nächsten Start
   * erneut zur Zustimmung auffordert und die Verarbeitung einstellt.
   */
  public static withdraw(): void {
    localStorage.removeItem(STORAGE_KEY);
    // Alle lokal abgelegten personenbezogenen Daten verwerfen.
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('[Consent] Lokale Daten beim Widerruf nicht vollständig löschbar:', e);
    }
  }

  public static onChange(callback: ConsentListener): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }
}
