# RELEASE RECORD — DER WEGWEISER 1.0.0 (RC2)

* **Release Candidate**: `1.0.0 (1) - RC2`
* **App Name**: `Der Wegweiser`
* **Package / Application ID**: `app.derwegweiser.navi`
* **Version Name**: `1.0.0`
* **Version Code**: `1` — **VERBRAUCHT (VON GOOGLE PLAY AKZEPTIERT)**
* **Distribution**: `Kostenlos` (Free)
* **Aktiver Track**: `Closed Testing` (Geschlossener Test — Google Play)
* **Installationsquelle**: `Google Play Store` (Offizieller Store-Build)
* **Release Commit**: `8db3bc29d88bfbeddc5daf78c08cb4a3001ba7f8`
* **Artifact Source Commit (Binary)**: `8f07c7f30df618ceb900b56a047a73064a06c402`
* **Git Tag**: `v1.0.0-rc2`
* **Build-Datum**: `2026-08-29`
* **Compile SDK**: `36` (Android 16)
* **Target SDK**: `36` (Android 16 — Google Play Store konform)
* **Min SDK**: `24` (Android 7.0+)

---

## 📦 Artefakt- & Signatur-Verifikation

* **AAB-Pfad**: `release/google-play/1.0.0-rc2/app-release.aab`
* **Dateigröße**: `4.765.811 Bytes` (ca. 4,6 MiB)
* **AAB SHA-256 Checksumme**: `51c2b1b416ad1e0db469075bce81febca8fb7aeede8116068e1c1ae53bf4e26d`
* **Upload-Zertifikat Subject**: `CN=Der Wegweiser Android Upload Key, O=Der Wegweiser, C=DE`
* **Upload-Key SHA-256**: `61:69:23:60:E5:96:27:DC:75:7E:15:67:C9:7C:C9:62:ED:EC:1F:C1:1F:85:65:C7:46:42:CD:83:AD:03:CC:10`
* **Upload-Key SHA-1**: `88:CB:0D:62:3F:42:33:CD:5D:9F:7B:04:D4:34:67:07:08:CE:2B:79`
* **Google Play App Signing**: Von Google Play eingerichtet und in Firebase Console unter *Android-App `app.derwegweiser.navi`* registriert.

---

## 📱 Reale Geräte- & Runtime-Validierung (Physical Device Test)

* **Status**: **VOLLSTÄNDIG BESTANDEN (100%)**
* **Geprüfte Punkte**:
  * **Lifecycle & Stabilität**: Kaltstart, Warmstart, Force-Stop & Reboot ohne Datenverlust oder Crash Loop.
  * **Berechtigungen**: Präziser Standort & Notification granted; 0 Abfrage von `ACCESS_BACKGROUND_LOCATION`.
  * **Navigation & FGS**: Turn-by-Turn, persistente Foreground Notification, Audioführung bei gesperrtem Bildschirm, Re-Routing.
  * **FGS-Demovideo**: **FGS VIDEO READY** (30s Aufnahme am echten Store-Build erstellt).
  * **AI Gateway**: Antworten sichtbar, 0 Client-Keys geleakt, kontrollierte Offline-Degradation bei Netzwerkverlust.
  * **Wetter-Dienst**: Online-Wetter live geladen; bei Netzwerkverlust saubere Fallback-Anzeige ohne Fake-Werte.
  * **Höhenprofil (Elevation)**: Plausible Höhendarstellung; sauberer Barometer-/Topographie-Fallback.
  * **BLE Reconnect**: Sensor-Kopplung, Reconnect nach Signalverlust und bei minimierter App stabil.
  * **Offline-Modus**: Flugmodus mit Offline-Kacheln, Routing-Korridor und Vertrauens-Degradationswarnung.
  * **Datenschutz & DSGVO Art. 17**: Datenexport (Art. 15) und vollständige Kontolöschung via In-App-Cockpit.
  * **Logcat**: 0 Fatal Exceptions, 0 ANRs, 0 Security/Permission-Errors.

---

## 🔒 Backend & Firestore Rules

* **Firestore Rules**: **LIVE VERIFIED** (Erfolgreich nach `der-wegweiser` deployed; Mandantentrennung, `station_reviews`, `isNotSuspended()` und `/content_reports/` Schutz live verifiziert).

---

## 👥 Closed Testing Track (Aktiv)

* **Google Play Policy (für persönliche Entwicklerkonten ab Nov 2023)**:
  * Mindestanzahl Tester: **12 Tester**
  * Mindestdauer: **14 aufeinanderfolgende Tage Opt-in**
  * Track: **Closed Testing** (Geschlossener Test)
  * Verwendeter Build: `Der Wegweiser 1.0.0 (1) - RC2`
