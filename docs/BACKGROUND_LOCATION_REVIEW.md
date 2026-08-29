# GOOGLE PLAY DECLARATION & VIDEO-SKRIPT: BACKGROUND LOCATION

Dieses Dokument enthält die verbindliche Erklärung für das **Google Play Background Location Review (ACCESS_BACKGROUND_LOCATION)** sowie das exakte Skript zur Erstellung des erforderlichen **Demonstrationsvideos**.

---

## 🏛️ 1. Begründung der Kernfunktion (Core Purpose Justification)

### Frage in der Google Play Console:
> *„Warum benötigt Ihre App Zugriff auf den Standort im Hintergrund?“*

### Offizielle Antwort für die Console (Deutsch / Englisch):
```
Der Wegweiser ist eine spezialisierte E-Bike- und Fahrrad-Navigations-App. Der Zugriff auf den Standort im Hintergrund ist eine unverzichtbare Kernfunktion der App:

1. Kontinuierliche Turn-by-Turn Routenführung: Während der Fahrt haben Radfahrer das Smartphone häufig in der Tasche, in der Lenkertasche oder das Display ist zum Energiesparen gesperrt. Die App muss die GPS-Position auch bei gesperrtem Bildschirm im Hintergrund kontinuierlich erfassen, um rechtzeitige akustische Sprachansagen und Abbiegehinweise vor Kreuzungen auszugeben.
2. Dynamische Reichweiten- & Akkuüberwachung: Die App berechnet den verbleibenden Energieverbrauch des E-Bikes anhand von Echtzeit-Höhenmetern und gefahrener Distanz im Hintergrund weiter, um bei kritischem Akkustand rechtzeitig vor Erreichen von Steigungen zu warnen.
3. Automatisches Re-Routing: Verlässt der Radfahrer bei gesperrtem Display die geplante Route, berechnet der Hintergrund-Service sofort eine alternative Strecke und informiert den Nutzer per Audio.

Die Standorterfassung im Hintergrund wird ausschließlich während einer aktiv gestarteten Navigations-Session über einen sichtbaren Foreground-Service ausgeführt und stoppt sofort, sobald die Navigation beendet wird.
```

---

## 📱 2. Prominente In-App-Information (In-App Disclosure)

Vor dem Anfordern der Hintergrund-Standortberechtigung zeigt die App folgenden modalen Hinweis im Vollbild an:

```
[ Standort-Zugriff für Navigation im Hintergrund ]

Der Wegweiser erfasst deine Standortdaten während einer aktiven Navigation auch dann, wenn die App im Hintergrund läuft oder der Bildschirm ausgeschaltet ist.

Dies ermöglicht:
• Akustische Abbiegehinweise bei gesperrtem Display
• Proaktive Reichweiten- und Akkuwarnungen während der Fahrt
• Automatisches Re-Routing, wenn du von der Route abweichst

Deine Standortdaten werden nicht für Werbezwecke verwendet und nicht dauerhaft auf externen Servern gespeichert.

[ Verstanden & Erlauben ]    [ Nur bei geöffneter App ]
```

---

## 🎥 3. Video-Skript für das Google Play Review-Team

Google Play verlangt ein kurzes Demonstrationsvideo (YouTube Unlisted Link oder MP4-Upload, max. 30–60 Sekunden), das die In-App Disclosure und das Verhalten bei gesperrtem Display zeigt.

### Dreh-Ablauf (Schritt-für-Schritt):

| Zeitmarke | Gezeigte Aktion | Sichtbarer Bildschirminhalt / Audio |
| :--- | :--- | :--- |
| **0:00 – 0:08** | **App Start & Disclosure** | Nutzer öffnet *Der Wegweiser*. Der prominente In-App-Hinweis zu Hintergrund-Standort und Navigation bei gesperrtem Display wird eingeblendet. Nutzer tippt auf *„Verstanden & Erlauben“*. |
| **0:09 – 0:15** | **Android System-Dialog** | Der Android-Systemdialog erscheint: Nutzer wählt *„Immer zulassen“* (bzw. *„Allow all the time“*). |
| **0:16 – 0:25** | **Route starten** | Nutzer wählt eine E-Bike-Tour aus und tippt auf *„Navigation starten“*. Die Turn-by-Turn Karte und die Foreground-Service Notification in der Android-Statusleiste werden sichtbar (*„Navigation aktiv“*). |
| **0:26 – 0:38** | **Display sperren / Hintergrund** | Nutzer sperrt das Smartphone (Bildschirm wird schwarz) oder wechselt auf den Android-Homescreen. Die Navigation läuft hörbar/sichtbar weiter; das Gerät gibt eine Navigationsansage aus (*„In 50 Metern rechts abbiegen“*). |
| **0:39 – 0:48** | **Display entsperren & Stopp** | Nutzer entsperrt das Display. Die Route zeigt den aktualisierten Fortschritt. Nutzer tippt auf *„Navigation beenden“*. Die Foreground-Notification und der Hintergrund-Standortzugriff enden sofort. |

---

## 🔒 4. Compliance-Prüfung gegen Google Play Richtlinien
* [x] Die In-App Disclosure wird **vor** der Systemberechtigungsanfrage angezeigt.
* [x] Die Disclosure erklärt genau, welche Funktionen den Hintergrund-Standort benötigen.
* [x] Der Standortzugriff ist an einen aktiven Foreground-Service (`FOREGROUND_SERVICE_LOCATION`) gebunden.
* [x] Keine Standortweitergabe an Werbenetzwerke oder unbeteiligte Dritte.
