/**
 * AI Gateway & Capability Abstraction Layer — Der Wegweiser
 * 
 * LEITPRINZIP:
 * "Jede externe Abhängigkeit muss jederzeit durch eine gleichwertige Alternative
 * ersetzbar sein, ohne die Kernarchitektur oder die gespeicherten Nutzerdaten
 * grundlegend ändern zu müssen."
 * 
 * Architektur-Highlights:
 * 1. Trennung nach Fähigkeiten (Capabilities: Plan, Voice, Summary, Range, Weather), NICHT nach Anbieter.
 * 2. Austauschbare Provider (Backend Proxy, OpenAI-kompatibel, Gemini, Anthropic, Mistral, Ollama/Lokal).
 * 3. 100% Offline-Heuristik-Fallback: App bleibt bei Netzausfall oder API-Sperre voll funktionsfähig.
 * 4. Zero Client Keys: API-Schlüssel verbleiben auf dem Betreiber-Backend.
 */

export type AiCapability = 'planRoute' | 'voiceDialogue' | 'summarizeRide' | 'analyzeRange' | 'interpretWeather';

export type AiProviderBackend = 
  | 'backend_proxy'       // Standard: Eigener sicherer Backend-Proxy (OpenAI-kompatibel)
  | 'openai_compatible'   // Direkte Anbindung an beliebigen OpenAI-kompatiblen Endpunkt (z.B. vLLM, Mistral, OpenRouter)
  | 'ollama_local'        // Lokales LLM auf dem Gerät / Host (z.B. Llama 3 / Mistral)
  | 'heuristic_offline';  // Deterministiche Offline-Engine (Vollkommen anbieter- und netzunabhängig)

export interface AiGatewayConfig {
  activeProvider: AiProviderBackend;
  backendUrl: string;
  timeoutMs: number;
}

export interface PlanRouteParams {
  start: { lat: number; lng: number; title?: string };
  destination?: { lat: number; lng: number; title?: string };
  distanceKm: number;
  elevationGainM: number;
  surfaceType?: string;
  isScoutMission?: boolean;
}

export interface VoiceDialogueParams {
  userQuery: string;
  batteryPercent: number;
  speedKmH: number;
  currentStreet?: string;
}

export interface SummarizeRideParams {
  distanceKm: number;
  elevationGainM: number;
  avgSpeedKmH: number;
  durationSeconds: number;
  batteryConsumedWh: number;
}

export interface AnalyzeRangeParams {
  batteryPercent: number;
  batteryWhRemaining: number;
  distanceToTargetKm: number;
  elevationRemainingM: number;
  headwindKmH: number;
}

export interface InterpretWeatherParams {
  temperatureC: number;
  windSpeedKmH: number;
  gustSpeedKmH: number;
  precipitationMm: number;
}

export class AiGatewayService {
  private static config: AiGatewayConfig = {
    activeProvider: 'backend_proxy',
    backendUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/ai` : 'http://127.0.0.1:8000/v1',
    timeoutMs: 8000,
  };

  /**
   * Setzt den aktiven KI-Provider oder aktualisiert die Gateway-Konfiguration
   */
  public static configure(newConfig: Partial<AiGatewayConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(`🧠 [AI Gateway] Provider konfiguriert: ${this.config.activeProvider} -> ${this.config.backendUrl}`);
  }

  public static getActiveProvider(): AiProviderBackend {
    return this.config.activeProvider;
  }

  // ===========================================================================
  // FÄHIGKEIT 1: Tourenplanung & Antizipation (planRoute)
  // ===========================================================================
  public static async planRoute(params: PlanRouteParams): Promise<string> {
    const prompt = `Erstelle eine kurze, motivierende E-Bike Tourenbeschreibung auf Deutsch (maximal 2 Sätze) für eine Tour von ${params.distanceKm} km mit ${params.elevationGainM} Höhenmetern. Untergrund: ${params.surfaceType || 'Asphalt & Schotter'}.${params.isScoutMission ? ' Dies ist eine Karten-Scout Tour zur Aktualisierung von Kartendaten.' : ''}`;

    try {
      if (this.config.activeProvider !== 'heuristic_offline') {
        const response = await this.executeBackendChat(prompt, 'Du bist der Wegweiser-CoPilot.');
        if (response) return response;
      }
    } catch (e) {
      console.warn('⚠️ [AI Gateway] Backend-Proxy nicht erreichbar, schalte auf Offline-Heuristik um:', e);
    }

    // Determinischer Heuristik-Fallback
    return params.isScoutMission
      ? `Karten-Scout Mission (${params.distanceKm} km): Hilf mit, veraltete Straßenabschnitte zu verifizieren und sichere dir +35 Bonus-Tokens!`
      : `Akku-optimierte Panorama-Runde über ${params.distanceKm} km mit ${params.elevationGainM} Höhenmetern. Ideal für eine gleichmäßige Unterstützung.`;
  }

  // ===========================================================================
  // FÄHIGKEIT 2: Sprachdialog & Co-Pilot (voiceDialogue)
  // ===========================================================================
  public static async voiceDialogue(params: VoiceDialogueParams): Promise<string> {
    const prompt = `Nutzer fragt: "${params.userQuery}". Status: E-Bike Akku ${params.batteryPercent}%, Tempo ${params.speedKmH} km/h, Ort: ${params.currentStreet || 'Unterwegs'}. Antworte kurz, prägnant und fahrradtauglich in maximal 1 Satz.`;

    try {
      if (this.config.activeProvider !== 'heuristic_offline') {
        const response = await this.executeBackendChat(prompt, 'Du bist der Sprachassistent am Fahrradlenker.');
        if (response) return response;
      }
    } catch (e) {
      console.warn('⚠️ [AI Gateway] Voice Fallback aktiv:', e);
    }

    // Heuristische Offline-Erkennung typischer Lenker-Befehle
    const q = params.userQuery.toLowerCase();
    if (q.includes('akku') || q.includes('batterie')) {
      return `Dein Akku liegt bei ${params.batteryPercent} Prozent. Alles im grünen Bereich.`;
    }
    if (q.includes('schnell') || q.includes('tempo') || q.includes('geschwindigkeit')) {
      return `Du fährst aktuell ${params.speedKmH} km/h.`;
    }
    if (q.includes('wo') || q.includes('ort') || q.includes('straße')) {
      return `Du befindest dich auf: ${params.currentStreet || 'deiner Route'}.`;
    }
    return `Alles klar, ich behalte deine Tour und deinen Akku im Auge.`;
  }

  // ===========================================================================
  // FÄHIGKEIT 3: Touren-Zusammenfassung (summarizeRide)
  // ===========================================================================
  public static async summarizeRide(params: SummarizeRideParams): Promise<string> {
    const prompt = `Fasse folgende Fahrt motivierend in 2 Sätzen zusammen: ${params.distanceKm} km, ${params.elevationGainM} Hm, Schnitt ${params.avgSpeedKmH} km/h, Verbrauch: ${params.batteryConsumedWh} Wh.`;

    try {
      if (this.config.activeProvider !== 'heuristic_offline') {
        const response = await this.executeBackendChat(prompt, 'Du bist der Tour-Auswerter.');
        if (response) return response;
      }
    } catch (e) {
      console.warn('⚠️ [AI Gateway] Summary Fallback aktiv:', e);
    }

    const whPerKm = params.distanceKm > 0 ? Math.round(params.batteryConsumedWh / params.distanceKm) : 0;
    return `Starke Tour über ${params.distanceKm} km mit ${params.elevationGainM} Höhenmetern! Dein Durchschnittsverbrauch lag bei effizienten ${whPerKm} Wh/km.`;
  }

  // ===========================================================================
  // FÄHIGKEIT 4: Reichweiten- & Akku-Risiko-Analyse (analyzeRange)
  // ===========================================================================
  public static async analyzeRange(params: AnalyzeRangeParams): Promise<{ riskLevel: 'safe' | 'caution' | 'critical'; advice: string }> {
    const requiredWhEstimate = (params.distanceToTargetKm * 12) + (params.elevationRemainingM * 0.04) + (params.headwindKmH * 0.5);
    const hasEnoughEnergy = params.batteryWhRemaining >= requiredWhEstimate;

    let riskLevel: 'safe' | 'caution' | 'critical' = 'safe';
    let advice = 'Energie reicht komfortabel bis zum Ziel.';

    if (params.batteryPercent <= 15 || !hasEnoughEnergy) {
      riskLevel = 'critical';
      advice = 'Achtung: Akku reicht bei aktuellem Unterstützungsgrad knapp nicht. Bitte Eco-Modus wählen oder nächsten Ladepunkt ansteuern.';
    } else if (params.batteryPercent <= 25) {
      riskLevel = 'caution';
      advice = 'Hinweis: Geringe Restkapazität. Vorausschauend fahren empfohlen.';
    }

    return { riskLevel, advice };
  }

  // ===========================================================================
  // FÄHIGKEIT 5: Wetter- & Wind-Interpretation (interpretWeather)
  // ===========================================================================
  public static async interpretWeather(params: InterpretWeatherParams): Promise<string> {
    if (params.gustSpeedKmH > 40) {
      return `Starke Böen (${params.gustSpeedKmH} km/h). Lenker festhalten und Gegenwind-Mehrverbrauch beachten.`;
    }
    if (params.temperatureC < 5) {
      return `Kühle ${params.temperatureC}°C. Lithium-Zellen verlieren bei Kälte bis zu 15% Kapazität.`;
    }
    if (params.precipitationMm > 1) {
      return `Regen erwartet (${params.precipitationMm} mm). Vorsicht bei nassen Kurven und Fahrbahnmarkierungen.`;
    }
    return `Optimale Fahrbedingungen bei ${params.temperatureC}°C und leichtem Wind.`;
  }

  // ===========================================================================
  // INTERNER GENERISCHER BACKEND-DISPATCHER (OpenAI-kompatibel)
  // ===========================================================================
  private static async executeBackendChat(prompt: string, systemPrompt: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.backendUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'default',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 150,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }
}
