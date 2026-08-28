# Datenschutzerklärung (Privacy Policy) — Der Wegweiser

**Stand: 28. August 2026**

Der Schutz Ihrer persönlichen Daten ist uns ein zentrales Anliegen. Die vorliegende Datenschutzerklärung informiert Sie transparent darüber, welche personenbezogenen Daten wir bei der Nutzung der App und Webanwendung **"Der Wegweiser"** (im Folgenden: *"App"*) verarbeiten und welche Rechte Ihnen nach der EU-Datenschutz-Grundverordnung (DSGVO) sowie dem Bundesdatenschutzgesetz (BDSG) zustehen.

---

## 1. Verantwortlicher für die Datenverarbeitung
**Carlos & Team "Der Wegweiser"**  
E-Mail: carlos.condios96@gmail.com  
Website: https://der-wegweiser.web.app  
GCP-Projekt: `der-wegweiser` (europe-west3)

---

## 2. Erhobene Daten und Verarbeitungszwecke

### a) Standortdaten (GPS, Höhe, Bewegungsrichtung)
* **Zweck**: Berechnung von Echtzeit-Abbiegeanweisungen (Turn-by-Turn), Course-Up Kartenausrichtung, Höhenprofil-Anzeige, automatischer Routen-Neuberechnung bei Abweichung und Offline-Kachel-Prefetching.
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung zur Bereitstellung der Navigationsfunktion) sowie Art. 6 Abs. 1 lit. a DSGVO (ausdrückliche Einwilligung bei App-Start).
* **Vordergrund- und Hintergrundbetrieb**: Standortdaten werden während einer aktiven Navigation oder Tourenaufzeichnung auch bei gesperrtem Bildschirm im Hintergrund verarbeitet, um kontinuierliche Sprachführung und GPX-Aufzeichnung sicherzustellen.
* **Speicherung**: Standortdaten werden lokal auf Ihrem Endgerät verarbeitet. Es erfolgt kein dauerhaftes Bewegungsprofiling auf zentralen Servern ohne Ihre explizite Freigabe.

### b) Bluetooth- & E-Bike Telemetriedaten (BLE)
* **Zweck**: Anzeige von Akkustand (SoC %), verbleibenden Wattstunden (Wh), Trittfrequenz (RPM), Fahrer- und Motorleistung (Watt), Gangstufe und Motortemperatur.
* **Kompatible Systeme**: Bosch Smart System (BES3), Shimano STEPS, Mahle SmartBike, Specialized Turbo, Bafang CAN und Standard Bluetooth Cycling Sensoren.
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. b DSGVO. Alle Telemetriedaten verbleiben standardmäßig lokal auf Ihrem Smartphone.

### c) Touren- und GPX-Aufzeichnungen
* **Zweck**: Speicherung gefahrener Touren, Höhenmeter, Geschwindigkeiten und Export für Plattformen wie Strava, Komoot oder Garmin.
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. b DSGVO.

### d) Lade-Infrastruktur & Community-Beiträge
* **Zweck**: Beim Hinzufügen oder Bewerten von Ladestationen werden die Standortkoordinaten, Fotos, Steckertypen und Bewertungskommentare in unserer Google Cloud Firestore Datenbank gespeichert, um allen Nutzern zur Verfügung zu stehen.
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Pflege und Qualitätssicherung des Ladesäulen-Netzes).

### e) Marktforschungsumfragen & Werbedienste (Monetarisierung)
* **BitLabs / CPX Research Offerwall**: Bei freiwilliger Teilnahme an bezahlten Marktforschungsumfragen werden pseudonyme Benutzer-IDs (UID) zur Zuordnung der verdienten Tokens an den jeweiligen Umfrageanbieter übermittelt.
* **Google AdMob**: Bei Anzeige von Werbespots werden von Google standardmäßige Werbe-IDs (z. B. Google Advertising ID) unter Einhaltung der Google-Play-Datenschutzrichtlinien verarbeitet.
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).

---

## 3. Eingesetzte Dienstleister & Drittanbieter

| Dienstleister | Zweck | Sitz / Serverstandort |
|---|---|---|
| **Google Firebase / Google Cloud Platform** | Datenbank (Firestore), Authentifizierung, App Hosting | Frankfurt am Main, Deutschland (`europe-west3`) |
| **OpenStreetMap & CartoDB** | Kartenkacheln, POI-Daten und Routing | EU / USA (Standardvertragsklauseln) |
| **Open-Meteo API** | Wetter-, Wind- und SRTM-Höhenprofildaten | EU / Deutschland (anonymisiert) |
| **BitLabs Inc. / CPX Research** | Freiwillige bezahlte Umfragen in der Lade-Lounge | EU / USA |

---

## 4. Datensicherheit & Offline-Betrieb
Alle Verbindungen zwischen der App und den Servern sind mit **TLS 1.3 / HTTPS mit 256-Bit-Verschlüsselung** gesichert. Sämtliche Navigations- und Kartendaten werden zur Minimierung des Datenverbrauchs und zum Schutz bei Funklöchern lokal in `CacheStorage` und `IndexedDB` zwischengespeichert.

---

## 5. Ihre Rechte als betroffene Person (Art. 15–21 DSGVO)
Sie haben jederzeit das Recht auf:
* **Auskunft** über Ihre von uns verarbeiteten personenbezogenen Daten (Art. 15 DSGVO).
* **Berichtigung** unrichtiger oder Vervollständigung unvollständiger Daten (Art. 16 DSGVO).
* **Löschung** Ihrer bei uns gespeicherten Daten (Art. 17 DSGVO).
* **Einschränkung der Verarbeitung** (Art. 18 DSGVO).
* **Datenübertragbarkeit** (Art. 20 DSGVO) z. B. im GPX-Standardformat.
* **Widerruf erteilter Einwilligungen** mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).

Zur Ausübung Ihrer Rechte genügt eine formlose Mitteilung per E-Mail an: **carlos.condios96@gmail.com**.
