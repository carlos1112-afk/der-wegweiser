# Android Signing Architektur: Google Play Upload-Key & Play App Signing

Dieser Leitfaden dokumentiert die Release-Signatur-Architektur für **Der Wegweiser (Version 1.0)** gemäß den offiziellen Google Play App Signing Best Practices.

---

## 🏛️ 1. Signatur-Architektur: Trennung von Upload-Key & App-Signing-Key

Google Play trennt die Signatur in zwei unabhängige Sicherheitsstufen:

```
[ Lokaler Upload-Key (wegweiser-upload-key.p12) ]
                      ↓
  (Signiert das .aab Release-Bundle lokal)
                      ↓
[ Upload in die Google Play Console ]
                      ↓
[ Google Play App Signing (Cloud-geschützt bei Google) ]
                      ↓
  (Signiert finale APKs mit dem Google App-Signing-Key)
                      ↓
[ Auslieferung an Endnutzer via Play Store ]
```

### Die Vorteile dieser Architektur:
1. **Unersetzbarkeit entfällt**: Sollte der lokale Upload-Key jemals verloren gehen, kann Google Play über die Entwickler-Konsole einen neuen Upload-Key registrieren, ohne dass die App-ID oder bestehende Nutzer verloren gehen.
2. **Datenschutz**: Das lokale Zertifikat enthält keine privaten Anschriften.

---

## 🔑 2. Upload-Key Spezifikationen (Version 1.0)

* **Dateiname**: `credentials/wegweiser-upload-key.p12`
* **Format / Typ**: **PKCS#12** (`.p12`)
* **Schlüssel-Algorithmus**: **RSA 4096-Bit**
* **Schlüssel-Alias**: `wegweiser-upload-key`
* **Gültigkeit**: 10.000 Tage (~27 Jahre)
* **Zertifikats-Subject (Neutral)**: `CN=Der Wegweiser Android Upload Key, O=Der Wegweiser, C=DE` (Keine Privatadresse oder Mailadresse im Zertifikat)

### Fingerabdrücke des Upload-Keys (für Sideload & Upload-Prüfung):
* **SHA-256**: `61:69:23:60:E5:96:27:DC:75:7E:15:67:C9:7C:C9:62:ED:EC:1F:C1:1F:85:65:C7:46:42:CD:83:AD:03:CC:10`
* **SHA-1**: `88:CB:0D:62:3F:42:33:CD:5D:9F:7B:04:D4:34:67:07:08:CE:2B:79`

---

## ⚠️ 3. Wichtiger Unterschied bei SHA-Fingerabdrücken (Firebase & Google Auth)

> [!IMPORTANT]
> **Nicht verwechseln:**
> 1. **Upload-Key Fingerprint** (`88:CB:0D:...`): Gilt für lokale Entwicklungs-Builds und Sideloading.
> 2. **Play App Signing Fingerprint**: Gilt für die offizielle Store-Version. Diesen Fingerabdruck erzeugt Google Play nach dem ersten AAB-Upload unter:
>    * **Play Console &rarr; Release &rarr; Einrichtung &rarr; App-Integrität &rarr; App-Signaturschlüssel-Zertifikat**.
> 
> **Beide** SHA-1/SHA-256 Fingerabdrücke müssen in der **Firebase Console** hinterlegt sein, damit Google Sign-In sowohl in lokalen Test-Builds als auch im Play Store funktioniert!

---

## 🔒 4. Getrennte Aufbewahrung (Zero Passwords im Git-Projekt)

1. **Keystore-Datei**: Liegt in `credentials/wegweiser-upload-key.p12` (durch `.gitignore` geschützt).
2. **Passwort & Signing-Config**: Liegt **ausschließlich außerhalb** des Projekt-Repositories im Linux-Benutzerprofil:
   * Pfad: `~/.config/der-wegweiser/signing.properties` (Rechte: `chmod 600`)
3. **Passwort-Manager (KeePassXC / Bitwarden)**:
   * Lies das Passwort direkt aus `~/.config/der-wegweiser/signing.properties` aus und übertrage es in deinen KeePassXC-Tresor.
   * Sichere die Datei `credentials/wegweiser-upload-key.p12` als Dateianhang im Tresor oder auf einem verschlüsselten Offline-USB-Stick.

---

## ⚙️ 5. Gradle Release-Build

[`android/app/build.gradle`](file:///home/carlos/PROJEKTE/Der%20WEGWEISER/android/app/build.gradle) lädt die Zugangsdaten automatisch aus `~/.config/der-wegweiser/signing.properties` oder Umgebungsvariablen (`ANDROID_KEYSTORE_PASSWORD`).
