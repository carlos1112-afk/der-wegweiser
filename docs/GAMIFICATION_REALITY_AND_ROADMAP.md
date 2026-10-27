# Gamification: Ist-Stand und Umsetzungsplan

Stand: 27. Oktober 2026. Zweck: vorhandene echte Abläufe von Demo- oder nicht angebundenen Funktionen trennen und eine sichere Reihenfolge für den weiteren Ausbau festlegen.

## 1. Ist-Stand aus dem aktuellen Code

### Tatsächlich serverseitige Funktionen

- **Tokenquiz:** `getTokenQuizChallenge` und `submitTokenQuizAnswer` liegen in `functions/src/tokenRewards.ts`. App Check und Authentifizierung werden geprüft; die Frage, Antwort, Tagesbindung und Tokenbuchung entscheidet das Backend.
- **Tägliches Glücksrad:** `getTokenWheelStatus` und `spinTokenWheel` führen den Tagesstatus und das Ergebnis serverseitig. Einmal pro UTC-Tag, serverseitige Zufallswahl, atomare Tokenbuchung.
- **Gutschein-Einlösung:** `redeemVoucher` prüft Auth, App Check, Sperrstatus und Guthaben und bucht die Einlösung atomar.
- **Kontostand:** Client-Aufrufe zum freien Erzeugen von Token-Guthaben sind deaktiviert. Die Firestore-Regeln untersagen direkte Client-Schreibzugriffe auf `user_tokens`.

### Vorhanden, aber noch keine echte externe Belohnungsintegration

- **Werbung:** kein bestätigter Ad-Anbieter und kein verifizierter Reward-Callback. Belohnung daher deaktiviert.
- **Umfragen/Offerwall:** kein verifizierter Provider-Postback. Die Oberfläche darf keine Token-Gutschrift behaupten.
- **Käufe:** kein angebundener Zahlungs-/Store-Belegfluss. Tokenkäufe bleiben deaktiviert.
- **Fahrt-, Stations- und Review-Boni:** keine fälschungssichere serverseitige Beweis- und Bewertungsstrecke. Keine Gutschrift.
- **Quests, Catcher und Rangliste:** Demo- oder lokale Funktionen; sie dürfen nicht als serverbestätigte Wettbewerbe bzw. bezahlte Tokenquellen erscheinen.
- **Gutscheine:** Partnergültigkeit, Verfügbarkeit und Berechtigung wurden nicht extern bestätigt. Im Client ausgelieferte Geheimcodes sind keine sichere Partnerintegration und dürfen nicht als vertraulich behandelt werden.

## 2. Verbindliche Produktregeln

1. Nur das Backend darf Guthaben ändern. Jeder Earn-/Spend-Vorgang bekommt eine idempotente Ledger-Transaktion mit Nutzer, Anlass, Betrag, Quelle, Zeit und Referenz-ID.
2. Belohnungen werden nur nach serverseitig überprüfbarem Ereignis verbucht. Ein Client-Status, Screenshot, lokaler Score oder frei gewählter Betrag ist kein Beweis.
3. Jede Quelle ist entweder **Live**, **Demo/lokal** oder **Nicht verfügbar**. UI, Benachrichtigung und Kontostand verwenden dieselbe Einstufung.
4. Auszahlung/Einlösung, Kontolöschung, Sperren und Erstattungen müssen im Ledger nachvollziehbar und atomar sein.
5. Limits, Tagesgrenzen und Missbrauchserkennung gelten serverseitig; Client-Sperren sind nur Bedienhilfe.
6. Keine externen Partner, Werbenetzwerke oder Zahlungsanbieter werden als aktiv bezeichnet, bevor Sandbox- und Produktionsnachweise vorliegen.

## 3. Roadmap und Abnahmekriterien

### Phase A — Token-Ledger und Kontosicherheit

- Einheitliches unveränderliches Ledger-Schema einführen; Guthaben als kontrollierte Projektion führen.
- Alle Earn-, Spend-, Korrektur- und Einlösungspfade in Transaktionen mit Idempotenzschlüssel überführen.
- Clientregeln für Tokenkonten, Admin-/Supportpfad, Löschung und Aufbewahrung gemeinsam prüfen.
- Emulator- und Functions-Tests für Replay, parallele Requests, Tageswechsel, Sperren, negative/überlaufende Beträge und Transaktionsabbrüche.
- **Abnahme:** Kein direkter Client kann Guthaben oder Entitlement ändern; wiederholte Anfrage erzeugt höchstens eine Buchung; Kontostand und Ledger stimmen nach jedem Szenario überein.

### Phase B — Bestehende Quiz- und Rad-Flows härten

- Fragenpool und Ausgabequalität prüfen; pro Tag nur ein gültiger Challenge-Datensatz und ein Versuch gemäß klarer Produktregel.
- UTC-Tagesgrenze, Zeitzonen-UX, parallele Wheel-Spins und doppelte Client-Callbacks testen.
- Transaktionsfehler verständlich anzeigen, ohne falschen Gewinnzustand oder doppelte Gutschrift.
- Admin-Metriken ohne unnötige persönliche Daten ergänzen: Aufrufe, gültige Buchungen, Fehlerraten und Limits.
- **Abnahme:** Emulator-/Integrationstest belegt Tageslimit, Replay-Schutz, atomare Gutschrift und korrekte UI nach App-Neustart.

### Phase C — Reale Gutschein- und Partnerkataloge

- Partner, Regionen, Gültigkeitszeitraum, Bestand, Tokenpreis und Einlösebedingungen als Backend-Daten modellieren.
- Nur nach Partnerbestätigung gültige Angebote veröffentlichen; Codes ausschließlich aus vertrauenswürdigem Backendbestand freigeben.
- Reservierung, Abbuchung, Codeausgabe, Storno/Erstattung und Auditspur transaktional gestalten.
- **Abnahme:** Testpartner-Sandbox samt Replay-, Doppelbestellungs-, Bestands- und Rückerstattungstest erfolgreich; keine Codes im App-Bundle.

### Phase D — Externe Einnahmequellen nur nach Providerwahl

- Werbenetzwerk: serverseitig verifizierter Reward-Callback mit Signatur, Event-ID, Replay-Schutz und Provider-Status.
- Offerwall: Provider-Postback mit Signatur/Allowlist, Event-Deduplizierung und Rückbuchungsweg.
- Store-Käufe: App-Store-/Play-Beleg serverseitig verifizieren; Clientbestätigung allein reicht nicht.
- **Abnahme je Quelle:** Provider-Sandbox, ungültige Signaturen, Replay, Rückbuchung und Kontosperre getestet. Ohne diese Nachweise bleibt der Schalter aus.

### Phase E — Fahrten, Community und Wettbewerbe

- Fahrten zunächst lokal und ausdrücklich ohne Tokenbonus belassen.
- Vor einer Belohnung Bedrohungsmodell erstellen: GPS-Spoofing, Replay, Hintergrundmanipulation, Mehrfachkonten, BLE-Manipulation und Datenschutz.
- Falls vertretbar, eng begrenzte Ereignisse serverseitig plausibilisieren; keine präzisen Bewegungsdaten länger speichern als erforderlich.
- Ranglisten nur mit klarer Einwilligung, Abuse-Moderation, Löschweg und nachprüfbarer Wertung aktivieren.
- **Abnahme:** unabhängiger Abuse-Test, Datenschutzprüfung und verständliche Regeln vor Freischaltung.

## 4. Nächste konkrete Arbeit

1. Emulator-Tests für `tokenRewards` und Firestore-Regeln hinzufügen/prüfen.
2. Token-Ledger-Entwurf und Migration vor weiteren Belohnungsquellen umsetzen.
3. Gutscheinquelle und Partnerstatus klären, bevor ein echter Shop wieder aktiviert wird.
4. Demo-Labels und Disabled-Zustände bei jedem Einstiegspunkt konsistent halten.

## 5. Noch offene Entscheidungen

- Welche Tokenquellen sollen Produktbestandteil werden und welche wirtschaftlichen Limits gelten?
- Welche realen Gutscheinpartner und Regionen sind autorisiert?
- Welche Drittanbieter dürfen nach bewusster Auswahl angeschlossen werden?
- Sollen lokale Minispiele dauerhaft rein kosmetisch bleiben?

Dieser Plan behauptet keine Aktivierung externer Provider. Er beschreibt Implementierungs- und Abnahmeschritte; Umsetzung und externe Freischaltung stehen aus.
