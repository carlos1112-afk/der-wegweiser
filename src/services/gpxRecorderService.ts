import type { LiveBikeTelemetry } from '../types/navigation';

export interface GpxTrackPoint {
  lat: number;
  lng: number;
  altitude: number;
  speedKmH: number;
  cadenceRpm: number;
  riderPowerWatts: number;
  motorPowerWatts: number;
  batterySoC: number;
  timestamp: string; // ISO 8601
}

export interface RideSummary {
  distanceKm: number;
  durationSeconds: number;
  avgSpeedKmH: number;
  maxSpeedKmH: number;
  elevationGainM: number;
  energyWhUsed: number;
  tokensEarned: number;
  trackPointsCount: number;
  coordinates: [number, number][];
  gpxXmlString: string;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class GpxRecorderService {
  private static isRecording = false;
  private static isPaused = false;
  private static elapsedSeconds = 0;
  private static totalDistanceM = 0;
  private static recordedPoints: GpxTrackPoint[] = [];
  private static initialBatterySoC: number | null = null;
  private static idleSecondsCount = 0;

  public static startRecording(initialBatteryPercent: number = 85): void {
    this.isRecording = true;
    this.isPaused = false;
    this.elapsedSeconds = 0;
    this.totalDistanceM = 0;
    this.recordedPoints = [];
    this.initialBatterySoC = initialBatteryPercent;
    this.idleSecondsCount = 0;
  }

  public static pauseRecording(): void {
    this.isPaused = true;
  }

  public static resumeRecording(): void {
    this.isPaused = false;
  }

  public static togglePause(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public static getStatus() {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      elapsedSeconds: this.elapsedSeconds,
      distanceKm: +(this.totalDistanceM / 1000).toFixed(2),
      pointsCount: this.recordedPoints.length,
    };
  }

  /**
   * Adds a new GPS + BLE Telemetry sample to the active recording.
   */
  public static addPoint(
    location: { lat: number; lng: number; altitude?: number | null; speed?: number | null },
    telemetry: LiveBikeTelemetry
  ): void {
    if (!this.isRecording) return;

    const speedKmH = location.speed !== null && location.speed !== undefined
      ? +(location.speed * 3.6).toFixed(1)
      : telemetry.speedKmH || 0;

    // Auto-Pause check: If standing still (< 1.5 km/h) for > 5 seconds
    if (speedKmH < 1.5) {
      this.idleSecondsCount += 1;
      if (this.idleSecondsCount >= 5 && !this.isPaused) {
        this.isPaused = true;
      }
    } else {
      this.idleSecondsCount = 0;
      if (this.isPaused) {
        this.isPaused = false;
      }
    }

    if (this.isPaused) return;

    this.elapsedSeconds += 1;

    // Calculate distance delta from last point
    if (this.recordedPoints.length > 0) {
      const last = this.recordedPoints[this.recordedPoints.length - 1];
      const deltaM = haversineMeters(last.lat, last.lng, location.lat, location.lng);
      if (deltaM > 0.5 && deltaM < 200) {
        this.totalDistanceM += deltaM;
      }
    }

    const point: GpxTrackPoint = {
      lat: location.lat,
      lng: location.lng,
      altitude: location.altitude || 45,
      speedKmH,
      cadenceRpm: telemetry.cadenceRpm || 0,
      riderPowerWatts: telemetry.riderPowerWatts || 0,
      motorPowerWatts: telemetry.motorPowerWatts || 0,
      batterySoC: telemetry.batteryPercent,
      timestamp: new Date().toISOString(),
    };

    this.recordedPoints.push(point);
  }

  /**
   * Stops recording and produces a full RideSummary with GPX XML.
   */
  public static stopRecording(): RideSummary {
    this.isRecording = false;
    this.isPaused = false;

    const distanceKm = +(this.totalDistanceM / 1000).toFixed(2);
    const durationSeconds = this.elapsedSeconds;
    
    let maxSpeed = 0;
    let speedSum = 0;
    let elevGain = 0;

    this.recordedPoints.forEach((p, idx) => {
      if (p.speedKmH > maxSpeed) maxSpeed = p.speedKmH;
      speedSum += p.speedKmH;
      if (idx > 0 && p.altitude > this.recordedPoints[idx - 1].altitude) {
        elevGain += p.altitude - this.recordedPoints[idx - 1].altitude;
      }
    });

    const avgSpeed = this.recordedPoints.length > 0 ? +(speedSum / this.recordedPoints.length).toFixed(1) : 0;
    const tokensEarned = Math.max(1, Math.floor(distanceKm)); // 1 Token per km

    // Energy calculation
    const lastSoC = this.recordedPoints.length > 0 ? this.recordedPoints[this.recordedPoints.length - 1].batterySoC : 85;
    const socDiff = Math.max(0, (this.initialBatterySoC || 85) - lastSoC);
    const energyWhUsed = Math.round((socDiff / 100) * 625);

    const gpxXmlString = this.generateGpxXml();
    const coordinates: [number, number][] = this.recordedPoints.map((p) => [p.lat, p.lng]);

    return {
      distanceKm,
      durationSeconds,
      avgSpeedKmH: avgSpeed,
      maxSpeedKmH: Math.round(maxSpeed),
      elevationGainM: Math.round(elevGain),
      energyWhUsed,
      tokensEarned,
      trackPointsCount: this.recordedPoints.length,
      coordinates,
      gpxXmlString,
    };
  }

  /**
   * Generates standard GPX 1.1 XML string with Garmin/Strava track extensions.
   */
  public static generateGpxXml(rideTitle: string = 'Der Wegweiser E-Bike Tour'): string {
    const timeStr = new Date().toISOString();

    let trkptsXml = '';
    this.recordedPoints.forEach((p) => {
      trkptsXml += `
      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
        <ele>${p.altitude.toFixed(1)}</ele>
        <time>${p.timestamp}</time>
        <extensions>
          <gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
            <gpxtpx:cad>${p.cadenceRpm}</gpxtpx:cad>
            <gpxtpx:power>${p.riderPowerWatts}</gpxtpx:power>
            <gpxtpx:motor_power>${p.motorPowerWatts}</gpxtpx:motor_power>
            <gpxtpx:soc>${p.batterySoC}</gpxtpx:soc>
            <gpxtpx:speed>${(p.speedKmH / 3.6).toFixed(2)}</gpxtpx:speed>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Der Wegweiser — Autonomous E-Bike Co-Pilot" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${rideTitle}</name>
    <time>${timeStr}</time>
  </metadata>
  <trk>
    <name>${rideTitle}</name>
    <type>Cycling</type>
    <trkseg>
      ${trkptsXml}
    </trkseg>
  </trk>
</gpx>`;
  }

  public static downloadGpxFile(filename: string = 'der_wegweiser_tour.gpx'): void {
    const xml = this.generateGpxXml();
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public static async shareGpxTrack(filename: string = 'der_wegweiser_tour.gpx'): Promise<boolean> {
    const xml = this.generateGpxXml();
    const file = new File([xml], filename, { type: 'application/gpx+xml' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Der Wegweiser E-Bike Tour (GPX)',
          text: 'Hier ist meine aufgezeichnete E-Bike Tour mit voller Telemetrie.',
        });
        return true;
      } catch (e) {
        console.warn('[GpxRecorder] Share canceled or failed:', e);
      }
    }

    // Fallback: regular download
    this.downloadGpxFile(filename);
    return true;
  }
}
