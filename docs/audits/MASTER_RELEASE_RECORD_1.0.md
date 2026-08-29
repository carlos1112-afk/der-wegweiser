# MASTER RELEASE RECORD — DER WEGWEISER 1.0 (RC1)

**Datum**: 2026-08-29  
**Git Commit**: `46fe9ac6ce1cb14104870b332f4aef88a4e8504a`  
**Status**: `ANDROID RC1 TARGET SDK 36 VERIFIZIERT`

---

## 📦 1. Produktions-Artefakte

| Artefakt | Pfad | Dateigröße | SHA-256 Checksumme |
| :--- | :--- | :--- | :--- |
| **Android App Bundle (.aab)** | `android/app/build/outputs/bundle/release/app-release.aab` | 4,6 MiB (4.765.811 B) | `0558d6e55b686513e85f8571d82eab140c9efb8ad4099fc67254ea1f5a79adf3` |
| **Android Release APK (.apk)** | `android/app/build/outputs/apk/release/app-release.apk` | 4,8 MiB (4.981.670 B) | `26b73a48e77a16e7921a97d76ecff2685799a4c0eb3b118b625ca4e5be495fef` |

### Versions- & SDK-Identifikation:
* **Application ID**: `app.derwegweiser.navi`
* **Version Name**: `1.0.0`
* **Version Code**: `1`
* **Compile SDK**: `36` (Android 16)
* **Target SDK**: `36` (Android 16 — Google Play Store konform ab 31.08.2026)
* **Min SDK**: `24` (Android 7.0+)

---

## 🔑 2. Signatur-Verifikation (`keytool -printcert -jarfile`)

Die Signatur des erzeugten `.aab` wurde direkt am Binärartefakt verifiziert:

* **Zertifikats-Subject**: `CN=Der Wegweiser Android Upload Key, O=Der Wegweiser, C=DE`
* **Zertifikats-Aussteller**: `CN=Der Wegweiser Android Upload Key, O=Der Wegweiser, C=DE`
* **Schlüsseltyp**: 4096-Bit RSA
* **Signatur-Algorithmus**: `SHA256withRSA`
* **Upload-Key SHA-256**: `61:69:23:60:E5:96:27:DC:75:7E:15:67:C9:7C:C9:62:ED:EC:1F:C1:1F:85:65:C7:46:42:CD:83:AD:03:CC:10`
* **Upload-Key SHA-1**: `88:CB:0D:62:3F:42:33:CD:5D:9F:7B:04:D4:34:67:07:08:CE:2B:79`
* **Datenschutz**: Keine Privatadresse oder Mailadresse im Zertifikat.
* **Geheimhaltung**: Passwörter liegen ausschließlich in `~/.config/der-wegweiser/signing.properties` (chmod 600) und im Benutzer-Passworttresor. Zero Passwords im Repository.
