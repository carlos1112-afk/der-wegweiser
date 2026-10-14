import { test, it, describe, afterEach, beforeEach, vi, expect } from 'vitest';
import { AiAssistantService } from '../../src/services/aiAssistantService';
import { AiGatewayService } from '../../src/services/ai/aiGatewayService';
import { RoutingService } from '../../src/services/routingService';

describe('AiAssistantService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queryGenaiAgent', () => {
    it('returns null if query is empty', async () => {
      const result = await AiAssistantService.queryGenaiAgent('', 'agent-1');
      expect(result).toBeNull();
    });

    it('returns text response from AiGatewayService', async () => {
      vi.spyOn(AiGatewayService, 'dispatch').mockResolvedValue({
        text: 'This is a mocked response',
        provider: 'firebase-googleai'
      } as any);

      const result = await AiAssistantService.queryGenaiAgent('What is the best route?', 'agent-1');
      expect(result).toBe('This is a mocked response');
    });

    it('returns null if provider is heuristic_offline', async () => {
      vi.spyOn(AiGatewayService, 'dispatch').mockResolvedValue({
        text: 'Heuristic response',
        provider: 'heuristic_offline'
      } as any);

      const result = await AiAssistantService.queryGenaiAgent('Query', 'agent-1');
      expect(result).toBeNull();
    });

    it('returns null if dispatch throws an error', async () => {
      vi.spyOn(AiGatewayService, 'dispatch').mockRejectedValue(new Error('API Error'));

      const result = await AiAssistantService.queryGenaiAgent('Query', 'agent-1');
      expect(result).toBeNull();
    });
  });

  describe('generateAnticipatedRoute', () => {
    it('generates a route and populates aiStory', async () => {
      const mockRoute = {
        waypoints: [],
        distanceKm: 10,
        elevationGainM: 100,
        estimatedMinutes: 30,
        isScoutMission: false
      };

      vi.spyOn(RoutingService, 'generateBikeRoute').mockResolvedValue(mockRoute as any);
      vi.spyOn(AiGatewayService, 'planRoute').mockResolvedValue('Mocked AI story for the route.');

      const result = await AiAssistantService.generateAnticipatedRoute(
        50.1, 8.6,
        { batteryCurrentPercent: 80, bikeType: 'ebike' } as any,
        { preferredDistanceKm: 20, frequentDestinations: ['Park'] } as any
      );

      expect(result.aiStory).toBe('Mocked AI story for the route.');
      expect(result.distanceKm).toBe(10);
    });

    it('handles undefined aiStory from planRoute gracefully', async () => {
       const mockRoute = {
        waypoints: [],
        distanceKm: 10,
        elevationGainM: 100,
        estimatedMinutes: 30,
        isScoutMission: false
      };

      vi.spyOn(RoutingService, 'generateBikeRoute').mockResolvedValue(mockRoute as any);
      vi.spyOn(AiGatewayService, 'planRoute').mockResolvedValue(undefined as any);

      const result = await AiAssistantService.generateAnticipatedRoute(
        50.1, 8.6,
        { batteryCurrentPercent: 80, bikeType: 'ebike' } as any,
        { preferredDistanceKm: 20, frequentDestinations: ['Park'] } as any
      );

      expect(result.aiStory).toBeUndefined();
    });
  });

  describe('analyzeChargingStationPhoto', () => {
    it('throws error about unconfigured API', async () => {
      await expect(AiAssistantService.analyzeChargingStationPhoto('base64...')).rejects.toThrowError(
        '[AiAssistantService] Echte Multimodal Vision API ist nicht konfiguriert. Keine simulierten Foto-Analysen erlaubt.'
      );
    });
  });

  describe('generateFirebaseCommand', () => {
    it('returns null if instruction is empty', async () => {
      const result = await AiAssistantService.generateFirebaseCommand('');
      expect(result).toBeNull();
    });

    it('formats returned command correctly by removing markdown blocks', async () => {
       vi.spyOn(AiGatewayService, 'dispatch').mockResolvedValue({
        text: '```bash\nfirebase deploy --only hosting\n```',
        provider: 'firebase-googleai'
      } as any);

      const result = await AiAssistantService.generateFirebaseCommand('deploy hosting');
      expect(result).toBe('firebase deploy --only hosting');
    });

    it('returns null if generated command does not start with firebase', async () => {
      vi.spyOn(AiGatewayService, 'dispatch').mockResolvedValue({
        text: 'npm run deploy',
        provider: 'firebase-googleai'
      } as any);

      const result = await AiAssistantService.generateFirebaseCommand('deploy hosting');
      expect(result).toBeNull();
    });
  });
});