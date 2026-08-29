# MONETARISIERUNGS- & STORE-BILLING-MATRIX — DER WEGWEISER 1.0

Dieses Dokument klassifiziert alle wirtschaftlichen und monetarisierungsbezogenen Funktionen von **Der Wegweiser** zur Gewährleistung der vollständigen Konformität mit den **Google Play Developer Policies** und den **Apple App Store Review Guidelines**.

---

## 🏛️ 1. Grundsatz der Store-Billing-Richtlinien

* **Google Play Payments Policy**: Sämtliche digitalen Güter, digitalen Inhalte, In-App-Freischaltungen und virtuellen Währungen, die innerhalb der App genutzt werden, müssen zwingend über **Google Play In-App Billing** abgewickelt werden.
* **Apple App Store Guideline 3.1.1**: Sämtliche digitalen Freischaltungen und Abonnements müssen über **Apple In-App Purchase (IAP)** abgewickelt werden.
* **Physische Güter / Vor-Ort-Dienstleistungen (Guideline 3.1.5 / Google Play Ausnahme)**: Reale physische Produkte, reale Stromladungen vor Ort, Vor-Ort-Gastronomie (z. B. Café-Gutscheine) oder externe B2B-Dienstleistungen dürfen und müssen über externe Standard-Zahlungsmethoden (z. B. Stripe, PayPal, Barzahlung vor Ort) abgewickelt werden.

---

## 📊 2. Vollständige Leistungs- & Feature-Klassifikation

| Feature / Modul | Leistungsart | Store-Billing Pflicht? | Zulässiger Zahlungsweg | Rechtliche / Regulatorische Einordnung |
| :--- | :--- | :--- | :--- | :--- |
| **Wegweiser Tokens (In-App Währung)** | **Digital** (virtuelle Punkte) | **JA** (sofern direkt mit Echtgeld kaufbar) | Play Billing / Apple IAP | In v1.0 ausschließlich über In-App-Aktivitäten (Quests/Lounge) verdient; kein Direktkauf mit Echtgeld. |
| **Token-Pässe / Pro-Features** | **Digital** (Softwarefunktionen) | **JA** | Google Play Billing / Apple IAP | Digitale Softwarelizenz / In-App-Abo. |
| **BitLabs Offerwall / Surveys** | **Digital / Reale Marktforschung** | **NEIN** (Vergütete Teilnahme) | BitLabs SDK Reward Callback | Auszahlung erfolgt in internen Punkten/Tokens, kein Echtgeld-Verkauf an Nutzer. |
| **Charge 'n' Earn (Ladevergütung)** | **Physisch / Community-Infrastruktur** | **NEIN** | Community-Credits / Token-Ausschüttung | Belohnung für Bereitstellung physischer Ladeinfrastruktur. |
| **Partner-Gutscheine (z. B. Café/Bikeshop)** | **Physisch** (Einlösung vor Ort) | **NEIN** (Reales Gutscheingeschäft) | Einlösung vor Ort beim Drittanbieter | Vermittlung von Vor-Ort-Gutscheinen. Gilt als physische Leistung. |
| **B2B Gewerbe-Lizenzen (Flottenmanagement)** | **B2B Außerhalb der App** | **NEIN** (Enterprise-Vertrag) | Firmenrechnung / B2B Banküberweisung | Separater B2B-Vertrag für Unternehmen außerhalb des Endkunden-Stores. |

---

## 🔒 3. Store-Compliance Bestätigung für Version 1.0

* In **Version 1.0** sind **keine externen Checkout-Links (z. B. Stripe-Webseiten im WebView) für digitale In-App-Freischaltungen** eingebunden.
* Alle Belohnungen für Community-Aktivitäten (Ladeplatz meldet, Quests erfüllen) nutzen das interne Punktesystem ohne unzulässige Umgehung von Google Play Billing.
* Ein eventueller zukünftiger Echtgeld-Kauf von Pro-Funktionen wird in Version 1.1 nahtlos über das native `@capacitor-community/in-app-purchases` Modul angebunden.
