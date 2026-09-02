# 🚲 Der Wegweiser — Open-Source E-Bike Navigation (Android & iOS)

<div align="center">

[![Android APK Build](https://img.shields.io/badge/Android-Target%20SDK%2036-34A853?style=for-the-badge&logo=android&logoColor=white)](android/)
[![iOS Build](https://img.shields.io/badge/iOS-15.0%2B-007AFF?style=for-the-badge&logo=apple&logoColor=white)](ios/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.0-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**Der Wegweiser** ist eine intelligente, herstellerunabhängige E-Bike-Navigations-App für **Android** und **iOS**. Sie kombiniert Bluetooth-Low-Energy (BLE) Live-Fahrradtelemetrie, vorausschauende Reichweiten-Antizipation („No Coast Heuristik“), Höhenprofilanalysen und eine interaktive E-Bike-Ladesäulenkarte.

Dieses Repository enthält **ausschließlich den reinen Quellcode der mobilen Endbenutzer-App**, mit dem sich jeder Entwickler oder Nutzer direkt eine funktionsfähige APK für Android bzw. das Xcode-Projekt für iOS bauen kann.

</div>

---

## ⚡ Schnellstart: APK in 3 Befehlen selbst bauen

### Voraussetzungen
* **Node.js**: Version 20+
* **Java JDK**: Version 21 (z. B. OpenJDK 21)
* **Android SDK**: Installiert (Command Line Tools / Android Studio)

### 1. Repository klonen & Abhängigkeiten installieren
```bash
git clone https://github.com/carlos1112-afk/der-wegweiser.git
cd der-wegweiser
npm ci
```

### 2. Android APK kompilieren
```bash
npm run build:apk
```

### 3. Fertige APK installieren
Nach erfolgreichem Build liegt die installierbare Android-APK unter:
```text
📁 android/app/build/outputs/apk/debug/app-debug.apk
```
Kopiere diese Datei einfach auf dein Smartphone oder installiere sie direkt via ADB:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🍏 iOS App bauen (Mac & Xcode)

```bash
# 1. Web-Assets bauen & nativen iOS-Workspace synchronisieren
npm ci
npm run build:ios

# 2. Xcode öffnen
open ios/App/App.xcworkspace
# In Xcode: Zielgerät wählen -> Product -> Run (oder Archive)
```

---

## ✨ Hauptfunktionen der Endbenutzer-App

* 📡 **Live BLE-Fahrradtelemetrie:**
  * Direkte Bluetooth-GATT-Kopplung an E-Bikes und Sensoren:
    * **Cycling Power Service (`0x1818`)**: Fahrer-Tretleistung in Watt.
    * **Speed & Cadence (`0x1816`)**: Geschwindigkeit und Trittfrequenz (RPM).
    * **Battery Service (`0x180F`)**: Exakter Akkuladestand in Prozent und Wh.
* 🧠 **Vorausschauende Reichweiten-Antizipation („No Coast Heuristik“):**
  * Berechnet die reale Restreichweite vorab unter Einbeziehung von Steigungsprofil (SRTM-Höhendaten), Windverhältnissen, Fahrergewicht und Motoreffizienz.
* 🔌 **E-Bike Ladeinfrastruktur-Karte:**
  * Verifizierte Ladepunkte (Bosch PowerPack/PowerTube, Shimano STEPS, 230V Schuko).
  * Filter nach Steckertyp, Ladegebühr und Wetterschutz.
* 🔊 **Turn-by-Turn Sprachführung im Hintergrund:**
  * Sprachansagen über Kopfhörer auch bei gesperrtem Bildschirm über einen transparenten Android Foreground Service (`location`).
* 🔒 **100% Datenschutz & Privatsphäre:**
  * **0 Tracking, 0 Werbe-SDKs, kein Verkauf von Telemetriedaten**.
  * Standorterfassung erfolgt nur flüchtig während aktiver Navigation.
  * Vollständige Kontolöschung nach Art. 17 DSGVO jederzeit per Knopfdruck.

---

## 📂 Quellcode-Struktur

```
├── android/                   # Vollständiges natives Android Gradle Projekt (Target SDK 36)
│   ├── app/src/main/          # AndroidManifest.xml, Foreground Service, App Icons
│   └── build.gradle           # Gradle 8.14 Build-Konfiguration
├── ios/                       # Vollständiges natives iOS Xcode Projekt (Capacitor)
│   └── App/App/               # Info.plist, PrivacyInfo.xcprivacy, Assets
├── public/                    # App-Icons, Splashscreens und PWA-Assets
├── src/                       # App Quellcode (React 19 + TypeScript)
│   ├── components/            # Glasmorphism UI (Map, Telemetry HUD, Route Selector)
│   ├── services/              # BLE-Treiber, Topographie-Rechner, No-Coast Heuristik
│   └── firebase.ts            # Client-Anbindung an öffentliche Ladesäulendaten
├── capacitor.config.ts        # Mobile App Plattformkonfiguration
├── package.json               # Abhängigkeiten & 1-Klick Build-Skripte
└── vite.config.ts             # Schneller Frontend Bundler
```

---

## 🛠️ Nützliche Befehle

| Befehl | Beschreibung |
| :--- | :--- |
| `npm run dev` | Startet den schnellen lokalen Entwicklungsserver im Browser |
| `npm run build` | Kompiliert die TypeScript- und React-Web-Assets nach `dist/` |
| `npm run build:apk` | Baut Web-Assets, synchronisiert Capacitor und kompiliert die native Debug-APK |
| `npm run build:android` | Baut Web-Assets und synchronisiert sie in das `android/`-Verzeichnis |
| `npm run build:ios` | Baut Web-Assets und synchronisiert sie in das `ios/`-Verzeichnis |
| `npm run lint` | Schnelle Code-Qualitätsprüfung mit Oxlint |

---

## ⚖️ Lizenz & Impressum

* **Lizenz:** Veröffentlicht unter der [MIT-Lizenz](LICENSE).
* **Betreiber & Entwickler:** Pascal Gregor · Spreetal · Kontakt: `wegweiser-app@proton.me`
