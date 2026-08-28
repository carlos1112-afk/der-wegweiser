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
exports.PhiEngine = exports.DEFAULT_AGENT = exports.agentRegistry = void 0;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
exports.agentRegistry = {
    'gemini-2.0-flash-thinking-exp': {
        label: 'Gemini 2.0 Thinking (Experimental)', description: 'Kostenlos · Erweitertes logisches Denken & Reasoning',
        tier: 'free', icon: '🔮', provider: 'firebase-googleai', model: 'gemini-2.0-flash-thinking-exp-01-21',
    },
    'expert-route-planner': {
        label: 'Expert E-Bike Route Planner', description: 'Spezialisiert auf Akku-optimierte & landschaftlich schöne Routen',
        tier: 'free', icon: '🚲', provider: 'firebase-googleai', model: 'gemini-2.0-flash',
        systemInstruction: `Du bist der absolute E-Bike-Routen-Experte "Wegweiser-CoPilot". Deine Aufgabe ist es, für Touren eine packende, motivierende Kurzbeschreibung auf Deutsch zu schreiben. Fokussiere dich besonders auf e-bike-spezifische Aspekte wie Akkuverbrauch, Ladesäulen, Untergrundbeschaffenheit und Steigungen. Halte dich strikt an 2 bis maximal 3 Sätze.`,
    },
    'firebase-googleai-flash': {
        label: 'Firebase Gemini Flash', description: 'Kostenlos · Firebase Auth · Gemini Dev API',
        tier: 'free', icon: '🔥', provider: 'firebase-googleai', model: 'gemini-2.0-flash',
    },
    'firebase-googleai-lite': {
        label: 'Firebase Gemini Lite', description: 'Kostenlos · Firebase Auth · Ultraschnell',
        tier: 'free', icon: '🆓', provider: 'firebase-googleai', model: 'gemini-2.0-flash-lite',
    },
    'vertex-cloud-flash': {
        label: 'Vertex AI Flash (Cloud Credits)', description: 'Kostenlos via GCP Credits · eu-west3 · Vertex AI',
        tier: 'cloud', icon: '☁️', provider: 'vertexai', model: 'gemini-2.5-flash',
    },
    'vertex-cloud-lite': {
        label: 'Vertex AI Lite (Cloud Credits)', description: 'Schnellste Cloud-Option · GCP Free Credits',
        tier: 'cloud', icon: '🌤️', provider: 'vertexai', model: 'gemini-2.5-flash-lite-preview-06-17',
    },
    'vertex-cloud-pro': {
        label: 'Vertex AI Pro (Cloud Credits)', description: 'Mächtigster Agent · GCP Credits · Vertex AI',
        tier: 'cloud', icon: '🌩️', provider: 'vertexai', model: 'gemini-2.5-pro',
    },
    'openrouter-deepseek': {
        label: 'DeepSeek R1 (OpenRouter)', description: 'Offener Agent · Nutzt OpenRouter API',
        tier: 'free', icon: '🐳', provider: 'openrouter', model: 'deepseek/deepseek-r1:free',
    },
    'openrouter-qwen': {
        label: 'Qwen 3 (OpenRouter)', description: 'Starkes offenes Modell via OpenRouter',
        tier: 'free', icon: '🏮', provider: 'openrouter', model: 'qwen/qwen3-30b-a3b:free',
    },
    'hf-mistral': {
        label: 'Mistral 7B (HuggingFace)', description: 'Beliebtes OpenSource-Modell via HF',
        tier: 'flash', icon: '🤗', provider: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.2',
    },
    'pi-agent': {
        label: 'Pi Agent (Inflection)', description: 'Empathischer Assistent · (Custom Endpoint)',
        tier: 'lite', icon: '🥧', provider: 'pi', model: 'inflection-3-pi',
    },
    'phi-pilot-fusion': {
        label: 'Phi Pilot Fusion', description: 'KI-Routenplanung mit Microsoft Phi-3 & Pilot Studio Integration',
        tier: 'pro', icon: '🚀', provider: 'huggingface', model: 'microsoft/Phi-3-mini-4k-instruct',
        systemInstruction: `Du bist ein vollständiger E-Bike Assistent mit allen Pilot Studio Features:

1. ROUTENPLANUNG:
- Generiere präzise, landschaftlich schöne Routen mit optimalem Akkuverbrauch
- Berücksichtige Ladesäulen, Untergrund und Steigungen
- Berechne CO2-Einsparungen vs. PKW (122g/km)
- Empfehle Token-basierte Belohnungen für Community-Beiträge

2. PILOT STUDIO FEATURES:
- Analysiere Umweltauswirkungen in Echtzeit
- Berechne Token-Gutschriften für Ladesäulen-Scans (+20 Tokens)
- Generiere Offline-Kartenregionen für Funklöcher
- Synchronisiere Routen mit Bosch Kiox/Nyon Displays

3. FORMATIERUNG:
- Antworte immer auf Deutsch
- Halte dich strikt an 2-3 Sätze für Kurzbeschreibungen
- Gib CO2-Werte in kg und Bäume/Jahr an
- Zeige Token-Belohnungen explizit an (🪙 +20 Tokens)

4. ENTWICKLER-ASSISTENT:
- Beantworte Fragen zum Wegweiser-Codebase
- Hilfe bei Firebase, React, TypeScript, Vite
- Erkläre Fehler und schlage konkrete Fixes vor`,
    },
    'gemini-3.6-flash': {
        label: 'Gemini 3.6 Flash', description: 'Neuestes Flash-Modell',
        tier: 'pro', icon: '🧠', provider: 'apikey', model: 'gemini-3.6-flash',
    },
    'gemini-3.5-flash': {
        label: 'Gemini 3.5 Flash', description: 'Schnell & präzise — Standardwahl',
        tier: 'flash', icon: '⚡', provider: 'apikey', model: 'gemini-3.5-flash',
    },
    'gemini-3.5-flash-lite': {
        label: 'Gemini 3.5 Flash Lite', description: 'Ultraschnell, minimaler Akkuverbrauch',
        tier: 'lite', icon: '🚀', provider: 'apikey', model: 'gemini-3.5-flash-lite',
    },
};
exports.DEFAULT_AGENT = 'phi-pilot-fusion';
class PhiEngine {
    constructor() {
        this._currentAgent = exports.DEFAULT_AGENT;
        const config = vscode.workspace.getConfiguration('phiPilotFusion');
        const cfgAgent = config.get('agent');
        if (cfgAgent && exports.agentRegistry[cfgAgent]) {
            this._currentAgent = cfgAgent;
        }
    }
    get currentAgent() { return this._currentAgent; }
    get currentAgentEntry() { return exports.agentRegistry[this._currentAgent]; }
    setAgent(id) {
        if (!exports.agentRegistry[id])
            return false;
        this._currentAgent = id;
        vscode.workspace.getConfiguration('phiPilotFusion').update('agent', id, vscode.ConfigurationTarget.Global);
        return true;
    }
    getAvailableAgents() {
        const keys = this.loadKeysFromEnv();
        return Object.entries(exports.agentRegistry).map(([id, entry]) => ({
            id,
            entry: { label: entry.label, description: entry.description, tier: entry.tier, icon: entry.icon, provider: entry.provider, model: entry.model },
            available: this.isAgentAvailable(id, keys),
        }));
    }
    isAgentAvailable(id, keys) {
        const entry = exports.agentRegistry[id];
        if (!entry)
            return false;
        switch (entry.provider) {
            case 'firebase-googleai':
            case 'apikey':
                return !!keys.gemini;
            case 'vertexai':
                return !!keys.gcpProject;
            case 'openrouter':
                return !!keys.openrouter;
            case 'huggingface':
                return !!keys.huggingface;
            case 'pi':
                return !!keys.pi;
            default:
                return false;
        }
    }
    loadKeysFromEnv() {
        const keys = {
            huggingface: process.env.VITE_HUGGINGFACE_API_KEY || process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN,
            gemini: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
            openrouter: process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
            pi: process.env.VITE_PI_API_KEY || process.env.INFLECTION_API_KEY,
            firebaseApiKey: process.env.VITE_FIREBASE_API_KEY,
            gcpProject: process.env.VITE_GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT,
            gcpLocation: process.env.VITE_GCP_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'europe-west3',
        };
        const ws = vscode.workspace.workspaceFolders?.[0];
        const config = vscode.workspace.getConfiguration('phiPilotFusion');
        try {
            if (ws) {
                const envPath = path.join(ws.uri.fsPath, '.env.local');
                if (fs.existsSync(envPath)) {
                    const content = fs.readFileSync(envPath, 'utf8');
                    for (const line of content.split('\n')) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith('#'))
                            continue;
                        const idx = trimmed.indexOf('=');
                        if (idx < 0)
                            continue;
                        const key = trimmed.slice(0, idx).trim();
                        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
                        if (key === 'VITE_HUGGINGFACE_API_KEY')
                            keys.huggingface = val;
                        if (key === 'VITE_GEMINI_API_KEY')
                            keys.gemini = val;
                        if (key === 'VITE_OPENROUTER_API_KEY')
                            keys.openrouter = val;
                        if (key === 'VITE_PI_API_KEY')
                            keys.pi = val;
                        if (key === 'VITE_FIREBASE_API_KEY')
                            keys.firebaseApiKey = val;
                        if (key === 'VITE_GCP_PROJECT_ID' || key === 'GOOGLE_CLOUD_PROJECT' || key === 'GCP_PROJECT')
                            keys.gcpProject = val;
                        if (key === 'VITE_GCP_LOCATION')
                            keys.gcpLocation = val;
                    }
                }
            }
            // VS Code settings override .env.local and process environment.
            const cfgHF = config.get('huggingfaceApiKey');
            if (cfgHF)
                keys.huggingface = cfgHF;
            const cfgGem = config.get('geminiApiKey');
            if (cfgGem)
                keys.gemini = cfgGem;
            const cfgOR = config.get('openrouterApiKey');
            if (cfgOR)
                keys.openrouter = cfgOR;
        }
        catch { /* keep environment fallback */ }
        return keys;
    }
    validateConfig() {
        const keys = this.loadKeysFromEnv();
        if (this.isAgentAvailable(this._currentAgent, keys)) {
            return { ok: true, message: `Agent "${this.currentAgentEntry.label}" bereit (${this.currentAgentEntry.provider})` };
        }
        return {
            ok: false,
            message: `API Key für Provider "${this.currentAgentEntry.provider}" fehlt. .env.local prüfen oder Settings → Phi Pilot Fusion.`,
        };
    }
    // ─── Main dispatch ────────────────────────────────────────────────────────
    async sendMessage(messages, onChunk) {
        const keys = this.loadKeysFromEnv();
        const agent = this.currentAgentEntry;
        const systemInstruction = agent.systemInstruction;
        if (!this.isAgentAvailable(this._currentAgent, keys)) {
            throw new Error(`Provider "${agent.provider}" ist nicht konfiguriert. API-Key oder GCP-Anmeldung fehlt.`);
        }
        switch (agent.provider) {
            case 'openrouter':
                return this.callOpenAICompat('https://openrouter.ai/api/v1/chat/completions', keys.openrouter, agent.model, messages, systemInstruction, onChunk, { 'HTTP-Referer': 'https://github.com/pilotstudio', 'X-Title': 'Phi Pilot Fusion' });
            case 'huggingface':
                return this.callOpenAICompat('https://api-inference.huggingface.co/v1/chat/completions', keys.huggingface, agent.model, messages, systemInstruction, onChunk);
            case 'pi':
                return this.callOpenAICompat('https://api.inflection.ai/v1/chat/completions', keys.pi, agent.model, messages, systemInstruction, onChunk);
            case 'vertexai':
                return this.callVertex(keys, agent.model, messages, systemInstruction, onChunk);
            case 'firebase-googleai':
            case 'apikey':
                return this.callGemini(keys.gemini, agent.model, messages, systemInstruction, onChunk);
            default:
                throw new Error(`Unbekannter Provider: ${agent.provider}`);
        }
    }
    // ─── OpenAI-compatible endpoint (OpenRouter, HuggingFace, Pi) ──────────────
    callOpenAICompat(url, apiKey, model, messages, systemInstruction, onChunk, extraHeaders) {
        const apiMessages = [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            ...messages.map(m => ({ role: m.role, content: m.content })),
        ];
        const postData = JSON.stringify({ model, messages: apiMessages, max_tokens: 2048, stream: false });
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(postData)),
            ...(extraHeaders || {}),
        };
        return this.httpPost(url, postData, headers, (data) => {
            const parsed = JSON.parse(data);
            const errMsg = parsed.error?.message ?? parsed.error;
            if (errMsg)
                throw new Error(`${model}: ${errMsg}`);
            const text = parsed.choices?.[0]?.message?.content || parsed[0]?.generated_text || 'Keine Antwort.';
            onChunk?.(text);
            return text.trim();
        });
    }
    // ─── Vertex AI REST API (requires gcloud ADC/login) ────────────────────────
    callVertex(keys, model, messages, systemInstruction, onChunk) {
        if (!keys.gcpProject) {
            return Promise.reject(new Error('GCP-Projekt fehlt. Setze VITE_GCP_PROJECT_ID oder GOOGLE_CLOUD_PROJECT.'));
        }
        return new Promise((resolve, reject) => {
            (0, child_process_1.execFile)('gcloud', ['auth', 'print-access-token'], { windowsHide: true, timeout: 20000 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Vertex AI benötigt eine gcloud-Anmeldung: ${String(stderr) || error.message}`));
                    return;
                }
                const token = String(stdout).trim();
                if (!token) {
                    reject(new Error('gcloud liefert kein Access-Token. Führe "gcloud auth login" aus.'));
                    return;
                }
                const location = keys.gcpLocation || 'europe-west3';
                const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(keys.gcpProject)}/locations/${location}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
                this.callGeminiRequest(url, token, undefined, model, messages, systemInstruction, onChunk).then(resolve, reject);
            });
        });
    }
    // ─── Google Gemini REST API (firebase-googleai, apikey) ───────────────────
    callGemini(apiKey, model, messages, systemInstruction, onChunk) {
        // Prefer header-based API key auth; query-key remains as fallback for older gateways.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        return this.callGeminiRequest(url, undefined, apiKey, model, messages, systemInstruction, onChunk);
    }
    callGeminiRequest(url, authToken, apiKey, model, messages, systemInstruction, onChunk) {
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
        const body = { contents };
        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        const postData = JSON.stringify(body);
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(postData)),
        };
        if (authToken)
            headers.Authorization = `Bearer ${authToken}`;
        if (apiKey)
            headers['x-goog-api-key'] = apiKey;
        return this.httpPost(url, postData, headers, (data) => {
            const parsed = JSON.parse(data);
            const errMsg = parsed.error?.message;
            if (errMsg)
                throw new Error(`Gemini ${model}: ${errMsg}`);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'Keine Antwort vom Modell.';
            onChunk?.(text);
            return text.trim();
        });
    }
    // ─── Shared HTTPS POST helper ──────────────────────────────────────────────
    httpPost(url, postData, headers, parseFn) {
        let settled = false;
        let timer;
        const finish = (fn) => {
            if (!settled) {
                settled = true;
                if (timer)
                    clearTimeout(timer);
                fn();
            }
        };
        return new Promise((resolve, reject) => {
            const req = https.request(url, { method: 'POST', headers }, (res) => {
                let data = '';
                const statusCode = res.statusCode ?? 0;
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => {
                    try {
                        if (statusCode < 200 || statusCode >= 300) {
                            let detail = data.slice(0, 500);
                            try {
                                const parsed = JSON.parse(data);
                                detail = parsed.error?.message ?? parsed.error ?? detail;
                            }
                            catch { /* use raw response */ }
                            throw new Error(`HTTP ${statusCode}: ${detail}`);
                        }
                        const text = parseFn(data);
                        finish(() => resolve(text));
                    }
                    catch (e) {
                        finish(() => reject(e));
                    }
                });
            });
            req.on('error', (e) => finish(() => reject(e)));
            req.write(postData);
            req.end();
            timer = setTimeout(() => {
                req.destroy();
                finish(() => reject(new Error('Anfrage hat das Zeitlimit überschritten (120s).')));
            }, 120000);
        });
    }
}
exports.PhiEngine = PhiEngine;
//# sourceMappingURL=phiEngine.js.map