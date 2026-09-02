# 🛡️ Datenschutz & DSGVO-Compliance (Privacy & Compliance)

Bei **Der Wegweiser** ist Datenschutz kein nachträglicher Gedanke, sondern ein fundamentales Architekturprinzip (*Privacy by Design*).

---

## ⚖️ Verantwortliche Stelle & Impressum (§ 5 DDG)

* **Betreiber & Diensteanbieter:**
  Pascal Gregor
  Spreetal, Deutschland
* **Kontakt für Datenschutzfragen:**
  📧 `wegweiser-app@proton.me`
* **Offizielle Datenschutzerklärung im Web:**
  [https://der-wegweiser.web.app/privacy.html](https://der-wegweiser.web.app/privacy.html)
* **Web-Portal für sofortige Kontolöschung (Art. 17 DSGVO):**
  [https://der-wegweiser.web.app/account-deletion.html](https://der-wegweiser.web.app/account-deletion.html)

---

## 📊 Datenfluss-Matrix

| Datenkategorie | Verarbeitungsort | Speicherdauer | Zweck / Rechtsgrundlage |
| :--- | :--- | :--- | :--- |
| **GPS-Echtzeitposition** | Ausschließlich lokal auf dem Endgerät (RAM) | Flüchtig; wird mit Beenden der Navigation gelöscht | Turn-by-Turn Navigation (Art. 6 Abs. 1 lit. b DSGVO) |
| **BLE-Telemetrie** (Akku Wh, Trittfrequenz, Watt) | Ausschließlich lokal auf dem Endgerät | Flüchtig; keine Cloud-Übertragung | Berechnung der No-Coast-Restreichweite (Art. 6 Abs. 1 lit. b DSGVO) |
| **Nutzerkonto & Favoriten** | Google Cloud Firestore (Rechenzentrum Frankfurt am Main, `europe-west3`) | Bis zum Widerruf / Löschung durch den Nutzer | Bereitstellung der gespeicherten Strecken (Art. 6 Abs. 1 lit. b DSGVO) |
| **Gemeldete Ladesäulen** | Google Cloud Firestore | Dauerhaft (als gemeinfreie Community-Daten) | Bereitstellung des Ladesäulennetzes (Art. 6 Abs. 1 lit. f DSGVO) |
| **Moderationsmeldungen** | Google Cloud Firestore (`/content_reports/`) | Bis zur Prüfung (max. 30 Tage) | Einhaltung von Sicherheits- und Store-Richtlinien |

---

## 🚫 Was wir NIEMALS tun

1. **Kein Verkauf von Telemetrie- oder Bewegungsdaten:** Deine gefahrenen Routen und Geschwindigkeiten werden an niemanden verkauft, lizenziert oder für Werbezwecke aggregiert.
2. **Keine Werbe-Tracker oder Werbe-SDKs:** Die App bindet keine Werbenetzwerke, Tracking-Pixel oder Werbe-IDs (wie IDFA oder Google Ad ID) ein.
3. **Keine Hintergrund-Ortung ohne aktive Fahrt:** Auf Android wird kein `ACCESS_BACKGROUND_LOCATION` angefordert. Der Standortdienst läuft rein als sichtbarer Vordergrunddienst mit Statusleisten-Symbol (`FOREGROUND_SERVICE_LOCATION`).

---

## 🗑️ Recht auf Löschung (Art. 17 DSGVO)

Du hast jederzeit die volle Kontrolle über deine Daten:
* **Direkt in der App:** Öffne das Profil/Einstellungs-Cockpit und tippe auf **„Konto & alle Daten unwiderruflich löschen“**.
* **Im Web:** Rufe [https://der-wegweiser.web.app/account-deletion.html](https://der-wegweiser.web.app/account-deletion.html) auf und fordere die Löschung an.
* **Wirkung:** Dein Firebase-Authentifizierungskonto, alle verknüpften Firestore-Dokumente (`/users/{uid}`, `/user_tokens/{uid}`) und alle privaten Strecken werden sofort und unwiderruflich gelöscht.
