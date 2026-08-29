# Datenschutzerklärung (Privacy Policy) — Der Wegweiser

**Stand: 29. August 2026**

Der Schutz Ihrer persönlichen Daten ist uns ein zentrales Anliegen. Die vorliegende Datenschutzerklärung informiert Sie transparent darüber, welche personenbezogenen Daten wir bei der Nutzung der App und Webanwendung **"Der Wegweiser"** (im Folgenden: *"App"*) verarbeiten und welche Rechte Ihnen nach der EU-Datenschutz-Grundverordnung (DSGVO), dem Bundesdatenschutzgesetz (BDSG) sowie dem Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG) zustehen.

---

## 1. Verantwortlicher für die Datenverarbeitung
**Pascal Gregor**  
Lindenstraße 8, 02979 Spreetal  
E-Mail: **wegweiser-app@proton.me**  
Server-Standort: Google Cloud Platform (Frankfurt am Main, Region `europe-west3`, Art. 28 DSGVO DPA).

*Hinweis zur Reichweite der Verarbeitungszwecke*: Die in dieser Erklärung genannten Zwecke und Rechtsgrundlagen beziehen sich auf den Betrieb, die Bereitstellung, Wartung und kontinuierliche Weiterentwicklung von "Der Wegweiser" einschließlich technisch oder organisatorisch nachfolgender Versionen desselben Dienstes durch den Verantwortlichen.

---

## 2. Prominente Information zur Hintergrund-Standortnutzung (Google Play Policy)

> 📍 **Hintergrund-Standorterfassung**:  
> Der Wegweiser erfasst und verarbeitet Standortdaten (GPS-Koordinaten, Geschwindigkeit, Höhe und Bewegungsrichtung) im Vordergrund und **im Hintergrund (auch wenn die App geschlossen ist oder das Smartphone-Display gesperrt ist)**.  
> **Zwecke**:
> 1. Kontinuierliche **Turn-by-Turn Sprachführung** über Kopfhörer oder Helmlautsprecher während der Fahrt.
> 2. **Automatische Routen-Neuberechnung** bei Abweichung vom Radweg.
> 3. **Notfall-Reichweiten-Warnungen** bei kritischem E-Bike-Akkustand (&le; 15 %).
> 4. Lückenlose **GPX-Tourenaufzeichnung** für die eigene Historie.

---

## 3. Erhobene Daten, Zwecke & Rechtsgrundlagen nach DSGVO

### a) Standort- & Navigationsdaten (Pseudonymisierte Daten)
* **Status**: GPS-Koordinatenketten und Tracks werden von uns als **pseudonymisierte personenbezogene Daten (Art. 4 Nr. 1 DSGVO)** behandelt, da durch wiederkehrende Start- und Zielpunkte (z. B. Wohnort) eine Reidentifizierbarkeit theoretisch möglich sein kann.
* **Zweck**: Live-Navigation, Turn-by-Turn Führung, Erstellung aggregierter Höhen- und Verbrauchsprofile. Zur Überprüfung der Datenfrische wird das Aufnahmedatum ohne Uhrzeit (`recordDate: "YYYY-MM-DD"`) gespeichert.
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung zur Navigation) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Verbesserung von Radwegenetzen).

### b) Bluetooth Low Energy (BLE) E-Bike Telemetriedaten
* **Zweck**: Abruf von Akkustand (SoC %), verbleibenden Wattstunden (Wh), Trittfrequenz und Motorleistung. Markenunabhängig für alle offenen BLE-Sensoren.
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. b DSGVO. Die Telemetrie verbleibt primär flüchtig im lokalen Speicher des Endgeräts.

### c) Ladeinfrastruktur & Community-Meldungen
* **Zweck**: Hinzufügen, Korrigieren und Verifizieren von E-Bike Ladesäulen, Schlauchautomaten und Wegequalitäten (Map-Quests).
* **Rechtsgrundlage**: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Netzwerkintegrität und Ladesicherheit).
* **Widerspruchsrecht (Art. 21 DSGVO)**: Nutzer können der Weiterverarbeitung gemeldeter Punkte jederzeit formlos per E-Mail an wegweiser-app@proton.me widersprechen.

### d) § 25 TDDDG (Zugriff auf Endgeräte-Speicher)
* **Technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG)**: Speicherung von aktiven Routensitzungen, essentiellen Offline-Kartenkacheln, Display-WakeLock-Zuständen und Einwilligungs-Status im lokalen Speicher (`localStorage` / `IndexedDB`).
* **Einwilligungspflichtig (§ 25 Abs. 1 TDDDG)**: Optionale Werbe- und Umfragemodule (z. B. Offerwalls).

---

## 4. Drittanbieter-Dienste & Reale Datenflüsse

| Dienst / Komponente | Zweck | Übermittelte Daten | Datenstandort / Rechtsgrundlage & Garantien | Speicherfrist |
| :--- | :--- | :--- | :--- | :--- |
| **Cloud Firestore (GCP)** | Persistente NoSQL-Datenbank | Pseudonyme Segmente, Leads, Token-Salden | **Frankfurt (`europe-west3`)**; Art. 6 Abs. 1 lit. b DSGVO; GCP DPA | Betriebsnotwendig bis Kontolöschung |
| **Firebase Authentication** | Nutzer-Authentifizierung & Token-Signierung | Pseudonyme Auth-Tokens, Login-Status | **USA (Google Global Auth Infrastructure)**; Art. 6 Abs. 1 lit. b DSGVO; EU-US DPF / SCC | Dauer der aktiven Sitzung / Registrierung |
| **Firebase App Hosting / CDN** | Bereitstellung der statischen Web-Assets | Server-Access-IP, User-Agent | **Global Edge Network**; Art. 6 Abs. 1 lit. f DSGVO | Rollierende Webserver-Access-Logs |
| **AI-Gateway (Backend-Proxy)** | KI-Antizipations-Storys & Sprachassistent | Start-/Zielorte & Parameter ohne Personen-ID | **Frankfurt (`europe-west3`)**; Art. 6 Abs. 1 lit. b DSGVO; Eigener Backend-Proxy | Flüchtig im RAM während Inferenz |
| **CartoDB & OpenStreetMap** | Kartendarstellung & Basiskacheln | Kachel-Koordinaten, IP-Adresse | **Global CDN / EU**; Art. 6 Abs. 1 lit. b DSGVO; ODbL Lizenz | Server-Access-Logs der CDN-Provider |
| **Open-Meteo API** | Wind-, Wetter- & Höhenabfragen | Geografische Koordinaten, IP-Adresse | **EU (Open-Meteo GmbH)**; Art. 6 Abs. 1 lit. b DSGVO; Open-Meteo Terms | Flüchtig zur Übertragung; Server-Logs werden nach max. 90 Tagen gelöscht |
| **BitLabs / CPX Research** | Freiwillige bezahlte Marktforschung | Pseudonyme User-ID, Session-ID | **USA / EU**; Art. 6 Abs. 1 lit. a DSGVO; EU-US Data Privacy Framework / SCC | Gemäß Richtlinien des jeweiligen Umfrage-Partners |

---

## 5. Vollständige Data-Deletion- & Export-Matrix

| Datenebene | Speicherort | Export (Art. 20 DSGVO) | Löschung (Art. 17 DSGVO) |
| :--- | :--- | :--- | :--- |
| **Lokale App-Daten** | `localStorage`, `IndexedDB` (Endgerät) | 1-Klick JSON-Download im In-App Cockpit | 1-Klick "Daten löschen" im In-App Cockpit (Sofortige Löschung) |
| **Cloud-Token-Konto** | Firestore `user_tokens` | E-Mail-Anfrage an Betreiber | Formlose E-Mail an Betreiber (Löschung binnen gesetzlicher Frist) |
| **B2B-Partner-Leads** | Firestore `partner_leads` | E-Mail-Anfrage an Betreiber | Formlose E-Mail an Betreiber (Löschung nach Wegfall des Geschäftszwecks) |
| **Third-Party Server Logs** | CDN / Cloud-Provider Logs | Bei den jeweiligen Anbietern | Automatische rollierende Löschung nach 14–30 Tagen |

---

## 6. Betroffenenrechte (Art. 15–22 DSGVO)
* **Auskunft & Berichtigung (Art. 15, 16 DSGVO)**: Formlos per E-Mail an **wegweiser-app@proton.me**.
* **Löschung & Datenübertragbarkeit (Art. 17, 20 DSGVO)**: Über das integrierte Daten-Cockpit im Menü `Recht -> Daten-Cockpit` oder per E-Mail.
* **Widerruf von Einwilligungen (Art. 7 Abs. 3 DSGVO)**: Jederzeit im Einstellungs-Menü der App änderbar.
* **Beschwerderecht (Art. 77 DSGVO)**: Recht auf Beschwerde bei der zuständigen Datenschutz-Aufsichtsbehörde (z. B. Landesbeauftragte für Datenschutz).

---

## 7. Datenbankherstellerrecht (§§ 87a ff. UrhG), Rechtsnachfolge & No-Sale Policy
1. **Investitionsschutz nach § 87a UrhG**: Die Gesamtheit der Navigationsdatenbank stellt eine geschützte Datenbank des Diensteanbieters (Pascal Gregor) dar.
2. **Nutzungsrechte & Weiterführung**: Übermittelte Korrekturen und Wegeattribute werden dem Diensteanbieter als einfaches, unentgeltliches Nutzungsrecht zur Pflege der Navigationskarte eingeräumt. Der Übergang in ein vom selben Inhaber betriebenes Einzelunternehmen führt grundsätzlich nicht zu einem Wechsel der natürlichen Person als Rechtsträger. Änderungen von Verarbeitungszwecken, Vertragsbedingungen oder Geschäftsmodell sind davon unabhängig gesondert zu prüfen. Eine spätere Übertragung auf eine eigenständige juristische Person (z. B. UG oder GmbH) erfolgt unter Einhaltung eines gesonderten, transparenten Verantwortlichenwechsels gem. DSGVO.
3. **Absolutes Verkaufsverbot**: Ein Weiterverkauf von Nutzerdaten an Datenhändler (Data Brokers) oder fremde Werbekonzerne ist für alle Zeiten vertraglich und datenschutzrechtlich ausgeschlossen.


