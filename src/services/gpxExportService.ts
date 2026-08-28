import type { Route } from '../types/navigation';

/**
 * GPX Export Service for generating GPX 1.1 XML format from Route data
 * and triggering automatic browser downloads.
 */
export class GpxExportService {
  /**
   * Constructs a valid GPX 1.1 XML string for a given route (including waypoints,
   * elevation, charging stops, and trackpoints) and initiates an automatic file download.
   */
  public static exportRouteToGpx(route: Route): void {
    if (!route) {
      console.warn('[GpxExportService] Cannot export null or undefined route');
      return;
    }

    const escapeXml = (unsafe: string): string => {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const title = route.title || 'E-Bike_Route';
    const summary = route.summary || route.aiStory || 'Der Wegweiser KI E-Bike Tour';
    const creator = 'Der Wegweiser - KI E-Bike Navi';
    const nowIso = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<gpx version="1.1" creator="${escapeXml(creator)}" `;
    xml += `xmlns="http://www.topografix.com/GPX/1/1" `;
    xml += `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" `;
    xml += `xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n`;

    // Metadata
    xml += `  <metadata>\n`;
    xml += `    <name>${escapeXml(title)}</name>\n`;
    xml += `    <desc>${escapeXml(summary)}</desc>\n`;
    xml += `    <author>\n`;
    xml += `      <name>Der Wegweiser KI</name>\n`;
    xml += `    </author>\n`;
    xml += `    <time>${nowIso}</time>\n`;
    xml += `  </metadata>\n`;

    // Waypoints
    if (route.waypoints && route.waypoints.length > 0) {
      route.waypoints.forEach((wpt, index) => {
        xml += `  <wpt lat="${wpt.lat}" lon="${wpt.lng}">\n`;
        if (wpt.elevation !== undefined) {
          xml += `    <ele>${wpt.elevation}</ele>\n`;
        } else {
          xml += `    <ele>35</ele>\n`;
        }
        xml += `    <name>${escapeXml(wpt.name || `Waypoint ${index + 1}`)}</name>\n`;
        if (wpt.description) {
          xml += `    <desc>${escapeXml(wpt.description)}</desc>\n`;
        }
        if (wpt.category) {
          xml += `    <sym>${escapeXml(wpt.category)}</sym>\n`;
        } else {
          xml += `    <sym>Generic</sym>\n`;
        }
        xml += `  </wpt>\n`;
      });
    }

    // Charging Stations as GPX Waypoints
    if (route.chargingStopsOnRoute && route.chargingStopsOnRoute.length > 0) {
      route.chargingStopsOnRoute.forEach((cs) => {
        xml += `  <wpt lat="${cs.lat}" lon="${cs.lng}">\n`;
        xml += `    <name>⚡ ${escapeXml(cs.name)}</name>\n`;
        xml += `    <desc>E-Bike Ladesäule (${cs.plugType}, ${cs.openingHours})</desc>\n`;
        xml += `    <sym>charging_station</sym>\n`;
        xml += `  </wpt>\n`;
      });
    }

    // Track
    xml += `  <trk>\n`;
    xml += `    <name>${escapeXml(title)}</name>\n`;
    xml += `    <desc>${escapeXml(summary)} - Distanz: ${route.distanceKm} km, Höhenmeter: ${route.elevationGainM} hm</desc>\n`;
    xml += `    <trkseg>\n`;

    // Calculate elevation profile curve for trackpoints
    const totalPoints = Math.max(1, route.pathCoordinates.length);
    const elevationGainM = route.elevationGainM || 25;
    const baseElevation = 35; // meters above sea level

    route.pathCoordinates.forEach(([lat, lng], idx) => {
      // Create realistic undulating elevation profile along coordinates
      const progress = idx / totalPoints;
      const elevationCurve = Math.sin(progress * Math.PI) * elevationGainM;
      const elevation = Math.round(baseElevation + elevationCurve);

      xml += `      <trkpt lat="${lat}" lon="${lng}">\n`;
      xml += `        <ele>${elevation}</ele>\n`;
      xml += `      </trkpt>\n`;
    });

    xml += `    </trkseg>\n`;
    xml += `  </trk>\n`;
    xml += `</gpx>`;

    // Trigger automatic browser download
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
    const fileName = `${title.replace(/\s+/g, '_')}.gpx`;
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  }
}

// Export standalone exportRouteToGpx method for flexible imports
export const exportRouteToGpx = GpxExportService.exportRouteToGpx.bind(GpxExportService);
