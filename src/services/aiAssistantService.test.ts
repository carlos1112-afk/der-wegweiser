/**
 * Unit-Tests: AiAssistantService — dynamische Modellwahl (Flash/Pro/Lite)
 * und KI-generierte Turn-by-Turn-Ansagen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AiAssistantService,
  selectModelByTelemetry,
  DEFAULT_MODEL,
  type ModelId,
} from './aiAssistantService';
import { AiGatewayService } from './ai/aiGatewayService';

const dispatchSpy = vi.spyOn(AiGatewayService, 'dispatch');

beforeEach(() => {
  dispatchSpy.mockClear();
  dispatchSpy.mockResolvedValue({ text: 'KI-Antwort.', provider: 'firebase_ai', modelUsed: 'gemini-2.0-flash' });
});

afterEach(() => {
  dispatchSpy.mockClear();
});

describe('selectModelByTelemetry', () => {
  it('wählt Flash Lite bei schwachem Akku (< 20 %)', () => {
    expect(selectModelByTelemetry({ batteryPercent: 10 })).toBe('gemini-2.0-flash-lite');
    expect(selectModelByTelemetry({ batteryPercent: 19 })).toBe('gemini-2.0-flash-lite');
  });

  it('wählt Pro bei anspruchsvoller Topographie (> 500 Höhenmeter)', () => {
    expect(selectModelByTelemetry({ elevationGainM: 800 })).toBe('gemini-1.5-pro');
    expect(selectModelByTelemetry({ elevationGainM: 501 })).toBe('gemini-1.5-pro');
  });

  it('fällt auf den Flash-Standard zurück', () => {
    expect(selectModelByTelemetry({})).toBe('gemini-2.0-flash');
    expect(selectModelByTelemetry({ batteryPercent: 50, speedKmH: 20 })).toBe('gemini-2.0-flash');
    expect(selectModelByTelemetry({ batteryPercent: 20 })).toBe('gemini-2.0-flash'); // genau 20 % ist nicht unter der Schwelle
    expect(selectModelByTelemetry({ elevationGainM: 500 })).toBe('gemini-2.0-flash'); // genau 500 Hm ist nicht über der Schwelle
  });
});

describe('generateTurnByTurnDescription', () => {
  it('wendet dynamische Modellwahl an: schwacher Akku → Flash Lite', async () => {
    await AiAssistantService.generateTurnByTurnDescription(
      { action: 'turn-right', distanceM: 100, instruction: 'Rechts abbiegen', nextStreet: 'Hauptstraße' },
      { batteryPercent: 10, speedKmH: 12 }
    );

    const [req] = dispatchSpy.mock.calls[0];
    expect(req.modelId).toBe('gemini-2.0-flash-lite');
    expect(req.userPrompt).toContain('Hauptstraße');
    expect(req.userPrompt).toContain('Rechts abbiegen');
  });

  it('wendet dynamische Modellwahl an: hohe Steigung → Pro', async () => {
    await AiAssistantService.generateTurnByTurnDescription(
      { action: 'turn-left', distanceM: 60, instruction: 'Links abbiegen', nextStreet: 'Bergweg' },
      { batteryPercent: 90, elevationGainM: 700 }
    );

    const [req] = dispatchSpy.mock.calls[0];
    expect(req.modelId).toBe('gemini-1.5-pro');
  });

  it('verwendet ein explizit übergebenes Modell ohne Umschreibung', async () => {
    await AiAssistantService.generateTurnByTurnDescription(
      { action: 'straight', distanceM: 200, instruction: 'Geradeaus', nextStreet: 'Alleestraße' },
      { batteryPercent: 5 },
      'gemini-1.5-pro'
    );

    const [req] = dispatchSpy.mock.calls[0];
    expect(req.modelId).toBe('gemini-1.5-pro');
  });

  it('gibt null zurück, wenn das Gateway keine verwertbare Antwort liefert', async () => {
    dispatchSpy.mockResolvedValue({ text: '', provider: 'heuristic_offline' });

    const result = await AiAssistantService.generateTurnByTurnDescription(
      { action: 'arrive', distanceM: 0, instruction: 'Ziel erreicht', nextStreet: 'Ziel' },
      {}
    );

    expect(result).toBeNull();
  });

  it('gibt den KI-Text zurück, wenn das Gateway antwortet', async () => {
    dispatchSpy.mockResolvedValue({ text: 'In 100 Metern rechts abbiegen.', provider: 'firebase_ai' });

    const result = await AiAssistantService.generateTurnByTurnDescription(
      { action: 'turn-right', distanceM: 100, instruction: 'Rechts abbiegen', nextStreet: 'Hauptstraße' },
      { batteryPercent: 80 }
    );

    expect(result).toBe('In 100 Metern rechts abbiegen.');
  });
});
