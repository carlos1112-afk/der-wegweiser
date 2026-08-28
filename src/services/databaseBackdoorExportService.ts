import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
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
   * @param purgeOnlineDbAfterExport When explicitly true, deletes all cloud Firestore records AFTER export succeeds.
   */
  public static async executeMasterExport(options?: { purgeOnlineDbAfterExport?: boolean }): Promise<{
    dump: MasterDatabaseDump;
    purged: boolean;
    purgedCount: number;
  }> {
    console.log('🔓 [Backdoor] Initializing 1-Click Master Database Export...');
    
    // 1. Fetch Cloud Charging Stations
    let cloudStations: any[] = [];
    const stationDocIds: string[] = [];
    try {
      const snap = await getDocs(collection(db, 'charging_stations'));
      snap.docs.forEach((d) => {
        stationDocIds.push(d.id);
        cloudStations.push({ id: d.id, ...d.data() });
      });
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
    const routeDocIds: string[] = [];
    try {
      const snap = await getDocs(collection(db, 'routes'));
      snap.docs.forEach((d) => {
        routeDocIds.push(d.id);
        cloudRoutes.push({ id: d.id, ...d.data() });
      });
    } catch (e) {
      console.warn('[Backdoor] Could not fetch firestore routes:', e);
    }

    const allRoutesMap = new Map<string, any>();
    CURATED_ROUTES.forEach((r) => allRoutesMap.set(r.id, r));
    cloudRoutes.forEach((r) => allRoutesMap.set(r.id, r));
    const allRoutes = Array.from(allRoutesMap.values());

    // 3. Fetch B2B Partner Leads
    let partnerLeads: any[] = [];
    const leadDocIds: string[] = [];
    try {
      const snap = await getDocs(collection(db, 'partner_leads'));
      snap.docs.forEach((d) => {
        leadDocIds.push(d.id);
        partnerLeads.push({ id: d.id, ...d.data() });
      });
    } catch (e) {
      console.warn('[Backdoor] Could not fetch firestore partner_leads:', e);
    }

    // 4. Fetch Community Reviews
    let stationReviews: any[] = [];
    const reviewDocIds: string[] = [];
    try {
      const snap = await getDocs(collection(db, 'charging_station_reviews'));
      snap.docs.forEach((d) => {
        reviewDocIds.push(d.id);
        stationReviews.push({ id: d.id, ...d.data() });
      });
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

    console.log('✅ [Backdoor] Master Database Export file successfully saved!');

    let purged = false;
    let purgedCount = 0;

    // Optional & Explicit Online Database Purge (Nuke Cloud DB)
    if (options?.purgeOnlineDbAfterExport === true) {
      console.log('🔥 [Backdoor] Purging Online Cloud Firestore Collections...');
      
      // Delete charging stations
      for (const id of stationDocIds) {
        try {
          await deleteDoc(doc(db, 'charging_stations', id));
          purgedCount++;
        } catch (e) {
          console.warn(`[Backdoor] Failed to delete charging_stations/${id}:`, e);
        }
      }

      // Delete routes
      for (const id of routeDocIds) {
        try {
          await deleteDoc(doc(db, 'routes', id));
          purgedCount++;
        } catch (e) {
          console.warn(`[Backdoor] Failed to delete routes/${id}:`, e);
        }
      }

      // Delete partner leads
      for (const id of leadDocIds) {
        try {
          await deleteDoc(doc(db, 'partner_leads', id));
          purgedCount++;
        } catch (e) {
          console.warn(`[Backdoor] Failed to delete partner_leads/${id}:`, e);
        }
      }

      // Delete station reviews
      for (const id of reviewDocIds) {
        try {
          await deleteDoc(doc(db, 'charging_station_reviews', id));
          purgedCount++;
        } catch (e) {
          console.warn(`[Backdoor] Failed to delete charging_station_reviews/${id}:`, e);
        }
      }

      // Reset local cached custom stations and routes
      localStorage.removeItem('wegweiser_custom_stations');
      localStorage.removeItem('wegweiser_custom_routes');
      localStorage.removeItem('wegweiser_offline_regions');

      purged = true;
      console.log(`🔥 [Backdoor] Purge complete! ${purgedCount} cloud records removed from online database.`);
    }

    return { dump, purged, purgedCount };
  }
}
