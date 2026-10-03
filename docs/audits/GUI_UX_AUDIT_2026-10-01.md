# GUI/UX-Audit — Der Wegweiser
**Datum:** 2026-10-01
**Methode:** Echter Vite-Dev-Server (`npm run dev`) gegen echtes Chromium (Playwright 1.56.1), 9 reale Viewport-Größen, automatisierte Bounding-Box-Overlap-/Offscreen-Erkennung + manuelle Screenshot-Prüfung. Keine Annahmen, keine simulierten Daten — jeder Befund unten ist an einem echten Screenshot oder echten DOM-Messwerten verifiziert.

Getestete Viewports: iPhone SE (375×667), iPhone 14 (390×844), iPhone 14 Pro Max (430×932), Android klein (360×800), Android quer (800×360), iPhone quer (844×390), Tablet Hoch (768×1024), Tablet Quer (1024×768), schmales Foldable (280×653).

Rohdaten: `docs/assets/gui-audit-2026-10-01/` (3 Referenz-Screenshots), vollständiger JSON-Report der automatisierten Prüfung lag nur lokal in der Session vor (nicht Teil dieses Commits, da reine Debug-Rohdaten).

---

## 1. Bestätigte, reproduzierbare Layout-Fehler

### 1.1 Header-Button-Leiste läuft bei JEDER getesteten Größe über — auch bei 1024px Tablet-Breite
Die zweite Kopfzeile (`App.tsx`) reiht **12 Buttons flach in einer Reihe** aneinander, ohne Zeilenumbruch:
`Planung · REC Tour · Demo-Fahrt · GPX · [Sonne-Icon] · Stimme · OLED · Touren · + Säule · Lounge · Tour · Recht`

Gemessene Gesamtbreite der Leiste: **~1130px** (von x=77 bis x=1206 bei einem 1024px-Viewport). Das heißt:
- Auf **jedem** Telefon (bis 430px getestet): nur 3–5 der 12 Buttons sichtbar, der Rest ist nicht erreichbar ohne horizontales Scrollen — und es gibt **kein sichtbares Scroll-Indiz** (kein Pfeil, kein Fade-Gradient am Rand), die meisten Nutzer werden nie merken, dass da noch 7 weitere Funktionen liegen.
- Auf dem **1024px-Tablet** (!) sind immer noch `Tour` und `Recht` abgeschnitten.
- Das Rechtliche/Impressum (`Recht`) ist damit auf praktisch jedem Mobilgerät **de facto unerreichbar** über die Hauptnavigation — das ist nicht nur eine UX-Schwäche, sondern bei Pflichtangaben (§5 DDG, siehe `legalConfig.ts`) auch ein Compliance-Risiko, wenn das Impressum nirgendwo anders verlinkt ist.

Screenshot: `docs/assets/gui-audit-2026-10-01/01-phone-header-overflow.png` (iPhone 14, 390px — 5. Button bereits halb abgeschnitten), `02-tablet-header-still-overflows.png` (1024px Tablet quer — `Tour`/`Recht` fehlen komplett im Bild).

### 1.2 DSGVO-Consent-Modal: Einwilligungs-Buttons liegen unterhalb des sichtbaren Bereichs
Beim allerersten App-Start zeigt `ConsentModal` 4 Info-Karten (StVO-Hinweis, Standort-Hinweis, Reichweiten-Disclaimer, No-Sale-Garantie) **über** den eigentlichen Buttons (`Alle Akzeptieren & Tour Starten` / `Nur Notwendige` / `Anpassen`). Bei iPhone SE (667px Höhe) und Android klein (800px Höhe) liegen diese Buttons bei y=860–988 — **außerhalb des initial sichtbaren Viewports**, ohne optischen Scroll-Hinweis am unteren Kartenrand.

Das ist der allererste Bildschirm, den jeder neue Nutzer sieht. Wer nicht von sich aus scrollt, sieht eine Wand aus Rechtstext ohne erkennbaren Call-to-Action — reale Gefahr für Abbruch direkt beim ersten Start.

Screenshot: `docs/assets/gui-audit-2026-10-01/03-consent-modal-buttons-cut-off.png`.

### 1.3 Konfetti-Overlay verdeckt die Karte nach Consent-Bestätigung
`canvas-confetti` feuert beim Schließen des Consent-Modals über den **gesamten Viewport**, inklusive der Karte darunter. Für die ersten 1–2 Sekunden ist die eigentliche App-Oberfläche komplett verdeckt. Nett gemeint, aber bei einer Navigations-App ist "ich sehe meine Karte nicht" im ersten Moment nach dem Start kein guter erster Eindruck.

### 1.4 Rechte Werkzeugleiste (Play/Zoom/Locate/Layer/3D/Mic): sauber
Zur Ehrlichkeit auch das Positive: die vertikale FAB-Spalte rechts ist bei allen getesteten Größen sauber gestapelt, keine Überlappung, konsistenter Abstand. Hier gibt's nichts zu tun.

---

## 2. Fehlende Menüstruktur — der eigentliche Grund für Punkt 1.1

`App.tsx` lädt **13 verschiedene Modals** (Auth, Anticipation, Scanner, Lounge, Analytics, VoiceSettings, BoschConnect, RideSummary, GpxImport, EmergencyRange, StationReview, Legal, Consent) — aber es gibt **keine** übergeordnete Menü- oder Einstellungs-Struktur. Kein Hamburger-Menü, keine Drawer, kein Settings-Hub. Jeder Einstiegspunkt hängt als einzelner Button direkt in der einen, flachen Kopfzeile. Das ist strukturell die Ursache von 1.1: die Leiste kann gar nicht anders, als zu überlaufen, weil sie gleichzeitig Haupt-Navigation UND Funktionsaufruf UND Einstellungszugriff sein soll.

### Vorschlag: Hauptmenü-Konzept

**Prinzip: 3 Ebenen statt 1 flache Reihe.**

1. **Permanente Top-Bar (max. 4 Elemente):** Logo/Wegweiser-Name · Anmelden/Profil · Akku/Link-Status · Token-Balance. Das ist bereits fast so, bleibt unangetastet (Zeile 1 in den Screenshots funktioniert gut).

2. **Kontextuelle Aktionsleiste (max. 3–4 Elemente, je nach Zustand):** Nur das, was *jetzt* relevant ist. Im Planungsmodus: `Route planen` · `GPX laden` · `Demo-Fahrt`. Während der Fahrt (laut CHANGELOG wird die Header-Leiste während `isNavigating` bereits ausgeblendet — das Prinzip existiert schon, nur nicht konsequent genug): fast nichts, nur Abbrechen/Pause.

3. **Hauptmenü (neu, ☰-Button oder Bottom-Sheet):** Alles, was kein tägliches Schnellzugriffs-Element ist, wandert hierhin, gruppiert:
   - **Fahrt:** REC Tour, Touren-Historie, GPX-Import/Export
   - **E-Bike:** Bosch/Bafang verbinden, Display-Modi (OLED/Sonnenlicht)
   - **Community:** Lounge (Charge'n'Earn), Ladesäulen-Scanner
   - **Einstellungen:** Stimme/Sprachausgabe, Analytics-Opt-out, Account
   - **Rechtliches:** Impressum, Datenschutz, AGB (hier garantiert erreichbar, nicht in einer überlaufenden Leiste versteckt)

Das reduziert die Dauerleiste von 12 auf 3–4 Buttons und macht `Recht` endlich zuverlässig erreichbar.

---

## 3. Settings-Lücken

Es gibt aktuell **nur ein** echtes Einstellungs-Modal (`VoiceSettingsModal`, hinter "Stimme"). Was fehlt, verglichen mit dem, was die App selbst an Funktionsumfang verspricht (README/Audit-Docs):

- **Kein Einheiten-Umschalter** (km/h vs. mph, °C vs. °F) — bei einer App, die laut README auch international/herstellerunabhängig positioniert ist, fehlt das auffällig.
- **Kein zentrales Karten-/Display-Einstellungsmenü** — OLED-Modus und Sonnenlicht-Modus sind einzelne Toggle-Buttons in der Leiste statt gebündelter Einstellungen.
- **Keine Benachrichtigungs-Einstellungen** — besonders relevant, sobald die FCM-Push-Aufgabe (an Jules vergeben) landet; dafür fehlt heute jeder UI-Ort.
- **Kein BLE-Geräte-Verwaltungsbildschirm** — `BoschConnectModal` existiert, aber nur für Bosch; kein zentraler "Meine Geräte"-Screen für alle 5 unterstützten Hersteller mit Verbindungsstatus, letzter Sync, Trennen-Option.
- **Kein Konto-/Datenexport-Zugriff außerhalb des Legal-Modals** — die DSGVO-Datencockpit-Funktion (1-Klick-Export/-Löschung laut Audit-Doku) ist im `LegalModal` vergraben statt in einem erwartbaren "Konto"-Bereich.
- **Keine Karten-Offline-Verwaltung** — `offlineMapService.ts` existiert (227 Zeilen, cached Kacheln), aber keine UI, die zeigt, welche Regionen heruntergeladen sind oder Speicherplatz freigibt.

---

## 4. Vergleich zu anderen Navi-Apps — wo drückt der Schuh

Bezug: Komoot, Google Maps, Strava (wie im README selbst als Vergleich herangezogen).

**Auf den ersten Blick auffällig:**
- Die überlaufende Button-Leiste (1.1) ist sofort sichtbar und fühlt sich wie ein Entwickler-Debug-Panel an, nicht wie eine fertige Consumer-App. Komoot/Google Maps zeigen im Kartenmodus **maximal 2–3 schwebende Buttons**, alles andere ist in einem Menü versteckt.
- Keine Bottom-Navigation-Leiste (Tab-Bar), wie sie Komoot/Strava/Google Maps alle nutzen (Karte/Touren/Profil/Mehr als feste Tabs unten). Der Wegweiser hat stattdessen alles oben gestapelt — ungewöhnlich für eine Fahrrad-App, die meist mit einer Hand am Lenker bedient wird (oben ist am Telefon die am schwersten erreichbare Zone beim Fahren, unten die leichteste — Daumenzone).

**Bei genauerem Hinsehen:**
- Kein Suchfeld sichtbar in den getesteten Screenshots — Komoot/Google Maps haben ein permanentes Adressfeld oben. Falls es existiert, ist es hinter einem der überlaufenden Buttons versteckt und damit praktisch unauffindbar.
- Die Token/Gamification-Anzeige ("60") ist prominent oben rechts platziert — prominenter als z.B. der Batteriestatus direkt daneben. Bei einer App, deren Kernversprechen "ehrliche E-Bike-Reichweite" ist (siehe Audit-Dokumente zur No-Fake-Data-Policy), wirkt es inkonsistent, dass das Gamification-Element visuell mehr Gewicht bekommt als der Akkustatus.
- Die Rechtsleiste (Play/Zoom/Locate/Layers/3D/Mic) hat **6 Icons untereinander** — das ist mehr als Google Maps (typisch 2–3: Standort, Kompass, manchmal Layer) und beansprucht auf kleinen Screens real spürbar vertikalen Platz, der bei einer Hochkant-Nutzung während der Fahrt fehlt.
- Keine Offline-Indikator/Statusleiste, die sofort zeigt "ich bin gerade im ehrlichen Degradationsmodus" (routingEngineStatus/weatherStatus aus dem Code) — genau das Alleinstellungsmerkmal "ehrliche Degradation statt Fake-Daten" ist im UI nicht prominent sichtbar, nur in Warnhinweisen, die man erst sieht, wenn der Fall eintritt.

---

## 5. Priorisierte Empfehlung

1. **Header-Leiste umbauen** (1.1) — größter, am leichtesten zu findender Schaden, betrifft 100% der Nutzer auf 100% der getesteten Geräte.
2. **Consent-Modal-Buttons immer im Viewport halten** (1.2) — betrifft jeden einzelnen neuen Nutzer beim allerersten Start.
3. **Hauptmenü-Struktur einführen** (Abschnitt 2) — löst 1.1 strukturell statt nur kosmetisch.
4. Konfetti-Timing/Deckkraft über der Karte reduzieren (1.3) — klein, aber schnell behoben.
5. Settings-Lücken (Abschnitt 3) sukzessive schließen, beginnend mit BLE-Geräteverwaltung (hängt direkt mit den Bosch/Bafang-Arbeiten dieser Session zusammen).
