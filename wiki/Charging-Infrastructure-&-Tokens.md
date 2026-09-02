# 🔌 Ladeinfrastruktur & Community-Tokens (Charging & Tokens)

Ein Kernpfeiler von **Der Wegweiser** ist das dezentrale Erfassen und Verifizieren von E-Bike-Ladeinfrastruktur abseits klassischer Autobahn-Raststätten.

---

## ⚡ Unterstützte Ladesäulen-Typen

In der interaktiven Karte sind Ladepunkte farblich und nach Anschlusstyp kategorisiert:

| Typ | Steckertyp / System | Typische Leistung | Anmerkungen |
| :--- | :--- | :--- | :--- |
| **Schuko 230V** | Standard Haushaltssteckdose | 230V / 10–16A (bis 3.6 kW) | Universell mit eigenem Reiseladegerät nutzbar (z. B. an Berghütten, Biergärten). |
| **Bosch E-Bike** | Bosch Smart System / 36V | 2A / 4A / 6A Ladestrom | Speziell für PowerPack und PowerTube Akkus. |
| **Shimano STEPS** | Shimano Original-Ladepunkt | 36V / 4A | Passend für Shimano BT-E80xx Akkus. |
| **Bike-Energy** | Bike-Energy Magnetkupplung | Bis zu 5A Schnellladung | Wetterfestes Universalsystem mit speziellem Adapterkabel. |

---

## 📸 Ladesäulen-Scanner & Einreichung

Community-Mitglieder können neue Ladestationen direkt einreichen:
1. Öffne das Menü und wähle **„Ladestation melden“**.
2. GPS-Position wird automatisch exakt erfasst.
3. Wähle den Steckertyp, Ladegebühren (kostenlos / kostenpflichtig / Gastronomie-Kunden) und Wetterschutz.
4. Nach dem Absenden wird der Ladepunkt in die Firestore-Datenbank übertragen und ist für alle Nutzer sichtbar.

---

## 🛡️ UGC-Schutz & Moderation (Apple Guideline 1.2)

Zum Schutz der Community vor Spam, Beleidigungen oder falschen Einträgen implementiert **Der Wegweiser** ein dreistufiges Moderationssystem:

1. **Vorab-Inhaltsfilterung (`filterUgcText`):**
   * Texte von Stationsbeschreibungen und Bewertungen werden vor dem Speichern auf unangebrachte Inhalte und Spam-Muster gefiltert.
2. **In-App Meldefunktion (`content_reports`):**
   * Jede Ladestation und jede Bewertung besitzt eine Schaltfläche **„Melden“**.
   * Eine Meldung speichert den Grund direkt im geschützten Firestore-Pfad `/content_reports/`. Gemeldete Inhalte werden innerhalb von 24 Stunden geprüft und ggf. entfernt.
3. **Serverseitige Nutzersperre (`suspended_users`):**
   * Verstößt ein Nutzer wiederholt gegen die Richtlinien, wird sein Konto in der Firestore-Regelprüfung über `isNotSuspended()` für alle Schreibzugriffe dauerhaft gesperrt.

---

## 🪙 Community-Tokens

Als Anreiz für das Einreichen verifizierter Ladepunkte und genauer Statusmeldungen (z. B. *„Säule funktioniert / defekt“*) vergibt das System interne Belohnungs-Token.
* **Transparenz:** Die Token sind ein reines spielerisches Community-Werkzeug (Gamification) und keine spekulative Kryptowährung.
* **Sicherheit:** Der Token-Saldo liegt geschützt unter `/user_tokens/{uid}` und kann nur vom authentifizierten Nutzer selbst eingesehen werden.
