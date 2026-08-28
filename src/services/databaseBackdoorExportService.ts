import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CURATED_CHARGING_STATIONS, CURATED_ROUTES, CURATED_REPAIR_STATIONS } from './curatedDatabase';
import { SoundFxService } from './soundFxService';
import confetti from 'canvas-confetti';

export interface MasterDatabaseDump {
  metadata: {
    exportDate: string;
    schemaVersion: string;
    appName: string;
    totalChargingStations: number;
    totalRoutes: number;
    totalRepairStations: number;
    totalPartnerLeads: number;
    totalReviews: number;
  };
  collections: {
    chargingStations: any[];
    routes: any[];
    repairStations: any[];
    partnerLeads: any[];
    stationReviews: any[];
    localCache: Record<string, any>;
  };
}

export class DatabaseBackdoorExportService {
  /**
   * Secret 1-Click Master Export Engine.
   * Pulls all Firestore cloud collections + curated data + local cache into a single JSON file.
   */
  public static async executeMasterExport(): Promise<MasterDatabaseDump> {
    console.log('🔓 [Backdoor] Initializing 1-Click Master Database Export...');
    
    // 1. Fetch Cloud Charging Stations
    let cloudStations: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'charging_stations'));
      cloudStations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[Backdoor] Could not fetch firestore charging_stations:', e);
    }

    // Merge cloud and curated stations without duplicates
    const allStationsMap = new Map<string, any>();
    CURATED_CHARGING_STATIONS.forEach((s) => allStationsMap.set(s.id, s));
    cloudStations.forEach((s) => allStationsMap.set(s.id, s));
    const allChargingStations = Array.from(allStationsMap.values());

    // 2. Fetch Cloud Routes
    let cloudRoutes: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'routes'));
      cloudRoutes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[Backdoor] Could not fetch firestore routes:', e);
    }

    const allRoutesMap = new Map<string, any>();
    CURATED_ROUTES.forEach((r) => allRoutesMap.set(r.id, r));
    cloudRoutes.forEach((r) => allRoutesMap.set(r.id, r));
    const allRoutes = Array.from(allRoutesMap.values());

    // 3. Fetch B2B Partner Leads
    let partnerLeads: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'partner_leads'));
      partnerLeads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[Backdoor] Could not fetch firestore partner_leads:', e);
    }

    // 4. Fetch Community Reviews
    let stationReviews: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'charging_station_reviews'));
      stationReviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[Backdoor] Could not fetch firestore station reviews:', e);
    }

    // 5. Dump all localStorage
    const localCache: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          localCache[key] = JSON.parse(localStorage.getItem(key) || '""');
        } catch {
          localCache[key] = localStorage.getItem(key);
        }
      }
    }

    // Assemble Master Database Dump
    const dump: MasterDatabaseDump = {
      metadata: {
        exportDate: new Date().toISOString(),
        schemaVersion: '2.0.0-production',
        appName: 'Der Wegweiser — Master Database Backdoor Dump',
        totalChargingStations: allChargingStations.length,
        totalRoutes: allRoutes.length,
        totalRepairStations: CURATED_REPAIR_STATIONS.length,
        totalPartnerLeads: partnerLeads.length,
        totalReviews: stationReviews.length,
      },
      collections: {
        chargingStations: allChargingStations,
        routes: allRoutes,
        repairStations: CURATED_REPAIR_STATIONS,
        partnerLeads,
        stationReviews,
        localCache,
      },
    };

    // Trigger Instant 1-Click File Download
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `der-wegweiser-MASTER-DATABASE-DUMP-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Audio & Visual confirmation
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });

    console.log('✅ [Backdoor] Master Database Export successfully completed and downloaded!');
    return dump;
  }
}
