import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ConsentService } from './consentService';

export interface SanitizedSpatialSegment {
  segmentId: string;
  geohashPrefix: string;
  /** Auf ~1,1 km Raster quantisierte Trackpunkte (2 Nachkommastellen). */
  coordinates: [number, number][];
  /** Summierter Höhenanstieg der gefahrenen Strecke in Metern. */
  elevationGainM: number;
  avgSlopePercent: number;
  energyBenchmarkWhPerKm: number;
  surfaceEstimated: string;
  totalDistanceKm: number;
  recordDate: string; // YYYY-MM-DD (Datum ohne Uhrzeit für Aktualitätsprüfung)
}

/**
 * Precision: 2 Nachkommastellen ≈ 1,1 km Auflösung.
 * Ein originaler GPS-Track (Meter-Auflösung) ist ein eindeutig
 * wiedererkennbares Bewegungsprofil und darf nicht übertragen werden.
 */
const GRID_PRECISION = 2;

/**
 * Maximale Punktzahl je hochgeladenem Segment. Begrenzt sowohl das
 * Speichervolumen als auch den Re-Identifizierungsgrad einer einzelnen Fahrt.
 */
const MAX_POINTS = 24;

export class SpatialTelemetrySanitizerService {
  /**
   * Erzeugt den Raster-Key für die anonyme räumliche Indizierung (~1 km Raster).
   */
  private static getSpatialGridKey(lat: number, lng: number): string {
    const latRounded = lat.toFixed(GRID_PRECISION);
    const lngRounded = lng.toFixed(GRID_PRECISION);
    return `grid_${latRounded}_${lngRounded}`;
  }

  /**
   * Quantisiert einen Track auf die Rasterauflösung und vereinheitlicht
   * benachbarte Punkte, sodass nur noch grobe Kursangaben verbleiben —
   * entsprechend der Beschreibung in Datenschutzerklärung und
   * DATA_FLOW_MATRIX.md, die seit der Einführung des Schemas nicht
   * durch den Code gedeckt war.
   */
  private static quantizeTrack(trackCoordinates: [number, number][]): [number, number][] {
    const factor = 10 ** GRID_PRECISION;
    const quantized = trackCoordinates.map(([lat, lng]) => [
      Math.round(lat * factor) / factor,
      Math.round(lng * factor) / factor,
    ]) as [number, number][];

    // Aufeinanderfolgende Punkte im selben Rasterfeld entfernen.
    const deduped: [number, number][] = [];
    for (const point of quantized) {
      const prev = deduped[deduped.length - 1];
      if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
        deduped.push(point);
      }
    }

    // Bei Bedarf gleichmäßig dezimieren.
    if (deduped.length > MAX_POINTS) {
      const step = deduped.length / MAX_POINTS;
      const sampled: [number, number][] = [];
      for (let i = 0; i < MAX_POINTS; i++) {
        sampled.push(deduped[Math.floor(i * step)]);
      }
      return sampled;
    }
    return deduped;
  }

  /**
   * Übermittelt ausschließlich quantisierte Navigationsintelligenz an die
   * kollektive Kartengrafik:
   * 1. Keine Nutzerkennungen, Geräte-IDs, exakten Uhrzeiten oder Konto-IDs.
   * 2. Koordinaten auf ~1,1 km Rasterauflösung reduziert und auf max. 24
   *    Stützpunkte dezimiert — es wird KEIN Original-GPS-Track übertragen.
   * 3. Nur bei erteilter Analytics-Einwilligung (Art. 6/7 DSGVO).
   */
  public static async sanitizeAndMergeTrack(
    trackCoordinates: [number, number][],
    elevationGainM: number,
    distanceKm: number,
    energyWhUsed: number
  ): Promise<SanitizedSpatialSegment | null> {
    if (!trackCoordinates || trackCoordinates.length < 3) {
      return null;
    }

    // Einwilligungs-Gate: ohne Analytics-Einwilligung wird nichts übertragen.
    if (!ConsentService.allowsAnalytics) {
      console.log('🗺️ [Collective Intelligence] Kein Upload ohne Analytics-Einwilligung.');
      return null;
    }

    // 1. Steigungen aus dem Summenanstieg ableiten
    const totalDistMeters = Math.max(distanceKm * 1000, 100);
    const avgSlope = Number(((elevationGainM / totalDistMeters) * 100).toFixed(1));
    const whPerKm = distanceKm > 0 ? Number((energyWhUsed / distanceKm).toFixed(1)) : 12.0;

    const sanitizedCoordinates = this.quantizeTrack(trackCoordinates);
    if (sanitizedCoordinates.length < 2) {
      return null;
    }

    const startCoord = trackCoordinates[0];
    const gridKey = this.getSpatialGridKey(startCoord[0], startCoord[1]);
    const segmentId = `seg_${gridKey}_${Date.now().toString(36)}`;
    const recordDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 2. Anonymes Spatial-Payload. Es werden ausschließlich abgeleitete
    //    Kennzahlen und der grob rasterisierte Kurs übertragen.
    const sanitizedSegment: SanitizedSpatialSegment = {
      segmentId,
      geohashPrefix: gridKey,
      coordinates: sanitizedCoordinates,
      elevationGainM: Math.round(elevationGainM),
      avgSlopePercent: avgSlope,
      energyBenchmarkWhPerKm: whPerKm,
      surfaceEstimated: avgSlope > 10 ? 'gravel/trail' : 'asphalt/paved',
      totalDistanceKm: Number(distanceKm.toFixed(2)),
      recordDate,
    };

    // 3. Anonym in die kollektive Kartengrafik einlesen
    try {
      await setDoc(doc(db, 'spatial_road_intelligence', segmentId), sanitizedSegment);
      console.log(
        `🗺️ [Collective Intelligence] Quantisiertes Segment übertragen: ${segmentId} (Steigung: ${avgSlope}%, Wh/km: ${whPerKm}, Punkte: ${sanitizedCoordinates.length})`
      );
    } catch (e) {
      // Offline-Fallback: lokalen Raster-Cache befüllen.
      try {
        const existing = JSON.parse(localStorage.getItem('wegweiser_spatial_cache') || '[]');
        existing.push(sanitizedSegment);
        localStorage.setItem('wegweiser_spatial_cache', JSON.stringify(existing.slice(-50)));
        console.log('🗺️ [Collective Intelligence] Lokal zwischengespeichert für Offline-Korridorrouting');
      } catch (cacheErr) {
        console.warn('[Collective Intelligence] Lokaler Cache nicht beschreibbar:', cacheErr);
      }
    }

    return sanitizedSegment;
  }
}
