import { RoutingError } from '../../functions/src/routing/contracts';
import type { NavigationSessionV1, RouteRequestV1, ValidatedRouteV1 } from '../../functions/src/routing/contracts';
import { parseRouteRequest } from '../../functions/src/routing/validation';
export type PlanningState = { status: 'idle' } | { status: 'planning'; requestId: string }
  | { status: 'preview'; route: ValidatedRouteV1 } | { status: 'error'; error: RoutingError };
export interface RouteExecutor {
  plan(request: RouteRequestV1, signal: AbortSignal): Promise<ValidatedRouteV1>;
}
/** Drafts never replace active navigation. Auth/consent changes invalidate in-flight results. */
export class RouteCoordinator {
  private generation = 0;
  private controller: AbortController | null = null;
  private allowed = false;
  private authId: string | null = null;
  private consentVersion: string | null = null;
  private previewRequest: RouteRequestV1 | null = null;
  private stateValue: PlanningState = { status: 'idle' };
  private sessionValue: NavigationSessionV1 | null = null;
  private readonly executor: RouteExecutor;
  constructor(executor: RouteExecutor) { this.executor = executor; }
  get state(): PlanningState { return this.stateValue; }
  get navigation(): NavigationSessionV1 | null { return this.sessionValue; }
  setContext(authId: string | null, consentVersion: string | null): void {
    if (authId !== this.authId || consentVersion !== this.consentVersion) {
      this.cancel();
      this.sessionValue = null;
    }
    this.authId = authId;
    this.consentVersion = consentVersion;
    this.allowed = consentVersion !== null;
  }
  cancel(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    this.previewRequest = null;
    this.stateValue = { status: 'idle' };
  }
  async plan(input: RouteRequestV1): Promise<void> {
    this.cancel();
    if (!this.allowed) throw new RoutingError('CONSENT_REQUIRED');
    const request = parseRouteRequest(input);
    if (request.profile.consentVersion !== this.consentVersion) throw new RoutingError('CONSENT_REQUIRED');
    if (request.planning === 'ai') throw new RoutingError('PREMIUM_UNAVAILABLE');
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.stateValue = { status: 'planning', requestId: request.requestId };
    try {
      const route = await this.executor.plan(request, controller.signal);
      if (generation !== this.generation || controller.signal.aborted || !this.allowed) return;
      if (route.requestId !== request.requestId) throw new RoutingError('INVALID_GEOMETRY');
      this.previewRequest = request;
      this.stateValue = { status: 'preview', route };
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      this.stateValue = { status: 'error', error: error instanceof RoutingError ? error : new RoutingError('UNAVAILABLE') };
    } finally {
      if (generation === this.generation) this.controller = null;
    }
  }
  /** Explicit user action; imported/legacy geometry cannot satisfy the argument type. */
  startNavigation(session: NavigationSessionV1): void {
    if (!this.allowed) throw new RoutingError('CONSENT_REQUIRED');
    if (this.stateValue.status !== 'preview' || session.originalRoute !== this.stateValue.route
      || JSON.stringify(session.originalRequest) !== JSON.stringify(this.previewRequest)) throw new RoutingError('INVALID_REQUEST');
    this.sessionValue = session;
  }
}
