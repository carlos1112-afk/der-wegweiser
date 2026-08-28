import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ChargingStation, UserPreferences, UserMemoryPattern, TokenAccount, Route } from '../types/navigation';
import { ChargingStationImportService } from './chargingStationImportService';
import { CURATED_CHARGING_STATIONS, CURATED_ROUTES } from './curatedDatabase';

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
  private memoryStations: ChargingStation[] = [...CURATED_CHARGING_STATIONS];

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
    // 1. Save locally for instant offline retrieval
    try {
      const saved = JSON.parse(localStorage.getItem(`routes_${userId}`) || '[]');
      if (!saved.some((r: Route) => r.id === route.id)) {
        saved.push(route);
      }
      localStorage.setItem(`routes_${userId}`, JSON.stringify(saved));
    } catch (e) {
      console.warn('Could not save route to localStorage:', e);
    }

    // 2. Persist in Firestore
    try {
      const docRef = doc(db, 'routes', route.id);
      await setDoc(docRef, { ...route, userId, savedAt: new Date().toISOString() });
    } catch (error) {
      console.warn('Firestore saveRoute failed, persisted locally:', error);
    }

    return route.id;
  }

  async getSavedRoutes(userId: string): Promise<Route[]> {
    let firestoreRoutes: Route[] = [];

    try {
      const querySnapshot = await getDocs(collection(db, 'routes'));
      firestoreRoutes = querySnapshot.docs.map((d) => d.data() as Route);
      if (firestoreRoutes.length > 0) {
        localStorage.setItem(`routes_${userId}`, JSON.stringify(firestoreRoutes));
        return firestoreRoutes;
      }
    } catch (error) {
      console.warn('Firestore getSavedRoutes failed, using local cache:', error);
    }

    try {
      const local = JSON.parse(localStorage.getItem(`routes_${userId}`) || '[]');
      if (local && local.length > 0) {
        return local;
      }
    } catch {
      // Fallback
    }

    return [...CURATED_ROUTES];
  }

  async addPartnerLead(lead: { businessName: string; email: string; plan: string; type: string }): Promise<void> {
    const id = `lead-${Date.now()}`;
    try {
      const docRef = doc(db, 'partner_leads', id);
      await setDoc(docRef, { ...lead, createdAt: new Date().toISOString() });
    } catch (e) {
      console.warn('Could not save partner lead to Firestore:', e);
    }
  }
}

export const dataRepository: IDataRepository & { addPartnerLead?: (lead: any) => Promise<void> } = new LocalAndFirestoreRepository();
