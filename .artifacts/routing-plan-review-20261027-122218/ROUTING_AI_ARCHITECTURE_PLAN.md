# Zielarchitektur: KI-Routenplanung, BRouter und Offline-Wiederaufnahme

Status: Architekturvorschlag, 27. Oktober 2026. **Nur Planung, keine Implementierung in diesem Dokument.** Vor Umsetzung sind Produktentscheidungen und Betriebs-/Providerwahl zu bestätigen.

## 1. Zielbild und klare Versprechen

- **Normale Route, kostenlos:** BRouter berechnet eine fahrradtaugliche Route auf realem Straßennetz. Die App darf nur dann navigierbare Streckengeometrie anzeigen, wenn Antwort und Geometrie validiert wurden.
- **KI-Premiumroute, Tokenkosten:** Die KI plant nutzerspezifisch: Start/Ziel, erlaubte Zwischenziele, Präferenzen, Wünsche, Fahrrad-/Akkudaten und Sicherheitsreserven. Sie wählt und bewertet sinnvolle Routenkandidaten; ein Routing-Graph liefert anschließend echte befahrbare Kanten. KI darf keine frei erfundene Liniengeometrie als Straße ausgeben.
- **Offline-Neuberechnung:** Möglich nur mit heruntergeladenem, lokalem Straßengraphen und lokalem Routing-Engine. Tile-Cache oder Kartenbild allein genügen nicht. Fehlt ein passendes Offlinepaket, zeigt die App die Einschränkung an und bietet Rückkehr auf die letzte sichere Route oder Warten auf Netz an.
- **Streckenabweichung:** Bleibt die letzte bestätigte Route erhalten. Bei sicher erkannter Abweichung wird eine Neuberechnung angefragt. Offline wird lokal gerechnet; online kann die kostenlose BRouterroute oder die vom Nutzer gewählte Premium-KI-Route verwendet werden. Navigation setzt erst nach Prüfung und Nutzerhinweis auf die neue Route um.

## 2. Heutige technische Ausgangslage

- `RoutingService.generateDestinationRoute` ruft BRouter für Premiummodus auf, hat aber bei Fehlern einen ungeprüften Luftlinienkorridor als Fallback.
- `RoutingService.generateBikeRoute` baut eine künstliche Rundroute aus geometrischen Punkten; BRouter wird auf diese Punkte angefragt. Einige Wegpunktbeschriftungen und Oberflächenwerte sind fest vorgegeben und keine verifizierten Fakten.
- `AiAssistantService.generateDestinationRoute` fügt bei erfolgreicher Premiumroute eine KI-Beschreibung hinzu. Die KI wählt derzeit nicht eigenständig einen validierten Routenkorridor.
- „KI heute“ verwendet `generateBikeRoute` und erzeugt einen geometrischen Start-/Zwischenpunkt. Das ist noch keine nutzerspezifisch von der KI entworfene, netzvalidierte Rundroute.
- Es gibt keinen lokalen Straßengraphen. Der Tile-Cache enthält Kartendarstellung und ersetzt kein Routingnetz.

Diese Unterschiede müssen vor der Produktfreigabe in UI, Preisen und Navigationsstatus abgebildet werden.

## 3. Zielarchitektur in Schichten

```text
UI / Navigation State Machine
        │ strukturierter Auftrag + aktuelle Fahrtpräferenzen
        ▼
Route Orchestrator (Client koordiniert, Backend autorisiert Premium)
   ├── Free Route Adapter ───────────────► BRouter
   ├── Premium AI Planner ─► Kandidaten/Constraints
   │                           ▼
   │                   Graph Router ─────► BRouter oder gewählter Backendrouter
   ├── Offline Route Adapter ────────────► lokaler Routinggraph + Engine
   └── Route Validator / Scorer
        │ signierter/validierter Routendatensatz
        ▼
Navigation Guidance + Abweichungserkennung + Wiederaufnahme
```

### 3.1 Route Request

Versioniertes, typisiertes Objekt, mindestens:

- `requestId`, `schemaVersion`, `mode` (`free`, `premium`, `offline`), `createdAt`.
- Start/Ziel mit Quelle und Genauigkeit; optional Via-Punkte in geordneter Reihenfolge.
- Präferenzen: Oberfläche, Steigung, Verkehrsvermeidung soweit Datenquelle sie unterstützt, Distanz-/Zeitkorridor, Rundroute ja/nein.
- Fahrradprofil: Fahrradtyp, Akkuenergie, aktueller Ladestand, Reserve, Gepäck nur sofern Nutzer diese Daten tatsächlich angibt.
- KI-Wünsche als begrenzter Freitext, danach in explizite Constraints übersetzen; unbekannte oder widersprüchliche Wünsche zurückfragen/erklären.
- Datenzustand, Datenschutz-/Routingzustimmung, aktiver Nutzer- und Tarifnachweis serverseitig.

Nicht notwendige Profilfelder werden nicht erhoben. Präferenzen erhalten Zeitstempel und Quelle; Nutzer kann sie ansehen, bearbeiten, löschen und für eine einzelne Route überschreiben.

### 3.2 Premium AI Planner

1. App sendet einen minimalen Route Request an authentifizierten Callable-Endpunkt mit App Check.
2. Backend prüft Premiumberechtigung und Guthaben, legt einen idempotenten Auftragsdatensatz an und **reserviert** die Tokenkosten atomar. Keine Abrechnung bloß für einen UI-Klick.
3. Planner wandelt Nutzerwünsche in strukturierte, zulässige Kriterien um. Keine KI-Antwort darf Rohkoordinaten, Kartenkanten oder Höhen als verifiziert ausgeben.
4. Planner erzeugt begrenzte Zwischenziel-/Kandidatenvorschläge, zum Beispiel alternative Korridore und passende Ziele. Region, Radius, Anzahl Kandidaten, Laufzeit und Modellkosten sind serverseitig begrenzt.
5. Graph Router berechnet jede zulässige Kandidatenroute auf realem Radnetz. Fehlende Kandidaten führen nicht zu synthetischen Linien.
6. Validator prüft Geometrie, Start/Zielbindung, Via-Reihenfolge, Netzanschluss, plausible Distanz/Steigung, Akkureserve und Datenquellenstatus.
7. Scorer bewertet Kandidaten anhand deklarierter Nutzerprioritäten und zeigt verständliche Gründe/Trade-offs. Nutzer kann auswählen, bearbeiten oder abbrechen.
8. Token werden nur bei erfolgreicher Ausgabe einer validierten Premiumroute endgültig gebucht. Bei Fehler, Storno oder nicht erfüllten Constraints wird die Reservierung freigegeben. Idempotenz schützt Wiederholungen.
9. Ergebnis enthält `routeId`, Planversion, Kosten, Validatorstatus, verwendete Datenquellen, Qualitäts-/Unsicherheitsangaben und Wiederholbarkeit.

### 3.3 Kostenloses BRouter-Routing

- Direkter Point-to-point- und Rundroutenauftrag mit BRouter-Profilen, nicht künstlicher Kreisgeometrie.
- Für Rundrouten müssen Kandidatenziele/Schleifenpunkte aus geeigneten Kartendaten gewählt und anschließend von BRouter geroutet werden.
- API-Antwort validieren: HTTP-Status, Feature-/Koordinaten-Schema, Wertebereich, Weglänge, Nähe zu Start/Ziel/Via, Mindest-/Höchstlänge, Abbrüche.
- Fehler sauber anzeigen. Keine Umwandlung des Fehlers in eine „fertige“ Navigation über Luftlinie.
- Höhen und Oberfläche nur dann als Messwerte ausgeben, wenn sie aus geprüften Daten berechnet wurden; sonst als unbekannt kennzeichnen.

## 4. Offline Graph, Abweichung und Rejoin

### 4.1 Paket und lokale Engine

- Vor Umsetzung Engine und Lizenz-/Datenstrategie auswählen (z. B. eigener GraphHopper-/Valhalla-basierter Mobilbuild oder geeignete Offline-Routingbibliothek); Machbarkeit für Web, Android und iOS separat prüfen.
- Regionen paketieren, mit Version, Abdeckung, Profilen, Speicherbedarf und Aktualisierungsdatum. Kartentiles allein sind nicht ausreichend.
- Download muss fortsetzbar, hash-/signaturgeprüft, atomar aktivierbar und löschbar sein. Vor Routing prüfen, ob Start, Ziel und notwendiger Korridor in Graphabdeckung liegen.
- Lokale Profile und private Routen verlassen das Gerät nicht, sofern der Nutzer kein Online-Premium startet.
- **Kein Graph/Abdeckungslücke:** Keine falsche Offline-Straßenroute. Letzte valide Route sichtbar halten; Rejoin-Hinweis oder sichere Pause anbieten.

### 4.2 Abweichungserkennung

- Map-Matching gegen aktive Route und Positionsgenauigkeit; Abweichung erst nach konfigurierter Distanz-/Zeit-Hysterese erkennen, um GPS-Rauschen zu dämpfen.
- Schlechte Genauigkeit, Tunnel/Stillstand und Positionssprünge als „unsicher“ behandeln, nicht sofort neu routen.
- Einmalige Abweichungsentscheidung mit Sperrzeit/Request-ID verhindert parallele oder wiederholte Berechnungen.
- Vor der Neuberechnung letzten bestätigten Navigationsstand und verbleibende Route speichern.

### 4.3 Rejoin-Strategie, wenn offline

1. Abweichung bestätigt und ein gültiger lokaler Graph deckt aktuelle Position plus Ziel/Route ab: lokal den günstigsten sicheren Rejoin-Punkt auf der verbleibenden Route berechnen.
2. Nur eine kurze Verbindung zur bestehenden Route reicht: diese als lokale Rejoinroute anbieten; Rest der validierten Route unverändert weiterverwenden.
3. Nutzer hat die geplante Strecke vollständig verlassen oder Graphabdeckung fehlt: nicht behaupten, KI/BRouter könne offline neue Straßen kennen. Letzte Route beibehalten und deutlich anzeigen: „Offline-Neuberechnung nicht verfügbar“; sichere Rückkehr zum letzten Trackpunkt / später online neu planen ermöglichen.
4. Wird Netz wieder verfügbar, keine überraschende automatische Änderung: aktuelle Position und Wunschroute erneut validieren, Ergebnis als Vorschlag zeigen, Nutzer bestätigen lassen.

## 5. Zustandsautomat

`idle → requesting → validating → ready → navigating → off_route_pending → rerouting_online | rerouting_offline → reroute_preview → navigating`

Fehlerzustände: `network_unavailable`, `offline_graph_missing`, `coverage_miss`, `invalid_route`, `consent_required`, `premium_not_entitled`, `insufficient_tokens`, `cancelled`. Jeder Fehler lässt die letzte gültige Route unverändert. `reroute_preview` erfordert Bestätigung, außer ein später explizit beschlossenes UX-Verhalten definiert automatische, kurze Rejoins.

## 6. Datenschutz, Sicherheit und Betrieb

- Standortkoordinaten werden vor jeder Übermittlung gemäß Einwilligung geprüft; minimaler Umfang, kurze Aufbewahrung und klare Anbieterempfänger.
- Premiumkosten und Nutzerberechtigung ausschließlich im Backend prüfen; App Check, Auth, Rate-Limits, Tages-/Kostenlimits, Idempotenz, Abuse-Logs ohne unnötige Standortdetails.
- Provider-Schlüssel nie in App-Bundles. Externe Routingprovider erhalten nur nötige Koordinaten und Anfrageparameter.
- Route-IDs sind keine Berechtigung. Private Routen nur UID-basiert; keine clientseitig vertrauenswürdigen Token-/Preiswerte.
- Telemetrie misst Laufzeit, Fehlertyp, Validierungsquote, Premiumkosten und Neuberechnungsrate aggregiert; exakte Fahrstrecken nicht als Diagnose-Default speichern.
- Kill-Switch je Engine/Modell, harte Limits für KI-Laufzeit, Kandidatenzahl, Geometriepunkte und Antwortgröße.

## 7. Datenmodell und Schnittstellen

- `RouteRequest` (versioniert, idempotency key, mode, constraints).
- `PremiumRouteJob` (UID, Request-Hash, Status, Tokenreservierung, Fehlercode, Zeitablauf; Standortdaten minimieren).
- `RouteCandidate` (Quelle, Graph-/Profilversion, Constraints erfüllt, Distanz, Höhen-/Oberflächenqualität, Validierungsresultat).
- `ValidatedRoute` (Geometrie, Wegpunkte, Herkunft, Prüfstatus, Erstellungszeit, Offlinekompatibilität).
- `RouteProgress` lokal verschlüsselt bzw. gerätegebunden: aktive Route, letzte Position mit Genauigkeitsangabe, Abweichungsstatus. Keine Cloud-Synchronisierung ohne klaren Produktgrund und Einwilligung.
- API-Idee: `createPremiumRoute`, `getPremiumRouteJob`, `cancelPremiumRoute`; kostenlose BRouter- und Offlineaufträge können lokal orchestriert werden, aber teilen Validator- und Ergebnisschema.

## 8. Migrationsplan und Abnahmepunkte

### Schritt 0 — Produktregeln festlegen

Tokenpreis/Reservierung, KI-Nutzung, unterstützte Wünsche, BRouter-/Graph-Provider, Offlinekartenregionen, Fahrzeugprofile, Datenschutztexte und Abweichungsschwellen entscheiden. Noch keine Preiswerbung oder Netzwerkaussage.

### Schritt 1 — Wahrheit im bestehenden Routing herstellen

Künstliche Kreis-/Zwischenziele, fest behauptete Lader, Oberflächen und Steigungsversprechen aus dem als real dargestellten Ergebnis entfernen. Fehlerkorridor nicht als navigierbare Route behandeln. Suchziel und Planungsbuttons Ende-zu-Ende prüfen.

### Schritt 2 — Free Route Service und Validator

BRouter-Adapter, Schema-/Geometrievalidierung, Cancel/Timeout, Statusmodell und Integrationstests implementieren. Abnahme: valide reale Antwort wird nutzbar; HTTP-/JSON-/Koordinatenfehler liefern keinen falschen Navigationszustand.

### Schritt 3 — Route deviation online

Route-Matching, Rauschfilter/Hysterese, deduplizierter Request und Preview für Online-Neuberechnung. Abnahme mit aufgezeichneten GPS-Tracks, schlechtem GPS, Tunnel und Parallelrequests.

### Schritt 4 — Offline-Engine-Prototyp

Engine auf Zielplattformen evaluieren; ein begrenztes Testgebiet mit kleinem echten Graphpaket bauen. Speicher, Akku, Lizenz, Update/Löschung und Abdeckung messen. Erst nach erfolgreichem Proof of Concept wird Offline-Neuberechnung als Funktion beworben.

### Schritt 5 — Premium-KI-Planung

Kandidatenplanung, Backend-Callable, Tokenreservierung/Abschluss, Graphrouting und Erklärungen integrieren. Abnahme: derselbe Request reproduzierbar genug, Limits eingehalten, keine erfundene Linie, Guthaben bei Fehler/Storno unverändert.

### Schritt 6 — Offline-Rejoin und Freigabe

Lokale Neuberechnung zur verbleibenden Route, Abdeckungslücke und Netzwiederkehr testen. Freigabe nur mit durchgängigen Tests auf echten Web-/Android-/iOS-Zielsystemen und klarer Produktkommunikation.

## 9. Offene Entscheidungen vor Implementierung

1. Welche Plattformen müssen lokale Offlinegraphen unterstützen (Web/PWA, Android, iOS)?
2. Welche Offline-Regionen, Paketgrößen und Aktualisierungsfrequenz sind akzeptabel?
3. Soll Premium-KI vollständige Privatprofil-/Fahrtdaten verwenden oder nur explizit ausgewählte Präferenzen je Anfrage?
4. Wie viele Token kostet eine erfolgreich validierte Premiumroute, und wann darf eine Buchung stattfinden?
5. Soll die KI Kandidaten über einen Betreiber-Graphrouter bewerten, oder soll zunächst BRouter die Geometrie liefern und KI nur valide Alternativen ranken?
6. Was soll die App bei Offline-Abdeckungslücken priorisieren: letzte Route, Rejoin zum Track oder Navigation pausieren?

## 10. Verbindliche Grenzen

- KI allein kennt keine aktuellen befahrbaren Wege, Sperrungen oder rechtliche Zugänglichkeit ohne belastbare Kartendaten.
- BRouter-/Graphroute ist nur so aktuell und korrekt wie Graph, Profil und Provider; Validierung ersetzt keine Verkehrssicherheitsgarantie.
- Ohne lokalen Graphen gibt es keine echte Offline-Routenberechnung. Eine Tile-Cache oder interpolierte Linie erfüllt diese Anforderung nicht.
- Diese Datei ist ein Architekturplan. Keine der hier beschriebenen späteren Komponenten oder Provider-Integrationen wird durch das Speichern des Plans als vorhanden behauptet.
