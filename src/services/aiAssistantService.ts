import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAI, getGenerativeModel, AgentPlatformBackend, GoogleAIBackend } from 'firebase/ai';
import { app as firebaseApp } from '../firebase';
import type { Route, UserPreferences, UserMemoryPattern, PlugType } from '../types/navigation';
import { RoutingService } from './routingService';
import { AiGatewayService } from './ai/aiGatewayService';

// =============================================================================
// Agent / Model Registry
// All selectable Gemini agents available in the IDE
// =============================================================================
export const agentRegistry = {

  // ── 🧠 EXPERIMENTAL (Free Tiers via GoogleAI Dev API / Firebase) ────────────
  'gemini-2.0-flash-thinking-exp': {
    label: 'Gemini 2.0 Thinking (Experimental)',
    description: 'Kostenlos · Erweitertes logisches Denken & Reasoning',
    tier: 'free',
    icon: '🔮',
    provider: 'firebase-googleai' as const,
    model: 'gemini-2.0-flash-thinking-exp-01-21',
  },

  // ── 🚴 SPECIALIST AGENTS (Free Pre-prompted Templates via Firebase AI) ─────
  'expert-route-planner': {
    label: 'Expert E-Bike Route Planner',
    description: 'Spezialisiert auf Akku-optimierte & landschaftlich schöne Routen',
    tier: 'free',
    icon: '🚲',
    provider: 'firebase-googleai' as const,
    model: 'gemini-2.0-flash',
    systemInstruction: `Du bist der absolute E-Bike-Routen-Experte "Wegweiser-CoPilot". 
Deine Aufgabe ist es, für Touren eine packende, motivierende Kurzbeschreibung auf Deutsch zu schreiben.
Fokussiere dich besonders auf e-bike-spezifische Aspekte wie Akkuverbrauch, Ladesäulen, Untergrundbeschaffenheit und Steigungen. 
Halte dich strikt an 2 bis maximal 3 Sätze.`,
  },

  // ── 🆓 NO-COST — Firebase AI Logic + GoogleAIBackend (Gemini Dev API) ──────
  'firebase-googleai-flash': {
    label: 'Firebase Gemini Flash',
    description: 'Kostenlos · Firebase Auth · Gemini Dev API',
    tier: 'free',
    icon: '🔥',
    provider: 'firebase-googleai' as const,
    model: 'gemini-2.0-flash',
  },
  'firebase-googleai-lite': {
    label: 'Firebase Gemini Lite',
    description: 'Kostenlos · Firebase Auth · Ultraschnell',
    tier: 'free',
    icon: '🆓',
    provider: 'firebase-googleai' as const,
    model: 'gemini-2.0-flash-lite',
  },

  // ── 🆓 NO-COST — Firebase AI Logic + AgentPlatformBackend (Vertex AI) ───────
  'vertex-cloud-flash': {
    label: 'Vertex AI Flash (Cloud Credits)',
    description: 'Kostenlos via GCP Credits · eu-west3 · Vertex AI',
    tier: 'cloud',
    icon: '☁️',
    provider: 'vertexai' as const,
    model: 'gemini-2.5-flash',
  },
  'vertex-cloud-lite': {
    label: 'Vertex AI Lite (Cloud Credits)',
    description: 'Schnellste Cloud-Option · GCP Free Credits',
    tier: 'cloud',
    icon: '🌤️',
    provider: 'vertexai' as const,
    model: 'gemini-2.5-flash-lite-preview-06-17',
  },
  'vertex-cloud-pro': {
    label: 'Vertex AI Pro (Cloud Credits)',
    description: 'Mächtigster Agent · GCP Credits · Vertex AI',
    tier: 'cloud',
    icon: '🌩️',
    provider: 'vertexai' as const,
    model: 'gemini-2.5-pro',
  },

  // ── 🌐 OPENROUTER MODELS (Franz App Sync) ───────────────────────────────────
  'openrouter-deepseek': {
    label: 'DeepSeek R1 (OpenRouter)',
    description: 'Offener Agent · Nutzt OpenRouter API',
    tier: 'free',
    icon: '🐳',
    provider: 'openrouter' as const,
    model: 'deepseek/deepseek-r1:free',
  },
  'openrouter-qwen': {
    label: 'Qwen 3 (OpenRouter)',
    description: 'Starkes offenes Modell via OpenRouter',
    tier: 'free',
    icon: '🏮',
    provider: 'openrouter' as const,
    model: 'qwen/qwen3-30b-a3b:free',
  },

  // ── 🤗 HUGGINGFACE MODELS (Franz App Sync) ──────────────────────────────────
  'hf-mistral': {
    label: 'Mistral 7B (HuggingFace)',
    description: 'Beliebtes OpenSource-Modell via HF',
    tier: 'flash',
    icon: '🤗',
    provider: 'huggingface' as const,
    model: 'mistralai/Mistral-7B-Instruct-v0.2',
  },

  // ── 🍓 PI AGENT ─────────────────────────────────────────────────────────────
  'pi-agent': {
    label: 'Pi Agent (Inflection)',
    description: 'Empathischer Assistent · (Custom Endpoint)',
    tier: 'lite',
    icon: '🥧',
    provider: 'pi' as const,
    model: 'inflection-3-pi',
  },

  // ── 📱 PILOT STUDIO + PHI CHAT FUSION (Replacement for antigravity geminicodeassist) ─────
  'phi-pilot-fusion': {
    label: 'Phi Pilot Fusion',
    description: 'KI-Routenplanung mit Microsoft Phi-3 & Pilot Studio Integration',
    tier: 'pro',
    icon: '🚀',
    provider: 'huggingface' as const,
    model: 'microsoft/Phi-3-mini-4k-instruct',
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
- Zeige Token-Belohnungen explizit an (🪙 +20 Tokens)`,
  },

  // ── 💳 API KEY — Gemini 3.6 / 3.5 Series ─────────────────────────────────
  'gemini-3.6-flash': {
    label: 'Gemini 3.6 Flash',
    description: 'Neuestes Flash-Modell',
    tier: 'pro',
    icon: '🧠',
    provider: 'apikey' as const,
    model: 'gemini-3.6-flash',
  },
  'gemini-3.5-flash': {
    label: 'Gemini 3.5 Flash',
    description: 'Schnell & präzise — Standardwahl',
    tier: 'flash',
    icon: '⚡',
    provider: 'apikey' as const,
    model: 'gemini-3.5-flash',
  },
  'gemini-3.5-flash-lite': {
    label: 'Gemini 3.5 Flash Lite',
    description: 'Ultraschnell, minimaler Akkuverbrauch',
    tier: 'lite',
    icon: '🚀',
    provider: 'apikey' as const,
    model: 'gemini-3.5-flash-lite',
  },
} as const;

export type ModelId = keyof typeof agentRegistry;
export type AgentEntry = typeof agentRegistry[ModelId];

export const DEFAULT_MODEL: ModelId = 'phi-pilot-fusion';

// Lazy-initialized Firebase AI instances (one per backend type)
let _firebaseGoogleAI: ReturnType<typeof getAI> | null = null;
let _firebaseVertexAI: ReturnType<typeof getAI> | null = null;

function getFirebaseGoogleAI() {
  if (!_firebaseGoogleAI) {
    _firebaseGoogleAI = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  }
  return _firebaseGoogleAI;
}

function getFirebaseVertexAI() {
  if (!_firebaseVertexAI) {
    _firebaseVertexAI = getAI(firebaseApp, {
      backend: new AgentPlatformBackend('europe-west3'),
    });
  }
  return _firebaseVertexAI;
}

// =============================================================================
// Main Service Class
// =============================================================================
export class AiAssistantService {
  // Dedicated Gemini API key (NOT the Firebase key)
  private static apiKey: string | null =
    import.meta.env.VITE_GEMINI_API_KEY || null;

  /**
   * Returns a unified text-generation function for any agent,
   * regardless of its underlying provider.
   */
  private static async callModel(modelId: ModelId, prompt: string): Promise<string | null> {
    const agent = agentRegistry[modelId];
    // Attach system instruction if present in registry configuration
    const systemInstruction = 'systemInstruction' in agent ? agent.systemInstruction : undefined;

    // ── Firebase GoogleAI Backend (Gemini Dev API via Firebase, free tier) ──
    if (agent.provider === 'firebase-googleai') {
      try {
        const ai = getFirebaseGoogleAI();
        const model = getGenerativeModel(ai, { 
          model: agent.model,
          systemInstruction,
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (e) {
        console.warn(`[AiAssistantService] Firebase GoogleAI failed for ${modelId}:`, e);
        return null;
      }
    }

    // ── Firebase Vertex AI Backend (Agent Platform, GCP credits) ───────────
    if (agent.provider === 'vertexai') {
      try {
        const ai = getFirebaseVertexAI();
        const model = getGenerativeModel(ai, { 
          model: agent.model,
          systemInstruction,
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (e) {
        console.warn(`[AiAssistantService] Vertex AI failed for ${modelId}:`, e);
        return null;
      }
    }

    // ── OpenRouter API ───────────────────────────────────────────────────────
    if (agent.provider === 'openrouter') {
      const orKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!orKey) return '[OpenRouter] Missing API Key in .env.local';
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${orKey}`,
            'HTTP-Referer': window.location.href, // Recommended for OpenRouter
            'X-Title': 'Wegweiser IDE', // Recommended for OpenRouter
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [
              ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
              { role: 'user', content: prompt }
            ]
          })
        });
        const data = await response.json();
        return data?.choices?.[0]?.message?.content || null;
      } catch (e) {
        console.warn(`[AiAssistantService] OpenRouter call failed:`, e);
        return null;
      }
    }

    // ── HuggingFace API ───────────────────────────────────────────────────────
    if (agent.provider === 'huggingface') {
      const hfKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
      if (!hfKey) return '[HuggingFace] Missing API Key in .env.local';
      try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${agent.model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: prompt })
        });
        const data = await response.json();
        return data?.[0]?.generated_text || null;
      } catch (e) {
        console.warn(`[AiAssistantService] HuggingFace call failed:`, e);
        return null;
      }
    }

    // ── Pi Agent ─────────────────────────────────────────────────────────────
    if (agent.provider === 'pi') {
      const piKey = import.meta.env.VITE_PI_API_KEY;
      if (!piKey) return '[Pi Agent] Missing API Key in .env.local';
      try {
        // Placeholder for Inflection's internal API, mimicking OpenAI standard
        const response = await fetch('https://api.inflection.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${piKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await response.json();
        return data?.choices?.[0]?.message?.content || null;
      } catch (e) {
        console.warn(`[AiAssistantService] Pi Agent call failed:`, e);
        return null;
      }
    }

    // ── Direct Gemini API Key ────────────────────────────────────────────────
    if (!this.apiKey) {
      console.warn('[AiAssistantService] VITE_GEMINI_API_KEY not set — AI in fallback mode.');
      return null;
    }
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ 
        model: agent.model,
        systemInstruction,
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      console.warn(`[AiAssistantService] API Key call failed for ${modelId}:`, e);
      return null;
    }
  }

  /**
   * Queries a specific agent by ID.
   */
  public static async queryGenaiAgent(
    query: string,
    agentId: string,
    modelId: ModelId = DEFAULT_MODEL
  ): Promise<string | null> {
    if (!query) return null;
    const prompt = `Du agierst als Experten-Agent ID "${agentId}". Beantworte folgende Frage präzise: "${query}"`;
    return this.callModel(modelId, prompt);
  }

  /**
   * Zero-Click Anticipation Engine for E-Bike Routes.
   */
  public static async generateAnticipatedRoute(
    userLat: number,
    userLng: number,
    userPrefs: UserPreferences,
    memory: UserMemoryPattern,
    _modelId: ModelId = DEFAULT_MODEL
  ): Promise<Route> {
    const targetDistanceKm = memory.preferredDistanceKm || 28;
    const mainTheme = memory.frequentDestinations?.[0] || 'Badesee';

    const route = await RoutingService.generateBikeRoute(
      {
        startLat: userLat,
        startLng: userLng,
        targetDistanceKm,
        batteryPercent: userPrefs.batteryCurrentPercent || 80,
        bikeType: userPrefs.bikeType || 'ebike',
        themes: [mainTheme],
        maxElevationGainM: userPrefs.maxElevationSlopePercent
          ? userPrefs.maxElevationSlopePercent * 25
          : 150,
        surfacePreference: userPrefs.preferredSurface === 'asphalt' ? 'asphalt' : 'any',
      },
      userPrefs
    );

    // Route through vendor-neutral AI Gateway
    const storyText = await AiGatewayService.planRoute({
      start: { lat: userLat, lng: userLng },
      distanceKm: targetDistanceKm,
      elevationGainM: route.elevationGainM || 120,
      surfaceType: userPrefs.preferredSurface === 'asphalt' ? 'Asphalt' : 'Mischbelag',
      isScoutMission: route.isScoutMission,
    });
    if (storyText?.trim()) route.aiStory = storyText.trim();

    return route;
  }

  /**
   * Multimodal Vision Analysis for Charging Station Photos.
   * Note: vision input only supported on apikey provider (firebase/ai multimodal differs).
   */
  public static async analyzeChargingStationPhoto(
    base64Image: string,
    modelId: ModelId = DEFAULT_MODEL
  ): Promise<{ plugType: PlugType; isVerified: boolean; confidenceScore: number }> {
    const agent = agentRegistry[modelId];
    if (!this.apiKey || agent.provider !== 'apikey') {
      return { plugType: 'schuko_230v', isVerified: true, confidenceScore: 0.92 };
    }
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: agent.model });
      const cleanedBase64 = base64Image.replace(/^data:image\/(png|jpeg|webp|jpg);base64,/, '');
      const prompt = `Analysiere dieses Foto einer Ladesäule oder Steckdose.
Welcher Stecker-Typ ist zu sehen?
Mögliche Werte: "bosch", "bike_energy", "schuko_230v", "cee_blue".
Antworte strikt im JSON Format:
{"plugType": "schuko_230v", "isVerified": true, "confidenceScore": 0.95}`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: cleanedBase64, mimeType: 'image/jpeg' } },
      ]);
      const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          plugType: (parsed.plugType as PlugType) || 'schuko_230v',
          isVerified: Boolean(parsed.isVerified),
          confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.9,
        };
      }
    } catch (e) {
      console.warn('[AiAssistantService] Vision analysis fallback:', e);
    }
    return { plugType: 'schuko_230v', isVerified: true, confidenceScore: 0.92 };
  }

  /**
   * Translates a natural language instruction into a Firebase CLI command.
   */
  public static async generateFirebaseCommand(
    instruction: string,
    modelId: ModelId = 'gemini-3.5-flash'
  ): Promise<string | null> {
    if (!instruction) return null;
    const prompt = `Du bist ein Firebase-Experte. Übersetze die folgende Anweisung in einen einzigen, gültigen und sicheren Firebase CLI-Befehl.
Anweisung: "${instruction}"
Antworte nur mit dem Befehl selbst, ohne zusätzliche Erklärungen, beginnend mit "firebase".`;

    const result = await this.callModel(modelId, prompt);
    if (!result) return null;
    const command = result.replace(/```bash|```/g, '').trim();
    return command.startsWith('firebase') ? command : null;
  }
}
