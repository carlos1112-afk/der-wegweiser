import { useState, useEffect, useRef } from 'react';
import type { Route } from '../types/navigation';
import { isValidatedRoute } from '../types/routing';
import { NavigationProgress } from '../services/navigationProgress';
export interface TurnManeuver {
  id?: string;
  action: 'straight' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right' | 'roundabout' | 'arrive';
  distanceM: number; instruction: string; nextStreet: string; isApproaching: boolean; isImminent: boolean;
}
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function useRouteTracker(
  userLocation: { lat: number; lng: number; accuracyM?: number | null; observedAt?: number | null },
  route: Route | null, onOffRoute?: (distanceM: number) => void | Promise<void>,
) {
  const [currentManeuver, setCurrentManeuver] = useState<TurnManeuver | null>(null);
  const [offRouteDistanceM, setOffRouteDistanceM] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [positionUncertain, setPositionUncertain] = useState(true);
  const tracker = useRef<{ route: Route; progress: NavigationProgress } | null>(null);
  const callback = useRef(onOffRoute); callback.current = onOffRoute;
  useEffect(() => {
    if (!isValidatedRoute(route?.validatedRoute)) {
      tracker.current = null; setCurrentManeuver(null); setIsOffRoute(false); setOffRouteDistanceM(0); setPositionUncertain(true); return;
    }
    if (tracker.current?.route !== route) tracker.current = { route, progress: new NavigationProgress(route.validatedRoute) };
    if (userLocation.observedAt == null || userLocation.accuracyM == null) {
      setCurrentManeuver(null); setPositionUncertain(true); return;
    }
    const progress = tracker.current.progress;
    const state = progress.update({ lat: userLocation.lat, lng: userLocation.lng, source: 'gps', observedAt: userLocation.observedAt, accuracyM: userLocation.accuracyM, confirmed: true }, Date.now());
    setPositionUncertain(state.status === 'position_uncertain');
    setOffRouteDistanceM(Math.round(state.distanceFromRouteM ?? 0)); setIsOffRoute(state.status === 'off_route');
    if (state.shouldRequestRejoin) {
      Promise.resolve(callback.current?.(Math.round(state.distanceFromRouteM ?? 0))).catch(() => { if (tracker.current?.progress === progress) setPositionUncertain(true); }).finally(() => progress.finishRejoin());
    }
    const next = route.validatedRoute.maneuvers.find(m => m.distanceAlongM >= state.progressM && (m.action !== 'arrive' || state.status === 'arrived'));
    if (!next || state.status === 'off_route' || state.status === 'position_uncertain' || route.validatedRoute.guidanceCapability !== 'turn_by_turn') { setCurrentManeuver(null); return; }
    const distance = Math.max(0, Math.round(next.distanceAlongM - state.progressM));
    setCurrentManeuver({ id: `${route.id}:${next.geometryIndex}:${next.action}`, action: next.action, distanceM: distance,
      instruction: next.instruction, nextStreet: next.street ?? 'Straße unbekannt', isApproaching: distance <= 200, isImminent: distance <= 50 });
  }, [route, userLocation.lat, userLocation.lng, userLocation.accuracyM, userLocation.observedAt]);
  return { currentManeuver, offRouteDistanceM, isOffRoute, positionUncertain };
}
