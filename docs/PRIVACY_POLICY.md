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

| Dienst / Anbieter | Zweck | Übermittelte Daten | Rechtsgrundlage & Garantien | Speicherfrist |
| :--- | :--- | :--- | :--- | :--- |
| **Google Firebase / GCP** | Datenbank (Firestore), Auth, App Hosting | Pseudonyme Segmente, Leads, Server-IP | Art. 6 Abs. 1 lit. b/f DSGVO; DPA Frankfurt (`europe-west3`); SCC | Betriebsnotwendig; Server-Access-Logs max. 30 Tage |
| **Google Gemini API** (`@google/generative-ai`) | KI-Antizipations-Storys | Routen-Start-/Endorte ohne User-ID | Art. 6 Abs. 1 lit. b DSGVO; Google API Terms (Kein Modelltraining) | Flüchtig während Inferenz |
| **CartoDB & OpenStreetMap** | Kartendarstellung & Basiskacheln | Kachel-Koordinaten, IP-Adresse | Art. 6 Abs. 1 lit. b DSGVO; ODbL Lizenz | CDN-Access-Logs 7–30 Tage |
| **Open-Meteo API** | Wind-, Wetter- & Höhenabfragen | Koordinaten, IP-Adresse | Art. 6 Abs. 1 lit. b DSGVO; EU-Server | Flüchtig im RAM; Server-Logs max. 14 Tage zur DDoS-Abwehr |
| **BitLabs / CPX Research** | Freiwillige bezahlte Marktforschung | Pseudonyme User-ID, Session-ID | Art. 6 Abs. 1 lit. a DSGVO; EU-US Data Privacy Framework / SCC | Gemäß Richtlinien des jeweiligen Umfrage-Partners |

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
2. **Nutzungsrechte & Weiterführung**: Übermittelte Korrekturen und Wegeattribute werden dem Diensteanbieter als einfaches, unentgeltliches Nutzungsrecht zur Pflege der Navigationskarte eingeräumt. Bei Fortführung des Betriebs unter einer eingetragenen Geschäftsbezeichnung oder als Einzelunternehmen bleibt die Rechtsinhaberschaft von Pascal Gregor unverändert bestehen. Eine spätere Übertragung auf eine eigenständige juristische Person (z. B. UG/GmbH) erfolgt unter Einhaltung eines gesonderten, transparenten Verantwortlichenwechsels gem. DSGVO.
3. **Absolutes Verkaufsverbot**: Ein Weiterverkauf von Nutzerdaten an Datenhändler (Data Brokers) oder fremde Werbekonzerne ist für alle Zeiten vertraglich und datenschutzrechtlich ausgeschlossen.


