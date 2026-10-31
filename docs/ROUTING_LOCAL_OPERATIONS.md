# Routing: lokale Prüfung und spätere Betreiberkonfiguration

**Kein Betriebsfreigabedokument.** Es wurden keine Cloudressourcen, Geheimnisse, Kontoverbindungen, Graphimporte oder Deployments angelegt. Alle Beispiele beschreiben spätere explizite Betreiberarbeit.

## Wallet und Migration

Die gemeinsamen Transaktionswriter für Quiz, Rad und Gutscheine lesen `wallet_control/current`. Ohne `{state: "active", schemaVersion: 1}` bleiben neue Tokenmutationen geschlossen. Das betrifft auch Spielversuche mit Nullgewinn; während der Migration sollen keine Versuche verbraucht werden. Bereits gebundene Reservierungen dürfen auch während einer Pause freigegeben werden.

Ablauf vor einer tatsächlichen Umstellung:

1. Neue Writer und Regeln kompatibel vorbereiten; sämtliche Altschreiber einschließlich Adminwerkzeugen erfassen. Kein alter Writer darf die Pause umgehen. Bisher wurde nichts ausgerollt.
2. Explizites Betriebsfenster und Kontobestand festhalten. `auditMigration` aus `functions/src/wallet/ledger.ts` ist rein lesend und verarbeitet `{id, data}`-Snapshots; fehlende/negative/nichtganzzahlige Werte werden isoliert, nicht durch Standardguthaben ersetzt. Echte Konto-/Saldensummen wurden mangels Zugang nicht erhoben.
3. Alle Tokenmutationen über die serverseitige Pause stoppen (`state: "paused"`). Nicht allein auf eine UI-Sperre vertrauen. Aktive Jobs/Reservierungen zunächst kontrolliert abschließen.
4. `migrateWallet(db, uid)` aus `functions/src/wallet/firestoreLedger.ts` pro geprüftem Konto in einer echten Admin-Transaktion ausführen. Die Funktion verlangt die Pause, bewahrt Guthaben und lifetimeEarned, setzt die initiale Reservierung auf 0 und erzeugt genau einen Openingbeleg. Sie verweigert fehlende oder löschende Konten und widersprüchliche Openingbelege. Ein Wiederholungslauf erkennt bereits migrierte Konten.
5. Salden, Belege, Anzahl, invalidisierte Konten und offene Reservierungen auf einer Testkopie abgleichen. Erst nach Emulator-/Konkurrenz-/Migrationsabnahme neue Writer aktivieren. Kein automatischer Start-/Apply-CLI ist enthalten.

Neue Konten entstehen ausschließlich durch legitime serverseitige Credits mit einem Openingbeleg von 0 plus dem tatsächlichen Earnbeleg. Ein verspäteter Capture/Release erzeugt kein fehlendes Konto. Gutscheine kosten unabhängig von alten Unlimitedfeldern ihre tatsächlichen Token. Clientänderungen und auch direktes Kontolöschen werden durch die neuen Regeln verboten.

Die Kontolöschung setzt zuerst `account_deletion_locks/{sha256(uid)}`, löst Reservierungen und löscht anschließend Konto, persönliche Belege/Jobs, Subscriptionrecord und private Uploads. Ein Hash ist keine Zusage vollständiger Anonymität. **Aufbewahrungs-/TTL-Entscheidung für diese Sperren ist vor dem Pilot noch offen.** Es wurde kein Zahlungssystem gekündigt und keine reale Konto-/Beleglöschung ausgeführt. Native Bereinigung bleibt geräteabhängig.

## Betreiber-Routing und Suche

Konfiguration ausschließlich serverseitig, für Clients über den strikten Default der Regeln gesperrt:

- `BROUTER_BASE_URL`: Wurzel-URL der eigenen privaten BRouterinstanz. Kein vom Nutzer gewählter Host, keine Credentials oder Parameter im URL, kein öffentlicher BRouterfallback.
- `NOMINATIM_BASE_URL`: Wurzel-URL der eigenen regionalen Nominatiminstanz. Öffentliche Nominatim-Autocomplete wird nicht verwendet.
- Secret `ROUTING_RATE_LIMIT_KEY`: lokal/über den Betreiber konfigurieren, niemals im Chat, Repository oder Browserbundle. Die Anwendung begrenzt Suche und Free-Routing getrennt auf je 15 Aufrufe/Minute pro Konto oder kurzfristigem serverseitigem IP-HMAC. Die Account-/IP-Kennung selbst wird nicht im Ratenlimitdokument gespeichert.
- `routing_config/current`: `freeEnabled`, `gate0Verified`, `engineVersion: "1.7.10"`, tatsächliche `dataVersion`, `coverageId` und geprüfte `bounds: {south,north,west,east}`. `searchEnabled` ist ein getrennter Schalter. Es wurden keine Werte gesetzt. **`gate0Verified` erst nach den realen Router-/Graph-/Profilproben setzen.** Eine Boundingbox beweist keine vollständige Graphabdeckung; tatsächliche Routerfehler bleiben verbindlich.

`getRoutingCapabilities` meldet Free nur bei einer gültigen Konfiguration/Betreiber-URL. Premium und lokale Offlineengine sind geschlossen. Der vorbereitete Free-Adapter liefert ausschließlich Ziel-/Via-Tracks mit `trekking`; echte Manöver, Rundtouranker und Höhen-/Energiedaten sind noch nicht abgenommen. Fehlende Werte bleiben unbekannt. Eine echte BRouterantwort/Manöverfixture ist weiter Voraussetzung für die Freigabe; synthetische Unitfixtures sind entsprechend benannt.

Die Endpunkte begrenzen Zeit und Antwortgröße, folgen keinen Redirects, verwenden keine callergewählten URLs/Profile und greifen für Free nicht auf eine Wallet oder einen Modellprovider zu. Fehler erzeugen keine Kreis-/Luftlinie. Der alte `computeRoute` lehnt Altclients explizit ab, ohne Provideraufruf und ohne Stubroute.

Ratenlimitdokumente haben ein `expiresAt`-Feld (2 Stunden). **Die echte Firestore-TTL-/Bereinigungsregel wurde nicht eingerichtet oder geprüft.** Vor Betrieb müssen außerdem BRouter-/Proxylogs so konfiguriert werden, dass private Koordinaten und Suchstrings nicht mitgeschrieben werden. Cloud-Accesslogs werden nicht durch einen Unit-Test anonymisiert.

Nominatimparameter sind anhand der [offiziellen Such-API](https://nominatim.org/release-docs/latest/api/Search/) geprüft. Die Wahl eines gepinnten Container-/Importverbunds, tatsächliche Lizenzen/Attribution und Größen-/Kostenmessungen bleiben Teil von Phase 0/2A; hier wurde keine Installation durchgeführt.

## Frontend und Navigation

- Suche nach Enter/Suchen, maximal fünf Treffer; Tippen, Löschen, Auswahl, Unmount und Consentwechsel invalidieren alte Antworten. `lat,lng` kann ohne neue Geocodinganfrage gewählt werden.
- GPS enthält Messzeit/Genauigkeit. Die Kartenmitte ist kein bestätigter Start. Manuelle Startwahl erlaubt eine Vorschau, aber keine vorgetäuschte GPS-Navigation.
- Ziel und Ladestation verwenden denselben Free-Zielvertrag. Der letzte Punkt einer Rundtour wird nicht mehr zur Station verschoben.
- Planungsvorschau bleibt von der laufenden Strecke getrennt. Übernahme ist ausdrücklich. Beim Auth-/Consentwechsel werden ausstehende Ergebnisse verworfen und abbrechbare Arbeit gestoppt.
- Firebase-Callables bieten hier keine AbortSignal-Transportoption: der Client invalidiert verspätete Antworten; der Backendfetch hat einen echten Timeout/Abort. Es wird kein nicht vorhandener serverseitiger Jobcancel behauptet.
- Hashes werden kanonisch mit sortierten Objektschlüsseln gebildet. Der Browser validiert Free-Ergebnisse erneut. Gespeicherte/serialisierte Validierungsflags berechtigen nicht zur Führung: nur im aktuellen Lauf geprüfte Instanzen erhalten diese Fähigkeit.
- Der Tracker verwendet Segmentprojektion, Fortschrittsfenster, Zeit-/Genauigkeitshysterese und ausschließlich übernommene Routermanöver. Er erfindet weder Straßennamen noch Höhenfarben. Der räumliche Index, tatsächliche Rejoinverbindungen/Routerkosten und vollständige Sessionpersistenz sind noch offen.
- Automatische Abweichung erzeugt keine KI-Tour. Bis echte Rückführung verfügbar ist, bleibt die Originalroute erhalten und ein sichtbarer Hinweis benennt die Einschränkung.
- Lokale Kontolöschung wartet auf Bereinigung und meldet Speicher-/Cache-/IndexedDB-Teilfehler, einschließlich blockierter Datenbanken. Physische Android-/iOSprüfungen und native Pakete/Keystore/Foreground-Service wurden damit nicht ersetzt.

## Reproduzierbare lokale Prüfungen

```sh
npm run build
npm run build --prefix functions
node --import tsx --test tests/services.test.mjs
npm test -- --reporter=dot --exclude tests/scripts/anthropicFederationExchange.test.ts
npm test --prefix functions -- --runInBand --coverage '--collectCoverageFrom=src/wallet/*.ts' --coverageReporters=text
python3 scripts/check_wallet_integration_mutations.py
firebase emulators:exec --only firestore --project demo-wegweiser 'node --test tests/firestore.rules.test.mjs'
```

Der explizite Frontendausschluss betrifft die vorhandene Sockettest-Suite, die in dieser Umgebung bereits auf der Ausgangsbasis an `listen EPERM` scheitert. Die übrigen Suites werden nicht still übersprungen. Auch Emulator und Stryker benötigen lokale Listener und konnten hier nicht starten. Die ausgewählten Mutationstests sind keine vollständige Stryker-Abnahme. Kein Befehl deployt oder pusht.
