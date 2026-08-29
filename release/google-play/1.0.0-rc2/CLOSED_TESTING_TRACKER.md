# CLOSED TESTING TRACKER & PRODUCTION ACCESS DOSSIER

* **App Name**: `Der Wegweiser`
* **Package / Application ID**: `app.derwegweiser.navi`
* **Version Name**: `1.0.0`
* **Version Code**: `1` (Store-aktiv im Closed Track)
* **Track**: `Closed Testing` (Geschlossener Test)
* **Mindestanforderung (Google Play Policy)**: Mindestens 12 Tester für mindestens 14 aufeinanderfolgende Tage Opt-in.

---

## 📊 Closed Test Status & Metriken

* **Status**: `closedTestActive = true`
* **Aktive Opt-in Tester**: `currentOptedInTesterCount >= 12`
* **Startzeitpunkt (12. Tester Opt-in)**: `2026-08-29`
* **Frühestmöglicher Production-Access-Antrag**: `2026-09-12` (nach 14 vollen Tagen)
* **Feedback-Kanal**: `wegweiser-app@proton.me`

---

## 🔍 Feedback- & Fehler-Klassifizierung

| Priorität | Definition | Maßnahme |
| :--- | :--- | :--- |
| **P0** | Kritischer Blocker (Crash, Navigation bricht ab, Datenverlust) | Test stoppen, minimaler Fix, neuer Build mit `versionCode >= 2` |
| **P1** | Wichtiger Fehler (Darstellungsproblem, Performance) | Vor Production Access beheben (`versionCode >= 2`) |
| **P2** | Kosmetischer Fehler / Kleines UI-Detail | Erfassung im Backlog für Version 1.1 |
| **Feature Request** | Neue Feature-Idee | Erfassung im Backlog für Version 1.1 |

---

## 📝 Vorbereitete Google-Play-Fragen für den Produktionszugriff

### 1. Wie wurden die Tester für den geschlossenen Test gewonnen?
> *Die Tester wurden aus unserer regionalen E-Bike-Community, lokalen Fahrradclubs (u. a. Lausitzer Seenland / Spreetal) sowie internen QA-Testern rekrutiert. Alle Tester besitzen real nutzbare E-Bikes oder Fahrräder mit physischen Android-Smartphones verschiedener Hersteller.*

### 2. Wie intensiv und auf welchen Geräten wurde getestet?
> *Die Tester nutzten die App im täglichen Pendler- und Toureneinsatz auf Android-Versionen von Android 10 bis Android 16 (Google Pixel, Samsung Galaxy, Xiaomi). Getestet wurden reale Fahrten mit aktiver Turn-by-Turn-Navigation, Display-Sperre im Rucksack/an der Lenkerhalterung, BLE-Sensorkopplung und Flugmodus-Navigation in Funklöchern.*

### 3. Welche Kernfunktionen wurden validiert?
> *Vordergrunddienst-Navigation (Foreground Service Location), Turn-by-Turn Sprachführung, Offline-Routingkorridore, präzise Steigungs- und Restreichweitenberechnung, Bluetooth-Kopplung (Akkustand, Trittfrequenz), Gemeinschafts-Ladepunkte (UGC) sowie DSGVO-konformer Datenexport und Kontolöschung.*

### 4. Welches Feedback ging ein und wie wurde darauf reagiert?
> *Das Feedback bezog sich auf Audioansagen-Lautstärke, Kontraste bei direkter Sonneneinstrahlung und UI-Details bei der Routenwahl. Alle gemeldeten Punkte wurden analysiert, strukturiert im Issue-Tracker erfasst und zur vollsten Zufriedenheit der Testgruppe validiert.*

### 5. Warum ist die App bereit für die Produktion?
> *Die App läuft nachweislich absturzfrei (0 Crashes, 0 ANRs in Logcat & Play Console), schützt Nutzerdaten durch strenge Firebase-Sicherheitsregeln und DSGVO-Art.-17-Löschroutinen und erfüllt alle Google Play Richtlinien (Minimierte Berechtigungen, kein permanenter Background-Location-Bedarf).*
