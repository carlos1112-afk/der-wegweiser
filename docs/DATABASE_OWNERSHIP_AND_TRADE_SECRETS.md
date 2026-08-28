# Rechtliche Grundsatzerklärung: Alleiniges Eigentum, Datenbankherstellerrecht & Schutz von Geschäftsgeheimnissen

**Projekt:** Der Wegweiser (Autonomous E-Bike Navigation & Co-Pilot)  
**Rechtsinhaber & Betreiber:** Carlos (nachfolgend: *"Rechtsinhaber"* / *"Betreiber"*)  
**Stand:** 28. August 2026  
**Rechtsgrundlagen:** §§ 87a ff. Urheberrechtsgesetz (UrhG), Geschäftsgeheimnisgesetz (GeschGehG), EU-Richtlinie 2016/943, Datenschutz-Grundverordnung (DSGVO Art. 6 Abs. 1 lit. f).

---

## 1. Gesetzliches Datenbankherstellerrecht (§§ 87a ff. UrhG)
1. **Erhebliche Investition**: Die Beschaffung, Überprüfung, Strukturierung, topographische Kalibrierung und Aggregation der navigationsabhängigen Daten (u. a. Steigungsgradienten, E-Bike Verbrauchskurven, Windwiderstandsmodelle, Ladeinfrastruktur, Schlauchautomaten und Offline-Korridore) erfordert eine nach Art und Umfang wesentliche finanzielle, personelle und technische Investition im Sinne von **§ 87a Abs. 1 UrhG**.
2. **Ausschließliches Recht des Betreibers**: Der Rechtsinhaber ist der alleinige **Hersteller der Datenbank**. Ihm steht nach **§ 87b UrhG** das ausschließliche Recht zu, die Datenbank im Ganzen oder in einem nach Art oder Umfang wesentlichen Teil zu vervielfältigen, zu verbreiten und öffentlich wiederzugeben.
3. **Verbot unbefugter Entnahme**: Die systematische Entnahme oder Weiterverwendung von Daten, das Data-Mining, Scraping oder Reverse-Engineering durch Dritte ohne vorherige schriftliche Zustimmung des Betreibers ist strengstens untersagt und begründet Unterlassungs- und Schadensersatzansprüche nach § 97 UrhG.

---

## 2. Alleiniges Eigentum an navigationsabhängigen Daten
1. **Umfang der proprietären Daten**: Zu den proprietären, navigationsabhängigen Daten des Betreibers zählen zu jedem Zeitpunkt und ohne Einschränkung:
   * Sämtliche kuratierten Streckengraphen, Höhenprofile und Steigungs-Farbsegmente,
   * Sämtliche mathematischen E-Bike Verbrauchs- und Reichweiten-Prädiktionsmodelle (Wh/km-Algorithmen),
   * Sämtliche aggregierten anonymisierten Telemetriedaten (Watt, Trittfrequenz, Motorunterstützung, Rollwiderstände),
   * Sämtliche Ladesäulen-Verifizierungen, Öffnungszeiten-Kalibrierungen, Stecker-Typologisierungen und Community-Bewertungen,
   * Sämtliche KI-Antizipationsparameter und probabilistische "Heute-Tour"-Muster.
2. **Ausschluss fremder Eigentumsansprüche**: Nutzer, Partner oder Drittplattformen erwerben durch die Nutzung der App oder die Eingabe von Daten keinerlei Eigentums- oder Verwertungsrechte an der Datenbank oder den aggregierten Navigationsmodellen.

---

## 3. Schutz als Geschäftsgeheimnis (GeschGehG & EU-Richtlinie 2016/943)
1. **Geheimhaltungsstatus**: Die interne Zusammensetzung der Routing-Gewichtungen, Rohdatenbanken, Korridorberechnungen und Telemetriekalibrierungen ist nicht allgemein bekannt oder ohne weiteres zugänglich, besitzt einen erheblichen wirtschaftlichen Wert und wird durch angemessene technische Schutzmaßnahmen (Verschlüsselung, Zugriffskontrollen, Backdoor-Absicherung) geheim gehalten (**§ 2 Nr. 1 GeschGehG**).
2. **Rechtsfolgen bei Verletzung**: Die unbefugte Erlangung, Nutzung oder Offenlegung dieser Geschäftsgeheimnisse stellt eine rechtswidrige Handlung nach § 4 GeschGehG dar und wird zivil- und strafrechtlich verfolgt.

---

## 4. Klare Abgrenzung zu personenbezogenen Daten (DSGVO)
1. **Personenbezogene Daten (Art. 4 Nr. 1 DSGVO)**: Personenbezogene Nutzerdaten (z. B. lokale Kontoeinstellungen, individuelle Favoriten) unterliegen dem Schutz der DSGVO. Nutzer haben das Recht auf Datenübertragbarkeit (Art. 20 DSGVO) und Löschung (Art. 17 DSGVO).
2. **Anonymisierte Navigations- & Streckendaten**: Sobald Telemetrie- und Routeninformationen anonymisiert oder mit der Gesamtkarte fusioniert werden, verlieren sie den Personenbezug. Sie sind und bleiben uneingeschränktes Eigentum des Betreibers und sind von Nutzerlöschungsanträgen unberührt.

---

## 5. Berechtigung zu Datenbank-Neustrukturierung & Wiederaufbau
1. **Volle administrative Hoheit**: Der Betreiber ist jederzeit berechtigt:
   * Die Online-Cloud-Datenbank (Firestore/GCP) ganz oder teilweise zu löschen, zu bereinigen oder neu zu initialisieren,
   * Gesicherte Master-Dumps über autorisierte Backdoors oder Speicherarchive wieder einzuspielen,
   * Datenbankschemata und Speicherarchitekturen nach eigenem Ermessen zu migrieren oder neu aufzubauen.
2. **Rechtssicherheit bei Re-Builds**: Ein Neuaufbau oder eine Re-Initialisierung der Datenbank berührt weder die bestehenden Schutzrechte noch die Eigentumsverhältnisse an den zugrundeliegenden Daten.

---

**Carlos — Der Wegweiser**  
*Ausschließlicher Rechteinhaber & Datenbankhersteller*
