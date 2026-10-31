# Persönliche Routenplanung – Umsetzungsstand

Stand: 29.10.2026. Worktree-Zweig: `codex/routing-implementation-20261027`.

## Umgesetzt

- Die Startseite kennzeichnet KI-Premium, Heute-Tour und Offlineplanung nicht mehr als sofort verfügbare Funktionen.
- Die erweiterte Premiumansicht erfasst keine Wünsche mehr, solange der serverseitige Planer geschlossen ist.
- Die kostenlose BRouter-Zielroute bleibt die verfügbare Planungsstufe. Ihre UI erklärt, dass Untergrund und Freitext dort nicht ausgewertet werden.
- Das versionierte Requestschema erhält die explizite Untergrundpräferenz optional und normalisiert fehlende Werte auf `any`. Ein konkreter Untergrundwunsch wird als unbekannt zurückgemeldet, statt still verloren zu gehen.
- Wenn das bestätigte Nutzerprofil „starke Steigungen vermeiden“ setzt, fordert der kostenlose Router zusätzlich `alternativeidx=1` an. Die Anfrage ist auf drei Sekunden begrenzt, die Antwortgröße auf 8 MiB und die Hauptstrecke bleibt gültig, wenn die Alternative ausfällt.
- Die Auswahl nutzt höchstens zwei unterschiedliche, validierte Strecken mit bekannten Distanzen und BRouter-`filtered ascend`-Werten. Sie wählt den niedrigsten erfassten Anstieg, sofern die Alternative höchstens 10 Prozent länger als die kürzeste gemessene Strecke ist. Bei Gleichstand gewinnt die kürzere Strecke.
- BRouter-`filtered ascend` und `total-time` werden übernommen, wenn sie in der Antwort vorhanden und numerisch gültig sind. Energie bleibt unbekannt: BRouter-`total-energy` wird nicht als validierter E-Bike-Akkuverbrauch ausgegeben.
- Die Vorschau zeigt, ob Flachheit tatsächlich anhand zweier unterschiedlicher Kandidaten und bekannter Höhendaten bewertet werden konnte. Oberfläche und Freitext bleiben ausdrücklich unbewertet.
- Kriterienbefunde werden vor dem Hashen der Route validiert: begrenzte Anzahl und Feldlängen, zulässige Statuswerte und erforderliche Quellenangabe. Die optionale Untergrundangabe wird zur Rückwärtskompatibilität normalisiert.

Der alternative Index und die GeoJSON-Felder `filtered ascend` und `total-time` sind in BRouter 1.7.10 dokumentiert: [FormatJson.java](https://github.com/abrensch/brouter/blob/v1.7.10/brouter-core/src/main/java/btools/router/FormatJson.java), [ServerHandler.java](https://github.com/abrensch/brouter/blob/v1.7.10/brouter-server/src/main/java/btools/server/request/ServerHandler.java). Das belegt den Upstream-Vertrag, nicht die Konfiguration oder Antwort des Betreiberrouters.

## Bewusste Bewertungsregeln

1. Zielbindung, Pflichtstopps, passende Fahrradwege und explizite Ausschlüsse müssen zuerst deterministisch geprüft werden. Weiche Präferenzen dürfen sie nicht überschreiben.
2. Nur bekannte, quellengestützte Merkmale dürfen gewichtet werden. Fehlende Werte sind `unknown`, niemals null Prozent oder erfüllt.
3. Der jetzt implementierte Flachheitsvergleich ist eine eng begrenzte Vorstufe: eine optionale Alternative, maximal zehn Prozent Mehrstrecke, danach geringster bekannter Gesamtanstieg. Die zwei BRouter-Anfragen laufen parallel und sind zeit- und größenbegrenzt. Das ist kein Maximalsteigungsnachweis und keine KI-Planung.
4. Untergrund, Verkehrsstress, Beleuchtung, Wegqualität, Barrierefreiheit, Akkureichweite, Ladepunkte und Freitext erfordern zusätzliche echte Datenquellen bzw. validierte Profilparameter. Bis dahin werden sie nicht zur Routenauswahl behauptet.
5. Spätere Personalisierung aus Fahrtenhistorie bleibt optional und transparent. Eine aktuelle bestätigte Vorgabe muss gespeicherte Muster immer überstimmen; Rohstandortverläufe sind dafür nicht erforderlich.

## Noch nicht umgesetzt – Freigabegates

- **Routerprobe:** Betreiberantwort und Datenvertrag der tatsächlich gepinnten BRouter-Instanz für Ziel, Via, alternative Route, Höhen, Manöver und Profilparameter aufnehmen. Datenalter und Abdeckung müssen sichtbar sein. Live-Endpunkt und echte Antwort wurden hier nicht geprüft.
- **Profil-/Oberflächendaten:** versionierte, erlaubte Profile für Asphalt, Natur/Schotter und Steigung samt echten Messwerten und Sicherheitsgrenzen bereitstellen. Erst nach Probe die Requests damit erweitern. Der aktuelle Dienst bleibt fest auf `trekking`.
- **Echte KI-Planung:** Premium ist weiter geschlossen. `computeRoute` bleibt ein Legacy-Stub; es existiert kein Premiumangebot, persistenter Planungsjob oder Premiumworker für echte Kandidatenplanung. Der allgemeine Chat-/Textdienst ist kein Routenplaner.
- **Ausgewogene Alternativen:** mindestens drei unterschiedliche, validierte Kandidaten anhand bestätigter Wünsche vergleichen; harte Bedingungen vorher filtern. Auswahlkriterien und Trade-offs anzeigen. Der heutige Zweikandidatenvergleich für Flachheit darf nicht als vollständige Personalisierung gelten.
- **Profil und Verhalten:** Bike-/Akku-/Distanz-/Themenpräferenzen erst verwenden, wenn sie im gemeinsamen Vertrag bestätigt, capabilitygeprüft und mit echten Routermessungen verbunden sind. Fahrtenhistorie muss ein- und ausschaltbar sowie einsehbar bleiben.
- **Premium-Schutz:** Walletreservierung, Idempotenz, begrenzte Modell-/Routeraufrufe, Abbruch und Erstattung, private Artefakte und automatische dauerhafte Archivierung aller gültigen Ergebnisse/Alternativen vor `ready` integrieren.
- **Geführte Navigation:** echte BRouter-Manöver aus dem gepinnten Antwortformat abbilden und mit realer Fixture prüfen. Bis dahin ist die Geometrie nur Trackanzeige.
- **Freigabe:** Offline und kostenlose Rückführung bleiben separat geschlossen. Keine Konfiguration, Providerverbindung, Modellabfrage, Cloudressource, Bereitstellung oder Produktfreigabe wurde angelegt.

## Abnahme, die vor einer echten KI-Freigabe noch fehlt

- Fester Qualitätskorpus mit Stadt-, Land-, hügeligen, Via- und Rundtourfällen; Vorlieben paarweise variieren und Ergebniswirkung messen.
- Negativfälle für fehlende oder widersprüchliche Daten, unvereinbare harte Anforderungen, Router-/Modelltimeout, beschädigte Kandidaten, Consent-/Kontowechsel, Wiederholung und Archivierungsfehler.
- Prüfen, dass Änderungen an weichen Präferenzen nur dann die Route ändern, wenn die relevanten Merkmale verfügbar sind; harte Bedingungen bleiben unabhängig davon eingehalten.
- Reale Provider-, Router-, Wallet- und Gerätemessungen. Unit-/Vertragsprüfungen allein belegen keine Betriebsfreigabe.

## Verifikationsstatus dieser Änderung

- Frontend-Typprüfung: `./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --pretty false` erfolgreich, Exitcode 0.
- Functions-Typprüfung: `./node_modules/.bin/tsc -p functions/tsconfig.json --noEmit --pretty false` erfolgreich, Exitcode 0.
- Nicht ausgeführt: vorhandene Testläufe, reale BRouter-Probe, Browser-/Gerätefluss.
- Der aktuelle Backend-Capabilityvertrag meldet Premium und Offline deaktiviert. Ein echter Betreiber-Routingendpunkt und dessen Laufzeitkonfiguration wurden nicht abgefragt.
