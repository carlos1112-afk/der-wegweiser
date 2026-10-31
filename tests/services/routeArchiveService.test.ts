import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { RouteArchiveService } from '../../src/services/routeArchiveService';
import type { ArchiveStore, ArchiveEntry } from '../../src/services/routeArchiveService';
import { ConsentService } from '../../src/services/consentService';
import type { Route } from '../../src/types/navigation';
import type { RideSummary } from '../../src/services/gpxRecorderService';
class MemoryStore implements ArchiveStore {
  entries = new Map<string, ArchiveEntry>(); fail = false; gate: Promise<void> | null = null;
  private queue: Promise<void> = Promise.resolve();
  transact(keys: string[], update: (current: (ArchiveEntry | undefined)[]) => ArchiveEntry[]) {
    const task = this.queue.then(async () => {
      if (this.gate) await this.gate;
      if (this.fail) throw new Error('QuotaExceededError');
      const changes = update(keys.map(key => this.entries.get(key)));
      changes.forEach(entry => this.entries.set(entry.key, JSON.parse(JSON.stringify(entry))));
    }); this.queue = task.catch(() => {}); return task;
  }
  async list(owner: string) { await this.queue; return [...this.entries.values()].filter(entry => entry.ownerId === owner).map(entry => JSON.parse(JSON.stringify(entry))); }
  async clear() { await this.queue; this.entries.clear(); }
}
const route = (title: string): Route => ({ id: 'same-source-id', title, pathCoordinates: [[52.5,13.4],[52.501,13.401]], distanceKm: 1 } as Route);
const summary = (distanceKm = 1): RideSummary => ({ distanceKm, durationSeconds: 60, avgSpeedKmH: 10, maxSpeedKmH: 15, elevationGainM: 0, energyWhUsed: 0,
  trackPointsCount: distanceKm ? 2 : 0, coordinates: distanceKm ? [[52.51,13.41],[52.52,13.42]] : [], gpxXmlString: '<gpx>actual track</gpx>' });
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); ConsentService.save({ essential:true,analytics:false,surveys:false,personalizedAds:false }); });
afterEach(() => vi.unstubAllGlobals());
it('keeps every generation, snapshots content, and reloads across service restarts without eviction', async () => {
  const store = new MemoryStore(), archive = new RouteArchiveService(store);
  const original = route('Variante A'); await archive.saveGenerated('alice', original); original.title = 'later mutation';
  await Promise.all(Array.from({ length: 30 }, (_, index) => archive.saveGenerated('alice', route(`Variante ${index}`))));
  const restarted = new RouteArchiveService(store); const result = await restarted.list('alice');
  expect(result.plans).toHaveLength(31); expect(result.plans.some(plan => plan.route.title === 'Variante A')).toBe(true);
  expect((await restarted.list('bob')).plans).toEqual([]); expect(result.plans.every(plan => !plan.hasBeenRidden)).toBe(true);
});
it('retains all failed results for explicit retry and does not claim persistence on failure', async () => {
  const store = new MemoryStore(), archive = new RouteArchiveService(store); store.fail = true;
  await expect(archive.saveGenerated('alice', route('A'))).rejects.toThrow('QuotaExceededError');
  await expect(archive.saveGenerated('alice', route('B'))).rejects.toThrow();
  expect(archive.pendingPlans('alice')).toHaveLength(2); expect(archive.hasPending('alice')).toBe(true); expect(store.entries.size).toBe(0);
  store.fail = false; await archive.retryPending('alice'); expect(archive.hasPending('alice')).toBe(false);
  expect((await archive.list('alice')).plans).toHaveLength(2);
});
it('does not mark a preview/start without GPS as ridden and preserves original versus actual track separately', async () => {
  const archive = new RouteArchiveService(new MemoryStore()), plan = await archive.saveGenerated('alice', route('Tour'));
  const selected = { ...plan.route, archivePlanId: plan.id };
  const empty = await archive.beginRide('alice', selected); await archive.saveRide(empty, summary(0), true);
  expect((await archive.list('alice')).plans[0].hasBeenRidden).toBe(false);
  const ride = await archive.beginRide('alice', selected); await archive.saveRide(ride, summary(), true); await archive.saveRide(ride, summary(.1), false);
  const again = await archive.beginRide('alice', selected); await archive.saveRide(again, summary(2), true);
  const records = await archive.list('alice'); expect(records.plans).toHaveLength(1); expect(records.rides).toHaveLength(3);
  expect(records.plans[0].hasBeenRidden).toBe(true); expect(records.plans[0].route.pathCoordinates).toEqual(selected.pathCoordinates);
  expect(records.rides.find(entry => entry.id === ride.id)?.summary?.distanceKm).toBe(1);
  expect(records.rides.find(entry => entry.id === ride.id)?.summary?.coordinates).not.toEqual(selected.pathCoordinates);
});
it('keeps interrupted ride checkpoints and retries failed finalization without creating a duplicate ride', async () => {
  const store = new MemoryStore(), archive = new RouteArchiveService(store), ride = await archive.beginRide('alice', null);
  await archive.saveRide(ride, summary(.5), false); store.fail = true;
  await expect(archive.saveRide(ride, summary(1), true)).rejects.toThrow(); expect(archive.pendingRideCount('alice')).toBe(1);
  store.fail = false; await archive.retryPending('alice');
  const restarted = new RouteArchiveService(store); expect((await restarted.list('alice')).rides).toMatchObject([{ status: 'completed', summary: { distanceKm: 1 } }]);
});
it('imports legacy plans idempotently without resetting an existing ridden status', async () => {
  const archive = new RouteArchiveService(new MemoryStore()); const plan = await archive.saveGenerated('alice', route('Alt'), 'legacy:old');
  const ride = await archive.beginRide('alice', { ...plan.route, archivePlanId: plan.id }); await archive.saveRide(ride, summary(), true);
  await archive.saveGenerated('alice', route('Alt'), 'legacy:old');
  const records = await archive.list('alice'); expect(records.plans).toHaveLength(1); expect(records.plans[0].hasBeenRidden).toBe(true);
});
it('rejects pending writes after consent change and supports explicit deletion', async () => {
  const store = new MemoryStore(), archive = new RouteArchiveService(store);
  let release = () => {}; store.gate = new Promise<void>(resolve => { release = resolve; });
  const pending = archive.saveGenerated('alice', route('private'));
  ConsentService.save({ essential:false,analytics:false,surveys:false,personalizedAds:false }); release();
  await expect(pending).rejects.toThrow('Einwilligung'); expect(store.entries.size).toBe(0);
  await archive.clear(); expect(archive.hasAnyPending()).toBe(false);
});
