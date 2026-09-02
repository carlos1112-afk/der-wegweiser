# Sicherheitsrichtlinie (Security Policy)

Die Sicherheit der Nutzer und der Schutz sensibler Telemetriedaten haben bei **Der Wegweiser** oberste Priorität.

## 🛡️ Unterstützte Versionen

Folgende Versionen werden aktiv mit Sicherheitsupdates versorgt:

| Version | Unterstützt |
| :--- | :--- |
| `1.0.x` (RC2 / Release) | :white_check_mark: Ja |
| `< 1.0.0` (Alpha / Drafts) | :x: Nein |

## 🚨 Melden einer Sicherheitslücke (Vulnerability Reporting)

Wenn du eine Sicherheitslücke oder ein Datenrisiko (z. B. exponierte Schlüssel, Schwachstellen in den Firestore Security Rules oder im Berechtigungsmodell) entdeckt hast:

1. **Bitte erstelle KEIN öffentliches GitHub-Issue!**
2. Sende eine vertrauliche E-Mail an unseren Sicherheits- und Datenschutzkanal:
   📧 **`wegweiser-app@proton.me`**
3. Bitte gib in deiner Meldung folgende Details an:
   - Eine genaue Beschreibung des Problems
   - Schritte zur Reproduktion (Proof-of-Concept, Requests oder Code-Auszug)
   - Mögliche Auswirkungen auf Nutzerdaten oder Cloud-Ressourcen

### Unsere Reaktionszeit
- **Erste Bestätigung:** innerhalb von 24 Stunden.
- **Triage & Schweregrad-Einstufung:** innerhalb von 48 Stunden.
- **Behebung & Patch:** Zeitnahe Bereitstellung über Git und die Stores.

## 🔒 Sicherheitsarchitektur im Überblick

- **Client-Secrets:** Der Client-Quellcode enthält keine privilegierten API-Tokens oder administrativen Zugangsdaten.
- **Firestore Security Rules:** Zugriff auf persönliche Nutzerprofile (`/users/`), Routen und Token-Salden ist strikt auf den authentifizierten Eigentümer beschränkt (`isOwner()`).
- **UGC-Schutz:** Gemeinschaftsbeiträge werden vor dem Absenden auf unerwünschte Inhalte geprüft (`filterUgcText`) und können jederzeit gemeldet werden (`content_reports`).
- **DSGVO Art. 17:** Vollständige, sofortige und unwiderrufliche Kontolöschung direkt in der App oder über das Web-Portal.
