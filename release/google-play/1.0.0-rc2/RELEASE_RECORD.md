# RELEASE RECORD — DER WEGWEISER 1.0.0 (RC2)

* **Release Candidate**: `1.0.0 (1) - RC2`
* **App Name**: `Der Wegweiser`
* **Package / Application ID**: `app.derwegweiser.navi`
* **Version Name**: `1.0.0`
* **Version Code**: `1`
* **Distribution**: `Kostenlos` (Free)
* **Initialer Track**: `Internal Testing` (Interner Test)
* **Release Commit (Docs & Manifest)**: `081484701d199ca9edc74756914a240c0f7e05b7`
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

---

## 🔒 Backend & Firestore Rules

* **Firestore Rules**: **LIVE VERIFIED** (Erfolgreich nach `der-wegweiser` deployed am 2026-08-29T03:43:18+02:00; Mandantentrennung, `isNotSuspended()` und `/content_reports/` Schutz live verifiziert).

---

## 🔒 Standort- & Berechtigungs-Status

* **ACCESS_BACKGROUND_LOCATION**: **Entfernt (Nicht im Manifest)**. Keine gesonderte Background-Location-Permission-Erklärung erforderlich.
* **Standortberechtigungen im Manifest**: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
* **Vordergrunddienste & Benachrichtigungen**: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `WAKE_LOCK`.
* **Play Console Erklärungen**: `PLAY_FOREGROUND_SERVICE_DECLARATION.md` und `PLAY_PRECISE_LOCATION_DECLARATION.md` vollständig hinterlegt.

---

## 🌐 Live-Web-Ressourcen (LIVE VERIFIED)

* **Datenschutzerklärung (HTTPS)**: `https://der-wegweiser.web.app/privacy.html` — **LIVE VERIFIED (HTTP 200)**
* **Konto- & Datenlöschseite (HTTPS)**: `https://der-wegweiser.web.app/account-deletion.html` — **LIVE VERIFIED (HTTP 200)**
