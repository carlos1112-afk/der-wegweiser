# SYSTEM-ARCHITEKTUR & BETRIEBSKONZEPT — DER WEGWEISER 1.0

Dieses Dokument beschreibt die entkoppelte Systemarchitektur, API-Versionierung, Schema-Migrationen und Abwärtskompatibilitäts-Strategie von **Der Wegweiser**.

---

## 🏛️ 1. Architektur-Übersicht

```
                      ┌───────────────────────────────────────────────┐
                      │              DER WEGWEISER APP                │
                      │         (React 18 + Vite + Capacitor)         │
                      └───────┬───────────────────────────────┬───────┘
                              │                               │
                      [HTTPS / TLS 1.3]               [Web Bluetooth]
                              │                               │
                              ▼                               ▼
    ┌─────────────────────────────────────────┐     ┌──────────────────┐
    │     BETREIBER BACKEND PROXY             │     │   E-BIKE SENSOR  │
    │  (Server-Side Token & Secret Gateway)   │     │ (Lokaler BLE RAM)│
    └────┬──────────────┬───────────────┬─────┘     └──────────────────┘
         │              │               │
         ▼              ▼               ▼
┌─────────────────┐ ┌─────────┐ ┌───────────────┐
│ Google Vertex AI│ │  Open-  │ │   Firebase    │
│(europe-west3)   │ │  Meteo  │ │(Auth/Firestore│
│gemini-3.6-flash │ │ (Proxy) │ │ /Storage)     │
└─────────────────┘ └─────────┘ └───────────────┘
```

---

## 🌐 2. API-Versionierung & Abwärtskompatibilität

Alle externen Backend-Schnittstellen sind standardmäßig versioniert (`/api/v1/*`):

| Endpoint | Methode | Zweck | Abwärtskompatible Aliase |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Health-Check & Service-Monitoring | `/health`, `/api/health` |
| `/api/v1/remote-config` | `GET` | Remote Feature Flags & Kill-Switch | `/api/v1/config`, `/api/remote-config` |
| `/api/v1/weather` | `GET` | Wetterabfrage via Server-Proxy | `/api/weather`, `/v1/weather` |
| `/api/v1/elevation` | `GET` | Höhenabfrage via Server-Proxy | `/api/elevation`, `/v1/elevation` |
| `/api/v1/ai` | `POST` | AI Gateway Inferenz (`gemini-3.6-flash`) | `/api/ai/chat/completions`, `/v1/chat/completions` |

### Support- & Deprecation-Strategie:
* **Version Support**: Das Backend garantiert die simultane Unterstützung von mindestens `N` (aktuell) und `N-1` (vorherige Version).
* **Breaking Changes**: Sollte eine inkompatible Schnittstellenänderung notwendig werden, wird diese unter `/api/v2/*` bereitgestellt, während `/api/v1/*` mit einer Übergangsfrist von mindestens 6 Monaten aktiv bleibt.

---

## 🗄️ 3. Datenbank-Schemaversionen & Migrationen

* Firestore-Dokumente und lokale Speicherstrukturen verwenden ein explizites `schemaVersion` Feld.
* Schemaänderungen werden versioniert im Verzeichnis `migrations/` dokumentiert und über idempotente Migrationsskripte ausgeführt.

---

## 🚩 4. Remote Feature Flags / Kill-Switch

* Bei unerwarteten API-Ausfällen oder regulatorischen Anforderungen können Subsysteme serverseitig über `/api/v1/remote-config` temporär deaktiviert werden:
  * `aiEnabled`: Schaltet den KI-Assistenten ab (App nutzt automatisch den lokalen Heuristik-CoPiloten).
  * `surveysEnabled`: Deaktiviert externe Marktforschungs-Module.
  * `partnerOffersEnabled`: Blendet externe Partner-Aktionen aus.
  * `maintenanceMode`: Zeigt Wartungshinweis an.
* **Ausfallsicherheit**: Falls der Remote-Config-Server nicht erreichbar ist, greift die App automatisch auf sichere, offlinefähige Default-Werte zurück.
