import { useState, useEffect } from 'react';

interface GeolocationState {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  error: string | null;
  isTracking: boolean;
}

const DEFAULT_LOCATION = { lat: 52.52, lng: 13.405 }; // Berlin Alexanderplatz

export function useGeolocation(enableHighAccuracy: boolean = true) {
  const [state, setState] = useState<GeolocationState>({
    lat: DEFAULT_LOCATION.lat,
    lng: DEFAULT_LOCATION.lng,
    accuracy: null,
    speed: null,
    heading: null,
    error: null,
    isTracking: false,
  });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState(s => ({ ...s, error: 'Geolocation is not supported by your browser' }));
      return;
    }

    setState(s => ({ ...s, isTracking: true }));

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          error: null,
          isTracking: true,
        });
      },
      (error) => {
        setState(s => ({
          ...s,
          error: error.message,
          isTracking: false,
          // We keep the last known or default coordinates on error
        }));
      },
      {
        enableHighAccuracy,
        timeout: enableHighAccuracy ? 10000 : 25000,
        maximumAge: enableHighAccuracy ? 0 : 30000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setState(s => ({ ...s, isTracking: false }));
    };
  }, [enableHighAccuracy]);

  return state;
}
