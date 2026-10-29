# Routingumsetzung – aktueller Arbeitsstand

Stand: 29.10.2026. **Lokal weiter umgesetzt; Gesamtplan und Betriebsfreigabe weiterhin offen.**

Arbeitskopie: `/Users/pascalgregor/Documents/worktrees/wegweiser-routing`, Branch `codex/routing-implementation-20261027`, Basis `8447969`. Ursprung/main bleibt unverändert. Keine Agenten, Installation, Graphdownloads, Kontoverbindung, Livekontomigration, Push oder Deployment. Der vollständige [Arbeitsplan](ROUTING_IMPLEMENTATION_WORKPLAN.md) und [Architekturvertrag](ROUTING_AI_ARCHITECTURE_PLAN.md) bleiben maßgeblich. Die frühere Warteanweisung wurde vom Benutzer aufgehoben; der Auftrag umfasst weiterhin alle Phasen.

Der [historische Ausgangsbericht](ROUTING_BASELINE_20261027.md) hält die erste Phase und ihre damaligen Grenzen fest. Die folgende Fortsetzung ersetzt dessen Implementierungsstatus.

## Archivauftrag vom 28.10.2026 – Abschluss am 29.10.2026

[FAKT] Automatisches Gerätearchiv und Fahrtenhistorie sind implementiert. Jede erfolgreich berechnete Strecke wird vor ihrer Vorschau in einer IndexedDB-Transaktion gespeichert; neue Varianten überschreiben frühere nicht. Auch eine durch eine neue Vorschau abgelöste Berechnung bleibt bei unverändert gültigem Auth/Consent erhalten. Ungefahrene und alle gespeicherten Strecken sowie tatsächliche Fahrten sind getrennt zugänglich. Wiederholungen derselben Planung erhalten eigene Fahrteinträge; Originalplanung und tatsächlicher GPS-Track bleiben getrennt.

Aufzeichnungsstart und -abschluss warten auf erfolgreiche Speicherung. Unterbrochene Aufzeichnungen behalten bestätigte Zwischenstände. Quota-/Transaktionsfehler bleiben sichtbar mit Retry/Export, statt als erfolgreiche Speicherung zu gelten; bis zur offenen Sicherung ist weitere Generierung gesperrt. Alte lokale Routen werden idempotent importiert, kleinere Cloudbestände überschreiben den Offlinebestand nicht. Die festen Beispielwerte wurden aus der Fahrtenstatistik entfernt. Die gemeinsame Consentversion 3 und die Informationstexte berücksichtigen die neue Aufbewahrung.

Vollständige lokale Prüfungen am 28.10.: **427 Frontendtests bestanden**, 41 Suites bestanden, 2 Suites übersprungen, 1 Test übersprungen, 11 todo; die bekannte Socket-Suite bleibt ausdrücklich ausgeschlossen. **156 Backendtests bestanden**, 15/15 Suites. Beide Builds bestanden. Die 17 gezielten Archivprüfungen wurden am 29.10. erneut ausgeführt: 17/17 bestanden. Lint meldete keine Fehler, aber verbleibende überwiegend vorhandene Warnungen. Es wurde kein Browser-/Android-Gerätetest vorgetäuscht.

[RISIKO] Das ist ein lokales Gerätearchiv, keine neu eingerichtete Cloud-/Mehrgeräte-Sicherung. Ein abruptes Beenden kann letzte noch nicht bestätigte Messungen verlieren. App-/Browserdatenlöschung, Geräteverlust oder ausdrücklicher Widerruf bleiben relevante Grenzen. Das gesperrte Premium-KI-Backend ist nicht freigeschaltet; der Architekturvertrag verlangt dort nun dauerhaftes serverseitiges Archivieren vor `ready`/Capture, ohne 24-h-Verfall gültiger Ergebnisse. Details: [Streckenarchiv und Fahrtenhistorie](ROUTE_ARCHIVE_AND_RIDE_HISTORY.md).

Die nachfolgenden Abnahme- und Zugriffsgrenzen stammen aus der vorherigen Routingarbeit; Anbieter-/Gerätezugänge wurden im Archivauftrag nicht neu geprüft.

## Seit der Fortsetzung tatsächlich geändert

- **Wallet/Writer:** echter gemeinsamer Firestore-Transaktionsadapter mit deterministischen Belegen, Reservierungszuständen, Pause/Schemaversion, Sperrprüfung, Openingbelegen und strikt wiederholbarer Einzelkontomigration. Quiz, Rad und Gutscheine sind umgestellt. Alte Unlimitedfelder stellen Gutscheine nicht mehr frei. Ungültige oder nicht migrierte Konten erhalten kein erfundenes Guthaben.
- **Regeln/Löschung:** direkte Konto-/Ledger-/Jobschreibzugriffe einschließlich Kontolöschen gesperrt; eigene Belege lesbar. Kontolöschung setzt eine Löschsperre, löst offene Reservierungen und entfernt persönliche Belege/Jobs/Subscriptiondaten. Verspätete Walletarbeit kann das Konto nicht wieder anlegen. Lokale Löschfehler werden sichtbar gemeldet; andere Bereinigungen werden trotzdem versucht.
- **Ausgangsfehler:** die acht ursprünglichen Functions-Fehler sind behoben: veraltete Subscription-Testdaten, nicht zurückgesetzte Mocks und ein unvollständiger Lösch-Mock. Die produktive Subscription-Autorisierung wurde dafür nicht gelockert.
- **Suche:** Betreiber-Callable und Browseradapter, explizites Absenden, maximal fünf Ergebnisse, Eingabe-/Antwortprüfung, Timeout, Ratenbegrenzung, Generation/Abort und Consent-/Authschutz. Öffentliche Nominatim-Autocomplete entfernt; Koordinatenauswahl funktioniert ohne neue Geocodinganfrage.
- **Free-Routing:** vorbereitetes geschlossenes Betreiberbackend, Capabilityantwort, feste Profil-/URLgrenzen, Größen-/Zeitlimits und gemeinsame Validierung. Browser prüft Geometrie und kanonische Request-/Inhaltshashes erneut; Free kostet 0 Token und verwendet keinen Modell-/Walletendpunkt. Tatsächliche Betreiberfreigabe und Manöver bleiben ausstehend.
- **Einstiege/Navigation:** kostenlose Ziel- und Stationsplanung verwenden denselben Vertrag. Keine nachträgliche Zielpunktverschiebung. Vorschau ersetzt eine Strecke erst nach Übernahme. GPS-Messzeit/-genauigkeit und manuelle Startwahl ersetzen den stillen Berliner Standardstart. Kreis-/Luftlinien-/OSRMfallbacks, erfundene Oberflächen-/Ladeversprechen, winkelbasierte Straßennamen und künstliche Steigungsfarben entfernt. Alte/serialisierte Validierungsflags starten keine Führung.
- **Alte KI-Wege:** Legacy-`computeRoute` liefert keine Stubroute und ruft keinen Provider auf. Nicht abgenommene KI-Rundtour/Premium/Offlineplanung sind geschlossen. Automatische Abweichung ersetzt die Originalroute nicht mehr durch eine neue KI-Tour; noch fehlende echte Rückführung wird sichtbar benannt.

## Gates und verbleibende Arbeit

| Phase | Tatsächlicher Stand | Noch erforderlich |
| --- | --- | --- |
| 0/1 | Bestand, gemeinsame Verträge, Runtimeprüfungen und synthetische Fixtures vorhanden | Echte P2P-/Via-/Manöverantworten, Modell-/Regions-/Preisprobe und native Signaturen; vollständiges Gate 0/1 weiter offen |
| 2A | Free-/Suchendpunkte, Grenzen, Browser-/UIanschluss und Fehlerpfade implementiert, geschlossen | Eigene Instanzen/OSM-/Graph-/POIimporte, reales Profil-/Manöverfixture, Rundtouranker, Höhenqualität, Lizenzen, Daten-/Kostenmessung und echter Pilotfluss |
| 2B | Writer/Transaktionsadapter/Regeln/Löschworkflow und Tests implementiert | Echte Emulator-/Konkurrenzabnahme, Kontobestand/Dry-run und Belegabgleich, freigegebene Migration, vollständiger Mutationstest; Lock-/TTL-Aufbewahrung vor Pilot entscheiden |
| 2C | Nicht begonnen/freigegeben | Gepinnter nativer BRouterkern, originale kleine Pilotsegmente, zugängliches physisches 4-GB-Gerät und Flugmodus-/Cancel-/Speichermessung |
| 3A | Geschlossen; Legacybypass entfernt | Premiumquotes, Jobs/Outbox/Leases/Worker, echte Planung/Auswahl, Artefakte, Budgets, Cancel/Sweeper nach 2A/2B-/Modellgates |
| 3B | Tracker am UI angeschlossen, segment-/zeit-/qualitätsbasiert; keine KI-Reroutes | Räumlicher Index, vollständige Pflichtstoppfortschritte, echte Rejoinverbindungen/Routerkosten, Originalsession-/Manöverabnahme |
| 3C/4B | Gesperrt | Native Paketprüfung/-download, Keystore/Foreground-Service, private Sessionpersistenz und Online-/Offline-Rejoin nach nativer Abnahme |
| 4A | Free-Suche/Start/Ziel/Station/Vorschau/Fehler lokal verdrahtet | Premium-Kauf-/Job-/Heute-/Advancedfluss nach Backendgates sowie reale Mobil-/Browserabnahme |
| 5/6 | Keine Freigabe | Vollständiger Qualitätskorpus, reale Plattform-/Netz-/Migrations-/Provider-/Pilotnachweise, Betriebswerte und ausdrückliche Betriebsfreigabe |

## Reale Blocker

[FAKT] Betreiber-URLs sind nicht konfiguriert. Die direkte BRouterprobe scheiterte an DNS; auch der Webabruf der Test-API war nicht zugänglich. Keine echte Routerfixture oder private Betreiberinstanz wurde vorgetäuscht.

[FAKT] Weder eine lokale ADC-Datei noch `GOOGLE_APPLICATION_CREDENTIALS` ist vorhanden; die lokale Google-CLI hatte kein aktives Konto. Ein minimaler regionaler Modellprobeaufruf ist damit nicht durchgeführt. Preis-/Abrechnungsweg und Projektberechtigung bleiben offen. Kein automatischer Modell-/Regionswechsel.

[FAKT] Der erneute Firestore-Emulatorversuch scheiterte an `listen EPERM` auf lokalen Emulatorports. ADB und Stryker waren aus demselben Grund nicht nutzbar. Die Transaktionstests nutzen ausdrücklich einen atomaren In-Memory-Adapter mit Read-Version-Retries, keinen echten Emulator.

Für die tatsächliche Abnahme wurden die bereits eingerichteten Betreiber-URLs beim Benutzer angefragt; Zugangsdaten sollen ausschließlich lokal konfiguriert werden. Die Regeln, Grenzen und sichere spätere Reihenfolge stehen in [Lokale Prüfung und Betrieb](ROUTING_LOCAL_OPERATIONS.md).

## Prüfnachweise

[FAKT] Abschließende lokale Prüfläufe:

- `npm test -- --reporter=dot --exclude tests/scripts/anthropicFederationExchange.test.ts`: **410 bestanden**, 36 Suites bestanden, 2 Suites übersprungen, 1 Test übersprungen, 11 todo. Die bekannte Socket-Suite wurde ausdrücklich ausgeschlossen; ihr EPERM-Blocker bleibt offen. Keine neue stille Testausnahme.
- `npm test --prefix functions -- --runInBand --coverage '--collectCoverageFrom=src/wallet/*.ts' --coverageReporters=text`: **156/156 bestanden**, 15/15 Suites bestanden. Für die beiden Walletmodule: **100 % Statements/Funktionen/Zeilen, 97,60 % Zweige**; Adapter 96,92 %, reiner Kern 98,33 % Zweige. Das ist keine Abdeckung des gesamten Auth-/Job-/Migrationsbetriebs.
- `node --import tsx --test tests/services.test.mjs`: **3/3 bestanden**. Der ursprüngliche tsx-CLIaufruf benötigte einen hier verbotenen IPC-Listener; der Node-Loader führt dieselben lokalen Tests ohne diesen Listener aus.
- `npm run build` und `npm run build --prefix functions`: erfolgreich. Ein Build ist kein laufender Dienst oder Gerätebeweis. Die selbst erzeugten Änderungen an bereits getrackten Compilerartefakten wurden zurückgenommen; Quellen sind maßgeblich, vor Runtime/Deployment neu bauen.
- `python3 scripts/check_wallet_integration_mutations.py`: **6/6 ausgewählte Integrationsmutationen erkannt**, Quelle im `finally` wiederhergestellt. Zwei Vorläufe wurden wegen fehlendem VM-Modulmodus bzw. einer nicht kompilierbaren Mutante abgebrochen und nicht als getötete Mutationen gezählt. Danach gültiger Baseline- und Mutationslauf. Kein vollständiger Stryker-Score.
- Lint der geänderten/neuen TS-/TSX-Dateien: Exit 0, keine Fehler; verbleibende Warnungen (unter anderem vorhandene unbenutzte UIelemente/Hooks) nicht als fehlerfreie Codebasis verschwiegen.
- Whitespaceprüfung mit Berücksichtigung bestehender CRLF-Dateien: `git -c core.whitespace=trailing-space,space-before-tab,cr-at-eol diff --check`, ohne Fehler. Die drei Originalpläne bleiben unverändert.

Beim Integrationslauf gefundene Fehler wurden behoben: kanonische Hashes über Backend-/Browsergrenzen, Laufzeitschutz gegen gefälschte gespeicherte Validierungsflags, veraltete Winkelnavigations-Tests, Nullwertdarstellung, Erkennung von Teilfehlern bei Löschung und das Ratenlimit über den Stundenwechsel. Die Rate-/Geldtests verwenden keine echten Nutzerkonten oder Providerkosten.

Es wird keine vollständige Abnahme, Geräteprüfung, rechtliche Konformität oder Echtanbieterqualität aus Unit-Tests abgeleitet.

## Lokale Umsetzungseinheiten der Fortsetzung

| Commit | Inhalt | Restgrenze |
| --- | --- | --- |
| `bd3b687` | Atomare Walletwriter, Migration-/Löschsperren, Bereinigung und zugehörige Tests | Emulator-/Bestands-/Migrationsabnahme offen |
| `768ad31` | Geschlossene Betreiber-Suche/Free-API, Hash-/Validierungsgrenzen, Ratenlimit und Legacyendpunkt geschlossen | Eigene Dienste und echte Graph-/Manöverantworten fehlen |
| `52de967` | Free-Einstiege, bewusster Start/Vorschau, keine Scheinrouten/erfundenen Hinweise, Trackeranschluss und Tests | Vollständige Session-/Rejoin-/Premium-/Nativeintegration offen |

Rollback bleibt über diese lokalen Commits und Basis `8447969` nachvollziehbar. Es wurde nichts gepusht oder ausgerollt; insbesondere wurden keine produktiven Konten, Regeln, Flags oder Daten migriert.
