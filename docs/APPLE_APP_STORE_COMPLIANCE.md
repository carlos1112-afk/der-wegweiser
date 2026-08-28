# Apple App Store Compliance & Review Guide — Der Wegweiser

Dieses Dokument beschreibt alle erfüllten Richtlinien und Vorbereitungen für die Einreichung von **"Der Wegweiser"** in den **Apple App Store** gemäß den *App Store Review Guidelines*.

---

## 1. Übersicht der Apple-Richtlinien & Implementierung

| Apple Guideline | Anforderung | Implementierung in Der Wegweiser |
|---|---|---|
| **2.5.4 Background Modes** | Berechtigung für Hintergrund-Dienste | `location`, `audio`, `bluetooth-central` in `Info.plist` konfiguriert für unterbrechungsfreie Navigation & Sprachführung bei Display-Standby. |
| **5.1.1 Data Collection** | Datenschutzerklärung & Zweckbindung | Vollständige DSGVO-Datenschutzerklärung in `docs/PRIVACY_POLICY.md` und In-App Menü. |
| **5.1.1(v) Account Deletion** | 1-Klick Daten- & Kontolöschung | In-App Datenschutz-Cockpit (`LegalModal.tsx -> Daten löschen -> Konto & Daten löschen`) mit vollständiger Bereinigung. |
| **5.1.2 Privacy Manifest** | Apple Privacy Manifest (ab Mai 2024 Pflicht) | `ios/App/App/PrivacyInfo.xcprivacy` mit deklarierten API-Zugriffsgründen (`UserDefaults CA92.1`, `SystemBootTime 35F9.1`, `FileTimestamp C617.1`). |
| **3.1.1 In-App Purchases** | Digitale Güter & In-App Tokens | In-App Tokens und Gamification-Belohnungen werden über standardmäßige StoreKit-Workflows abgewickelt. B2B-Partner-Rechnungen für Ladestationen-Betreiber erfolgen extern. |
| **5.1.2 App Tracking (ATT)** | `AppTrackingTransparency` | `NSUserTrackingUsageDescription` in `Info.plist` hinterlegt; Opt-In Consent Dialog vor Anforderung von Werbe-IDs. |

---

## 2. Hinweis für das Apple Review Team (App Review Notes)

Beim Einreichen der App in App Store Connect bitte folgenden Text im Feld **"Notes for Reviewer"** hinterlegen:

```text
Sehr geehrtes Apple Review Team,

"Der Wegweiser" ist eine spezialisierte Navigations- und Telemetrie-App für E-Bikes.

1. Hintergrund-Standortnutzung (location):
Die App verwendet die Hintergrund-Standorterfassung, um dem Fahrradfahrer während der Fahrt über Kopfhörer Turn-by-Turn Sprachanweisungen zu geben und gefahrene GPX-Tracks aufzuzeichnen, wenn das iPhone in der Lenkertasche/Hosentasche verstaut ist.

2. Bluetooth Low Energy (bluetooth-central):
Die App verbindet sich über BLE mit Standard-Fahrradsensoren (Trittfrequenz, Geschwindigkeit) sowie E-Bike Systemen (z. B. Bosch Smart System BES3), um den Akkustand und die Motorleistung anzuzeigen.

3. Test-Account / Demo-Modus:
Für die Überprüfung ist kein fester Login erforderlich. Die App startet sofort mit vorinstallierten, kuratierten Routen und Ladesäulen.
```

---

## 3. Privacy Nutrition Labels für App Store Connect

Bei der Beantwortung des Datenschutz-Fragebogens in App Store Connect:

1. **Standort (Location)**:
   * *Genaue Standortdaten (Precise Location)*: Ja -> Zur App-Funktionalität (Navigation).
   * *Verknüpfung mit Nutzer-Identität*: Nein.
   * *Für Tracking-Zwecke*: Nein.
2. **Nutzungsdaten & Diagnose**:
   * *Leistungsdaten (Performance Data / Crash Logs)*: Ja -> Zur Fehlerbehebung & Optimierung.
3. **Tracking**:
   * *Werden Nutzer über Drittanbieter-Apps getrackt*: Nein (Standard Opt-Out).
