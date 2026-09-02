# Mitwirken an Der Wegweiser (Contributing Guide)

Vielen Dank für dein Interesse, **Der Wegweiser** aktiv mitzugestalten! Als offenes Projekt für E-Bike-Navigation, vorausschauende Telemetrie und Ladeinfrastruktur freuen wir uns über Verbesserungen, Fehlerbehebungen und neue Ideen.

---

## 🛠️ Entwicklungsumgebung einrichten

1. **Repository forken & klonen**:
   ```bash
   git clone https://github.com/<dein-username>/der-wegweiser.git
   cd der-wegweiser
   ```

2. **Abhängigkeiten installieren**:
   ```bash
   npm ci
   ```

3. **Lokale Konfiguration anlegen**:
   ```bash
   cp .env.example .env.local
   ```

4. **Entwicklungsserver starten**:
   ```bash
   npm run dev
   ```

---

## 📋 Richtlinien für Pull Requests (PRs)

Bevor du einen Pull Request einreichst, stelle bitte sicher, dass alle lokalen Qualitätsprüfungen erfolgreich durchlaufen:

```bash
# 1. Linter prüfen
npm run lint

# 2. TypeScript-Typen & Produktions-Build validieren
npm run build

# 3. Automatischen Secret- & Security-Scan ausführen
node scripts/scan_secrets.js
```

### Commit-Konventionen (Conventional Commits)
Wir folgen dem Conventional-Commits-Standard:
* `feat:` Neues Feature (z. B. `feat: add support for Shimano Di2 BLE telemetry`)
* `fix:` Fehlerbehebung (z. B. `fix: correct slope calculation in tunnel segments`)
* `docs:` Dokumentation oder Wiki-Anpassungen
* `sec:` Sicherheits- und Berechtigungsverbesserungen
* `refactor:` Code-Optimierung ohne Verhaltensänderung

---

## 🔒 Sicherheitsregeln für Mitwirkende

* **Niemals echte API-Keys, Private Keys oder Zugangsdaten committen.**
* Alle neuen externen Endpunkte müssen über HTTPS angesprochen werden.
* Halte dich an den [Verhaltenskodex](CODE_OF_CONDUCT.md) und melde Sicherheitslücken vertraulich an `wegweiser-app@proton.me` gemäß [SECURITY.md](SECURITY.md).
