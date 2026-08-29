# GOOGLE PLAY CONSOLE — SCHRITT-FÜR-SCHRITT HANDOFF CHECKLISTE

Führe diese Schritte in der angegebenen Reihenfolge in der [Google Play Console](https://play.google.com/console) aus:

---

## 1. App in der Play Console anlegen
1. Melde dich bei [play.google.com/console](https://play.google.com/console) an.
2. Klicke auf **App erstellen**.
3. **App-Details**:
   * **Name der App**: `Der Wegweiser`
   * **Standardsprache**: `Deutsch – de-DE`
   * **App oder Spiel**: `App`
   * **Kostenlos oder kostenpflichtig**: `Kostenlos`
4. Bestätige die Richtlinien-Erklärungen und klicke auf **App erstellen**.
5. Prüfe unter *Dashboard*, dass die Package/Application ID als `app.derwegweiser.navi` erkannt wird.

---

## 2. Release in Internal Testing hochladen
1. Navigiere im linken Menü zu: **Testen &rarr; Interner Test (Internal Testing)**.
2. Klicke oben rechts auf **Neuen Release erstellen**.
3. **Play App Signing**:
   * Stelle sicher, dass *„Google Play App Signing verwenden“* aktiviert ist (Standard).
4. **App-Bundle hochladen**:
   * Lade die Datei `release/google-play/1.0.0-rc1/app-release.aab` hoch.
5. **Release-Informationen eintragen**:
   * **Release-Name**: `1.0.0 (1) - RC1`
   * **Versionshinweise (de-DE)**: Kopiere den Inhalt aus `release/google-play/1.0.0-rc1/RELEASE_NOTES_DE.md`.
6. Klicke auf **Speichern** &rarr; **Release überprüfen** &rarr; **Für internen Test freigeben**.

---

## 3. Play App Signing Zertifikate erfassen & Firebase aktualisieren
> [!IMPORTANT]
> **Dieser Schritt ist zwingend erforderlich, damit Google Auth & Firebase auf dem Store-Build funktionieren!**

1. Navigiere in der Play Console zu:
   **Release &rarr; Einrichtung &rarr; App-Integrität &rarr; Tab "App-Signatur"**.
2. Notiere die beiden Werte des **App-Signaturschlüssels**:
   * `SHA-1-Zertifikatsfingerabdruck`
   * `SHA-256-Zertifikatsfingerabdruck`
3. Öffne die [Firebase Console](https://console.firebase.google.com/project/der-wegweiser/settings/general):
   * Gehe zu **Projekteinstellungen &rarr; Deine Android-App (`app.derwegweiser.navi`)**.
   * Klicke auf **Fingerabdruck hinzufügen** und trage sowohl den **SHA-1** als auch den **SHA-256** von Google Play ein.

---

## 4. Tester einladen & Store-Build installieren
1. Navigiere in der Play Console unter *Interner Test* zum Reiter **Tester**.
2. Wähle eine Tester-E-Mail-Liste (z. B. `Wegweiser Kern-Tester`) oder erstelle eine neue Liste mit deinen Google-Play-Konten.
3. Klicke auf **Änderungen speichern**.
4. Kopiere unten den **Teilnahme-Link für Tester** (z. B. `https://play.google.com/apps/internaltest/...`).
5. Öffne den Link auf deinem physischen Android-Smartphone, nimm die Einladung an und lade die App direkt aus dem Google Play Store herunter.

---

## 5. Google Play Data Safety & Store-Fragebögen
* Fülle den Data Safety Fragebogen anhand von `release/google-play/1.0.0-rc1/DATA_SAFETY.md` aus.
* Trage die Store-URLs ein:
  * **Datenschutzerklärung-URL**: `https://der-wegweiser.web.app/privacy.html`
  * **Account-Löschungs-URL**: `https://der-wegweiser.web.app/account-deletion.html`
* **Standort-Berechtigungen**: Da `ACCESS_BACKGROUND_LOCATION` entfernt wurde, ist **keine** gesonderte Hintergrund-Standorterklärung oder Video-Prüfung erforderlich.
