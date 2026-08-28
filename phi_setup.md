# Phi — Setup-Anleitung

Diese Anleitung führt dich einmalig durch die Schritte, um den **nativen Agenten** der AGY-IDE zu deaktivieren und **Phi** vollwertig auf der **rechten Seite** einzurichten.

> ⚠️ **Wichtig**: Einstellungen in der AGY-IDE / VS Code werden automatisch von `.vscode/settings.json` und `.vscode/keybindings.json` in diesem Projekt geladen. Du musst also nur die unten stehenden drei Punkte einmal manuell erledigen.

---

## 1. Native Agent (`undefined_publisher.agy-ide-open-agent`) deaktivieren

Der native Agent der AGY-IDE ist als Sidebar-View `Open Agent Chat` im linken Activity-Bar installiert. VS Code bietet keine reine JSON-Einstellung, um eine installierte Extension abzuschalten — daher:

### A) View verstecken (empfohlen, 1 Klick)
1. Öffne die View **Open Agent Chat** im linken Activity-Bar (Bot-Symbol 🤖)
2. **Rechtsklick** auf den View-Header
3. Wähle **„Hide Open Agent Chat"**

→ Damit wird die View ausgeblendet. Der Agent aktiviert sich auch nur, wenn die View geöffnet wird (`onView:openAgent.sidebarView`) — wenn die View versteckt ist, wird er nie geladen.

### B) Extension komplett deaktivieren
Falls du die Extension komplett entfernen willst:
1. `Ctrl+Shift+X` → Extensions öffnen
2. Suche nach `AGY-IDE Open Agent` (`undefined_publisher.agy-ide-open-agent`)
3. Klick auf **Disable** (oder **Disable in Workspace**)

### C) Über die Kommandozeile
Falls A und B nicht greifen:
```powershell
& "C:\Users\CARLOS\AppData\Local\Programs\AntigravityIDE\AntigravityIDE.exe" `
    --disable-extension undefined_publisher.agy-ide-open-agent
```

> ℹ️ Die Datei `.vscode/extensions.json` setzt die Extension bereits auf `unwantedRecommendations`. Beim nächsten Workspace-Install wird sie nicht mehr vorgeschlagen.

---

## 2. Phi nach **rechts** verschieben (Secondary Side Bar / Auxiliary Bar)

Phi registriert sich aktuell im **linken Activity-Bar** (`viewsContainers.activitybar`). So bringst du ihn auf die rechte Seite:

### Schritt 1 — View verschieben
1. **Rechtsklick** auf das **Phi-Icon** (Φ) im linken Activity-Bar
2. Wähle **„Move to Secondary Side Bar"** (oder „Move to Right")
3. Das Phi-Icon verschwindet aus dem linken Bar und erscheint rechts

### Schritt 2 — Layout speichern
Das Layout wird automatisch im IDE-State persistiert. Sobald du es einmal gesetzt hast, bleibt es bestehen.

### Schritt 3 — Schnellzugriff
`Ctrl+Shift+L` öffnet das Phi-Chat-Panel jetzt direkt auf der rechten Seite.

---

## 3. Comments + Phi einrichten

VS Code hat eine eingebaute **Comments/Review**-Funktion. Mit den Keybindings aus `.vscode/keybindings.json` arbeitet sie direkt mit Phi zusammen:

### Comments anlegen/antworten
| Aktion | Shortcut | Befehl |
|---|---|---|
| Kommentar auf aktueller Zeile | `Ctrl+/` | `editor.action.addCommentLine` |
| Kommentar auf Selektion | `Ctrl+K Ctrl+C` | `editor.action.addCommentLine` |
| Auf Kommentar antworten | `Ctrl+Shift+Alt+C` | `workbench.action.addComment` |
| **Selektion → Phi-Chat** | `Ctrl+Shift+=` | `phi.addSelectionToChat` |
| **Selektion → Phi-Frage** | `Ctrl+Alt+A` | `phi.askAboutSelection` |
| **Kommentar → Phi-Frage** | `Ctrl+Shift+Alt+P` | `phi.askAboutSelection` |

### So nutzt du es
1. Code markieren
2. `Ctrl+/` → ein Review-Kommentar wird erstellt
3. Auf den Kommentar antworten mit `Ctrl+Shift+Alt+P` → öffnet Phi mit dem markierten Kontext
4. Phi kann direkt Änderungen vorschlagen, die du mit den Standard-Diff-Buttons annehmen oder ablehnen kannst

### Phi mit Live-Kontext
- **Datei aus Explorer hinzufügen**: Rechtsklick auf Datei → „Phi: Add File to Chat"
- **Bild / Screenshot einfügen**: `Ctrl+V` im Chat-Eingabefeld, wenn ein Bild in der Zwischenablage ist
- **Symbolsuche**: `phi.openTree` (`Ctrl+Shift+K`) öffnet den Conversation-Tree zum Springen zwischen Branches

---

## 4. Phi-Login überprüfen

Du bist bereits eingeloggt (siehe `C:\Users\CARLOS\.phi\auth.json`):

| Provider | Typ |
|---|---|
| OpenRouter | API-Key |
| Google Gemini CLI | OAuth (Projekt `der-wegweiser`) |
| Google Antigravity | OAuth (Projekt `rising-fact-p41fc`) |
| HuggingFace | API-Key |
| Groq | API-Key |

Trotzdem prüfe nach der Umstellung:
1. `Ctrl+Shift+I` → öffnet **Phi: Login** (oder das Command-Palette mit „Phi: Login")
2. Verfügbare Modelle erscheinen im Header-Dropdown — wechsel zwischen OpenRouter, Google, Groq, etc.
3. Falls kein Modell verfügbar ist, wird der Header automatisch zu einem **Login-Button**

> 💡 **Tipp**: In Phi-Einstellungen → „Manage Pi Extensions" kannst du einzelne Pi-Extensions (z. B. die alten `google-gemini-cli`/`google-antigravity` Provider) abschalten, falls du sie nicht brauchst. Die Verwaltung erfolgt über Phi's eigene Settings-UI, nicht über `settings.json`.

---

## 5. Zusätzliche Tipps

### Phi-Panel-Schnellauswahl
* `Ctrl+Shift+L` — Phi-Chat öffnen/schließen
* `Ctrl+Shift+N` — neue Konversation
* `Ctrl+Shift+K` — Conversation-Tree (Branches)
* `Esc` im Panel — laufende Antwort abbrechen

### Compact / Reset
* Im Panel-Header auf das **Befehls-Symbol (⋮)** → **Compact** komprimiert lange Sessions
* **Session Stats** zeigt Token-Aufkommen und Kosten pro Provider

### Modelle / Thinking-Level
* Im Header-Dropdown Modell wählen → das Reasoning-Level (`off/low/medium/high`) ist direkt daneben

---

## 6. Rollback

Falls du zum nativen Agenten zurückkehren möchtest:
1. Diese Datei löschen
2. `.vscode/settings.json` → Einträge `workbench.view.openAgent.sidebarView.visible` und `workbench.view.open-agent-container.visible` auf `true` setzen (oder entfernen)
3. Phi-View im rechten Auxiliary-Bar rechtsklicken → „Move to Left Activity Bar"
4. Native Agent wieder aktivieren via Extensions-Panel

Viel Spaß mit Phi! 🪼
