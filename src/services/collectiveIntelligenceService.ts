import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { SanitizedSpatialSegment } from './spatialTelemetrySanitizerService';

const GRID_PRECISION = 2; // muss mit SpatialTelemetrySanitizerService übereinstimmen
const FIRESTORE_IN_LIMIT = 10; // Firestore erlaubt max. 10 Werte pro 'in'-Klausel

/**
 * Liest die echten, anonymisierten Community-Fahrdaten (spatial_road_intelligence),
 * die SpatialTelemetrySanitizerService schreibt, und wertet sie für eine konkrete
 * Routen-Geometrie aus. Liefert NIEMALS erfundene Werte: ohne echte Treffer entlang
 * der Strecke ist das Ergebnis null, nicht ein geschätzter Platzhalter.
 */
export class CollectiveIntelligenceService {
  private static gridKeyFor(lat: number, lng: number): string {
    return `grid_${lat.toFixed(GRID_PRECISION)}_${lng.toFixed(GRID_PRECISION)}`;
  }

  /**
   * Reduziert eine Pfad-Geometrie auf die eindeutigen ~1,1km-Rasterzellen, die sie
   * durchquert, damit nicht für jeden der ggf. hunderten Koordinatenpunkte einzeln
   * abgefragt wird.
   */
  private static gridKeysAlongPath(pathCoordinates: [number, number][]): string[] {
    const keys = new Set<string>();
    for (const [lat, lng] of pathCoordinates) {
      keys.add(this.gridKeyFor(lat, lng));
    }
    return Array.from(keys);
  }

  private static chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Fragt alle echten Community-Segmente ab, deren Rasterzelle die übergebene
   * Routen-Geometrie durchquert. Mehrere Firestore-Abfragen (max. 10 Keys pro
   * 'in'-Klausel) werden zusammengeführt.
   */
  public static async getSegmentsAlongPath(
    pathCoordinates: [number, number][]
  ): Promise<SanitizedSpatialSegment[]> {
    const gridKeys = this.gridKeysAlongPath(pathCoordinates);
    if (gridKeys.length === 0) return [];

    const batches = this.chunk(gridKeys, FIRESTORE_IN_LIMIT);
    const results: SanitizedSpatialSegment[] = [];

    for (const batch of batches) {
      try {
        const q = query(
          collection(db, 'spatial_road_intelligence'),
          where('geohashPrefix', 'in', batch)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => {
          results.push(docSnap.data() as SanitizedSpatialSegment);
        });
      } catch (e) {
        console.warn('[CollectiveIntelligenceService] Query-Fehler für Grid-Batch:', e);
      }
    }
    return results;
  }

  /**
   * Aggregiert echte Community-Segmente zu einem Belag-Breakdown und einem
   * Energie-Benchmark. Gibt null zurück, wenn keine Segmente gefunden wurden —
   * der Aufrufer muss diesen Fall als "keine Daten" behandeln, nicht als 0%/0%/0%.
   */
  public static aggregateSegments(segments: SanitizedSpatialSegment[]): {
    surfaceBreakdown: { asphaltPercent: number; gravelPercent: number; unpavedPercent: number };
    avgEnergyBenchmarkWhPerKm: number;
    segmentCount: number;
  } | null {
    if (segments.length === 0) return null;

    let pavedCount = 0;
    let energySum = 0;

    for (const seg of segments) {
      if (seg.surfaceEstimated === 'asphalt/paved') pavedCount++;
      energySum += seg.energyBenchmarkWhPerKm;
    }

    // SanitizedSpatialSegment.surfaceEstimated kennt nur zwei echte Kategorien
    // ('asphalt/paved' | 'gravel/trail'). Eine dritte "unpavedPercent"-Kategorie
    // gäbe es nur durch Erfinden einer Aufteilung, die die Daten nicht hergeben —
    // deshalb bleibt sie bei echten Community-Daten bewusst 0, statt geraten.
    const total = segments.length;
    const asphaltPercent = Math.round((pavedCount / total) * 100);
    const gravelPercent = 100 - asphaltPercent;
    const unpavedPercent = 0;

    return {
      surfaceBreakdown: { asphaltPercent, gravelPercent, unpavedPercent },
      avgEnergyBenchmarkWhPerKm: Number((energySum / total).toFixed(1)),
      segmentCount: total,
    };
  }
}
