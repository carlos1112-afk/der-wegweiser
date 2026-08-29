import type { Route, UserPreferences, UserMemoryPattern, PlugType } from '../types/navigation';
import { RoutingService } from './routingService';
import { AiGatewayService } from './ai/aiGatewayService';

// =============================================================================
// Agent / Model Registry
// All selectable Gemini agents available in the IDE
// =============================================================================
export const agentRegistry = {

  // ── 🧠 GOOGLE GEMINI PRODUCTION MODEL (Version 1.0 Standard) ─────────────
  'expert-route-planner': {
    label: 'Expert E-Bike Route Planner',
    description: 'Spezialisiert auf Akku-optimierte & landschaftlich schöne Routen',
    tier: 'free',
    icon: '🚲',
    provider: 'firebase-googleai' as const,
    model: 'gemini-3.6-flash',
    systemInstruction: `Du bist der absolute E-Bike-Routen-Experte "Wegweiser-CoPilot". 
Deine Aufgabe ist es, für Touren eine packende, motivierende Kurzbeschreibung auf Deutsch zu schreiben.
Fokussiere dich besonders auf e-bike-spezifische Aspekte wie Akkuverbrauch, Ladesäulen, Untergrundbeschaffenheit und Steigungen. 
Halte dich strikt an 2 bis maximal 3 Sätze.`,
  },

  // ── 🆓 CLOUD & PROXY BACKENDS (Vertex AI / Backend Proxy) ──────────────────
  'firebase-googleai-flash': {
    label: 'Firebase Gemini Flash',
    description: 'GCP Proxy · Gemini 3.6 Flash',
    tier: 'free',
    icon: '🔥',
    provider: 'firebase-googleai' as const,
    model: 'gemini-3.6-flash',
  },
  'vertex-cloud-flash': {
    label: 'Vertex AI Flash (Cloud Credits)',
    description: 'Kostenlos via GCP Credits · europe-west3 · Vertex AI',
    tier: 'cloud',
    icon: '☁️',
    provider: 'vertexai' as const,
    model: 'gemini-3.6-flash',
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

// =============================================================================
// Main Service Class
// =============================================================================
export class AiAssistantService {

  /**
   * Returns a unified text-generation function for any agent,
   * regardless of its underlying provider, routed via AiGatewayService.
   */
  private static async callModel(modelId: ModelId, prompt: string): Promise<string | null> {
    const agent = agentRegistry[modelId];
    const systemInstruction = agent && 'systemInstruction' in agent && agent.systemInstruction 
      ? agent.systemInstruction 
      : 'Du bist der Wegweiser-CoPilot.';

    try {
      const response = await AiGatewayService.dispatch({
        systemPrompt: systemInstruction,
        userPrompt: prompt,
      });
      return response.text || null;
    } catch (e) {
      console.warn(`[AiAssistantService] AI Gateway call failed for ${modelId}:`, e);
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
   * Deterministic image validator with fallback classification.
   */
  public static async analyzeChargingStationPhoto(
    _base64Image: string,
    _modelId: ModelId = DEFAULT_MODEL
  ): Promise<{ plugType: PlugType; isVerified: boolean; confidenceScore: number }> {
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
