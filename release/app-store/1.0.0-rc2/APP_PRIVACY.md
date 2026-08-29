# APPLE APP STORE CONNECT — APP PRIVACY / NUTRITION LABELS

Dieses Dokument definiert die exakten Antworten für den **App Privacy (Nutrition Label)** Fragebogen in **Apple App Store Connect**, abgeleitet aus [`docs/DATA_FLOW_MATRIX.md`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/docs/DATA_FLOW_MATRIX.md) und der realen iOS-Implementierung.

---

## 1. Tracking-Erklärung (App Tracking Transparency)

* **Werden Daten aus dieser App verwendet, um Nutzer über Apps und Websites anderer Unternehmen hinweg zu tracken?**
  * 👉 **NEIN** (Kein IDFA-Tracking, keine Weitergabe an Datenbroker).

---

## 2. Detaillierte Datenerhebung nach Kategorien

### A. Standortdaten (Location)
1. **Genauer Standort (Precise Location)**:
   * *Erhoben?* **JA**
   * *Mit Identität verknüpft (Linked to User)?* **NEIN** (Wird flüchtig im RAM für Live-Navigation & Steigungsprofile verarbeitet; GPS-Tracks werden nicht dauerhaft auf Cloud-Servern mit dem Account verknüpft).
   * *Zu Tracking-Zwecken verwendet?* **NEIN**
   * *Verwendungszweck*: **App-Funktionalität** (Turn-by-Turn Navigation, E-Bike Reichweitenprognose).
2. **Ungefährer Standort (Coarse Location)**:
   * *Erhoben?* **JA**
   * *Mit Identität verknüpft?* **NEIN**
   * *Verwendungszweck*: **App-Funktionalität** (Wetter- und Höhenabfragen über Betreiber-Proxy).

### B. Kontaktdaten & Nutzerkonto (Contact Info)
1. **E-Mail-Adresse (Email Address)**:
   * *Erhoben?* **JA** (Firebase Auth & Firestore `users`)
   * *Mit Identität verknüpft?* **JA**
   * *Zu Tracking-Zwecken verwendet?* **NEIN**
   * *Verwendungszweck*: **App-Funktionalität** (Kontoverwaltung, Passwort-Reset).
2. **Benutzer-ID (User ID)**:
   * *Erhoben?* **JA** (Zufällige Firebase UID)
   * *Mit Identität verknüpft?* **JA**
   * *Verwendungszweck*: **App-Funktionalität** (Zuordnung gespeicherter Routen und Token-Salden).

### C. Nutzergenerierte Inhalte (User Content)
1. **Routen & Touren (Custom Routes / GPX)**:
   * *Erhoben?* **JA** (Firestore `routes`)
   * *Mit Identität verknüpft?* **JA**
   * *Verwendungszweck*: **App-Funktionalität** (Persönliche Tourenbibliothek).
2. **Community-Ladesäulen & Meldungen**:
   * *Erhoben?* **JA** (Firestore `charging_stations`)
   * *Mit Identität verknüpft?* **NEIN** (Wird als öffentliche Radinfrastruktur gespeichert; bei Kontolöschung wird der Erstellerbezug unwiderruflich anonymisiert).

### D. E-Bike Telemetriedaten (BLE Sensors)
* *SoC / Akkustand, Trittfrequenz, Motorleistung*:
  * *Status*: **Wird rein lokal im flüchtigen RAM des Endgeräts über CoreBluetooth verarbeitet**.
  * *App Store Deklaration*: **Nicht als Datenerhebung einzustufen**, da keine Übertragung über das Internet stattfindet.

### E. Diagnosedaten (Diagnostics)
1. **Leistungs- & Absturzdaten (Performance Data / Crash Logs)**:
   * *Erhoben?* **JA** (Anonymisierte Performance-Metriken)
   * *Mit Identität verknüpft?* **NEIN**
   * *Verwendungszweck*: **App-Funktionalität / Analyse** (Fehlerbehebung und Performance-Optimierung).

### F. Finanzdaten (Financial Info)
* *Kreditkarten, In-App-Kaufhistorie*:
  * 👉 **KEINE DATEN ERHOBEN** (In Version 1.0 werden keine Bank- oder Zahlungsdaten erhoben).
