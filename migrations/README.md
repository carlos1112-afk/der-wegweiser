# DATENBANK- & SCHEMA-MIGRATIONEN

Dieses Verzeichnis verwaltet versionierte Datenbankschemata und Migrationsskripte für **Der Wegweiser**.

## 📌 Migrations-Richtlinien:
1. **Keine manuellen stillschweigenden Schemaänderungen**: Jede Änderung an Collections oder Feldern muss als nummerierte Datei dokumentiert werden (`001_...`, `002_...`).
2. **Idempotenz**: Migrationsskripte müssen mehrfach ausführbar sein, ohne Daten zu beschädigen oder zu duplizieren.
3. **Abwärtskompatibilität**: Bestehende App-Installationen müssen alte Dokumente lesen können, bis eine automatische Migration abgeschlossen ist.

## 📋 Verzeichnisübersicht:
* `001_initial_schema.json`: Baseline-Schema für Version 1.0.0 (Collections: `users`, `user_tokens`, `user_preferences`, `routes`, `charging_stations`, `scout_reports`).
