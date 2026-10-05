import { HttpsError } from 'firebase-functions/v2/https';

jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  }
  return {
    onCall: jest.fn((config: any, handler: any) => {
      const wrapped = async (req: any) => handler(req);
      (wrapped as any).run = wrapped;
      (wrapped as any).__config = config;
      return wrapped;
    }),
    HttpsError,
  };
});

const mockLoggerError = jest.fn();
jest.mock('firebase-functions/logger', () => ({ error: (...a: unknown[]) => mockLoggerError(...a) }));

const mockDb = { marker: 'db' };
jest.mock('firebase-admin/firestore', () => ({ getFirestore: jest.fn(() => mockDb) }));

const mockConsume = jest.fn();
jest.mock('../src/rateLimit', () => ({ consumeRateLimit: (...a: unknown[]) => mockConsume(...a) }));

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn();
const mockVertexCtor = jest.fn();
jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: function (this: unknown, opts: unknown) {
    mockVertexCtor(opts);
    return { getGenerativeModel: mockGetGenerativeModel };
  },
}));

import { aiProxy, AI_LIMITS } from '../src/aiProxy';

const authedReq = (data: unknown): any => ({ app: { appId: 'a' }, auth: { uid: 'user-1' }, data });
const okData = { systemPrompt: 'Du bist ein Test.', userPrompt: 'Hallo?' };
const textResponse = (text: string) => ({ response: { candidates: [{ content: { parts: [{ text }] } }] } });

const run = (req: any) => (aiProxy as any).run(req);
const fail = async (req: any): Promise<any> => run(req).catch((e: unknown) => e);

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.AI_MODEL;
  delete process.env.GCLOUD_PROJECT;
  mockConsume.mockResolvedValue(undefined);
  mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  mockGenerateContent.mockResolvedValue(textResponse('Antwort'));
});

describe('aiProxy: Konfiguration', () => {
  it('läuft in europe-west3 mit Kostenbremse und erlaubten Ursprüngen', () => {
    const cfg = (aiProxy as any).__config;
    expect(cfg.region).toBe('europe-west3');
    expect(cfg.maxInstances).toBe(10);
    expect(cfg.timeoutSeconds).toBe(30);
    expect(cfg.cors).toEqual(['https://der-wegweiser.web.app', 'http://localhost:5173']);
  });
});

describe('aiProxy: Zugriffsschutz', () => {
  it.each([
    ['ohne App-Check', { app: undefined, auth: { uid: 'u' }, data: okData }, 'Invalid App Check token.'],
    ['ohne Anmeldung', { app: { appId: 'a' }, auth: undefined, data: okData }, 'User must be authenticated.'],
    ['ohne UID', { app: { appId: 'a' }, auth: {}, data: okData }, 'User must be authenticated.'],
  ])('weist Anfrage %s ab, bevor etwas verbraucht wird', async (_n, req, msg) => {
    const err = await fail(req);
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unauthenticated');
    expect(err.message).toBe(msg);
    expect(mockConsume).not.toHaveBeenCalled();
    expect(mockVertexCtor).not.toHaveBeenCalled();
  });
});

describe('aiProxy: Eingabevalidierung', () => {
  const bad: [string, unknown][] = [
    ['kein Objekt (undefined)', undefined],
    ['kein Objekt (null)', null],
    ['kein Objekt (String)', 'text'],
    ['systemPrompt fehlt', { userPrompt: 'x' }],
    ['systemPrompt keine Zeichenkette', { systemPrompt: 5, userPrompt: 'x' }],
    ['systemPrompt zu lang', { systemPrompt: 'a'.repeat(AI_LIMITS.maxSystemChars + 1), userPrompt: 'x' }],
    ['userPrompt fehlt', { systemPrompt: '' }],
    ['userPrompt leer', { systemPrompt: '', userPrompt: '' }],
    ['userPrompt nur Leerraum', { systemPrompt: '', userPrompt: '   ' }],
    ['userPrompt keine Zeichenkette', { systemPrompt: '', userPrompt: 7 }],
    ['userPrompt zu lang', { systemPrompt: '', userPrompt: 'a'.repeat(AI_LIMITS.maxUserChars + 1) }],
    ['temperature unter 0', { ...okData, temperature: -0.1 }],
    ['temperature über 1', { ...okData, temperature: 1.1 }],
    ['temperature NaN', { ...okData, temperature: NaN }],
    ['temperature Zeichenkette', { ...okData, temperature: '0.5' }],
    ['maxTokens 0', { ...okData, maxTokens: 0 }],
    ['maxTokens über Limit', { ...okData, maxTokens: AI_LIMITS.maxOutputTokens + 1 }],
    ['maxTokens Dezimalzahl', { ...okData, maxTokens: 1.5 }],
    ['maxTokens Zeichenkette', { ...okData, maxTokens: '10' }],
  ];

  it.each(bad)('lehnt ab: %s (ohne Kontingent oder KI zu berühren)', async (_n, data) => {
    const err = await fail(authedReq(data));
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('invalid-argument');
    expect(mockConsume).not.toHaveBeenCalled();
    expect(mockVertexCtor).not.toHaveBeenCalled();
  });

  it('Fehlertexte enthalten keine Nutzereingabe', async () => {
    const err = await fail(authedReq({ systemPrompt: 'GEHEIM', userPrompt: 'a'.repeat(AI_LIMITS.maxUserChars + 1) }));
    expect(err.message).not.toContain('GEHEIM');
  });

  it.each([
    ['systemPrompt an der Grenze', { systemPrompt: 'a'.repeat(AI_LIMITS.maxSystemChars), userPrompt: 'x' }],
    ['leerer systemPrompt', { systemPrompt: '', userPrompt: 'x' }],
    ['userPrompt an der Grenze', { systemPrompt: '', userPrompt: 'a'.repeat(AI_LIMITS.maxUserChars) }],
    ['temperature 0', { ...okData, temperature: 0 }],
    ['temperature 1', { ...okData, temperature: 1 }],
    ['maxTokens 1', { ...okData, maxTokens: 1 }],
    ['maxTokens am Limit', { ...okData, maxTokens: AI_LIMITS.maxOutputTokens }],
  ])('akzeptiert: %s', async (_n, data) => {
    await expect(run(authedReq(data))).resolves.toMatchObject({ text: 'Antwort' });
  });
});

describe('aiProxy: Kontingent', () => {
  it('verbraucht ein Kontingent pro Nutzer: 30 Anfragen pro Stunde in "aiRequests"', async () => {
    await run(authedReq(okData));
    expect(mockConsume).toHaveBeenCalledTimes(1);
    expect(mockConsume).toHaveBeenCalledWith(mockDb, 'aiRequests', 'user-1', {
      windowMs: 60 * 60 * 1000,
      max: 30,
    });
  });

  it('überschrittenes Kontingent verhindert den KI-Aufruf', async () => {
    mockConsume.mockRejectedValueOnce(new HttpsError('resource-exhausted', 'Rate limit exceeded. Try again later.'));
    const err = await fail(authedReq(okData));
    expect(err.code).toBe('resource-exhausted');
    expect(mockVertexCtor).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

describe('aiProxy: Aufruf der KI', () => {
  it('ruft Vertex in europe-west3 mit Standardwerten auf und liefert Text und Modell', async () => {
    const res = await run(authedReq(okData));
    expect(res).toEqual({ text: 'Antwort', modelUsed: 'gemini-2.0-flash' });
    expect(mockVertexCtor).toHaveBeenCalledWith({ project: 'der-wegweiser', location: 'europe-west3' });
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.0-flash',
      systemInstruction: 'Du bist ein Test.',
    });
    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'Hallo?' }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    });
  });

  it('reicht temperature und maxTokens des Aufrufers durch', async () => {
    await run(authedReq({ ...okData, temperature: 0.2, maxTokens: 100 }));
    expect(mockGenerateContent.mock.calls[0][0].generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 100 });
  });

  it('temperature 0 wird nicht durch den Standardwert ersetzt', async () => {
    await run(authedReq({ ...okData, temperature: 0 }));
    expect(mockGenerateContent.mock.calls[0][0].generationConfig.temperature).toBe(0);
  });

  it('Modell und Projekt kommen aus der Umgebung', async () => {
    process.env.AI_MODEL = 'gemini-test-model';
    process.env.GCLOUD_PROJECT = 'anderes-projekt';
    const res = await run(authedReq(okData));
    expect(res.modelUsed).toBe('gemini-test-model');
    expect(mockGetGenerativeModel.mock.calls[0][0].model).toBe('gemini-test-model');
    expect(mockVertexCtor).toHaveBeenCalledWith({ project: 'anderes-projekt', location: 'europe-west3' });
  });

  it('fügt mehrteilige Antworten zusammen und entfernt Randleerraum', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: '  Teil eins, ' }, { text: 'Teil zwei.  ' }, {}] } }] },
    });
    const res = await run(authedReq(okData));
    expect(res.text).toBe('Teil eins, Teil zwei.');
  });
});

describe('aiProxy: Fehlerabbildung', () => {
  it('leere Antwort wird zu internal', async () => {
    mockGenerateContent.mockResolvedValueOnce({ response: { candidates: [] } });
    const err = await fail(authedReq(okData));
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('internal');
    expect(err.message).toBe('Empty response from AI service.');
  });

  it('Antwort nur aus Leerraum zählt als leer', async () => {
    mockGenerateContent.mockResolvedValueOnce(textResponse('   '));
    const err = await fail(authedReq(okData));
    expect(err.code).toBe('internal');
  });

  it('Sicherheitsfilter beim Prompt wird zu failed-precondition', async () => {
    mockGenerateContent.mockResolvedValueOnce({ response: { candidates: [], promptFeedback: { blockReason: 'SAFETY' } } });
    const err = await fail(authedReq(okData));
    expect(err.code).toBe('failed-precondition');
  });

  it('Abbruch durch Sicherheitsfilter in der Antwort wird zu failed-precondition', async () => {
    mockGenerateContent.mockResolvedValueOnce({ response: { candidates: [{ finishReason: 'SAFETY' }] } });
    const err = await fail(authedReq(okData));
    expect(err.code).toBe('failed-precondition');
  });

  it('Fehler der KI werden zu unavailable, ohne Interna preiszugeben', async () => {
    const upstream = Object.assign(new Error('boom mit Nutzerprompt Hallo?'), { name: 'GoogleApiError', code: 503 });
    mockGenerateContent.mockRejectedValueOnce(upstream);
    const err = await fail(authedReq(okData));
    expect(err).toBeInstanceOf(HttpsError);
    expect(err.code).toBe('unavailable');
    expect(err.message).toBe('AI service temporarily unavailable.');
    expect(err.message).not.toContain('boom');
  });

  it('protokolliert nur Fehlername und -code, nie Meldung oder Prompt', async () => {
    const upstream = Object.assign(new Error('boom mit Nutzerprompt Hallo?'), { name: 'GoogleApiError', code: 503 });
    mockGenerateContent.mockRejectedValueOnce(upstream);
    await fail(authedReq(okData));
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith('aiProxy: upstream call failed', { name: 'GoogleApiError', code: 503 });
    expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain('Hallo?');
  });

  it('Fehler beim Aufbau des Vertex-Clients werden ebenfalls zu unavailable', async () => {
    mockGetGenerativeModel.mockImplementationOnce(() => {
      throw new Error('kein Zugriff');
    });
    const err = await fail(authedReq(okData));
    expect(err.code).toBe('unavailable');
  });
});
