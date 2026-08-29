# MAC HANDOFF — DER WEGWEISER 1.0.0 (IOS RC2)

* **App Name**: `Der Wegweiser`
* **Bundle ID**: `app.derwegweiser.navi`
* **Marketing Version**: `1.0.0`
* **Build Number**: `1`
* **Deployment Target**: `iOS 15.0+`
* **Distribution**: `Kostenlos` (Free)
* **Initialer Track**: `TestFlight (Internal Testing)`

---

## 🔒 Provenance & Quellstand (Authoritative Source of Truth)

* **iosSourceCommit**: `8f07c7f30df618ceb900b56a047a73064a06c402`
* **checkoutTarget**: `8f07c7f30df618ceb900b56a047a73064a06c402`
* **releaseTag**: `v1.0.0-rc2`
* **releaseTagTarget**: `4afbf57f22e62068be34caea675afaddc468d386`

---

## 📊 Status-Matrix

* **iosSourceCheckPassed**: `true` (Lokal unter Linux verifiziert)
* **macArchiveCreated**: `false` (Ausstehend auf realem Mac)
* **xcodeValidationPassed**: `false` (Ausstehend auf realem Mac)
* **testFlightUploaded**: `false` (Ausstehend)
* **testFlightProcessed**: `false` (Ausstehend)
* **testFlightAvailable**: `false` (Ausstehend)
* **realIphoneTestPassed**: `false` (Ausstehend)

---

## 🛠️ Verbindliche Befehlssequenz für den Mac

Auf dem Ziel-Mac im Terminal ausführen:

```bash
# 1. Verbindlichen Quellstand auschecken
git checkout 8f07c7f30df618ceb900b56a047a73064a06c402

# 2. Toolchain verifizieren
xcodebuild -version
sw_vers
xcrun --sdk iphoneos --show-sdk-version

# 3. Web-Assets bauen & nativen iOS-Workspace synchronisieren
npm ci
npm run build
npx cap sync ios

# 4. Lokalen iOS-Prüflauf auf macOS ausführen
./release-check-ios.sh

# 5. Xcode öffnen
open ios/App/App.xcworkspace
```

### In Xcode:
1. **Signing & Capabilities**: Apple Developer Team auswählen (*Automatic Distribution Signing*).
2. **Archivieren**: `Product &rarr; Archive`.
3. **Validieren**: Im Organizer **„Validate App“** ausführen.
4. **Hochladen**: **„Distribute App &rarr; App Store Connect &rarr; TestFlight“**.

---

## 👤 Betreiberinteraktion (Nur bei Bedarf)

Stopppunkte ausschließlich bei:
* **Apple-ID Login / 2FA**
* **Developer Team Auswahl**
* **Vertragsannahme / DSA-Trader-Angaben in App Store Connect**
