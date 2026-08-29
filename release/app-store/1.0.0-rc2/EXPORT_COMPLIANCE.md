# APPLE EXPORT COMPLIANCE & KRYPTOGRAFIE

---

## 🔒 1. Verwendete Kryptografie

* **Art der Verschlüsselung**: Standardmäßige Transportverschlüsselung (HTTPS / TLS 1.2+ über native WebKit/Network Frameworks) für Netzwerkabfragen an Firestore, Cloud-Proxies und Kartenserver.
* **Keine proprietären Verschlüsselungsalgorithmen**: Keine militärische oder maßgeschneiderte Eigenkryptografie implementiert.

---

## 📋 2. Deklaration in App Store Connect & Info.plist

* **Info.plist Key**:
  ```xml
  <key>ITSAppUsesNonExemptEncryption</key>
  <false/>
  ```
* **Status**:
  👉 **SOURCE-SEITIG PLAUSIBEL – FINALER ARCHIVE/DEPENDENCY CHECK AUSSTEHEND**  
  Die Deklaration basiert auf den aktuellen Source-Dependencies. Der finale Nachweis wird beim Erzeugen des Xcode-Release-Archivs auf macOS verifiziert.
