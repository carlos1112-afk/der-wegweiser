# ACCOUNT- & DATENLÖSCHUNG — DER WEGWEISER (GOOGLE PLAY POLICY)

Gemäß der **Google Play Account Deletion Policy** und **Art. 17 DSGVO** bietet *Der Wegweiser* zwei gleichwertige, verifizierte Löschpfade für Nutzerdaten:

---

## 1. In-App Kontolöschung (Direkt in der App)
* **Pfad**: Profil / Einstellungen &rarr; Rechtliches & Datenschutz &rarr; **Konto & Daten unwiderruflich löschen**.
* **Automatisierter Löschprozess ([`AccountDeletionService.ts`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/src/services/accountDeletionService.ts))**:
  1. Firestore `users` (Nutzerprofil) gelöscht.
  2. Firestore `user_tokens` (Punktestand/Tokens) gelöscht.
  3. Firestore `user_preferences` & `user_memory_patterns` gelöscht.
  4. Firestore `routes` (Eigene erstellte Routen) gelöscht.
  5. Firestore `scout_reports` (Scout-Meldungen) gelöscht.
  6. Cloud Storage (Nutzerordner `users/{uid}/`) gelöscht.
  7. Firestore `charging_stations`: Ersteller-ID wird unwiderruflich auf `anonymous_community` anonymisiert (Gemeinschafts-Ladeinfrastruktur bleibt erhalten).
  8. Firebase Authentication Account (`deleteUser`) wird als finaler Schritt entfernt.

---

## 2. Externe Web-Löschseite (Google Play Store Anforderung)
* **Öffentliche URL für die Play Console**: `https://wegweiser.app/account-deletion.html`
* **Lokale Datei im Projekt**: [`public/account-deletion.html`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/public/account-deletion.html)
* **Funktionsumfang der Webressource**:
  * Eindeutige Nennung des App-Namens (*Der Wegweiser*) und des Verantwortlichen.
  * Erläuterung aller betroffenen und gelöschten Datenarten.
  * Interaktives Webformular zur Übermittlung von Löschanfragen außerhalb der App.
  * Manuelle Bearbeitungsfrist von maximal 48 Stunden gemäß DSGVO.

> [!NOTE]
> **EXTERN AUSZUFÜHREN**: Falls die Domain `wegweiser.app` noch nicht live geschaltet ist, muss `public/account-deletion.html` auf Firebase Hosting, GitHub Pages oder dem Betreiber-Webspace gehostet werden.
