import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ChargingStation, UserPreferences, UserMemoryPattern, TokenAccount, Route } from '../types/navigation';
import { ChargingStationImportService } from './chargingStationImportService';

// Utility for Haversine distance
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in m
}

export interface IDataRepository {
  // Charging Stations
  getChargingStations(bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<ChargingStation[]>;
  addChargingStation(station: Omit<ChargingStation, 'id' | 'createdAt'>): Promise<ChargingStation>;
  
  // User Preferences & Memory Graph
  getUserPreferences(userId: string): Promise<UserPreferences>;
  saveUserPreferences(preferences: UserPreferences): Promise<void>;
  getUserMemoryPattern(userId: string): Promise<UserMemoryPattern>;
  updateUserMemoryPattern(userId: string, memory: Partial<UserMemoryPattern>): Promise<void>;

  // Token Account
  getTokenAccount(userId: string): Promise<TokenAccount>;
  addTokens(userId: string, amount: number, reason: string): Promise<number>;
  deductToken(userId: string, amount: number): Promise<boolean>;

  // Routes
  saveRoute(userId: string, route: Route): Promise<string>;
  getSavedRoutes(userId: string): Promise<Route[]>;
}

// In-Memory & LocalStorage Fallback Cache with Live Firebase Firestore integration
class LocalAndFirestoreRepository implements IDataRepository {
  private memoryStations: ChargingStation[] = [
    {
      id: 'cs-1',
      name: 'E-Bike Tankstelle Café Badesee',
      lat: 52.518,
      lng: 13.415,
      plugType: 'bosch',
      isWeatherproof: true,
      isFree: true,
      openingHours: '08:00 - 20:00',
      nearbyAmenities: ['Café', 'Sitzbänke', 'WLAN', 'Fahrradständer'],
      photoUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500',
      verifiedByCount: 14,
      createdAt: new Date().toISOString(),
      createdByUserId: 'user-community',
      isVerifiedBikeInfrastructure: true,
    },
    {
      id: 'cs-2',
      name: 'Öffentlicher 230V Schuko Lade-Locker',
      lat: 52.525,
      lng: 13.402,
      plugType: 'schuko_230v',
      isWeatherproof: true,
      isFree: true,
      openingHours: '24/7',
      nearbyAmenities: ['Luftpumpe', 'Werkzeugstation'],
      photoUrl: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=500',
      verifiedByCount: 8,
      createdAt: new Date().toISOString(),
      createdByUserId: 'user-community',
      isVerifiedBikeInfrastructure: true,
    },
    {
      id: 'cs-3',
      name: 'BikeEnergy Schnellladestation Waldschänke',
      lat: 52.505,
      lng: 13.435,
      plugType: 'bike_energy',
      isWeatherproof: true,
      isFree: false,
      openingHours: '10:00 - 22:00',
      nearbyAmenities: ['Biergarten', 'WC', 'Werkzeug'],
      verifiedByCount: 22,
      createdAt: new Date().toISOString(),
      createdByUserId: 'user-community',
      isVerifiedBikeInfrastructure: true,
    }
  ];

  async getChargingStations(bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<ChargingStation[]> {
    let firestoreStations: ChargingStation[] = [];
    try {
      const querySnapshot = await getDocs(collection(db, 'charging_stations'));
      firestoreStations = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        } as ChargingStation;
      });

      // Cache the retrieved stations in LocalStorage for robust offline capabilities
      localStorage.setItem('der_wegweiser_stations', JSON.stringify(firestoreStations));
    } catch (error) {
      console.warn('Firestore getChargingStations failed, falling back to LocalStorage cache:', error);
      // Retrieve from LocalStorage cache
      const saved = localStorage.getItem('der_wegweiser_stations');
      if (saved) {
        try {
          firestoreStations = JSON.parse(saved);
        } catch (e) {
          console.warn('Could not parse local stations cache', e);
        }
      }
    }

    // Merge in-memory default stations and firestore/cached stations, ensuring uniqueness by ID
    const allStations = [...this.memoryStations];
    for (const fs of firestoreStations) {
      if (!allStations.some(s => s.id === fs.id)) {
        allStations.push(fs);
      }
    }

    // Filter by bounds if specified
    if (bounds) {
      const filtered = allStations.filter(s => 
        s.lat >= bounds.minLat && 
        s.lat <= bounds.maxLat && 
        s.lng >= bounds.minLng && 
        s.lng <= bounds.maxLng
      );

      try {
        const osmStations = await ChargingStationImportService.fetchFromOSM({
          south: bounds.minLat,
          west: bounds.minLng,
          north: bounds.maxLat,
          east: bounds.maxLng
        });

        for (const osm of osmStations) {
          const isDuplicate = filtered.some(existing => 
            getDistanceFromLatLonInM(existing.lat, existing.lng, osm.lat, osm.lng) < 50
          );
          if (!isDuplicate) {
            filtered.push(osm);
          }
        }
      } catch (err) {
        console.error('Error merging OSM stations:', err);
      }

      return filtered;
    }
    return allStations;
  }

  async addChargingStation(station: Omit<ChargingStation, 'id' | 'createdAt'>): Promise<ChargingStation> {
    const id = `cs-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newStation: ChargingStation = {
      ...station,
      id,
      createdAt,
    };

    // Update LocalStorage cache immediately to ensure offline access
    try {
      const saved = localStorage.getItem('der_wegweiser_stations');
      const custom = saved ? JSON.parse(saved) : [];
      custom.push(newStation);
      localStorage.setItem('der_wegweiser_stations', JSON.stringify(custom));
    } catch (e) {
      console.warn('Could not update local stations cache', e);
    }

    // Attempt to persist in Firestore
    try {
      const docRef = doc(db, 'charging_stations', id);
      await setDoc(docRef, newStation);
    } catch (error) {
      console.warn('Firestore addChargingStation failed, cached station locally:', error);
    }

    return newStation;
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const docRef = doc(db, 'user_preferences', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserPreferences;
        localStorage.setItem(`pref_${userId}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.warn(`Firestore getUserPreferences failed for user ${userId}, falling back to LocalStorage:`, error);
    }

    // Fallback: Check LocalStorage cache
    const saved = localStorage.getItem(`pref_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(`Could not parse local preferences cache for user ${userId}`, e);
      }
    }

    // Default configuration
    return {
      userId,
      bikeType: 'ebike',
      batteryCapacityWh: 500,
      batteryCurrentPercent: 80,
      preferredSurface: 'asphalt',
      maxElevationSlopePercent: 6,
      favoriteThemes: ['badesee', 'wald', 'panoramablick'],
      avoidSteepHills: true,
      unlimitedDemandActive: true,
    };
  }

  async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    const userId = preferences.userId;
    // Update LocalStorage cache
    localStorage.setItem(`pref_${userId}`, JSON.stringify(preferences));

    // Persist in Firestore
    try {
      const docRef = doc(db, 'user_preferences', userId);
      await setDoc(docRef, preferences);
    } catch (error) {
      console.warn(`Firestore saveUserPreferences failed for user ${userId}, saved locally:`, error);
    }
  }

  async getUserMemoryPattern(userId: string): Promise<UserMemoryPattern> {
    try {
      const docRef = doc(db, 'user_memory_patterns', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserMemoryPattern;
        localStorage.setItem(`memory_${userId}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.warn(`Firestore getUserMemoryPattern failed for user ${userId}, falling back to LocalStorage:`, error);
    }

    // Fallback: Check LocalStorage cache
    const saved = localStorage.getItem(`memory_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(`Could not parse local memory pattern cache for user ${userId}`, e);
      }
    }

    // Default configuration
    return {
      frequentDestinations: ['Badesee', 'Waldschänke'],
      preferredDistanceKm: 28,
      avoidedGradientsCount: 5,
      aiNotes: [
        'Bevorzugt flache Asphaltwege',
        'Fährt gerne nachmittags an Gewässern vorbei',
        'Vermeidet Anstiege > 6% Steigung'
      ]
    };
  }

  async updateUserMemoryPattern(userId: string, memory: Partial<UserMemoryPattern>): Promise<void> {
    const existing = await this.getUserMemoryPattern(userId);
    const updated = { ...existing, ...memory };

    // Update LocalStorage cache
    localStorage.setItem(`memory_${userId}`, JSON.stringify(updated));

    // Persist in Firestore
    try {
      const docRef = doc(db, 'user_memory_patterns', userId);
      await setDoc(docRef, updated);
    } catch (error) {
      console.warn(`Firestore updateUserMemoryPattern failed for user ${userId}, updated locally:`, error);
    }
  }

  async getTokenAccount(userId: string): Promise<TokenAccount> {
    try {
      const docRef = doc(db, 'user_tokens', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as TokenAccount;
        localStorage.setItem(`tokens_${userId}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.warn(`Firestore getTokenAccount failed for user ${userId}, falling back to LocalStorage:`, error);
    }

    // Fallback: Check LocalStorage cache
    const saved = localStorage.getItem(`tokens_${userId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn(`Could not parse local token account cache for user ${userId}`, e);
      }
    }

    // Default configuration
    return {
      userId,
      balance: 60,
      lifetimeEarned: 100,
      unlimitedOnDemand: true,
    };
  }

  async addTokens(userId: string, amount: number, reason: string): Promise<number> {
    const account = await this.getTokenAccount(userId);
    account.balance += amount;
    account.lifetimeEarned += amount;

    // Update LocalStorage cache
    localStorage.setItem(`tokens_${userId}`, JSON.stringify(account));

    // Persist in Firestore
    try {
      const docRef = doc(db, 'user_tokens', userId);
      await setDoc(docRef, account);
    } catch (error) {
      console.warn(`Firestore addTokens failed for user ${userId} (${reason}), updated locally:`, error);
    }

    return account.balance;
  }

  async deductToken(userId: string, amount: number): Promise<boolean> {
    const account = await this.getTokenAccount(userId);
    if (account.unlimitedOnDemand || account.balance >= amount) {
      account.balance = Math.max(0, account.balance - amount);

      // Update LocalStorage cache
      localStorage.setItem(`tokens_${userId}`, JSON.stringify(account));

      // Persist in Firestore
      try {
        const docRef = doc(db, 'user_tokens', userId);
        await setDoc(docRef, account);
      } catch (error) {
        console.warn(`Firestore deductToken failed for user ${userId}, updated locally:`, error);
      }

      return true;
    }
    return false;
  }

  async saveRoute(userId: string, route: Route): Promise<string> {
    const saved = JSON.parse(localStorage.getItem(`routes_${userId}`) || '[]');
    saved.push(route);
    localStorage.setItem(`routes_${userId}`, JSON.stringify(saved));
    return route.id;
  }

  async getSavedRoutes(userId: string): Promise<Route[]> {
    return JSON.parse(localStorage.getItem(`routes_${userId}`) || '[]');
  }
}

export const dataRepository: IDataRepository = new LocalAndFirestoreRepository();
