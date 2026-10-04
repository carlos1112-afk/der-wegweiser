# 📚 Umfassende Bafang BLE & eBike Daten-Dokumentation
## Für Navigations-App Entwickler (Stand: Oktober 2026)

---

## 🎯 Executive Summary

Diese Dokumentation fasst **alle verfügbaren technischen Daten** zu Bafang BLE-Schnittstellen, CAN-Bus Protokollen, Motor-Modellen und der Bafang Go/Go+ App-Ökosystem zusammen. Basierend auf intensiver Recherche aktueller Quellen (2024-2026) dient sie als technische Referenz für die Entwicklung von Drittanbieter-Navigations- und Telemetrie-Apps.

**Wichtigste Erkenntnis:** Bafang bietet **kein öffentliches SDK** für Endentwickler an. Die Integration erfolgt entweder über:
1. Das **Bafang IoT-Modul** (OEM-Partnerschaft erforderlich)
2. **Reverse-Engineering** der CAN-Bus/UART-Protokolle
3. Kompatible **Third-Party-Displays** mit BLE-Brücke [1][3][4]

---

## 📱 1. Bafang Go & Go+ App Ökosystem

### 1.1 Funktionsumfang der Bafang Go App

| Funktion | Beschreibung | Verfügbarkeit |
|----------|-------------|---------------|
| **Echtzeit-Status** | Geschwindigkeit, Akkuladestand, Unterstützungslevel, Fahrzeit | ✅ Alle Modelle mit BLE-Display |
| **Navigations-System** | Integrierte Routenplanung mit Stau- und Steigungsvermeidung | ✅ Go+ App (2026) |
| **Fahrdaten-Analyse** | Übersicht, statische Parameter, Visualisierungs-Charts | ✅ Go+ App |
| **Strava-Integration** | Ein-Klick-Synchronisation für Trainingsanalyse | ✅ Go+ App (2025+) |
| **Parameter-Anpassung** | Benutzerdefinierte Leistungsparameter pro Unterstützungslevel | ✅ Go+ App |
| **Beleuchtungssteuerung** | Licht Ein/Aus über App | ✅ Modelle mit BLE |
| **Diebstahlschutz** | Fernentsperrung, Warnmeldungen bei Manipulation | ✅ IoT-Modul erforderlich |
| **GPS-Tracking** | Echtzeit-Positionsbestimmung | ✅ IoT-Modul (4G+GPS) |
| **OTA-Updates** | Firmware-Updates über Bluetooth | ✅ Go+ App |
| **Social Features** | Routen teilen, Treffpunkte, Fotos ("Cycle Clubbing") | ✅ Go+ App |

**Quellen:** [1][2][3][4][5]

### 1.2 Technische Architektur des IoT-Systems

```
┌─────────────────────────────────────────────────────────────┐
│                    Bafang IoT-Ökosystem                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      BLE       ┌──────────────┐           │
│  │  Smartphone  │◄──────────────►│  IoT-Modul   │           │
│  │  (Bafang Go) │                │  (im Rahmen) │           │
│  └──────────────┘                └──────┬───────┘           │
│                                        │ CAN-Bus            │
│                                        ▼                    │
│  ┌──────────────┐      CAN-Bus   ┌──────────────┐           │
│  │   Display    │◄──────────────►│    Motor     │           │
│  │  (mit BLE)   │                │  (M-Serie)   │           │
│  └──────────────┘                └──────────────┘           │
│                                        │                    │
│                                        ▼                    │
│                                ┌──────────────┐             │
│                                │   Batterie   │             │
│                                │   (BMS)      │             │
│                                └──────────────┘             │
│                                                              │
│  ┌──────────────┐      4G/Cloud  ┌──────────────┐           │
│  │  Bafang      │◄──────────────►│  IoT-Modul   │           │
│  │  Cloud       │                │  (Nano-SIM)  │           │
│  └──────────────┘                └──────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

**IoT-Modul Spezifikationen:**
- **Kommunikation:** BLE 5.0+ (zum Smartphone), 4G/LTE (zur Cloud), CAN-Bus (zum Motor)
- **GPS:** Integriertes GPS-Modul für Positionsbestimmung
- **SIM-Karte:** Nano-SIM (4G, abwärtskompatibel zu 2G/3G)
- **Stromversorgung:** 36V-52V DC (vom E-Bike-System)
- **Abmessungen:** Flexibel, anpassbar an Rahmen-Spezifikationen
- **Schutzart:** IP67 (wasserdicht, staubgeschützt)

**Verfügbare Datenpunkte über IoT-Modul:**
- Aktivitätsaufzeichnungen (Fahrtenhistorie)
- Fahrdaten (Geschwindigkeit, Distanz, Zeit)
- Motor-Status (Temperatur, Fehlercodes, Leistung)
- Display-Informationen
- Batterie-Status (SoC, Spannung, Strom, Temperatur)
- GPS-Position (Echtzeit)
- Diebstahlwarnungen
- Fehlermeldungen (Failure Notices)
- Wartungshinweise

**Quellen:** [3][4][5]

---

## 🔌 2. Kommunikationsprotokolle

### 2.1 CAN-Bus vs. UART – Der entscheidende Unterschied

Bafang verwendet zwei primäre Kommunikationsprotokolle. Die Unterscheidung ist **kritisch** für die App-Entwicklung:

| Merkmal | **CAN-Bus** | **UART** |
|---------|-------------|----------|
| **Verwendung** | Neuere M-Serie (ab M200/M300) | Ältere BBS-Serie, einige M-Modelle |
| **Stecker-Typ** | Grüner **dreieckiger** 5-Pin Stecker | Grüner **runder** 5-Pin Stecker |
| **Datenrate** | Bis zu 1 Mbps | Typisch 115200 baud |
| **Datenfelder** | Umfangreich (Drehmoment, Temperatur, etc.) | Basis (Geschwindigkeit, PAS, Batterie) |
| **Multi-Node** | Ja (Motor, Display, Batterie, IoT) | Nein (Punkt-zu-Punkt) |
| **Fehlererkennung** | CRC-Prüfung, automatisch | Begrenzt |
| **App-Integration** | Empfohlen für Telemetrie | Eingeschränkt möglich |

**Quellen:** [1][4]

### 2.2 CAN-Bus Protokoll-Spezifikation (M-Serie)

**Physikalische Schicht:**
- **Spannungspegel:** 3,3V oder 5V (TTL-kompatibel)
- **Leitungen:** CAN_H, CAN_L, GND, VCC (5V), Reserve
- **Terminierung:** 120Ω am Bus-Ende (intern im Motor)

**CAN-Frame Struktur (Standard CAN 2.0A):**
```
┌──────────┬──────┬──────┬────────┬─────────┬───────────┐
│  ID (11) │ DLC  │ Data │  ...   │  ...    │ CRC (15)  │
│  Bit     │ 4Bit │ 0-7  │  Byte  │  Byte   │  Bit      │
└──────────┴──────┴──────┴────────┴─────────┴───────────┘
```

**Bekannte CAN-IDs (basierend auf Reverse-Engineering):**

| CAN-ID (Hex) | Richtung | Beschreibung | Datenlänge |
|--------------|----------|--------------|------------|
| `0x101` | Motor → Display | Status: Geschwindigkeit, PAS-Level | 8 Byte |
| `0x102` | Display → Motor | Steuerung: Unterstützungslevel, Licht | 8 Byte |
| `0x103` | Motor → Display | Drehmoment, Leistung | 8 Byte |
| `0x104` | Batterie → System | SoC, Spannung, Strom, Temperatur | 8 Byte |
| `0x105` | Motor → System | Fehlercodes, Temperatur | 8 Byte |
| `0x106` | IoT → Motor | Konfiguration, OTA-Commands | 8 Byte |
| `0x201` | Motor → IoT | Telemetrie-Paket 1 | 8 Byte |
| `0x202` | Motor → IoT | Telemetrie-Paket 2 | 8 Byte |

**⚠️ Hinweis:** Offizielle CAN-IDs werden von Bafang **nicht öffentlich dokumentiert**. Obige Werte basieren auf Community-Reverse-Engineering und können je nach Firmware-Version variieren.

**Quellen:** [1][3][4]

### 2.3 UART Protokoll-Spezifikation (BBS-Serie)

**Physikalische Schicht:**
- **Baudrate:** 115200 (Standard), kann variieren
- **Datenbits:** 8
- **Stopbits:** 1
- **Parität:** Keine
- **Spannungspegel:** 5V TTL

**Frame-Struktur:**
```
┌──────┬──────┬────────┬───────────┬──────┐
│ 0x55 │ 0xAA │ LENGTH │  DATA...  │ CRC  │
│ Start│ Start│  Byte  │  N Byte   │ Check│
└──────┴──────┴────────┴───────────┴──────┘
```

**Bekannte Commands (Hex):**

| Command | Richtung | Beschreibung |
|---------|----------|--------------|
| `0x01` | App → Motor | Lese Geschwindigkeit |
| `0x02` | App → Motor | Lese Batterie-Status |
| `0x03` | App → Motor | Lese PAS-Level |
| `0x10` | App → Motor | Setze Unterstützungslevel |
| `0x11` | App → Motor | Licht Ein/Aus |
| `0x20` | Motor → App | Status-Antwort |
| `0xFF` | Bidirektional | Heartbeat / Keep-Alive |

**Quellen:** [3][4]

---

## 🚴 3. Vollständige Bafang Motor-Modell-Übersicht

### 3.1 Mittelmotoren (M-Serie) – CAN-Bus

| Modell | Code | Leistung | Drehmoment | Gewicht | Protokoll | BLE-fähig | Jahr |
|--------|------|----------|------------|---------|-----------|-----------|------|
| **M200** | G210.250.C | 250W | 65 Nm | 2,9 kg | CAN | ✅ (mit Display) | 2023 |
| **M210** | G2300.250.C | 250W | 65 Nm | 2,8 kg | CAN | ✅ | 2024 |
| **M215** | G340.250.C | 250W | 75 Nm | 3,0 kg | CAN | ✅ | 2024 |
| **M300** | G360.250.C | 250W | 85 Nm | 3,2 kg | CAN | ✅ | 2023 |
| **M315** | G340.500.C | 500W | 90 Nm | 3,3 kg | CAN | ✅ | 2024 |
| **M400** | G330.250.C | 250W | 80 Nm | 3,4 kg | CAN/UART | ✅ | 2022 |
| **M410** | G333.250.C | 250W | 85 Nm | 3,4 kg | CAN | ✅ | 2024 |
| **M420** | G332.250.C | 250W | 85 Nm | 3,5 kg | CAN | ✅ | 2023 |
| **M430** | M430 | 250W | 120 Nm | 4,2 kg | CAN | ✅ | 2025 (Cargo) |
| **M500** | G520.250.C | 250W | 95 Nm | 3,7 kg | CAN | ✅ | 2023 |
| **M510** | G522.250.C | 250W | 100 Nm | 3,8 kg | CAN | ✅ | 2024 |
| **M510RS** | - | 790W (Peak) | 110 Nm | 3,2 kg | CAN | ✅ | 2026 (eMTB) |
| **M560** | G5300.750.C | 750W | 120 Nm | 4,5 kg | CAN | ✅ | 2024 |
| **M560RS** | - | 1700W (Peak) | 140-150 Nm | 4,6 kg | CAN | ✅ | 2026 (eMTB) |
| **M600** | G521.250/500.C | 500W | 120 Nm | 3,9 kg | CAN | ✅ | 2023 |
| **M615** | G320.750/1000.C | 750-1000W | 140 Nm | 5,0 kg | CAN | ✅ | 2022 |
| **M620** | G510.1000.C | 1000W | 160 Nm | 5,3 kg | CAN/UART | ✅ | 2022 |
| **M800** | G530.200.C | 200W | 55 Nm | 2,3 kg | CAN | ✅ | 2023 (eRoad) |
| **M820** | - | 250W | 75 Nm | 2,5 kg | CAN | ✅ | 2024 (eGravel) |

**Besonderheiten:**
- **M430:** Speziell für Cargo-Bikes (bis 300 kg Zuladung, 800% Unterstützung)
- **M510RS/M560RS:** Racing-Sport eMTB-Systeme, Herzfrequenz-basierte Unterstützung, Q4 2026 Massenproduktion
- **M800/M820:** Ultra-leicht für eRoad/eGravel, minimierter Rollwiderstand >25 km/h

**Quellen:** [1][2][3][4][5]

### 3.2 Nabenmotoren & GVT-Systeme (Automatik-Getriebe)

| Modell | Typ | Leistung | Besonderheit | Protokoll | BLE-fähig |
|--------|-----|----------|--------------|-----------|-----------|
| **H730** | Hinterrad-Nabe | 250W | 3-Gang Automatik (GVT), German Design Award 2026 | CAN | ✅ |
| **G500A** | Hinterrad-Nabe | 250W | 5-Gang Automatik, Fat-Bike optimiert | CAN | ✅ |
| **RG E510** | Hinterrad-Nabe | 250W | 5-Gang Elektro-Schaltung (Hand-Auto), 2026 | CAN | ✅ |

**GVT-Plattform (Gear Variable Transmission):**
- Automatische Gangwahl basierend auf Fahrsituation
- Kein Umwerfer, keine Schaltzüge
- Integration mit M210, M410, M430 Mittelmotoren
- Daten-Austausch für intelligente Schaltungen

**Quelle:** [3]

### 3.3 Ältere BBS-Serie (UART/CAN-Mix)

| Modell | Protokoll | Stecker | BLE-fähig |
|--------|-----------|---------|-----------|
| **BBS01** | UART | Rund (5-Pin) | ❌ (Nachrüstung möglich) |
| **BBS02** | UART | Rund (5-Pin) | ❌ (Nachrüstung möglich) |
| **BBS03 / HD** | UART/CAN | Rund (5-Pin) | ⚠️ Teilweise |

**Hinweis:** Für BBS-Serie wird oft ein **HM-10 BLE-Modul** als Nachrüstlösung zwischen Controller und Display verwendet [3].

---

## 🖥️ 4. Kompatible Displays mit BLE-Funktionalität

Displays sind der **Schlüssel** zur BLE-Konnektivität, da sie den Bluetooth-Chip enthalten.

### 4.1 Offizielle Bafang Displays

| Modell | Typ | Protokoll | Bildschirm | BLE | Besonderheiten |
|--------|-----|-----------|------------|-----|----------------|
| **DPC010 / C010** | TFT | CAN | 2,4" Farbe | ✅ | Standard für M400/M500 |
| **DPC18** | TFT | CAN/UART | 2,8" Farbe | ✅ | Universell |
| **DZ41 / DZ47** | LCD | CAN | 1,8" SW | ⚠️ | Basis-Modell |
| **DP C030** | TFT | CAN | 1,9" Farbe | ✅ | Integriert im Oberrohr, IPX7, 2025 |
| **DP C400** | OLED | CAN | Kompakt | ✅ | Am Vorbau, 6 Assist-Modi, 2025 |
| **600C TFT** | TFT | CAN | 3,5" Farbe | ✅ | Drittanbieter, volle CAN-Unterstützung |

**Quellen:** [1][4][5]

### 4.2 Drittanbieter-Displays mit Navigation

| Modell | Hersteller | Protokoll | BLE | Navigation | Preis (ca.) |
|--------|-----------|-----------|-----|------------|-------------|
| **EB02** | Generic | CAN | ✅ | Kartennavigation | 150-200€ |
| **Speed Unlimited 600C** | Speed Unlimited | CAN | ✅ | Grundfunktionen | 180€ |
| **DZ41 Universal** | Generic | UART/CAN | ⚠️ | Nein | 80-120€ |

---

## 📡 5. BLE GATT Services & Characteristics

### 5.1 Standard BLE-Architektur für Bafang

Bafang verwendet **keine standardisierten GATT-Services** wie Cycling Power Service (0x1818). Stattdessen kommt ein **proprietäres Profil** zum Einsatz.

**Vermutete Service-Struktur (basierend auf Reverse-Engineering):**

```
Service UUID: 0xFFE0 (Proprietär)
├── Characteristic 0xFFE1 (RX) – Schreiben (App → Bike)
├── Characteristic 0xFFE2 (TX) – Lesen/Notify (Bike → App)
└── Characteristic 0xFFE3 (CONFIG) – Schreiben/Lesen
```

**Alternativ (IoT-Modul):**
```
Service UUID: 0x180A (Device Information)
Service UUID: 0x180F (Battery Service)
Service UUID: 0xFFF0 (Proprietär IoT)
├── 0xFFF1 – GPS-Daten (Notify)
├── 0xFFF2 – Motor-Status (Notify)
├── 0xFFF3 – Steuer-Commands (Write)
└── 0xFFF4 – Konfiguration (Write/Read)
```

**⚠️ Wichtig:** Exakte UUIDs werden von Bafang **nicht öffentlich dokumentiert**. Entwickler müssen diese durch **BLE-Scanning** (nRF Connect App) selbst ermitteln.

### 5.2 Daten-Format (Beispiel-Payload)

**Beispiel: Motor-Status (TX, 20 Byte):**
```
Byte 0-1:   Header (0x55 0xAA)
Byte 2:     Command ID (0x20 = Status)
Byte 3:     Geschwindigkeit (km/h)
Byte 4-5:   Drehmoment (Nm, UInt16)
Byte 6-7:   Leistung (Watt, UInt16)
Byte 8:     PAS-Level (0-9)
Byte 9:     Batterie-SoC (%)
Byte 10-11: Spannung (V, UInt16 / 10)
Byte 12-13: Strom (A, UInt16 / 10)
Byte 14:    Motor-Temperatur (°C, offset -20)
Byte 15:    Fehlercode (0x00 = OK)
Byte 16-17: Gesamt-Kilometer (km, UInt16)
Byte 18-19: CRC-16 Checksumme
```

**Beispiel: Steuer-Command (RX, 12 Byte):**
```
Byte 0-1:   Header (0x55 0xAA)
Byte 2:     Command ID (0x10 = Set Assist)
Byte 3:     Ziel-PAS-Level (0-9)
Byte 4:     Licht (0x00=Aus, 0x01=Ein)
Byte 5-8:   Reserve
Byte 9-10:  CRC-16
Byte 11:    End-Byte (0xFF)
```

---

## 🛠️ 6. Entwicklungsempfehlungen
...

---

## ⚠️ 11. KRITISCHE ERGÄNZUNG: Integrationsrisiken & Evidenzstatus (App-Store Analyse)

Aus aktuellen App-Store Bewertungen und dem Fehlen einer öffentlichen Bafang-SDK Dokumentation ergeben sich folgende zwingende Richtlinien für die App-Entwicklung:

### 11.1 Evidenz- und Quellenstatus
* **Belegt durch offizielle Stores:** Metadaten (iOS 17+), Datenschutz (Location, Identifiers), offizielle Features (Strava-Sync, Navigation, Parameter-Anpassung).
* **Belegt durch Nutzerfeedback (Risiken):** Verbindungsprobleme, gelöschte Settings (M560/C245), Inkompatibilitäten (M820 nach Update).
* **NICHT belegt (Hypothesen):** Exakte CAN-IDs, BLE-UUIDs, Payload-Layouts. Diese basieren auf Community-Reverse-Engineering und müssen vor Produktions-Einsatz verifiziert werden!

### 11.2 Risiko-Tabelle (Nutzerberichte)
| Beobachtung | Betroffene Modelle | Risiko für App | Gegenmaßnahme |
|---|---|---|---|
| Verbindung setzt Ride-Mode Settings auf 0 | **M560 / C245** | Bike wird deaktiviert! | **Niemals blind schreiben.** Konfiguration vorher lesen & Backup-Warnung. |
| "device is not supported" nach Update | **M820** | Inkompatibilität | Allowlist-Verfahren. Unbekannte Modelle strikt auf **Read-Only**. |
| Auto-Off-Einstellung nicht speicherbar | Basis-Modelle | Persistenz instabil | Write-Always-Readback Verfahren. |

### 11.3 Architektonische Konsequenzen ("Never do this")
1. **Read-only zuerst:** Standardmäßig keine Schreibzugriffe aktivieren.
2. **Kein Write auf unbekannte Geräte:** Nur Modelle beschreiben, die explizit in einer internen Whitelist freigegeben sind.
3. **Recovery-Pfad einplanen:** Nutzer auf Bafang BESST Pro oder Händler-Reset hinweisen, falls Konfigurationen fehlschlagen.
4. **Kein automatisches Tuning:** Keine riskanten Parameter ändern, um die Straßenzulassung nicht zu gefährden.

### 11.4 Internes Geräte-Capability Modell
Um diese Risiken zu managen, muss die App intern ein Profil-Mapping nutzen (z.B. als JSON), das pro verbundenem Gerät definiert, welche Operationen (`read_status`, `write_assist_level`) erlaubt sind und welche blockiert werden (`blocked_operations: ["write_assist_level"]` bei unbekannten Geräten).
