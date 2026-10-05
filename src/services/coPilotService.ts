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

type WarnLevel = 'battery_20' | 'battery_10' | 'range_caution' | 'range_critical';

const WARN_COOLDOWN_MS = 5 * 60 * 1000; // 5 min zwischen gleichen Warnungen
const GEMINI_RATE_LIMIT_MS = 60 * 1000; // max 1 Gemini-Anfrage pro 60 s

let lastWarnAt: Partial<Record<WarnLevel, number>> = {};
let lastGeminiAt = 0;
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

export const CoPilotService = {
  start(): void {
    isActive = true;
    lastWarnAt = {};
    lastGeminiAt = 0;
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
};
