# TOOLCHAIN DOKUMENTATION & PINNING — DER WEGWEISER 1.0

Dieses Dokument definiert die verbindlich gepinnte Build- und Laufzeitumgebung für **Der Wegweiser Version 1.0**.

---

## 📌 1. Gepinnte Produktionsversionen

| Komponente | Gepinnte Version | Zweck / Relevanz |
| :--- | :--- | :--- |
| **Node.js** | `>=20.10.0` (Empfohlen: v22.x LTS) | Frontend-Toolchain, Vite, OxLint |
| **npm** | `>=10.0.0` | Dependency Management & Lockfile (`package-lock.json`) |
| **Java (JDK)** | **OpenJDK 21.0.12** | Gradle 8.14.3 Compiler & Capacitor Toolchain |
| **Gradle** | **8.14.3** (via `android/gradle/wrapper/`) | Android Build System |
| **Android Compile SDK** | **API 36** | Android API Kompatibilität |
| **Android Target SDK** | **API 36** | Google Play Store Anforderung (Android 16+) |
| **Android Min SDK** | **API 24** | Android 7.0+ Abwärtskompatibilität |
| **Capacitor Core / CLI** | **8.x / 6.x** | Hybrid Web-to-Native Bridge |
| **macOS (Build Host)** | **>=15.6 (Sequoia)** | Erforderlich für Xcode 26.0+ |
| **Xcode** | **>=26.0** | App Store Connect Standard (iOS SDK >= 26) |
| **iOS SDK** | **>=26.0** | Apple Store Einreichungs-Standard |
| **iOS Deployment Target**| **iOS 15.0+** | Apple Mindestanforderung für Capacitor 8 |
| **React** | **18.3.1** | UI Framework |
| **TypeScript** | **5.x** | Statische Typensicherheit (`tsc -b`) |
| **Vite** | **6.x** | Frontend Bundler |
| **Python** | **>=3.11** | Backend-Proxy (`scripts/cloud/vertex_proxy.py`) |

---

## 🔒 2. Update-Regeln & Dependency Policy

1. **Sicherheitsupdates (High/Critical CVEs)**:
   * Werden sofort nach Bekanntwerden eingespielt.
   * `npm audit fix` darf nur ohne Breaking Changes (`--force` verboten) ausgeführt werden.
2. **Patch- und Minor-Updates**:
   * Werden gesammelt wöchentlich geprüft.
   * Müssen zwingend die vollständige `./release-check.sh` Pipeline fehlerfrei durchlaufen.
3. **Major-Updates (z. B. React 19, AGP 9.0)**:
   * Keine automatischen Merges.
   * Werden als Version 1.1 Backlog-Task isoliert auf einem Entwicklungszweig getestet.
4. **Zero Untrusted CDN Scripts**:
   * Keine Skripte aus fremden CDNs in `index.html`. Sämtliche Abhängigkeiten werden lokal gebündelt.

---

## 🔄 3. Wiederherstellungsanleitung (Clean Environment Recovery)

Falls ein Build-Rechner neu aufgesetzt werden muss:

```bash
# 1. Systempakete installieren (Arch Linux Beispiel)
sudo pacman -S jdk21-openjdk android-tools nodejs npm git openssl

# 2. Android SDK Commandline-Tools installieren
sudo mkdir -p /opt/android-sdk/cmdline-tools
# Download Google Commandline Tools
cd /opt/android-sdk && curl -sSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o cmdline-tools.zip
unzip -q cmdline-tools.zip -d cmdline-tools-temp && mv cmdline-tools-temp/cmdline-tools cmdline-tools/latest && rm -rf cmdline-tools.zip cmdline-tools-temp
yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "platforms;android-35" "build-tools;36.0.0"

# 3. Repository klonen & Dependencies installieren
git clone <repo-url> "Der WEGWEISER" && cd "Der WEGWEISER"
npm ci

# 4. Release-Check ausführen
./release-check.sh
```
