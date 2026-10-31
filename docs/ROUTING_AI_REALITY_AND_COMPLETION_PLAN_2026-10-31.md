# KI-Routenplanung: Ist-Stand und ehrlicher Integrationsplan

Stand: 31.10.2026
Geltungsbereich: Routing-Worktree `codex/routing-implementation-20261027`
Produktregel: Die kostenlose Routengenerierung bleibt weitgehend unpersonalisiert. Sie darf den Flachheitswunsch und ausdrücklich benannte Zwischenstopps berücksichtigen. Weitere Vorlieben, Freitextwünsche und Verhaltenspersonalisierung gehören in Premium.

## 1. Kurzbefund

[FAKT] Die aktuell erreichbare Standardroute ist keine KI-generierte Geometrie. Sie wird über BRouter berechnet. Die App ruft dafür den Standardpfad im `FreeRouteService` auf. Die Premiumroute wird in der Routing-Service-Schicht ausdrücklich als nicht verfügbar abgewiesen.

[FAKT] Im Code gibt es KI-Textdienste, einen alten Routengenerierungsversuch und generische Provideradapter. Der alte Versuch ruft zunächst `RoutingService.generateBikeRoute()` auf, das sofort mit `PREMIUM_UNAVAILABLE` abbricht. Für diese Methode wurde im Anwendungscode kein produktiver Aufrufer gefunden. Die Textbeschreibung nach einer Route wählt oder berechnet keine Streckengeometrie.

[FAKT] Die sichtbaren Einstiege sind nicht durchgängig verbunden: „Heute-Route“ leitet zur nicht verfügbaren Regenerierung weiter; die Karte bietet BRouter-Standardrouting und zeigt KI/Offline als nicht verfügbar. Der Advanced Planner ist im aktuellen uncommitteten Stand ein Status-/Sperrbildschirm. Die Funktion zum Zielpunkt kann dagegen eine Standard-BRouter-Route anfordern und vor der Vorschau lokal archivieren.

[SCHLUSS] Es gibt derzeit keine vollständige, in der App erreichbare Premium-KI-Routenplanung. Es gibt einen funktionierenden Standard-Routingpfad, einen generischen KI-Textpfad und nicht produktiv integrierte Routing-/Wallet-/Archivbausteine. Diese dürfen nicht als ein bereits funktionierendes KI-Routingsystem dargestellt werden.

## 2. Was die kostenlose Route tatsächlich berücksichtigt

Der Standardpfad nimmt derzeit Start, Ziel und verpflichtende Stopps an. Das Backend validiert die Punkte und lässt BRouter die Route berechnen. Im aktuellen uncommitteten Worktree wird bei einem positiven Flachheitsgewicht eine begrenzte zusätzliche BRouter-Alternative angefragt und nach bekannter Steigung verglichen; die alternative Strecke darf höchstens 10 % länger sein. Die Auswahl stützt sich auf BRouter-Felder wie `filtered ascend` und `total-time`; Energieverbrauch bleibt unbekannt.

| Merkmal | Aktueller Befund | Sollgrenze Free |
|---|---|---|
| Start und Ziel | Werden für Routing benötigt | Erlaubt |
| Ausdrücklich gesetzte Zwischenstopps | Backend-Vertrag kann bis zu fünf; UI/Service bildet derzeit höchstens einen optionalen Via-Punkt ab und die sichtbaren Planer bieten ihn nicht zuverlässig an | Erlaubt, nach ausdrücklicher Auswahl |
| Flachheitswunsch | Aktueller Code kann eine zusätzliche BRouter-Alternative anhand bekannter Steigung auswählen | Erlaubt; nur bei belastbaren Höhenwerten, sonst als unbekannt ausweisen |
| Oberfläche/Asphalt-Natur-Gewichte | Aktueller Service überträgt Profil-/Gewichtungswerte in den Standardrequest; Backend gibt für diese Kriterien unbekannte Bewertung zurück und benutzt sie nicht zur Routenoptimierung | Darf Free-Request nicht erreichen; Premium-only |
| Akku/Kapazität/Fahrradprofil | Werden derzeit teilweise im allgemeinen Request geführt, sind keine wirksame Standardoptimierung | Premium-only; im Free-Pfad weglassen |
| Freitextwünsche/Interessen | Allgemeine Verträge und KI-Textdienste kennen solche Felder; Free-Backend wertet sie nicht als Route aus | Premium-only; niemals still als erfüllt darstellen |
| Verhalten/Gedächtnis/Verlauf | Keine nachgewiesene personalisierte Routenbewertung aus Fahrhistorie im aktiven Standardpfad | Premium-only und nur mit transparenter Einwilligung |

[RISIKO] Dass ein Feld aktuell serverseitig ignoriert wird, macht seine Übertragung nicht harmlos: Es verwischt die Tarifgrenze, kann private Nutzerdaten offenlegen und lässt die Oberfläche eine Wirkung vermuten, die nicht stattfindet. Für Free müssen solche Daten vor dem Request entfernt werden; serverseitig soll der Vertrag unerlaubte Felder ablehnen oder kontrolliert normalisieren.

## 3. KI- und Abhängigkeitsbestand

| Bereich | Realer Ist-Stand | Konflikt / notwendige Auflösung |
|---|---|---|
| Routenberechnung | BRouter berechnet Geometrie; Standard-Backend ist aktiv. `vertexRouting.ts` ist ein geschlossener Legacy-Stub. | BRouter bleibt Geometriequelle. Ein Modell darf keine erfundene Geometrie als Route ausgeben. |
| Premiumrouting | `generateBikeRoute()` und `planning: 'ai'` brechen mit nicht verfügbar ab; `RouteCoordinator` lehnt KI-Planung ebenfalls ab. | Ein verbindlicher serverseitiger Premium-Jobpfad muss erst gebaut und kontrolliert freigeschaltet werden. |
| Allgemeine KI | `AiGatewayService` unterstützt mehrere generische Adapter. Es kann Texte erzeugen; die Routenbeschreibung wählt keine Streckenvariante. | Route-spezifische Planung muss einen serverseitigen, strukturierten und fest konfigurierten Provider nutzen, getrennt von frei konfigurierbarer Client-KI. |
| Modellkonfiguration | Client und `aiProxy` verwenden als Standard alte Gemini-Modellnamen (`gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro`). | Firebase dokumentiert die Abschaltung von Gemini 2.0 Flash/Flash Lite zum 01.06.2026 und frühere Abschaltungen von Gemini 1.5. Der konfigurierte Default ist damit überholt; Environment-Overrides und Live-Verfügbarkeit wurden nicht geprüft. Vor jeder Aktivierung Modell-ID, Region, SDK, Berechtigungen und Kosten mit offiziellen aktuellen Quellen und einem minimalen Integrationstest verifizieren. |
| Fallback | Bei Providerfehlern kann `planRoute()` einen fest vorgegebenen Routentext zurückgeben; der Offline-Heuristikadapter wirft Fehler. | Ein Fallbacktext darf nicht als KI-generierte oder erfolgreich berechnete Route erscheinen. Bei Modell-/Routerfehlern muss der Job fehlschlagen, keine Route freigeben und Reservierungen erstatten. |
| Fähigkeiten/UI | Backend-Capabilities existieren, aber die Frontend-Verwendung wurde nicht gefunden; UI-Zustände sind teilweise fest verdrahtet. | Ein Capability-Vertrag muss App, Backend und Tarifstatus steuern. Premium bleibt aus, bis Provider, Router, Archiv, Wallet und UI gemeinsam bereit sind. |
| Vertrag | Gemeinsame Verträge mischen Standard und Premium: Profile, Interessen, Hard-Kriterien, Wünsche, Gewichte und Akku. | Versionierte diskriminierte Free-/Premium-Requests. Free erlaubt nur Start/Ziel, explizite Stopps und Flachheit. Premium erhält nur bewusst bestätigte Optionen. |
| Routenkoordination | `RouteCoordinator` ist nicht der aktive App-Einstieg; die App ruft Dienste direkt auf. | Genau ein Anwendungs-Entry-Point für Planung, Status, Archiv und Fehlerbehandlung; alle Einstiege darauf umstellen. |
| Geld/Token | Wallet-Ledger enthält Transaktionsprimitive für Reserve/Capture/Release. Route-spezifische Quotes, Jobs, Idempotenz und Verknüpfung zur Route wurden nicht gefunden. | Premium-Quote und Einwilligung, idempotente Reservierung, Jobstatus, Capture nur nach erfolgreicher dauerhafter Speicherung, Release bei Fehler/Abbruch. |
| Archiv | `RouteArchiveService` speichert lokal in IndexedDB. Kein serverseitiges Premium-Routenarchiv wurde festgestellt. | Jede erzeugte valide Variante vor „fertig“ serverseitig dauerhaft speichern; lokale Kopie synchronisieren. Historie gefahrener Routen bleibt getrennt von generierten/ungefahrenen Routen. |
| Tests/Belege | Es gibt synthetische Backendtests; kein echter BRouter-Aufruf oder produktiver Providerlauf wurde in dieser Bestandsaufnahme ausgeführt. | Fixtures aus gepinnter BRouter-Version plus begrenzter Integrationsnachweis in freigegebener Umgebung; diese dürfen nicht durch Mocktests ersetzt werden. |

Quellen zur Modelllebensdauer: [Firebase AI Logic: unterstützte Modelle](https://firebase.google.com/docs/ai-logic/models?api=dev), [Firebase AI Logic: FAQ und Fehlerbehebung](https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting?authuser=610&hl=en). Die konkrete Live-Konfiguration des Projekts wurde nicht abgefragt.

## 4. Zielverhalten und Tarifgrenze

### Kostenlos

- Routingparameter: bestätigter Start, Ziel, ausdrücklich ausgewählte Zwischenstopps und Flachheitswunsch.
- Keine Oberflächen-/Landschaftspräferenz, Interessen, Freitextwünsche, Akkuoptimierung, Verhaltensprofile, Verlaufsableitung oder automatische Personalisierung im Request.
- Mehrere ausdrücklich gewählte Stopps bleiben als Wegpunkte erhalten; Backend validiert Reihenfolge, Anzahl, Koordinaten und Erreichbarkeit.
- Flachheit wird nur versprochen, wenn die verwendeten Höhen-/Steigungsdaten belastbar sind. Fehlen Werte, wird die Einschränkung verständlich angezeigt; keine erfundene Flachheitsgarantie.
- Free-Routen bleiben ohne Wallet-/Premium-Abhängigkeit und werden vor Anzeige lokal gespeichert. Jede gültige generierte Alternative wird archiviert.

### Premium

- Zusätzliche strukturierte Vorlieben und Wünsche aus einer expliziten UI-Auswahl; Freitext nur nach Vorschau und Einwilligung.
- Verhaltensdaten nur, wenn der Nutzer die Personalisierung aktiviert und Datengrundlage, Wirkung und Löschmöglichkeit erklärt wurden.
- KI liefert einen strukturierten Vorschlag bzw. eine Rangfolge von Kandidaten und begründet die Auswahl anhand überprüfbarer Merkmale. BRouter/Graph berechnet die tatsächliche Linienführung.
- Harte Grenzen (gesperrt/unerreichbar, erlaubte Profile, bestätigte Stopps, Reichweite/Sicherheitsvorgaben) haben Vorrang vor weichen Vorlieben. Nutzerwünsche dürfen nicht stillschweigend als erfüllt markiert werden.
- Modell-Ausfall, fehlende Kartendaten oder ungültige Antwort ergeben einen klaren Fehler oder eine ausdrücklich als nicht-personalisiert markierte Standardroute; nie eine scheinbar erfolgreiche KI-Route.

## 5. Implementierungsplan

### Phase 0 – Schnittstellen und Betriebsannahmen festnageln

1. Tatsächlich deployte Functions, Firebase-Projekt/Region (ohne Geheimnisse auszugeben), App-Check/Auth, BRouter-Endpoint und Routingprofil ermitteln.
2. Gepinnte BRouter-Version und Rückgabeformat gegen echte repräsentative Antworten verifizieren, besonders Höhenprofil, `filtered ascend`, Dauer, Alternativen und Wegpunkte.
3. Aktuelle Firebase-AI-SDK-/Modellunterstützung für die geplante Region prüfen; Budget-/Timeout-/Rate-Grenzen definieren. Erst nach Code- und Umgebungsabgleich Modelle auswählen.
4. Kostenlose und Premium-Feldmatrix verbindlich festhalten; unbekannte/veraltete Daten als „unbekannt“ modellieren.

**Abnahme:** Dokumentierter Laufzeitgraph und ein belastbarer Capability-Status je Umgebung; keine stillschweigende Aktivierung durch Client-Konfiguration.

### Phase 1 – Vertragsgrenze durchsetzen

1. Versionierte, getrennte Schemas einführen: `StandardRouteRequest` enthält nur Start, Ziel, benannte Wegpunkte, `flatness` und nötige technische Request-Metadaten. `PremiumRouteRequest` enthält zusätzliche, typisierte Präferenzen mit Einwilligungs-/Herkunftsmetadaten.
2. Free-Service so umbauen, dass er keine Profil-, Akku-, Interessen-, Freitext- oder Gewichtsobjekte liest oder sendet. API-Tests sichern diese Datenminimierung.
3. Alte Request-Versionen kontrolliert behandeln: kein stiller Premium-Feld-Durchlass in Standard; kompatible Normalisierung nur mit expliziter Versionsregel, sonst klare Ablehnung mit Migrationstext.
4. Via-Steps in Free-UI vollständig einführen (Hinzufügen, Entfernen, Reihenfolge, Kartenbestätigung, Limit-/Validierungsfeedback) und bis zum Backend unverändert übertragen.
5. Backend erzwingt dieselbe Feldmatrix und sendet in Capabilities Tarif-/Funktionsstatus zurück.

**Abnahme:** Nachweis, dass Änderungen an Oberfläche, Freitext, Interessen, Akku und Historie eine Free-Route nicht verändern und nicht an den Free-Endpunkt gesendet werden; Stopps und Flachheit dagegen wirksam sind.

### Phase 2 – Ein Planungsweg und verlässliche Standardroute

1. `RouteCoordinator` als einzigen App-Planungseinstieg vervollständigen oder entfernen; Zielpunkt, Heute-Route, Kartenplanung, Regenerierung und Advanced UI daran anschließen.
2. UI-Optionen aus Capability-Daten bilden. Premium-Schaltflächen bis zur echten End-to-End-Bereitschaft deaktiviert/erklärend halten.
3. BRouter-Kandidaten nur bei verfügbarer, aussagekräftiger Höhenmetrik hinsichtlich Flachheit vergleichen. Umweggrenze und Rückmeldung in Tests und UI transparent festlegen.
4. Kandidaten vor Rückgabe validieren: Start/Ziel/Stoppreihenfolge, Geometrie, Distanzgrenzen, Profil, Dubletten. Unbekannte Kriterien explizit als unbekannt behandeln.
5. Jede gültige generierte Route sofort archivieren, bevor Vorschau/Erfolg gemeldet wird. Keine Route durch eine Folgegenerierung überschreiben.

**Abnahme:** Jeder App-Einstieg nutzt denselben Ablauf; fehlende Capability ergibt verständlichen Zustand; jede gültige Free-Route und Alternative ist nach Reload in der Route-Historie vorhanden.

### Phase 3 – Premium-Kandidatenplanung statt Modell-Geometrie

1. Nur serverseitigen Route-Job-Endpunkt mit Auth, App Check, Quoten, Schema-Validierung und fester Modell-/Providerkonfiguration bereitstellen.
2. Premium-UI fragt zusätzliche Optionen strukturiert ab; Freitext wird separat angezeigt, vor Verwendung bestätigt und in Umfang/Zweck begrenzt.
3. Präferenzkatalog und Scoring versionieren. Reihenfolge: Sicherheit/Erreichbarkeit und explizite harte Bedingungen, bestätigte Stopps, gewählte Hauptpräferenz, weitere Premium-Vorlieben. Pareto-/Gewichtung so erklären, dass Trade-offs nachvollziehbar bleiben.
4. BRouter erzeugt eine begrenzte Kandidatenmenge (z. B. höchstens drei, falls Endpoint und Laufzeit es hergeben). KI erhält nur notwendige strukturierte Merkmale und Kandidaten-IDs; sie darf weder Wegpunkte erfinden noch Koordinatengeometrie liefern.
5. Serverseitige Validatoren prüfen Modellantwort gegen Kandidatenmenge, Fakten und Constraints. Begründung wird aus validierten Merkmalen erzeugt, keine internen Gedankengänge oder unbelegte Sehenswürdigkeiten.
6. Provider-/Modellfehler liefern keinen Erfolgstext und keine fiktive Route. Alternative Fallbackroute nur als explizit ausgewählte Standardplanung und mit korrekter Tarif-/Personalisierungskennzeichnung.

**Abnahme:** Jede angezeigte Premiumroute entspricht einer vom Router erzeugten und serverseitig validierten Geometrie; KI-Ausgabe kann keine unzulässige Route einschleusen.

### Phase 4 – Dauerhafte Jobs, Archiv und Wallet

1. Premium-Quote mit Preis, Eingaben/Präferenzversion und Nutzerbestätigung erstellen; Idempotency-Key anfordern.
2. Transaktionales Job-/Wallet-Protokoll implementieren: Quote → Reserve → Job → Kandidaten speichern → Ergebnis bereit → Capture. Fehler/Timeout/Abbruch → Release. Wiederholungen erzeugen weder doppelte Gebühren noch doppelte Historieneinträge.
3. Durable Jobstatus, Lease/Retry und begrenzte Laufzeit/Versuche implementieren. Keine doppelte KI-/Routerausführung ohne Idempotenzprüfung.
4. Alle gültigen erzeugten Kandidaten samt Metadaten/Versionen vor Erfolgsstatus dauerhaft speichern. Ungültige Kandidaten nicht als Route ausweisen; Fehler nachvollziehbar protokollieren.
5. Gefahrene Routen als eigene Historienereignisse anfügen; nie erzeugte, noch ungefahrene Routen durch eine spätere Planung oder Fahrt überschreiben. Lokale IndexedDB ist Cache/offline Kopie, nicht alleinige Premium-Wahrheit.

**Abnahme:** Fehler- und Wiederholungsszenarien belegen Geld-/Token-Erhaltung, vollständige Archivierung und eine getrennte, lückenlose Fahrthistorie.

### Phase 5 – Freigabe und Härtung

1. Capability-Schalter nur serverseitig und pro Umgebung freigeben.
2. Auth/App Check, Regeln, Datenzugriff, Löschpfad, Einwilligungswiderruf, Rate-Limits, Kostenalarm und PII-Minimierung prüfen.
3. Echte begrenzte End-to-End-Läufe mit repräsentativen Start-/Via-/Zielkonstellationen, BRouter-Antworten und dem gewählten Modell ausführen. Keine echten Nutzer-/Verhaltensdaten für Tests verwenden.
4. UI-Claims an gemessene Fähigkeiten binden: Entfernung, Steigung, Untergrund und „KI-Empfehlung“ nur, wenn die entsprechende Datenquelle wirklich vorlag.
5. Nachweise, bekannte Grenzen, Betriebsmetriken und Rückschaltverfahren dokumentieren.

## 6. Verbindliche Akzeptanzmatrix

| Fall | Erwartetes Ergebnis |
|---|---|
| Free-Aufruf mit Oberfläche, Akku, Freitext oder Verhaltensprofil | Felder werden clientseitig nicht gesendet; manipulierte Requests werden serverseitig abgelehnt oder nach klarer Vertragsregel normalisiert; keine Personalisierungswirkung |
| Free-Aufruf mit expliziten Stopps | Alle bestätigten Stopps in richtiger Reihenfolge geroutet, validiert und archiviert |
| Free-Aufruf mit Flachheitswunsch | Alternative nur anhand verfügbarer Höhenwerte gewählt; Umweggrenze eingehalten; unbekannte Höhenwerte werden offen ausgewiesen |
| Premiumwunsch ohne Zustimmung/Capability | Keine Übertragung an Modell, kein Job und keine Belastung |
| Modellantwort mit fremder Geometrie oder unbekannter Kandidaten-ID | Verworfen; keine Route freigegeben |
| Provider, BRouter oder Archiv ausgefallen | Kein Erfolg; Reservierung freigegeben; vorhandene gültige Ergebnisse bleiben gespeichert |
| Mehrfachgenerierung/Retry/Abbruch | Jede gültige ungefahrene Strecke bleibt erhalten; keine Doppelbelastung; Fahrthistorie getrennt und append-only |
| UI-Aufruf über Heute, Karte, Zielpunkt oder Regenerierung | Einheitlicher Coordinator/Capabilitypfad und identische Archiv-/Fehlersemantik |
| Modell-/SDK-/Regionsänderung | Build-/Integrationsfreigabe scheitert geschlossen, bis unterstützte Konfiguration belegt ist |

## 7. Reihenfolge und kritische Abhängigkeiten

Die Implementierung sollte in dieser Reihenfolge erfolgen: **Feldgrenze und Laufzeitinventar → Vertragsversionierung → sichtbare Free-Wegpunkte + einheitlicher Coordinator → robuste BRouter-Auswahl und Archiv → serverseitiger Premium-Kandidatenjob → dauerhafte Speicherung und Wallet → KI- und Betriebsfreigabe.**

Premium darf erst aktiviert werden, wenn Route-Provider, BRouter, strukturierte Validierung, dauerhafte Speicherung, Idempotenz, Wallet, Capability-UI und Abbruch-/Fehlerpfade zusammen nachgewiesen sind. Das löst den gegenwärtigen Konflikt zwischen sichtbaren KI-Versprechen, inaktiven Premiummethoden, generischem Text-AI, getrennten Coordinator-/App-Aufrufen und rein lokalem Archiv.

## 8. Prüfgrenzen dieser Bestandsaufnahme

[FAKT] Die hier beschriebenen Codepfade wurden lokal im bestehenden Routing-Worktree gelesen; vorbestehende uncommittete Quelländerungen aus dem vorherigen Arbeitsstand sind vorhanden und wurden nicht zurückgesetzt.

[NICHT GEPRÜFT] Es wurde in dieser Bestandsaufnahme kein Build, Test, echter BRouter-Aufruf, Firebase-Aufruf, Deployment-Status, Projektkonfiguration oder Wallet-End-to-End-Lauf ausgeführt. Ein früherer Arbeitsstand hatte Typechecks ausgeführt; das ist kein Beleg für Laufzeitfähigkeit.

[RISIKO] Die Modellabschaltungsangabe betrifft dokumentierte Modellverfügbarkeit, nicht den tatsächlichen Deploymentzustand der App. Konkrete Environment-Overrides und aktive Endpunkte sind erst in Phase 0 zu verifizieren.

## 9. Ergänzung: interne Ziele und sinnvolle Gewichtung

Die Zielsuche muss kuratierte Wegweiser-Ziele und Community-Ladepunkte gemeinsam mit freigegebenen öffentlichen Geocodern durchsuchen. Interne Ergebnisse werden zuerst gezeigt und räumlich nahe Dubletten zusammengeführt; fällt der externe Anbieter aus, bleibt die interne Suche verfügbar und die UI kennzeichnet die eingeschränkte Abdeckung. Der heutige Firestore-Bestand hat keinen belegten Volltextindex. Prefix-Suche auf vorhandenen Namensfeldern ist darum nur ein Übergang; für verlässliche Teilwort-/Synonymsuche braucht es ein versioniertes `destination_search`-Indexschema und einen geprüften Backfill für bestehende `points_of_interest`- und `charging_stations`-Daten.

Die Tarif- und Gewichtungsregel ist:

1. **Free-Feldgrenze:** nur bestätigter Start, Ziel, ausdrücklich bestätigte Wegpunkte und der explizite Flachheitswunsch dürfen Routingwirkung haben. Alle impliziten Profile, Vorlieben, Historie und Freitexte bleiben außen vor.
2. **Premium-Sicherheitsgates:** erreichbare/legale Straßengeometrie, erlaubte Wegpunkte/-reihenfolge, bestätigte harte Vorgaben und nachweisbare Reichweiten-/Sicherheitsgrenzen sind Ausschlussbedingungen. Eine hohe Komfortpräferenz kann sie nie überstimmen.
3. **Explizites Nutzerziel:** pro Planung darf der Nutzer eine Hauptpriorität wählen. Sie bekommt zunächst 50 % der weichen Rangfolge; übrige bestätigte Präferenzen teilen 30 %; Kontext aus optional freigegebener Historie erhält höchstens 20 %. Fehlt Einwilligung oder belastbare Datenbasis, wird dieser Anteil proportional den explizit gewählten Vorlieben zugeschlagen und nicht aus Profilen geraten.
4. **Ausgleich:** Distanz/Umweg und Fahrzeit bilden zusammen höchstens 20 Prozentpunkte innerhalb der sekundären 30-%-Gruppe; Oberflächen-/Landschaftsmerkmale werden nur mit tatsächlichen Routermesswerten bewertet. Fehlende Metriken werden als unbekannt markiert und aus dem Nenner genommen, nie als null oder erfüllt interpretiert.
5. **Lernverhalten:** gefahrene/abgebrochene/übersprungene Routen dürfen in Premium nur aggregiert und nach gesonderter Einwilligung einfließen. Eine einzelne Nichtnutzung beweist keine Abneigung; explizite Auswahl/Abwahl hat Vorrang vor abgeleiteten Mustern. Gewichtungen sind in UI erklärbar, versioniert und zurücksetzbar.

Diese Gewichtung ist ein Startpunkt für Produktvalidierung, kein bereits aktiver Algorithmus. Vor Aktivierung sind Skalen-Normalisierung, Korrelation zwischen Merkmalen (z. B. Natur und Untergrund), Mehrzieltests und Sensitivitätsanalysen zu belegen.

## 10. Umsetzungsspur im Integrations-Worktree

Branch `codex/routing-ai-integration-20261031` basiert auf dem bisherigen Routing-Branch samt dessen offenen Änderungen. Die folgenden Aussagen beschreiben den lokal bearbeiteten Quellstand; sie belegen keinen Build, Emulator- oder Produktivlauf.

### Im Code ergänzt

- Free-Requests werden auf Start, Ziel, bestätigte Zwischenstopps und Flachheit begrenzt. Serverseitig bleiben Premium-Only-Felder im Free-Pfad gesperrt. Die Free-Strecke bleibt BRouter-Geometrie.
- Interne POI- und Ladepunktdaten werden mit öffentlichen Geocoder-Ergebnissen zusammengeführt; interne Treffer erhalten eine Quellenkennzeichnung. Die Suche ist weiterhin Prefixsuche auf vorhandenen Feldnamen.
- Ein serverseitiger Premium-Callable nutzt weiterhin BRouter für bis zu drei valide Geometriekandidaten. Konfigurierbare KI-Adapter sind Vertex, Gemini API, OpenAI und Anthropic; das Modell liefert ausschließlich Kandidaten-ID und Begründung, keine Geometrie. Ein deterministischer Score begrenzt die KI-Auswahl auf den bestbewerteten Kandidaten bzw. einen Gleichstand.
- Premium ist standardmäßig geschlossen und benötigt zusätzlich einen serverseitigen Release-Parameter sowie Firestore-Konfiguration. Eine Quote zeigt Preis und Provider/Modell; der Code reserviert Tokens, archiviert gültige Kandidaten im privaten GCS-Bucket und belastet erst nach dauerhaftem Speichern. Bei Fehlern wird die Reservierung freigegeben; ein Scheduler gleicht abgelaufene Leases ab.
- Alle Alternativen werden in der lokalen IndexedDB-Routenablage mit stabilen IDs gespeichert, und ein Callable kann einzelne serverseitige Kandidaten nach einem Verbindungsabbruch wieder liefern. Die bestehende Fahrthistorie bleibt davon getrennt.
- Die Archivansicht kann eigene abgeschlossene Premiumaufträge seitenweise serverseitig auflisten, jede gespeicherte Variante abrufen, lokal erneut validieren und idempotent in IndexedDB wiederherstellen. Die Liste ist auf den angemeldeten Besitzer begrenzt; ein zusammengesetzter Firestore-Index ist ergänzt.
- Die aktuell tatsächlich verwendete Premiumgewichtung ist enger als der Abschnitt 9 vorgeschlagene Produktkatalog: gewählte Hauptpriorität, gemessene Distanz/Zeit und (bei vorhandenen Höhenwerten) Anstieg; Historie ist mit Gewicht 0. Oberfläche, Akku, Freitext, Interessen und Verhaltensdaten werden ausdrücklich nicht bewertet. Somit sind noch nicht „alle Nutzerdaten“ sinnvoll gewichtet; nicht belegbare Größen werden bewusst nicht vorgetäuscht.

### Weiter offen vor einer vollständigen Freigabe

- Kein echter Cloud-Tasks/Outbox-Worker: die Premiumberechnung läuft noch synchron im Callable. Firestore-Job, Lease und Scheduler helfen bei Idempotenz und Abrechnung, ersetzen aber keine durable Queue.
- Die Wiederherstellung der lokalen Premiumkopien ist umgesetzt. Die serverseitigen Kandidatenobjekte haben weiterhin keine definierte Aufbewahrungs-/Löschfrist außerhalb der Kontolöschung; eine Retention-Policy muss vor Produktivbetrieb festgelegt werden.
- Es ist ausschließlich BRouter als Straßenrouter eingebunden. GraphHopper/ORS/OSRM wurden recherchiert, aber nicht integriert oder live geprüft.
- Kein kanonischer Firestore-Suchindex, Volltext-/Synonymsuche oder geprüfter Backfill. Die interne Suche deckt daher nicht nachweislich jeden historischen Datensatz ab.
- Die Premium-UI ist an Zielpunktplanung, Quote und Auswahl der Priorität angebunden, aber noch nicht an alle historischen Einstiegspunkte. Mehrere Zwischenstopps und strukturierte zusätzliche Premiumpräferenzen sind noch nicht durchgängig abgebildet.
- Fahrtenhistorie ist in der bestehenden Client-IndexedDB getrennt von generierten Plänen. Serverseitige Fahrtenhistorie/Synchronisation über Geräte hinweg ist nicht implementiert.
- Keine echten Provider-, BRouter-, Firebase-, Wallet- oder Wiederanlaufprüfungen; Modell-/Region-/Credential-/Kostenkonfiguration ist nicht live verifiziert. Keine Abrechnung oder Bereitstellung wurde ausgelöst.
- Cloud Tasks ist technisch mit den im Functions-Lockfile vorhandenen SDK-Hauptversionen kompatibel, aber die Premiumausführung läuft im Quellstand weiterhin synchron. Eine Queue erfordert einen Worker-/Idempotenzumbau plus Deployment und IAM-Einrichtung; dieser Schritt ist in diesem Arbeitsstand nicht umgesetzt oder live verifiziert.
- Das Auflisten/Wiederherstellen betrifft ausschließlich Premium-Routenartefakte. Die normale Fahrtenhistorie bleibt lokale IndexedDB; eine Geräte-übergreifende Synchronisierung wird wegen der darin enthaltenen präzisen Bewegungsdaten nicht ohne ein eigenes, getrenntes Opt-in und Lösch-/Aufbewahrungskonzept still aktiviert.
- Der neue Premium-Archivabgleich paginiert alle eigenen Jobs und stellt alle zurückgegebenen Kandidaten idempotent wieder her. Ein explizit festgelegtes Ablauf-/Löschkonzept für GCS-Artefakte und die zugehörigen Jobmetadaten steht noch aus.

[RISIKO] Die interne Suche nutzt Übergangs-Prefixabfragen. Die Premiumfreigabe bleibt in der Standardkonfiguration geschlossen; ein Aktivieren wäre ohne Build, Tests, Emulator-/Integrationstest, Datenschutz-/Einwilligungsprüfung und reale Provider-/BRouter-Prüfung nicht belegt.
