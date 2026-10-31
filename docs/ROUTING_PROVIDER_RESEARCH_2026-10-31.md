# Routing- und KI-Anbieter: API-Recherche

Stand: 31.10.2026. Recherche anhand offizieller Anbieterunterlagen; keine Konten, Keys, Verträge, Regionsverfügbarkeit oder Live-Endpunkte dieses Projekts geprüft.

## KI für Premium-Kandidatenauswahl

Die KI darf nur bereits vom Straßenrouter berechnete Kandidaten-IDs sortieren/bewerten. Modellantworten enthalten keine Geometrie oder freien Wegpunkte und werden serverseitig gegen die übergebenen Kandidaten und Nutzeroptionen validiert.

| Anbieter/API | Strukturierte Antwort | Integrationseinschätzung | Zu verifizieren vor Freigabe |
|---|---|---|---|
| Google Gemini API | JSON-Schema-Ausgabe via `response_format`/JSON MIME | Direkte REST-/SDK-Integration; vom Vertex-Produkt und dessen IAM/Region getrennt | verfügbares Modell, Datenverarbeitung, Limits, EU-Region/Residency, Key-Betrieb |
| Vertex AI Gemini | Bestehender Cloud-Pfad; Google GenAI SDK dokumentiert Schema-Ausgabe | ADC/Service Account und vorhandene Firebase/Google Cloud Umgebung; heute einziger bestehender KI-Backendadapter | aktives Modell, Projekt, Region, IAM, Quoten/Kosten und unterstützte Schema-Untermenge |
| OpenAI API | Responses API Structured Outputs bzw. JSON Schema | Eigener REST-Adapter; Schlüssel ausschließlich serverseitig | Modellzugang, Region/Datenschutzoptionen, Kosten, Retention, Limits |
| Anthropic Messages API | `output_config.format` mit JSON Schema | Eigener REST-Adapter; Schlüssel ausschließlich serverseitig | Modellzugang, Region/Datenschutzoptionen, Kosten, Retention, Limits |
| Amazon Bedrock | Converse/InvokeModel mit JSON-Schema-Ausgabe für geeignete Modelle | Option, falls AWS IAM/Region vorhanden; nicht bloß Anthropic Messages über beliebige AWS-Endpunkte | Region/Modellmatrix, IAM, Schema-Limits, Zusatzinfrastruktur/Kosten |

Empfehlung: Erstes Mehranbieter-Release mit Vertex/Gemini, OpenAI und Anthropic als strikt konfigurierbare Serveradapter. Pro Job wird genau ein fest gewählter Anbieter benutzt; automatische Weitergabe von Nutzerdaten an einen anderen Anbieter als Fehlerfallback ist ausgeschlossen. Fallback erfordert explizite Produkt- und Einwilligungsentscheidung. Bedrock folgt nur, falls AWS als Betriebsumgebung gewünscht und eingerichtet ist.

## Straßennetz-Routing

Diese APIs liefern tatsächliche Wege auf Straßengraphen; sie sind nicht mit einem Sprachmodell austauschbar.

| Anbieter | Fähigkeit | Einordnung |
|---|---|---|
| BRouter | Aktuell genutzter Fahrradrouter, bereits normalisierter GeoJSON-Pfad im Backend | Beibehalten als erster Fahrrad-Provider; Version/Profil/Datensatz und reale Antwortform weiterhin deployseitig nachweisen |
| GraphHopper Directions API | Wege zwischen mehreren Punkten, Profile und konfigurierbare Routingparameter; alternative Routen API- und planabhängig | Kandidat für zweiten verwalteten Fahrradrouting-Adapter; Lizenz, Limits, Fahrradprofile, Via-Limits, alternative-Routen-Semantik und Elevation vor Implementierungsfreigabe prüfen |
| openrouteservice Directions v2 | Fahrradprofile, GeoJSON, Wegpunkte und begrenzte Alternativen; dokumentierte öffentliche Limits (u. a. 50 Waypoints, max. 3 Alternativen; Distanz-/Profilgrenzen) | Geeignet für begrenzten zweiten Provider, sofern Profil/Region und öffentliche Quoten zum Produkt passen; keine unbeschränkte Verfügbarkeit versprechen |
| OSRM | Offene HTTP Route API, mehrere Koordinaten, Alternativen; Verfügbarkeit/Modus hängt vom selbst bereitgestellten Graphen und Profil ab | Technisch gut für selbst betriebenen Provider; kein von Haus aus garantierter öffentlicher Fahrradservice. Für echten Betrieb wären Hosting, OSM-Graph-Import, Updates, Monitoring und Kapazität nötig |

Providerwechsel darf nur nach expliziter Konfiguration und erfolgreicher Capability-Prüfung erfolgen, nie durch unbemerkten Wechsel auf ein anderes öffentliches Routingkonto. Einheitliches internes Ergebnis enthält Geometrie, Distanz, Messqualität, Engine-/Datenversion, Profil und Providerstatus. Der gemeinsame Validator prüft Start/Ziel/Stoppreihenfolge, Distanz, Geometrie und Dubletten.

## Tarifgrenze und Datenschutz

- Kostenlos werden nur bestätigter Start, Ziel, ausdrücklich gesetzte Stopps und Flachheitswunsch an den Router gesendet. Oberfläche, Akku-/Fahrradprofil, Freitext, Interessen und Verlauf bleiben aus dem Standardrequest heraus.
- Premium erhält zusätzliche Vorlieben erst nach sichtbarer Auswahl/Bestätigung; Verhaltensdaten nur nach eigener transparenter Einwilligung.
- Jeder Provider ist serverseitig ausgewählt. Keine Schlüssel im Client, keine Prompt-/PII-Logs, begrenzte Zeit-/Antwortgröße, Schema-Validierung, Rate-Limit und Kostenbudget.
- Geometrie wird ausschließlich vom Straßenrouter akzeptiert. Modell-IDs außerhalb der Routerantwort werden verworfen.
- Aktivierung bleibt gesperrt, bis echte Konfiguration, Recht/Datenschutzprüfung, Kosten, Persistenz, Wallet-/Quoteablauf und UI-Capabilities gemeinsam abgenommen sind.

## Primärquellen

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Amazon Bedrock Claude Structured Outputs](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-structured-outputs.html)
- [GraphHopper Directions API](https://docs.graphhopper.com/openapi)
- [openrouteservice API restrictions](https://openrouteservice.org/restrictions/)
- [OSRM API](https://project-osrm.org/docs/v26.4.0/api/)
