/**
 * Unit-Tests: AiGatewayService — voiceDialogue mit Navigation-Kontext
 * und KI-generierte Turn-by-Turn-Ansagen (generateTurnByTurnDescription).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiGatewayService } from './aiGatewayService';

const dispatchSpy = vi.spyOn(AiGatewayService, 'dispatch');

beforeEach(() => {
  dispatchSpy.mockClear();
  dispatchSpy.mockResolvedValue({ text: '', provider: 'firebase_ai' });
  AiGatewayService.configure('firebase_ai');
});

afterEach(() => {
  dispatchSpy.mockClear();
});

describe('AiGatewayService: voiceDialogue mit Navigation-Kontext', () => {
  it('überträgt aktuelle Straße, nächste Abbiegung und Fortschritt in den Prompt', async () => {
    dispatchSpy.mockResolvedValue({ text: 'Alles klar.', provider: 'firebase_ai' });

    await AiGatewayService.voiceDialogue({
      userQuery: 'Wo biege ich ab?',
      batteryPercent: 60,
      speedKmH: 18,
      currentStreet: 'Uferpromenade',
      nextTurnDistanceM: 120,
      nextTurnInstruction: 'Rechts abbiegen',
      routeProgressPct: 35,
    });

    const [req] = dispatchSpy.mock.calls[0];
    expect(req.userPrompt).toContain('Uferpromenade');
    expect(req.userPrompt).toContain('Rechts abbiegen');
    expect(req.userPrompt).toContain('120 Metern');
    expect(req.userPrompt).toContain('35 Prozent');
    expect(req.userPrompt).toContain('maximal 1 Satz');
  });

  it('liefert deterministische Fallback-Antwort, wenn KI nicht erreichbar ist', async () => {
    dispatchSpy.mockRejectedValue(new Error('provider down'));

    const text = await AiGatewayService.voiceDialogue({
      userQuery: 'Wie viel Akku habe ich?',
      batteryPercent: 10,
      speedKmH: 5,
    });

    expect(text).toContain('10 Prozent');
    expect(text).not.toContain('unbekannt');
  });

  it('behandelt unbekannten Akkustand ehrlich', async () => {
    const text = await AiGatewayService.voiceDialogue({
      userQuery: 'Akku?',
      batteryPercent: null,
      speedKmH: 0,
    });

    expect(text).toContain('nicht über Bluetooth bekannt');
  });
});

describe('AiGatewayService: generateTurnByTurnDescription (KI Turn-by-Turn)', () => {
  it('liefert KI-generierte Ansage und ruft dispatch mit Navigations-Prompt auf', async () => {
    dispatchSpy.mockResolvedValue({
      text: 'In 80 Metern rechts abbiegen, dann die Uferpromenade entlang.',
      provider: 'firebase_ai',
      modelUsed: 'gemini-2.0-flash',
    });

    const text = await AiGatewayService.generateTurnByTurnDescription({
      maneuver: { action: 'turn-right', distanceM: 80, instruction: 'Rechts abbiegen', nextStreet: 'Uferpromenade' },
      batteryPercent: 45,
      speedKmH: 15,
    });

    expect(text).toBe('In 80 Metern rechts abbiegen, dann die Uferpromenade entlang.');
    const [req] = dispatchSpy.mock.calls[0];
    expect(req.userPrompt).toContain('Rechts abbiegen');
    expect(req.userPrompt).toContain('Uferpromenade');
    expect(req.userPrompt).toContain('80 Metern');
    expect(req.systemPrompt).toBe('Du bist der Sprachassistent am Fahrradlenker.');
  });

  it('fällt auf deterministische Fallback-Ansage zurück, wenn KI scheitert', async () => {
    dispatchSpy.mockRejectedValue(new Error('down'));

    const text = await AiGatewayService.generateTurnByTurnDescription({
      maneuver: { action: 'turn-left', distanceM: 45, instruction: 'Links abbiegen', nextStreet: 'Waldradweg' },
      batteryPercent: null,
      speedKmH: 0,
    });

    expect(text).toContain('45 Metern');
    expect(text).toContain('Links abbiegen');
    expect(text).toContain('Waldradweg');
  });

  it('verwirft leere KI-Antworten und nutzt den Fallback', async () => {
    dispatchSpy.mockResolvedValue({ text: '', provider: 'firebase_ai' });

    const text = await AiGatewayService.generateTurnByTurnDescription({
      maneuver: { action: 'arrive', distanceM: 0, instruction: 'Ziel erreicht', nextStreet: 'Zielort' },
      batteryPercent: 100,
      speedKmH: 0,
    });

    expect(text).toContain('Ziel erreicht');
    expect(text).not.toBe('');
  });
});
