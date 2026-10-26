/**
 * CoPilot Service — Proaktiver In-App Sprach-Assistent
 *
 * Überwacht Live-Telemetrie und gibt proaktive TTS-Warnungen aus:
 * - Akku-Schwellenwert-Warnungen (20 %, 10 %)
 * - Reichweiten-Risiko-Analyse via AiGatewayService.analyzeRange
 * - Gemini-Fallback auf deterministische Heuristik
 *
 * Rate-Limit: max 1 Gemini-Anfrage pro 60 s (S4 Sicherheitsanforderung).
 * Kein Spread-Operator auf unbekannten Typen, keine as-any-Casts.
 */

import { AiGatewayService } from './ai/aiGatewayService';
import { VoiceGuidanceService } from './voiceGuidanceService';
import type { LiveBikeTelemetry } from '../types/navigation';
import type { TurnManeuver } from '../hooks/useRouteTracker';

type WarnLevel = 'battery_20' | 'battery_10' | 'range_caution' | 'range_critical';

const WARN_COOLDOWN_MS = 5 * 60 * 1000; // 5 min zwischen gleichen Warnungen
const GEMINI_RATE_LIMIT_MS = 60 * 1000; // max 1 Gemini-Anfrage pro 60 s

let lastWarnAt: Partial<Record<WarnLevel, number>> = {};
let lastGeminiAt = 0;
let lastTurnAnnouncedAt = 0;
let lastAnnouncedTurnKey = '';
let isActive = false;

function canWarn(level: WarnLevel): boolean {
  const last = lastWarnAt[level] ?? 0;
  return Date.now() - last > WARN_COOLDOWN_MS;
}

function markWarned(level: WarnLevel): void {
  lastWarnAt[level] = Date.now();
}

function canCallGemini(): boolean {
  return Date.now() - lastGeminiAt > GEMINI_RATE_LIMIT_MS;
}

function speak(text: string): void {
  if (!isActive) return;
  VoiceGuidanceService.speak(text);
}

async function buildRangeAdvice(telemetry: LiveBikeTelemetry): Promise<string> {
  const pct = telemetry.batteryPercent ?? 0;
  if (!canCallGemini()) {
    return pct <= 15
      ? `Kritisch: Akku bei ${pct} Prozent. Eco-Modus empfohlen.`
      : `Hinweis: Geringe Restkapazität bei ${pct} Prozent.`;
  }

  try {
    lastGeminiAt = Date.now();
    const result = await AiGatewayService.analyzeRange({
      batteryPercent: pct,
      batteryWhRemaining: telemetry.batteryWhRemaining ?? (pct * 5),
      distanceToTargetKm: telemetry.rangeRemainingKm ?? 0,
      elevationRemainingM: 0,
      headwindKmH: 0,
    });
    return result.advice;
  } catch {
    return `Akku bei ${telemetry.batteryPercent} Prozent. Vorausschauend fahren empfohlen.`;
  }
}

/**
 * Navigation-Kontext für Sprachdialog und Co-Pilot.
 */
export interface NavigationContext {
  currentStreet?: string;
  nextTurn?: TurnManeuver;
  routeProgressPct?: number;
}

const TURN_COOLDOWN_MS = 30 * 1000; // gleiche Turn-Ansage nicht innerhalb von 30 s wiederholen

function turnAnnouncementKey(maneuver: TurnManeuver): string {
  return `${maneuver.action}-${maneuver.distanceM}-${maneuver.nextStreet}`;
}

export const CoPilotService = {
  start(): void {
    isActive = true;
    lastWarnAt = {};
    lastGeminiAt = 0;
    lastTurnAnnouncedAt = 0;
    lastAnnouncedTurnKey = '';
  },

  stop(): void {
    isActive = false;
  },

  async onTelemetryUpdate(telemetry: LiveBikeTelemetry): Promise<void> {
    if (!isActive) return;
    if (!telemetry.isConnected) return;

    const pct = telemetry.batteryPercent;
    if (pct === null) return;

    if (pct <= 10) {
      if (canWarn('battery_10')) {
        markWarned('battery_10');
        markWarned('battery_20'); // battery_10 supersedes battery_20
        const advice = await buildRangeAdvice(telemetry);
        speak(`Warnung! Akku kritisch bei ${pct} Prozent. ${advice}`);
      }
      return; // always skip battery_20 check when pct ≤ 10
    }

    if (pct <= 20 && canWarn('battery_20')) {
      markWarned('battery_20');
      const advice = await buildRangeAdvice(telemetry);
      speak(`Hinweis: Akku bei ${pct} Prozent. ${advice}`);
      return;
    }

    if (telemetry.rangeRemainingKm !== undefined && telemetry.rangeRemainingKm < 10) {
      const level: WarnLevel = telemetry.rangeRemainingKm < 5 ? 'range_critical' : 'range_caution';
      if (canWarn(level)) {
        markWarned(level);
        speak(`Reichweite noch circa ${Math.round(telemetry.rangeRemainingKm)} Kilometer. Nächste Ladestation prüfen.`);
      }
    }
  },

  /**
   * KI-generierte Turn-by-Turn-Ansage für eine bevorstehende Abbiegung.
   * Cooldown-gated, damit wiederholte Telemetrie-Updates nicht doppelt ansagen.
   */
  async onTurnApproaching(maneuver: TurnManeuver, telemetry: LiveBikeTelemetry): Promise<void> {
    if (!isActive) return;
    const now = Date.now();
    const key = turnAnnouncementKey(maneuver);
    if (key === lastAnnouncedTurnKey && now - lastTurnAnnouncedAt < TURN_COOLDOWN_MS) return;

    const text = await AiGatewayService.generateTurnByTurnDescription({
      maneuver: { action: maneuver.action, distanceM: maneuver.distanceM, instruction: maneuver.instruction, nextStreet: maneuver.nextStreet },
      batteryPercent: telemetry.batteryPercent,
      speedKmH: telemetry.speedKmH,
    });

    lastTurnAnnouncedAt = now;
    lastAnnouncedTurnKey = key;
    speak(text);
  },

  /**
   * Sprachdialog mit Navigation-Kontext (aktuelle Straße, nächste Abbiegung, Fortschritt).
   */
  async voiceDialogueWithNavigation(userQuery: string, telemetry: LiveBikeTelemetry, context: NavigationContext = {}): Promise<string> {
    const reply = await AiGatewayService.voiceDialogue({
      userQuery,
      batteryPercent: telemetry.batteryPercent,
      speedKmH: telemetry.speedKmH,
      currentStreet: context.currentStreet,
      nextTurnDistanceM: context.nextTurn?.distanceM,
      nextTurnInstruction: context.nextTurn?.instruction,
      routeProgressPct: context.routeProgressPct,
    });
    speak(reply);
    return reply;
  },
};
