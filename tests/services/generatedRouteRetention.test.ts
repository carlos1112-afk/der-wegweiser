import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoutingService } from '../../src/services/routingService';
import { FreeRouteService } from '../../src/services/freeRouteService';
import { routeArchive } from '../../src/services/routeArchiveService';
import { UserIdentity } from '../../src/services/userIdentity';
import { ConsentService } from '../../src/services/consentService';
const start = { lat: 52.52, lng: 13.4, source: 'manual' as const, observedAt: 1, accuracyM: null, confirmed: true };
const prefs = { preferredSurface: 'asphalt', batteryCurrentPercent: 0, batteryCapacityWh: 500 } as any;
const computed = { id: 'computed', geometry: [start,{ lat:52.521,lng:13.401 }], metrics: { distanceM: { value: 100 }, ascentM: { value: null }, durationS: { value: null }, energyWh: { value: null } }, guidanceCapability: 'track' } as any;
beforeEach(() => { ConsentService.save({ essential:true,analytics:false,surveys:false,personalizedAds:false }); vi.spyOn(UserIdentity,'getUserId').mockReturnValue('alice'); vi.spyOn(routeArchive,'hasPending').mockReturnValue(false); });
afterEach(() => vi.restoreAllMocks());
it('archives a completed computation even after a newer preview cancels the old UI request', async () => {
  let resolve: (value: any) => void = () => {}; vi.spyOn(FreeRouteService,'plan').mockImplementation(() => new Promise(done => { resolve = done; }));
  const save = vi.spyOn(routeArchive,'saveGenerated').mockResolvedValue({ id: 'saved' } as any);
  const controller = new AbortController(); const pending = RoutingService.generateDestinationRoute(start,{lat:52.521,lng:13.401},prefs,{mode:'standard',start},undefined,controller.signal);
  controller.abort(); resolve(computed);
  await expect(pending).rejects.toMatchObject({ name:'AbortError' }); expect(save).toHaveBeenCalledWith('alice',expect.objectContaining({ id:'computed',pathCoordinates:expect.any(Array) }));
});
it('blocks new generation while an earlier result still needs durable storage', async () => {
  vi.mocked(routeArchive.hasPending).mockReturnValue(true); const plan = vi.spyOn(FreeRouteService,'plan');
  await expect(RoutingService.generateDestinationRoute(start,{lat:52.521,lng:13.401},prefs,{mode:'standard',start})).rejects.toThrow('Sicherung'); expect(plan).not.toHaveBeenCalled();
});
