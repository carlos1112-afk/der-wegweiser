"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const phiEngine_1 = require("./phiEngine");
const MAX_HISTORY_MESSAGES = 24;
function activate(context) {
    const engine = new phiEngine_1.PhiEngine();
    const provider = new PhiPilotViewProvider(context.extensionUri, engine);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(PhiPilotViewProvider.viewType, provider));
    context.subscriptions.push(vscode.commands.registerCommand('phiPilotFusion.openChat', () => {
        vscode.commands.executeCommand('workbench.action.openView', PhiPilotViewProvider.viewType);
    }), vscode.commands.registerCommand('phiPilotFusion.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'phiPilotFusion');
    }), vscode.commands.registerCommand('phiPilotFusion.openTerminal', () => {
        const terminal = vscode.window.createTerminal('Phi Pilot Terminal');
        terminal.show();
    }), vscode.commands.registerCommand('phiPilotFusion.clearChat', () => {
        provider.clearChat();
    }), vscode.commands.registerCommand('phiPilotFusion.runCommand', async () => {
        const input = await vscode.window.showInputBox({
            prompt: 'Phi Pilot Befehl',
            placeHolder: 'z.B. Erstelle eine E-Bike Route von München zum Starnberger See'
        });
        if (!input)
            return;
        // View zuerst öffnen, damit die Nachricht garantiert ankommt.
        await vscode.commands.executeCommand('workbench.action.openView', PhiPilotViewProvider.viewType);
        // Kurz warten, bis der WebviewViewProvider resolved ist, sonst geht die Nachricht ins Leere.
        await new Promise((r) => setTimeout(r, 250));
        await provider.sendUserMessage(input, true);
    }));
    // Config-Validierung beim Start
    const validation = engine.validateConfig();
    if (!validation.ok) {
        vscode.window.showWarningMessage(`Phi Pilot Fusion: ${validation.message}`);
    }
    vscode.commands.executeCommand('setContext', 'phiPilotFusion.active', true);
}
class PhiPilotViewProvider {
    constructor(_extensionUri, _engine) {
        this._extensionUri = _extensionUri;
        this._engine = _engine;
        this._history = [];
        this._requestGeneration = 0;
        this._pendingMessages = [];
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);
        // Nachrichten, die vor dem Resolve eingegangen sind, verarbeiten (nur letzte).
        const queued = this._pendingMessages.splice(0);
        if (queued.length > 0) {
            const text = queued[queued.length - 1];
            void this.handleUserMessage(text);
        }
        this._messageDisposable?.dispose();
        this._messageDisposable = webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage': {
                    await this.handleUserMessage(data.text);
                    break;
                }
                case 'clearChat': {
                    this.clearChat();
                    break;
                }
                case 'openSettings': {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'phiPilotFusion');
                    break;
                }
                case 'openTerminal': {
                    vscode.commands.executeCommand('phiPilotFusion.openTerminal');
                    break;
                }
                case 'ready': {
                    // UI is ready → send agent list + config + welcome
                    this.sendAgentList();
                    const v = this._engine.validateConfig();
                    this._view?.webview.postMessage({ type: 'configStatus', ok: v.ok, message: v.message });
                    this._view?.webview.postMessage({
                        type: 'assistantMessage',
                        content: '🚀 **Phi Pilot Fusion** bereit! Wähle oben einen Agenten und stell deine Frage. Ich helfe bei E-Bike-Routen, Ladesäulen, CO2-Berechnungen und Code-Fragen.'
                    });
                    break;
                }
                case 'switchAgent': {
                    const ok = this._engine.setAgent(data.agentId);
                    if (ok) {
                        this._requestGeneration++;
                        this._view?.webview.postMessage({ type: 'setLoading', loading: false });
                        const entry = this._engine.currentAgentEntry;
                        this._view?.webview.postMessage({
                            type: 'agentSwitched',
                            info: `${entry.icon} ${entry.label} — ${entry.description}`
                        });
                        const v = this._engine.validateConfig();
                        this._view?.webview.postMessage({ type: 'configStatus', ok: v.ok, message: v.message });
                    }
                    break;
                }
            }
        });
        webviewView.onDidDispose(() => {
            this._requestGeneration++;
            this._messageDisposable?.dispose();
            this._messageDisposable = undefined;
            if (this._view === webviewView)
                this._view = undefined;
        });
    }
    sendAgentList() {
        const agents = this._engine.getAvailableAgents();
        this._view?.webview.postMessage({
            type: 'agentList',
            agents,
            current: this._engine.currentAgent
        });
    }
    async sendUserMessage(text, showUserBubble = false) {
        if (!this._view) {
            // View ist noch nicht resolved → Nachricht puffern, wird beim nächsten Resolve verarbeitet.
            this._pendingMessages.push(text);
            return;
        }
        if (showUserBubble) {
            this._view.webview.postMessage({ type: 'userMessage', content: text });
        }
        await this.handleUserMessage(text);
    }
    async handleUserMessage(text) {
        if (!text || !text.trim())
            return;
        const requestGeneration = ++this._requestGeneration;
        const userMsg = { role: 'user', content: text };
        this._history.push(userMsg);
        if (this._history.length > MAX_HISTORY_MESSAGES) {
            this._history.splice(0, this._history.length - MAX_HISTORY_MESSAGES);
        }
        this._view?.webview.postMessage({ type: 'setLoading', loading: true });
        try {
            const response = await this._engine.sendMessage(this._history, (chunk) => {
                if (requestGeneration === this._requestGeneration) {
                    this._view?.webview.postMessage({ type: 'streamChunk', chunk });
                }
            });
            if (requestGeneration !== this._requestGeneration)
                return;
            const assistantMsg = { role: 'assistant', content: response };
            this._history.push(assistantMsg);
            this._view?.webview.postMessage({ type: 'assistantMessage', content: response });
        }
        catch (err) {
            if (requestGeneration === this._requestGeneration) {
                const error = err.message || String(err);
                this._view?.webview.postMessage({ type: 'errorMessage', error });
            }
        }
        finally {
            if (requestGeneration === this._requestGeneration) {
                this._view?.webview.postMessage({ type: 'setLoading', loading: false });
            }
        }
    }
    clearChat() {
        this._requestGeneration++;
        this._history = [];
        this._view?.webview.postMessage({ type: 'clearChat' });
        this._view?.webview.postMessage({ type: 'setLoading', loading: false });
        this._view?.webview.postMessage({
            type: 'assistantMessage',
            content: 'Chat zurückgesetzt. 🚀 Bereit für die nächste Frage!'
        });
    }
    _getHtml(webview) {
        const candidates = [
            path.join(this._extensionUri.fsPath, 'src', 'ui', 'index.html'),
            path.join(this._extensionUri.fsPath, 'out', 'ui', 'index.html'),
            path.join(this._extensionUri.fsPath, 'media', 'index.html'),
        ];
        for (const htmlPath of candidates) {
            if (!fs.existsSync(htmlPath))
                continue;
            let html = fs.readFileSync(htmlPath, 'utf8');
            const nonce = this._getNonce();
            html = html.replace(/{{nonce}}/g, nonce);
            html = html.replace(/{{cspSource}}/g, webview.cspSource);
            return html;
        }
        return `<!DOCTYPE html><html><body><h3>Phi Pilot Fusion</h3><p>UI nicht gefunden.</p></body></html>`;
    }
    _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
PhiPilotViewProvider.viewType = 'phiPilotFusion.chatView';
function deactivate() {
    // Kein setContext(false): würde das Keybinding beim Entladen deaktivieren,
    // obwohl die View weiterhin geöffnet sein kann. Disposables räumen bereits auf.
}
//# sourceMappingURL=extension.js.map