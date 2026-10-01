/**
 * AI Gateway & Canonical Model Abstraction Layer — Der Wegweiser
 * 
 * LEITPRINZIP:
 * "Jede externe Abhängigkeit muss jederzeit durch eine gleichwertige Alternative
 * ersetzbar sein, ohne die Kernarchitektur oder die gespeicherten Nutzerdaten
 * grundlegend ändern zu müssen."
 * 
 * Architektur:
 * App → Capability API (planRoute, voiceDialogue, summarizeRide, analyzeRange, interpretWeather)
 *   ↓
 * Canonical Request/Response Model (CanonicalAiRequest / CanonicalAiResponse)
 *   ↓
 * Provider Adapters (FirebaseAiLogicAdapter [Standard], BackendProxyAdapter, OpenAiAdapter,
 *                     AnthropicAdapter, LocalOllamaAdapter, HeuristicOfflineAdapter)
 *
 * Garantien:
 * 1. Zero Client Keys: Firebase AI Logic nutzt das Firebase-Projekt (App-Check/Billing),
 *    kein roher API-Key im Client-Bundle. Für Nicht-Standard-Adapter (OpenAI/Anthropic/Ollama)
 *    bleiben Keys serverseitig, falls ein BackendProxy dafür konfiguriert wird.
 * 2. Keine Bindung an ein proprietäres Modell — austauschbare Adapter.
 * 3. Deterministischer, klar gekennzeichneter Offline-Fallback für Kern- und
 *    Sicherheitsfunktionen, falls kein Provider erreichbar ist (kein KI-generierter Text
 *    wird als solcher ausgegeben, wenn er keiner ist — siehe AiAssistantService.callModel).
 */

import { ai } from '../../firebase';
import { getGenerativeModel } from 'firebase/ai';

export type AiCapability = 'planRoute' | 'voiceDialogue' | 'summarizeRide' | 'analyzeRange' | 'interpretWeather';

export type AiProviderType =
  | 'firebase_ai_logic'   // Standard: Firebase AI Logic (Gemini Developer API, kein Client-Key, kein eigener Backend-Proxy)
  | 'backend_proxy'       // Eigener sicherer Backend-Proxy (Server-to-Server Auth) — nur falls explizit konfiguriert
  | 'openai'              // Beliebiger OpenAI-kompatibler Endpunkt (vLLM, OpenRouter, Mistral)
  | 'anthropic'           // Anthropic Messages API Format
  | 'ollama'              // Lokale Ollama-Instanz auf Host
  | 'heuristic_offline';  // Statischer, klar als "nicht KI-generiert" markierter Offline-Fallback

export interface CanonicalAiRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Gemini-Modell-ID für den firebase_ai_logic-Adapter, z.B. 'gemini-2.0-flash'. */
  modelId?: string;
}

export interface CanonicalAiResponse {
  text: string;
  provider: AiProviderType;
  modelUsed?: string;
}

export interface AiProviderAdapter {
  type: AiProviderType;
  execute(request: CanonicalAiRequest, endpointUrl: string, timeoutMs: number): Promise<CanonicalAiResponse>;
}

// ── 0. Firebase AI Logic Adapter (Standard — echter Gemini-Call, kein Backend nötig) ──
export class FirebaseAiLogicAdapter implements AiProviderAdapter {
  public type: AiProviderType = 'firebase_ai_logic';

  public async execute(request: CanonicalAiRequest, _endpointUrl: string, timeoutMs: number): Promise<CanonicalAiResponse> {
    if (!ai) {
      throw new Error('Firebase AI Logic ist nicht initialisiert (fehlender apiKey oder Init-Fehler, siehe Konsole).');
    }
    const modelId = request.modelId || 'gemini-2.0-flash';
    const model = getGenerativeModel(ai, {
      model: modelId,
      systemInstruction: request.systemPrompt,
      generationConfig: {
        temperature: request.temperature ?? 0.4,
        maxOutputTokens: request.maxTokens ?? 150,
      },
    }, { timeout: timeoutMs });

    const result = await model.generateContent(request.userPrompt);
    const text = result.response.text().trim();
    return { text, provider: this.type, modelUsed: modelId };
  }
}

// ── 1. Backend Proxy Adapter (nur falls explizit konfiguriert) ───────────────
export class BackendProxyAdapter implements AiProviderAdapter {
  public type: AiProviderType = 'backend_proxy';

  public async execute(request: CanonicalAiRequest, endpointUrl: string, timeoutMs: number): Promise<CanonicalAiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${endpointUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'default',
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 150,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      return { text, provider: this.type, modelUsed: data.model || 'backend-model' };
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }
}

// ── 2. OpenAI / OpenRouter / vLLM Adapter ──────────────────────────────────────
export class OpenAiAdapter implements AiProviderAdapter {
  public type: AiProviderType = 'openai';

  public async execute(request: CanonicalAiRequest, endpointUrl: string, timeoutMs: number): Promise<CanonicalAiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${endpointUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 150,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content?.trim() || '',
        provider: this.type,
        modelUsed: data.model,
      };
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }
}

// ── 3. Anthropic Messages API Adapter ─────────────────────────────────────────
export class AnthropicAdapter implements AiProviderAdapter {
  public type: AiProviderType = 'anthropic';

  public async execute(request: CanonicalAiRequest, endpointUrl: string, timeoutMs: number): Promise<CanonicalAiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${endpointUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.userPrompt }],
          max_tokens: request.maxTokens ?? 150,
          temperature: request.temperature ?? 0.4,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return {
        text: data.content?.[0]?.text?.trim() || '',
        provider: this.type,
        modelUsed: data.model,
      };
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }
}

// ── 4. Local Ollama Adapter ───────────────────────────────────────────────────
export class LocalOllamaAdapter implements AiProviderAdapter {
  public type: AiProviderType = 'ollama';

  public async execute(request: CanonicalAiRequest, endpointUrl: string, timeoutMs: number): Promise<CanonicalAiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${endpointUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3:8b',
          system: request.systemPrompt,
          prompt: request.userPrompt,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return {
        text: data.response?.trim() || '',
        provider: this.type,
        modelUsed: 'ollama-local',
      };
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }
}

// ── 5. Heuristic Offline Adapter (Zero Network & Zero Cost) ────────────────────
// Liefert bewusst KEINEN KI-generierten Text — nur einen neutralen Platzhalter-Marker.
// Die eigentlichen, pro Capability sinnvollen Fallback-Texte stehen direkt in den
// planRoute/voiceDialogue/summarizeRide-Methoden unten (deterministisch aus echten
// Eingabedaten berechnet, nicht hier). AiAssistantService.callModel() gibt diesen
// Provider-Typ niemals als "echtes Modellergebnis" an den Nutzer weiter.
export class HeuristicOfflineAdapter implements AiProviderAdapter {
  public type: AiProviderType = 'heuristic_offline';

  public async execute(_request: CanonicalAiRequest): Promise<CanonicalAiResponse> {
    return {
      text: '',
      provider: this.type,
      modelUsed: 'none',
    };
  }
}

export interface PlanRouteParams {
  start: { lat: number; lng: number; title?: string };
  destination?: { lat: number; lng: number; title?: string };
  distanceKm: number;
  elevationGainM: number;
  surfaceType?: string;
  isScoutMission?: boolean;
  /** Harte Sicherheitsgrenze aus den Nutzereinstellungen — niemals überschreiten/relativieren. */
  maxElevationSlopePercent?: number;
  isBatterySafe?: boolean;
  /**
   * Herkunft von surfaceBreakdown/Energiewert: 'community' = echte anonymisierte
   * Fahrdaten entlang dieser Strecke, 'estimated_no_data' = keine Daten vorhanden.
   */
  surfaceDataSource?: 'community' | 'estimated_no_data';
  communityDataSegmentsUsed?: number;
  /** Name der echten Ladestation auf der Route, falls eine gefunden wurde. */
  chargingStopName?: string;
  /** Echte, öffentlich beliebte Strava-Segmentnamen in der Umgebung — NUR Stimmung, keine Fakten über diese Route. */
  inspirationNames?: string[];
}

export interface VoiceDialogueParams {
  userQuery: string;
  batteryPercent: number | null;
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
  private static activeProvider: AiProviderType = 'firebase_ai_logic';
  private static backendUrl: string = typeof window !== 'undefined' ? `${window.location.origin}/api/ai` : 'http://127.0.0.1:8000/v1';
  private static timeoutMs: number = 8000;

  private static adapters: Record<AiProviderType, AiProviderAdapter> = {
    firebase_ai_logic: new FirebaseAiLogicAdapter(),
    backend_proxy: new BackendProxyAdapter(),
    openai: new OpenAiAdapter(),
    anthropic: new AnthropicAdapter(),
    ollama: new LocalOllamaAdapter(),
    heuristic_offline: new HeuristicOfflineAdapter(),
  };

  public static configure(provider: AiProviderType, url?: string, timeout?: number): void {
    this.activeProvider = provider;
    if (url) this.backendUrl = url;
    if (timeout) this.timeoutMs = timeout;
    console.log(`🧠 [AI Gateway] Provider gewechselt auf: ${provider} (URL: ${this.backendUrl})`);
  }

  public static getActiveProvider(): AiProviderType {
    return this.activeProvider;
  }

  /**
   * Kanonische Dispatcher-Methode
   */
  public static async dispatch(request: CanonicalAiRequest): Promise<CanonicalAiResponse> {
    const adapter = this.adapters[this.activeProvider];
    try {
      if (this.activeProvider !== 'heuristic_offline') {
        return await adapter.execute(request, this.backendUrl, this.timeoutMs);
      }
    } catch (e) {
      console.warn(`⚠️ [AI Gateway] Provider ${this.activeProvider} fehlgeschlagen, schalte auf Offline-Heuristik:`, e);
    }
    return this.adapters.heuristic_offline.execute(request, this.backendUrl, this.timeoutMs);
  }

  // ===========================================================================
  // FÄHIGKEIT 1: Tourenplanung & Antizipation (planRoute)
  // ===========================================================================
  /**
   * Priorisierter System-Prompt für die Streckenerzählung. Die Reihenfolge ist
   * bewusst strikt und wird im Prompt selbst explizit erzwungen, weil ein LLM
   * sonst dazu neigt, die interessanteste statt die wichtigste Information zuerst
   * zu gewichten:
   *
   *   STUFE 1 — Sicherheitsgrenzen (bindend, nie relativieren/umgehen)
   *   STUFE 2 — Echte Streckenfakten (Community-Daten, Ladestation, Distanz/Hm —
   *             nichts davon darf erfunden oder abgeändert werden)
   *   STUFE 3 — Inspirationsreferenzen (nur Stimmung/Namedropping, NIE als Teil
   *             der tatsächlichen Wegführung dieser Route ausgeben)
   *   STUFE 4 — Kreative Erzählung, die ausschließlich auf Stufe 1-3 aufbaut
   *
   * Hinweis zur Grenze dieses Ansatzes: Ein System-Prompt ist eine starke, aber
   * keine harte Garantie gegen Halluzination. Deshalb überschreibt das Ergebnis
   * dieser Methode NIE die deterministisch berechnete Fakten-Zusammenfassung in
   * RoutingService — es wird dort nur als zusätzlicher, klar getrennter
   * Erzähl-Absatz angehängt (siehe aiAssistantService.generateAnticipatedRoute).
   */
  private static buildPlanRouteSystemPrompt(): string {
    return [
      'Du bist der Wegweiser-CoPilot, ein KI-Erzähler für E-Bike-Touren. Du bekommst',
      'Fakten in vier klar getrennten Prioritätsstufen. Höhere Stufen sind bindend',
      'für niedrigere — eine niedrigere Stufe darf einer höheren NIE widersprechen.',
      '',
      'STUFE 1 (SICHERHEIT, bindend): Angegebene Steigungs- und Akkugrenzen sind',
      'harte Grenzen. Erwähne niemals eine Route als "noch machbar" oder',
      'beschönige, wenn die Daten eine Grenzüberschreitung oder ein Sicherheitsrisiko',
      'zeigen — das ist nicht deine Entscheidung, die App zeigt Warnungen separat an.',
      '',
      'STUFE 2 (FAKTEN, unveränderlich): Alle unter "ECHTE DATEN" gelisteten Werte',
      '(Distanz, Höhenmeter, Community-Belagdaten, Ladestation) sind exakt und',
      'dürfen nicht verändert, gerundet-beschönigt oder durch andere Zahlen ersetzt',
      'werden. Erfinde NIEMALS zusätzliche Orte, Sehenswürdigkeiten, Läden, Seen',
      'oder Wegabschnitte, die nicht explizit genannt sind.',
      '',
      'STUFE 3 (INSPIRATION, nur Stimmung): Unter "INSPIRATION" genannte Namen sind',
      'öffentlich beliebte Strecken in der Umgebung — sie sind NICHT Teil dieser',
      'Route. Nutze sie höchstens als vage Stimmungsreferenz ("ähnlich beliebte',
      'Ecken wie..."), behaupte NIE, dass die Route über sie verläuft.',
      '',
      'STUFE 4 (ERZÄHLUNG): Schreibe darauf aufbauend maximal 2 kurze, motivierende',
      'Sätze auf Deutsch, die die Tour spannend und individuell wirken lassen —',
      'aber ausschließlich mit den Fakten aus Stufe 1-3, ohne neue zu erfinden.',
    ].join('\n');
  }

  private static buildPlanRouteUserPrompt(params: PlanRouteParams): string {
    const lines: string[] = [];

    lines.push('SICHERHEITSGRENZEN:');
    if (params.maxElevationSlopePercent !== undefined) {
      lines.push(`- Maximale Steigung laut Nutzereinstellung: ${params.maxElevationSlopePercent}%`);
    }
    if (params.isBatterySafe !== undefined) {
      lines.push(`- Akku-Sicherheitsstatus: ${params.isBatterySafe ? 'ausreichend' : 'KNAPP/NICHT ausreichend — das muss in der Erzählung neutral bleiben, nicht beschönigt werden'}`);
    }

    lines.push('');
    lines.push('ECHTE DATEN:');
    lines.push(`- Distanz: ${params.distanceKm} km, Höhenmeter: ${params.elevationGainM} m`);
    lines.push(`- Untergrund: ${params.surfaceType || 'Asphalt & Schotter'}`);
    if (params.surfaceDataSource === 'community' && params.communityDataSegmentsUsed) {
      lines.push(`- Belag-/Energiewerte basieren auf ${params.communityDataSegmentsUsed} echten anonymisierten Community-Fahrten entlang dieser Strecke.`);
    } else {
      lines.push('- Keine Community-Fahrdaten für diesen Korridor vorhanden — Belagangabe ist eine grobe Schätzung, das darf in der Erzählung nicht als gesicherte Messung dargestellt werden.');
    }
    if (params.chargingStopName) {
      lines.push(`- Echte Lademöglichkeit auf der Route: ${params.chargingStopName}`);
    }
    if (params.isScoutMission) {
      lines.push('- Dies ist eine Karten-Scout-Mission zur Aktualisierung veralteter Kartendaten.');
    }

    if (params.inspirationNames && params.inspirationNames.length > 0) {
      lines.push('');
      lines.push('INSPIRATION (nur Stimmung, kein Teil dieser Route):');
      lines.push(`- ${params.inspirationNames.join(', ')}`);
    }

    lines.push('');
    lines.push('Schreibe jetzt die Tourenbeschreibung gemäß den vier Prioritätsstufen.');
    return lines.join('\n');
  }

  public static async planRoute(params: PlanRouteParams): Promise<string> {
    const prompt = this.buildPlanRouteUserPrompt(params);

    try {
      if (this.activeProvider !== 'heuristic_offline') {
        const res = await this.dispatch({
          systemPrompt: this.buildPlanRouteSystemPrompt(),
          userPrompt: prompt,
        });
        if (res.text) return res.text;
      }
    } catch (e) {
      console.warn('⚠️ [AI Gateway] planRoute Fallback:', e);
    }

    return params.isScoutMission
      ? `Karten-Scout Mission (${params.distanceKm} km): Hilf mit, veraltete Straßenabschnitte zu verifizieren und sichere dir +35 Bonus-Tokens!`
      : `Akku-optimierte Panorama-Runde über ${params.distanceKm} km mit ${params.elevationGainM} Höhenmetern. Ideal für eine gleichmäßige Unterstützung.`;
  }

  // ===========================================================================
  // FÄHIGKEIT 2: Sprachdialog & Co-Pilot (voiceDialogue)
  // ===========================================================================
  public static async voiceDialogue(params: VoiceDialogueParams): Promise<string> {
    const batteryText = params.batteryPercent !== null ? `${params.batteryPercent}%` : 'unbekannt (kein BLE Akkustand)';
    const prompt = `Nutzer fragt: "${params.userQuery}". Status: E-Bike Akku ${batteryText}, Tempo ${params.speedKmH} km/h, Ort: ${params.currentStreet || 'Unterwegs'}. Antworte kurz, prägnant und fahrradtauglich in maximal 1 Satz.`;

    try {
      if (this.activeProvider !== 'heuristic_offline') {
        const res = await this.dispatch({
          systemPrompt: 'Du bist der Sprachassistent am Fahrradlenker.',
          userPrompt: prompt,
        });
        if (res.text) return res.text;
      }
    } catch (e) {
      console.warn('⚠️ [AI Gateway] voiceDialogue Fallback:', e);
    }

    const q = params.userQuery.toLowerCase();
    if (q.includes('akku') || q.includes('batterie')) {
      return params.batteryPercent !== null
        ? `Dein Akku liegt bei ${params.batteryPercent} Prozent. Alles im grünen Bereich.`
        : `Dein aktueller Akkustand ist leider nicht über Bluetooth bekannt.`;
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
      if (this.activeProvider !== 'heuristic_offline') {
        const res = await this.dispatch({
          systemPrompt: 'Du bist der Tour-Auswerter.',
          userPrompt: prompt,
        });
        if (res.text) return res.text;
      }
    } catch (e) {
      console.warn('⚠️ [AI Gateway] summarizeRide Fallback:', e);
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
}
