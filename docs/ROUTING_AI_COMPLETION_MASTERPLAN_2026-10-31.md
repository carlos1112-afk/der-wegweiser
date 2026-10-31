# Gesamtplan: KI-Routing vollständig integrieren und betriebssicher abschließen

Stand: 31.10.2026
Worktree: `codex/routing-open-points-20261031`
Grundlage: vorheriger KI-Routing-Integrationsstand einschließlich dessen uncommitteter Änderungen.

## Produktgrenzen

- **Kostenlos:** nur Start, Ziel, ausdrücklich gesetzte Zwischenstopps und der ausdrücklich gewählte Flachheitswunsch beeinflussen die Strecke. Keine Historie, implizite Vorlieben, Akku-, Oberflächen-, Interessen- oder Freitextpersonalisierung.
- **Premium:** zusätzliche Personalisierung ausschließlich nach sichtbarer Auswahl und Bestätigung. Unbekannte Routerdaten werden als unbekannt behandelt und nicht als erfüllt ausgegeben.
- **Keine verlorenen Kandidaten:** jede valide erzeugte Alternative wird vor Abschluss dauerhaft archiviert. Generierte, ungefahrene Pläne und tatsächlich aufgezeichnete Fahrten bleiben getrennte Datensätze.
- **Datenquellen:** Wegweiser-POIs und Ladepunkte sowie freigegebene öffentliche Geocoder werden berücksichtigt. Interne Datensätze werden nicht durch öffentliche Suchtreffer verdrängt.
- **KI-Sicherheit:** Sprachmodelle wählen nur aus unabhängig validierten Straßenrouten; sie dürfen keine Geometrie erfinden oder Sicherheitsbedingungen überstimmen.

## Bestand und noch offene Arbeitsbereiche

| Bereich | Ziel / Abnahmekriterium | Status und Verantwortlichkeit |
|---|---|---|
| Isolierter Arbeitsstand | Eigener Worktree, bisherige Routingänderungen vollständig übernommen | **Erledigt:** dieser Worktree; Ausgangsbranch bleibt erhalten |
| Premiumarchiv-Recovery | Aufträge aller Seiten auflisten; jeden Kandidaten wiederholen, lokal validieren und stabil speichern | **Quellcode vorhanden** aus vorherigem Stand; im Gesamtabschluss erneut integrieren und prüfen |
| Dauerhafte asynchrone Ausführung | Quote/Reservierung → idempotenter Cloud-Tasks-Auftrag → Worker → Kandidaten dauerhaft speichern → Capture; Fehler/Abbruch/Retry ohne Doppelbelastung | **Implementiert und gebaut.** Jest deckt bisher nur Teilfunktionen ab. Emulator-/Cloud-Tasks-IAM-Lauf fehlt, da der Emulator im Sandbox-Netz nicht binden durfte; Deployment und IAM bleiben Betreiberlauf |
| Interner Zielindex | Versionierter, deterministischer Index für POIs und Ladepunkte; Dry-run-/idempotentes Backfill; interne und externe Treffer zusammenführen | **Implementiert und gebaut.** Backfill ist Dry-run-Standard und benötigt `--apply`; kein Projekt ausgewählt und keine Migration ausgeführt. Eventtrigger/Firestore-Index noch nicht live verifiziert |
| Zusätzliche Routinganbieter | Adapter für mindestens einen zusätzlichen geeigneten Fahrradrouter; standardisierte Geometrie/Fehler/Provenienz; Providerwahl konfigurierbar, keine stillen Fallbacks | **ORS-Adapter samt Parser-/Fehlerpfadtests vorhanden.** Echter Anbieterzugang, Quoten, Vertrag/Datenschutz und Live-Aufruf nicht verifiziert; Alternativen sind auf 3 und laut Anbietergrenze auf Routen bis 100 km begrenzt |
| Mehrere AI-Anbieter | Vertex/Gemini/OpenAI/Anthropic auswählbar; ein Anbieter pro Auftrag; kein stiller Anbieterwechsel | **Adapter vorhanden.** Pro Job werden Anbieter und Modell gespeichert. Kein echter Provideraufruf; Modellzugang, Regionen, Kosten und Nutzungsbedingungen sind nicht bestätigt |
| Personalisierung und Gewichtung | Harte Erreichbarkeits-/Sicherheitsbedingungen vor weichen Kriterien; Hauptwunsch hat Vorrang; nur verfügbare Messwerte; Herkunft/Unsicherheit transparent | **Teilweise integriert:** Premium akzeptiert explizite Priorität (kürzer/flacher/schneller) und den Flachheitswunsch. Bewertet werden nur validierte Kandidaten mit gemessenen Kennzahlen. Fahrhistorie hat Gewicht 0; Oberfläche, Interessen, Akku und Freitext werden serverseitig abgelehnt, bis dafür belastbare Routendaten und passende UI vorliegen. Free bleibt auf Flachheit und Stopps begrenzt |
| Premium-UI und Zwischenstopps | Alle verfügbaren Einstiege nutzen denselben Coordinator; Premiumoptionen strukturiert und explizit; mehrere benannte Stopps in Reihenfolge | **Request- und Servicepfad integriert, App-Build und UI-Tests bestanden.** Manuelle Livefahrt/Wallet-UI mit echter Firebase-Umgebung nicht geprüft |
| Fahrthistorie | Keine Fahrt ohne belegte Bewegung als gefahren markieren; Historie bleibt von Plänen getrennt; exportierbar und löschbar | **Lokal vorhanden** in IndexedDB; Planspeicherung, Fahrtbeleg und Export bleiben getrennt. Premium-Routen werden serverseitig wiederherstellbar archiviert. Keine Cloud-Synchronisierung aufgezeichneter Tracks, da dafür separate Einwilligung, Zweck-/Aufbewahrungsregel und Löschpfad nötig wären |
| Betrieb und Aufbewahrung | Private Artefakte, Benutzerisolation, Kontolöschung, Fristen, Limits/Monitoring, Provider-/Routerkonfiguration | **Kontolöschung entfernt Nutzerdokumente und Dateien unter `users/{uid}/`.** Generierte Premiumartefakte bleiben bis zur Kontolöschung erhalten; automatische Frist/Quota/Monitoring und Cloud-IAM sind nicht eingerichtet |
| Ende-zu-Ende-Abnahme | Build, relevante Unit-/Rules-/Emulator-Tests, negative Auth-/Wallet-/Queue-/Datenfehlerfälle, Wiederholung und manuelle UI-Route | **App- und Functions-Build bestanden; App: 41 Testdateien, 427 Tests bestanden (eine netzwerk-/bindungsabhängige Scriptdatei ausgeschlossen); Functions: 18 Suiten, 169 Tests bestanden.** Firestore-Emulator konnte wegen `listen EPERM` auf Loopback nicht starten; Live-Firebase/Wallet/Router/KI-Aufruf und manuelle UI-Route nicht geprüft |

## Gewichtungsregel für Premium

1. Ausschlussbedingungen: gültige/erreichbare Geometrie, Stoppreihenfolge, belegbare harte Vorgaben.
2. Hauptpriorität aus der aktuellen Anfrage dominiert weiche Kriterien; keine impliziten Verhaltensannahmen.
3. Sekundäre Kriterien fließen nur ein, wenn die erforderlichen Daten am Kandidaten gemessen und valide sind.
4. Fahrhistorie erhält im aktuellen Scorer Gewicht 0. Eine spätere Nutzung braucht separates Opt-in, Aggregation, Datenqualitätsgrenze und Zurücksetzen.
5. Jede Gewichtung wird versioniert und zusammen mit Kandidatenscores nachvollziehbar gespeichert.

## Phasen und Entscheidungstore

1. **Quellstand reproduzierbar machen:** Änderungen aus Vorarbeit in den neuen Worktree übernehmen, Bestand und Verantwortungsgrenzen festschreiben.
2. **Daten und Archiv:** internen Suchindex samt Dry-run-Backfill; Recovery aller Premiumkandidaten; idempotente IDs und Löschpfade.
3. **Auftragsausführung:** Cloud Tasks mit Reservierungs-/Lease-/Settlement-Protokoll und Abbruch-/Retry-Sicherheit.
4. **Routerpluralität:** mindestens ein alternativer Radrouter hinter derselben validierenden Adaptergrenze; BRouter bleibt konfigurierbarer Anbieter.
5. **Produktintegration:** Premium-Einstiege, explizite Kriterien und benannte Stopps konsistent abbilden; Free-Payloadgrenze per Negativprüfung sichern.
6. **Prüfung:** Build und gezielte Tests (Auth, Eigentümertrennung, invalidierte Geometrie, Routerausfall, doppelte Queue-Zustellung, Wallet-Replay, Speicherausfall, Wiederherstellung aller Varianten); in Emulator wiederholen.
7. **Externer Lauf:** Migration und Cloud-Deployment erst in einer ausdrücklich vorhandenen Testumgebung; reale Anbieter-/Wallettests ohne echte Belastung oder echte Nutzertracks.
8. **Merge/Push:** Benutzer hat bedingt freigegeben, nach vollständigem Abschluss und realer Prüfung zu mergen/pushen. Das erfolgt erst nach den Entscheidungstoren und dokumentierter Evidenz. Ungeprüfte Codeänderungen werden nicht als fertig veröffentlicht.

## Grenzen der Prüfung

Ein erfolgreicher Build oder Emulatorlauf belegt keine Verfügbarkeit von API-Schlüsseln, Cloud-Tasks-IAM, echten BRouter-Endpunkten, Walletsaldo, laufender Firestore-Konfiguration, produktiven Regeln oder nutzerbezogener Einwilligung. Solche Punkte werden getrennt als Betreiber-/Testumgebungsabhängigkeiten ausgewiesen und nicht durch Vermutungen geschlossen.

## Abnahmeprotokoll und Merge-Gate

- [FAKT] App-Produktionsbuild und Functions-TypeScript-Build liefen erfolgreich.
- [FAKT] App-Vitest (ohne `tests/scripts/anthropicFederationExchange.test.ts`, das einen lokalen Listener benötigt) meldete 41 Dateien bestanden, 2 übersprungen, 427 Tests bestanden, 1 übersprungen und 11 TODOs.
- [FAKT] Functions-Jest meldete 18 Suiten und 169 Tests bestanden.
- [FAKT] Das Backfill-Skript bestand `node --check`; `git diff --check` ist mit `core.whitespace=cr-at-eol` sauber. `src/types/navigation.ts` hat bestehende CRLF-Zeilenenden.
- [FAKT] Ein Firestore-Rules-Emulatorlauf wurde versucht, scheiterte aber vor den Tests mit `listen EPERM` für Loopback-Ports. Der erste `npm run test:rules`-Versuch scheiterte außerdem an nicht erreichbarem npm Registry-DNS; anschließend wurde die vorhandene Firebase-CLI direkt verwendet.
- [NICHT GEPRÜFT] ORS, BRouter, KI-Anbieter, Cloud Tasks, Firebase Auth/App Check, Firestore-Rules im Emulator, Wallet-Settlement und manuelle UI wurden nicht real gegen ein eingerichtetes Projekt ausgeführt.
- [SCHLUSS] Die lokale Quell- und Testabnahme ist erfolgreich, die ausdrücklich verlangte reale Anbieter-/Cloud-Abnahme nicht. Deshalb bleiben Merge und Push bis zu einer freigegebenen Testumgebung mit Providerzugängen, Cloud Tasks/IAM und belastungsfreier Testwallet zurückgestellt.

## Aktualisierung nach Sessionfortsetzung und Push-Auftrag

[FAKT] Der Firebase-Projektzugriff und die lokale Emulator-Portbindung funktionieren inzwischen. Die Rules-Suite bestand zweimal mit 18 Tests. Anschließend bestand die neue Premium-Transaktionssuite im Demo-Emulator mit 11 Tests; die aktuelle App-Regression meldete 445 bestandene Tests, Functions 169. App- und Functions-Build sowie der korrigierte Predeploy-Hook bestanden.

Der Benutzer hat den Push der Arbeit aus den letzten beiden Sessions ausdrücklich beauftragt und zuletzt angewiesen, den Stand jetzt abzuschließen und alle ungetesteten Punkte zu dokumentieren. Die frühere bedingte Zurückstellung des Git-Pushs ist damit überholt. Cloud-Freigabeflags und Deployment werden dadurch nicht aktiviert. Die aktuelle Liste einschließlich verbleibender Cloud-/Anbieterabnahme und nicht ausgeführter Mutationstests steht in [OPEN_POINTS_ROUTING_2026-10-31.md](OPEN_POINTS_ROUTING_2026-10-31.md).
