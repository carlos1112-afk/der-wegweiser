# Code-Review: Blocker-Analyse und Behebung

Datum: 2026-09-26 · Branch: `kepler/code-review-blocker-analysis` · Basis: `origin/main` (37e2b36)

Ausgangslage: `npm run build`, `npm run lint` (0 Fehler) und `npm run test:scenarios`
(51/51) waren grün. Die Blocker lagen ausschließlich in Laufzeit-, Datenschutz- und
Konformitätsdefekten, die von der statischen Prüfung nicht erfasst werden.

---

## Behoben

### Datenschutz / Consent (Art. 6, 7, 17, 20 DSGVO)

| # | Defekt | Behebung |
|---|--------|----------|
| 1 | Die Einwilligung steuerte nur die Sichtbarkeit des Modals. GPS-Watch, Firestore-Lesezugriffe, Wetter-, KI- und Telemetrie-Aufrufe liefen unabhängig von der Nutzerentscheidung. `der_wegweiser_legal_consent` wurde genau einmal geschrieben und von keinem Service gelesen. | Neu `src/services/consentService.ts` als Single Source of Truth. `useGeolocation(..., hasConsent)` startet ohne Einwilligung weder Watch noch OS-Abfrage. Dateninitialisierung und Wetterabfrage sind hinter die Einwilligung gezogen. |
| 2 | „Nur Notwendige" änderte nichts — die Flags wurden verworfen, Drittanbieter-Offerwall (BitLabs) war immer gerendert. | Offerwall nur noch bei `allowsSurveys`. |
| 3 | Keine Versionsnummer, kein Re-Prompt, kein Widerruf — die Datenschutzerklärung versprach einen Widerruf im Einstellungsmenü, den es nicht gab. | `CONSENT_VERSION` + Versionsprüfung; Widerruf-UI im Privacy-Cockpit (Art. 7 Abs. 3). |
| 4 | Nicht notwendige Kategorien waren vorangekreuzt (§ 25 Abs. 2 TDDDG). | Standardmäßig aus. |
| 5 | Der Art.-20-Export las vier Schlüssel (`wegweiser_user_prefs`, `_custom_stations`, `_custom_routes`, `_tokens`), von denen **keiner** in der App existiert — der Export war leer. | Export erfasst jetzt alle app-eigenen Keys per Präfix, kann nicht mehr veralten. |
| 6 | Kontolöschung: Tile-Cache (`der-wegweiser-map-tiles`) blieb erhalten, IndexedDB-Löschung war fire-and-forget, `localDataDeleted` wurde vor Abschluss gesetzt. | CacheStorage wird mitgelöscht, IndexedDB-Löschung wird awaited (inkl. `onblocked`). |
| 7 | Kontolöschung suchte nach `createdByUserId`, die App schreibt aber `userId` — gespeicherte Routen und Bewertungen blieben dauerhaft zurück. | Löschung über beide Feldnamen, über alle Collections. |

### Übermittelte Daten

| # | Defekt | Behebung |
|---|--------|----------|
| 8 | `spatialTelemetrySanitizerService` war als „anonymisiert" dokumentiert, übertrug aber `coordinates: trackCoordinates` **unverändert** — den vollständigen GPS-Track mit Meter-Auflösung, in einer weltlesbaren und nie löschbaren Collection. Die Datenschutzerklärung erklärte das Gegenteil. | Koordinaten werden auf ~1,1 km Raster quantisiert, auf max. 24 Stützpunkte dezimiert, Upload nur bei Analytics-Einwilligung. Fiktive Felder (`elevationProfileM`, `maxSlopePercent = avgSlope * 2.2`) entfernt, da als Messwerte ausgegeben, aber frei erfunden. |

### Firestore-Sicherheitsregeln

| # | Defekt | Behebung |
|---|--------|----------|
| 9 | `isNotSuspended()` war `!isAuthenticated() \|\| !exists(...)` — für **anonyme** Aufrufer `true`. Damit durfte jeder ohne Konto Ladesäulen, Routen, Bewertungen und Telemetrie anlegen. | `isActiveUser()` verlangt Authentifizierung **und** Nicht-Sperrung. |
| 10 | `charging_stations`: `update` nur `isAuthenticated()`, `delete` nur bei Eigentum — jeder angemeldete Nutzer konnte fremde Einträge überschreiben, aber nicht löschen. | `update`/`delete` beide an `isCreator()`. |
| 11 | `routes` waren `allow read: if true` (weltlesbar), während `APPLE_UGC_COMPLIANCE.md` sie als privat ausweist. | Privat: Lesen nur durch den Ersteller. |
| 12 | `deleteByQuery` konnte nie greifen (Feldname + uid). | Siehe #7. |

### Laufzeit- und Sicherheitskorrektheit

| # | Defekt | Behebung |
|---|--------|----------|
| 13 | `'user-1'` war an 16 Stellen fest verdrahtet. Die Regeln verlangen `request.auth.uid == userId` — **jeder** nutzerbezogene Cloud-Zugriff schlug fehl und wurde still in einen localStorage-Fallback umgeleitet. Cloud-Sync und Kontolöschung waren funktional tot, ohne Fehlermeldung. | Neu `src/services/userIdentity.ts`: Firebase-UID, sonst stabile anonyme lokale ID. Cache-Invalidierung bei Auth-Wechsel. |
| 14 | GPS-Watch-Leck:mounted nach `watchPosition` aufgelöst zu werden, lief der Watch bis zum Prozessende weiter (Dauerentladung). | Race-Condition-Fix, Watch wird bei Abbruch sofort freigegeben. |
| 15 | BLE-Parser: kein Plausibilitätsfilter. Ein verworfenes Paket erzeugte absurde Tempo-/Trittfrequenzwerte, die direkt in Reichweitenberechnung, Notfall-Akkuwarnung und Sprachausgabe einflossen. | Grenzwerte (90 km/h, 220 rpm), Verwerfung veralteter Werte, Reset der Referenzwerte bei Verbindungsaufbau/-abbruch. |
| 16 | Der Sprachassistent gab bei fehlender Web-Speech-API (der **einzige** Zweig unter Android WebView und WKWebView) eine erfundene Antwort aus: „Die nächste Ladesäule ist 1,4 km entfernt." | Keine erfundenen Werte mehr; nutzt nur real gemessene Telemetrie. |
| 17 | iOS: `UIBackgroundModes: location` deklariert, `NSLocationAlwaysAndWhenInUseUsageDescription` fehlte — Always-Autorisierung nicht anforderbar, App-Terminierung bei gesperrtem Bildschirm. | Schlüssel ergänzt. |
| 18 | `UIRequiredDeviceCapabilities: armv7` (32-Bit-Altlast) bei iOS-15-Target. | `arm64`. |
| 19 | `google-services.json` / `GoogleService-Info.plist` waren **nicht** ignoriert (Eintrag auskommentiert) — der nächste Entwickler hätte Firebase-Schlüssel committet. | Beide ignoriert. |
| 20 | Release-Signierung: `buildTypes.release` konsumierte `signingConfigs.release` unbedingt, auch wenn leer — erzeugte stillschweigend ein unsigniertes Artefakt. | Fail-fast mit klarer Meldung. |

### Testabdeckung

Der bestehende 15-Szenarien-Test prüfte **Mock-Implementierungen, nicht den ausgelieferten
Code**: Szenario 15 definierte eine eigene `MockLocalStorage`, eine eigene
`scrubUserPersonalData()` und zwei Schlüsselnamen (`wegweiser_auth_token`,
`wegweiser_saved_routes`), die ausschließlich in der Testdatei existieren.
`AccountDeletionService` wurde nie importiert oder ausgeführt.

Neu `tests/firestore.rules.test.mjs` (11 Tests) gegen den Firestore-Emulator:
anonyme Schreib-/Lesezugriffe, Eigentum bei Update/Delete, private Routen,
gesperrte Nutzer, Kontenisolation, Meldeweg, Default-Deny.
Eingebunden als `npm run test:rules` und in die CI.

---

## Verifikation

| Prüfung | Ergebnis |
|---------|----------|
| `npm run build` | ✓ |
| `npm run lint` | 0 Fehler, 13 Warnungen (unverändert vorbestehend) |
| `npm run test:scenarios` | 51/51 |
| `npm run test:rules` | 11/11 (neu) |

---

## Nicht behoben — Entscheidung erforderlich

Diese Punkte kann man nicht sinnvoll allein im Code lösen.

### 1. Android Foreground Service existiert nicht
`AndroidManifest.xml` deklariert `FOREGROUND_SERVICE` und
`FOREGROUND_SERVICE_LOCATION`, enthält aber **null `<service>`-Elemente**, und es
gibt keinen nativen Java/Kotlin-Code für Benachrichtigungen. `navigator.wakeLock`
ist in Android WebView nicht verfügbar, `WAKE_LOCK` wird nirgends genutzt.

Damit ist die ganztägige Navigation mit sichtbarer Benachrichtigung — das
zentrale Produktversprechen und Grundlage der Play-FGS-Erklärung in
`release/` — nicht implementiert. Ein WebView-Watch wird im Hintergrund
gedrosselt.

**Nötig:** nativer FGS inkl. `foregroundServiceType="location"`, oder
Entfernung der FGS-Deklarationen samt Korrektur der Play-Antworten und der
Aussage „im Hintergrund (auch gesperrtem Bildschirm)" in Datenschutzerklärung
und Consent-Screen. `scripts/test_15_scenarios.mjs` prüft heute nur, ob der
String `FOREGROUND_SERVICE_LOCATION` im Manifest steht — nicht, ob ein Service
existiert.

### 2. Web Bluetooth ist auf beiden Zielplattformen nicht verfügbar
`bleManager` prüft `'bluetooth' in navigator`. Web Bluetooth existiert weder in
Android WebView noch in Safari/WKWebView — die gesamte Live-Telemetrie, alle
sieben Hersteller-Parser und `BoschConnectModal` sind toter Code. Gleichzeitig
werden Android-Bluetooth- und iOS-Bluetooth-Berechtigungen deklariert, und
`Info.plist` fordert den Hintergrundmodus `bluetooth-central` (seit iOS 13
veraltet).

**Nötig:** eigenes Capacitor-BLE-Plugin, oder Bluetooth-Berechtigungen und
Backdrop-Modi entfernen und die Features als nicht verfügbar kennzeichnen.

### 3. Sprachsteuerung ist auf beiden Plattformen nicht funktionsfähig
`webkitSpeechRecognition` fehlt in beiden WebViews. Die deklarierten
Mikrofon-/Speech-Recognition-Berechtigungen werden nie ausgelöst (kein
`getUserMedia` im Code). Ersatzweise erzeugt der KI-Assistent derzeit
`aiGatewayService`-Aufrufe gegen `${window.location.origin}/api/ai`, was im
Webview `capacitor://localhost` ergibt — jeder Versuch scheitert und fällt auf
fest verdrahtete Texte zurück. `@google/generative-ai` ist zwar dependency,
wird aber nirgends importiert.

**Nötig:** Cloud-Endpoint bereitstellen (eigene Vertex-AI-Funktion) oder das
Feature als Prototyp kennzeichnen.

### 4. Nicht dokumentierte Drittanbieter-Empfänger
Präziser Standort geht derzeit an: `brouter.de` (Routenberechnung),
`overpass-api.de`, `tile.openstreetmap.fr`, `tile-cyclosm.openstreetmap.fr`,
`tile.opentopomap.org`, **`server.arcgisonline.com` (Esri, USA)** und
`basemaps.cartocdn.com`. `PRIVACY_POLICY.md` nennt nur CartoDB und
OpenStreetMap. Die Wetter- und Höhenabfrage umgehen den vorgesehenen
Server-Proxy per Fallback **by design** — im Webview ist
`window.location.origin` immer `capacitor://localhost`, der Proxy kann nie
greifen, der Direktaufruf ist der Normalfall.

**Nötig:** Empfängerliste in der Datenschutzerklärung vervollständigen,
Proxy tatsächlich bereitstellen oder den Direktaufruf als solchen benennen,
US-Empfänger (Esri) bewerten.

### 5. Moderations-Weg für gemeldete Inhalte ist nicht bedienbar
`firestore.rules` setzt für `content_reports` `allow read: if false` — es gibt
**keinen** Client-Pfad, auf dem gemeldete Einträge eingesehen werden können.
`StationReviewModal` verspricht eine Prüfung „innerhalb von 24 Stunden". Nicht
erreichbare Meldungen werden in `localStorage` geparkt und nie synchronisiert.
Apple Guideline 1.2 setzt eine funktionierende Moderation voraus.

**Nötig:** Admin-Oberfläche oder Admin-SDK-Pipeline; Art und Umfang der
Moderation sind eine Produktentscheidung.

### 6. Weitere Code/Doku-Widersprüche
- `docs/DATA_FLOW_MATRIX.md`, `PRIVACY_POLICY.md`, `docs/audits/*` enthalten
  Aussagen, die der Code nicht erfüllt — u. a. die Anonymisierung auf
  `anonymous_community` bei Kontolöschung (kein solcher Code vorhanden) und
  `gemini-3.6-flash` (die Quelle kennt nur `gemini-2.0-flash`). Der
  zugrunde liegende Test dazu ist ein reiner Quelltext-Match.
- `spatial_road_intelligence` ist `allow delete: if false`, `content_reports`
  ebenfalls — nach Kontolöschung verbleiben diese Referenzen, da kein
  Client-Pfad besteht.
- `wegweiser_spatial_cache` wird geschrieben, aber von niemandem gelesen.
- `StationReviewModal` speichert Bewertungen nur per `console.log`, obwohl
  `APPLE_UGC_COMPLIANCE.md` und `DATA_FLOW_MATRIX.md` Foto-/Video-Uploads
  beschreiben, die es nicht gibt.

---

## Empfohlene Reihenfolge

1. **Entscheidung zu #1 und #2** — entweder native Implementierung beauftragen
   oder die Store-Deklarationen und die App-Kommunikation korrigieren. Beides
   ist Voraussetzung für eine belastbare Einreichung.
2. **Datenschutzerklärung aktualisieren** (#4) und die falschen
   Audit-Aussagen korrigieren, damit die eingereichten Dokumente nicht
   widerlegt werden.
3. **Moderationsweg bauen** (#5), bevor UGC in den Stores eröffnet wird.
4. `scripts/test_15_scenarios.mjs` durch echte Tests des ausgelieferten Codes
   ersetzen — der jetzige Satz prüft Mocks und Quelltext-Substrings.
