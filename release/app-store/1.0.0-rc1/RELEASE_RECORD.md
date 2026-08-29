# RELEASE RECORD — DER WEGWEISER 1.0.0 (IOS RC)

* **Release Name**: `1.0.0 (1) - iOS RC2`
* **App Name**: `Der Wegweiser`
* **Bundle ID**: `app.derwegweiser.navi`
* **Marketing Version**: `1.0.0`
* **Build Number**: `1`
* **Distribution**: `Kostenlos` (Free)
* **Initialer Track**: `TestFlight (Internal Testing)`
* **Git Commit Hash**: `f19d296423f4c2834044c4c2e5cbc3c65368c560`
* **Git Tag**: `v1.0.0-rc2`
* **Deployment Target**: `iOS 15.0+`
* **Ziel-Toolchain für Mac-Build**: `Xcode >= 26.0` / `iOS SDK >= 26.0` (auf `macOS Sequoia >= 15.6` oder neuer)
* **Status**: **IOS SOURCE-/KONFIGURATIONSSEITIG VERIFIZIERT – XCODE/TESTFLIGHT AUSSTEHEND**

---

## 🔒 Quellcode- & Compliance-Verifikation

* **Export Compliance**: `<key>ITSAppUsesNonExemptEncryption</key><false/>` (Standard HTTPS/TLS 1.2+).
* **Tracking & Datenschutz**: Kein IDFA-Tracking, `NSPrivacyTracking = false`.
* **Privacy Manifest**: `PrivacyInfo.xcprivacy` mit Required-Reason-Codes `CA92.1`, `35F9.1`, `C617.1`.
* **Background Modes**: Streng minimiert auf `location`, `audio`, `bluetooth-central`.
* **UGC Compliance (Guideline 1.2)**: In-App Meldefunktion (`content_reports`), Vorab-Filterung (`filterUgcText`) und serverseitige Nutzersperre (`isNotSuspended()`).

---

## 🛠️ Mac-Build & TestFlight Archivierung

Sobald ein Mac mit Xcode 26+ verfügbar ist:

```bash
# 1. Gemeinsamen Release-Stand auschecken
git checkout v1.0.0-rc2

# 2. Web Production Build & Sync
npm ci && npm run build && npx cap sync ios

# 3. Xcode öffnen und Release-Archiv erstellen
open ios/App/App.xcworkspace
# In Xcode: Product -> Archive -> Distribute App -> TestFlight
```
