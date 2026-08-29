# GOOGLE PLAY INTERNAL TESTING & REAL DEVICE ONBOARDING GUIDE

Dieser Leitfaden führt Schritt für Schritt durch das Anlegen der App in der **Google Play Console**, das Einrichten des **Internal Testing Tracks**, das Auslesen der **Play App Signing Fingerprints** und die Verifikation auf einem **physischen Android-Gerät**.

---

## 📋 1. Google Play Console: Basis-Konfiguration

Melde dich unter [play.google.com/console](https://play.google.com/console) an und wähle **App erstellen**:

| Feld | Wert | Notiz |
| :--- | :--- | :--- |
| **App-Name** | `Der Wegweiser — E-Bike Navi` | Max. 30 Zeichen |
| **Standardsprache** | `Deutsch – de-DE` | Standard |
| **App oder Spiel** | `App` | Keine Spiele-Kategorie |
| **Kostenlos oder kostenpflichtig** | `Kostenlos` | Free with In-App Features |
| **Erklärungen** | Alle Bestätigungen anhaken | Entwicklerrichtlinien & US-Exportgesetze |

---

## 🚀 2. Schritt-für-Schritt: Internal Testing Release anlegen

1. Navigiere in der Play Console zu:
   **Testen &rarr; Interner Test (Internal Testing)**
2. Klicke oben rechts auf **Neuen Release erstellen**.
3. **App-Integrität & Play App Signing**:
   * Google Play fragt nach dem Signaturschlüssel: Wähle **Google Play App Signing verwenden** (Standard).
4. **App-Bundle hochladen**:
   * Lade die signierte Datei hoch:
     `android/app/build/outputs/bundle/release/app-release.aab`
5. **Release-Details eintragen**:
   * **Release-Name**: `1.0.0 (1) - RC1`
   * **Versionshinweise (Release Notes de-DE)**:
     ```
     Initialer Release Candidate 1.0.0 für Internal Testing.
     • E-Bike Navigation & dynamische Reichweitenanalyse
     • Resiliente Offline-Routenführung & BRouter-Integration
     • KI-gestützter Touren-CoPilot
     • Zero-Client-Secret Sicherheit & DSGVO-Datenkontrolle
     ```
6. Klicke auf **Speichern** &rarr; **Release überprüfen** &rarr; **Für internen Test freigeben**.

---

## 👥 3. Tester einladen

1. Wähle im Reiter **Tester** eine E-Mail-Liste aus (z. B. erstelle eine Liste `Wegweiser Kern-Tester`).
2. Füge deine Google-Play-Tester-E-Mail-Adressen hinzu.
3. Kopiere den **Einladungs-Link für Tester** (z. B. `https://play.google.com/apps/internaltest/...`).
4. Öffne den Link auf deinem Android-Testgerät und akzeptiere die Test-Einladung.

---

## 🔑 4. Play App Signing SHA-Fingerprints erfassen & in Firebase eintragen

> [!IMPORTANT]
> **Dieser Schritt ist zwingend für funktionierendes Google Sign-In auf echten Store-Geräten!**

1. Gehe in der Play Console zu:
   **Release &rarr; Einrichtung &rarr; App-Integrität &rarr; Tab "App-Signatur"**.
2. Kopiere dort die beiden Werte unter **App-Signaturschlüssel-Zertifikat**:
   * `SHA-1-Zertifikatsfingerabdruck`
   * `SHA-256-Zertifikatsfingerabdruck`
3. Öffne die [Firebase Console](https://console.firebase.google.com/project/der-wegweiser/settings/general):
   * Wähle **Projekteinstellungen &rarr; Allgemein &rarr; Deine Apps &rarr; Android-App (`app.derwegweiser.navi`)**.
   * Klicke auf **Fingerabdruck hinzufügen** und trage sowohl den **SHA-1** als auch den **SHA-256** Fingerabdruck von Google Play ein.
   * Lade die aktualisierte `google-services.json` herunter (falls neue OAuth-Clients generiert wurden).

---

## 📱 5. Prüfmatrix für das reale Android-16-Testgerät

Nach Installation der App über den Google Play Internal Testing Link auf einem physischen Smartphone sind folgende Testschritte durchzuführen:

```
[ ] 1. INSTALLATION & ERSTER START
    - Download & Installation über Google Play Store (Internal Track).
    - Startet die App ohne Whitescreen oder Crash?
    - Erscheint die In-App Disclosure für Hintergrund-Standort?

[ ] 2. BERECHTIGUNGEN (ANDROID 16 / API 36)
    - Standortberechtigung gewähren ("Immer zulassen").
    - Benachrichtigungsberechtigung (POST_NOTIFICATIONS) gewähren.
    - Bluetooth-Berechtigung für BLE-Sensoren gewähren.

[ ] 3. E-BIKE NAVIGATION & TURN-BY-TURN
    - Startort & Zielort wählen & Route generieren.
    - "Navigation starten" drücken: Erscheint die permanente Benachrichtigung in der Statusleiste?
    - Display ausschalten / Smartphone sperren: Werden Abbiegehinweise und Audiosignale weiterhin ausgegeben?
    - Geplante Route verlassen: Erfolgt ein automatisches Re-Routing?

[ ] 4. OFFLINE-VERHALTEN
    - Flugmodus am Smartphone aktivieren.
    - Lässt sich eine vorberechnete/gespeicherte Tour weiterhin navigieren?
    - Wird der unbestätigte Korridor bei fehlendem BRouter-Netzwerk ehrlich als unbestätigt angezeigt?

[ ] 5. BLUETOOTH LOW ENERGY (BLE)
    - Scan nach E-Bike oder Pulsgurt starten.
    - Verbindungsaufbau, Telemetriedaten-Empfang, Disconnect und Reconnect testen.

[ ] 6. ACCOUNT & DATENKONTROLLE
    - Registrierung / Login testen.
    - Daten-Export herunterladen (JSON/GPX).
    - Kontolöschung über Profil auslösen: Wird der Nutzer ausgeloggt und werden Firestore/Auth bereinigt?
```
