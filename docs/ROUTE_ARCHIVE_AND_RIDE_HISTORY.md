# Streckenarchiv und Fahrtenhistorie

Stand: 28.10.2026. Benutzerauftrag: Erfolgreich erzeugte Strecken automatisch behalten, ungefahrene Varianten nicht überschreiben und alle aufgezeichneten Fahrten in einer Historie führen.

## Implementiertes Verhalten

- Gerätearchiv in IndexedDB `wegweiser-route-archive-v1`, getrennt nach Nutzerkennung. Kein Listenlimit, keine automatische Verdrängung oder zeitliche Löschung. Jede neue Generation bekommt einen eigenen Eintrag; Wiederholung desselben Speichervorgangs setzt keinen Fahrstatus zurück.
- Kostenlose tatsächliche Routerresultate werden vor der Vorschau gesichert. Auch eine inzwischen durch eine weitere Vorschau abgelöste Berechnung wird archiviert, sofern Auth/Consent unverändert gültig sind. Fehlerhafte/unvollständige Routen werden nicht als gültige Strecke gespeichert.
- Erst der erfolgreiche IndexedDB-Transaktionsabschluss bestätigt Speicherung. Bei Fehlern bleiben erzeugte Ergebnisse in einer Retryliste im Speicher, neue Generierungen werden gesperrt, Archivexport und erneute Sicherung sind möglich. Ein Beenden-Hinweis schützt laufende Aufzeichnungen bzw. ungesicherte Daten vor versehentlichem Tab-Schließen; er ist keine Zusage gegen Prozessabbruch oder Geräteausfall.
- Unter „Touren-Historie“ öffnet sich das Archiv mit „Ungefahrene Strecken“, „Fahrtenhistorie“ und „Alle gespeicherten Strecken“. Vorhandene alte Routen werden idempotent importiert; ihr tatsächlicher früherer Fahrstatus wird nicht erfunden. GPX- und JSON-Sicherung bleiben möglich.
- Route übernehmen startet die Aufzeichnung erst nach Anlage des Archiveintrags. Vorschau allein wird nicht als Fahrt gezählt. Pro Fahrt eigener Datensatz, auch bei Wiederholungen derselben Planung. Originalplanung und tatsächliche GPS-Geometrie bleiben getrennt gespeichert und erreichbar.
- Aufzeichnungen nutzen ausschließlich frische, hinreichend genaue tatsächliche Positionen; Demopositionen werden ausgeschlossen. Die erste Messung und weitere Zwischenstände werden bei neuen Messungen gesichert, danach in Abständen ab fünf Sekunden. Eine unterbrochene Sitzung bleibt als offene Aufzeichnung sichtbar. Letzte noch nicht bestätigte Messungen können bei abruptem Prozessabbruch fehlen.
- Eine Fahrt wird vor der Zusammenfassungsanzeige dauerhaft abgeschlossen. Scheitert das, bleiben Abschlussdaten in der Retryliste, statt bei einer neuen Aufnahme überschrieben zu werden. Authwechsel und Unmount geben keine verspätete Zusammenfassung im anderen Konto aus.
- Die bisherigen festen Beispielkilometer und Starttoken wurden aus der Analytik entfernt; gefahrene Kilometer stammen aus Aufzeichnungen. Cloudabfragen dürfen kleinere Bestände nicht über offline gespeicherte Routen schreiben. Doppelte Ausfälle beider Legacy-Speicherziele werden als Fehler gemeldet.

## Datenschutz und Grenzen

Lokale Archive werden bei ausdrücklichem Widerruf bzw. Kontolöschung mitbereinigt. Nutzerpartitionierung ist keine Verschlüsselungs- oder Cloud-Sicherungszusage. Die Informationstexte beschreiben das Gerätearchiv; die gemeinsame Consentversion wurde deshalb auf 3 angehoben und zwischen Client und Functions zentralisiert. Bestehende Version 2 erfordert erneute Zustimmung. Keine rechtliche Konformitätsbehauptung.

Das Gerätearchiv überlebt normale App-/Seitenneustarts. Es schützt nicht vor Löschen der App-/Browserdaten, Speicherausfall oder Verlust des Geräts; JSON-/GPX-Export dient als zusätzliche persönliche Sicherung. Browser-Speicherausfälle werden sichtbar, nicht durch ein falsches „gespeichert“ übergangen. Es wurde keine neue Cloud-Synchronisierung eingerichtet.

Das echte Premium-KI-Backend bleibt gesperrt. Architektur und Arbeitsplan verlangen dort nun ebenfalls automatische dauerhafte Archivierung einschließlich Alternativen vor `ready`/Capture. Die frühere optionale Speicherung bzw. 24-h-Löschung gültiger Premiumstrecken ist aufgehoben. Temporäre fehlgeschlagene Artefakte und Jobrohdaten behalten die gesonderte Bereinigungsregel.

## Prüfungen

Getestet werden Archiv-Neustart mit demselben Speicher, parallele Varianten, gleiche Quell-ID, unveränderliche Snapshots, Retry nach Quota-Fehlern, tatsächliche versus geplante Strecke, unterbrochene und wiederholte Fahrten, Besitzertrennung, Consentwechsel, Transaktionscommit/-abort, Archivansichten sowie Speichern vor Start/Abschluss und Demoausschluss. Die Speichertests verwenden kontrollierte Testadapter; echter Browser-/Geräte-Neustart, mobile Hintergrundaufzeichnung und Hardware-Speicherausfälle sind noch nicht abgenommen.


## Abschlussstand 29.10.2026

Der vollständige Prüflauf vom 28.10. bestand mit 427 Frontend- und 156 Backendtests sowie beiden Builds. Die vorhandene Socket-Suite wurde wegen des dokumentierten EPERM-Blockers ausdrücklich ausgeschlossen; zwei Suites, ein Test und elf todo blieben als solche ausgewiesen. Am 29.10. bestanden erneut alle 17 gezielten Archiv-/Speicher-/Aufzeichnungsfälle, darunter negative Speicherpfade und erneutes Laden. Keine Code-Coverage für diese Dokumentation behauptet.

Die Backend-/Frontend-Consentversion 3 ist gemeinsam vorbereitet; ein Rollout wurde nicht vorgenommen. Bei späterem Betrieb müssen Client und Functions konsistent ausgerollt werden. Neue Cloudressourcen, Konten, Installationen, Push oder Deployment wurden nicht durchgeführt.
