import { HttpsError } from 'firebase-functions/v2/https';

jest.mock('firebase-functions/v2/https', () => ({
  onCall: jest.fn((config, handler) => {
    const wrapped = async (req: any) => handler(req);
    wrapped.run = wrapped;
    wrapped.__config = config;
    return wrapped;
  }),
  HttpsError: jest.requireActual('firebase-functions/v2/https').HttpsError
}));

import { computeRoute } from '../src/vertexRouting';

const mockGenerateContent = jest.fn();

jest.mock('@google-cloud/vertexai', () => {
    return {
        VertexAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: mockGenerateContent
            })
        }))
    }
});

describe('vertexRouting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should compute route successfully', async () => {
    const req: any = { data: { startLat: 1, startLng: 2, destLat: 3, destLng: 4, batteryPercent: 80, rangeKm: 50 } };
    mockGenerateContent.mockResolvedValueOnce({});
    
    const res = await computeRoute.run(req);
    expect(res).toEqual({
      waypoints: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 }
      ],
      chargingStops: [],
      estimatedRangeLeft: 45
    });
    
    const vertexAiMock = require('@google-cloud/vertexai').VertexAI;
    expect(vertexAiMock).toHaveBeenCalledWith(expect.objectContaining({
      project: 'der-wegweiser',
      location: 'europe-west3'
    }));
    
    const modelMock = vertexAiMock.mock.results[0].value.getGenerativeModel;
    expect(modelMock).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.0-flash',
      systemInstruction: "Battery-aware routing assistant für E-Bikes — gibt Waypoints + Ladestation-Empfehlungen zurück"
    }));
    
    expect(mockGenerateContent).toHaveBeenCalledWith(
      `Plan a route from [1, 2] to [3, 4]. Battery: 80%, Range: 50km.`
    );
  });

  it('should compute route successfully when range <= 5', async () => {
    const req: any = { data: { startLat: 1, startLng: 2, destLat: 3, destLng: 4, batteryPercent: 10, rangeKm: 3 } };
    mockGenerateContent.mockResolvedValueOnce({});
    
    const res = await computeRoute.run(req);
    expect(res).toEqual({
      waypoints: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 }
      ],
      chargingStops: [],
      estimatedRangeLeft: 0
    });
  });

  it('should throw internal if Vertex AI throws', async () => {
    const req: any = { data: { startLat: 1, startLng: 2, destLat: 3, destLng: 4, batteryPercent: 80, rangeKm: 50 } };
    mockGenerateContent.mockRejectedValueOnce(new Error('Vertex quota exceeded'));
    
    await expect(computeRoute.run(req)).rejects.toThrow(
      new HttpsError('internal', 'Vertex AI Error: Vertex quota exceeded')
    );
  });
  it('should be configured with europe-west3', () => {
    expect((computeRoute as any).__config).toEqual({
      region: "europe-west3"
    });
  });
});
