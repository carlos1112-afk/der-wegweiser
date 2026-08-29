# GOOGLE PLAY FOREGROUND SERVICE DEMOVIDEO — ABLAUFPLAN

Dieses Skript dient als verbindliche Anleitung für das 30-Sekunden-Nachweisvideo, das für den Google Play Console Review des **Location Foreground Service** hinterlegt wird.

---

## 🎬 1. Video-Parameter

* **Format**: MP4 (1080p, Hochformat / Portrait)
* **Dauer**: ca. 25–35 Sekunden
* **Status**: **MANUELL AUSSTEHEND** (Aufnahme auf realem Android-Testgerät durch Betreiber)
* **Kamera**: Bildschirmaufnahme (Screen Recording) mit aktiviertem System-Audio (für Sprachansagen)

---

## ⏱️ 2. Sekundengenauer Aufnahmeablauf

| Zeitstempel | Bildschirminhalt / Nutzeraktion | Zu demonstrierendes Verhalten |
| :--- | :--- | :--- |
| **00:00 – 00:05** | App *Der Wegweiser* öffnen | Hauptbildschirm mit Kartenansicht und Routenauswahl wird geladen. |
| **00:05 – 00:10** | Route antippen & Details einsehen | Start-/Ziel-Route auf der Karte wählen. |
| **00:10 – 00:15** | Button **„Navigation starten“** antippen | Turn-by-Turn HUD aktiviert sich; GPS-Tracking beginnt; Foreground Service Notification erscheint in der Statusleiste. |
| **00:15 – 00:20** | Benachrichtigungsleiste nach unten ziehen | Permanente Notification *„Der Wegweiser — Navigation aktiv“* mit Abbiegepfeil sichtbar zeigen. |
| **00:20 – 00:25** | Gerät sperren (Display aus) oder App minimieren | Display wird gesperrt. |
| **00:25 – 00:30** | Audio-/Sprachausgabe im Hintergrund | Akustischer Navigationshinweis (*„In 100 Metern rechts abbiegen auf den Radweg...“*) ertönt hörbar bei gesperrtem Display. |
| **00:30 – 00:35** | Gerät entsperren & **„Navigation beenden“** tippen | Fahrt wird beendet; Foreground Service und Notification verschwinden sofort. |

---

## 🎯 3. Wichtige Reviewer-Hinweise
* Das Video muss die **tatsächliche App-Funktion auf einem echten Android-Gerät** zeigen.
* Keine simulierten Bildschirmrahmen oder nachträglich hineinkopierte Overlays.
