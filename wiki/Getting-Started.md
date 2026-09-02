# 🚀 Erste Schritte (Getting Started)

Hier erfährst du, wie du **Der Wegweiser** sofort nutzen, auf deinem Smartphone installieren oder lokal für die Weiterentwicklung starten kannst.

---

## 🌐 1. Sofortige Nutzung im Web (Empfohlen)

Die Web-Version von **Der Wegweiser** ist vollständig als Progressive Web App (PWA) realisiert und kann auf jedem modernen Smartphone (Android / iOS) oder Desktop-Computer direkt im Browser genutzt werden:

👉 **[https://der-wegweiser.web.app](https://der-wegweiser.web.app)**

### Als App auf dem Homescreen installieren:
* **Android (Chrome / Edge / Firefox):**
  1. Öffne [https://der-wegweiser.web.app](https://der-wegweiser.web.app).
  2. Tippe im Browsermenü (drei Punkte oben rechts) auf **„App installieren“** oder **„Zum Startbildschirm hinzufügen“**.
  3. Die App verhält sich wie eine native App (ohne Browserleiste, Vollbild, schnelles Laden).
* **iOS (Safari):**
  1. Öffne [https://der-wegweiser.web.app](https://der-wegweiser.web.app) in Safari.
  2. Tippe auf das **Teilen-Symbol** (Viereck mit Pfeil nach oben).
  3. Wähle **„Zum Home-Bildschirm“**.

---

## 🤖 2. Android Version (Google Play)

* **Package / Application ID:** `app.derwegweiser.navi`
* **Status:** Closed Testing (Geschlossener Test) aktiv.
* **Beitritt für registrierte Tester:**
  1. Öffne mit deinem freigeschalteten Google-Konto:
     [https://play.google.com/apps/testing/app.derwegweiser.navi](https://play.google.com/apps/testing/app.derwegweiser.navi)
  2. Bestätige mit **„Tester werden“** (*Become a tester*).
  3. Klicke auf den Play Store Download-Link und installiere die App.
* **Vorteile der nativen Android-App:**
  * Kontinuierliche Navigation im Hintergrund via Foreground Service (`location`).
  * Sprachansagen über Bluetooth-Kopfhörer oder Fahrrad-Lautsprecher bei gesperrtem Display.
  * Automatische Bluetooth-Wiederverbindung zu E-Bike-Sensoren.

---

## 🍏 3. iOS Version (Apple TestFlight)

* **Bundle Identifier:** `app.derwegweiser.navi`
* **Voraussetzung:** iOS 15.0 oder neuer auf iPhone.
* **Build-Anleitung für Entwickler/Betreiber:**
  * Siehe das verbindliche Handoff-Dokument:
    [`release/app-store/1.0.0-rc2/MAC_HANDOFF.md`](../release/app-store/1.0.0-rc2/MAC_HANDOFF.md)

---

## 💻 4. Lokale Entwickler-Installation

Möchtest du am Code mitwirken oder eigene Funktionen testen?

```bash
# 1. Repository klonen
git clone https://github.com/carlos1112-afk/der-wegweiser.git
cd der-wegweiser

# 2. Abhängigkeiten installieren
npm ci

# 3. Lokale Umgebungskonfiguration anlegen
cp .env.example .env.local

# 4. Entwicklungsserver starten
npm run dev
```

* Die App startet standardmäßig unter `http://localhost:5173`.
* Für Bluetooth-Tests wird ein Web-Bluetooth-fähiger Browser (z. B. Google Chrome) benötigt.
