import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import { ConsentService } from './consentService';
import { RoutingError, validateRoute } from '../types/routing';
import type { RouteCandidateV1, RouteRequestV1, ValidatedRouteV1 } from '../types/routing';
export class FreeRouteService {
  static async plan(request: RouteRequestV1, signal?: AbortSignal): Promise<ValidatedRouteV1> {
    const revision = ConsentService.getRevision(), uid = auth.currentUser?.uid ?? null;
    if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    if (!ConsentService.allowsEssential) throw new RoutingError('CONSENT_REQUIRED');
    if (!functions) throw new RoutingError('UNAVAILABLE');
    const call = httpsCallable<RouteRequestV1, { route: ValidatedRouteV1; tokenCost: number }>(functions, 'computeFreeRoute', { timeout: 15000 });
    const response = await call(request);
    if (signal?.aborted || revision !== ConsentService.getRevision() || !ConsentService.allowsEssential || uid !== (auth.currentUser?.uid ?? null)) throw new DOMException('Abgebrochen', 'AbortError');
    const wire = response.data?.route;
    if (!wire || response.data.tokenCost !== 0) throw new RoutingError('INVALID_GEOMETRY');
    const candidate: RouteCandidateV1 = { version: wire.version, id: wire.id, requestId: wire.requestId, execution: wire.execution,
      geometry: wire.geometry, metrics: wire.metrics, maneuvers: wire.maneuvers, provenance: wire.provenance, criteriaFindings: wire.criteriaFindings };
    const route = await validateRoute(request, candidate, async text => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    });
    if (route.contentHash !== wire.contentHash || route.requestHash !== wire.requestHash) throw new RoutingError('INVALID_GEOMETRY');
    if (signal?.aborted || revision !== ConsentService.getRevision() || uid !== (auth.currentUser?.uid ?? null)) throw new DOMException('Abgebrochen', 'AbortError');
    return route;
  }
}
