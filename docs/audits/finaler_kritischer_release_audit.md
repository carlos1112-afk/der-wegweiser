# Finaler kritischer Release-, Legal- & Architektur-Counter-Audit (Version 1.0)

**Audit-Rolle**: Principal Software Architect, Release Engineer, Security Engineer & Compliance Reviewer  
**Audit-Datum**: 29. August 2026  
**Status**: Feature Freeze aktiv · Schärfungs- und Counter-Audit-Pass 2  
**Projekt**: Der WEGWEISER (`der-wegweiser` / `europe-west3`)

---

## 1. Methodik & Gegenprüfung (Counter-Audit-Prinzip)

Sämtliche Vorberichte und Annahmen wurden einer harten Falsifikationsprüfung unterzogen. Jede Behauptung wurde erst als verifiziert eingestuft, nachdem der Falsifikationsversuch anhand des tatsächlichen Codes, realer Builds, Netzwerk-Traces und Abhängigkeiten gescheitert ist.

Pauschalaussagen („100 % konform“, „wasserdicht“, „vollständig unabhängig“, „keine Risiken“, „keine Secrets existieren“) wurden eliminiert und durch differenzierte, belastbare Fakten ersetzt.

---

## 2. Die 4 Verifikationstabellen

### Tabelle 1: VERIFIZIERT (durch Code, Tests oder Konfiguration belegt)

| Bereich / Thema | Gegenstand & Technische Evidenz | Falsifikationsprüfung & Ergebnis |
| :--- | :--- | :--- |
| **Secret- & Credential-Hygiene** | Automatisierter Scanner über alle Bundles in `dist/assets/*.js` auf API-Keys, JWTs, PEM-Keys, Bearer-Header, Service-Account-JSONs und Source Maps (`.map`). | **Bestanden**: Keine bekannten Secret- oder Credential-Muster im Produktions-Bundle gefunden. Source Maps sind im Release-Build deaktiviert. |
| **Ehrliche Routing-Degradation** | [`RoutingService.ts`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/services/routingService.ts): Bei BRouter-Ausfall wird kein fingiertes Straßen-Routing erzeugt, sondern transparent `isRoadSnapped = false`, `routingEngineStatus = 'offline_corridor_unverified'` und ein sichtbarer Warnhinweis gesetzt. | **Bestanden**: Offline-Polygon wird als unbestätigter Orientierungskorridor ohne Straßenbindung deklariert (+15% Detour-Sicherheitsreserve im Wh-Verbrauch). |
| **Ehrlicher Wetter-Fallback** | [`WeatherService.ts`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/services/weatherService.ts): Bei API-Ausfall werden keine scheinbaren 22 °C / 14 km/h erfunden, sondern `weatherStatus = 'unavailable'` und `rangeConfidence = 'reduced_conservative'` mit +10% Unsicherheits-Sicherheitsreserve ausgegeben. | **Bestanden**: UI ([`WeatherHUD.tsx`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/components/WeatherHUD/WeatherHUD.tsx)) zeigt `CloudOff`-Icon und weist die +10% Akku-Reserve transparent aus. |
| **Öffentliche Anbieterkennzeichnung (§ 5 DDG)** | Name, Real-Adresse und E-Mail in [`src/config/legalConfig.ts`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/config/legalConfig.ts) und UI ([`LegalModal.tsx`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/components/Legal/LegalModal.tsx)). | **Bestanden**: Gesetzlich geforderte Pflichtangaben (Pascal Gregor, Lindenstraße 8, 02979 Spreetal) werden öffentlich im Impressum gerendert. |
| **Lokale Betroffenenrechte (Art. 17 & 20 DSGVO)** | 1-Klick JSON-Export und 1-Klick Speicherlöschung im Daten-Cockpit ([`LegalModal.tsx`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/components/Legal/LegalModal.tsx)). | **Bestanden**: Generiert vollständiges JSON-Objekt aller lokalen Speicherstände und leert `localStorage`/`IndexedDB` sofort. |
| **Kanonisches AI Gateway** | [`aiGatewayService.ts`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/services/ai/aiGatewayService.ts): Vollständige Abstraktion in 5 Fähigkeiten mit austauschbaren Adaptern (`backend_proxy`, `openai`, `anthropic`, `ollama`, `heuristic_offline`). | **Bestanden**: Zero Client Keys. Inferenz läuft über Backend-Proxy bzw. lokale Offline-Heuristik. |

---

### Tabelle 2: KORREKTUR DURCHGEFÜHRT (im Rahmen dieses Passes behoben)

| Bereich / Thema | Ursprünglicher Mangel / Risiko | Durchgeführte Korrekturmaßnahme |
| :--- | :--- | :--- |
| **Fingierte Straßenroute bei Routingausfall** | Mathematischer Sinus-Kreis wurde als „befahrbare Radroute über sanften Asphalt“ tituliert. | Vollständige semantische und technische Umstellung: Kennzeichnung als `isRoadSnapped = false` und `routingEngineStatus = 'offline_corridor_unverified'` mit expliziter Warnung vor Gewässern/Bahntrassen. |
| **Scheinbare Messdaten bei Wetterausfall** | Bei Netzausfall rechnete das System stillschweigend mit 22 °C und 14 km/h. | Umstellung auf deklariertes `unavailable` und automatischer +10% Akku-Sicherheitsaufschlag für meteorologische Unsicherheit. |
| **Secret-Leakage in Client-Bundle** | `.env.local` enthielt Drittanbieter-Schlüssel, die über `VITE_*` in den Web-Build gelangten. | `.env.local` vollständig bereinigt. Provider-Keys aus dem Client-Code entfernt. |
| **Hardcodierte Fallback-API-Keys** | In `src/firebase.ts` und `src/services/aiAssistantService.ts` waren Fallback-Strings hinterlegt. | Hartcodierte Keys und Tokens restlos entfernt; Konfiguration liest dynamisch aus Umgebung. |
| **Rechtsnachfolge-Klausel** | Pauschale Behauptung unberührter Gültigkeit bei Unternehmensübertragung. | Präzisiert: *"Der Übergang in ein vom selben Inhaber betriebenes Einzelunternehmen führt grundsätzlich nicht zu einem Wechsel der natürlichen Person als Rechtsträger. Änderungen von Verarbeitungszwecken, Vertragsbedingungen oder Geschäftsmodell sind davon unabhängig gesondert zu prüfen. Eine spätere Übertragung auf eine eigenständige juristische Person (z. B. UG oder GmbH) stellt einen gesonderten Verantwortlichenwechsel dar."* |
| **Rechtliche Trennung „Dateneigentum“** | Begriff „Eigentum an Nutzerdaten“ vermischte Urheber- und Datenschutzrecht. | Korrekt getrennt: Datenbankherstellerrecht (§§ 87a ff. UrhG) und Geschäftsgeheimnisschutz (§ 2 GeschGehG) an der aggregierten Datenbank vs. Betroffenenrechte und Datenhoheit der Nutzer (Art. 17, 20 DSGVO). |
| **Open-Meteo Speicherfristen** | Pauschale Formulierung „Access Logs zur Missbrauchsprävention“. | Konkretisiert auf die offizielle Open-Meteo Richtlinie: Maximale Speicherdauer von **90 Tagen** für Server-Logs (inkl. Geo-Koordinaten und URLs). |
| **Abgrenzung Betreiberdaten vs. Secrets** | Unsaubere Gleichsetzung von „keine sensiblen Daten im dist“ mit Betreiberdaten. | Klare Differenzierung: Private Secrets/Keys sind verboten; öffentlich vorgeschriebene Impressumsdaten landen bestimmungsgemäß im Client-Bundle. |

---

### Tabelle 3: EXTERN / ADMINISTRATIV ZU VERIFIZIEREN (liegt außerhalb des lokalen Codes)

| Bereich / Thema | Notwendige externe Prüfung | Verantwortlichkeit / Einordnung |
| :--- | :--- | :--- |
| **BFSG-Status (§ 3 Abs. 3 BFSG)** | Erfüllung der Schwellenwerte für Kleinstunternehmen (< 10 Mitarbeiter, &le; 2 Mio. € Jahresumsatz). | **Administrativ / Betreiberangabe**: Gesetzliche Ausnahme in AGB deklariert; tatsächlicher Nachweis ist eine betriebswirtschaftliche Tatsache. |
| **Widerrufsprozess bei digitalen Käufen** | Bereitstellung der Vertragsbestätigung auf dauerhaftem Datenträger (z. B. E-Mail-Quittung / PDF) gem. § 312f BGB. | **Prozessual / Payment-Gateway**: Bei Anbindung des finalen In-App Zahlungsabwicklers (Stripe / Google Play Billing) im Live-Flow zu verifizieren. |
| **Google Play Background Location Review** | Genehmigung der Hintergrund-Standortberechtigung (`ACCESS_BACKGROUND_LOCATION`) für Navigation & Akkuüberwachung. | **Pascal Gregor**: Nachweis-Video in Google Play Console hochladen, das die Notwendigkeit der Hintergrundnavigation bei gesperrtem Bildschirm demonstriert. |
| **Firebase Auftragsverarbeitungsvertrag (AVV / DPA)** | Gültiger DPA mit Google Cloud EMEA Limited für Firestore in Frankfurt (`europe-west3`) und SCCs für globale Dienste. | **Pascal Gregor**: Im GCP- / Firebase-Account unter „Datenschutz und Compliance“ den elektronischen AVV bestätigen. |
| **Open-Meteo Lizenz bei Skalierung** | Prüfung des kommerziellen Abfragelimits (10.000 Requests/Tag) bei steigenden Nutzerzahlen. | **Pascal Gregor / Betrieb**: Bei Überschreiten der kostenlosen Abfragegrenzen auf kommerzielles Open-Meteo-Abonnement oder selbst gehosteten Bright Sky / DWD Container umstellen. |
| **B2B-Partnerverträge (Lounge / Sponsoring)** | Individuelle vertragliche Vereinbarungen mit lokalen Lade-Partnern. | **Pascal Gregor**: B2B-Partnervereinbarungen vor Schaltung bezahlter In-App-Pins bilateral abschließen. |
| **Git-Historie & Öffentliche Einsicht** | Das Repository steht öffentlich auf GitHub; frühere Commits (z. B. `383aca4`) enthielten Betreiberangaben. | **Dokumentierte Ist-Lage**: Klone/Forks/Caches können existieren. Da es sich um gesetzliche Pflichtangaben des Impressums handelt, besteht kein Betriebsnotfall, aber die Historie ist öffentlich dokumentiert. |

---

### Tabelle 4: RELEASE-BLOCKER (muss vor 1.0 zwingend gelöst werden)

| Blocker-ID | Beschreibung | Status | Lösungsweg |
| :--- | :--- | :--- | :--- |
| **KEINE LOKALEN BLOCKER** | Alle lokalen Code-, Build-, TypeScript-, Lint-, Secret- und Degradations-Prüfungen sind erfolgreich durchlaufen. | **0 LOKALE BLOCKER** | Release-Candidate für externe Vorbereitung freigegeben. |

---

## 3. Detaillierte Firebase-Infrastruktur- & Datenstandort-Matrix

Entgegen vereinfachten Pauschalaussagen („alles in Frankfurt“) läuft die Google Firebase-Infrastruktur auf einer differenzierten Hybrid-Architektur:

| Firebase-Dienst | Im Wegweiser verwendet? | Tatsächlicher Datenstandort | Rechtsgrundlage & Drittlandtransfer |
| :--- | :--- | :--- | :--- |
| **Cloud Firestore** | **Ja** (Segmente, Salden, Leads) | **Frankfurt (`europe-west3`)** | Art. 6 Abs. 1 lit. b DSGVO; GCP DPA Frankfurt |
| **Firebase Authentication** | **Ja** (Nutzer-Tokens, Auth) | **USA (Google Global Auth Centers)** | Art. 6 Abs. 1 lit. b DSGVO; EU-US Data Privacy Framework / SCC |
| **Firebase App Hosting / CDN** | **Ja** (Statische Web-Assets) | **Global Edge Network (Multi-Region)** | Art. 6 Abs. 1 lit. f DSGVO; Geografisch verteiltes Caching |
| **Cloud Functions / Backend Proxy** | **Ja** (KI-Gateway & Telemetrie) | **Frankfurt (`europe-west3`)** | Art. 6 Abs. 1 lit. b DSGVO; DPA Frankfurt |
| **Cloud Storage** | **Ja** (Station-Fotos, Icons) | **Frankfurt (`europe-west3`)** | Art. 6 Abs. 1 lit. b DSGVO; DPA Frankfurt |
| **Firebase App Check** | **Optional** (DDoS-Schutz) | **Global Edge (Google Trust Services)** | Art. 6 Abs. 1 lit. f DSGVO |

---

## 4. Selbstkritische Failure-Mode-Analyse (5 Stresstests)

### 1. Ausfall des KI-Backends (API Down / HTTP 500 / Timeout)
* **Verhalten**: `AiGatewayService` fängt den Netzwerk-Fehler im Controller-Signal nach maximal 8.000 ms ab und schaltet geräuschlos auf die mathematisch-physikalische Offline-Heuristik um.
* **Nutzer-Erlebnis**: Die Tourenantizipation, Reichweitenanalyse und Sprachführung bleiben nahtlos funktionsfähig. Es erscheint kein Fehlerdialog.

### 2. Ausfall des Routing-Servers (BRouter API unreachable)
* **Verhalten**: `RoutingService` markiert die Route als `isRoadSnapped = false` und deklariert sie als `offline_corridor_unverified`. Ein Sicherheitsaufschlag von +15% wird auf den Energieverbrauch aufgeschlagen.
* **Nutzer-Erlebnis**: Der Nutzer sieht eine deutliche Warnung: *„⚠️ Ungeprüfter Offline-Korridor: Keine Straßen- und Wegenetzprüfung verfügbar.“*

### 3. Open-Meteo Wetterdienst nicht erreichbar
* **Verhalten**: `WeatherService` gibt `weatherStatus = 'unavailable'` und `rangeConfidence = 'reduced_conservative'` zurück und schlägt eine +10% Akku-Reserve auf.
* **Nutzer-Erlebnis**: Die HUD-Leiste zeigt das Offline-Symbol und den Hinweis *„+10% Akku-Korrektur (Reserve)“*.

### 4. Kompletter Offline-Modus (Flugmodus / Funkloch im Wald)
* **Verhalten**: Die App nutzt ausschließlich im `localStorage` und in `IndexedDB` gespeicherte Kacheln, Offline-Regionen und gespeicherte Touren.
* **Nutzer-Erlebnis**: Turn-by-Turn-Navigation auf gecachten Strecken, GPS-Tracking, BLE-Telemetrie und Sicherheitswarnungen arbeiten vollkommen netzunabhängig.

### 5. Firestore-Datenbankverbindung unterbrochen
* **Verhalten**: Lokale Tokens, Fahrten und Offline-Routen werden im lokalen Cache (`IndexedDB`) verwaltet.
* **Nutzer-Erlebnis**: Keine Blockade der Benutzeroberfläche; Synchronisation erfolgt automatisch beim nächsten Verbindungsaufbau.

---

## 5. Reale Migrationsbetrachtung (Firestore zu Alternativen)

* **Planungsschätzung (NICHT VERIFIZIERT)**: Ein Wechsel von Google Cloud Firestore zu PostgreSQL / SQLite / Supabase erfordert:
  * **Datenmodell**: Übertragung von 8 Collections (`users`, `user_tokens`, `b2b_sponsors`, `crowd_segments`, `charging_stations_v2`, `scout_reports`, `partner_leads`, `app_config`).
  * **Sicherheitsregeln**: Übersetzung der Firestore Security Rules in PostgreSQL Row-Level-Security (RLS).
  * **Client-Code**: Umstellung von 12 Service-Klassen, die derzeit das `@firebase/firestore` SDK (`collection`, `doc`, `onSnapshot`, `setDoc`) verwenden.
  * **Geschätzter Aufwand**: **2 bis 4 Entwicklertage** Planungsschätzung bis zur vollständigen Testverifikation.

---

## 6. Finales Prüfurteil

```
================================================================================
FINAL AUDIT VERDICT:
RELEASE CANDIDATE – EXTERNE PRÜFUNGEN AUSSTEHEND
================================================================================
```

### Begründung:
1. **Lokaler Code & Architektur**: Alle lokalen Blocker, Hardcoded-Keys, TypeScript-Fehler, ungenaue Wetter-/Routing-Degradationen und unzureichende Rechtsformulierungen wurden behoben und automatisiert validiert.
2. **Externe Nachweise**: Die Veröffentlichung als finale Version 1.0 erfordert die formale Freigabe der Hintergrund-Standortberechtigung durch Google Play und die Hinterlegung des AVV in der GCP-Konsole durch den Betreiber Pascal Gregor.
