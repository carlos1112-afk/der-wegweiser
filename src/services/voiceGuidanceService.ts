import { SoundFxService } from './soundFxService';

export type VoicePersonaId = 'anna' | 'tom' | 'ben' | 'franz';

export interface VoicePersona {
  id: VoicePersonaId;
  name: string;
  subtitle: string;
  description: string;
  defaultPitch: number;
  defaultRate: number;
  preferredGender: 'female' | 'male';
  samplePhrase: string;
  tag: string;
}

export interface VoiceSettings {
  persona: VoicePersonaId;
  rate: number; // 0.7 - 1.5
  pitch: number; // 0.5 - 1.8
  volume: number; // 0.0 - 1.0
  isMuted: boolean;
  playChimes: boolean;
  announceTurns: boolean;
  announceBattery: boolean;
  announceWeather: boolean;
}

export const VOICE_PERSONAS: Record<VoicePersonaId, VoicePersona> = {
  anna: {
    id: 'anna',
    name: 'Cyberpunk Anna',
    subtitle: 'Klar, präzise & futuristisch',
    description: 'Klare, hochauflösende Frauenstimme mit schnellen, prägnanten Navigationshinweisen.',
    defaultPitch: 1.15,
    defaultRate: 1.08,
    preferredGender: 'female',
    samplePhrase: 'Cyber-Systems online. Ich führe dich sicher ans Ziel.',
    tag: 'Empfohlen für die Stadt',
  },
  tom: {
    id: 'tom',
    name: 'Sportlicher Tom',
    subtitle: 'Dynamisch, motivierend & Tempofokus',
    description: 'Energetische Männerstimme, die dich antreibt und Watt- & Steigungsleistungen pusht.',
    defaultPitch: 0.95,
    defaultRate: 1.18,
    preferredGender: 'male',
    samplePhrase: 'Kette rechts und los! Lass uns heute richtig Kilometer fressen.',
    tag: 'Training & eMTB',
  },
  ben: {
    id: 'ben',
    name: 'Gelassener Ben',
    subtitle: 'Entspannt, warm & Cruiser-Vibe',
    description: 'Ruhige, tiefe Stimme für entspannte Landschaftstouren und stressfreie Tourenplanung.',
    defaultPitch: 0.85,
    defaultRate: 0.92,
    preferredGender: 'male',
    samplePhrase: 'Ganz entspannt. Genieß die Aussicht und tritt locker mit.',
    tag: 'Cruiser & Genusstouren',
  },
  franz: {
    id: 'franz',
    name: 'Co-Pilot Franz',
    subtitle: 'Analytisch, Telemetrie & KI-Assistent',
    description: 'High-Tech Synthesizer-Stil mit Fokus auf Akku-Telemetrie und Reichweitenoptimierung.',
    defaultPitch: 1.0,
    defaultRate: 1.0,
    preferredGender: 'female',
    samplePhrase: 'Digitaler Co-Pilot initialisiert. Telemetrie und Route sind synchronisiert.',
    tag: 'High-Tech & Telemetrie',
  },
};

const DEFAULT_SETTINGS: VoiceSettings = {
  persona: 'anna',
  rate: 1.08,
  pitch: 1.15,
  volume: 1.0,
  isMuted: false,
  playChimes: true,
  announceTurns: true,
  announceBattery: true,
  announceWeather: true,
};

export class VoiceGuidanceService {
  private static settings: VoiceSettings = this.loadSettings();

  private static loadSettings(): VoiceSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem('wegweiser_voice_settings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore localStorage error
    }
    return DEFAULT_SETTINGS;
  }

  public static saveSettings(newSettings: Partial<VoiceSettings>): VoiceSettings {
    this.settings = { ...this.settings, ...newSettings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wegweiser_voice_settings', JSON.stringify(this.settings));
      } catch {
        // Ignore localStorage error
      }
    }
    return this.settings;
  }

  public static getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public static toggleMute(): boolean {
    this.settings.isMuted = !this.settings.isMuted;
    this.saveSettings({ isMuted: this.settings.isMuted });
    if (this.settings.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return this.settings.isMuted;
  }

  public static getIsMuted(): boolean {
    return this.settings.isMuted;
  }

  /**
   * Speaks a German voice prompt using Web Speech Synthesis API with active Persona settings.
   */
  public static speak(text: string, withChime: boolean = false): void {
    if (this.settings.isMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis API not supported in browser.');
      return;
    }

    if (withChime && this.settings.playChimes) {
      SoundFxService.playTurnChime();
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      utterance.volume = this.settings.volume;

      const persona = VOICE_PERSONAS[this.settings.persona];
      const voices = window.speechSynthesis.getVoices();
      const germanVoices = voices.filter((v) => v.lang.startsWith('de'));

      if (germanVoices.length > 0) {
        let match = germanVoices.find((v) => {
          const name = v.name.toLowerCase();
          if (persona.preferredGender === 'female') {
            return name.includes('female') || name.includes('anna') || name.includes('katja') || name.includes('marlene') || name.includes('vicki');
          } else {
            return name.includes('male') || name.includes('stefan') || name.includes('markus') || name.includes('hans') || name.includes('martin');
          }
        });
        utterance.voice = match || germanVoices[0];
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Error during Speech Synthesis execution:', e);
    }
  }

  public static speakPreview(personaId: VoicePersonaId): void {
    const persona = VOICE_PERSONAS[personaId];
    if (!persona) return;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (this.settings.playChimes) {
      SoundFxService.playTurnChime();
    }

    const utterance = new SpeechSynthesisUtterance(persona.samplePhrase);
    utterance.lang = 'de-DE';
    utterance.rate = persona.defaultRate;
    utterance.pitch = persona.defaultPitch;
    utterance.volume = this.settings.volume;

    const voices = window.speechSynthesis.getVoices();
    const germanVoices = voices.filter((v) => v.lang.startsWith('de'));

    if (germanVoices.length > 0) {
      let match = germanVoices.find((v) => {
        const name = v.name.toLowerCase();
        if (persona.preferredGender === 'female') {
          return name.includes('female') || name.includes('anna') || name.includes('katja') || name.includes('marlene');
        } else {
          return name.includes('male') || name.includes('stefan') || name.includes('markus') || name.includes('hans');
        }
      });
      utterance.voice = match || germanVoices[0];
    }

    window.speechSynthesis.speak(utterance);
  }

  public static speakRouteStart(title: string, distanceKm: number): void {
    if (!this.settings.announceTurns) return;
    this.speak(`Starte Navigation für ${title}. Gesamtdistanz beträgt ${distanceKm} Kilometer. Gute Fahrt!`, true);
  }

  public static speakTurnPrompt(instruction: string): void {
    if (!this.settings.announceTurns) return;
    this.speak(instruction, true);
  }

  public static speakBatteryAlert(remainingPercent: number): void {
    if (!this.settings.announceBattery) return;
    SoundFxService.playWarningTone();
    this.speak(`Achtung: Akkuladung auf ${remainingPercent} Prozent gesunken. Bitte sparsame Motorstufe wählen.`);
  }

  public static speakHeadwindWarning(windSpeedKmH: number): void {
    if (!this.settings.announceWeather) return;
    SoundFxService.playWarningTone();
    this.speak(`Gegenwind-Warnung: Starke Böen mit ${windSpeedKmH} km/h erkannt. Erhöhter Akkuverbrauch voraus.`);
  }

  public static speakChargingRecommendation(stationName: string, distanceKm: number): void {
    this.speak(`Proaktive Empfehlung: In ${distanceKm} Kilometern liegt ${stationName}. Akkuladung wird empfohlen.`, true);
  }
}
