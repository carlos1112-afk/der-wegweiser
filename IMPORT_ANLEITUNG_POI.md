# Kurzanleitung: POI-Import in Firestore (Seed Batch 002)

Diese Anleitung beschreibt den verbindlichen Standard-Workflow zur Überführung von Recherche-POIs in die Firestore-Kollektion `points_of_interest`.

---

## 1. Validierungsvorgaben & Schema-Regeln

Der Validator [`scripts/seed_poi_validate.mjs`](scripts/seed_poi_validate.mjs) erzwingt strikte Regeln. Ungültige Einträge werden hart abgelehnt (kein Silent-Drop):

1. **Kategorie-Reduktion (`VALID_CATEGORIES`)**:
   - Gültige Kategorien sind ausschließlich:
     - `Werkstatt` (Reparatursäulen, Schlauchautomaten, Fachgeschäfte)
     - `Aussichtspunkt` (Gipfel, Panoramen, Aussichtstürme)
     - `See` (Badeseen, Weiher, Strandbäder an Radwegen)
     - `Eisladen` (Eiscafés, Eisdielen)
     - `Rastplatz` (Ladesäulen, Akku-Stationen, überdachte Rastplätze)
     - `Schutzhütte` (Alpenhütten, PWV-Waldhütten, Wetterschutz)
     - `Picknickplatz` (Picknickstellen)
     - `Sonstiges` (Hotels, Brauhäuser, Restaurants, Hofläden)
   - *Regel*: Mehrfach-Tags (z. B. `Ladesäule / Gastro` oder `Hotel / Ladesäule`) müssen auf die Hauptfunktion reduziert werden (z. B. `Rastplatz` oder `Sonstiges`). Die Detail-Tags wandern in das Feld `description` (z. B. `[Ladesäule / Gastro] ...`).

2. **Exakte Geokoordinaten (`lat`/`lng`)**:
   - Koordinaten müssen echte Zahlen (`float`) innerhalb der Bounding Box von Deutschland sein:
     - `lat`: 47.0 bis 55.2
     - `lng`: 5.5 bis 15.5
   - Platzhalter wie `"zu verifizieren"` oder Schätzungen sind verboten. Adressen müssen via Nominatim (OpenStreetMap) geocodiert werden.
   - Umkreis-Prüfung: Keine zwei Einträge dürfen näher als 50 m beieinander liegen.

3. **Quellen-URL & Vertrauensstufe (`confidence`)**:
   - `sourceUrl`: Valide URL mit `https://` (oder `http://`).
   - `confidence`: Exakt `"high"`, `"medium"` oder `"low"`.
     - `high`: Amtliche Portale, verifizierte Website des Betreibers.
     - `medium`: Sekundäre Radreiseführer / Blogs.
     - `low`: Community-Foren (muss manuell verifiziert werden).

---

## 2. Ablauf in 3 Schritten

### Schritt 1: Vorbereitung & Geocoding (Nominatim)
Das Script [`scripts/prepare_seed_batch.py`](scripts/prepare_seed_batch.py) reduziert Kategorien, verschiebt Sub-Tags in die Beschreibung und geocodet unvollständige Adressen:

```bash
python3 scripts/prepare_seed_batch.py
```
*Ergebnis*: `firebase_data/seed_poi_batch_002_raw.json`

### Schritt 2: Validierung & Deduplizierung
Der offizielle Projektvalidator prüft Bounding Box, Kategorien, URLs und Duplikate (Name & 50m Radius):

```bash
node scripts/seed_poi_validate.mjs firebase_data/seed_poi_batch_002_raw.json --out firebase_data/seed_poi_batch_002.json
```
*Ergebnis*: 
- Alle gültigen Einträge werden in `firebase_data/seed_poi_batch_002.json` geschrieben.
- Eventuell abgelehnte Einträge werden in der Konsole mit der exakten Begründung gelistet und können korrigiert werden.

### Schritt 3: Upload in Firestore
Sobald die Service-Account-Schlüsseldatei (`service-account.json` mit Datastore/Firestore-Rechten) vorliegt, führt [`scripts/seed_poi_upload.mjs`](scripts/seed_poi_upload.mjs) den Batch-Upload aus:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs firebase_data/seed_poi_batch_002.json
```

#### Optional: Testlauf gegen den lokalen Firestore Emulator
```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8799 node scripts/seed_poi_upload.mjs firebase_data/seed_poi_batch_002.json
```

#### Optional: Dry-Run (Authentifizierung & Schema-Test ohne Schreibzugriff)
```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed_poi_upload.mjs firebase_data/seed_poi_batch_002.json --dry-run
```
