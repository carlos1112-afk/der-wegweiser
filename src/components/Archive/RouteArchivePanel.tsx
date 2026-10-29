import { useCallback, useEffect, useState } from 'react';
import type { Route } from '../../types/navigation';
import { routeArchive } from '../../services/routeArchiveService';
import type { ArchivedPlan, ArchivedRide } from '../../services/routeArchiveService';
import { dataRepository } from '../../services/dataRepository';
import { exportRouteToGpx } from '../../services/gpxExportService';
interface Props { ownerId: string; onOpenRoute?: (route: Route) => void }
export function RouteArchivePanel({ ownerId, onOpenRoute }: Props) {
  const [plans, setPlans] = useState<ArchivedPlan[]>([]), [rides, setRides] = useState<ArchivedRide[]>([]);
  const [tab, setTab] = useState<'planned' | 'ridden' | 'all'>('planned');
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [, updatePending] = useState(0);
  const reload = useCallback(async () => {
    const records = await routeArchive.list(ownerId); setPlans(records.plans); setRides(records.rides);
  }, [ownerId]);
  useEffect(() => {
    let active = true, generation = 0;
    const refresh = async () => {
      const current = ++generation;
      try { const records = await routeArchive.list(ownerId); if (active && current === generation) { setPlans(records.plans); setRides(records.rides); } }
      catch (error: any) { if (active && current === generation) setError(error?.message ?? 'Archiv konnte nicht gelesen werden.'); }
    };
    void refresh();
    // Compatibility import must not hold the local archive hostage to a slow cloud lookup.
    void (async () => {
      try {
        const legacy = await dataRepository.getSavedRoutes(ownerId);
        for (const route of legacy) if (route.id && route.pathCoordinates?.length >= 2) await routeArchive.saveGenerated(ownerId, route, `legacy:${route.id}`);
        if (active) await refresh();
      } catch (error: any) { if (active) setError(error?.message ?? 'Frühere Routen konnten nicht importiert werden.'); }
    })();
    const unsubscribe = routeArchive.subscribe(() => { if (active) { updatePending(value => value + 1); void refresh(); } });
    return () => { active = false; generation++; unsubscribe(); };
  }, [ownerId]);
  const pending = routeArchive.pendingPlans(ownerId), pendingRides = routeArchive.pendingRideCount(ownerId);
  const retry = async () => {
    setBusy(true); setError(null);
    try { await routeArchive.retryPending(ownerId); await reload(); } catch (error: any) { setError(error?.message ?? 'Sicherung fehlgeschlagen.'); }
    finally { setBusy(false); }
  };
  const download = (value: unknown, name: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  };
  return <section aria-label="Streckenarchiv und Fahrtenhistorie">
    <p>Auf diesem Gerät gespeichert. Neue Strecken bleiben erhalten, auch wenn eine andere Tour gewählt wird.</p>
    <button type="button" onClick={() => download({ version: 1, plans, rides, pending, pendingRides: routeArchive.pendingRideEntries(ownerId) }, 'wegweiser-streckenarchiv.json')}>Archiv als Sicherungsdatei exportieren</button>
    {(pending.length > 0 || pendingRides > 0) && <div role="alert">
      {pending.length} Strecken und {pendingRides} Aufzeichnungen sind noch nicht dauerhaft gesichert. Keine weitere Generierung bis zur Sicherung.
      <button type="button" disabled={busy} onClick={() => void retry()}>Sicherung erneut versuchen</button>
    </div>}
    {error && <p role="alert">{error}</p>}
    <nav aria-label="Archivbereiche">
      <button type="button" aria-pressed={tab === 'planned'} onClick={() => setTab('planned')}>Ungefahrene Strecken ({plans.filter(plan => !plan.hasBeenRidden).length})</button>
      <button type="button" aria-pressed={tab === 'ridden'} onClick={() => setTab('ridden')}>Fahrtenhistorie ({rides.filter(ride => (ride.summary?.trackPointsCount ?? 0) >= 2 && (ride.summary?.distanceKm ?? 0) > 0).length})</button>
      <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Alle gespeicherten Strecken ({plans.length})</button>
    </nav>
    {(tab === 'planned' || tab === 'all') && <div>{plans.filter(plan => tab === 'all' || !plan.hasBeenRidden).length === 0 && <p>Noch keine ungefahrenen Strecken gespeichert.</p>}
      {plans.filter(plan => tab === 'all' || !plan.hasBeenRidden).map(plan => <article key={plan.id} className="glass-panel" style={{ padding: 12, marginTop: 10 }}>
        <h3>{plan.route.title}</h3><p>{new Date(plan.createdAt).toLocaleString('de-DE')} · {plan.route.distanceKm} km · {plan.hasBeenRidden ? 'Aufzeichnung vorhanden' : plan.origin === 'legacy' ? 'Fahrstatus noch nicht erfasst' : 'Ungefahren'}</p>
        <button type="button" onClick={() => exportRouteToGpx(plan.route)}>GPX exportieren</button>
        {onOpenRoute && <button type="button" onClick={() => onOpenRoute({ ...plan.route, archivePlanId: plan.id, validatedRoute: undefined })}>Track anzeigen</button>}
      </article>)}
    </div>}
    {tab === 'ridden' && <div>{!rides.length && <p>Noch keine Fahrten aufgezeichnet.</p>}
      {rides.map(ride => <article key={ride.id} className="glass-panel" style={{ padding: 12, marginTop: 10 }}>
        <h3>{ride.title}</h3>{!(ride.summary && ride.summary.trackPointsCount >= 2 && ride.summary.distanceKm > 0) && <p>Noch keine gefahrene Strecke nachgewiesen · Aufzeichnungsversuch</p>}<p>{new Date(ride.startedAt).toLocaleString('de-DE')} · {ride.status === 'completed' ? 'Aufzeichnung beendet' : 'Offene / unterbrochene Aufzeichnung'}</p>
        <p>{ride.summary ? `${ride.summary.distanceKm} km · ${ride.summary.durationSeconds} s · ${ride.summary.trackPointsCount} Positionspunkte` : 'Noch keine Positionspunkte gesichert.'}</p>
        {ride.summary && <button type="button" onClick={() => {
          const url = URL.createObjectURL(new Blob([ride.summary!.gpxXmlString], { type: 'application/gpx+xml' }));
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = `fahrt-${ride.id}.gpx`; anchor.click(); URL.revokeObjectURL(url);
        }}>Gefahrenen Track exportieren</button>}
        {ride.planId && plans.find(plan => plan.id === ride.planId) && <button type="button" onClick={() => { const plan = plans.find(plan => plan.id === ride.planId)!; onOpenRoute?.({ ...plan.route, archivePlanId: plan.id, validatedRoute: undefined }); }}>Geplanten Track anzeigen</button>}
      </article>)}
    </div>}
  </section>;
}
