# PilotStudio → Phi Pilot Fusion: Ausführungsplan

Arbeitsgrundlage für die restliche Umsetzung. Statusangaben sind bewusst ehrlich: Ein Schritt gilt erst als erledigt, wenn er durch Codeprüfung oder einen tatsächlich ausgeführten Test belegt ist.

## Ziel

Eine eigenständige AGY-IDE/VS-Code-Extension `phi-pilot-fusion`, die die PilotStudio-Agent-Registry und GUI-Funktionen übernimmt, mehrere Provider unterstützt, Gemini Code Assist ersetzt und über einen Desktop-Installer gebaut, installiert und gestartet wird.

## Plan und Status

### 1. Quellbestand aufnehmen — ERLEDIGT

- PilotStudio-Registry in `src/services/aiAssistantService.ts` analysiert.
- Provider erfasst: Firebase Google AI, Vertex AI, OpenRouter, HuggingFace, Inflection Pi und Gemini API-Key.
- AGY-IDE/VS-Code-Extension-Bestand und vorhandene Open-Agent-Extension geprüft.

### 2. Fusion-Extension-Struktur — ERLEDIGT

Pfad: `extensions/phi-pilot-fusion/`

- `package.json`
- `tsconfig.json`
- `src/extension.ts`
- `src/phiEngine.ts`
- `src/ui/index.html`
- `README.md`

### 3. Provider- und Agent-Integration — CODE ERLEDIGT, BUILD AUSSTEHEND

- PilotStudio-Agent-Registry in die Extension übertragen.
- Agent-Auswahl mit Verfügbarkeitsstatus implementiert.
- OpenAI-kompatible Provider implementiert: OpenRouter, HuggingFace, Pi.
- Gemini-REST-Provider implementiert: Firebase/Direct API-Key.
- Vertex-REST-Provider mit `gcloud auth print-access-token` implementiert.
- API-Key-Quellen: VS-Code-Settings, `.env.local`, Prozess-Environment.
- Fehlende Keys werden vor dem Request erkannt.
- HTTP-Status, Provider-Fehler und Timeouts werden behandelt.

### 4. GUI-Integration — CODE ERLEDIGT, RUNTIME-TEST AUSSTEHEND

- PilotStudio-ähnliches Catppuccin-Chat-Layout.
- Agent-Auswahl nach Tier gruppiert.
- Chat, Enter/Shift+Enter, Clear, Settings und Terminal.
- Loading-/Fehlerstatus.
- View-Lifecycle und Webview-Disposable.
- Veraltete Antworten werden nach Clear, View-Schließung oder Agent-Wechsel verworfen.
- Kontextbegrenzung auf 24 Nachrichten.

### 5. Statische Fehlerbereinigung — MEHRERE RUNDEN ERLEDIGT

- URL-Artefakt entfernt.
- Rohes JSON-Streaming entfernt; nur validierter Response-Text wird weitergegeben.
- JSON-/HTTP-Fehler normalisiert.
- Vertex-Authentifizierung und Timeout ergänzt.
- Race-Conditions und stale responses behoben.
- Extension-Fokus und Webview-Reinitialisierung korrigiert.
- Veraltete `loadKeyFromEnv`-Logik entfernt.

### 6. Tatsächlicher Build — AUSSTEHEND / BLOCKIERT

Auszuführen:

```powershell
cd "C:\Users\CARLOS\PROJEKTE\DER WEGWEISER\extensions\phi-pilot-fusion"
npm install --ignore-scripts
npm run compile
```

Erwartet:

- `out/extension.js`
- `out/phiEngine.js`
- keine TypeScript-Fehler

Der aktuelle Pi-Shell-Runner liefert weiterhin `Das System kann den angegebenen Pfad nicht finden`. Deshalb ist dieser Schritt in der laufenden Session nicht als erledigt zu markieren.

### 7. Installer — ERSTELLT, AUSFÜHRUNG AUSSTEHEND

Dateien auf dem Desktop:

- `install-phi-pilot-fusion.ps1`
- `install-phi-pilot-fusion.cmd`

Der Installer soll:

1. Node/npm und Git Bash prüfen.
2. `~/.pi/agent/settings.json` auf die funktionierende Git-Bash setzen.
3. Extension kompilieren.
4. VSIX erstellen.
5. Alte Open-Agent/PilotStudio-Extension-Verzeichnisse und IDs entfernen.
6. vorhandene API-Konfiguration in `.env.local` übernehmen.
7. `google.geminicodeassist` über den IDE-Startparameter deaktivieren.
8. die neue VSIX installieren.
9. einen dauerhaften Desktop-Launcher erstellen.
10. AGY-IDE direkt starten.

### 8. Installer-Test — AUSSTEHEND

Nach Ausführung des Installers prüfen:

- Exit-Code `0`.
- VSIX wurde erzeugt.
- neue Extension ist installiert.
- alte Extensions sind nicht mehr aktiv.
- AGY-IDE-Prozess startet.
- Gemini Code Assist wird mit `--disable-extension google.geminicodeassist` nicht geladen.
- Phi Pilot Sidebar ist sichtbar.

### 9. GUI-Smoke-Test — AUSSTEHEND

In AGY-IDE prüfen:

- Sidebar öffnet.
- Agent-Liste erscheint.
- Agent-Wechsel funktioniert.
- Key-Status ist korrekt.
- Chat sendet eine Anfrage.
- Antwort erscheint ohne JSON-Fragmente.
- Clear verhindert alte Antworten.
- Providerfehler werden verständlich angezeigt.
- Settings/Terminal öffnen.

### 10. Abschlusskriterien

Die Aufgabe ist erst abgeschlossen, wenn:

- `npm run compile` erfolgreich ist.
- Installer erfolgreich durchläuft.
- AGY-IDE automatisch startet.
- Phi Pilot Fusion als Sidebar sichtbar ist.
- mindestens ein Provider live antwortet.
- Gemini Code Assist deaktiviert ist.
- keine Regression im Chat-/Agent-Wechsel sichtbar ist.

## Sicherheitsnotiz

Der Installer enthält API-Schlüssel gemäß Anforderung. Nach erfolgreicher Installation sollten die Schlüssel aus dem Installer entfernt und die verwendeten Schlüssel rotiert werden, falls die Datei außerhalb des Rechners geteilt wurde.
cd "C:\Users\CARLOS\PROJEKTE\DER WEGWEISER\extensions\phi-pilot-fusion"
npm install --ignore-scripts
npm run compile
