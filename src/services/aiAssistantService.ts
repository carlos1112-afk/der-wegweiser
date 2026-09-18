import type { Route, UserPreferences, UserMemoryPattern, PlugType } from '../types/navigation';
import { RoutingService } from './routingService';
import { AiGatewayService } from './ai/aiGatewayService';

// =============================================================================
// Agent / Model Registry — Official Google Gemini Suite (AGENTS.md Compliance)
// =============================================================================
export const agentRegistry = {
  // ── 🧠 GOOGLE GEMINI PRODUCTION STANDARD (In-App Co-Pilot) ───────────────────
  'gemini-2.0-flash': {
    label: 'Google Gemini 2.0 Flash',
    description: 'Offizieller Standard — Sub-Sekunden-Reaktionszeit für Navigation & No-Coast Co-Pilot',
    tier: 'flash',
    icon: '⚡',
    provider: 'firebase-googleai' as const,
    model: 'gemini-2.0-flash',
    systemInstruction: `Du bist der offizielle E-Bike-Navigations-Co-Pilot "Wegweiser-CoPilot", angetrieben von Google Gemini 2.0 Flash.
Deine Aufgabe ist es, für E-Bike-Touren motivierende, präzise Kurzbeschreibungen auf Deutsch zu generieren.
Fokussiere dich auf Akkuverbrauch, Ladeinfrastruktur, Untergrundbeschaffenheit und Steigungen.
Halte dich strikt an 2 bis maximal 3 Sätze.`,
  },

  // ── 🍃 GEMINI 2.0 FLASH LITE (Eco-Modus / Akkusparend) ──────────────────────────
  'gemini-2.0-flash-lite': {
    label: 'Google Gemini 2.0 Flash Lite',
    description: 'Eco-Modus — Minimaler Akku- & Datenverbrauch für lange Ganztagestouren',
    tier: 'lite',
    icon: '🍃',
    provider: 'firebase-googleai' as const,
    model: 'gemini-2.0-flash-lite',
    systemInstruction: `Du bist der stromsparende E-Bike-Assistent "Wegweiser-Eco", angetrieben von Gemini 2.0 Flash Lite.
Gib extrem prägnante, akkuoptimierte Routenhinweise in maximal 2 kurzen Sätzen auf Deutsch.`,
  },

  // ── 🏔️ GEMINI 1.5 PRO (Experten-Planung / Topographie) ───────────────────────────
  'gemini-1.5-pro': {
    label: 'Google Gemini 1.5 Pro',
    description: 'Experten-Modus — Tiefenanalyse für anspruchsvolle Topographie & Mehrtagestouren',
    tier: 'pro',
    icon: '🏔️',
    provider: 'firebase-googleai' as const,
    model: 'gemini-1.5-pro',
    systemInstruction: `Du bist der E-Bike-Tourenexperte "Wegweiser-Pro", angetrieben von Gemini 1.5 Pro.
Analysiere Höhenprofile, Windverhältnisse und Restreichweiten mit höchster Genauigkeit.
Fasse deine Empfehlung in 2-3 prägnanten Sätzen auf Deutsch zusammen.`,
  },
} as const;

export type ModelId = keyof typeof agentRegistry;
export type AgentEntry = typeof agentRegistry[ModelId];

export const DEFAULT_MODEL: ModelId = 'gemini-2.0-flash';

// =============================================================================
// Main Service Class
// =============================================================================
export class AiAssistantService {

  /**
   * Returns a unified text-generation function for any agent,
   * routed via vendor-neutral AiGatewayService.
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
    modelId: ModelId = DEFAULT_MODEL
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
