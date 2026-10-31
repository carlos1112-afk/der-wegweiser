jest.mock('firebase-functions/v2/https', () => ({
  onCall: (config: any, handler: any) => Object.assign(handler, { run: handler, __config: config }),
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } },
}));
const mockGenerateContent = jest.fn();
jest.mock('@google-cloud/vertexai', () => ({ VertexAI: jest.fn(() => ({ getGenerativeModel: () => ({ generateContent: mockGenerateContent }) })) }));
import { computeRoute } from '../src/vertexRouting';
it('rejects legacy callers without returning direct-line stub routes or spending provider credits', async () => {
  await expect(computeRoute.run({ app: { appId: 'app' }, auth: { uid: 'rider' }, data: { startLat: 52.52, startLng: 13.4, destLat: 52.53, destLng: 13.4 } } as any)).rejects.toMatchObject({ code: 'failed-precondition' });
  expect(mockGenerateContent).not.toHaveBeenCalled();
});
it('requires App Check and auth and keeps the existing regional endpoint closed', async () => {
  await expect(computeRoute.run({ auth: { uid: 'rider' } } as any)).rejects.toMatchObject({ code: 'unauthenticated' });
  await expect(computeRoute.run({ app: {} } as any)).rejects.toMatchObject({ code: 'unauthenticated' });
  expect((computeRoute as any).__config).toEqual({ region: 'europe-west3', enforceAppCheck: true });
});
