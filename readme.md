# 🚲 DER WEGWEISER — Next-Gen AI E-Bike Navigation & Community Charging

[![Vite](https://img.shields.io/badge/Vite-8.2.0-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Hosting-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Der Wegweiser** ist eine intelligente, zukunftsweisende E-Bike-Navigations- und Telemetrieplattform. Sie kombiniert vorausschauende KI-Routenplanung (Zero-Click „Heute-Tour“), Bluetooth-Low-Energy (BLE) Live-Fahrradtelemetrie, intelligente Ladeinfrastruktur-Scans und Community-Gamification in einer intuitiven Cyberpunk-Glasmorphism-Oberfläche.

---

## ✨ Hauptfunktionen

- ⚡ **Vorausschauende KI-Routenplanung („Heute-Tour“):**
  - Automatische Tourenberechnung basierend auf Nutzerpräferenzen, Fahrhistorie, Wetter- und Winddaten.
  - Multi-LLM Support: Nahtlose Anbindung an Google Gemini, Vertex AI und lokale Fallbacks.
- 📡 **Live BLE-Fahrradtelemetrie & Battery HUD:**
  - Echtzeit-Anzeige von Akkukapazität (Wh & %), Restreichweite, Geschwindigkeit, Trittfrequenz (RPM) und Fahrerleistung (Watt).
  - Intelligente Reichweitenwarnung und automatisches Ansteuern passender Ladesäulen.
- 🔌 **Crowdsourced Ladesäulen-Scanner & Map:**
  - Interaktive Leaflet-Karte mit E-Bike-Ladesäulen (Bosch, Shimano, Bike-Energy, 230V Schuko).
  - KI-gestützter Foto-Scanner zum Erfassen und Verifizieren neuer Ladestationen.
- 🎮 **Lade-Lounge & Token-Belohnungssystem:**
  - Gamification während des Ladevorgangs.
  - Token-Ökosystem zur Belohnung von verifizierten Community-Ladestationen.
- 📊 **GPX-Export & Tour-Analytics:**
  - Export von Strecken im standardisierten GPX-Format für Garmin, Wahoo, Komoot und Bosch Nyon.
  - Höhenprofil- und Steigungsanalysen.
- ☁️ **Cloud & Offline-First Architektur:**
  - Synchronisation über Google Cloud Firestore mit automatischer Offline-Pufferung im LocalStorage.

---

## 🛠️ Technologie-Stack

| Bereich | Technologien |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS Glasmorphism |
| **Karten & Geo** | Leaflet, React-Leaflet, OpenStreetMap Tile Engine |
| **KI / GenAI** | Google Gemini API (`@google/generative-ai`), Vertex AI Proxy |
| **Cloud & Backend** | Google Cloud Platform, Firebase Firestore, Firebase Hosting |
| **IoT & Telemetrie** | Web Bluetooth API (BLE GATT Cycling Power / Speed / Cadence / Battery Services) |
| **CI / CD** | GitHub Actions, Oxlint, TypeScript Compiler |

---

## 🚀 Schnellstart

### 1. Repository klonen & Abhängigkeiten installieren
```bash
git clone https://github.com/your-org/der-wegweiser.git
cd der-wegweiser
npm install
```

### 2. Umgebungsvariablen konfigurieren
Erstelle eine `.env.local` Datei basierend auf `.env.example`:
```bash
cp .env.example .env.local
```

Füge deine API-Schlüssel ein:
```env
VITE_GEMINI_API_KEY="your-gemini-api-key"
VITE_GCP_PROJECT_ID="der-wegweiser"
VITE_GCP_LOCATION="europe-west3"
```

### 3. Entwicklungsserver starten
```bash
npm run dev
```

### 4. Produktions-Build erstellen
```bash
npm run build
```

---

## 📁 Projektstruktur

```
├── .github/                 # GitHub Actions CI/CD Workflows
├── docs/                    # Projektdokumentation & Entwicklungsberichte
├── firebase_data/           # Lokale Firebase Firestore Backups & Snapshots
├── public/                  # Statische Assets, PWA Manifest & Service Worker
├── scripts/                 # Wartungsskripte, Cloud Proxies & Export-Tools
│   └── cloud/               # Vertex AI & GCP Proxies
├── src/
│   ├── assets/              # Icons & Grafiken
│   ├── components/          # Modulare UI-Komponenten (Map, HUDs, Modals)
│   │   ├── AiAssistant/     # KI-Tourenvorschläge & Prompting
│   │   ├── Analytics/       # Tour-Auswertungen & GPX Download
│   │   ├── BatteryHUD/      # E-Bike Telemetrie & BLE-Status
│   │   ├── ChargeAndEarn/   # Lade-Lounge & Token-System
│   │   ├── ChargingScanner/ # Foto-Scanner für neue Ladesäulen
│   │   ├── Map/             # Interaktive Leaflet-Karte
│   │   └── WeatherHUD/      # Wetter- & Windanzeige
│   ├── services/            # Business-Logik (BLE, KI, Firestore, GPX, Audio)
│   ├── types/               # TypeScript Typdefinitionen
│   ├── firebase.ts          # Firebase SDK Initialisierung
│   └── App.tsx              # Hauptanwendung & Dashboard
├── firebase.json            # Firebase Hosting & Firestore Konfiguration
├── firestore.rules          # Firestore Sicherheitsregeln
└── package.json             # Projektdefinition & Abhängigkeiten
```

---

## 📄 Lizenz

Dieses Projekt ist unter der [MIT Lizenz](LICENSE) lizenziert.
