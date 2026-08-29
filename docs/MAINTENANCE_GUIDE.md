# WARTUNGS- & BETRIEBSLEITFADEN — DER WEGWEISER 1.0

Dieses Dokument definiert die Betriebsregeln, Incident-Klassifikationen, den Hotfix-Ablauf und den regelmäßigen Wartungskalender für den stabilen Betrieb von **Der Wegweiser**.

---

## 🚨 1. Incident- & Fehler-Klassifikation

| Schweregrad | Kriterien | Maximale Reaktionszeit | Release-Pfad |
| :--- | :--- | :--- | :--- |
| **P0 (Kritisch)** | • Datenverlust oder falsche Kontolöschung<br>• Kritische Sicherheitslücke (Remote Code Execution, Leaked Secrets)<br>• Crash-Loop beim App-Start<br>• Falsche/Gefährliche Routing-Führung (z. B. auf Autobahnen geleitet) | **Sofort (< 4 Stunden)** | Hotfix-Branch &rarr; `./release-check.sh` &rarr; Sofortiger Emergency-Release im Store |
| **P1 (Hoch)** | • Kernfunktion nicht verfügbar (z. B. AI Gateway Ausfall ohne Fallback)<br>• BRouter-Offline-Modus defekt<br>• BLE-Verbindung bricht reproduzierbar ab | **< 24 Stunden** | Hotfix-Release innerhalb von 1–2 Tagen |
| **P2 (Mittel)** | • Komfortfunktion fehlerhaft (z. B. Lounge-Minispiel laggt, Farbfehler im Höhenprofil)<br>• Kleinere Übersetzungsfehler | **Regulärer Sprint** | Nächster regulärer Patch-Release (z. B. 1.0.1) |
| **P3 (Niedrig)** | • Kosmetische UI-Details, Padding-Abweichungen, Icon-Feinheiten | **Backlog** | Version 1.1 |

---

## 🛠️ 2. Standard Operating Procedure: Hotfix-Prozess

```
1. Reproduktion des Fehlers & Issue-Ticket erstellen
                         ↓
2. Git Hotfix-Branch erstellen: git checkout -b hotfix/v1.0.x
                         ↓
3. Minimalinvasiver Code-Fix (Keine unnötigen Refactorings!)
                         ↓
4. Vollständige Release-Pipeline ausführen: ./release-check.sh
                         ↓
5. Versions-Inkrement (z. B. 1.0.1, versionCode 2)
                         ↓
6. Merge in main & Git-Tag setzen (git tag v1.0.1)
                         ↓
7. Upload in Google Play Track: Internal Testing &rarr; Staged Rollout (10% &rarr; 50% &rarr; 100%)
```

---

## 🔄 3. Regelmäßiger Wartungskalender

### Bei jedem Release:
* Ausführen von `./release-check.sh`
* Verifikation der AAB-Signatur mit dem neutralen Upload-Key
* Secret-Scan des Produktions-Bundles (`dist/`)
* Automatisierter Account-Deletion Regressionstest

### Wöchentlich:
* `node scripts/check_dependencies.js` zur Prüfung auf neue Sicherheits-Advisories
* Ausführen von `node scripts/health_check_providers.js`
* Prüfung der Google Play Console Crash- und ANR-Raten gegen jeweils aktuelle Google-Play-Vitals-Schwellenwerte

### Monatlich:
* **Backup & Test-Restore (Vollständiger Zyklus)**:
  * Vollständiger Export der Firestore-Collections via `scripts/export_firebase_data.mjs`
  * Import/Restore in eine isolierte temporäre Test-Datenbank / Test-Environment
  * Automatisierter Abgleich von Dokumentenanzahl, Feldschemata und Datenintegrität
  * Sicheres Bereinigen der temporären Testressourcen nach erfolgreichem Restore-Nachweis
* Auswertung der Cloud-Kosten (GCP / Open-Meteo / Vertex AI) und Abgleich mit Budgets

### Quartalsweise:
* Überprüfung von Google Play Policy Updates & Android Target SDK Deadlines
* Überprüfung der Apple App Store Review Guidelines
* Überprüfung der OpenStreetMap / BRouter Routing-Profile
* Prüfung rechtlicher Änderungen (DSGVO / DDG / Verbraucherschutz)

---

## ⚡ 4. Rate Limits & Caching Parameter

* **Wetter-Cache TTL**: 15 Minuten (Server-In-Memory-Cache)
* **Höhen-Cache TTL**: 24 Stunden (Server-In-Memory-Cache)
* **API Rate Limit**: Maximal 120 Requests pro Minute pro IP-Adresse (Token Bucket Algorithmus im Proxy)
* **AI Assistent Circuit Breaker**: Bei 3 aufeinanderfolgenden Timeouts automatischer Fallback auf den lokalen deterministischen Heuristik-CoPiloten.
