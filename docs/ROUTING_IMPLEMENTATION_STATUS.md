# Routingumsetzung – Arbeitsstand und Übergabe

Stand: 27.10.2026. **Teilumsetzung, keine Produkt- oder Betriebsfreigabe.**

## Auftrag und isolierte Arbeitskopie

[FAKT] Ursprung `/Users/pascalgregor/Documents/DER-WEGWEISER(AndroidStudio)` auf `main`, Commit `8447969`. Neuer Worktree `/Users/pascalgregor/Documents/worktrees/wegweiser-routing`, Branch `codex/routing-implementation-20261027`, vom ausdrücklich beauftragten Commit. Ziel/Branch waren zuvor nicht vorhanden. Die drei ungetrackten Pläne wurden kopiert. `.artifacts/` im Ursprung blieb unangetastet. Keine Installation, kein Push, kein Deploy, kein Modellkauf und kein Graphdownload.

Die frühere Warteanweisung in den Plänen ist durch den Umsetzungsauftrag aufgehoben. Die Gates, Daten-/Gerätenachweise und das Veröffentlichungsverbot bleiben bestehen. Keine Agenten verwendet. Lokale Bibliotheken werden über ignorierte `node_modules`-Symlinks wiederverwendet; für eine unabhängige spätere Installation sind die vorhandenen Lockfiles maßgeblich.

## Phase 0 – gemessener Bestand

- Node `v24.21.0`, Java Temurin `26.0.2.1`, Google Cloud SDK `588.0.0`, ADB `37.0.1`; Android-SDK-Verzeichnisse vorhanden. Das beweist keinen erfolgreichen Androidbuild.
- Reale BRouter-Probe mit neutralen Berliner Testpunkten: `curl --max-time 15 --fail --silent --show-error 'https://brouter.de/brouter?lonlats=13.40,52.52%7C13.41,52.52&profile=trekking&alternativeidx=0&format=geojson&timode=2'`. Ergebnis: Exit 6, DNS-Auflösung fehlgeschlagen. Keine echte Fixture gespeichert, Via-/Manöverprobe weiterhin offen.
- `bibel.local`: DNS-Fehler; lokaler Snapshot `/Users/pascalgregor/.codex/bibel/Bibel-v2.1.md` und passende Kapitel gelesen. Keine rechtliche Konformitätsbehauptung.
- `gcloud auth list --filter=status:ACTIVE --format='value(account)'`: kein aktives Konto. Projektzugriff, Billing, regionale Providerantwort und Preisfreigabe fehlen. Keine Anmeldung oder Kontoverbindung ausgelöst.
- Der vorhandene Functions-Abhängigkeitsbaum enthält `@google/genai` 1.52.0 einschließlich Typdefinitionen. Das Paket ist in `functions/package.json` noch keine direkte gepinnte Abhängigkeit; kein reproduzierbarer SDK-Integrationsnachweis. Vorhandenes Legacy-Vertex-SDK ist kein Ersatz für die Modellprobe.
- `adb devices`: Start des lokalen Listeners mit `Operation not permitted` fehlgeschlagen, außerdem USB-Interfacefehler. Keine Geräte-, Flugmodus-, Speicher- oder Hintergrundmessung möglich.
- Frontend-Ausgangslauf `npm test -- --reporter=dot`: 32 Suites bestanden, 2 übersprungen, 1 fehlgeschlagen; 375 Tests bestanden, 13 übersprungen, 11 todo. Fehler in `tests/scripts/anthropicFederationExchange.test.ts`: lokaler Socket `127.0.0.1` mit EPERM verweigert, danach Hooktimeout. Bestehende React-act-/Mockwarnungen sichtbar.
- Functions-Ausgangslauf `npm test -- --runInBand`: 7 Suites bestanden, 2 fehlgeschlagen; 112 Tests bestanden, 8 fehlgeschlagen. Sieben Fehler in `issueGoogleMapsKey.test.ts` (Subscription-/Ratenlimit-Mocks), einer in `accountDeletion.test.ts` (Bereinigung). Diese Fehler bestanden vor neuen Produktionsänderungen; ihre Ursache wurde nicht abschließend behoben.

### Aufrufinventar (gelesener Quellcode)

| Bereich | Produzenten und Konsumenten | Noch offene Umstellung |
| --- | --- | --- |
| Heute/Neuplanung | `App.tsx:handleRegenerateRoute` → `AiAssistantService.generateAnticipatedRoute` → `RoutingService.generateBikeRoute` und Browser-KI-Text | echter Premiumjob statt Beschreibung |
| Automatische Abweichung | `useRouteTracker.ts` → `App.tsx:handleAutoReroute` → neue KI-Rundtour | Originalsession, kostenloser Rejoin, keine KI |
| Ziel/Erweitert | `App.tsx:handlePlanRouteToPoint` → `AiAssistantService.generateDestinationRoute` | Standard/AI und online/local trennen |
| Station | `handlePlanRouteToStation` berechnet Rundtour, ersetzt letzten Punkt | echtes Zielrouting |
| Suche | `components/Search/SearchInput.tsx` öffentliche Nominatim-Debounces | Betreibersuche nach Absenden, Generation/Abort |
| Import | `gpxImportService.ts`, GPX-Modal/gespeicherte `Route` | Legacy als ungeprüfter Track; kein Validated-Cast |
| Browser-KI/Legacyserver | `ai/aiGatewayService.ts`, `vertexCloudAgentService.ts`, `functions/src/vertexRouting.ts:computeRoute` | nach Migration schließen; Stub nicht als Premium verwenden |
| Geld | `tokenRewards.ts` Quiz/Rad, `index.ts` Gutscheine, `dataRepository.ts` Leser, `firestore.rules` | gemeinsame Transaktionswriter, Löschsperre, Unlimited-Ausnahme entfernen |

[RISIKO] Bestehende Legacy-Produktrouten sind in diesem Stand noch nicht umgestellt. Ihre Kreise/Luftlinien, erfundenen Fakten, KI-Reroutes und alten Walletpfade sind keine implementierte Zielarchitektur und nicht freigegeben. Die neuen Module sind bewusst noch nicht in diese UI integriert; allein ihr Hinzufügen behebt die alten Laufzeitpfade nicht.

## Implementierte unabhängige Vorarbeit

| Paket | Dateien | Ergebnis und Grenze |
| --- | --- | --- |
| 1.1/1.2/1.4 | `functions/src/routing/contracts.ts`, `src/types/routing.ts` | Ein gemeinsamer Browser-/Functions-Vertrag: SI/benannte Koordinaten, Standort-/Profilsnapshot, getrennte Planungs-/Ausführungsmodi, Metrikqualität, Manöver, Fähigkeiten, Originalsession, Fehlercodes. Preislimits zentral. Kein reales Fähigkeitsendpoint. |
| 1.3 | `src/services/routeCoordinator.ts` | Vorschau getrennt von aktiver Fahrt; Generation, Abort, Auth-/Consentinvalidierung. Premium bis zum Backend geschlossen. Noch kein Reactanschluss, kein persistenter Premiumjob/-cancel. |
| 1.5/2A.5 Vorbereitung | `functions/src/routing/geometry.ts`, `validation.ts` | Runtime-Eingaben, endliche Koordinaten, Geometrie-/Artefaktgrenzen, Endpunkte, segmentbasierte Via-Reihenfolge, Distanzvergleich, harte Kriterien, Manöverindex/-distanz, SHA-256-Request-/Inhaltshash, unveränderliches Ergebnis, opaker Validated-Typ. Kein unabhängiger Beweis jeder Graphkante; echte Adapter-/Abdeckungs-/Profilregistry noch nötig. |
| 2B.1/2B.2 Vorbereitung | `functions/src/wallet/ledger.ts` | Reine Integer-/Saldo-/Reservierungsinvarianten, credit/reserve/capture/release/spend/refund, Replaykonflikte, Sperrprüfung, striktes Opening und read-only Audit ohne Summenpräzisionsverlust. Noch keine Firestore-Transaktionen, keine umgestellten Writer und keine Kontomigration. |
| 3B Vorbereitung | `src/services/navigationProgress.ts` | Segmentprojektion mit Fortschrittsfenster, Messalter/Genauigkeit, Sprungfilter, Drei-Fix-/8-s-Hysterese, Rückkehr-/Cooldown-/Ein-Auftrag-Logik, maximal fünf Vorschläge vor nächstem Pflichtstopp. Synthetische Unitfälle, kein räumlicher Index, keine echten Rejoinstrecken/Routerkosten, keine Hook-/Geräteintegration. |

## Gates und ausstehende Arbeit (vollständiger Auftrag bleibt erhalten)

- **Gate 0: offen.** Echte P2P-/Via-/Manöverantworten und bestätigter regionaler Modellzugriff fehlen. Betreibergraph, Nominatim/PostGIS, OSM-Import/Lizenzen, CPU/RAM/Volumen-/Kostenmessung nicht vorhanden/geprüft. Früherer Push wurde nicht per Remote geprüft.
- **Gate 1: teilweise.** Beide Projekte kompilieren den gemeinsamen Vertrag; Unitfixtures sind ausdrücklich synthetisch. Keine eingefrorene Provider-/Nativeintegration oder echte Routerfixture behauptet.
- **2A: nicht abgenommen.** Betreiberinfrastruktur, Free-Callable, Suche/POIs, Profilregistry, Rundtourbewertung, Fallbackentfernung und früher UI-Freefluss offen.
- **2B: nicht abgenommen.** Nur reiner Kern vorbereitet. Transaktionsadapter, sämtliche Writer, Regeln, Migrationspause/-durchlauf, Kontolöschworkflow, Emulator-Konkurrenzfälle und volle kritische Mutationstests offen.
- **2C: blockiert/nicht begonnen.** Gepinnter nativer BRouterkern, originale Segmentdaten und physisches Gerät mit messbarem Zugriff fehlen. Keine Offlinefähigkeit zusagen.
- **3A: blockiert durch 2A/2B/Modellprobe.** Quotes, Jobs/Outbox/Leases/Worker, private Artefakte, Planung/Auswahl, Budgets, Cancel/Sweeper und alte Endpunktmigration vollständig offen.
- **3B: nicht abgenommen.** Reiner Tracker vorbereitet; räumlicher Index, Pflichtstoppnachweis, tatsächliche kostenlose Verbindungen/Routerkosten, Hook/Manöver/Ansagen und vollständige Sessionintegration offen.
- **3C/4B: warten auf native Abnahme.** Manifest/Download/Keystore/Foreground-Service, Paket- und Sessionlebenszyklus sowie Online-/Offline-Rejoin offen.
- **4A: wartet auf Backendgates.** Menü, echte Suche/Startwahl, Käufer-/Job-/Fehler-/Vorschauintegration und Mobilabnahme offen.
- **5/6: nicht freigegeben.** Gesamtkorpus, Migration auf Testkopie, kritische Geld/Auth/Jobabnahme, reale Plattform-/Netz-/Pilotmessungen, Betriebswerte und ausdrückliche Betriebsfreigabe fehlen. Kein Deployment/Push beauftragt.

## Sichere Fortsetzung

1. In genau diesem Worktree starten; `git status` und diesen Bericht lesen, keine neuen Branches/Installationen nötig. Keine vorhandenen Änderungen zurücksetzen.
2. Netzwerkfähige Ausführung für kleine Routerproben und Zugriff auf die gewählte Betreiberinstanz bereitstellen; reale P2P-/Via-/Manöverfixtures erst danach als solche speichern. BRouter-Upstream v1.7.10 ist nur ein geprüfter Releasekandidat, noch kein gebauter/gepinnter Projektadapter.
3. Autorisierten regionalen Modellzugriff ohne Geheimnisse im Chat prüfen; tatsächliche SDK-Abhängigkeit reproduzierbar pinnen. Kein automatischer Regions-/Modellwechsel, kein Budgetversprechen aus Dokumentation.
4. In einer Umgebung mit erlaubten lokalen Listenern Emulator-/ADB-/Strykerprüfungen durchführen. Die Socketbeschränkung nicht durch fremde Rechner oder Cloudfallback umgehen.
5. Erst mit echten Verträgen 2A und 2C fortführen, Wallettransaktionen/Migration unabhängig vorbereiten und abnehmen. Danach weitere Phasen gemäß unverändertem Arbeitsplan.

Rollback: Neue Vorarbeitsmodule haben keine bestehenden Konfigurationen oder Produktionswriter ersetzt. Git-Basis `8447969` und das unveränderte Ursprungsrepo bleiben Referenzen. Keine pauschalen Reset-/Löschbefehle für Benutzerdaten.

## Externe Quellenprüfung (27.10.2026)

[FAKT] Die [Google-Modellseite](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash) nennt `gemini-3.5-flash` als GA, strukturierte Ausgabe und `europe-west3` in der Regionsliste. Standard PayGo wird dort gesondert nur für global/us/eu aufgeführt. [RISIKO] Das bestätigt den geplanten regionalen Bezugs-/Abrechnungsweg noch nicht. Keine Ausweichregion gewählt. Abruf der offiziellen Preisseite scheiterte mit Timeout; aktuelle Preise bleiben ungeprüft.

[FAKT] Die [BRouter-Releases](https://github.com/abrensch/brouter/releases) und der [ServerHandler auf v1.7.10](https://github.com/abrensch/brouter/blob/v1.7.10/brouter-server/src/main/java/btools/server/request/ServerHandler.java) wurden als Primärquellen geöffnet. Kein gebauter nativer Kern und kein Real-Graph-Vertrag daraus abgeleitet. Der öffentliche Webabruf ersetzt die gescheiterte direkte Routerprobe nicht.

## Prüfungen der neuen Vorarbeit

- `./node_modules/.bin/vitest run tests/services/routingContracts.test.ts tests/services/navigationProgress.test.ts --reporter=dot`: 27 Tests bestanden; mehrfach nach relevanten Änderungen ausgeführt. Synthetische Geometrien sind im Test explizit bezeichnet. Fehlerfälle: ungültige Eingaben, Endpunkte/Via-Reihenfolge, harte Kriterien ohne Evidenz, Manöverindex, Consent/Auth-/Requestrennen, GPSqualität, Rundtourstart, Rejoinhysterese/-limits.
- `npm run build` im Worktree und in `functions`: erfolgreich. Browser und Functions kompilieren dieselben Routingdateien; kein Code-Duplikat. Der Frontendbuild ist kein Laufzeit-/Gerätenachweis.
- `cd functions && npm test -- --runInBand tests/walletLedger.test.ts --coverage --collectCoverageFrom=src/wallet/ledger.ts --coverageReporters=text`: 13 Tests bestanden, 98,70 % Statements, 100 % Funktionen/Zeilen, 96,66 % Zweige. Ausschließlich dieser reine Kern gemessen; keine Gesamtsystem- oder Transaktionsabdeckung.
- `cd functions && NODE_OPTIONS=--experimental-vm-modules ./node_modules/.bin/stryker run stryker.wallet.conf.js`: EPERM beim lokalen Listener, kein vollständiger Mutation-Score. Reproduzierbare Konfiguration liegt bei.
- `scripts/check_wallet_mutations.py`: gezielte Ergänzung ohne Listener. Ein erster Lauf wurde nach einer getöteten Mutation wegen mehrdeutiger Ersetzung abgebrochen; Quelle im `finally` wiederhergestellt und Ersetzung präzisiert. Ergebnis des vollständigen erneuten Laufs wird unten dokumentiert.
- Drei kopierte Pläne byteweise mit dem Ursprung verglichen: identisch. `git diff --check`: keine Whitespacefehler. Keine bestehende Anwendungskonfiguration verändert; keine Kontoverbindung eingerichtet.


## Abschließender lokaler Stand

[FAKT] Der erneute gezielte Mutationslauf `python3 scripts/check_wallet_mutations.py` hat alle **7/7** kuratierten Mutationen durch echte Testfehler erkannt: negative Beträge, negative Salden, falsches Capture-/Release-Delta, veränderte Replaybeträge, ignorierte Kontosperre und wiederholbare Erstattung. Baseline bestand, Quelle wurde im `finally` wiederhergestellt. Das ist kein vollständiger Stryker-Mutationsscore und kein Emulator-/Authnachweis. Anschließender Wallet-Testlauf nach der Fehlerweitergabe im Audit: 13/13 bestanden, aktuelle Coverage wie oben. Anschließende Builds beider Projekte bestanden.

Lokale Umsetzungseinheiten:

| Commit | Inhalt | Prüfung/Restgrenze |
| --- | --- | --- |
| `dfd0e34` | Kopierte Pläne und Phase-0-/Gatebericht | Pläne identisch; keine Implementierungsabnahme |
| `bead64f` | Gemeinsamer Vertrag, Validator und Coordinator | Vertrags-/Race-Unitfälle; echte Fixtures fehlen |
| `957c86c` | Fortschritts-/Rejoinvorarbeit | Synthetische Trackerfälle; keine Integration |
| `4fa01e3` | Normalisierte Requesthashes und Übernahmebindung | Routingtests jetzt 27/27, Frontendbuild bestanden |
| `2adbd10` | Walletkern, Audit und Prüfskripte | 13/13 Unitfälle, gemessene Coverage, 7 kuratierte Mutationen; Transaktionen/Migration offen |

[FAKT] Ursprungs-`main` verbleibt auf `8447969`. Keine Änderungen an bestehenden Anwendungs-/Betriebskonfigurationen und keine produktiven Wallet-/Routingwriter migriert. **Der vollständige Arbeitsplan ist nicht abgeschlossen.** Diese Übergabe hält alle offenen Arbeitspakete fest; echte Integrations- und Betriebsnachweise sind die nächsten zwingenden Gates, keine durch Unit-Tests ersetzbaren Formalitäten.
