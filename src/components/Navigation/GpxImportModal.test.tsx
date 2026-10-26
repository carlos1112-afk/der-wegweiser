// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GpxImportModal } from './GpxImportModal';

const mockParseGpxFile = vi.fn();
vi.mock('../../services/gpxImportService', () => ({
  GpxImportService: {
    parseGpxFile: (...args: unknown[]) => mockParseGpxFile(...args),
  },
}));
vi.mock('../../services/soundFxService', () => ({
  SoundFxService: {
    playWarningTone: vi.fn(),
    playSuccessChime: vi.fn(),
    playTurnChime: vi.fn(),
  },
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const VALID_GPX = `<gpx><trk><trkseg>
  <trkpt lat="52.52" lon="13.405"><ele>40</ele></trkpt>
  <trkpt lat="52.53" lon="13.41"><ele>42</ele></trkpt>
</trkseg></trk></gpx>`;

beforeEach(() => {
  mockParseGpxFile.mockReset();
  mockParseGpxFile.mockResolvedValue({
    id: 'r1',
    title: 'Test Tour',
    summary: 's',
    aiStory: 'st',
    distanceKm: 10,
    elevationGainM: 100,
    estimatedTimeMin: 30,
    estimatedBatteryConsumptionWh: 200,
    isBatterySafe: true,
    surfaceBreakdown: { asphaltPercent: 70, gravelPercent: 20, unpavedPercent: 10 },
    waypoints: [],
    pathCoordinates: [[52.52, 13.405], [52.53, 13.41]],
    chargingStopsOnRoute: [],
  } as any);
});

it('weist Datei mit falscher Endung zurück und ruft den Parser nicht auf', async () => {
  const onRouteLoaded = vi.fn();
  render(<GpxImportModal isOpen onRouteLoaded={onRouteLoaded} onClose={vi.fn()} />);
  const input = screen.getByLabelText(/Datei Durchsuchen/i);
  const file = new File(['<gpx></gpx>'], 'tour.txt', { type: 'text/xml' });
  fireEvent.change(input, { target: { files: [file] } });
  screen.getByText(/Nur .gpx-Dateien sind erlaubt/);
  expect(mockParseGpxFile).not.toHaveBeenCalled();
  expect(onRouteLoaded).not.toHaveBeenCalled();
});

it('weist übergroße Datei zurück (>10 MB)', async () => {
  render(<GpxImportModal isOpen onRouteLoaded={vi.fn()} onClose={vi.fn()} />);
  const input = screen.getByLabelText(/Datei Durchsuchen/i);
  const file = new File(['x'.repeat(11 * 1024 * 1024)], 'tour.gpx', { type: 'application/gpx+xml' });
  fireEvent.change(input, { target: { files: [file] } });
  screen.getByText(/10 MB/);
  expect(mockParseGpxFile).not.toHaveBeenCalled();
});

it('parst eine gültige .gpx-Datei und legt den Titel ab', async () => {
  const onRouteLoaded = vi.fn();
  render(<GpxImportModal isOpen onRouteLoaded={onRouteLoaded} onClose={vi.fn()} />);
  const input = screen.getByLabelText(/Datei Durchsuchen/i);
  const file = new File([VALID_GPX], 'tour.gpx', { type: 'application/gpx+xml' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(mockParseGpxFile).toHaveBeenCalled());
  screen.getByText(/Test Tour/);
  expect(onRouteLoaded).not.toHaveBeenCalled();
});
