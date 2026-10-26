import { describe, it, expect } from 'vitest';
import {
  searchQuerySchema,
  gpxFileSchema,
  gpxImportSchema,
  stationReviewSchema,
  reportIssueSchema,
  coordinatesSchema,
  routeInputSchema,
} from './validation';

describe('searchQuerySchema', () => {
  it('akzeptiert einen normalen Suchbegriff', () => {
    const result = searchQuerySchema.safeParse('Berlin Alexanderplatz');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Berlin Alexanderplatz');
  });

  it('trimmt führende und nachgestellte Leerzeichen', () => {
    const result = searchQuerySchema.safeParse('  München  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('München');
  });

  it('weist leeren Suchbegriff zurück', () => {
    const result = searchQuerySchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('leer');
  });

  it('weist reinen Whitespace zurück', () => {
    const result = searchQuerySchema.safeParse('   ');
    expect(result.success).toBe(false);
  });

  it('weist zu lange Suchbegriffe zurück', () => {
    const result = searchQuerySchema.safeParse('a'.repeat(101));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('100');
  });

  it('weist Steuerzeichen zurück', () => {
    const result = searchQuerySchema.safeParse('foo\x01bar');
    expect(result.success).toBe(false);
  });
});

describe('gpxFileSchema', () => {
  it('akzeptiert eine gültige .gpx-Datei', () => {
    const result = gpxFileSchema.safeParse({ name: 'tour.gpx', size: 1024 });
    expect(result.success).toBe(true);
  });

  it('weist falsche Dateiendung zurück', () => {
    const result = gpxFileSchema.safeParse({ name: 'tour.xml', size: 1024 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('.gpx');
  });

  it('weist leeren Dateinamen zurück', () => {
    const result = gpxFileSchema.safeParse({ name: '', size: 1024 });
    expect(result.success).toBe(false);
  });

  it('weist übergroße Dateien zurück (>10 MB)', () => {
    const result = gpxFileSchema.safeParse({ name: 'tour.gpx', size: 11 * 1024 * 1024 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('10 MB');
  });

  it('akzeptiert genau 10 MB', () => {
    const result = gpxFileSchema.safeParse({ name: 'tour.gpx', size: 10 * 1024 * 1024 });
    expect(result.success).toBe(true);
  });
});

describe('gpxImportSchema', () => {
  it('akzeptiert gültigen GPX-Inhalt', () => {
    const result = gpxImportSchema.safeParse({ name: 'Tour', content: '<gpx></gpx>' });
    expect(result.success).toBe(true);
  });

  it('weist leeren Inhalt zurück', () => {
    const result = gpxImportSchema.safeParse({ name: 'Tour', content: '' });
    expect(result.success).toBe(false);
  });

  it('weist zu langen Namen zurück', () => {
    const result = gpxImportSchema.safeParse({ name: 'a'.repeat(101), content: '<gpx></gpx>' });
    expect(result.success).toBe(false);
  });
});

describe('stationReviewSchema', () => {
  it('akzeptiert gültige Bewertung', () => {
    const result = stationReviewSchema.safeParse({ rating: 5, comment: 'Top!', stationId: 's1' });
    expect(result.success).toBe(true);
  });

  it('weist Rating außerhalb 1-5 zurück', () => {
    expect(stationReviewSchema.safeParse({ rating: 0, stationId: 's1' }).success).toBe(false);
    expect(stationReviewSchema.safeParse({ rating: 6, stationId: 's1' }).success).toBe(false);
  });

  it('weist zu langen Kommentar zurück', () => {
    const result = stationReviewSchema.safeParse({ rating: 5, comment: 'a'.repeat(501), stationId: 's1' });
    expect(result.success).toBe(false);
  });
});

describe('reportIssueSchema', () => {
  it('akzeptiert gültige Meldung', () => {
    const result = reportIssueSchema.safeParse({
      stationId: 's1',
      issueType: 'broken_charger',
      description: 'Ladepunkt defekt.',
    });
    expect(result.success).toBe(true);
  });

  it('weist zu kurze Beschreibung zurück', () => {
    const result = reportIssueSchema.safeParse({
      stationId: 's1',
      issueType: 'other',
      description: 'ab',
    });
    expect(result.success).toBe(false);
  });

  it('weist ungültige E-Mail zurück', () => {
    const result = reportIssueSchema.safeParse({
      stationId: 's1',
      issueType: 'other',
      description: 'Ladepunkt defekt.',
      contactEmail: 'keine-email',
    });
    expect(result.success).toBe(false);
  });

  it('akzeptiert optionale leere E-Mail', () => {
    const result = reportIssueSchema.safeParse({
      stationId: 's1',
      issueType: 'other',
      description: 'Ladepunkt defekt.',
      contactEmail: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('coordinatesSchema', () => {
  it('akzeptiert gültige Koordinaten', () => {
    const result = coordinatesSchema.safeParse([52.52, 13.405]);
    expect(result.success).toBe(true);
  });

  it('weist ungültigen Breitengrad zurück', () => {
    expect(coordinatesSchema.safeParse([91, 13.405]).success).toBe(false);
    expect(coordinatesSchema.safeParse([-91, 13.405]).success).toBe(false);
  });

  it('weist ungültigen Längengrad zurück', () => {
    expect(coordinatesSchema.safeParse([52.52, 181]).success).toBe(false);
    expect(coordinatesSchema.safeParse([52.52, -181]).success).toBe(false);
  });
});

describe('routeInputSchema', () => {
  it('akzeptiert gültige Routen-Eingabe', () => {
    const result = routeInputSchema.safeParse({
      title: 'Meine Tour',
      distanceKm: 42.5,
      elevationGainM: 350,
    });
    expect(result.success).toBe(true);
  });

  it('weist leeren Titel zurück', () => {
    expect(routeInputSchema.safeParse({ title: '', distanceKm: 10, elevationGainM: 0 }).success).toBe(false);
  });

  it('weist negative Distanz zurück', () => {
    expect(routeInputSchema.safeParse({ title: 'T', distanceKm: -5, elevationGainM: 0 }).success).toBe(false);
  });

  it('weist übermäßige Höhenmeter zurück', () => {
    expect(routeInputSchema.safeParse({ title: 'T', distanceKm: 10, elevationGainM: 50001 }).success).toBe(false);
  });
});
