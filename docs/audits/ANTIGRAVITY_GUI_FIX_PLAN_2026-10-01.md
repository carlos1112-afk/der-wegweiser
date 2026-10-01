# Auftrag für Antigravity: GUI/UX-Redesign "Der Wegweiser"

**Basis:** `docs/audits/GUI_UX_AUDIT_2026-10-01.md` (echter Playwright-Audit, 9 Viewports, echter Vite-Dev-Server — kein simuliertes Layout). Lies dieses Dokument zuerst vollständig, bevor du irgendetwas änderst.

**Mandat:** Komplettes GUI-Redesign, nicht nur Bugfixing. Das Audit-Hauptmenü-Konzept (Abschnitt unten) ist dein **Ausgangspunkt**, kein Diktat — du darfst es verändern/verbessern, musst aber jede Abweichung in der PR-Beschreibung begründen (warum besser als Audit-Vorschlag, nicht nur "anders").

---

## Nicht verhandelbare Grundregeln (aus dem Projekt-Standard)

1. **Keine Fake-Daten, keine Mocks, kein simuliertes Layout.** Dieses Projekt hat bereits einmal fabrizierte Fallback-Werte aus der Codebasis entfernt (Commit `52a1d88`, "remove fake telemetry and mock fallbacks"). Dieselbe Ehrlichkeits-Regel gilt für UI-Behauptungen: "ist jetzt responsive" muss durch echte Screenshots/DOM-Messungen gegen den echten `npm run dev`-Server belegt sein, nicht behauptet.
2. **100% backend-/datengestützt.** Keine UI, die so tut als wäre Funktionalität vorhanden (z.B. ein Geräte-Verwaltungsbildschirm, der nur Platzhalter-Geräte zeigt) — jede neue UI-Komponente muss an echte Services/State angebunden sein (`offlineMapService.ts`, `routingService.ts`, BLE-Parser etc.), keine `TODO`/Dummy-Daten.
3. **Verifikationspflicht pro Phase (siehe unten) — kein Phasenabschluss ohne Beweis.**
4. Nichts an `routingEngineStatus`/`weatherStatus`-Fehlerverhalten (ehrliche Degradation statt Fallback-Werte) anfassen — das ist eingefroren, nicht Teil dieses Auftrags.

---

## Phase 1 — Kritische Layout-Bugs (eigener Branch + PR)

Branch: `antigravity/gui-fix-phase1-critical`

Betroffene Datei: `src/App.tsx` (aktuell 1022 Zeilen, Header-Button-Block ab der Zeile mit `onClick={() => setShowAuthModal(true)}` ~Zeile 559 bis `setShowLegalModal(true)` ~Zeile 840 — grep nach `setShow.*Modal(true)` für alle Trigger-Buttons).

1.1 **Header-Button-Leiste läuft bei JEDER Größe über** (12 Buttons flach, ~1130px Breite, auch bei 1024px Tablet überläuft `Tour`/`Recht`). Fix: Buttons aus der Dauerleiste entfernen und in Phase-2-Hauptmenü verschieben (siehe unten) — nicht nur umbrechen/verkleinern, das Audit stellt fest, dass die strukturelle Ursache die fehlende Menüebene ist.

1.2 **DSGVO-Consent-Modal (`src/components/Legal/ConsentModal.tsx`):** Buttons (`Alle Akzeptieren & Tour Starten` / `Nur Notwendige` / `Anpassen`) liegen bei iPhone SE (667px Höhe) und Android klein (800px Höhe) außerhalb des sichtbaren Viewports, ohne Scroll-Hinweis. Fix: Buttons sticky/fixed am unteren Kartenrand halten (nicht im scrollenden Content), ODER Scroll-Indikator (Fade-Gradient + Pfeil) wenn Content unterhalb des Folds weitergeht. Das ist der allererste Bildschirm jedes neuen Nutzers — höchste Priorität nach 1.1.

1.3 **Konfetti-Overlay (`canvas-confetti`) verdeckt die Karte** nach Consent-Bestätigung, 1-2 Sekunden lang kompletter Viewport. Fix: Entweder Opazität/Partikel-Dichte deutlich reduzieren, auf einen begrenzten Bereich (nicht Vollbild) beschränken, oder Dauer kürzen — Ziel: Karte bleibt im ersten Moment erkennbar.

**Verifikationspflicht Phase 1:** Playwright-Screenshot-Skript gegen echten `npm run dev` (nicht Build-Preview, nicht statisches Mock), alle 9 Viewports aus dem Original-Audit (375×667 bis 1024×768, siehe Audit-Kopf für volle Liste). Für 1.1: Beweis, dass keine interaktiven Elemente mehr außerhalb des Viewports oder sich überlappend liegen (gleiche Overlap-/Offscreen-Bounding-Box-Prüfung wie im Original-Audit, nicht nur optische Kontrolle). Für 1.2: Beweis, dass die drei Consent-Buttons bei 667px und 800px Höhe ohne Scroll sichtbar sind (y + height ≤ viewport height). Screenshots + JSON-Report als Artefakt in der PR verlinken (Pfad z.B. `docs/assets/antigravity-phase1-verify/`).

---

## Phase 2 — Hauptmenü-Struktur (eigener Branch + PR, baut auf Phase 1 auf)

Branch: `antigravity/gui-fix-phase2-menu`

Ausgangspunkt (aus dem Audit, veränderbar mit Begründung):

- **Permanente Top-Bar (max. 4 Elemente):** Logo · Anmelden/Profil · Akku/Link-Status · Token-Balance — bleibt im Kern wie heute, das funktioniert laut Audit bereits gut.
- **Kontextuelle Aktionsleiste (max. 3-4, zustandsabhängig):** Planungsmodus: Route planen / GPX laden / Demo-Fahrt. Während Fahrt (`isNavigating` in `App.tsx`, Zeile ~138): fast nichts, nur Abbrechen/Pause — das Ausblend-Prinzip existiert laut CHANGELOG teilweise schon, konsequent zu Ende führen.
- **Hauptmenü (neu — ☰-Button oder Bottom-Sheet):** alles andere, gruppiert in: Fahrt (REC Tour, Touren-Historie, GPX-Import/Export), E-Bike (Bosch/Bafang verbinden — `BoschConnectModal`, Display-Modi), Community (Lounge/`LoungeModal`, Ladesäulen-Scanner/`ScannerModal`), Einstellungen (Stimme/`VoiceSettingsModal`, Analytics-Opt-out, Account), Rechtliches (Impressum/`LegalModal` — garantiert erreichbar, nicht in überlaufender Leiste).

Zusätzlich zu bewerten/entscheiden (Audit Abschnitt 4, "wo drückt der Schuh"):
- Bottom-Tab-Navigation (Karte/Touren/Profil/Mehr) statt alles oben stapeln — Komoot/Strava/Google Maps nutzen das, passt zur Daumenzone bei Einhand-Bedienung am Lenker. Prüfen und, wenn sinnvoll, statt oder zusätzlich zum ☰-Menü umsetzen.
- Rechte FAB-Spalte (Play/Zoom/Locate/Layer/3D/Mic, 6 Icons) ist aktuell sauber, aber mehr Icons als vergleichbare Apps (Google Maps: 2-3) — prüfen ob reduzierbar, ohne Funktionalität zu verlieren.
- Token-Balance-Anzeige ist aktuell visuell prominenter als der Batteriestatus — bei einer App mit "ehrliche Reichweite" als Kernversprechen gehört der Akku-/Degradationsstatus mindestens gleichrangig, eher prominenter dargestellt.
- Kein sichtbares Suchfeld in den Audit-Screenshots — falls vorhanden, muss es aus der überlaufenden Leiste raus und permanent sichtbar werden (wie bei Komoot/Google Maps).

**Verifikationspflicht Phase 2:** Gleiche Methode wie Phase 1 — echte Screenshots über alle 9 Viewports, zusätzlich: Klick-/Interaktionstest, der jeden der 13 Modal-Einstiegspunkte (siehe `App.tsx` `lazy()`-Importe, Zeilen 27–64: AuthModal, AnticipationModal, ScannerModal, LoungeModal, AnalyticsModal, VoiceSettingsModal, BoschConnectModal, RideSummaryModal, GpxImportModal, EmergencyRangeModal, StationReviewModal, LegalModal, ConsentModal) über das neue Menü tatsächlich öffnet — Beweis per Playwright-Interaktionslog, nicht Behauptung.

---

## Phase 3 — Settings-Lücken schließen (eigener Branch + PR, baut auf Phase 2 auf)

Branch: `antigravity/gui-fix-phase3-settings`

Reihenfolge nach Priorität aus dem Audit:

1. **BLE-Geräteverwaltung** ("Meine Geräte"-Screen für alle 5 Hersteller — Bosch, Bafang, Specialized, Shimano, Mahle; Parser existieren bereits unter `src/services/ble/parsers/`) mit Verbindungsstatus, letzter Sync, Trennen-Option. Zuerst, weil es direkt an die laufenden Bosch/Bafang-BLE-Arbeiten anschließt.
2. **Einheiten-Umschalter** (km/h↔mph, °C↔°F).
3. **Zentrales Karten-/Display-Einstellungsmenü** (OLED-Modus, Sonnenlicht-Modus gebündelt statt Einzel-Toggles).
4. **Benachrichtigungs-Einstellungen** (UI-Ort für die an Jules vergebene FCM-Push-Aufgabe — prüfen, ob diese Jules-PR inzwischen gelandet ist, bevor hier parallel gebaut wird, um Konflikte zu vermeiden).
5. **Konto-/Datenexport** aus dem `LegalModal` in einen eigenen "Konto"-Bereich verschieben (DSGVO-Export/-Löschung).
6. **Karten-Offline-Verwaltung** — UI für `offlineMapService.ts` (227 Zeilen, existiert bereits ohne UI): welche Regionen sind heruntergeladen, Speicherplatz freigeben.

**Verifikationspflicht Phase 3:** Jede neue Einstellung muss real an den zugrundeliegenden Service/State gebunden sein (z.B. Einheiten-Umschalter tatsächlich `telemetry`-Formatierung ändern, nicht nur UI-Toggle ohne Wirkung) — Beweis per kurzem Funktionstest-Log (vorher/nachher-Wert), nicht nur Screenshot.

---

## Allgemeine Vorgaben für alle 3 Phasen

- **Branch + PR pro Phase**, kein Direkt-Push auf `main`. PR-Beschreibung muss auf den jeweiligen Audit-Abschnitt verweisen und jede Abweichung vom Audit-Vorschlag begründen.
- **Scope-Disziplin:** Phase 1 nicht mit Phase-2-Umbauten vermischen (z.B. nicht schon in Phase 1 das Hauptmenü bauen) — jede Phase muss für sich reviewbar/testbar sein.
- Vor jedem PR: `npm run build` (tsc -b && vite build) muss fehlerfrei laufen, bestehende Tests (`node --test`, Firestore-Rules-Tests) dürfen nicht brechen.
- Keine Phase gilt als abgeschlossen, solange die jeweilige Verifikationspflicht nicht mit echten Artefakten (Screenshots + JSON/Log) in der PR belegt ist — ein Claim ohne Beweis wird als nicht erledigt behandelt.
