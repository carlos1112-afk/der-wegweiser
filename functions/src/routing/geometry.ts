import type { Coordinate } from './contracts';
export function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== 'object') return false;
  const p = value as Coordinate;
  return typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}
export function distanceM(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function cumulativeDistances(geometry: readonly Coordinate[]): number[] {
  const result = [0];
  for (let i = 1; i < geometry.length; i++) result.push(result[i - 1] + distanceM(geometry[i - 1], geometry[i]));
  return result;
}
export interface Projection { distanceM: number; progressM: number; segmentIndex: number; point: Coordinate }
/** Local tangent projection, sufficient for pilot bicycle segments; reject antimeridian geometry separately. */
export function projectSegment(position: Coordinate, a: Coordinate, b: Coordinate, startM: number, index: number): Projection {
  const scaleY = Math.PI / 180 * 6371000;
  const scaleX = scaleY * Math.cos(position.lat * Math.PI / 180);
  const ax = (a.lng - position.lng) * scaleX, ay = (a.lat - position.lat) * scaleY;
  const dx = (b.lng - a.lng) * scaleX, dy = (b.lat - a.lat) * scaleY;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  const point = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
  return { distanceM: distanceM(position, point), progressM: startM + t * distanceM(a, b), segmentIndex: index, point };
}
export function projectRoute(position: Coordinate, geometry: readonly Coordinate[], minProgressM = 0, maxProgressM = Infinity): Projection | null {
  const lengths = cumulativeDistances(geometry);
  let best: Projection | null = null;
  for (let i = 0; i < geometry.length - 1; i++) {
    const projection = projectSegment(position, geometry[i], geometry[i + 1], lengths[i], i);
    if (projection.progressM < minProgressM || projection.progressM > maxProgressM) continue;
    if (!best || projection.distanceM < best.distanceM) best = projection;
  }
  return best;
}
