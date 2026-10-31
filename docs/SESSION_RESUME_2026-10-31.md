# Sessionfortsetzung am 31.10.2026

## Verifizierter Stand

- [FAKT] Worktree: `codex/routing-open-points-20261031`. Vorhandene uncommittete Implementierung bleibt erhalten.
- [FAKT] Eggshell ist aktiv. Die lokale Übergabe nennt als letzten offenen Schritt den Firebase-Projektzugriff und den ausdrücklichen Wunsch, das bestehende Projekt `der-wegweiser` zu verwenden.
- [FAKT] `firebase projects:list --json`: Exit 0, Status `success`, Projekt `der-wegweiser` / Anzeigename `DER WEGWEISER` vorhanden.
- [FAKT] `firebase functions:list --project der-wegweiser --json`: zweimal Exit 0, Status `success`, Ergebnis `[]`.
- [FAKT] Rules-Test zweimal erfolgreich: `firebase emulators:exec --only firestore --project demo-wegweiser 'node --test tests/firestore.rules.test.mjs'`. Je 18 Tests bestanden, 0 fehlgeschlagen, Exit 0. Getestet wurden lokale Regeln einschließlich Fremdzugriff, unerlaubter Eigentümerwechsel, Typ-/Pflichtfeldfehler und direkter Wallet-/Ledger-/Job-Schreibzugriffe.
- [FAKT] Java und Firestore-Emulator waren bereits vorhanden; keine Installation nötig. Emulatoren nach beiden Läufen beendet.
- [FAKT] `.env`, `.env.local`, `functions/.env` und `functions/.env.der-wegweiser` fehlen in diesem Worktree. Daraus folgt keine Aussage über Cloud-Secrets oder andere Konfigurationsquellen.
- [FAKT] `bibel.local` antwortete beim kurzen Abruf nicht (curl Exit 28); lokaler Snapshot vom 07.10.2026 verwendet.

## Nächster Schritt und Grenzen

- [SCHLUSS] Frühere lokale Port-/DNS-Sperren verhindern die obigen Prüfungen jetzt nicht mehr. Die Functions-Liste belegt keine bereitgestellten Functions in diesem Projekt zum Abfragezeitpunkt.
- [NICHT GEPRÜFT] Reale Router-/KI-Aufrufe, Cloud Tasks/IAM, App Check, Testwallet, Cloud-Secrets, produktive Rules und manuelle UI-Abnahme.
- Für die konkrete Cloud-Konfiguration wurden BRouter-Endpunkt sowie gewünschter KI-Anbieter und Modell beim Benutzer angefragt. Geheimnisse gehören nicht in den Chat.
- Keine Cloud-Konfiguration geändert, keine Datenmigration, kein Deployment, kein Commit, Merge oder Push ausgeführt.
- Der frühere Gesamtplan bleibt historische Evidenz; seine damalige Emulator-Sperre ist durch die zwei hier dokumentierten erfolgreichen lokalen Läufe überholt. Die vollständige Cloud-/Anbieterabnahme bleibt offen.
