export class VoiceGuidanceService {
  private static isMuted = false;

  public static toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return this.isMuted;
  }

  public static getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Speaks a German voice prompt using Web Speech Synthesis API.
   */
  public static speak(text: string): void {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis API not supported in browser.');
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const germanVoice = voices.find((v) => v.lang.startsWith('de'));
      if (germanVoice) {
        utterance.voice = germanVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Error during Speech Synthesis execution:', e);
    }
  }

  public static speakRouteStart(title: string, distanceKm: number): void {
    this.speak(`Starte Navigation für ${title}. Gesamtdistanz beträgt ${distanceKm} Kilometer. Gute Fahrt!`);
  }

  public static speakTurnPrompt(instruction: string): void {
    this.speak(instruction);
  }

  public static speakBatteryAlert(remainingPercent: number): void {
    this.speak(`Achtung: Akkuladung auf ${remainingPercent} Prozent gesunken. Bitte reichweitenschonende Motorstufe wählen.`);
  }

  public static speakHeadwindWarning(windSpeedKmH: number): void {
    this.speak(`Gegenwind-Warnung: Starke Böen mit ${windSpeedKmH} km/h erkannt. Erhöhter Akkuverbrauch voraus.`);
  }

  public static speakChargingRecommendation(stationName: string, distanceKm: number): void {
    this.speak(`Proaktive Empfehlung: In ${distanceKm} Kilometern liegt ${stationName}. Akkuladung wird empfohlen.`);
  }
}
