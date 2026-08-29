# RELEASE RECORD — DER WEGWEISER 1.0.0 (IOS RC)

* **Release Name**: `1.0.0 (1) - iOS RC2`
* **App Name**: `Der Wegweiser`
* **Bundle ID**: `app.derwegweiser.navi`
* **Marketing Version**: `1.0.0`
* **Build Number**: `1`
* **Distribution**: `Kostenlos` (Free)
* **Initialer Track**: `TestFlight (Internal Testing)`
* **Release Manifest Commit**: `8d6b34df51c6620e067c2fd4725ab01773b88aef`
* **App Source Commit (Binary & Native Code)**: `8f07c7f30df618ceb900b56a047a73064a06c402`
* **Git Tag**: `v1.0.0-rc2`
* **Deployment Target**: `iOS 15.0+`
* **Ziel-Toolchain für Mac-Build**: `Xcode >= 26.0` / `iOS SDK >= 26.0` (dynamisch gekoppelt an die vom Apple Developer Portal für die konkrete Xcode-26-Version geforderte macOS-Version).
* **Status**: **IOS SOURCE CHECK BESTANDEN – EXTERNER MAC/XCODE ARCHIVE & VALIDATION AUSSTEHEND**

---

## 🔒 Quellcode- & Compliance-Verifikation (Source Verified)

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

# 2. Dynamische Versionsprüfung auf dem Mac
xcodebuild -version
sw_vers

# 3. Web Production Build & Native iOS Sync
npm ci && npm run build && npx cap sync ios

# 4. Lokalen iOS Release Check auf dem Mac wiederholen
./release-check-ios.sh

# 5. Xcode öffnen
open ios/App/App.xcworkspace
# In Xcode: Product -> Archive -> Organizer -> Validate App -> Distribute App -> TestFlight
```
