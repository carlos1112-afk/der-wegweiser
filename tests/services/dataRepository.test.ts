import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataRepository, filterUgcText } from '../../src/services/dataRepository';
import { ChargingStationImportService } from '../../src/services/chargingStationImportService';
import { getDocs, getDoc, setDoc } from 'firebase/firestore';
import { ConsentService } from '../../src/services/consentService';

vi.mock('firebase/firestore', async (importOriginal) => {
  return {
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    getFirestore: vi.fn(),
  };
});

vi.mock('firebase/app', async (importOriginal) => {
  return {
    initializeApp: vi.fn(),
  };
});

vi.mock('../../src/firebase', () => ({
  db: {},
}));

vi.mock('../../src/services/chargingStationImportService', () => ({
  ChargingStationImportService: {
    fetchFromOSM: vi.fn().mockResolvedValue([]),
  },
}));

// Mock localStorage globally
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
});

describe('dataRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    ConsentService.save({ essential: true, analytics: false, surveys: false, personalizedAds: false });
  });

  describe('filterUgcText', () => {
    it('should allow clean text', () => {
      const result = filterUgcText('This is a clean comment.');
      expect(result.isClean).toBe(true);
    });

    it('should reject profanity', () => {
      const result = filterUgcText('You are an idiot.');
      expect(result.isClean).toBe(false);
      expect(result.reason).toContain('beleidigende Ausdrücke');
    });

    it('should reject text over 500 characters', () => {
      const longText = 'a'.repeat(501);
      const result = filterUgcText(longText);
      expect(result.isClean).toBe(false);
      expect(result.reason).toContain('Maximallänge');
    });
  });

  describe('getChargingStations', () => {
    it('should fetch from Firestore and merge with memory stations', async () => {
      (getDocs as any).mockResolvedValue({
        docs: [
          {
            id: 'fs-1',
            data: () => ({ name: 'Firestore Station', lat: 50, lng: 10 }),
          },
        ],
      });

      const stations = await dataRepository.getChargingStations();
      expect(stations).toHaveLength(1);
      expect(stations[0].id).toBe('fs-1');
      expect(stations[0].name).toBe('Firestore Station');

      const cached = localStorage.getItem('der_wegweiser_stations');
      expect(cached).toBeTruthy();
      expect(JSON.parse(cached!)).toHaveLength(1);
    });

    it('should fallback to local storage if Firestore fails', async () => {
      (getDocs as any).mockRejectedValue(new Error('Network error'));
      localStorage.setItem('der_wegweiser_stations', JSON.stringify([
        { id: 'ls-1', name: 'Local Station', lat: 51, lng: 11 }
      ]));

      const stations = await dataRepository.getChargingStations();
      expect(stations).toHaveLength(1);
      expect(stations[0].id).toBe('ls-1');
    });

    it('should filter by bounds and merge OSM stations', async () => {
      (getDocs as any).mockResolvedValue({ docs: [] });

      (ChargingStationImportService.fetchFromOSM as any).mockResolvedValue([
        { id: 'osm-1', name: 'OSM Station', lat: 50.5, lng: 10.5 }
      ]);

      const stations = await dataRepository.getChargingStations({
        minLat: 50, maxLat: 51, minLng: 10, maxLng: 11
      });

      expect(stations).toHaveLength(1);
      expect(stations[0].id).toBe('osm-1');
      expect(ChargingStationImportService.fetchFromOSM).toHaveBeenCalled();
    });
  });

  describe('addChargingStation', () => {
    it('should add to local storage and Firestore', async () => {
      const newStation = {
        name: 'New Station',
        lat: 52,
        lng: 13,
        plugType: 'schuko_230v',
        isWeatherproof: true,
        isFree: true,
        openingHours: '24/7',
        nearbyAmenities: [],
        verifiedByCount: 1,
        isVerifiedBikeInfrastructure: true,
      };

      const result = await dataRepository.addChargingStation(newStation as any);

      expect(result.id).toMatch(/^cs-\d+/);
      expect(result.createdAt).toBeDefined();
      expect(result.name).toBe('New Station');

      const cached = JSON.parse(localStorage.getItem('der_wegweiser_stations') || '[]');
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe(result.id);

      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('User Preferences', () => {
    it('should fetch from Firestore and cache', async () => {
      const prefs = { userId: 'u1', bikeType: 'gravel' };
      (getDoc as any).mockResolvedValue({
        exists: () => true,
        data: () => prefs,
      });

      const result = await dataRepository.getUserPreferences('u1');
      expect(result.bikeType).toBe('gravel');
      expect(localStorage.getItem('pref_u1')).toEqual(JSON.stringify(prefs));
    });

    it('should fallback to default if not in Firestore or local storage', async () => {
      (getDoc as any).mockResolvedValue({ exists: () => false });

      const result = await dataRepository.getUserPreferences('u2');
      expect(result.userId).toBe('u2');
      expect(result.bikeType).toBe('ebike');
    });

    it('should save to local storage and Firestore', async () => {
      const prefs = { userId: 'u3', bikeType: 'cargo' };
      await dataRepository.saveUserPreferences(prefs as any);

      expect(localStorage.getItem('pref_u3')).toEqual(JSON.stringify(prefs));
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('User Memory Pattern', () => {
    it('should fetch from Firestore', async () => {
      const memory = { frequentDestinations: ['Home'] };
      (getDoc as any).mockResolvedValue({
        exists: () => true,
        data: () => memory,
      });

      const result = await dataRepository.getUserMemoryPattern('u1');
      expect(result.frequentDestinations).toEqual(['Home']);
    });

    it('should update memory pattern', async () => {
      (getDoc as any).mockResolvedValue({ exists: () => false });
      await dataRepository.updateUserMemoryPattern('u1', { preferredDistanceKm: 42 });

      const cached = JSON.parse(localStorage.getItem('memory_u1') || '{}');
      expect(cached.preferredDistanceKm).toBe(42);
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('Token Account', () => {
    it('should fetch from Firestore', async () => {
      const tokens = { userId: 'u1', balance: 100, lifetimeEarned: 100, unlimitedOnDemand: false };
      (getDoc as any).mockResolvedValue({
        exists: () => true,
        data: () => tokens,
      });

      const result = await dataRepository.getTokenAccount('u1');
      expect(result.balance).toBe(100);
    });

    it('rejects client-issued token rewards without writing to Firestore', async () => {
      await expect(dataRepository.addTokens('u1', 5, 'reward')).rejects.toThrow('server-verified earning event');
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('does not mutate token balances from the client', async () => {
      const success = await dataRepository.deductToken('u1', 5);
      expect(success).toBe(false);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('should not deduct token if balance is insufficient', async () => {
      (getDoc as any).mockResolvedValue({
        exists: () => true,
        data: () => ({ userId: 'u1', balance: 2, lifetimeEarned: 10, unlimitedOnDemand: false }),
      });

      const success = await dataRepository.deductToken('u1', 5);
      expect(success).toBe(false);
    });

    it('defaults a missing token account to zero and no unlimited entitlement', async () => {
      (getDoc as any).mockResolvedValue({ exists: () => false });
      const account = await dataRepository.getTokenAccount('missing-user');
      expect(account).toMatchObject({ balance: 0, lifetimeEarned: 0, unlimitedOnDemand: false });
    });
  });

  describe('Routes', () => {
    it('should save route', async () => {
      const route = { id: 'r1', title: 'My Route' };
      await dataRepository.saveRoute('u1', route as any);

      const cached = JSON.parse(localStorage.getItem('routes_u1') || '[]');
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe('r1');
      expect(setDoc).toHaveBeenCalled();
    });

    it('should get saved routes', async () => {
      (getDocs as any).mockResolvedValue({
        docs: [
          { data: () => ({ id: 'r1', title: 'My Route' }) },
        ],
      });

      const routes = await dataRepository.getSavedRoutes('u1');
      expect(routes).toHaveLength(1);
      expect(routes[0].id).toBe('r1');
    });
  });

  describe('reportContent', () => {
    it('should report content', async () => {
      await dataRepository.reportContent({
        contentType: 'station',
        contentId: 's1',
        reason: 'spam',
      });
      expect(setDoc).toHaveBeenCalled();
    });
  });
});
