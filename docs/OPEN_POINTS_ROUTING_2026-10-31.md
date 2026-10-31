# Offene Punkte: Routing und Premium-KI

Stand: 31.10.2026. Arbeitsbranch: `codex/routing-open-points-20261031`.
Dieses Dokument ist die aktuelle Aufgabenliste. Ältere Bestandsaufnahmen und Sessionprotokolle bleiben historische Nachweise.

## Vor einer Cloud-Freigabe erforderlich

| Punkt | Aktueller Stand | Nächster Schritt / fehlende Voraussetzung |
|---|---|---|
| Betreiber-Router | [FAKT] Im Worktree ist kein bestätigter BRouter-Endpunkt konfiguriert. Der öffentliche BRouter-Demodienst wird nicht automatisch eingesetzt. | Betreiber-Endpunkt, tatsächliche Version, Graphstand und räumliche Abdeckung festlegen; echte Antworten und Alternativen anhand derselben Validatoren prüfen. |
| KI-Anbieter und Modell | [FAKT] Adapter für Vertex, Gemini, OpenAI und Anthropic liegen vor; eine reale Modellkonfiguration wurde nicht bestätigt. | Anbieter und Modell festlegen, Zugang und Region prüfen, mit minimalen synthetischen Kandidaten testen. Keine Geheimnisse im Repository oder Chat speichern. |
| Zusätzlicher Router | [FAKT] ORS-Adapter und Tests vorhanden. [NICHT GEPRÜFT] Reale ORS-Zugangsdaten, Kontingente und Antworten. | Optionalen Anbieterzugang einrichten und separat prüfen; Limits für Alternativen beachten. Kein stiller Anbieterwechsel. |
| Deployment | [FAKT] Die lesende Firebase-Abfrage der fortgesetzten Session ergab `result: []` für Functions in `der-wegweiser`. | Nach vollständiger Konfiguration gezieltes Deployment und Prüfung der exportierten Endpunkte. Ein Git-Push stellt keine Cloud Functions bereit. |
| Cloud Tasks / IAM / Scheduler | [FAKT] Outbox, Worker und Reconciliation sind im Code vorhanden. [NICHT GEPRÜFT] Reale Queue-Zustellung, Berechtigungen und Scheduler. | Worker privat bereitstellen; Queue-Zugriff und Scheduler im Projekt prüfen; reale doppelte Zustellung und Retry ohne echte Tokenbelastung testen. |
| Firebase Auth / App Check | [FAKT] Handler prüfen Auth und App Check; Rules-Emulatortests bestanden zweimal. [NICHT GEPRÜFT] Echte Clienttokens und produktive Durchsetzung. | App-Check-Clientkonfiguration und reale angemeldete Requests prüfen. Emulator-Handleraufrufe ersetzen keine Prüfung gültiger/ungültiger Tokens. |
| Wallet und Abo | [FAKT] Wallet- und Premium-Transaktionen sind implementiert. [NICHT GEPRÜFT] Belastungsfreie Cloud-Testwallet und aktives Testabo. | Dediziertes Testkonto mit dokumentiertem Anfangssaldo einrichten; Reserve/Capture/Release samt Wiederholung und Kontolöschung prüfen. Keine Nutzerkonten oder echten Guthaben als Testdaten verwenden. |
| Suchindex | [FAKT] Eventtrigger und begrenztes Dry-run-Backfill vorhanden. | Indexdefinitionen in Testumgebung bereitstellen; erst Dry-run, dann bewusstes Backfill; wiederholte Ausführung und Löschung veralteter Einträge prüfen. Bisher keine Cloud-Migration ausgeführt. |
| Private Routenartefakte | [FAKT] Serverpfade liegen unter `users/{uid}/route-archive/`; Kandidaten haben Prüfsummen. | Storage-Konfiguration und tatsächliche Zugriffssperren prüfen; Kontolöschung einschließlich Artefakten und laufenden Aufträgen in einer Testumgebung abnehmen. |
| Manuelle End-to-End-Abnahme | [NICHT GEPRÜFT] Suche → geordnete Stopps → Preisbestätigung → Auftrag → Vorschau → Archiv → Wiederherstellung in einer realen Firebase-Umgebung. | Mit Testkonto ausführen, auch Offline-/Abbruch-/Neuladefälle. Erst danach Premiumfreigabe erwägen. |

## Weitere funktionale und betriebliche Grenzen

| Punkt | Grenze / verbleibende Arbeit |
|---|---|
| Aufbewahrung und Ressourcenlimits | Premiumartefakte bleiben derzeit bis zur Kontolöschung bestehen. Automatische Aufbewahrungsfrist, Speicherquote, Bereinigung verwaister Uploads und produktives Monitoring sind noch einzurichten. Vor automatischer Löschung muss die gewünschte Aufbewahrung feststehen. |
| Oberfläche, Akku, Interessen und Freitext | Werden serverseitig abgewiesen, solange belastbare Routendaten und bestätigte UI-Eingaben fehlen. Nicht als erfüllt bewerben. Erfordert jeweils Datenquelle, Validatoren, Tarifvertrag und UI-Abnahme. |
| Fahrthistorie als Personalisierung | Scoringgewicht bleibt 0. Eine spätere Nutzung benötigt explizites Opt-in, Datenqualitätsprüfung und Rücksetz-/Löschmöglichkeit. |
| Tracksynchronisierung | Aufgezeichnete Fahrten bleiben lokal; serverseitig wiederherstellbare Premiumpläne sind davon getrennt. Eine Cloud-Trackhistorie ist nicht implementiert. |
| Rundtouren und Offline-Routing | Bleiben gesperrt, bis echte Netzanker beziehungsweise ein geprüfter lokaler Router verfügbar sind. |
| Gezielte Mutationstests | [NICHT GEPRÜFT] `functions/scripts/verifyPremiumMutations.mjs` wurde ergänzt, aber auf ausdrücklichen Wunsch nach sofortigem Abschluss nicht ausgeführt. Das Skript verändert vorübergehend Capture und Eigentümerprüfung und stellt den Quelltext im `finally` wieder her. Es liegt kein Mutationsergebnis vor. |
| Test-Wiederholung und UI-Warnungen | Die neue Premium-Emulatorsuite bestand einmal vollständig (11 Tests); Wiederholung nach erfolgreichem Gesamtlauf steht aus. Vitest enthält weiterhin 2 übersprungene Dateien, 1 übersprungenen Test und 11 TODOs; bestehende React-/Auth-Mock-Warnungen sind nicht bereinigt. |
| Coverage und produktive Freigabe | Bestandenes Build und gezielte Tests belegen keine vollständige Coverage oder Live-Betriebsbereitschaft. Die Releaseentscheidung bleibt an die oben genannten Cloud-Nachweise gebunden. |

## Lokale Prüfungen reproduzieren

Voraussetzungen: vorhandene Projektabhängigkeiten, Java und Firebase-CLI; keine automatische Installation.

```sh
npm run build
npm test -- --reporter=dot
npm --prefix functions run build
npm --prefix functions test -- --runInBand
firebase emulators:exec --only firestore --project demo-wegweiser 'node --test tests/firestore.rules.test.mjs'
firebase emulators:exec --only firestore --project demo-wegweiser 'npm --prefix functions test -- --runInBand --runTestsByPath tests/premiumRoute.emulator.test.ts'
```

Die Premium-Integrationssuite führt echte Firestore-Transaktionen ausschließlich gegen den Loopback-Emulator und `demo-wegweiser` aus. Router, KI, Object Storage und Cloud Tasks sind dort Testdoubles. Ohne passenden Emulator und Demo-Projekt wird diese Suite übersprungen. Cloud-IAM, echte Anbieter, Storage-Dauerhaftigkeit und tokenbasierte Authentifizierung sind damit ausdrücklich nicht bewiesen.

## Veröffentlichung dieses Arbeitsstands

Der Benutzer hat ausdrücklich den Push der Arbeit aus den letzten beiden Sessions sowie dieses Dokuments beauftragt. Veröffentlicht wird der geprüfte Quellstand auf dem Arbeitsbranch. Dies setzt weder die Premium-Freigabeflags noch ersetzt es die ausstehende Cloud-/Anbieterabnahme. Konkrete lokale Prüfergebnisse und der veröffentlichte Commit werden im Abschlussprotokoll festgehalten.

## Prüfergebnis vor dem Push

- [FAKT] `npm run build`: erfolgreich.
- [FAKT] Tatsächlicher `functions.predeploy`-Befehl aus `firebase.json`, mit absolutem `RESOURCE_DIR`: erfolgreich; Functions-TypeScript kompiliert. Die zuvor falsche Quotierung wurde nach lokaler Sicherung korrigiert.
- [FAKT] `npm test -- --reporter=dot`: 43 Dateien bestanden, 2 übersprungen; 445 Tests bestanden, 1 übersprungen, 11 TODOs. Keine Testdatei vom Lauf ausgeschlossen.
- [FAKT] `npm --prefix functions test -- --runInBand`: 18 Suiten / 169 Tests bestanden; 11 emulatorgebundene Tests außerhalb der Demo-Umgebung planmäßig übersprungen.
- [FAKT] Dedizierter Demo-Emulatorlauf: 11 Premium-Integrationstests bestanden. Geprüft: gleichzeitige Wiederholung ohne Doppelreservierung, Prioritätskonflikt, Capture nach Speicherung aller drei Kandidaten, Fremdzugriff, Storno vor/während Arbeit, Artefaktmanipulation, Archivpagination mit identischen Zeitstempeln, Queue-Outbox-Recovery, transienter/permanenter KI-Fehler, Speicherausfall, abgelaufene Worker-Lease, fehlendes App Check, ungültiges Angebot, unzureichender Saldo und nicht unterstützte Präferenzen.
- [FAKT] Sechs gezielte Clienttests bestanden: Abbruch während Polling, Consent-/Kontowechsel, fehlgeschlagene Stornobestätigung, fremde Auftrags-ID und abgelehntes Preisangebot. Sie sind auch im vollständigen Vitest-Lauf enthalten.
- [FAKT] Rules-Emulator: aus der unmittelbar vorherigen Session zweimal 18/18 Tests bestanden.
- [NICHT GEPRÜFT] Vollständige Coverage, Mutationstest-Ergebnis, echte Router-/KI-/Storage-/Cloud-Tasks-Aufrufe und manuelle Browser-Abnahme. Es wurde kein Produktionsrelease abgenommen.
- [FAKT] Nach Benutzeranweisung werden verbleibende ungeprüfte Punkte dokumentiert; weitere umfangreiche Tests werden für diesen Push nicht begonnen.
