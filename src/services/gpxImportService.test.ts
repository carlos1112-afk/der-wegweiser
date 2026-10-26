// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GpxImportService, MAX_GPX_XML_LENGTH, sanitizeGpxXml, type SanitizedGpxXml } from './gpxImportService';

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Test">
  <metadata><name>Test-Tour</name></metadata>
  <trk>
    <name>Test-Tour</name>
    <trkseg>
      <trkpt lat="52.5200" lon="13.4050"><ele>40.0</ele></trkpt>
      <trkpt lat="52.5300" lon="13.4100"><ele>45.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('sanitizeGpxXml (XXE-Schutz)', () => {
  it('entfernt DOCTYPE-Deklarationen', () => {
    const xml = `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><gpx/>`;
    const result = sanitizeGpxXml(xml);
    expect(result.sanitized).not.toContain('<!DOCTYPE');
    expect(result.sanitized).not.toContain('SYSTEM');
    expect(result.stripped.some((s) => s.includes('<!DOCTYPE'))).toBe(true);
  });

  it('entfernt ENTITY-Deklarationen', () => {
    const xml = `<!ENTITY xxe SYSTEM "file:///etc/passwd"><gpx/>`;
    const result = sanitizeGpxXml(xml);
    expect(result.sanitized).not.toContain('<!ENTITY');
    expect(result.stripped.some((s) => s.includes('<!ENTITY'))).toBe(true);
  });

  it('entfernt ELEMENT- und ATTLIST-Deklarationen', () => {
    const xml = `<!ELEMENT gpx (trk)><!ATTLIST gpx version CDATA #IMPLIED><gpx/>`;
    const result = sanitizeGpxXml(xml);
    expect(result.sanitized).not.toContain('<!ELEMENT');
    expect(result.sanitized).not.toContain('<!ATTLIST');
    expect(result.stripped.length).toBe(2);
  });

  it('lässt gültigen GPX-Inhalt unverändert', () => {
    const result = sanitizeGpxXml(VALID_GPX);
    expect(result.sanitized).toBe(VALID_GPX);
    expect(result.stripped).toEqual([]);
  });

  it('gibt SanitizedGpxXml-Objekt mit sanitized und stripped zurück', () => {
    const result: SanitizedGpxXml = sanitizeGpxXml('<gpx/>');
    expect(typeof result.sanitized).toBe('string');
    expect(Array.isArray(result.stripped)).toBe(true);
  });

  it('verarbeitet viele Deklarationen in einem Durchlauf und begrenzt die Anzahl', () => {
    const xml = `${Array.from({ length: 256 }, (_, i) => `<!ENTITY e${i} "value">`).join('')}<gpx/>`;
    const result = sanitizeGpxXml(xml);
    expect(result.stripped).toHaveLength(256);
    expect(result.sanitized).toBe('<gpx/>');
    expect(() => sanitizeGpxXml(`${xml}<!ENTITY overflow "value">`)).toThrow(/zu viele Deklarationen/);
  });

  it('lehnt übergroße GPX-Eingaben und einzelne überlange Deklarationen ab', () => {
    expect(() => sanitizeGpxXml('x'.repeat(MAX_GPX_XML_LENGTH + 1))).toThrow(/zu groß/);
    expect(() => sanitizeGpxXml(`<!DOCTYPE foo [${'x'.repeat(1_000_001)}]>`)).toThrow(/Deklaration ist zu lang/);
  });
});

describe('GpxImportService.parseGpx', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parst eine gültige GPX-Datei zu einer Route', () => {
    const route = GpxImportService.parseGpx(VALID_GPX, 'tour.gpx');
    expect(route.id.startsWith('imported-gpx-')).toBe(true);
    expect(route.title).toBe('Test-Tour');
    expect(route.pathCoordinates.length).toBe(2);
    expect(route.pathCoordinates[0]).toEqual([52.52, 13.405]);
    expect(route.distanceKm).toBeGreaterThan(0);
    expect(route.elevationGainM).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(route.waypoints)).toBe(true);
    expect(route.waypoints[0].category).toBe('start');
    expect(route.waypoints[route.waypoints.length - 1].category).toBe('end');
  });

  it('verwendet Dateiname als Titel wenn kein name-Tag vorhanden ist', () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="52.52" lon="13.405"><ele>40</ele></trkpt>
      <trkpt lat="52.53" lon="13.41"><ele>42</ele></trkpt>
    </trkseg></trk></gpx>`;
    const route = GpxImportService.parseGpx(gpx, 'MeineTour.gpx');
    expect(route.title).toBe('MeineTour');
  });

  it('wirft Fehler bei zu wenigen Wegpunkten (<2)', () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="52.52" lon="13.405"><ele>40</ele></trkpt>
    </trkseg></trk></gpx>`;
    expect(() => GpxImportService.parseGpx(gpx)).toThrow(/zu wenige Wegpunkte/);
  });

  it('wirft Fehler bei ungültigem XML', () => {
    expect(() => GpxImportService.parseGpx('<gpx><unclosed>')).toThrow(/Ungültiges GPX/);
  });

  it('schaltet XXE-Inhalte durch DOCTYPE-Entfernung aus', () => {
    const xxeGpx = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<gpx><trk><trkseg>
  <trkpt lat="52.52" lon="13.405"><ele>40</ele></trkpt>
  <trkpt lat="52.53" lon="13.41"><ele>42</ele></trkpt>
</trkseg></trk></gpx>`;
    const route = GpxImportService.parseGpx(xxeGpx, 'tour.gpx');
    expect(route.pathCoordinates.length).toBe(2);
    const aiStory = route.aiStory.toLowerCase();
    expect(aiStory).not.toContain('root:');
    expect(aiStory).not.toContain('/etc/passwd');
  });
});
