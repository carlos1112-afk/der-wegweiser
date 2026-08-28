import { useState, useEffect, useRef } from 'react';
import type { Route } from '../types/navigation';

export interface TurnManeuver {
  action: 'straight' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right' | 'roundabout' | 'arrive';
  distanceM: number;
  instruction: string;
  nextStreet: string;
  isApproaching: boolean; // < 200m
  isImminent: boolean; // < 50m
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function useRouteTracker(
  userLocation: { lat: number; lng: number },
  route: Route | null,
  onOffRoute?: (distanceM: number) => void
) {
  const [currentManeuver, setCurrentManeuver] = useState<TurnManeuver | null>(null);
  const [offRouteDistanceM, setOffRouteDistanceM] = useState<number>(0);
  const [isOffRoute, setIsOffRoute] = useState<boolean>(false);
  const offRouteCountRef = useRef<number>(0);

  useEffect(() => {
    if (!route || !route.pathCoordinates || route.pathCoordinates.length < 2) {
      setCurrentManeuver(null);
      setIsOffRoute(false);
      return;
    }

    const coords = route.pathCoordinates;

    // 1. Find closest point on route
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < coords.length; i++) {
      const d = haversineMeters(userLocation.lat, userLocation.lng, coords[i][0], coords[i][1]);
      if (d < minDistance) {
        minDistance = d;
        closestIndex = i;
      }
    }

    setOffRouteDistanceM(Math.round(minDistance));

    // Off-route check (> 45m for 2+ consecutive updates)
    if (minDistance > 45) {
      offRouteCountRef.current += 1;
      if (offRouteCountRef.current >= 2) {
        setIsOffRoute(true);
        if (onOffRoute) {
          onOffRoute(Math.round(minDistance));
        }
      }
    } else {
      offRouteCountRef.current = 0;
      setIsOffRoute(false);
    }

    // 2. Find next significant turn maneuver ahead
    const lookAheadIndex = Math.min(coords.length - 1, closestIndex + 1);
    const targetCoord = coords[lookAheadIndex];
    const distToNextM = Math.round(haversineMeters(userLocation.lat, userLocation.lng, targetCoord[0], targetCoord[1]));

    // Detect angle change between segments
    let action: TurnManeuver['action'] = 'straight';
    let instruction = 'Dem Straßenverlauf folgen';
    let nextStreet = 'Radfernweg / Hauptstrecke';

    if (lookAheadIndex < coords.length - 2) {
      const b1 = calculateBearing(coords[closestIndex][0], coords[closestIndex][1], coords[lookAheadIndex][0], coords[lookAheadIndex][1]);
      const b2 = calculateBearing(coords[lookAheadIndex][0], coords[lookAheadIndex][1], coords[lookAheadIndex + 1][0], coords[lookAheadIndex + 1][1]);
      let diff = b2 - b1;
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;

      if (diff > 45 && diff <= 120) {
        action = 'turn-right';
        instruction = `In ${distToNextM}m rechts abbiegen`;
        nextStreet = 'Uferpromenade';
      } else if (diff < -45 && diff >= -120) {
        action = 'turn-left';
        instruction = `In ${distToNextM}m links abbiegen`;
        nextStreet = 'Waldradweg';
      } else if (diff > 15 && diff <= 45) {
        action = 'slight-right';
        instruction = `In ${distToNextM}m halb rechts halten`;
      } else if (diff < -15 && diff >= -45) {
        action = 'slight-left';
        instruction = `In ${distToNextM}m halb links halten`;
      }
    } else if (closestIndex >= coords.length - 3) {
      action = 'arrive';
      instruction = 'Ziel in Kürze erreicht!';
      nextStreet = route.title || 'Zielort';
    }

    setCurrentManeuver({
      action,
      distanceM: distToNextM,
      instruction,
      nextStreet,
      isApproaching: distToNextM <= 200,
      isImminent: distToNextM <= 50,
    });
  }, [userLocation.lat, userLocation.lng, route]);

  return {
    currentManeuver,
    offRouteDistanceM,
    isOffRoute,
  };
}
