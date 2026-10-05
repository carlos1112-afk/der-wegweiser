import { describe, it } from 'vitest';

// Jede Zeile ist eine Funktion, die das alte Szenario-Skript als "bestanden" meldete,
// für die es in src/ aber keine Entsprechung gibt. Sie zählen als "todo", nie als Erfolg.
describe('Bekannte Lücken: im alten Skript nur als Nachbau getestet, im echten Code nicht vorhanden', () => {
  it.todo('Szenario 4: Telemetrie-Aggregator berechnet verbrauchte Energie (Wh) aus Leistung und Zeit');
  it.todo('Szenario 5: Reichweiten-Vorausberechnung berücksichtigt Steigung und Gegenwind (No-Coast)');
  it.todo('Szenario 6: Akku-Bewertung mit Stufen NORMAL / WARNING_RESCUE_REQUIRED / CRITICAL (nur eine feste 15-%-Schwelle inline in App.tsx)');
  it.todo('Szenario 9: Android-Foreground-Service mit laufender Navigations-Benachrichtigung (nur die Berechtigung im Manifest, kein Code in src/)');
  it.todo('Szenario 11: Ladestationen nach Steckertyp, kostenlos und wetterfest filtern (kein Filter in src/)');
  it.todo('Szenario 12: Validierung von Stations-Einreichungen (Namenslänge, Koordinaten, Steckertyp) vor dem Speichern');
  it.todo('Szenario 8: Sprachansagen für Abbiegehinweise aus dem Hook (Text entsteht dort, VoiceGuidanceService.speakTurnPrompt spricht nur durch)');
});

describe('Bekannte Datenfälschung im echten Code (Tests folgen, sobald behoben)', () => {
  it.todo('Abbiegehinweis nextStreet stammt aus Routendaten statt aus festen Namen ("Uferpromenade", "Waldradweg")');
  it.todo('GPX-Export schreibt echte Höhenwerte statt fester 35 m und einer Sinuskurve');
  it.todo('Ladesäulen-Scanner speichert die Position der Station statt Eigenposition mit Zufallsversatz');
  it.todo('Offline-Planung ohne Netz liefert den Korridor statt einer Exception (Höhendienst ohne Fallback)');
});
