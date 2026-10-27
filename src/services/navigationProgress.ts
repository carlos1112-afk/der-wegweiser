import type { Coordinate, RouteLocation, ValidatedRouteV1 } from '../types/routing';
import { cumulativeDistances, distanceM, isCoordinate, projectRoute } from '../../functions/src/routing/geometry';
export interface ProgressState {
  readonly status: 'on_route' | 'off_route' | 'position_uncertain' | 'arrived';
  readonly progressM: number;
  readonly distanceFromRouteM: number | null;
  readonly shouldRequestRejoin: boolean;
}
/** Pure pilot tracker. Not wired to the legacy hook until real router/session integration passes. */
export class NavigationProgress {
  private progress = 0;
  private previous: RouteLocation | null = null;
  private offSince: number | null = null;
  private offCount = 0;
  private onSince: number | null = null;
  private onCount = 0;
  private offRoute = false;
  private lastRejoinAt = -Infinity;
  private rejoinActive = false;
  private readonly lengths: number[];
  private readonly route: ValidatedRouteV1;
  constructor(route: ValidatedRouteV1, restoredProgressM = 0) {
    this.route = route;
    this.lengths = cumulativeDistances(route.geometry);
    const total = this.lengths[this.lengths.length - 1];
    if (!Number.isFinite(restoredProgressM) || restoredProgressM < 0 || restoredProgressM > total) throw new Error('INVALID_PROGRESS');
    this.progress = restoredProgressM;
  }
  finishRejoin(): void { this.rejoinActive = false; }
  private resetEvidence(): void { this.offSince = null; this.offCount = 0; this.onSince = null; this.onCount = 0; }
  update(position: RouteLocation, now: number): ProgressState {
    const uncertain = (): ProgressState => {
      this.resetEvidence();
      return { status: 'position_uncertain', progressM: this.progress, distanceFromRouteM: null, shouldRequestRejoin: false };
    };
    if (!isCoordinate(position) || !Number.isFinite(now) || position.source !== 'gps' || position.accuracyM === null || !Number.isFinite(position.accuracyM)
      || position.accuracyM < 0 || position.accuracyM > 30 || !Number.isFinite(position.observedAt)
      || now - position.observedAt > 10000 || now < position.observedAt
      || (this.previous && position.observedAt <= this.previous.observedAt)) return uncertain();
    const last = this.previous;
    this.previous = { ...position };
    const elapsedS = last ? (position.observedAt - last.observedAt) / 1000 : 0;
    // Implausible jumps never trigger arrival or recalculation. Next fresh fix may establish a new baseline.
    if (last && distanceM(position, last) > elapsedS * 15 + 2 * (position.accuracyM + (last.accuracyM ?? 0))) return uncertain();
    // A bounded chainage window prevents jumping branches at loops/self-intersections.
    const aheadM = last ? Math.min(500, elapsedS * 15 + 2 * position.accuracyM + 50) : 100;
    const projection = projectRoute(position, this.route.geometry, Math.max(0, this.progress - 30), this.progress + aheadM);
    if (!projection) return uncertain();
    const threshold = Math.max(35, 2 * position.accuracyM);
    if (projection.distanceM > threshold) {
      this.onSince = null; this.onCount = 0;
      if (this.offSince === null) this.offSince = position.observedAt;
      this.offCount++;
      if (this.offCount >= 3 && position.observedAt - this.offSince >= 8000) this.offRoute = true;
    } else {
      this.offSince = null; this.offCount = 0;
      if (projection.distanceM < 20) {
        if (this.onSince === null) this.onSince = position.observedAt;
        this.onCount++;
        if (this.onCount >= 2 && position.observedAt - this.onSince >= 5000) this.offRoute = false;
      } else { this.onSince = null; this.onCount = 0; }
      if (!this.offRoute) this.progress = Math.max(this.progress, projection.progressM);
    }
    const total = this.lengths[this.lengths.length - 1];
    const arrived = !this.offRoute && total - this.progress <= 20
      && distanceM(position, this.route.geometry[this.route.geometry.length - 1]) <= 20;
    const shouldRequestRejoin = this.offRoute && !this.rejoinActive && now - this.lastRejoinAt >= 20000;
    if (shouldRequestRejoin) { this.rejoinActive = true; this.lastRejoinAt = now; }
    return { status: arrived ? 'arrived' : this.offRoute ? 'off_route' : 'on_route', progressM: this.progress,
      distanceFromRouteM: projection.distanceM, shouldRequestRejoin };
  }
  /** Proposals only. Each needs a real validated connection; these are never route geometry. */
  rejoinCandidates(nextMandatoryStopM: number | null): readonly { position: Coordinate; progressM: number }[] {
    const total = this.lengths[this.lengths.length - 1];
    const limit = Math.min(this.progress + 5000, nextMandatoryStopM ?? total, total);
    if (!Number.isFinite(limit) || limit <= this.progress) return [];
    const candidates: Array<{ position: Coordinate; progressM: number }> = [];
    for (let n = 1; n <= 5; n++) {
      const target = this.progress + (limit - this.progress) * n / 5;
      const index = this.lengths.findIndex(length => length >= target);
      if (index <= 0) continue;
      const fromM = this.lengths[index - 1], toM = this.lengths[index];
      if (toM <= fromM) continue;
      const t = (target - fromM) / (toM - fromM), a = this.route.geometry[index - 1], b = this.route.geometry[index];
      candidates.push({ progressM: target, position: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) } });
    }
    return candidates;
  }
}
