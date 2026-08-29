# Rechtliche Grundsatzerklärung: Alleiniges Eigentum, Datenbankherstellerrecht & Schutz von Geschäftsgeheimnissen

**Projekt:** Der Wegweiser (Autonomous E-Bike Navigation & Co-Pilot)  
**Rechtsinhaber & Diensteanbieter:** Pascal Gregor (nachfolgend: *"Rechtsinhaber"* / *"Diensteanbieter"*)  
**Anschrift:** Lindenstraße 8, 02979 Spreetal | **E-Mail:** wegweiser-app@proton.me  
**Stand:** 29. August 2026  
**Rechtsgrundlagen:** §§ 87a ff. Urheberrechtsgesetz (UrhG), Geschäftsgeheimnisgesetz (GeschGehG), EU-Richtlinie 2016/943, Datenschutz-Grundverordnung (DSGVO Art. 5 Abs. 1 lit. b, Art. 6 Abs. 1 lit. f).

---

## 1. Gesetzliches Datenbankherstellerrecht (§§ 87a ff. UrhG)
1. **Erhebliche Investition**: Die Beschaffung, Überprüfung, Strukturierung, topographische Kalibrierung und Aggregation der navigationsabhängigen Daten (u. a. Steigungsgradienten, E-Bike Verbrauchskurven, Windwiderstandsmodelle, Ladeinfrastruktur, Schlauchautomaten und Offline-Korridore) erfordert eine nach Art und Umfang wesentliche finanzielle, personelle und technische Investition im Sinne von **§ 87a Abs. 1 UrhG**.
2. **Ausschließliches Recht des Diensteanbieters**: Der Rechtsinhaber (Pascal Gregor) ist der alleinige **Hersteller der Datenbank**. Ihm steht nach **§ 87b UrhG** das ausschließliche Recht zu, die Datenbank im Ganzen oder in einem nach Art oder Umfang wesentlichen Teil zu vervielfältigen, zu verbreiten und öffentlich wiederzugeben.
3. **Verbot unbefugter Entnahme**: Die systematische Entnahme oder Weiterverwendung von Daten, das Data-Mining, Scraping oder Reverse-Engineering durch Dritte ohne vorherige schriftliche Zustimmung des Diensteanbieters ist strengstens untersagt und begründet Unterlassungs- und Schadensersatzansprüche nach § 97 UrhG.

---

## 2. Urheberrechte, Datenbankherstellerrecht & Nutzungsrechte
1. **Proprietäre Datenbank nach § 87a UrhG**: Zu den nach § 87a UrhG geschützten Inhalten der aggregierten Datenbank des Diensteanbieters zählen:
   * Sämtliche kuratierten Streckengraphen, Höhenprofile und Steigungs-Farbsegmente,
   * Sämtliche mathematischen E-Bike Verbrauchs- und Reichweiten-Prädiktionsmodelle (Wh/km-Algorithmen),
   * Sämtliche aggregierten Telemetriedaten (Watt, Trittfrequenz, Motorunterstützung, Rollwiderstände),
   * Sämtliche Ladesäulen-Verifizierungen, Öffnungszeiten-Kalibrierungen, Stecker-Typologisierungen und Community-Bewertungen,
   * Sämtliche KI-Antizipationsparameter und probabilistische "Heute-Tour"-Muster.
2. **Nutzungsrechte der Community-Beiträge**: Soweit Nutzer Wegezustände, Quests oder Bewertungen übermitteln, räumen sie dem Diensteanbieter ein einfaches, unentgeltliches, räumlich und zeitlich unbeschränktes Nutzungsrecht zur dauerhaften Integration in die Datenbank ein. Nutzer erwerben kein Miteigentum an der Gesamtdatenbank.

---

## 3. Schutz als Geschäftsgeheimnis (GeschGehG & EU-Richtlinie 2016/943)
1. **Geheimhaltungsstatus**: Die interne Zusammensetzung der Routing-Gewichtungen, Rohdatenbanken, Korridorberechnungen und Telemetriekalibrierungen ist nicht allgemein bekannt oder ohne weiteres zugänglich, besitzt einen erheblichen wirtschaftlichen Wert und wird durch angemessene technische Schutzmaßnahmen (Verschlüsselung, Zugriffskontrollen, isolierte lokale Betreiber-Werkzeuge) geheim gehalten (**§ 2 Nr. 1 GeschGehG**).
2. **Rechtsfolgen bei Verletzung**: Die unbefugte Erlangung, Nutzung oder Offenlegung dieser Geschäftsgeheimnisse stellt eine rechtswidrige Handlung nach § 4 GeschGehG dar und wird zivil- und strafrechtlich verfolgt.

---

## 4. Datenschutzrechtliche Einordnung (DSGVO) & Rechtsnachfolge
1. **Pseudonymisierte personenbezogene Daten (Art. 4 Nr. 1 DSGVO)**: GPS-Rohdaten und Tourenverläufe werden als pseudonymisierte personenbezogene Daten behandelt. Nutzer haben das Recht auf Datenübertragbarkeit (Art. 20 DSGVO) und Löschung (Art. 17 DSGVO).
2. **Aggregierte Vektoren**: Sobald Einzelpunkte zu allgemeinen Straßenattributen (z. B. "Steigung 8% auf Segment X", "Belag Schotter") aggregiert werden, entfällt der Personenbezug. Diese aggregierten Vektorattribute bilden den Kern der geschützten Datenbank nach § 87a UrhG.
3. **Zukunftssichere Rechtsinhaberschaft**: Rechtsinhaber und Diensteanbieter ist Pascal Gregor. Der Übergang in ein vom selben Inhaber betriebenes Einzelunternehmen führt grundsätzlich nicht zu einem Wechsel der natürlichen Person als Rechtsträger. Änderungen von Verarbeitungszwecken, Vertragsbedingungen oder Geschäftsmodell sind davon unabhängig gesondert zu prüfen. Eine spätere Übertragung auf eine eigenständige juristische Person (z. B. UG oder GmbH) erfolgt unter Einhaltung eines gesonderten, transparenten Verantwortlichenwechsels gem. DSGVO.

---

## 5. Berechtigung zu Datenbank-Neustrukturierung & Wiederaufbau
1. **Volle administrative Hoheit**: Der Diensteanbieter ist jederzeit berechtigt:
   * Die Online-Cloud-Datenbank (Firestore/GCP) ganz oder teilweise zu löschen, zu bereinigen oder neu zu initialisieren,
   * Gesicherte Master-Dumps über autorisierte lokale Betreiber-Werkzeuge oder Speicherarchive wieder einzuspielen,
   * Datenbankschemata und Speicherarchitekturen nach eigenem Ermessen zu migrieren oder neu aufzubauen.
2. **Rechtssicherheit bei Re-Builds**: Ein Neuaufbau oder eine Re-Initialisierung der Datenbank berührt weder die bestehenden Schutzrechte nach § 87a UrhG noch die Nutzungsrechte an den zugrundeliegenden aggregierten Daten.

---

## 6. Strikte Zweckbindung & Garantierter Ausschluss des Verkaufs von Nutzerdaten (No-Sale Policy)
1. **Exklusive Datenübermittlung**: Der Nutzer übermittelt anfallende Navigations- und Telemetriedaten ausschließlich und direkt an den Diensteanbieter persönlich (Pascal Gregor).
2. **Strikte Zweckbindung (Art. 5 Abs. 1 lit. b DSGVO)**: Die Verarbeitung aller übermittelten Daten ist strengstens und ausnahmslos auf den Betrieb, die Qualitätssicherung, die Reichweitenberechnung und die Kernfunktionen der App "Der Wegweiser" beschränkt.
3. **Kategorischer Ausschluss des Datenverkaufs**: Ein Verkauf, eine Veräußerung, Lizenzierung an Datenhändler (Data Brokers), die Vermarktung von Bewegungsprofilen an Dritte oder die kommerzielle Weitergabe von Nutzerdaten an Werbenetzwerke oder externe Datenaufkäufer ist von vornherein und für alle Zeiten vertraglich und datenschutzrechtlich ausgeschlossen. Kommerzielle Kaufangebote Dritter bezüglich Nutzer- oder Telemetriedaten werden kategorisch abgewiesen.

---

**Pascal Gregor — Der Wegweiser**  
*Ausschließlicher Rechteinhaber & Datenbankhersteller*
