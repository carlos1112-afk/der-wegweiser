# GOOGLE PLAY DATA SAFETY FORMULAR — ANTWORTENLEITFADEN

Dieser Leitfaden enthält die exakten, wahrheitsgemäßen Antworten für das **Google Play Data Safety Formular** in der Play Console, abgeleitet aus dem realen Code und [`docs/DATA_FLOW_MATRIX.md`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/docs/DATA_FLOW_MATRIX.md).

---

## 1. Allgemeine Angaben zur Datenerhebung & Sicherheit

* **Erhebt oder teilt die App Nutzerdaten?** &rarr; **JA**
* **Werden alle von der App erhobenen Nutzerdaten bei der Übertragung verschlüsselt (In Transit)?** &rarr; **JA** (HTTPS / TLS 1.3)
* **Bietet die App Nutzern eine Möglichkeit, die Löschung ihrer Daten zu beantragen?** &rarr; **JA** (In-App Account-Löschung + Öffentliches Web-Löschformular unter `https://wegweiser.app/account-deletion.html`)

---

## 2. Detaillierte Fragebogen-Beantwortung nach Datenkategorien

### A. Standortdaten (Location)
1. **Ungefährer Standort (Approximate location)**:
   * *Erhoben?* **JA**
   * *Geteilt mit Dritten?* **NEIN**
   * *Flüchtig verarbeitet (Ephemeral)?* **JA**
   * *Zweck*: **App-Funktionalität** (Kartenanzeige, Wettervorhersage).
   * *Verknüpft mit Nutzerkonto?* **NEIN**
2. **Genauer Standort (Precise location)**:
   * *Erhoben?* **JA**
   * *Geteilt mit Dritten?* **NEIN**
   * *Flüchtig verarbeitet (Ephemeral)?* **JA** (Nur während aktiver Navigation im RAM / Foreground Service)
   * *Zweck*: **App-Funktionalität** (Turn-by-Turn Navigation, Reichweitenanalyse).
   * *Verknüpft mit Nutzerkonto?* **NEIN** (GPS-Tracks werden nicht dauerhaft auf Cloud-Servern mit dem Account verknüpft).

### B. Personenbezogene Daten (Personal Info)
1. **E-Mail-Adresse (Email address)**:
   * *Erhoben?* **JA** (Firebase Authentication & Firestore `users`)
   * *Geteilt mit Dritten?* **NEIN**
   * *Zweck*: **Kontoverwaltung** (Account Management & Authentifizierung).
   * *Verknüpft mit Nutzerkonto?* **JA**
   * *Löschbar?* **JA** (Vollständige Löschung nach Art. 17 DSGVO).
2. **Nutzer-IDs (User IDs)**:
   * *Erhoben?* **JA** (Zufällige Firebase UID)
   * *Zweck*: **App-Funktionalität / Kontoverwaltung**.

### C. Finanzdaten (Financial Info)
* **Kreditkarten, Bankverbindungen, Kaufhistorie**: &rarr; **KEINE DATEN ERHOBEN** (In Version 1.0 werden keine Bank- oder Kreditkartendaten verarbeitet).

### D. Nutzergenerierte Inhalte (User Content)
1. **Routen & Touren (Custom Routes)**:
   * *Erhoben?* **JA** (Firestore `routes`)
   * *Zweck*: **App-Funktionalität** (Speichern persönlicher Touren).
   * *Verknüpft mit Nutzerkonto?* **JA**
   * *Löschbar?* **JA**
2. **Community-Ladesäulen & Meldungen (Charging Stations & Scout Reports)**:
   * *Erhoben?* **JA** (Firestore `charging_stations`)
   * *Zweck*: **App-Funktionalität** (Bereitstellung öffentlicher Radinfrastruktur).
   * *Öffentlich geteilt?* **JA** (Für andere App-Nutzer einsehbar).
   * *Löschung / Anonymisierung*: Bei Kontolöschung wird die Ersteller-UID unwiderruflich auf `anonymous_community` umgeschrieben.

### E. E-Bike Telemetriedaten (Sensor & Health)
* **BLE-Sensordaten (Trittfrequenz, Motorleistung, Akkustand)**:
  * *Status*: **Wird rein lokal im flüchtigen Gerätespeicher (RAM) via Web Bluetooth/BLE verarbeitet**.
  * *Cloud-Upload*: **NEIN** (Keine Erhebung im Sinne des Play Store Cloud-Fragebogens).

### F. KI- & Wetter-Anfragen
* **KI-Prompts (Co-Pilot)** & **Wetterabfragen**:
  * *Status*: Werden flüchtig über den Betreiber-Backend-Proxy geroutet.
  * *Verknüpft mit Nutzerkonto?* **NEIN** (Anonyme Übertragung ohne Nutzer-UID).
  * *Dauerhafte Speicherung*: **NEIN**.

### G. In-App Tokens & Punktestände
* **Wegweiser Tokens**:
  * *Erhoben?* **JA** (Firestore `user_tokens`)
  * *Zweck*: **App-Funktionalität** (Punkteverwaltung für Quests/Lounge).
  * *Verknüpft mit Nutzerkonto?* **JA**
  * *Löschbar?* **JA** (Wird bei Kontolöschung vollständig gelöscht).
