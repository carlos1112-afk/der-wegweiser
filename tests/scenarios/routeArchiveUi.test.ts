// @vitest-environment jsdom
import { createElement } from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ list: vi.fn(), pendingPlans: vi.fn(), pendingRideCount: vi.fn(), pendingRideEntries: vi.fn(), retryPending: vi.fn(), subscribe: vi.fn(), saveGenerated: vi.fn(), getSavedRoutes: vi.fn() }));
vi.mock('../../src/services/routeArchiveService', () => ({ routeArchive: mocks }));
vi.mock('../../src/services/dataRepository', () => ({ dataRepository: mocks }));
vi.mock('../../src/services/gpxExportService', () => ({ exportRouteToGpx: vi.fn() }));
import { RouteArchivePanel } from '../../src/components/Archive/RouteArchivePanel';
const plan = (id: string, title: string, ridden = false) => ({ id, createdAt: '2026-10-28T10:00:00Z', hasBeenRidden: ridden, origin: 'generated', route: { id, title, distanceKm: 12, pathCoordinates: [[52,13],[52.1,13.1]] } });
const record = (id: string) => ({ id, planId: 'old', title: 'Aufgezeichnete Tour', startedAt: '2026-10-28T11:00:00Z', status: 'completed', summary: { distanceKm: 10, durationSeconds: 3600, trackPointsCount: 42, gpxXmlString: '<gpx />' } });
beforeEach(() => { vi.clearAllMocks(); mocks.pendingPlans.mockReturnValue([]); mocks.pendingRideCount.mockReturnValue(0); mocks.pendingRideEntries.mockReturnValue([]); mocks.subscribe.mockReturnValue(() => {}); mocks.getSavedRoutes.mockResolvedValue([]); mocks.retryPending.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue({ plans: [plan('new', 'Noch ungefahren'), plan('old', 'Originalplanung', true)], rides: [record('ride-a'), record('ride-b')] }); });
afterEach(cleanup);
it('separates pending plans from all actual repeated rides and retains access to original planning', async () => {
  const onOpenRoute = vi.fn(); render(createElement(RouteArchivePanel, { ownerId: 'alice', onOpenRoute }));
  await screen.findByText('Noch ungefahren'); expect(screen.queryByText('Originalplanung')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Fahrtenhistorie/ }));
  expect(screen.getAllByText('Aufgezeichnete Tour')).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Geplanten Track anzeigen' })[0]);
  expect(onOpenRoute).toHaveBeenCalledWith(expect.objectContaining({ archivePlanId: 'old', validatedRoute: undefined }));
  fireEvent.click(screen.getByRole('button', { name: /Alle gespeicherten Strecken/ }));
  expect(screen.getByText('Originalplanung')).toBeTruthy(); expect(screen.getByText('Noch ungefahren')).toBeTruthy();
});
it('shows failed persistence as an error and provides an explicit retry', async () => {
  mocks.pendingPlans.mockReturnValue([plan('pending','Unsaved')]); render(createElement(RouteArchivePanel, { ownerId: 'alice' }));
  expect(screen.getByRole('alert').textContent).toContain('noch nicht dauerhaft gesichert');
  fireEvent.click(screen.getByRole('button', { name: 'Sicherung erneut versuchen' }));
  await waitFor(() => expect(mocks.retryPending).toHaveBeenCalledWith('alice'));
});
it('renders locally stored data without waiting for a cloud response', async () => {
  mocks.getSavedRoutes.mockImplementation(() => new Promise(() => {})); render(createElement(RouteArchivePanel, { ownerId: 'alice' }));
  expect(await screen.findByText('Noch ungefahren')).toBeTruthy();
});
