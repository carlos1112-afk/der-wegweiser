// @vitest-environment jsdom
import { createElement } from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act, cleanup } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ beginRide: vi.fn(), saveRide: vi.fn(), hasPending: vi.fn(), status: { isRecording: false, isPaused: false, elapsedSeconds: 0, distanceKm: 0 }, startRecording: vi.fn(), stopRecording: vi.fn(), reset: vi.fn(), addPoint: vi.fn(), getSummary: vi.fn() }));
vi.mock('../../src/services/routeArchiveService', () => ({ routeArchive: mocks }));
vi.mock('../../src/services/gpxRecorderService', () => ({ GpxRecorderService: { ...mocks, getStatus: () => mocks.status, togglePause: vi.fn() } }));
vi.mock('../../src/services/soundFxService', () => ({ SoundFxService: { playTurnChime: vi.fn(), playClick: vi.fn(), playSuccessChime: vi.fn() } }));
import { GpxRecorderHUD } from '../../src/components/Recording/GpxRecorderHUD';
import { ConsentService } from '../../src/services/consentService';
const summary = { distanceKm: 1, durationSeconds: 60, coordinates: [[52,13],[52.01,13.01]], trackPointsCount: 2, gpxXmlString: '<gpx />' };
const props = () => ({ ownerId: 'alice', route: { id: 'plan', title: 'Tour' } as any, userLocation: { lat: 52, lng: 13, observedAt: Date.now(), accuracyM: 5 }, telemetry: { batteryPercent: 50 } as any, onFinishRide: vi.fn() });
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); ConsentService.save({ essential: true, analytics: false, surveys: false, personalizedAds: false });
  mocks.status.isRecording = false; mocks.status.isPaused = false; mocks.hasPending.mockReturnValue(false);
  mocks.beginRide.mockResolvedValue({ id: 'ride', ownerId: 'alice', startedAt: new Date().toISOString() }); mocks.saveRide.mockResolvedValue(undefined);
  mocks.startRecording.mockImplementation(() => { mocks.status.isRecording = true; }); mocks.stopRecording.mockImplementation(() => { mocks.status.isRecording = false; return summary; }); mocks.getSummary.mockReturnValue(summary);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('does not start recording before its archive entry commits; saves before displaying completion', async () => {
  let resolve: (value: any) => void = () => {}; mocks.beginRide.mockImplementation(() => new Promise(done => { resolve = done; }));
  const value = props(); render(createElement(GpxRecorderHUD, value)); expect(mocks.startRecording).not.toHaveBeenCalled();
  await act(async () => { resolve({ id: 'ride', ownerId: 'alice', startedAt: new Date().toISOString() }); });
  expect(mocks.startRecording).toHaveBeenCalledTimes(1);
  let finish: () => void = () => {}; mocks.saveRide.mockImplementationOnce(() => new Promise<void>(done => { finish = done; }));
  await act(async () => { fireEvent.click(screen.getByTitle('Aufzeichnung stoppen & GPX speichern')); });
  expect(value.onFinishRide).not.toHaveBeenCalled();
  await act(async () => { finish(); }); expect(value.onFinishRide).toHaveBeenCalledTimes(1);
});
it('keeps a failed final save available for retry instead of showing success or starting over', async () => {
  const value = props(); render(createElement(GpxRecorderHUD, value)); await act(async () => {});
  mocks.saveRide.mockRejectedValueOnce(new Error('Speicher voll'));
  await act(async () => { fireEvent.click(screen.getByTitle('Aufzeichnung stoppen & GPX speichern')); });
  expect(value.onFinishRide).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('Speicher voll');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fahrt-Sicherung wiederholen' })); });
  expect(value.onFinishRide).toHaveBeenCalledTimes(1); expect(mocks.beginRide).toHaveBeenCalledTimes(1);
});
it('does not record simulated positions or start a recorder after unmount', async () => {
  render(createElement(GpxRecorderHUD, { ...props(), isSimulating: true })); await act(async () => { vi.advanceTimersByTime(10000); });
  expect(mocks.beginRide).not.toHaveBeenCalled(); expect(mocks.addPoint).not.toHaveBeenCalled(); cleanup();
  let resolve: (value: any) => void = () => {}; mocks.beginRide.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(createElement(GpxRecorderHUD, props())); view.unmount();
  await act(async () => { resolve({ id: 'old-owner', startedAt: new Date().toISOString() }); });
  expect(mocks.startRecording).not.toHaveBeenCalled();
});
