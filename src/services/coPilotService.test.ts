/**
 * Unit-Tests: CoPilotService — kritische Pfade (Warn-Schwellen, Rate-Limit, Guards)
 * Ziel: Mutation-Score ≥80%
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LiveBikeTelemetry } from '../types/navigation';

vi.mock('./voiceGuidanceService', () => ({
  VoiceGuidanceService: { speak: vi.fn() },
}));

vi.mock('./ai/aiGatewayService', () => ({
  AiGatewayService: {
    analyzeRange: vi.fn().mockResolvedValue({
      riskLevel: 'caution',
      advice: 'Eco-Modus empfohlen.',
    }),
  },
}));

const BASE_TELEMETRY: LiveBikeTelemetry = {
  isConnected: true,
  batteryPercent: 100,
  batteryWhRemaining: 500,
  speedKmH: 20,
  cadenceRpm: 70,
  riderPowerWatts: 150,
  motorPowerWatts: 100,
  motorAssistMode: 'auto',
  deviceName: 'Test Bike',
  manufacturer: 'bosch',
  batteryKnown: true,
  batteryHealthPercent: undefined,
  rangeRemainingKm: undefined,
  currentGear: undefined,
  motorTemperatureC: undefined,
};

import { CoPilotService } from './coPilotService';
import { VoiceGuidanceService } from './voiceGuidanceService';
import { AiGatewayService } from './ai/aiGatewayService';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  CoPilotService.start(); // resets lastWarnAt + lastGeminiAt + isActive
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CoPilotService.start / stop', () => {
  it('does not speak when stopped', async () => {
    CoPilotService.stop();
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 5 });
    expect(VoiceGuidanceService.speak).not.toHaveBeenCalled();
  });

  it('does not speak when not connected', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, isConnected: false, batteryPercent: 5 });
    expect(VoiceGuidanceService.speak).not.toHaveBeenCalled();
  });

  it('does not speak when batteryPercent is null', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: null as any });
    expect(VoiceGuidanceService.speak).not.toHaveBeenCalled();
  });
});

describe('CoPilotService — battery_10 threshold (≤10%)', () => {
  it('speaks warning at exactly 10%', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledOnce();
    const msg: string = (VoiceGuidanceService.speak as any).mock.calls[0][0];
    expect(msg).toContain('kritisch');
    expect(msg).toContain('10');
  });

  it('speaks warning at 5% (below 10%)', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 5 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledOnce();
  });

  it('does NOT speak at 11% (battery_10 guard: 11 > 10)', async () => {
    // 11% is above battery_10 threshold (≤10), but below battery_20 threshold (≤20)
    // → battery_20 fires (not battery_10). Battery_10 branch must NOT fire.
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 11 });
    const msg: string = (VoiceGuidanceService.speak as any).mock.calls[0][0];
    // Must contain battery_20 hint text (not "kritisch")
    expect(msg).not.toMatch(/kritisch/i);
    expect(msg).toContain('11');
  });

  it('respects cooldown: battery_10 does not repeat within 5 min', async () => {
    // Use 10% so only battery_10 fires (≤10). Mark it, then re-fire within cooldown.
    // On second call battery_10 is blocked; battery_20 also fires (never marked) —
    // so expect 2 total speaks. To test strict battery_10 cooldown: fire battery_10
    // at exactly 10%, then send 5% (same level) within cooldown → battery_10 blocked,
    // battery_20 also blocked because 5 ≤ 10 path returns before battery_20 check.
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    vi.advanceTimersByTime(4 * 60 * 1000);
    // 4 min < 5 min cooldown → battery_10 still blocked → early return (no battery_20 either)
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledTimes(1);
  });

  it('fires again after 5 min + 1ms cooldown', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledTimes(2);
  });
});

describe('CoPilotService — battery_20 threshold (≤20%, >10%)', () => {
  it('speaks hint at exactly 20%', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 20 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledOnce();
    const msg: string = (VoiceGuidanceService.speak as any).mock.calls[0][0];
    expect(msg).toContain('20');
  });

  it('does NOT speak at 21%', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 21 });
    expect(VoiceGuidanceService.speak).not.toHaveBeenCalled();
  });

  it('battery_10 takes priority over battery_20 at 10%', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    const msg: string = (VoiceGuidanceService.speak as any).mock.calls[0][0];
    expect(msg).toMatch(/kritisch/i);
  });

  it('battery_20 does NOT repeat within cooldown (canWarn + markWarned both required)', async () => {
    // First fire: battery_20 marked
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledTimes(1);
    // Immediately: canWarn('battery_20') must return false → no second speak
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire at exactly 5-min boundary (> strict, not >=)', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    vi.advanceTimersByTime(5 * 60 * 1000); // exactly WARN_COOLDOWN_MS — not yet expired
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledTimes(1);
  });
});

describe('CoPilotService — range warnings', () => {
  it('speaks range_caution when rangeRemainingKm is 9 (< 10)', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 50, rangeRemainingKm: 9 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledOnce();
    const msg: string = (VoiceGuidanceService.speak as any).mock.calls[0][0];
    expect(msg).toContain('9');
  });

  it('does NOT speak when rangeRemainingKm is exactly 10', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 50, rangeRemainingKm: 10 });
    expect(VoiceGuidanceService.speak).not.toHaveBeenCalled();
  });

  it('does NOT speak when rangeRemainingKm is undefined', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 50, rangeRemainingKm: undefined });
    expect(VoiceGuidanceService.speak).not.toHaveBeenCalled();
  });

  it('range_critical (4km) and range_caution (5km) use separate warn levels — both fire independently', async () => {
    // 4km → range_critical (< 5). 5km → range_caution (>= 5). Different levels → independent cooldowns.
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 50, rangeRemainingKm: 4 });
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 50, rangeRemainingKm: 5 });
    expect(VoiceGuidanceService.speak).toHaveBeenCalledTimes(2);
  });
});

describe('CoPilotService — Gemini rate limit (1/60s)', () => {
  it('uses heuristic (no analyzeRange call) within 60s of first call', async () => {
    // First call at t=0: fires, calls analyzeRange
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(AiGatewayService.analyzeRange).toHaveBeenCalledTimes(1);
    // Advance only 30s (< 5min warn cooldown): second warn blocked by warn cooldown
    vi.advanceTimersByTime(30_000);
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(AiGatewayService.analyzeRange).toHaveBeenCalledTimes(1);
  });

  it('calls analyzeRange again after both cooldown and rate limit expire', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    // Advance past BOTH: warn cooldown (5 min) and Gemini rate (60s)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(AiGatewayService.analyzeRange).toHaveBeenCalledTimes(2);
  });

  it('uses heuristic at exactly GEMINI_RATE_LIMIT_MS boundary (> strict: 60000 > 60000 = false)', async () => {
    // Fire battery_20, advance past its warn cooldown so a second battery warn can fire.
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1); // past battery_20 warn cooldown
    // Second battery_20 warn fires → Gemini call (5 min >> 60s) → lastGeminiAt updated
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(AiGatewayService.analyzeRange).toHaveBeenCalledTimes(2);

    // Advance EXACTLY 60000ms since last Gemini call → still rate-limited (> not >=)
    vi.advanceTimersByTime(60_000);
    // battery_10 is a fresh warn level (never warned) → fires, but Gemini rate-limited
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    expect(AiGatewayService.analyzeRange).toHaveBeenCalledTimes(2); // NOT called
  });

  it('calls Gemini again at GEMINI_RATE_LIMIT_MS + 1ms (rate limit expired)', async () => {
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 15 });
    expect(AiGatewayService.analyzeRange).toHaveBeenCalledTimes(2);

    // Advance 60001ms → just past the 60s Gemini rate limit
    vi.advanceTimersByTime(60_001);
    // battery_10 fires (fresh level) → Gemini rate expired → analyzeRange called
    await CoPilotService.onTelemetryUpdate({ ...BASE_TELEMETRY, batteryPercent: 10 });
    expect(AiGatewayService.analyzeRange).toHaveBeenCalledTimes(3);
  });
});
