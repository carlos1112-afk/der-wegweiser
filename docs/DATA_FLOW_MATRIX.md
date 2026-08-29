# DATENFLUSS- & DATA SAFETY MATRIX — DER WEGWEISER 1.0

Dieses Dokument ist die verbindliche **Single Source of Truth** für:
1. **Google Play Data Safety Formular**
2. **Apple App Privacy Labels**
3. **Datenschutzerklärung (Art. 13/14 DSGVO)**
4. **Account-Löschpfad (Art. 17 DSGVO)**

---

## 📊 1. Datenkategorien & Verarbeitungs-Matrix

| Datenkategorie | Erhoben? | Speicherort | Zweck | Mit Nutzer verknüpft? | Mit Dritten geteilt? | Verschlüsselt (In Transit)? | Löschweg (Art. 17 DSGVO) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Präziser Standort (GPS)** | **JA** | **Lokal im Gerät** (temporärer RAM; Navigation via Foreground Service) | App-Funktionalität (Navigation, Reichweitenanalyse) | **NEIN** (Nicht dauerhaft in Cloud gespeichert) | **NEIN** | **JA** (HTTPS/TLS) | Wird bei Beenden der Route verworfen; lokaler Cache leerbar. |
| **Foreground Service Location** | **JA** | **Lokal im Gerät** (Foreground Service während aktiver Navigation) | Navigation bei gesperrtem Bildschirm / Display-Off | **NEIN** | **NEIN** | **JA** | Automatischer Stopp bei Navigationsende. |
| **Nutzerkonto & E-Mail** | **JA** | **Cloud** (Firebase Auth & Firestore `users`) | Authentifizierung & Kontoverwaltung | **JA** | **NEIN** (Nur Firebase/Google Cloud Auftragsverarbeiter) | **JA** (TLS 1.3) | Vollständige Löschung via In-App Account Deletion & `account-deletion.html`. |
| **Wegweiser Tokens & Bilanzen** | **JA** | **Cloud** (Firestore `user_tokens`) | Belohnungssystem & Punktestand | **JA** | **NEIN** | **JA** | Wiped bei Account-Löschung. |
| **E-Bike Telemetrie (BLE)** | **JA** | **Ausschließlich Lokal** (Web Bluetooth/BLE) | Reichweitenberechnung, Akkustand | **NEIN** | **NEIN** | Nicht im Internet übertragen | Verbleibt rein flüchtig im RAM des Geräts. |
| **Eigene Routen (Custom Routes)** | **JA** | **Cloud** (Firestore `routes`) | Speichern eigener Touren | **JA** | **NEIN** | **JA** | Vollständig gelöscht bei Account-Löschung. |
| **Community-Ladesäulen** | **JA** | **Cloud** (Firestore `charging_stations`) | Öffentliche Ladeinfrastruktur für Radfahrer | **ANONYMISIERT** | **JA** (Öffentlich für andere App-Nutzer) | **JA** | Personenbezogene UID wird bei Account-Löschung unwiderruflich auf `anonymous_community` umgeschrieben. |
| **Wetter- & Höhenabfragen** | **JA** | **Server-Proxy Cache** (temporär) | Wetter- und Höhenprofil der Route | **NEIN** (Nur Geokoordinaten ohne Nutzerbezug) | Open-Meteo via Server-Proxy | **JA** | Server-Cache wird nach 15 Min / 24 Std automatisch überschrieben. |
| **KI-Assistent Anfragen** | **JA** | **Server-Proxy** (flüchtig) | Reale Sprach-/Textberatung auf der Tour | **NEIN** (Keine Nutzer-UID im Prompt) | Vertex AI (europe-west3) | **JA** | Keine permanente Speicherung von Prompts im Backend. |

---

## 🔒 2. Google Play Data Safety Mapping

* **Data Collected**:
  * *Location* -> Approximate Location & Precise Location (App Functionality, ephemeral, foreground service).
  * *Personal Info* -> Email Address (Account Management).
  * *Financial Info* -> User payment info: **None** (No credit cards stored).
  * *Photos and Videos* -> Photos (Optional Scout-Reports).
* **Data Shared**:
  * **None** for marketing or advertising purposes without consent.
* **Security Practices**:
  * Data is encrypted in transit (HTTPS/TLS).
  * Request data deletion is supported (**Yes** — automated in-app & via public web endpoint `https://der-wegweiser.web.app/account-deletion.html`).
