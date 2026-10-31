import type { Route } from '../types/navigation';
import type { RideSummary } from './gpxRecorderService';
import { ConsentService } from './consentService';
import { IndexedDbArchiveStore } from './indexedDbArchiveStore';
export interface ArchivedPlan {
  key: string; kind: 'plan'; ownerId: string; id: string; createdAt: string;
  route: Route; hasBeenRidden: boolean; origin: 'generated' | 'legacy';
}
export interface ArchivedRide {
  key: string; kind: 'ride'; ownerId: string; id: string; planId: string | null;
  title: string; startedAt: string; updatedAt: string; status: 'recording' | 'completed'; summary: RideSummary | null;
}
export type ArchiveEntry = ArchivedPlan | ArchivedRide;
export interface ArchiveStore {
  transact(keys: string[], update: (current: (ArchiveEntry | undefined)[]) => ArchiveEntry[]): Promise<void>;
  list(ownerId: string): Promise<ArchiveEntry[]>;
  clear(): Promise<void>;
}
const snapshot = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const key = (owner: string, kind: string, id: string) => JSON.stringify([owner, kind, id]);
export class RouteArchiveService {
  private pending = new Map<string, ArchivedPlan>();
  private pendingRides = new Map<string, { ride: ArchivedRide; summary: RideSummary; completed: boolean }>();
  private ids = new WeakMap<Route, Map<string, string>>();
  private listeners = new Set<() => void>();
  constructor(privateStore: ArchiveStore) { this.store = privateStore; }
  private readonly store: ArchiveStore;
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(): void { this.listeners.forEach(listener => { try { listener(); } catch { console.warn('Archivansicht konnte nicht aktualisiert werden; Speicherung wird fortgesetzt.'); } }); }
  private authorize(ownerId: string): number {
    if (!ownerId || !ConsentService.allowsEssential) throw new Error('Routenarchiv benötigt die aktuelle Einwilligung.');
    return ConsentService.getRevision();
  }
  private guard(revision: number): void {
    if (!ConsentService.allowsEssential || ConsentService.getRevision() !== revision) throw new Error('Archivierung wegen geänderter Einwilligung abgebrochen.');
  }
  pendingPlans(ownerId: string): ArchivedPlan[] { return [...this.pending.values()].filter(plan => plan.ownerId === ownerId).map(snapshot); }
  hasPending(ownerId: string): boolean { return this.pendingPlans(ownerId).length > 0 || [...this.pendingRides.values()].some(entry => entry.ride.ownerId === ownerId); }
  hasAnyPending(): boolean { return this.pending.size > 0 || this.pendingRides.size > 0; }
  pendingRideEntries(ownerId: string) { return [...this.pendingRides.values()].filter(task => task.ride.ownerId === ownerId).map(snapshot); }
  pendingRideCount(ownerId: string): number { return [...this.pendingRides.values()].filter(entry => entry.ride.ownerId === ownerId).length; }
  async saveGenerated(ownerId: string, route: Route, stableId?: string): Promise<ArchivedPlan> {
    const revision = this.authorize(ownerId);
    if (!route || typeof route.id !== 'string' || !Array.isArray(route.pathCoordinates) || route.pathCoordinates.length < 2) throw new Error('Keine vollständige Strecke zum Speichern vorhanden.');
    if (route.archivePlanId) {
      let saved: ArchivedPlan | undefined;
      await this.store.transact([key(ownerId, 'plan', route.archivePlanId)], ([entry]) => { this.guard(revision); if (entry?.kind === 'plan') saved = entry; return []; });
      if (saved) return snapshot(saved);
    }
    let owners = this.ids.get(route); if (!owners) { owners = new Map(); this.ids.set(route, owners); }
    let id = owners.get(ownerId); if (!id) { id = stableId ?? crypto.randomUUID(); owners.set(ownerId, id); }
    const storageKey = key(ownerId, 'plan', id);
    const plan = this.pending.get(storageKey) ?? { key: storageKey, kind: 'plan' as const, ownerId, id, createdAt: new Date().toISOString(), route: snapshot(route), hasBeenRidden: false, origin: stableId?.startsWith('legacy:') ? 'legacy' as const : 'generated' as const };
    this.pending.set(storageKey, plan); this.notify();
    await this.store.transact([storageKey], ([existing]) => {
      this.guard(revision);
      // First snapshot is immutable; repeating the same save must never reset the ridden status.
      return existing ? [] : [plan];
    });
    this.guard(revision); this.pending.delete(storageKey); this.notify();
    return snapshot(plan);
  }
  async retryPending(ownerId: string): Promise<void> {
    const revision = this.authorize(ownerId);
    for (const plan of this.pendingPlans(ownerId)) {
      await this.store.transact([plan.key], ([existing]) => { this.guard(revision); return existing ? [] : [plan]; });
      this.guard(revision); this.pending.delete(plan.key);
    }
    for (const task of [...this.pendingRides.values()].filter(task => task.ride.ownerId === ownerId)) await this.saveRide(task.ride, task.summary, task.completed);
    this.notify();
  }
  async list(ownerId: string): Promise<{ plans: ArchivedPlan[]; rides: ArchivedRide[] }> {
    const revision = this.authorize(ownerId), entries = await this.store.list(ownerId); this.guard(revision);
    if (entries.some(entry => entry.ownerId !== ownerId || !['plan', 'ride'].includes(entry.kind))) throw new Error('Ungültiger Archivbestand.');
    return { plans: entries.filter((entry): entry is ArchivedPlan => entry.kind === 'plan').sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
      rides: entries.filter((entry): entry is ArchivedRide => entry.kind === 'ride').sort((a,b) => b.startedAt.localeCompare(a.startedAt)) };
  }
  async beginRide(ownerId: string, route: Route | null): Promise<ArchivedRide> {
    const revision = this.authorize(ownerId), plan = route ? await this.saveGenerated(ownerId, route) : null;
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const ride: ArchivedRide = { key: key(ownerId, 'ride', id), kind: 'ride', ownerId, id, planId: plan?.id ?? null,
      title: route?.title ?? 'Freie Fahrt', startedAt: now, updatedAt: now, status: 'recording', summary: null };
    await this.store.transact([ride.key], ([existing]) => { this.guard(revision); if (existing) throw new Error('Aufzeichnung bereits vorhanden.'); return [ride]; });
    this.notify(); return snapshot(ride);
  }
  async saveRide(ride: ArchivedRide, summary: RideSummary, completed: boolean): Promise<void> {
    const revision = this.authorize(ride.ownerId), captured = snapshot(summary);
    if (!Number.isFinite(captured.distanceKm) || captured.distanceKm < 0 || !Array.isArray(captured.coordinates)) throw new Error('Ungültige Aufzeichnung.');
    const task = { ride: snapshot(ride), summary: captured, completed };
    this.pendingRides.set(ride.key, task); this.notify();
    const planKey = ride.planId ? key(ride.ownerId, 'plan', ride.planId) : null;
    await this.store.transact([ride.key, ...(planKey ? [planKey] : [])], ([existing, plan]) => {
      this.guard(revision);
      if (existing?.kind !== 'ride') throw new Error('Aufzeichnung fehlt im Archiv.');
      if (existing.status === 'completed') return [];
      const updates: ArchiveEntry[] = [{ ...existing, updatedAt: new Date().toISOString(), status: completed ? 'completed' : 'recording', summary: captured }];
      // Taking over a preview is not proof of a ride. Only recorded movement changes this status.
      if (plan?.kind === 'plan' && captured.coordinates.length >= 2 && captured.distanceKm > 0) updates.push({ ...plan, hasBeenRidden: true });
      return updates;
    });
    if (this.pendingRides.get(ride.key) === task) this.pendingRides.delete(ride.key);
    this.notify();
  }
  async clear(): Promise<void> { this.pending.clear(); this.pendingRides.clear(); this.ids = new WeakMap(); await this.store.clear(); this.notify(); }
}
export const routeArchive = new RouteArchiveService(new IndexedDbArchiveStore());
ConsentService.onChange(flags => { if (!flags?.essential) return routeArchive.clear(); });
