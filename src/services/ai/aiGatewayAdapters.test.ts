import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fb = vi.hoisted(() => ({
  app: { options: { apiKey: 'test-key' } } as { options: { apiKey?: string } } | null,
  functions: {} as object | null,
  generateContent: vi.fn(),
  getAI: vi.fn(),
  getGenerativeModel: vi.fn(),
  callable: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  get app() { return fb.app; },
  get functions() { return fb.functions; },
}));

vi.mock('firebase/ai', () => {
  class GoogleAIBackend { kind = 'google'; }
  class VertexAIBackend {
    kind = 'vertex';
    location: string | undefined;
    constructor(location?: string) { this.location = location; }
  }
  return {
    GoogleAIBackend,
    VertexAIBackend,
    getAI: (...a: unknown[]) => fb.getAI(...a),
    getGenerativeModel: (...a: unknown[]) => fb.getGenerativeModel(...a),
  };
});

vi.mock('firebase/functions', () => ({
  httpsCallable: (...a: unknown[]) => fb.httpsCallable(...a),
}));

import { AiGatewayService, FirebaseAiLogicAdapter, VertexCallableAdapter } from './aiGatewayService';

const req = { systemPrompt: 'Du bist ein Test.', userPrompt: 'Hallo?' };

beforeEach(() => {
  vi.clearAllMocks();
  fb.app = { options: { apiKey: 'test-key' } };
  fb.functions = {};
  fb.getAI.mockReturnValue('AI-INSTANCE');
  fb.getGenerativeModel.mockReturnValue({ generateContent: fb.generateContent });
  fb.generateContent.mockResolvedValue({ response: { text: () => '  Antwort  ' } });
  fb.httpsCallable.mockReturnValue(fb.callable);
  fb.callable.mockResolvedValue({ data: { text: '  Antwort  ', modelUsed: 'gemini-x' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('FirebaseAiLogicAdapter', () => {
  const adapter = new FirebaseAiLogicAdapter();

  it('weigt ohne Firebase-Konfiguration ab, bevor ein SDK-Aufruf passiert', async () => {
    fb.app = { options: { apiKey: '' } };
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Firebase ist nicht konfiguriert');
    expect(fb.getAI).not.toHaveBeenCalled();
    expect(fb.generateContent).not.toHaveBeenCalled();
  });

  it('weist auch fehlendes App-Objekt ab', async () => {
    fb.app = null;
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Firebase ist nicht konfiguriert');
  });

  it('nutzt standardmäßig das Gemini-Developer-Backend und liefert getrimmten Text samt Modell', async () => {
    const res = await adapter.execute(req, '', 8000);
    expect(res).toEqual({ text: 'Antwort', provider: 'firebase_ai', modelUsed: 'gemini-2.0-flash' });
    expect(fb.getAI).toHaveBeenCalledTimes(1);
    expect(fb.getAI.mock.calls[0][0]).toBe(fb.app);
    expect(fb.getAI.mock.calls[0][1].backend.kind).toBe('google');
  });

  it('übergibt Modell, Systemanweisung, Standardwerte und Timeout an die SDK', async () => {
    await adapter.execute(req, '', 8000);
    expect(fb.getGenerativeModel).toHaveBeenCalledWith(
      'AI-INSTANCE',
      {
        model: 'gemini-2.0-flash',
        systemInstruction: 'Du bist ein Test.',
        generationConfig: { temperature: 0.4, maxOutputTokens: 150 },
      },
      { timeout: 8000 },
    );
    expect(fb.generateContent).toHaveBeenCalledWith('Hallo?');
  });

  it('reicht temperature und maxTokens durch, auch temperature 0', async () => {
    await adapter.execute({ ...req, temperature: 0, maxTokens: 64 }, '', 8000);
    expect(fb.getGenerativeModel.mock.calls[0][1].generationConfig).toEqual({ temperature: 0, maxOutputTokens: 64 });
  });

  it('lässt eine leere Systemanweisung weg', async () => {
    await adapter.execute({ ...req, systemPrompt: '' }, '', 8000);
    expect(fb.getGenerativeModel.mock.calls[0][1].systemInstruction).toBeUndefined();
  });

  it('Modell kommt aus VITE_AI_MODEL', async () => {
    vi.stubEnv('VITE_AI_MODEL', 'gemini-test');
    const res = await adapter.execute(req, '', 8000);
    expect(res.modelUsed).toBe('gemini-test');
    expect(fb.getGenerativeModel.mock.calls[0][1].model).toBe('gemini-test');
  });

  it('VITE_AI_BACKEND=vertex nutzt Vertex mit Standardregion europe-west3', async () => {
    vi.stubEnv('VITE_AI_BACKEND', 'vertex');
    await adapter.execute(req, '', 8000);
    const backend = fb.getAI.mock.calls[0][1].backend;
    expect(backend.kind).toBe('vertex');
    expect(backend.location).toBe('europe-west3');
  });

  it('Vertex-Region ist über VITE_AI_VERTEX_LOCATION änderbar', async () => {
    vi.stubEnv('VITE_AI_BACKEND', 'vertex');
    vi.stubEnv('VITE_AI_VERTEX_LOCATION', 'europe-west1');
    await adapter.execute(req, '', 8000);
    expect(fb.getAI.mock.calls[0][1].backend.location).toBe('europe-west1');
  });

  it('jeder andere Backend-Wert bleibt beim Gemini-Developer-Backend', async () => {
    vi.stubEnv('VITE_AI_BACKEND', 'irgendwas');
    await adapter.execute(req, '', 8000);
    expect(fb.getAI.mock.calls[0][1].backend.kind).toBe('google');
  });

  it('leere Antwort wird zum Fehler statt zu leerem Text', async () => {
    fb.generateContent.mockResolvedValueOnce({ response: { text: () => '   ' } });
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Leere Antwort');
  });

  it('Fehler der SDK werden nicht verschluckt', async () => {
    fb.generateContent.mockRejectedValueOnce(new Error('quota'));
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('quota');
  });
});

describe('VertexCallableAdapter', () => {
  const adapter = new VertexCallableAdapter();

  it('weist ohne Firebase-Konfiguration ab, ohne die Function aufzurufen', async () => {
    fb.app = { options: { apiKey: '' } };
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Firebase ist nicht konfiguriert');
    expect(fb.httpsCallable).not.toHaveBeenCalled();
  });

  it('weist ab, wenn Functions nicht verfügbar sind', async () => {
    fb.functions = null;
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Firebase ist nicht konfiguriert');
    expect(fb.httpsCallable).not.toHaveBeenCalled();
  });

  it('ruft aiProxy mit Timeout und den Standardwerten des Gateways auf', async () => {
    await adapter.execute(req, '', 8000);
    expect(fb.httpsCallable).toHaveBeenCalledWith(fb.functions, 'aiProxy', { timeout: 8000 });
    expect(fb.callable).toHaveBeenCalledWith({
      systemPrompt: 'Du bist ein Test.',
      userPrompt: 'Hallo?',
      temperature: 0.4,
      maxTokens: 150,
    });
  });

  it('reicht temperature und maxTokens durch, auch temperature 0', async () => {
    await adapter.execute({ ...req, temperature: 0, maxTokens: 64 }, '', 8000);
    expect(fb.callable.mock.calls[0][0]).toMatchObject({ temperature: 0, maxTokens: 64 });
  });

  it('liefert getrimmten Text, Provider und Modell', async () => {
    const res = await adapter.execute(req, '', 8000);
    expect(res).toEqual({ text: 'Antwort', provider: 'vertex_callable', modelUsed: 'gemini-x' });
  });

  it('leere oder fehlende Antwort wird zum Fehler', async () => {
    fb.callable.mockResolvedValueOnce({ data: { text: '  ' } });
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Leere Antwort');
    fb.callable.mockResolvedValueOnce({ data: undefined });
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Leere Antwort');
  });

  it('Serverfehler wie resource-exhausted werden nicht verschluckt', async () => {
    fb.callable.mockRejectedValueOnce(Object.assign(new Error('Rate limit exceeded'), { code: 'functions/resource-exhausted' }));
    await expect(adapter.execute(req, '', 8000)).rejects.toThrow('Rate limit exceeded');
  });
});

describe('AiGatewayService: Provider-Auswahl', () => {
  async function freshGateway() {
    vi.resetModules();
    return (await import('./aiGatewayService')).AiGatewayService;
  }

  it('Standard ist firebase_ai', async () => {
    expect((await freshGateway()).getActiveProvider()).toBe('firebase_ai');
  });

  it('VITE_AI_PROVIDER wählt eine Alternative, etwa vertex_callable', async () => {
    vi.stubEnv('VITE_AI_PROVIDER', 'vertex_callable');
    expect((await freshGateway()).getActiveProvider()).toBe('vertex_callable');
  });

  it('ein ungültiger Wert fällt auf firebase_ai zurück', async () => {
    vi.stubEnv('VITE_AI_PROVIDER', 'gibts-nicht');
    expect((await freshGateway()).getActiveProvider()).toBe('firebase_ai');
  });

  it('dispatch liefert bei funktionierendem firebase_ai die KI-Antwort', async () => {
    AiGatewayService.configure('firebase_ai');
    const res = await AiGatewayService.dispatch(req);
    expect(res).toMatchObject({ text: 'Antwort', provider: 'firebase_ai' });
  });

  it('dispatch ohne Konfiguration scheitert ehrlich, ohne Netzwerk und ohne erfundene Antwort', async () => {
    fb.app = { options: { apiKey: '' } };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    AiGatewayService.configure('firebase_ai');
    await expect(AiGatewayService.dispatch(req)).rejects.toThrow('Offline-Heuristik kann keine dynamischen Prompts verarbeiten');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fb.generateContent).not.toHaveBeenCalled();
  });
});
