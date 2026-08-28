import type { Route, Waypoint } from '../types/navigation';

function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class GpxImportService {
  /**
   * Parses standard GPX 1.0 / 1.1 XML string and converts it into a full Der Wegweiser Route.
   */
  public static parseGpx(gpxString: string, fileName?: string): Route {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxString, 'text/xml');

    // Check for parse errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error('Ungültiges GPX-Dateiformat');
    }

    // Extract title
    const nameEl = xmlDoc.getElementsByTagName('name')[0];
    const title = nameEl && nameEl.textContent
      ? nameEl.textContent.trim()
      : fileName
      ? fileName.replace(/\.gpx$/i, '')
      : 'Importierte E-Bike Tour';

    // Extract track points (<trkpt> or <rtept> or <wpt>)
    let ptElements = Array.from(xmlDoc.getElementsByTagName('trkpt'));
    if (ptElements.length === 0) {
      ptElements = Array.from(xmlDoc.getElementsByTagName('rtept'));
    }
    if (ptElements.length === 0) {
      ptElements = Array.from(xmlDoc.getElementsByTagName('wpt'));
    }

    if (ptElements.length < 2) {
      throw new Error('Die GPX-Datei enthält zu wenige Wegpunkte (<2)');
    }

    const pathCoordinates: [number, number][] = [];
    const elevations: number[] = [];
    let totalDistanceM = 0;
    let totalElevationGainM = 0;

    ptElements.forEach((el) => {
      const lat = parseFloat(el.getAttribute('lat') || '0');
      const lon = parseFloat(el.getAttribute('lon') || '0');

      if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
        pathCoordinates.push([lat, lon]);

        // Elevation
        const eleNode = el.getElementsByTagName('ele')[0];
        const ele = eleNode && eleNode.textContent ? parseFloat(eleNode.textContent) : 40;
        elevations.push(ele);

        if (pathCoordinates.length > 1) {
          const prev = pathCoordinates[pathCoordinates.length - 2];
          const dist = haversineDistanceM(prev[0], prev[1], lat, lon);
          totalDistanceM += dist;

          const prevEle = elevations[elevations.length - 2];
          if (ele > prevEle) {
            totalElevationGainM += ele - prevEle;
          }
        }
      }
    });

    const distanceKm = +(totalDistanceM / 1000).toFixed(1);
    const elevationGainM = Math.round(totalElevationGainM);
    // Average E-Bike speed ~ 20 km/h
    const estimatedTimeMin = Math.round((distanceKm / 20) * 60);

    // Energy calculation: ~5.5 Wh/km + climb Wh (potential energy)
    const baseWh = distanceKm * 5.5;
    const climbWh = (95 * 9.81 * elevationGainM / 3600) / 0.78;
    const estimatedBatteryConsumptionWh = Math.round(baseWh + climbWh);

    const waypoints: Waypoint[] = [];
    if (pathCoordinates.length > 0) {
      waypoints.push({
        id: 'wp-start',
        lat: pathCoordinates[0][0],
        lng: pathCoordinates[0][1],
        name: 'Startpunkt',
        category: 'start',
      });

      const endIdx = pathCoordinates.length - 1;
      waypoints.push({
        id: 'wp-end',
        lat: pathCoordinates[endIdx][0],
        lng: pathCoordinates[endIdx][1],
        name: 'Zielort',
        category: 'end',
      });
    }

    return {
      id: `imported-gpx-${Date.now()}`,
      title,
      summary: `Komoot/Strava GPX-Track • ${distanceKm} km • ${elevationGainM}m Höhenunterschied`,
      aiStory: `Importierte E-Bike Tour mit ${pathCoordinates.length} Trackpunkten. Errechneter Energiebedarf: ca. ${estimatedBatteryConsumptionWh} Wh.`,
      distanceKm,
      elevationGainM,
      estimatedTimeMin,
      estimatedBatteryConsumptionWh,
      isBatterySafe: estimatedBatteryConsumptionWh < 500,
      surfaceBreakdown: {
        asphaltPercent: 70,
        gravelPercent: 20,
        unpavedPercent: 10,
      },
      waypoints,
      pathCoordinates,
      chargingStopsOnRoute: [],
    };
  }

  /**
   * Reads a File object from file picker / drag & drop and returns a Route.
   */
  public static async parseGpxFile(file: File): Promise<Route> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const route = this.parseGpx(content, file.name);
          resolve(route);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Fehler beim Lesen der GPX-Datei'));
      reader.readAsText(file);
    });
  }
}
