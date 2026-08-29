# USER-GENERATED CONTENT (UGC) & APPLE GUIDELINE 1.2 COMPLIANCE

Dieses Dokument beschreibt die konkrete Implementierung der **Apple App Store Review Guideline 1.2 (User-Generated Content)** in **Der Wegweiser 1.0**.

---

## 🔍 1. Inventarisierung aller Community-Inhalte

| Funktion / Datenart | Öffentlich sichtbar? | Freitext? | Ersteller-ID | Melde- & Moderationspfad |
| :--- | :--- | :--- | :--- | :--- |
| **Community-Ladesäulen** (`charging_stations`) | **JA** | Eingeschränkt (Name, Adresse, Stecker) | Pseudonyme UID | In-App „Eintrag melden“ &rarr; `content_reports` |
| **Station-Reviews & Tags** (`station_reviews`) | **JA** | Kurzer Sachkommentar & feste Tags | Pseudonyme UID | In-App „Eintrag melden“ &rarr; `content_reports` |
| **Scout-Meldungen** (`scout_reports`) | **JA** (Status) | Strukturierte Statuswahl (Aktiv/Defekt) | Pseudonyme UID | Plausibilitätsabgleich im Backend |
| **Eigene Routen** (`routes`) | **NEIN** (Privat) | Routentitel | Nur Ersteller | Privat im eigenen Profil |

---

## 🛡️ 2. Konkrete Schutz- & Moderationsmechanismen nach Guideline 1.2

1. **In-App Meldefunktion (Report Mechanism)**:
   * Nutzer können jeden Stationseintrag und jedes Review direkt im modalen Dialog über den Button **„Eintrag melden“** beanstanden.
   * Der Report wird mit `contentType`, `contentId`, `reason` und `createdAt` in der geschützten Firestore-Collection `content_reports` abgelegt.
2. **Serverseitige Nutzersperrung (Abuse Blocking)**:
   * In [`firestore.rules`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/firestore.rules) erzwingt die Hilfsfunktion `isNotSuspended()`, dass gesperrte Nutzer (`suspended_users`) keine neuen Ladesäulen, Bewertungen oder Scout-Meldungen in die Datenbank schreiben können.
3. **Zeitnahe Moderation**:
   * Der Betreiber überprüft eingehende Reports in `content_reports` und bereinigt beanstandete Einträge binnen 24–48 Stunden.
4. **Veröffentlichte Kontaktmöglichkeit**:
   * Direkter Betreiberkontakt für Beschwerden: `wegweiser-app@proton.me` (im Impressum und in der Datenschutzerklärung hinterlegt).

---

## 🎯 Ergebnis:
* **Status**: **VOLLSTÄNDIG KONFORM MIT APPLE GUIDELINE 1.2**.
* **Kein Social-Networking-Overhead**: Schlanke, wartungsarme Melde- und Sperrarchitektur ohne externe Drittanbieter-SaaS.
